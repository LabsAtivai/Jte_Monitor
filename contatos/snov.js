/**
 * Enriquecimento de contatos via Snov.io Domain Search
 *
 * Fluxo:
 *  1. Pega empresas distintas da contatos_reclamadas que têm email
 *  2. Extrai domínio do email
 *  3. Busca todos os prospects do domínio na Snov.io (sem filtro de cargo)
 *  4. Para cada prospect com email, salva na tabela contatos_snov
 *
 * .env:
 *   DB_HOST, DB_USER, DB_PASS, DB_NAME
 *   SNOV_CLIENT_ID=149e98b28737d43e1a160022d94769f6
 *   SNOV_CLIENT_SECRET=8b67264872377bdeaa1f713c323a80ce
 */
require("dotenv").config();
const mysql = require("mysql2/promise");
const https = require("https");

const SNOV_ID     = process.env.SNOV_CLIENT_ID;
const SNOV_SECRET = process.env.SNOV_CLIENT_SECRET;

// ── Snov.io auth ──────────────────────────────────────────────
let snovToken = null;
let tokenExp  = 0;

async function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0,200)}`)); }
      });
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function getToken() {
  if (snovToken && Date.now() < tokenExp) return snovToken;
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     SNOV_ID,
    client_secret: SNOV_SECRET,
  }).toString();
  const res = await fetchJson("https://api.snov.io/v1/oauth/access_token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  snovToken = res.access_token;
  tokenExp  = Date.now() + (res.expires_in - 60) * 1000;
  return snovToken;
}

async function snovPost(path, params) {
  const token = await getToken();
  const qs    = new URLSearchParams(params).toString();
  const url   = `https://api.snov.io${path}?${qs}`;
  return fetchJson(url, {
    method:  "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

async function snovGet(path, params = {}) {
  const token = await getToken();
  const qs    = new URLSearchParams(params).toString();
  const url   = `https://api.snov.io${path}${qs ? "?" + qs : ""}`;
  return fetchJson(url, {
    method:  "GET",
    headers: { authorization: `Bearer ${token}` },
  });
}

// ── Polling helper ────────────────────────────────────────────
async function pollResult(getUrl, maxTentativas = 20, delayMs = 4000) {
  for (let i = 0; i < maxTentativas; i++) {
    const res = await snovGet(getUrl);
    if (res.status === "completed") return res;
    if (res.status === "in progress" || res.status === "in_progress" || !res.status) {
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }
    throw new Error(`Status inesperado: ${res.status}`);
  }
  // Timeout — retorna vazio em vez de erro
  return { data: [], status: "timeout" };
}

// ── Domain search completo ────────────────────────────────────
async function buscarDominio(dominio) {
  try {
    // 1. Inicia busca de info da empresa
    const startRes = await snovPost("/v2/domain-search/start", { domain: dominio });
    if (!startRes?.meta?.task_hash) return null;

    // 2. Aguarda resultado
    const result = await pollResult(
      `/v2/domain-search/result/${startRes.meta.task_hash}`
    );
    if (!result?.data) return null;

    const info = result.data;

    // 3. Busca prospects (sem filtro de cargo)
    const prosStart = await snovPost("/v2/domain-search/prospects/start", { domain: dominio, page: 1 });
    if (!prosStart?.meta?.task_hash) return { info, prospects: [] };

    const prosResult = await pollResult(
      `/v2/domain-search/prospects/result/${prosStart.meta.task_hash}`
    );
    const prospects = prosResult?.data || [];

    // 4. Busca domain emails genéricos
    const emailsStart = await snovPost("/v2/domain-search/domain-emails/start", { domain: dominio });
    let domainEmails = [];
    if (emailsStart?.meta?.task_hash) {
      const emailsResult = await pollResult(
        `/v2/domain-search/domain-emails/result/${emailsStart.meta.task_hash}`
      );
      domainEmails = emailsResult?.data || [];
    }

    // 5. Busca contatos genéricos (sales@, contact@, etc)
    const genericStart = await snovPost("/v2/domain-search/generic-contacts/start", { domain: dominio });
    let genericEmails = [];
    if (genericStart?.meta?.task_hash) {
      const genericResult = await pollResult(
        `/v2/domain-search/generic-contacts/result/${genericStart.meta.task_hash}`
      );
      genericEmails = genericResult?.data || [];
    }

    return { info, prospects, domainEmails, genericEmails };

  } catch (e) {
    console.warn(`  ⚠️  Snov.io erro (${dominio}): ${e.message}`);
    return null;
  }
}

// ── MySQL ─────────────────────────────────────────────────────
async function main() {
  console.log("🔌 Conectando MySQL...");
  const pool = await mysql.createPool({
    host:            process.env.DB_HOST || "207.244.249.157",
    port:            Number(process.env.DB_PORT || 3306),
    user:            process.env.DB_USER || "jte",
    password:        process.env.DB_PASS || "",
    database:        process.env.DB_NAME || "jtemonitor",
    connectionLimit: 5,
  });
  await pool.query("SELECT 1");
  console.log("✅ MySQL OK");

  // Cria tabela se não existir
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contatos_snov (
      id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      dominio          VARCHAR(255)    NOT NULL,
      reclamada        VARCHAR(500)    NULL,
      numeroProcesso   VARCHAR(64)     NULL,
      vara             VARCHAR(255)    NULL,
      tipo             ENUM('prospect','domain_email','generic') NOT NULL DEFAULT 'prospect',
      firstName        VARCHAR(255)    NULL,
      lastName         VARCHAR(255)    NULL,
      nomeCompleto     VARCHAR(500)    NULL,
      cargo            VARCHAR(255)    NULL,
      email            VARCHAR(255)    NULL,
      linkedinUrl      VARCHAR(500)    NULL,
      companyName      VARCHAR(255)    NULL,
      companyCity      VARCHAR(255)    NULL,
      companyIndustry  VARCHAR(255)    NULL,
      companySize      VARCHAR(50)     NULL,
      createdAt        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_snov (dominio, email, tipo),
      KEY ix_dominio (dominio),
      KEY ix_reclamada (reclamada(100)),
      KEY ix_cargo (cargo(80))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("✅ Tabela contatos_snov pronta");

  // Migração idempotente: dedupe por identidade real do contato (email, ou
  // nome+cargo+linkedin quando não há email), pois email NULL não bloqueia
  // duplicidade em UNIQUE KEY do MySQL.
  const [[{ cnt: temColuna }]] = await pool.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contatos_snov' AND COLUMN_NAME = 'chaveDedupe'
  `);
  if (!temColuna) {
    console.log("🔧 Migrando dedupe de contatos_snov...");
    await pool.query(`
      ALTER TABLE contatos_snov
        ADD COLUMN chaveDedupe CHAR(64)
          GENERATED ALWAYS AS (
            SHA2(LOWER(TRIM(COALESCE(NULLIF(email,''), CONCAT_WS('|', nomeCompleto, cargo, linkedinUrl)))), 256)
          ) STORED
    `);
    await pool.query(`
      DELETE t1 FROM contatos_snov t1
      JOIN contatos_snov t2
        ON t1.dominio = t2.dominio
       AND t1.chaveDedupe = t2.chaveDedupe
       AND t1.id > t2.id
    `);
    await pool.query(`
      ALTER TABLE contatos_snov
        DROP INDEX uq_snov,
        ADD UNIQUE KEY uq_snov (dominio, chaveDedupe)
    `);
    console.log("✅ Dedupe migrado, duplicados removidos");
  }

  // Pega domínios distintos das empresas com email (todos, sem limite —
  // domínio já processado é pulado abaixo via contagem em contatos_snov)
  const [empresas] = await pool.query(`
    SELECT
      DISTINCT SUBSTRING_INDEX(email, '@', -1) AS dominio,
      reclamada,
      numeroProcesso,
      vara
    FROM contatos_reclamadas
    WHERE email IS NOT NULL
      AND email != ''
      AND email NOT LIKE '%gmail%'
      AND email NOT LIKE '%hotmail%'
      AND email NOT LIKE '%yahoo%'
      AND email NOT LIKE '%outlook%'
      AND email NOT LIKE '%ig.com%'
      AND email NOT LIKE '%uol.com%'
      AND email NOT LIKE '%terra.com%'
      AND email NOT LIKE '%bol.com%'
    ORDER BY reclamada
  `);

  console.log(`\n📋 ${empresas.length} domínios para enriquecer\n`);

  let processados = 0, inseridos = 0, semResultado = 0;
  const t0 = Date.now();

  for (const emp of empresas) {
    const { dominio, reclamada, numeroProcesso, vara } = emp;

    // Verifica se já processou esse domínio
    const [[{ cnt }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM contatos_snov WHERE dominio = ?", [dominio]
    );
    if (cnt > 0) { processados++; continue; }

    process.stdout.write(`\r  ${processados}/${empresas.length} | ${dominio.padEnd(40)} `);

    const resultado = await buscarDominio(dominio);

    if (!resultado) {
      semResultado++;
      processados++;
      continue;
    }

    const { info, prospects, domainEmails, genericEmails } = resultado;

    const upsert = async (tipo, campos) => {
      await pool.query(
        `INSERT INTO contatos_snov
           (dominio, reclamada, numeroProcesso, vara, tipo,
            firstName, lastName, nomeCompleto, cargo, email, linkedinUrl,
            companyName, companyCity, companyIndustry, companySize)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           tipo         = CASE WHEN FIELD(VALUES(tipo),'prospect','domain_email','generic')
                                     < FIELD(tipo,'prospect','domain_email','generic')
                                THEN VALUES(tipo) ELSE tipo END,
           firstName    = COALESCE(firstName, VALUES(firstName)),
           lastName     = COALESCE(lastName,  VALUES(lastName)),
           nomeCompleto = COALESCE(nomeCompleto, VALUES(nomeCompleto)),
           cargo        = COALESCE(cargo, VALUES(cargo)),
           linkedinUrl  = COALESCE(linkedinUrl, VALUES(linkedinUrl)),
           companyName  = COALESCE(companyName, VALUES(companyName)),
           companyCity  = COALESCE(companyCity, VALUES(companyCity)),
           companyIndustry = COALESCE(companyIndustry, VALUES(companyIndustry)),
           companySize  = COALESCE(companySize, VALUES(companySize))`,
        [dominio, reclamada, numeroProcesso, vara, tipo,
         campos.firstName||null, campos.lastName||null, campos.nomeCompleto||null,
         campos.cargo||null, campos.email||null, campos.linkedinUrl||null,
         info?.company_name||null, info?.city||null, info?.industry||null, info?.size||null]
      );
      inseridos++;
    };

    // Salva prospects
    for (const p of prospects) {
      try {
        await upsert("prospect", {
          firstName: p.first_name, lastName: p.last_name,
          nomeCompleto: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
          cargo: p.position, linkedinUrl: p.source_page,
        });
      } catch {}
    }

    // Salva domain emails
    for (const e of domainEmails) {
      try { await upsert("domain_email", { email: e.email }); } catch {}
    }

    // Salva genéricos
    for (const e of genericEmails) {
      try { await upsert("generic", { email: e.email }); } catch {}
    }

    processados++;
    await new Promise(r => setTimeout(r, 1500)); // rate limit
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n\n${"=".repeat(50)}`);
  console.log(`✅ Concluído em ${elapsed}s`);
  console.log(`   Processados: ${processados}`);
  console.log(`   Inseridos:   ${inseridos}`);
  console.log(`   Sem resultado: ${semResultado}`);

  await pool.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });