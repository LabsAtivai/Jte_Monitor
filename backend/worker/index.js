// backend/worker/index.js
// ================================================================
//  Worker paralelo JTe — BullMQ + Playwright
//
//  node worker/index.js                  → completo (fila + workers)
//  node worker/index.js --only-queue     → só enfileira
//  node worker/index.js --only-work      → só consome
//  CONCURRENCY=5 node worker/index.js
//  MESES=3 node worker/index.js
//  VARAS=3 node worker/index.js          → limita a N varas (teste)
//  node worker/index.js --national-once   → todos os TRTs, arquivos locais
//  node worker/index.js --national-daily  → execução diária, arquivos locais
// ================================================================
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Queue, Worker } = require("bullmq");
const { chromium }      = require("playwright");
const mysql             = require("mysql2/promise");
const fs                = require("fs");
const path              = require("path");

const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const MESES       = Number(process.env.MESES       || 6);
const VARAS_LIMIT = Number(process.env.VARAS        || 0); // 0 = todas
const TRIBUNAL    = (process.env.TRT || "TRT2 - São Paulo").trim();
const REGIAO      = (process.env.REGIAO || "São Paulo - Zonas Central, Norte e Oeste").trim();
const DATA_INICIO = (process.env.DATA_INICIO || "").trim();
const DATA_FIM    = (process.env.DATA_FIM || "").trim();
const ONLY_QUEUE  = process.argv.includes("--only-queue");
const ONLY_WORK   = process.argv.includes("--only-work");
const QUEUE_NAME  = TRIBUNAL === "TRT2 - São Paulo" && REGIAO === "São Paulo - Zonas Central, Norte e Oeste"
  ? "jte" : `jte_${require("crypto").createHash("sha256").update(`${TRIBUNAL}|${REGIAO}`).digest("hex").slice(0,16)}`;
const REDIS       = {
  host:     process.env.REDIS_HOST || "127.0.0.1",
  port:     Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASS || undefined,
};

// ── Helpers de data ──────────────────────────────────────────
function isWeekday(d) { const w=d.getDay(); return w!==0&&w!==6; }
function brToIso(br) {
  const [dd,mm,yyyy]=br.split("/").map(Number);
  return `${yyyy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
}
function parseBR(br) { const [dd,mm,yyyy]=br.split("/").map(Number); return new Date(yyyy,mm-1,dd); }
function hoje() {
  const d=new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function gerarDatas() {
  if (DATA_INICIO || DATA_FIM) {
    if (!DATA_INICIO || !DATA_FIM || !/^\d{2}\/\d{2}\/\d{4}$/.test(DATA_INICIO) || !/^\d{2}\/\d{2}\/\d{4}$/.test(DATA_FIM)) {
      throw new Error("Informe DATA_INICIO e DATA_FIM juntos no formato DD/MM/AAAA.");
    }
    const inicio=parseBR(DATA_INICIO), fim=parseBR(DATA_FIM);
    const formato=d=>`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || formato(inicio)!==DATA_INICIO || formato(fim)!==DATA_FIM || inicio>fim) throw new Error("Intervalo DATA_INICIO/DATA_FIM inválido.");
    const datas=[];
    for(let d=new Date(inicio);d<=fim;d.setDate(d.getDate()+1)) if(isWeekday(d)) datas.push(`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`);
    return datas;
  }
  const i=new Date(); i.setMonth(i.getMonth()+1);
  const f=new Date(i); f.setMonth(f.getMonth()+MESES);
  const datas=[];
  for(let d=new Date(i);d<=f;d.setDate(d.getDate()+1)){
    if(!isWeekday(d)) continue;
    const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0");
    datas.push(`${dd}/${mm}/${d.getFullYear()}`);
  }
  return datas;
}

// ── DB pool ──────────────────────────────────────────────────
async function dbPool() {
  const p = mysql.createPool({
    host: process.env.DB_HOST||"127.0.0.1", port: Number(process.env.DB_PORT||3306),
    user: process.env.DB_USER||"jte",       password: process.env.DB_PASS||"",
    database: process.env.DB_NAME||"jte",   waitForConnections: true, connectionLimit: CONCURRENCY*3,
  });
  await p.query("SELECT 1");
  return p;
}

