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
  const { user, ready, logout, authFetch, isPremium, isAdmin } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState("processos");

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  const abas = [
    { key: "processos", label: "Processos" },
    { key: "contatos",  label: "Informações" },
    { key: "snov",      label: "Contatos" },
    ...(isAdmin ? [{ key: "analytics", label: "Analytics" }] : []),
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
      {aba === "analytics" && isAdmin && <AbaAnalytics authFetch={authFetch} />}
    </div>
  );
}

// ── Aba Leads (Processos) ────────────────────────────────────
function AbaProcessos({ authFetch, user, isPremium, router }) {

  // Bloqueio: usuário sem plano pago não vê leads
  if (!isPremium) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
          Acesso aos leads bloqueado
        </h2>
        <p style={{ fontSize: 15, color: C.textSub, lineHeight: 1.7, margin: "0 0 32px" }}>
          Para visualizar os leads qualificados com polo passivo sem advogado constituído, é necessário assinar um dos planos da Ativa.LAW.
        </p>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 28, textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 12 }}>O que você terá acesso:</div>
          {["Leads com audiência marcada e sem advogado", "Filtros por vara, data e empresa", "Exportação CSV dos contatos", "Dados da empresa via Receita Federal", "Acesso completo ao painel de leads"].map(f => (
            <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, fontSize: 13, color: C.textSub }}>
              <span style={{ color: C.orange, fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/upgrade")} style={{
          background: C.orange, color: "#fff", border: "none",
          borderRadius: 8, padding: "14px 36px", fontSize: 15, fontWeight: 700,
          cursor: "pointer", boxShadow: "0 4px 20px rgba(224,90,0,0.3)",
        }}>
          Ver planos e assinar →
        </button>
        <div style={{ marginTop: 14, fontSize: 12, color: C.grayMid }}>
          A partir de R$ 1.995/mês · Política de cancelamento de 30 dias
        </div>
      </div>
    );
  }
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

      {isPremium && null}
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

// fim do arquivo

