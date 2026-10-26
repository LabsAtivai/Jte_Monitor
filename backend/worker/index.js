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
//  TRTS=2,15 node worker/index.js        → só esses TRTs (default: todos)
//  MUNICIPIOS=2 node worker/index.js     → limita a N municípios por TRT (teste)
// ================================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { Queue, Worker } = require("bullmq");
const { chromium }      = require("playwright");
const mysql             = require("mysql2/promise");
const fs                = require("fs");

const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const MESES       = Number(process.env.MESES       || 6);
const VARAS_LIMIT = Number(process.env.VARAS        || 0); // 0 = todas
const MUN_LIMIT   = Number(process.env.MUNICIPIOS   || 0);
const TRTS_FILTRO = (process.env.TRTS || "").split(",").map(x=>x.trim()).filter(Boolean);
const GRAU        = "Audiências 1º grau";
// Execução parcial (TRTS=) usa fila própria, assim o obliterate não apaga jobs de outras rotinas
const QUEUE_NAME  = TRTS_FILTRO.length ? `jte-trt-${TRTS_FILTRO.join("-")}` : "jte";
const ONLY_QUEUE  = process.argv.includes("--only-queue");
const ONLY_WORK   = process.argv.includes("--only-work");
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
async function semAdvogado(page, numeroProcesso) {
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

async function abrirStart(page){
  await page.goto("https://jte.csjt.jus.br/start",{waitUntil:"networkidle",timeout:60000});
  await page.waitForTimeout(1000);
  try{const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
    if(await b.isVisible({timeout:1500}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});}}catch{}
}
function codigoTRT(nome){const m=nome.match(/^TRT\s*0*(\d+)/i);return m?`TRT${Number(m[1])}`:nome.trim();}
function numeroTRT(nome){const m=nome.match(/^TRT\s*0*(\d+)/i);return m?Number(m[1]):null;}

async function listarTRTs(browser){
  const page=await browser.newPage();
  page.setDefaultTimeout(45000);
  try{
    await abrirStart(page);
    const itens=page.getByText(/^TRT\s*\d+\s*-/i);
    await itens.first().waitFor({state:"visible",timeout:20000});
    const n=await itens.count(); const nomes=[];
    for(let i=0;i<n;i++){const t=(await itens.nth(i).textContent().catch(()=>""))?.trim();if(t&&!nomes.includes(t))nomes.push(t);}
    return nomes
      .filter(nome=>!TRTS_FILTRO.length||TRTS_FILTRO.includes(String(numeroTRT(nome))))
      .sort((x,y)=>(numeroTRT(x)||0)-(numeroTRT(y)||0));
  }finally{await page.close().catch(()=>{});}
}

async function abrirPauta(page,trtNome){
  await abrirStart(page);
  const trt=page.getByText(trtNome,{exact:true});
  await trt.waitFor({state:"visible",timeout:20000});await trt.click({force:true});
  await page.waitForLoadState("networkidle");
  const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
  await card.waitFor({state:"visible",timeout:20000});await card.click({force:true});
  await page.waitForLoadState("networkidle");
  const btn=page.getByTestId("pautaButtonSelecaoUnidade");
  await btn.waitFor({state:"visible",timeout:20000});await btn.click({force:true});
  await page.waitForSelector('h1.tituloSelecaoTribunal:has-text("Órgão")',{timeout:20000});
  await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),GRAU);
}
async function lerOpcoes(page,selector){
  const sel=page.locator(selector);
  await sel.click({force:true});
  const panel=page.locator(".mat-mdc-select-panel");
  await panel.waitFor({state:"visible",timeout:20000});
  await page.waitForSelector(".mat-mdc-select-panel mat-option",{timeout:20000});
  const opts=panel.locator("mat-option"); const n=await opts.count(); const out=[];
  for(let i=0;i<n;i++){const l=await opts.nth(i).locator(".mdc-list-item__primary-text").textContent().catch(()=>"");if(l?.trim())out.push(l.trim());}
  await page.keyboard.press("Escape").catch(()=>{});
  await panel.waitFor({state:"hidden",timeout:5000}).catch(()=>{});
  return out;
}

