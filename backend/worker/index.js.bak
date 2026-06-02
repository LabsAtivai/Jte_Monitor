// backend/worker/index.js
// ================================================================
//  Worker paralelo JTe — BullMQ + Playwright
//
//  node worker/index.js                  → completo (fila + workers)
//  node worker/index.js --only-queue     → só enfileira
//  node worker/index.js --only-work      → só consome
//  CONCURRENCY=5 node worker/index.js
//  MESES=3 node worker/index.js
// ================================================================
require("dotenv").config({ path: "/root/jte-monitor/backend/.env" });

const { Queue, Worker } = require("bullmq");
const { chromium }      = require("playwright");
const mysql             = require("mysql2/promise");

const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const MESES       = Number(process.env.MESES       || 6);
const ONLY_QUEUE  = process.argv.includes("--only-queue");
const ONLY_WORK   = process.argv.includes("--only-work");
const QUEUE_NAME  = "jte";
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

// ── Listar varas ─────────────────────────────────────────────
async function listarVaras(browser){
  const page=await browser.newPage();
  page.setDefaultTimeout(45000);
  try{
    await page.goto("https://jte.csjt.jus.br/start",{waitUntil:"networkidle",timeout:60000});
    await page.waitForTimeout(1200);
    try{const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
      if(await b.isVisible({timeout:2000}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});}}catch{}
    const trt2=page.getByText("TRT2 - São Paulo",{exact:true});
    await trt2.waitFor({state:"visible",timeout:20000});await trt2.click({force:true});
    await page.waitForLoadState("networkidle");
    const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
    await card.waitFor({state:"visible",timeout:20000});await card.click({force:true});
    await page.waitForLoadState("networkidle");
    const btn=page.getByTestId("pautaButtonSelecaoUnidade");
    await btn.waitFor({state:"visible",timeout:20000});await btn.click({force:true});
    await page.waitForSelector('h1.tituloSelecaoTribunal:has-text("Órgão")',{timeout:20000});
    await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),"Audiências 1º grau");
    await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),"São Paulo - Zonas Central, Norte e Oeste");
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
async function processarJob(browser,vara,dataBR,pool,geradoEm){
  const page=await browser.newPage();page.setDefaultTimeout(45000);
  try{
    await page.goto("https://jte.csjt.jus.br/start",{waitUntil:"networkidle",timeout:60000});
    await page.waitForTimeout(1000);
    try{const b=page.locator("ion-button,button").filter({hasText:/^não$/i}).first();
      if(await b.isVisible({timeout:1500}).catch(()=>false)){await b.click({force:true});await page.waitForLoadState("networkidle").catch(()=>{});}}catch{}
    const trt2=page.getByText("TRT2 - São Paulo",{exact:true});
    await trt2.waitFor({state:"visible",timeout:20000});await trt2.click({force:true});
    await page.waitForLoadState("networkidle");
    const card=page.locator('ion-card-content.card-content-modulo:has-text("Pauta")').first();
    await card.waitFor({state:"visible",timeout:20000});await card.click({force:true});
    await page.waitForLoadState("networkidle");
    const btn=page.getByTestId("pautaButtonSelecaoUnidade");
    await btn.waitFor({state:"visible",timeout:20000});await btn.click({force:true});
    await page.waitForSelector('h1.tituloSelecaoTribunal:has-text("Órgão")',{timeout:20000});
    await matSel(page,page.locator('mat-form-field[data-testid="selecaoTribunal"] mat-select'),"Audiências 1º grau");
    await matSel(page,page.locator('mat-form-field[data-testid="municipio"] mat-select'),"São Paulo - Zonas Central, Norte e Oeste");
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
    const vals=ps.map(()=>"(?,?,?,?,?,?,?,?,?)").join(",");
    const args=ps.flatMap(p=>[new Date(geradoEm),vara,dataBR,brToIso(dataBR),
      p.numeroProcesso,p.sessao||null,p.juiz||null,p.reclamante||null,p.reclamada||null]);
    await pool.query(
      `INSERT INTO processos_sem_polo_passivo(geradoEm,vara,dataBR,dataISO,numeroProcesso,sessao,juiz,reclamante,reclamada)
       VALUES ${vals} ON DUPLICATE KEY UPDATE geradoEm=VALUES(geradoEm),sessao=VALUES(sessao),
       juiz=VALUES(juiz),reclamante=VALUES(reclamante),reclamada=VALUES(reclamada)`,args
    ).catch(e=>console.warn(`⚠️  DB: ${e.message}`));
    return{n:ps.length};
  }catch(e){throw e;}
  finally{await page.close().catch(()=>{});}
}

// ── MAIN ─────────────────────────────────────────────────────
async function main(){
  const geradoEm=new Date().toISOString();
  console.log(`\n🚀 Worker JTe | concorrência: ${CONCURRENCY} | meses: ${MESES}`);

  const pool=await dbPool();
  console.log("✅ MySQL");

  if(!ONLY_WORK){
    console.log("\n📦 Listando varas...");
    const bTemp=await chromium.launch({headless:true});
    const varas=await listarVaras(bTemp);
    await bTemp.close();
    const datas=gerarDatas();
    console.log(`   ${varas.length} varas × ${datas.length} dias = ${varas.length*datas.length} jobs`);
    console.log(`   ${datas[0]} → ${datas[datas.length-1]}\n`);

    const fila=new Queue(QUEUE_NAME,{connection:REDIS,defaultJobOptions:{attempts:3,backoff:{type:"exponential",delay:5000},removeOnComplete:{count:50},removeOnFail:{count:200}}});
    await fila.obliterate({force:true}).catch(()=>{});
    let n=0;
    for(const vara of varas){
      const jobs=datas.map(data=>({name:"s",data:{vara,data,geradoEm},opts:{jobId:`${vara.replace(/\s+/g,"_")}_${data.replace(/\//g,"-")}`}}));
      for(let i=0;i<jobs.length;i+=500){await fila.addBulk(jobs.slice(i,i+500));n+=Math.min(500,jobs.length-i);process.stdout.write(`\r   ${n}/${varas.length*datas.length}`);}
    }
    console.log(`\n✅ ${n} jobs\n`);
    await fila.close();
    if(ONLY_QUEUE){await pool.end();return;}
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
      const r=await processarJob(browser,job.data.vara,job.data.data,pool,job.data.geradoEm);
      done++;procs+=r.n||0;
      const pct=((done/total)*100).toFixed(1);
      const eta=done>0?Math.round((Date.now()-t0)/done*(total-done)/1000):"?";
      process.stdout.write(`\r  [${pct}%] ${done}/${total} | ${procs} processos | ETA: ${eta}s   `);
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

  console.log(`\n\n✅ ${((Date.now()-t0)/1000).toFixed(0)}s | ${procs} processos | ${erros} erros`);
  await worker.close();
  await Promise.all(browsers.map(b=>b.close().catch(()=>{})));
  await pool.end();
}

main().catch(e=>{console.error("\n❌",e);process.exit(1);});