// ── Aba Analytics (admin only) ───────────────────────────────
function AbaAnalytics({ authFetch }) {
  const [stats,    setStats]    = useState(null);
  const [acessos,  setAcessos]  = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [periodo,  setPeriodo]  = useState("7");

  useEffect(() => { carregar(); }, [periodo]);

  async function carregar() {
    setLoading(true);
    try {
      const [rStats, rAcessos, rUsuarios] = await Promise.all([
        authFetch(`${API}/api/admin/analytics/stats?dias=${periodo}`).then(r => r.json()).catch(() => null),
        authFetch(`${API}/api/admin/analytics/acessos?dias=${periodo}`).then(r => r.json()).catch(() => []),
        authFetch(`${API}/api/admin/analytics/usuarios`).then(r => r.json()).catch(() => []),
      ]);
      setStats(rStats);
      setAcessos(Array.isArray(rAcessos) ? rAcessos : []);
      setUsuarios(Array.isArray(rUsuarios) ? rUsuarios : []);
    } finally {
      setLoading(false);
    }
  }

  // Gera gráfico de barras SVG simples
  function BarChart({ dados, cor, altura = 80 }) {
    if (!dados?.length) return <div style={{ color: C.grayMid, fontSize: 12, padding: "20px 0" }}>Sem dados</div>;
    const max = Math.max(...dados.map(d => d.valor || 0), 1);
    const w = Math.floor(100 / dados.length);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: altura, padding: "0 4px" }}>
        {dados.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 9, color: C.grayMid }}>{d.valor > 0 ? d.valor : ""}</div>
            <div style={{
              width: "100%", minHeight: 2,
              height: `${Math.max(2, (d.valor / max) * (altura - 24))}px`,
              background: cor || C.orange, borderRadius: "3px 3px 0 0",
              transition: "height 0.3s",
            }} title={`${d.label}: ${d.valor}`} />
            <div style={{ fontSize: 9, color: C.grayMid, whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%", textAlign: "center" }}>
              {d.labelCurto || d.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Gráfico de rosca SVG
  function DonutChart({ mobile, desktop }) {
    const total = (mobile || 0) + (desktop || 0);
    if (!total) return <div style={{ color: C.grayMid, fontSize: 12 }}>Sem dados</div>;
    const pct = Math.round((mobile / total) * 100);
    const r = 40, cx = 56, cy = 56, stroke = 14;
    const circ = 2 * Math.PI * r;
    const mobilePct = (mobile / total) * circ;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width={112} height={112} viewBox="0 0 112 112">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.orange} strokeWidth={stroke}
            strokeDasharray={`${mobilePct} ${circ}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.black} strokeWidth={stroke}
            strokeDasharray={`${circ - mobilePct} ${circ}`}
            strokeDashoffset={-(mobilePct)} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} />
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill={C.text}>{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill={C.grayMid}>sessões</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange }} />
              <span style={{ color: C.textSub }}>Mobile</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.orange, marginLeft: 16 }}>{pct}%</div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.black }} />
              <span style={{ color: C.textSub }}>Desktop</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.black, marginLeft: 16 }}>{100 - pct}%</div>
          </div>
        </div>
      </div>
    );
  }

  const cardStyle = {
    background: "#fff", border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "18px 20px",
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>

      {/* Título + período */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Analytics</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSub }}>Acessos e uso da plataforma Ativa.LAW</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["7","7 dias"],["14","14 dias"],["30","30 dias"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)} style={{
              background: periodo === v ? C.black : "#fff",
              color: periodo === v ? "#fff" : C.text,
              border: `1px solid ${periodo === v ? C.black : C.border}`,
              borderRadius: 6, padding: "6px 14px", fontSize: 12,
              fontWeight: periodo === v ? 700 : 400, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <EstadoVazio>Carregando analytics...</EstadoVazio>}

      {!loading && (
        <>
          {/* Stats cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Visitas ao site"    valor={Number(stats?.totalSessoes     || 0).toLocaleString("pt-BR")} cor={C.orange} />
            <StatCard label="Usuários únicos"    valor={Number(stats?.totalUsuarios    || 0).toLocaleString("pt-BR")} cor={C.black} />
            <StatCard label="Sessões hoje"       valor={Number(stats?.sessoesHoje      || 0).toLocaleString("pt-BR")} cor="#065f46" />
            <StatCard label="Novos cadastros"    valor={Number(stats?.novosCadastros   || 0).toLocaleString("pt-BR")} cor="#1e40af" />
            <StatCard label="Usuários ativos"    valor={Number(stats?.usuariosAtivos   || 0).toLocaleString("pt-BR")} cor="#7c3aed" />
          </div>

          {/* Gráficos */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Acessos por dia */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>Visitas ao site</div>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>Últimos {periodo} dias</div>
              <BarChart dados={acessos.map(a => ({
                label: a.data,
                labelCurto: a.data?.slice(0, 5),
                valor: Number(a.sessoes || 0),
              }))} cor={C.orange} altura={120} />
            </div>

            {/* Mobile vs Desktop */}
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>Dispositivos</div>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 20 }}>Últimos {periodo} dias</div>
              <DonutChart
                mobile={Number(stats?.mobile || 0)}
                desktop={Number(stats?.desktop || 0)}
              />
            </div>
          </div>

          {/* Usuários recentes */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>Usuários cadastrados</div>
            {usuarios.length === 0
              ? <EstadoVazio>Nenhum usuário encontrado.</EstadoVazio>
              : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>{["Nome","Email","Plano","Cadastro","Último acesso","Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", background: C.black, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.orange}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u, i) => (
                        <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                          <td style={{ ...TD, fontWeight: 600 }}>{u.nome || "—"}</td>
                          <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{u.email}</td>
                          <td style={TD}><TierBadge tier={u.tier} /></td>
                          <td style={{ ...TD, fontSize: 12, color: C.textSub }}>{u.criadoEm ? new Date(u.criadoEm).toLocaleDateString("pt-BR") : "—"}</td>
                          <td style={{ ...TD, fontSize: 12, color: C.textSub }}>{u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleDateString("pt-BR") : "—"}</td>
                          <td style={TD}>
                            <span style={{ background: u.ativo ? "#d1fae5" : "#fee2e2", color: u.ativo ? "#065f46" : "#991b1b", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                              {u.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}
    </div>
  );
}