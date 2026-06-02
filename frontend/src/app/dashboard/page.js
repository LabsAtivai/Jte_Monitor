"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth }   from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Paleta Ativa.LAW ────────────────────────────────────────
const C = {
  black:   "#111111",
  orange:  "#E05A00",
  orangeL: "#FF7A1A",
  white:   "#FFFFFF",
  gray:    "#F4F4F4",
  grayMid: "#888888",
  border:  "#E5E7EB",
  text:    "#1A1A1A",
  textSub: "#6B6B6B",
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const TD = { padding: "11px 14px", borderBottom: `1px solid ${C.border}`, verticalAlign: "middle", color: C.text };

// ── Components ───────────────────────────────────────────────
function Logo({ size = 18 }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: "-0.02em" }}>
      <span style={{ color: C.white }}>Ativa.</span>
      <span style={{ color: C.orange }}>LAW</span>
    </span>
  );
}

function QualidadeBadge({ q }) {
  const map = {
    alta:  { label: "Alta",  bg: "#d1fae5", color: "#065f46" },
    media: { label: "Média", bg: "#fef3c7", color: "#92400e" },
    baixa: { label: "Baixa", bg: "#fee2e2", color: "#991b1b" },
  };
  const c = map[q] || { label: q || "—", bg: C.gray, color: C.grayMid };
  return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
}

function CopiarBtn({ texto }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() { navigator.clipboard.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }); }
  return (
    <button onClick={copiar} style={{ background: copiado ? "#d1fae5" : C.gray, color: copiado ? "#065f46" : C.grayMid, border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginLeft: 6 }}>
      {copiado ? "✓" : "Copiar"}
    </button>
  );
}

function TierBadge({ tier }) {
  const map = {
    free:    { label: "Free",    bg: "rgba(255,255,255,0.12)", color: "#fff" },
    premium: { label: "Premium", bg: C.orange, color: "#fff" },
    admin:   { label: "Admin",   bg: "#818cf8", color: "#fff" },
  };
  const c = map[tier] || map.free;
  return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
}

function EstadoVazio({ children }) {
  return <div style={{ padding: 48, textAlign: "center", color: C.grayMid, fontSize: 14 }}>{children}</div>;
}

function FiltroInput({ label, ...props }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</label>
      <input {...props} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, boxSizing: "border-box", outline: "none", background: "#fff" }} />
    </div>
  );
}

function FiltroSelect({ label, children, ...props }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</label>
      <select {...props} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: "#fff", boxSizing: "border-box", outline: "none" }}>{children}</select>
    </div>
  );
}