// ── Browser helpers ──────────────────────────────────────────
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
async function matSel(page,loc,txt){
  await loc.scrollIntoViewIfNeeded().catch(()=>{});
  await loc.click({force:true});
  const p=page.locator(".mat-mdc-select-panel");
  await p.waitFor({state:"visible",timeout:20000});
  const opt=p.locator("mat-option").filter({hasText:new RegExp(`^\\s*${escRe(txt)}\\s*$`,"i")}).first();
  await opt.waitFor({state:"visible",timeout:20000});
  await opt.scrollIntoViewIfNeeded().catch(()=>{});
  await opt.click({force:true});
  await p.waitFor({state:"hidden",timeout:20000}).catch(()=>{});
  await page.waitForTimeout(150);
}
async function waitEnabled(page,sel){
  const l=page.locator(sel); await l.waitFor({timeout:20000});
  await page.waitForFunction(el=>el.getAttribute("aria-disabled")!=="true",await l.elementHandle(),{timeout:20000});
}
async function abrirSeletorUnidade(page){
  const btn=page.getByTestId("pautaButtonSelecaoUnidade");
  const titulo=page.locator('h1.tituloSelecaoTribunal:has-text("Órgão")');
  await btn.waitFor({state:"visible",timeout:20000});
  for(let tentativa=0;tentativa<3;tentativa++){
    await btn.click({force:true});
    if(await titulo.waitFor({state:"visible",timeout:1500}).then(()=>true).catch(()=>false))return;
    await page.waitForTimeout(500);
  }
  await titulo.waitFor({state:"visible",timeout:20000});
}
const XDATA='//*[@id="main-content"]/ng-component[3]/ion-content/div/div/ion-grid/ion-row[2]/ion-col[2]/ion-button';
const SNEXT="#main-content > ng-component:nth-child(3) > ion-content > div > div > ion-grid > ion-row:nth-child(2) > ion-col:nth-child(3) > ion-button";
const SPREV="#main-content > ng-component:nth-child(3) > ion-content > div > div > ion-grid > ion-row:nth-child(2) > ion-col:nth-child(1) > ion-button";