// Município "Tribunal Regional do Trabalho da Nª Região" só tem gabinetes de 2º grau
const ehTribunal=m=>/^tribunal regional/i.test(m);

async function listarUnidades(browser,trtNome){
  const trt=codigoTRT(trtNome);
  const page=await browser.newPage();
  page.setDefaultTimeout(45000);
  try{
    await abrirPauta(page,trtNome);
    let municipios=(await lerOpcoes(page,'mat-form-field[data-testid="municipio"] mat-select')).filter(m=>!ehTribunal(m));
    if(MUN_LIMIT>0) municipios=municipios.slice(0,MUN_LIMIT);
    const out=[];
    for(const municipio of municipios){
      try{
        await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),municipio);
        await waitEnabled(page,'mat-form-field[data-testid="orgao"] mat-select');
        let varas=await lerOpcoes(page,'mat-form-field[data-testid="orgao"] mat-select');
        if(VARAS_LIMIT>0) varas=varas.slice(0,VARAS_LIMIT);
        out.push({municipio,varas});
      }catch(e){console.warn(`\n⚠️  ${trt} / ${municipio}: falha ao listar varas (${e.message}) — pulado`);}
    }
    return out;
  }finally{await page.close().catch(()=>{});}
}

async function salvarLeads(pool,{trt,municipio,vara,dataBR,geradoEm},leads){
  const vals=leads.map(()=>"(?,?,?,?,?,?,?,?,?,?,?)").join(",");
  const args=leads.flatMap(p=>[new Date(geradoEm),trt,municipio,vara,dataBR,brToIso(dataBR),
    p.numeroProcesso,p.sessao||null,p.juiz||null,p.reclamante||null,p.reclamada||null]);
  await pool.query(
    `INSERT INTO processos_sem_polo_passivo(geradoEm,trt,municipio,vara,dataBR,dataISO,numeroProcesso,sessao,juiz,reclamante,reclamada)
     VALUES ${vals} ON DUPLICATE KEY UPDATE geradoEm=VALUES(geradoEm),sessao=VALUES(sessao),
     juiz=VALUES(juiz),reclamante=VALUES(reclamante),reclamada=VALUES(reclamada)`,args
  ).catch(e=>console.warn(`⚠️  DB: ${e.message}`));
}

const slug=x=>x.replace(/\s+/g,"_");
function jobIdDe(u,data){return `${u.trt}_${slug(u.municipio)}_${slug(u.vara)}_${data.replace(/\//g,"-")}`;}

// ── Processar 1 job ──────────────────────────────────────────
async function processarJob(browser,{trt,trtNome,municipio,vara,data:dataBR,geradoEm},pool){
  // FIX 3: Pula datas já passadas (pode chegar na fila depois de vários dias)
  if (dataJaPassou(dataBR)) {
    return { n: 0, pulado: true };
  }

  const page=await browser.newPage();page.setDefaultTimeout(45000);
  try{
    await abrirPauta(page,trtNome);
    await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),municipio);
    await waitEnabled(page,'mat-form-field[data-testid="orgao"] mat-select');
    await matSel(page,page.locator('mat-form-field[data-testid="orgao"] mat-select'),vara);
    const conf=page.getByTestId("ButtonConfirmar");
    await conf.waitFor({state:"visible",timeout:20000});await conf.click({delay:80});
    await page.waitForLoadState("networkidle").catch(()=>{});await page.waitForTimeout(600);
    if(!await navData(page,dataBR))return{n:0};
    await page.waitForTimeout(1000);
    if(!await esperar(page))return{n:0};
    const ps=await extrair(page);
    if(!ps.length)return{n:0};

    // ── FIX 1: Filtrar apenas polo passivo sem advogado ──────
    // ATENÇÃO: verificar cada processo abre e fecha uma página de detalhe.
    // Se o JTe não tiver página de detalhe acessível, desabilite esta seção
    // e ative o modo DEBUG_HTML=1 para inspecionar o HTML primeiro.
    const psFiltrados = [];
    for (const p of ps) {
      const ehLead = await semAdvogado(page, p.numeroProcesso);
      if (ehLead) psFiltrados.push(p);
    }

    if (!psFiltrados.length) return { n: 0 };

    await salvarLeads(pool,{trt,municipio,vara,dataBR,geradoEm},psFiltrados);
    return{n:psFiltrados.length};
  }catch(e){throw e;}
  finally{await page.close().catch(()=>{});}
}

