"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth }   from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useDebounce(v, d) {
  const [val, set] = useState(v);
  useEffect(() => { const t = setTimeout(() => set(v), d); return () => clearTimeout(t); }, [v, d]);
  return val;
}

export default function DashboardPage() {
  const { user, ready, logout, authFetch, isPremium } = useAuth();
  const router = useRouter();

  const [dados,    setDados]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [vara,     setVara]     = useState("");
  const [numero,   setNumero]   = useState("");
  const [reclamada,setRec]      = useState("");
  const [dataIni,  setDataIni]  = useState("");
  const [dataFim,  setDataFim]  = useState("");
  const [pagina,   setPagina]   = useState(1);

  const numDeb = useDebounce(numero,    400);
  const recDeb = useDebounce(reclamada, 400);

  useEffect(() => { if (ready && !user) router.push("/login"); }, [ready, user]);

  const buscar = useCallback(async (pg = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (vara)    q.set("vara",       vara);
      if (numDeb)  q.set("numero",     numDeb);
      if (recDeb)  q.set("reclamada",  recDeb);
      if (dataIni) q.set("dataInicio", dataIni);
      if (dataFim) q.set("dataFim",    dataFim);
      if (isPremium) q.set("pagina",   pg);
      const res  = await authFetch(`${API}/api/processos?${q}`);
      const json = await res.json();
      setDados(json); setPagina(pg);
    } finally { setLoading(false); }
  }, [user, vara, numDeb, recDeb, dataIni, dataFim, isPremium, authFetch]);

  useEffect(() => { if (user) buscar(1); }, [vara, numDeb, recDeb, dataIni, dataFim]);

  if (!ready || !user) return null;

  return (
    <div style={{ minHeight:"100vh", background:"#f5f7fa" }}>
      {/* Header */}
      <header style={{ background:"#1a3a5c", color:"#fff", padding:"0 24px", height:56,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>JTe Monitor</div>
        <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:13 }}>
          <TierBadge tier={user.tier} />
          <span style={{ opacity:.7 }}>{user.nome}</span>
          <button onClick={logout} style={{ background:"transparent", color:"#fff",
            border:"1px solid rgba(255,255,255,.3)", borderRadius:6,
            padding:"5px 12px", fontSize:12, cursor:"pointer" }}>Sair</button>
        </div>
      </header>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 20px" }}>

        {/* Banner free */}
        {!isPremium && dados?.totalReal > 5 && (
          <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:8,
            padding:"14px 20px", marginBottom:20,
            display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ fontSize:14, color:"#92400e" }}>
              Mostrando <strong>5 de {dados.totalReal}</strong> processos.
              Faça upgrade para ver todos e receber alertas.
            </div>
            <button onClick={() => router.push("/upgrade")} style={{
              background:"#d97706", color:"#fff", border:"none",
              borderRadius:6, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Ver planos
            </button>
          </div>
        )}

        {/* Filtros */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          padding:"18px 20px", marginBottom:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",
            gap:12, marginBottom:12 }}>
            <Sel label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
              <option value="">Todas as varas</option>
              {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
            </Sel>
            <Inp label="Número" value={numero}   onChange={e => setNumero(e.target.value)}   placeholder="0000000-00..." />
            <Inp label="Reclamada" value={reclamada} onChange={e => setRec(e.target.value)} placeholder="Nome da empresa..." />
            <Inp label="Audiência de" type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} />
            <Inp label="Audiência até" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <Btn ghost onClick={() => { setVara(""); setNumero(""); setRec(""); setDataIni(""); setDataFim(""); }}>
            Limpar filtros
          </Btn>
        </div>

        {/* Tabela */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, overflow:"hidden", marginBottom:24 }}>
          {loading && <Empty icon="⏳" msg="Carregando..." />}
          {!loading && dados?.rows?.length === 0 && <Empty icon="📋" msg="Nenhum processo encontrado." />}
          {!loading && dados?.rows?.length > 0 && (
            <>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr>
                      {["Vara","Data","Número","Reclamante","Reclamada","Juiz(a)"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left",
                          background:"#f8fafc", fontSize:11, fontWeight:700,
                          color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em",
                          borderBottom:"1px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.rows.map((r, i) => (
                      <tr key={r.id} style={{ background: i%2===0?"#fff":"#fafafa" }}>
                        <td style={TD}><span style={{ fontSize:11 }}>{r.vara}</span></td>
                        <td style={{ ...TD, whiteSpace:"nowrap", color:"#6b7280" }}>{r.dataBR}</td>
                        <td style={{ ...TD, fontFamily:"monospace", fontSize:12 }}>{r.numeroProcesso}</td>
                        <td style={TD}>{r.reclamante||"—"}</td>
                        <td style={{ ...TD, fontWeight:500 }}>{r.reclamada||"—"}</td>
                        <td style={{ ...TD, color:"#6b7280", fontSize:12 }}>{r.juiz||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isPremium && dados?.totalPaginas > 1 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"14px 18px", borderTop:"1px solid #e5e7eb",
                  fontSize:13, color:"#6b7280", flexWrap:"wrap", gap:8 }}>
                  <span>Mostrando {(pagina-1)*50+1}–{Math.min(pagina*50,dados.total)} de {dados.total}</span>
                  <div style={{ display:"flex", gap:6 }}>
                    <PgBtn disabled={pagina<=1} onClick={() => buscar(pagina-1)}>← Anterior</PgBtn>
                    <span style={{ padding:"7px 10px" }}>{pagina} / {dados.totalPaginas}</span>
                    <PgBtn primary disabled={pagina>=dados.totalPaginas} onClick={() => buscar(pagina+1)}>Próxima →</PgBtn>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}>
        <div style={{ fontWeight:700, fontSize:15, color:"#111827" }}>Meus alertas por e-mail</div>
        <Btn primary onClick={() => setCriando(true)}>+ Novo alerta</Btn>
      </div>

      {criando && (
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          padding:"18px 20px", marginBottom:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
            <Inp label="Nome do alerta *" value={fNome} onChange={e=>setFNome(e.target.value)} placeholder="Ex: Bancos SP" />
            <Inp label="Vara (opcional)"  value={fVara} onChange={e=>setFVara(e.target.value)} placeholder="1ª Vara do Trabalho..." />
            <Inp label="Reclamada contém" value={fRec}  onChange={e=>setFRec(e.target.value)}  placeholder="Nome da empresa..." />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn primary onClick={criar}>Salvar</Btn>
            <Btn ghost   onClick={() => setCriando(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {loading && <div style={{ color:"#9ca3af", fontSize:13 }}>Carregando alertas...</div>}
      {!loading && lista.length === 0 && !criando && (
        <div style={{ color:"#9ca3af", fontSize:13 }}>
          Nenhum alerta criado. Alertas enviam e-mail automático quando novos processos aparecem.
        </div>
      )}
      {lista.map(a => (
        <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          padding:"12px 16px", marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:600, fontSize:14, color:"#111827" }}>{a.nome}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
              {[a.vara&&`Vara: ${a.vara}`, a.reclamada&&`Reclamada: ${a.reclamada}`].filter(Boolean).join(" · ")||"Todos os processos"}
            </div>
          </div>
          <button onClick={() => remover(a.id)} style={{ background:"#fef2f2", color:"#dc2626",
            border:"1px solid #fecaca", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer" }}>
            Remover
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── UI helpers ── */
const TD = { padding:"11px 14px", borderBottom:"1px solid #f3f4f6", verticalAlign:"middle", color:"#374151" };

function TierBadge({ tier }) {
  const cfg = { free:{label:"Free",bg:"rgba(255,255,255,.15)",c:"#fff"}, premium:{label:"Premium",bg:"#fbbf24",c:"#1f2937"}, admin:{label:"Admin",bg:"#818cf8",c:"#fff"} };
  const x = cfg[tier]||cfg.free;
  return <span style={{ background:x.bg, color:x.c, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{x.label}</span>;
}
function Empty({ icon, msg }) {
  return <div style={{ padding:48, textAlign:"center", color:"#9ca3af", fontSize:14 }}>{icon} {msg}</div>;
}
function Inp({ label, ...p }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>{label}</label>
      <input {...p} style={{ width:"100%", padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:13, color:"#111827", boxSizing:"border-box" }} />
    </div>
  );
}
function Sel({ label, children, ...p }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>{label}</label>
      <select {...p} style={{ width:"100%", padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:13, color:"#111827", background:"#fff", boxSizing:"border-box" }}>{children}</select>
    </div>
  );
}
function Btn({ children, onClick, primary, ghost }) {
  return (
    <button onClick={onClick} style={{
      background: primary?"#1a3a5c":ghost?"#fff":"#fff",
      color:      primary?"#fff":"#1a3a5c",
      border:     `1px solid ${primary?"#1a3a5c":"#d1d5db"}`,
      borderRadius:6, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
      {children}
    </button>
  );
}
function PgBtn({ children, onClick, disabled, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:primary?"#1a3a5c":"#fff", color:primary?"#fff":"#374151",
      border:`1px solid ${primary?"#1a3a5c":"#d1d5db"}`,
      borderRadius:6, padding:"7px 14px", fontSize:12,
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?.4:1 }}>
      {children}
    </button>
  );
}