async function lerData(page){
  try{const r=await page.evaluate(xp=>{
    const n=document.evaluate(xp,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
    if(!n)return"";const b=n.shadowRoot?.querySelector("button")||n.querySelector?.("button");
    return(b?.innerText||b?.textContent||n.innerText||"").trim();
  },XDATA);if(r)return r;}catch{}return"";
}
async function ionClick(page,sel){
  return page.evaluate(s=>{
    const h=document.querySelector(s);if(!h)return false;
    (h.shadowRoot?.querySelector("button")||h.querySelector?.("button")||h).click();return true;
  },sel).catch(()=>false);
}
async function navData(page,alvo){
  const am=parseBR(alvo).getTime();
  for(let i=0;i<220;i++){
    const r=await lerData(page); if(r?.includes(alvo))return true;
    const m=String(r??"").match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    const cm=m?parseBR(m[0]).getTime():0; const ant=r;
    const ok=(cm&&cm>am)?await ionClick(page,SPREV):await ionClick(page,SNEXT);
    if(!ok){await page.waitForTimeout(200);continue;}
    const t0=Date.now();
    while(Date.now()-t0<2500){const d=await lerData(page);if(d&&d!==ant){if(d.includes(alvo))return true;break;}await page.waitForTimeout(80);}
  }
  return(await lerData(page)).includes(alvo);
}
async function esperar(page){
  for(const s of["ion-spinner",".mat-mdc-progress-spinner"]){
    const sp=page.locator(s).first();
    if(await sp.isVisible({timeout:300}).catch(()=>false)) await sp.waitFor({state:"hidden",timeout:15000}).catch(()=>{});
  }
  let last=-1;
  for(let i=0;i<20;i++){
    const c=await page.locator("ion-list ion-item").count().catch(()=>0);
    if(c===last){await page.waitForTimeout(500);if(await page.locator("ion-list ion-item").count().catch(()=>0)===c)return c;}
    last=c;await page.waitForTimeout(250);
  }
  return last;
}
async function extrair(page){
  if(!await page.locator("ion-list ion-item").count().catch(()=>0))return[];
  return page.evaluate(()=>{
    function clean(s){if(!s)return"";return s.split(String.fromCharCode(160)).join(" ").replace(/[ \t]+/g," ").replace(/ X$/i,"").trim();}
    return Array.from(document.querySelectorAll("ion-list ion-item")).map(item=>{
      const get=sel=>{const el=item.querySelector(sel);return el?el.textContent.replace(/\u00a0/g," ").trim():"";};
      const pts=Array.from(item.querySelectorAll(".item-desc-small.item-text-wrap")).map(e=>e.textContent.replace(/\u00a0/g," ").trim()).filter(Boolean);
      return{numeroProcesso:get(".JT-item-texto-negrito"),sessao:[get(".sessao"),get(".palavrasRight")].filter(Boolean).join(" - "),
        juiz:pts[0]||"",reclamante:clean(pts[1]||""),reclamada:(pts[2]||"").replace(/\s+/g," ").trim()};
    }).filter(p=>p.numeroProcesso);
  });
}

// ── FIX 1: Verificar polo passivo sem advogado ───────────────
// Abre o detalhe de cada processo e verifica se tem advogado
// constituído no polo passivo. Retorna true se NÃO tem advogado.
async function semAdvogado(page, numeroProcesso, diagnostico = null) {
  try {
    // Procura o item na lista pelo número do processo e clica
    const item = page.locator("ion-list ion-item").filter({
      hasText: numeroProcesso
    }).first();

    if (!await item.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    await item.click({ force: true });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(800);

    // FIX 2: Salva HTML de debug para os primeiros processos (desativar em produção)
    if (process.env.DEBUG_HTML === "1") {
      const htmlDir = path.join(process.cwd(), "output");
      if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
      const htmlPath = path.join(htmlDir, `debug_${numeroProcesso.replace(/[^0-9]/g, "")}.html`);
      fs.writeFileSync(htmlPath, await page.content(), "utf8");
      console.log(`\n🔍 HTML salvo: ${htmlPath}`);
    }

    // Extrai todo o texto da página de detalhe
    const textoCompleto = await page.evaluate(() => document.body.innerText || "");

    // Evidência observada no TRT-1: ao clicar no processo, o JTe pode exibir
    // apenas um pedido de autenticação. Isso não prova ausência de advogado.
    // Nesse caso, fecha o aviso, mantém a pauta aberta e exclui o processo.
    if (paginaDetalheInconclusiva(textoCompleto)) {
      if (diagnostico) diagnostico.inconclusivos++;
      console.warn(`\n⚠️  ${numeroProcesso}: detalhe exige autenticação; classificação inconclusiva.`);
      const nao = page.locator("ion-button,button").filter({ hasText: /^não$/i }).last();
      if (await nao.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nao.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }
      const ok = page.locator("ion-button,button").filter({ hasText: /^ok$/i }).last();
      if (await ok.isVisible({ timeout: 500 }).catch(() => false)) await ok.click({ force: true }).catch(() => {});
      return false;
    }

    // Verifica se há advogado no polo passivo
    // Padrões encontrados no JTe: "Advogado:", "Adv.:", "OAB", "Dr.", "Dra."
    const poloPassivoSection = extrairSecaoPoloPassivo(textoCompleto);
    const temAdvogado = verificarAdvogadoNoTexto(poloPassivoSection || textoCompleto);

    // Volta para a lista
    await page.goBack().catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);

    return !temAdvogado;
  } catch (e) {
    console.warn(`\n⚠️  Erro ao verificar ${numeroProcesso}: ${e.message}`);
    return false; // conservador: se der erro, não inclui
  }
}

function paginaDetalheInconclusiva(texto) {
  if (!texto) return true;
  return /para\s+realizar\s+essa\s+a[cç][aã]o\s+[ée]\s+necess[aá]rio\s+estar\s+autenticado/i.test(texto)
    || /deseja\s+se\s+autenticar\s+agora/i.test(texto);
}

function extrairSecaoPoloPassivo(texto) {
  // Tenta isolar a seção de polo passivo do texto
  const idxPassivo = texto.search(/polo\s+passivo/i);
  if (idxPassivo === -1) return null;

  // Pega o texto a partir do polo passivo até o próximo polo ou fim
  const apos = texto.slice(idxPassivo);
  const idxProximoPolo = apos.search(/polo\s+(ativo|autor|obreiro)/i);
  return idxProximoPolo > 0 ? apos.slice(0, idxProximoPolo) : apos;
}

function verificarAdvogadoNoTexto(texto) {
  if (!texto) return false;
  return /advogado|adv\.|oab\s*[\d\/]|dr\.\s+[A-Z]|dra\.\s+[A-Z]/i.test(texto);
}

// ── FIX 3: Filtrar processos com data já passada ─────────────
function dataJaPassou(dataBR) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataAud = parseBR(dataBR);
  return dataAud < hoje;
}