function BtnPrimario({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "#e5e7eb" : C.orange, color: disabled ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}

function BtnSecundario({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: "#fff", color: disabled ? "#9ca3af" : C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function BotaoPagina({ children, onClick, disabled, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: primary ? C.orange : "#fff", color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.orange : C.border}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

function StatCard({ label, valor, cor }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px", borderTop: `3px solid ${cor || C.orange}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor || C.orange }}>{valor}</div>
      <div style={{ fontSize: 11, color: C.textSub, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function DashboardPage() {
  const { user, ready, logout, authFetch, isPremium } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState("processos");

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  const abas = [
    { key: "processos", label: "Leads" },
    { key: "contatos",  label: "Contatos" },
    { key: "snov",      label: "Enriquecidos" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.gray, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{ background: C.black, color: "#fff", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, borderBottom: `2px solid ${C.orange}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Logo size={17} />
          <nav style={{ display: "flex", gap: 2 }}>
            {abas.map(a => (
              <button key={a.key} onClick={() => setAba(a.key)} style={{
                background: "transparent", color: aba === a.key ? "#fff" : "rgba(255,255,255,0.5)",
                border: "none", borderRadius: 0, padding: "6px 16px", fontSize: 13,
                fontWeight: aba === a.key ? 700 : 400, cursor: "pointer",
                borderBottom: aba === a.key ? `2px solid ${C.orange}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>{a.label}</button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13 }}>
          <TierBadge tier={user.tier} />
          {!isPremium && (
            <button onClick={() => router.push("/upgrade")} style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ↑ Upgrade
            </button>
          )}
          <span style={{ opacity: 0.6, fontSize: 12 }}>{user.nome}</span>
          <button onClick={logout} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
            Sair
          </button>
        </div>
      </header>

      {aba === "processos" && <AbaProcessos authFetch={authFetch} user={user} isPremium={isPremium} router={router} />}
      {aba === "contatos"  && <AbaContatos  authFetch={authFetch} />}
      {aba === "snov"      && <AbaSnov      authFetch={authFetch} />}
    </div>
  );
}

// ── Aba Leads (Processos) ────────────────────────────────────
function AbaProcessos({ authFetch, user, isPremium, router }) {
  const [dados, setDados]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [vara, setVara]           = useState("");
  const [numero, setNumero]       = useState("");
  const [reclamada, setReclamada] = useState("");
  const [dataIni, setDataIni]     = useState("");
  const [dataFim, setDataFim]     = useState("");
  const [pagina, setPagina]       = useState(1);
  const numeroDeb    = useDebounce(numero, 400);
  const reclamadaDeb = useDebounce(reclamada, 400);

  const buscar = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (vara)         q.set("vara", vara);
      if (numeroDeb)    q.set("numero", numeroDeb);
      if (reclamadaDeb) q.set("reclamada", reclamadaDeb);
      if (dataIni)      q.set("dataInicio", dataIni);
      if (dataFim)      q.set("dataFim", dataFim);
      q.set("pagina", String(pg));
      const res  = await authFetch(`${API}/api/processos?${q}`);
      const json = await res.json();
      setDados(json); setPagina(pg);
    } finally { setLoading(false); }
  }, [vara, numeroDeb, reclamadaDeb, dataIni, dataFim, authFetch]);

  useEffect(() => { buscar(1); }, [vara, numeroDeb, reclamadaDeb, dataIni, dataFim]);

  const rows = dados?.rows ?? [];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>

      {/* Título da seção */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Leads Qualificados</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>Empresas com audiência trabalhista marcada e <strong style={{ color: C.orange }}>polo passivo sem advogado constituído</strong></p>
      </div>

      {/* Filtros */}
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
          <FiltroSelect label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
            <option value="">Todas as varas</option>
            {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
          </FiltroSelect>
          <FiltroInput label="Número"    value={numero}    onChange={e => setNumero(e.target.value)}    placeholder="0000000-00.0000..." />
          <FiltroInput label="Empresa"   value={reclamada} onChange={e => setReclamada(e.target.value)} placeholder="Nome da empresa..." />
          <FiltroInput label="Audiência de"  type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} />
          <FiltroInput label="Audiência até" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <BtnSecundario onClick={() => { setVara(""); setNumero(""); setReclamada(""); setDataIni(""); setDataFim(""); }}>
          Limpar filtros
        </BtnSecundario>
      </div>

      {/* Tabela */}
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
        {loading && <EstadoVazio>Carregando leads...</EstadoVazio>}
        {!loading && rows.length === 0 && (
          <EstadoVazio>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚖️</div>
            Nenhum lead encontrado para os filtros selecionados.
          </EstadoVazio>
        )}
        {!loading && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Vara", "Audiência", "Processo", "Reclamante", "Empresa (Reclamada)", "Juiz(a)"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: C.black, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.orange}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ ...TD, fontSize: 11, color: C.textSub }}>{r.vara}</td>
                      <td style={{ ...TD, whiteSpace: "nowrap", fontWeight: 600, color: C.orange }}>{r.dataBR}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{r.numeroProcesso}</td>
                      <td style={TD}>{r.reclamante || "—"}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.reclamada || "—"}</td>
                      <td style={{ ...TD, color: C.textSub, fontSize: 12 }}>{r.juiz || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.textSub, flexWrap: "wrap", gap: 8 }}>
                <span>{(pagina-1)*50+1}–{Math.min(pagina*50, dados.total)} de <strong>{dados.total}</strong> leads</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <BotaoPagina disabled={pagina <= 1} onClick={() => buscar(pagina - 1)}>← Anterior</BotaoPagina>
                  <span style={{ padding: "7px 10px" }}>{pagina} / {dados.totalPaginas}</span>
                  <BotaoPagina primary disabled={pagina >= dados.totalPaginas} onClick={() => buscar(pagina + 1)}>Próxima →</BotaoPagina>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isPremium && <PainelAlertas authFetch={authFetch} />}
    </div>
  );
}

// ── Aba Contatos ─────────────────────────────────────────────
function AbaContatos({ authFetch }) {
  const [dados, setDados]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [stats, setStats]         = useState(null);
  const [reclamada, setReclamada] = useState("");
  const [email, setEmail]         = useState("");
  const [numero, setNumero]       = useState("");
  const [vara, setVara]           = useState("");
  const [qualidade, setQualidade] = useState("");
  const [pagina, setPagina]       = useState(1);
  const reclamadaDeb = useDebounce(reclamada, 400);
  const emailDeb     = useDebounce(email, 400);
  const numeroDeb    = useDebounce(numero, 400);

  useEffect(() => {
    authFetch(`${API}/api/contatos/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const buscar = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (reclamadaDeb) q.set("reclamada", reclamadaDeb);
      if (emailDeb)     q.set("email", emailDeb);
      if (numeroDeb)    q.set("numeroProcesso", numeroDeb);
      if (vara)         q.set("vara", vara);
      if (qualidade)    q.set("qualidade", qualidade);
      q.set("pagina", String(pg));
      const res  = await authFetch(`${API}/api/contatos?${q}`);
      const json = await res.json();
      setDados(json); setPagina(pg);
    } finally { setLoading(false); }
  }, [reclamadaDeb, emailDeb, numeroDeb, vara, qualidade, authFetch]);

  useEffect(() => { buscar(1); }, [reclamadaDeb, emailDeb, numeroDeb, vara, qualidade]);

  function exportarCSV() {
    const rows = dados?.rows ?? [];
    if (!rows.length) return;
    const headers = ["Email","Qualidade","Empresa","Razão Social","Nº Processo","CNPJ","Vara","Data","Telefone"];
    const esc = v => { if (!v) return ""; const s = String(v); return /[;"'\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = [headers.join(";"), ...rows.map(r => [r.email,r.qualidadeEmail,r.reclamada,r.nomeFantasia||r.razaoSocial,r.socioNome,r.socioQualificacao,r.numeroProcesso,r.cnpj,r.vara,r.dataBR,r.telefone].map(esc).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contatos_ativaLAW_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const rows = dados?.rows ?? [];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Contatos</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>E-mails e dados de contato das empresas reclamadas</p>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="Total contatos"     valor={Number(stats.total).toLocaleString("pt-BR")}         cor={C.orange} />
          <StatCard label="Alta qualidade"     valor={Number(stats.totalAlta).toLocaleString("pt-BR")}     cor="#065f46" />
          <StatCard label="Média qualidade"    valor={Number(stats.totalMedia).toLocaleString("pt-BR")}    cor="#92400e" />
          <StatCard label="Baixa qualidade"    valor={Number(stats.totalBaixa).toLocaleString("pt-BR")}    cor="#991b1b" />
          <StatCard label="Empresas distintas" valor={Number(stats.totalEmpresas).toLocaleString("pt-BR")} cor={C.black} />
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
          <FiltroInput label="Empresa"    value={reclamada} onChange={e => setReclamada(e.target.value)} placeholder="Nome da empresa..." />
          <FiltroInput label="Email"      value={email}     onChange={e => setEmail(e.target.value)}     placeholder="email@empresa.com" />
          <FiltroInput label="Nº Processo" value={numero}   onChange={e => setNumero(e.target.value)}    placeholder="0000000-00.0000..." />
          <FiltroSelect label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
            <option value="">Todas as varas</option>
            {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
          </FiltroSelect>
          <FiltroSelect label="Qualidade" value={qualidade} onChange={e => setQualidade(e.target.value)}>
            <option value="">Todas</option>
            <option value="alta">Alta (corporativo)</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa (gmail/hotmail)</option>
          </FiltroSelect>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BtnSecundario onClick={() => { setReclamada(""); setEmail(""); setNumero(""); setVara(""); setQualidade(""); }}>Limpar filtros</BtnSecundario>
          <BtnPrimario onClick={exportarCSV} disabled={!rows.length}>↓ Exportar CSV</BtnPrimario>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {loading && <EstadoVazio>Carregando...</EstadoVazio>}
        {!loading && rows.length === 0 && <EstadoVazio>Nenhum contato encontrado.</EstadoVazio>}
        {!loading && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>{["Email","Qualidade","Empresa","Razão Social","Sócio / Cargo","Nº Processo","CNPJ"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: C.black, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.orange}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={TD}><span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.email}</span><CopiarBtn texto={r.email} /></td>
                      <td style={TD}><QualidadeBadge q={r.qualidadeEmail} /></td>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.reclamada || "—"}</td>
                      <td style={{ ...TD, color: C.textSub, fontSize: 12 }}>{r.nomeFantasia || r.razaoSocial || "—"}</td>
                      <td style={TD}>
                        {r.socioNome ? <><div style={{ fontWeight: 500, fontSize: 12 }}>{r.socioNome}</div><div style={{ fontSize: 11, color: C.grayMid }}>{r.socioQualificacao || ""}</div></> : "—"}
                      </td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{r.numeroProcesso}<CopiarBtn texto={r.numeroProcesso} /></td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12, color: C.textSub }}>{r.cnpj ? r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.textSub, flexWrap: "wrap", gap: 8 }}>
                <span>{(pagina-1)*50+1}–{Math.min(pagina*50, dados.total)} de <strong>{dados.total}</strong></span>
                <div style={{ display: "flex", gap: 6 }}>
                  <BotaoPagina disabled={pagina <= 1} onClick={() => buscar(pagina - 1)}>← Anterior</BotaoPagina>
                  <span style={{ padding: "7px 10px" }}>{pagina} / {dados.totalPaginas}</span>
                  <BotaoPagina primary disabled={pagina >= dados.totalPaginas} onClick={() => buscar(pagina + 1)}>Próxima →</BotaoPagina>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Aba Enriquecidos (Snov) ──────────────────────────────────
function AbaSnov({ authFetch }) {
  const [dados,     setDados]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState(null);
  const [reclamada, setReclamada] = useState("");
  const [dominio,   setDominio]   = useState("");
  const [cargo,     setCargo]     = useState("");
  const [tipo,      setTipo]      = useState("");
  const [vara,      setVara]      = useState("");
  const [pagina,    setPagina]    = useState(1);
  const reclamadaDeb = useDebounce(reclamada, 400);
  const dominioDeb   = useDebounce(dominio,   400);
  const cargoDeb     = useDebounce(cargo,     400);

  useEffect(() => {
    authFetch(`${API}/api/contatos-snov/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const buscar = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (reclamadaDeb) q.set("reclamada", reclamadaDeb);
      if (dominioDeb)   q.set("dominio",   dominioDeb);
      if (cargoDeb)     q.set("cargo",     cargoDeb);
      if (tipo)         q.set("tipo",      tipo);
      if (vara)         q.set("vara",      vara);
      q.set("pagina", String(pg));
      const res  = await authFetch(`${API}/api/contatos-snov?${q}`);
      const json = await res.json();
      setDados(json); setPagina(pg);
    } finally { setLoading(false); }
  }, [reclamadaDeb, dominioDeb, cargoDeb, tipo, vara, authFetch]);

  useEffect(() => { buscar(1); }, [reclamadaDeb, dominioDeb, cargoDeb, tipo, vara]);

  function exportarCSV() {
    const rows = dados?.rows ?? [];
    if (!rows.length) return;
    const headers = ["Nome","Cargo","Email","Domínio","Tipo","Empresa","Cidade","Setor","Empresa reclamada","Vara","LinkedIn"];
    const esc = v => { if (!v) return ""; const s = String(v); return /[;"'\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = [headers.join(";"), ...rows.map(r => [r.nomeCompleto,r.cargo,r.email,r.dominio,r.tipo,r.companyName,r.companyCity,r.companyIndustry,r.reclamada,r.vara,r.linkedinUrl].map(esc).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `enriquecidos_ativaLAW_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function TipoBadge({ tipo }) {
    const map = {
      prospect:     { label: "Prospect",    bg: "#dbeafe", color: "#1e40af" },
      domain_email: { label: "Email corp.", bg: "#d1fae5", color: "#065f46" },
      generic:      { label: "Genérico",    bg: C.gray,    color: C.grayMid },
    };
    const c = map[tipo] || map.generic;
    return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
  }

  const rows = dados?.rows ?? [];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Contatos Enriquecidos</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>Decisores e e-mails corporativos encontrados via Snov.io</p>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="Total"        valor={Number(stats.total).toLocaleString("pt-BR")}             cor={C.orange} />
          <StatCard label="Prospects"    valor={Number(stats.totalProspects).toLocaleString("pt-BR")}    cor="#1e40af" />
          <StatCard label="Emails corp." valor={Number(stats.totalDomainEmails).toLocaleString("pt-BR")} cor="#065f46" />
          <StatCard label="Com email"    valor={Number(stats.totalComEmail).toLocaleString("pt-BR")}     cor="#92400e" />
          <StatCard label="Domínios"     valor={Number(stats.totalDominios).toLocaleString("pt-BR")}     cor="#7c3aed" />
          <StatCard label="Empresas"     valor={Number(stats.totalEmpresas).toLocaleString("pt-BR")}     cor={C.black} />
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
          <FiltroInput label="Empresa"   value={reclamada} onChange={e => setReclamada(e.target.value)} placeholder="Nome da empresa..." />
          <FiltroInput label="Domínio"   value={dominio}   onChange={e => setDominio(e.target.value)}   placeholder="empresa.com.br" />
          <FiltroInput label="Cargo"     value={cargo}     onChange={e => setCargo(e.target.value)}     placeholder="Diretor, RH..." />
          <FiltroSelect label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="prospect">Prospect (pessoa)</option>
            <option value="domain_email">Email corporativo</option>
            <option value="generic">Genérico</option>
          </FiltroSelect>
          <FiltroSelect label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
            <option value="">Todas as varas</option>
            {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
          </FiltroSelect>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BtnSecundario onClick={() => { setReclamada(""); setDominio(""); setCargo(""); setTipo(""); setVara(""); }}>Limpar filtros</BtnSecundario>
          <BtnPrimario onClick={exportarCSV} disabled={!rows.length}>↓ Exportar CSV</BtnPrimario>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {loading && <EstadoVazio>Carregando...</EstadoVazio>}
        {!loading && rows.length === 0 && <EstadoVazio>Nenhum contato encontrado.</EstadoVazio>}
        {!loading && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>{["Tipo","Nome / Email","Cargo","Domínio","Empresa","Reclamada","Vara"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: C.black, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.orange}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={TD}><TipoBadge tipo={r.tipo} /></td>
                      <td style={TD}>
                        {r.nomeCompleto && <div style={{ fontWeight: 500, fontSize: 13 }}>{r.nomeCompleto}</div>}
                        {r.email && <div style={{ fontSize: 12, fontFamily: "monospace", color: C.textSub }}>{r.email}<CopiarBtn texto={r.email} /></div>}
                        {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#0a66c2" }}>LinkedIn ↗</a>}
                      </td>
                      <td style={{ ...TD, fontSize: 12 }}>{r.cargo || "—"}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12, color: C.textSub }}>{r.dominio}<CopiarBtn texto={r.dominio} /></td>
                      <td style={{ ...TD, fontSize: 12 }}>
                        {r.companyName && <div style={{ fontWeight: 500 }}>{r.companyName}</div>}
                        {r.companyCity && <div style={{ color: C.grayMid, fontSize: 11 }}>{r.companyCity}{r.companyIndustry ? ` · ${r.companyIndustry}` : ""}</div>}
                      </td>
                      <td style={{ ...TD, fontWeight: 600, fontSize: 12 }}>{r.reclamada || "—"}</td>
                      <td style={{ ...TD, fontSize: 11, color: C.textSub }}>{r.vara || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.textSub, flexWrap: "wrap", gap: 8 }}>
                <span>{(pagina-1)*50+1}–{Math.min(pagina*50, dados.total)} de <strong>{dados.total}</strong></span>
                <div style={{ display: "flex", gap: 6 }}>
                  <BotaoPagina disabled={pagina <= 1} onClick={() => buscar(pagina - 1)}>← Anterior</BotaoPagina>
                  <span style={{ padding: "7px 10px" }}>{pagina} / {dados.totalPaginas}</span>
                  <BotaoPagina primary disabled={pagina >= dados.totalPaginas} onClick={() => buscar(pagina + 1)}>Próxima →</BotaoPagina>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Painel de Alertas ────────────────────────────────────────
function PainelAlertas({ authFetch }) {
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [fNome, setFNome]     = useState("");
  const [fVara, setFVara]     = useState("");
  const [fRec, setFRec]       = useState("");

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try { const r = await authFetch(`${API}/api/alertas`); const j = await r.json(); setLista(Array.isArray(j) ? j : []); }
    finally { setLoading(false); }
  }

  async function criar() {
    if (!fNome.trim()) return;
    await authFetch(`${API}/api/alertas`, { method: "POST", body: JSON.stringify({ nome: fNome, vara: fVara || undefined, reclamada: fRec || undefined }) });
    setFNome(""); setFVara(""); setFRec(""); setCriando(false); carregar();
  }

  async function remover(id) { await authFetch(`${API}/api/alertas/${id}`, { method: "DELETE" }); carregar(); }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>🔔 Alertas por e-mail</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Seja notificado quando novos leads corresponderem aos seus critérios</div>
        </div>
        <BtnPrimario onClick={() => setCriando(true)}>+ Novo alerta</BtnPrimario>
      </div>

      {criando && (
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 14, borderLeft: `3px solid ${C.orange}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <FiltroInput label="Nome do alerta *" value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Bancos SP" />
            <FiltroInput label="Vara (opcional)"  value={fVara} onChange={e => setFVara(e.target.value)} placeholder="1ª Vara..." />
            <FiltroInput label="Empresa contém"   value={fRec}  onChange={e => setFRec(e.target.value)}  placeholder="Nome da empresa..." />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimario onClick={criar}>Salvar alerta</BtnPrimario>
            <BtnSecundario onClick={() => setCriando(false)}>Cancelar</BtnSecundario>
          </div>
        </div>
      )}

      {loading && <div style={{ color: C.grayMid, fontSize: 13 }}>Carregando alertas...</div>}
      {!loading && lista.length === 0 && !criando && <div style={{ color: C.grayMid, fontSize: 13, padding: "16px 0" }}>Nenhum alerta criado ainda.</div>}
      {lista.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, borderLeft: `3px solid ${C.orange}` }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{a.nome}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{[a.vara && `Vara: ${a.vara}`, a.reclamada && `Empresa: ${a.reclamada}`].filter(Boolean).join(" · ") || "Todos os processos"}</div>
          </div>
          <button onClick={() => remover(a.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
        </div>
      ))}
    </div>
  );
}