// ── MAIN ─────────────────────────────────────────────────────
async function main(){
  const geradoEm=new Date().toISOString();
  console.log(`\n🚀 Worker JTe | concorrência: ${CONCURRENCY} | meses: ${MESES}${TRTS_FILTRO.length?` | TRTs: ${TRTS_FILTRO.join(",")}`:" | TRTs: todos"}${VARAS_LIMIT?` | TESTE: ${VARAS_LIMIT} varas/município`:""}${MUN_LIMIT?` | ${MUN_LIMIT} municípios/TRT`:""}`);

  const pool=ONLY_QUEUE?null:await dbPool();
  if(pool) console.log("✅ MySQL");

  if(!ONLY_WORK){
    console.log("\n📦 Listando TRTs, municípios e varas...");
    const bTemp=await chromium.launch({headless:true});
    const unidades=[];
    try{
      const trts=await listarTRTs(bTemp);
      console.log(`   ${trts.length} TRTs: ${trts.map(codigoTRT).join(", ")}`);
      for(const trtNome of trts){
        const trt=codigoTRT(trtNome);
        try{
          const lista=await listarUnidades(bTemp,trtNome);
          for(const {municipio,varas} of lista) for(const vara of varas) unidades.push({trt,trtNome,municipio,vara});
          console.log(`   ${trt}: ${lista.length} municípios, ${lista.reduce((t,x)=>t+x.varas.length,0)} varas`);
        }catch(e){console.warn(`\n⚠️  ${trt}: falha ao listar unidades (${e.message}) — pulado`);}
      }
    }finally{await bTemp.close().catch(()=>{});}

    const datas=gerarDatas();
    console.log(`   ${unidades.length} varas × ${datas.length} dias = ${unidades.length*datas.length} jobs`);
    if(datas.length) console.log(`   ${datas[0]} → ${datas[datas.length-1]}\n`);

    const fila=new Queue(QUEUE_NAME,{connection:REDIS,defaultJobOptions:{attempts:3,backoff:{type:"exponential",delay:5000},removeOnComplete:{count:50},removeOnFail:{count:200}}});
    await fila.obliterate({force:true}).catch(()=>{});
    let n=0;
    for(const u of unidades){
      const jobs=datas.map(data=>({name:"s",data:{...u,data,geradoEm},opts:{jobId:jobIdDe(u,data)}}));
      for(let i=0;i<jobs.length;i+=500){await fila.addBulk(jobs.slice(i,i+500));n+=Math.min(500,jobs.length-i);process.stdout.write(`\r   ${n}/${unidades.length*datas.length}`);}
    }
    console.log(`\n✅ ${n} jobs\n`);
    await fila.close();
    if(ONLY_QUEUE) return;
  }

  console.log(`⚙️  Processando com ${CONCURRENCY} browsers...\n`);
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
      const r=await processarJob(browser,job.data,pool);
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

  console.log(`\n\n✅ ${((Date.now()-t0)/1000).toFixed(0)}s | ${procs} leads qualificados | ${erros} erros`);
  await worker.close();
  await Promise.all(browsers.map(b=>b.close().catch(()=>{})));
  await pool.end();
}

if(require.main===module) main().catch(e=>{console.error("\n❌",e);process.exit(1);});
module.exports={codigoTRT,numeroTRT,ehTribunal,jobIdDe,salvarLeads,gerarDatas};