// ── Listar varas ─────────────────────────────────────────────
async function selecionarTribunal(page, tribunal){
  const opcao = page.getByText(tribunal, {exact:true});
  try { await opcao.waitFor({state:"visible",timeout:20000}); }
  catch {
    const visivel=(await page.locator("body").innerText().catch(()=>"")).slice(0,300).replace(/\s+/g," ");
    throw new Error(`Tribunal "${tribunal}" não encontrado nas opções do JTe. Conteúdo visível: ${visivel || "(vazio)"}`);
  }
  await opcao.click({force:true});
}
async function listarVaras(browser, tribunal=TRIBUNAL, regiao=REGIAO){
  const page=await browser.newPage();
  page.setDefaultTimeout(45000);
  try{
    await page.goto("https://jte.csjt.jus.br/start",{waitUntil:"networkidle",timeout:60000});
    await page.waitForTimeout(1200);
    try{const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
      if(await b.isVisible({timeout:2000}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});}}catch{}
    await selecionarTribunal(page, tribunal);
    await page.waitForLoadState("networkidle");
    const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
    await card.waitFor({state:"visible",timeout:20000});await card.click({force:true});
    await page.waitForLoadState("networkidle");
    await abrirSeletorUnidade(page);
    await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),"Audiências 1º grau");
    try { await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),regiao); }
    catch (e) { throw new Error(`Região "${regiao}" não encontrada para "${tribunal}" no JTe: ${e.message}`); }
    await waitEnabled(page,'mat-form-field[data-testid="orgao"] mat-select');
    const sel=page.locator('mat-form-field[data-testid="orgao"] mat-select');
    await sel.click({force:true});
    const panel=page.locator(".mat-mdc-select-panel");
    await panel.waitFor({state:"visible",timeout:20000});
    await page.waitForSelector(".mat-mdc-select-panel mat-option",{timeout:20000});
    const opts=panel.locator("mat-option"); const n=await opts.count(); const varas=[];
    for(let i=0;i<n;i++){const l=await opts.nth(i).locator(".mdc-list-item__primary-text").textContent().catch(()=>"");if(l?.trim())varas.push(l.trim());}
    await page.keyboard.press("Escape").catch(()=>{});
    await page.getByTestId("ButtonCancelar").click().catch(()=>{});
    return varas;
  }finally{await page.close().catch(()=>{});}
}

// ── Processar 1 job ──────────────────────────────────────────
async function processarJob(browser,vara,dataBR,pool,geradoEm, tribunal=TRIBUNAL, regiao=REGIAO){
  // FIX 3: Pula datas já passadas (pode chegar na fila depois de vários dias)
  if (dataJaPassou(dataBR)) {
    return { n: 0, pulado: true };
  }

  const page=await browser.newPage();page.setDefaultTimeout(45000);
  try{
    await page.goto("https://jte.csjt.jus.br/start",{waitUntil:"networkidle",timeout:60000});
    await page.waitForTimeout(1000);
    try{const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
      if(await b.isVisible({timeout:1500}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});}}catch{}
    await selecionarTribunal(page, tribunal);
    await page.waitForLoadState("networkidle");
    const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
    await card.waitFor({state:"visible",timeout:20000});await card.click({force:true});
    await page.waitForLoadState("networkidle");
    await abrirSeletorUnidade(page);
    await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),"Audiências 1º grau");
    await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),regiao);
    await waitEnabled(page,'mat-form-field[data-testid="orgao"] mat-select');
    await matSel(page,page.locator('mat-form-field[data-testid="orgao"] mat-select'),vara);
    const conf=page.getByTestId("ButtonConfirmar");
    await conf.waitFor({state:"visible",timeout:20000});await conf.click({delay:80});
    await page.waitForLoadState("networkidle").catch(()=>{});await page.waitForTimeout(600);
    if(!await navData(page,dataBR))return{n:0,erro:`Data ${dataBR} não encontrada na pauta.`};
    await page.waitForTimeout(1000);
    if(!await esperar(page))return{n:0};
    const ps=await extrair(page);
    if(!ps.length)return{n:0};

    // ── FIX 1: Filtrar apenas polo passivo sem advogado ──────
    // ATENÇÃO: verificar cada processo abre e fecha uma página de detalhe.
    // Se o JTe não tiver página de detalhe acessível, desabilite esta seção
    // e ative o modo DEBUG_HTML=1 para inspecionar o HTML primeiro.
    const diagnostico = { processosNaPauta: ps.length, inconclusivos: 0 };
    const psFiltrados = [];
    for (const p of ps) {
      const ehLead = await semAdvogado(page, p.numeroProcesso, diagnostico);
      if (ehLead) psFiltrados.push(p);
    }

    if (!psFiltrados.length) return { n: 0, processos: [], ...diagnostico };

    // O modo nacional reutiliza esta mesma coleta e classificação, mas salva
    // o resultado em arquivos locais e nunca cria um pool de banco.
    if (!pool) return { n: psFiltrados.length, processos: psFiltrados, ...diagnostico };

    const args=psFiltrados.flatMap(p=>[new Date(geradoEm),tribunal,regiao,vara,dataBR,brToIso(dataBR),
      p.numeroProcesso,p.sessao||null,p.juiz||null,p.reclamante||null,p.reclamada||null]);
    await pool.query(
      `INSERT INTO processos_sem_polo_passivo(geradoEm,tribunal,regiao,vara,dataBR,dataISO,numeroProcesso,sessao,juiz,reclamante,reclamada)
       VALUES ${psFiltrados.map(()=>"(?,?,?,?,?,?,?,?,?,?,?)").join(",")} ON DUPLICATE KEY UPDATE geradoEm=VALUES(geradoEm),sessao=VALUES(sessao),
       juiz=VALUES(juiz),reclamante=VALUES(reclamante),reclamada=VALUES(reclamada)`,args
    );
    return{n:psFiltrados.length,...diagnostico};
  }catch(e){throw e;}
  finally{await page.close().catch(()=>{});}
}

// ── Coleta nacional: mesmo scraper, saída em arquivos ────────
const nacionalInt = (nome, padrao, minimo, maximo) => {
  const valor = process.env[nome] === undefined ? padrao : Number(process.env[nome]);
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo)
    throw new Error(`${nome} deve ser inteiro entre ${minimo} e ${maximo}.`);
  return valor;
};
const ZONA_NACIONAL = "America/Sao_Paulo";
function agoraNacional(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_NACIONAL, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(data);
  const valor = tipo => partes.find(parte => parte.type === tipo).value;
  return { dia: `${valor("year")}-${valor("month")}-${valor("day")}`,
    hora: `${valor("hour")}:${valor("minute")}` };
}
function datasNacionais(dia) {
  const explicita = (process.env.NATIONAL_DATE || "").trim();
  if (explicita) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(explicita) ||
      Number.isNaN(parseBR(explicita).getTime()) ||
      `${String(parseBR(explicita).getDate()).padStart(2,"0")}/${String(parseBR(explicita).getMonth()+1).padStart(2,"0")}/${parseBR(explicita).getFullYear()}` !== explicita)
      throw new Error("NATIONAL_DATE deve ser uma data válida em DD/MM/AAAA.");
    return [explicita];
  }
  const quantidade = nacionalInt("NATIONAL_BUSINESS_DAYS", 1, 1, 30);
  const cursor = new Date(`${dia}T12:00:00Z`);
  const datas = [];
  while (datas.length < quantidade) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) continue;
    datas.push(`${String(cursor.getUTCDate()).padStart(2,"0")}/${String(cursor.getUTCMonth()+1).padStart(2,"0")}/${cursor.getUTCFullYear()}`);
  }
  return datas;
}
async function salvarNacional(arquivo, dados) {
  await fs.promises.mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporario, JSON.stringify(dados, null, 2) + "\n");
  await fs.promises.rename(temporario, arquivo);
}
async function lerNacional(arquivo) {
  try { return JSON.parse(await fs.promises.readFile(arquivo, "utf8")); }
  catch (erro) { if (erro.code === "ENOENT" || erro instanceof SyntaxError) return null; throw erro; }
}
async function listarTribunais(browser) {
  const page = await browser.newPage(); page.setDefaultTimeout(45000);
  try {
    const resposta = await page.goto("https://jte.csjt.jus.br/start", { waitUntil: "networkidle", timeout: 60000 });
    if (resposta?.status() >= 400) throw new Error(`JTe retornou HTTP ${resposta.status()} na página inicial.`);
    const itens = page.locator('ion-item[data-testid^="startListItemTribunal"]');
    await itens.first().waitFor({ state: "visible", timeout: 20000 });
    const nomes = (await itens.allTextContents()).map(s => s.trim()).filter(s => /^TRT\d+\s*-/.test(s));
    if (!nomes.length) throw new Error("Nenhum TRT encontrado no seletor inicial do JTe.");
    return [...new Set(nomes)];
  } finally { await page.close().catch(()=>{}); }
}
async function listarTribunaisComTentativas(browser) {
  const tentativas = nacionalInt("NATIONAL_START_RETRIES", 2, 0, 5) + 1;
  let erro;
  for (let tentativa=1;tentativa<=tentativas;tentativa++) {
    try { return await listarTribunais(browser); }
    catch (e) {
      erro=e;
      console.warn(`Seletor inicial: tentativa ${tentativa}/${tentativas}: ${e.message}`);
      if (tentativa<tentativas) await new Promise(resolve=>setTimeout(resolve,5000*tentativa));
    }
  }
  throw erro;
}
async function listarRegioes(browser, tribunal) {
  const page = await browser.newPage(); page.setDefaultTimeout(45000);
  try {
    await page.goto("https://jte.csjt.jus.br/start", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    try { const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
      if(await b.isVisible({timeout:2000}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});} } catch {}
    await selecionarTribunal(page, tribunal);
    await page.waitForLoadState("networkidle");
    const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
    await card.waitFor({state:"visible",timeout:20000}); await card.click({force:true});
    await page.waitForLoadState("networkidle");
    await abrirSeletorUnidade(page);
    await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),"Audiências 1º grau");
    const sel=page.locator('mat-form-field[data-testid="municipio"] mat-select');
    await sel.click({force:true});
    const panel=page.locator(".mat-mdc-select-panel:visible");
    await panel.waitFor({state:"visible",timeout:20000});
    const opcoes=(await panel.locator("mat-option .mdc-list-item__primary-text").allTextContents()).map(s=>s.trim()).filter(Boolean);
    await page.keyboard.press("Escape").catch(()=>{});
    if (!opcoes.length) throw new Error(`Nenhuma cidade/região encontrada para ${tribunal}.`);
    return [...new Set(opcoes)];
  } finally { await page.close().catch(()=>{}); }
}
async function executarNacional(somenteDescoberta=false) {
  const inicio = new Date().toISOString();
  const dia = agoraNacional().dia;
  const datas = datasNacionais(dia);
  const limiteTrts = nacionalInt("NATIONAL_MAX_TRIBUNALS", 0, 0, 24);
  const limiteRegioes = nacionalInt("NATIONAL_MAX_REGIONS", 0, 0, 500);
  const limiteVaras = nacionalInt("NATIONAL_MAX_UNITS", 0, 0, 500);
  const concorrencia = nacionalInt("NATIONAL_CONCURRENCY", 2, 1, 8);
  const raiz = path.resolve(process.env.NATIONAL_OUTPUT_DIR || path.join(__dirname, "output", "national"));
  const pasta = path.join(raiz, dia);
  const browser = await chromium.launch({
    headless: process.env.NATIONAL_HEADLESS !== "0",
    ...(process.env.NATIONAL_CHROME_PATH ? { executablePath: process.env.NATIONAL_CHROME_PATH } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    console.log(` Worker JTe nacional | ${dia} | pauta: ${datas.join(", ")} | arquivos: ${pasta}`);
    const disponiveis = await listarTribunaisComTentativas(browser);
    const tribunalAlvo = (process.env.NATIONAL_TRT || "").trim();
    if (tribunalAlvo && !disponiveis.includes(tribunalAlvo))
      throw new Error(`Tribunal "${tribunalAlvo}" não encontrado no seletor inicial do JTe.`);
    const tribunais = disponiveis.filter(nome => !tribunalAlvo || nome === tribunalAlvo).slice(0, limiteTrts || undefined);
    const descoberta = [];
    const falhas = [];
    const alvos = [];
    for (const tribunal of tribunais) {
      try {
        const regioesDisponiveis = await listarRegioes(browser, tribunal);
        const regiaoAlvo = (process.env.NATIONAL_REGION || "").trim();
        if (regiaoAlvo && !regioesDisponiveis.includes(regiaoAlvo))
          throw new Error(`Região "${regiaoAlvo}" não encontrada para "${tribunal}" no JTe.`);
        const regioes = regioesDisponiveis.filter(nome => !regiaoAlvo || nome === regiaoAlvo).slice(0, limiteRegioes || undefined);
        const unidades = [];
        for (const regiao of regioes) {
          try {
            const varas = (await listarVaras(browser, tribunal, regiao)).slice(0, limiteVaras || undefined);
            if (!varas.length) throw new Error("Nenhuma vara encontrada.");
            unidades.push({ regiao, varas });
            for (const vara of varas) alvos.push({ tribunal, regiao, vara });
          } catch (erro) { falhas.push({ tribunal, regiao, erro: erro.message }); }
        }
        descoberta.push({ tribunal, unidades });
        console.log(`${tribunal}: ${unidades.length} regiões, ${unidades.reduce((n,u)=>n+u.varas.length,0)} varas`);
      } catch (erro) { falhas.push({ tribunal, erro: erro.message }); }
      await salvarNacional(path.join(pasta, "discovery.json"), { disponiveis, tribunais, descoberta, falhas });
    }
    const resumo = { inicio, fim: null, dia, datas, tribunaisDisponiveis: disponiveis.length,
      tribunaisSelecionados: tribunais.length, varas: alvos.length, concluidas: 0, retomadas: 0,
      processosNaPauta: 0, classificacoesInconclusivas: 0, processosSemAdvogado: 0, falhas };
    if (!somenteDescoberta) {
      const tarefas = alvos.flatMap(alvo => datas.map(data => ({ ...alvo, data })));
      let proxima = 0;
      const executar = async () => {
        while (proxima < tarefas.length) {
          const alvo = tarefas[proxima++];
          const id = require("crypto").createHash("sha256").update([alvo.tribunal,alvo.regiao,alvo.vara,alvo.data].join("\u0000")).digest("hex");
          const arquivo = path.join(pasta, "records", `${id}.json`);
          const anterior = await lerNacional(arquivo);
          if (anterior && Array.isArray(anterior.processos)) {
            resumo.retomadas++;
            resumo.processosNaPauta += anterior.processosNaPauta || 0;
            resumo.classificacoesInconclusivas += anterior.classificacoesInconclusivas || 0;
            resumo.processosSemAdvogado += anterior.processos.length;
            continue;
          }
          try {
            const resultado = await processarJob(browser,alvo.vara,alvo.data,null,inicio,alvo.tribunal,alvo.regiao);
            if (resultado.pulado || resultado.erro) throw new Error(resultado.erro || `Data ${alvo.data} já passou.`);
            const processos = resultado.processos || [];
            await salvarNacional(arquivo, { tribunal:alvo.tribunal, regiao:alvo.regiao, vara:alvo.vara,
              dataBR:alvo.data, coletadoEm:new Date().toISOString(),
              processosNaPauta: resultado.processosNaPauta || 0,
              classificacoesInconclusivas: resultado.inconclusivos || 0, processos });
            resumo.concluidas++;
            resumo.processosNaPauta += resultado.processosNaPauta || 0;
            resumo.classificacoesInconclusivas += resultado.inconclusivos || 0;
            resumo.processosSemAdvogado += processos.length;
          } catch (erro) { falhas.push({ ...alvo, erro:erro.message }); }
        }
      };
      await Promise.all(Array.from({length:concorrencia},()=>executar()));
    }
    resumo.fim = new Date().toISOString();
    await salvarNacional(path.join(pasta,"summary.json"),resumo);
    console.log(`✅ ${resumo.concluidas} tarefas, ${resumo.processosNaPauta} na pauta, ` +
      `${resumo.classificacoesInconclusivas} inconclusivos, ${resumo.processosSemAdvogado} sem advogado, ${falhas.length} falhas`);
    return falhas.length === 0 && alvos.length > 0;
  } finally { await browser.close().catch(()=>{}); }
}
async function agendarNacional() {
  const horario = process.env.NATIONAL_DAILY_TIME || "06:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new Error("NATIONAL_DAILY_TIME deve estar em HH:MM.");
  const intervalo = nacionalInt("NATIONAL_RETRY_MINUTES", 30, 1, 1440) * 60000;
  let executando = false, ultimoDia = "", proximaTentativa = 0;
  console.log(`Worker nacional agendado para ${horario} (${ZONA_NACIONAL}).`);
  const verificar = async () => {
    const agora = agoraNacional();
    if (executando || ultimoDia === agora.dia || agora.hora < horario || Date.now()<proximaTentativa) return;
    executando = true;
    try {
      if (await executarNacional()) ultimoDia = agora.dia;
      else proximaTentativa = Date.now() + intervalo;
    }
    catch (erro) { console.error(`Coleta nacional ${agora.dia}: ${erro.stack || erro.message}`); }
    finally { if (ultimoDia !== agora.dia) proximaTentativa = Date.now() + intervalo; executando = false; }
  };
  await verificar();
  setInterval(verificar, 30000);
}

// ── MAIN ─────────────────────────────────────────────────────
async function main(){
  if (process.argv.includes("--national-once") || process.argv.includes("--national-discover")) {
    const ok = await executarNacional(process.argv.includes("--national-discover"));
    if (!ok) process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--national-daily")) return agendarNacional();
  const geradoEm=new Date().toISOString();
  console.log(`\n🚀 Worker JTe | tribunal: ${TRIBUNAL} | região: ${REGIAO} | concorrência: ${CONCURRENCY} | meses: ${MESES}${VARAS_LIMIT?` | TESTE: ${VARAS_LIMIT} varas`:""}`);

  const pool=await dbPool();
  console.log("✅ MySQL");

  if(!ONLY_WORK){
    console.log("\nListando varas...");
    const bTemp=await chromium.launch({headless:true});
    let varas;
    try { varas=await listarVaras(bTemp, TRIBUNAL, REGIAO); }
    finally { await bTemp.close(); }
    if (!varas.length) throw new Error(`Nenhuma vara encontrada para "${TRIBUNAL}" / "${REGIAO}"; fila não iniciada.`);

    // FIX: Limite de varas para teste
    if (VARAS_LIMIT > 0) {
      varas = varas.slice(0, VARAS_LIMIT);
      console.log(`\nMODO TESTE: ${varas.length} varas selecionadas`);
      console.log(`   ${varas.join(" | ")}`);
    }

    const datas=gerarDatas();
    if (!datas.length) throw new Error("Nenhum dia útil no intervalo informado; fila não iniciada.");
    console.log(`   ${varas.length} varas × ${datas.length} dias = ${varas.length*datas.length} jobs`);
    console.log(`   ${datas[0]} → ${datas[datas.length-1]}\n`);

    const fila=new Queue(QUEUE_NAME,{connection:REDIS,defaultJobOptions:{attempts:3,backoff:{type:"exponential",delay:5000},removeOnComplete:{count:50},removeOnFail:{count:200}}});
    await fila.obliterate({force:true}).catch(()=>{});
    let n=0;
    for(const vara of varas){
      const jobs=datas.map(data=>({name:"s",data:{vara,data,geradoEm,tribunal:TRIBUNAL,regiao:REGIAO},opts:{jobId:`${TRIBUNAL}_${REGIAO}_${vara}_${data}`.replace(/[^\p{L}\p{N}_-]/gu,"_")}}));
      for(let i=0;i<jobs.length;i+=500){await fila.addBulk(jobs.slice(i,i+500));n+=Math.min(500,jobs.length-i);process.stdout.write(`\r   ${n}/${varas.length*datas.length}`);}
    }
    console.log(`\n✅ ${n} jobs\n`);
    await fila.close();
    if(ONLY_QUEUE){await pool.end();return;}
  }

  console.log(`Processando com ${CONCURRENCY} browsers...\n`);
  const browsers=await Promise.all(Array.from({length:CONCURRENCY},()=>
    chromium.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"]})
  ));

  let done=0,erros=0,procs=0,bIdx=0;
  const t0=Date.now();

  const fila=new Queue(QUEUE_NAME,{connection:REDIS});
  const counts=await fila.getJobCounts();
  const total=counts.waiting+counts.active+counts.delayed;
  await fila.close();

  const worker=new Worker(QUEUE_NAME,async job=>{
    const browser=browsers[bIdx++%CONCURRENCY];
    try{
      const r=await processarJob(browser,job.data.vara,job.data.data,pool,job.data.geradoEm,job.data.tribunal||TRIBUNAL,job.data.regiao||REGIAO);
      done++;procs+=r.n||0;
      const pct=((done/total)*100).toFixed(1);
      const eta=done>0?Math.round((Date.now()-t0)/done*(total-done)/1000):"?";
      process.stdout.write(`\r  [${pct}%] ${done}/${total} | ${procs} leads qualificados | ETA: ${eta}s   `);
    }catch(e){erros++;done++;throw e;}
  },{connection:REDIS,concurrency:CONCURRENCY});

  await new Promise(resolve=>{
    const ck=setInterval(async()=>{
      const q=new Queue(QUEUE_NAME,{connection:REDIS});
      const c=await q.getJobCounts();await q.close();
      if(c.waiting===0&&c.active===0&&c.delayed===0){clearInterval(ck);resolve();}
    },5000);
    worker.on("error",e=>console.error("\n❌",e.message));
  });

  console.log(`\n\n${((Date.now()-t0)/1000).toFixed(0)}s | ${procs} leads qualificados | ${erros} erros`);
  await worker.close();
  await Promise.all(browsers.map(b=>b.close().catch(()=>{})));
  await pool.end();
}

if (require.main === module) main().catch(e=>{console.error("\n❌",e);process.exitCode=1;});
module.exports = { agoraNacional, datasNacionais, paginaDetalheInconclusiva };
