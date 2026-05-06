"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth }   from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const TD = { padding: "11px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", color: "#374151" };

function QualidadeBadge({ q }) {
  const map = { alta: { label: "Alta", bg: "#d1fae5", color: "#065f46" }, media: { label: "Média", bg: "#fef3c7", color: "#92400e" }, baixa: { label: "Baixa", bg: "#fee2e2", color: "#991b1b" } };
  const c = map[q] || { label: q || "—", bg: "#f3f4f6", color: "#6b7280" };
  return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
}

function CopiarBtn({ texto }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() { navigator.clipboard.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }); }
  return <button onClick={copiar} style={{ background: copiado ? "#d1fae5" : "#f3f4f6", color: copiado ? "#065f46" : "#6b7280", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginLeft: 6 }}>{copiado ? "✓" : "Copiar"}</button>;
}

function TierBadge({ tier }) {
  const map = { free: { label: "Free", bg: "rgba(255,255,255,0.15)", color: "#fff" }, premium: { label: "Premium", bg: "#fbbf24", color: "#1f2937" }, admin: { label: "Admin", bg: "#818cf8", color: "#fff" } };
  const c = map[tier] || map.free;
  return <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
}

function EstadoVazio({ children }) {
  return <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>{children}</div>;
}

function FiltroInput({ label, ...props }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</label>
      <input {...props} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#111827", boxSizing: "border-box", outline: "none" }} />
    </div>
  );
}

function FiltroSelect({ label, children, ...props }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</label>
      <select {...props} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#111827", background: "#fff", boxSizing: "border-box", outline: "none" }}>{children}</select>
    </div>
  );
}

function BotaoPagina({ children, onClick, disabled, primary }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: primary ? "#1a3a5c" : "#fff", color: primary ? "#fff" : "#374151", border: `1px solid ${primary ? "#1a3a5c" : "#d1d5db"}`, borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}>{children}</button>;
}

export default function DashboardPage() {
  const { user, ready, logout, authFetch, isPremium } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState("processos");

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      <header style={{ background: "#1a3a5c", color: "#fff", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>JTe Monitor</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ key: "processos", label: "Processos" }, { key: "contatos", label: "Contatos" }].map(a => (
              <button key={a.key} onClick={() => setAba(a.key)} style={{ background: aba === a.key ? "rgba(255,255,255,0.15)" : "transparent", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 13, fontWeight: aba === a.key ? 700 : 400, cursor: "pointer", borderBottom: aba === a.key ? "2px solid #f59e0b" : "2px solid transparent" }}>{a.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13 }}>
          <TierBadge tier={user.tier} />
          {!isPremium && (
            <button onClick={() => router.push("/upgrade")} style={{ background: "#f59e0b", color: "#1f2937", border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Upgrade Premium</button>
          )}
          <span style={{ opacity: 0.7 }}>{user.nome}</span>
          <button onClick={logout} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>Sair</button>
        </div>
      </header>
      {aba === "processos" && <AbaProcessos authFetch={authFetch} user={user} isPremium={isPremium} router={router} />}
      {aba === "contatos"  && <AbaContatos  authFetch={authFetch} />}
    </div>
  );
}

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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
          <FiltroSelect label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
            <option value="">Todas as varas</option>
            {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
          </FiltroSelect>
          <FiltroInput label="Número"    value={numero}    onChange={e => setNumero(e.target.value)}    placeholder="0000000-00.0000..." />
          <FiltroInput label="Reclamada" value={reclamada} onChange={e => setReclamada(e.target.value)} placeholder="Nome da empresa..." />
          <FiltroInput label="Audiência de" type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} />
          <FiltroInput label="Audiência até" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <button onClick={() => { setVara(""); setNumero(""); setReclamada(""); setDataIni(""); setDataFim(""); }} style={{ background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Limpar filtros</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
        {loading && <EstadoVazio>Carregando...</EstadoVazio>}
        {!loading && rows.length === 0 && <EstadoVazio>Nenhum processo encontrado.</EstadoVazio>}
        {!loading && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>{["Vara","Data","Número do processo","Reclamante","Reclamada","Juiz(a)"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={TD}><span style={{ fontSize: 11 }}>{r.vara}</span></td>
                      <td style={{ ...TD, whiteSpace: "nowrap", color: "#6b7280" }}>{r.dataBR}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{r.numeroProcesso}</td>
                      <td style={TD}>{r.reclamante || "—"}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>{r.reclamada || "—"}</td>
                      <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{r.juiz || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280", flexWrap: "wrap", gap: 8 }}>
                <span>{(pagina-1)*50+1}–{Math.min(pagina*50, dados.total)} de {dados.total}</span>
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
    const headers = ["Email","Qualidade","Reclamada","Razão Social","Nº Processo","CNPJ","Vara","Data","Telefone"];
    const esc = v => { if (!v) return ""; const s = String(v); return /[;"'\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = [headers.join(";"), ...rows.map(r => [r.email, r.qualidadeEmail, r.reclamada, r.nomeFantasia||r.razaoSocial, r.numeroProcesso, r.cnpj, r.vara, r.dataBR, r.telefone].map(esc).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contatos_jte_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const rows = dados?.rows ?? [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total contatos",    valor: Number(stats.total).toLocaleString("pt-BR"),         cor: "#1a3a5c" },
            { label: "Alta qualidade",    valor: Number(stats.totalAlta).toLocaleString("pt-BR"),     cor: "#065f46" },
            { label: "Média qualidade",   valor: Number(stats.totalMedia).toLocaleString("pt-BR"),    cor: "#92400e" },
            { label: "Baixa qualidade",   valor: Number(stats.totalBaixa).toLocaleString("pt-BR"),    cor: "#991b1b" },
            { label: "Empresas distintas",valor: Number(stats.totalEmpresas).toLocaleString("pt-BR"), cor: "#1e40af" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.cor }}>{s.valor}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 12 }}>
          <FiltroInput label="Reclamada"   value={reclamada} onChange={e => setReclamada(e.target.value)} placeholder="Nome da empresa..." />
          <FiltroInput label="Email"       value={email}     onChange={e => setEmail(e.target.value)}     placeholder="email@empresa.com" />
          <FiltroInput label="Nº Processo" value={numero}    onChange={e => setNumero(e.target.value)}    placeholder="0000000-00.0000..." />
          <FiltroSelect label="Vara" value={vara} onChange={e => setVara(e.target.value)}>
            <option value="">Todas as varas</option>
            {dados?.varas?.map(v => <option key={v} value={v}>{v}</option>)}
          </FiltroSelect>
          <FiltroSelect label="Qualidade" value={qualidade} onChange={e => setQualidade(e.target.value)}>
            <option value="">Todas</option>
            <option value="alta">Alta (corporativo)</option>
            <option value="media">Média (corporativo)</option>
            <option value="baixa">Baixa (gmail/hotmail)</option>
          </FiltroSelect>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setReclamada(""); setEmail(""); setNumero(""); setVara(""); setQualidade(""); }} style={{ background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Limpar filtros</button>
          <button onClick={exportarCSV} disabled={!rows.length} style={{ background: rows.length ? "#1a3a5c" : "#e5e7eb", color: rows.length ? "#fff" : "#9ca3af", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: rows.length ? "pointer" : "not-allowed" }}>↓ Exportar CSV</button>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        {loading && <EstadoVazio>Carregando...</EstadoVazio>}
        {!loading && rows.length === 0 && <EstadoVazio>Nenhum contato encontrado.</EstadoVazio>}
        {!loading && rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>{["Email","Qualidade","Reclamada","Razão Social","Nº Processo","CNPJ"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={TD}><span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.email}</span><CopiarBtn texto={r.email} /></td>
                      <td style={TD}><QualidadeBadge q={r.qualidadeEmail} /></td>
                      <td style={{ ...TD, fontWeight: 500 }}>{r.reclamada || "—"}</td>
                      <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{r.nomeFantasia || r.razaoSocial || "—"}</td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12 }}>{r.numeroProcesso}<CopiarBtn texto={r.numeroProcesso} /></td>
                      <td style={{ ...TD, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{r.cnpj ? r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280", flexWrap: "wrap", gap: 8 }}>
                <span>{(pagina-1)*50+1}–{Math.min(pagina*50, dados.total)} de {dados.total}</span>
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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Meus alertas por e-mail</div>
        <button onClick={() => setCriando(true)} style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ Novo alerta</button>
      </div>
      {criando && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <FiltroInput label="Nome do alerta *" value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Bancos SP" />
            <FiltroInput label="Vara (opcional)"  value={fVara} onChange={e => setFVara(e.target.value)} placeholder="1ª Vara..." />
            <FiltroInput label="Reclamada contém" value={fRec}  onChange={e => setFRec(e.target.value)}  placeholder="Nome da empresa..." />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={criar} style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Salvar alerta</button>
            <button onClick={() => setCriando(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
      {loading && <div style={{ color: "#9ca3af", fontSize: 13 }}>Carregando alertas...</div>}
      {!loading && lista.length === 0 && !criando && <div style={{ color: "#9ca3af", fontSize: 13 }}>Nenhum alerta criado.</div>}
      {lista.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{a.nome}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{[a.vara && `Vara: ${a.vara}`, a.reclamada && `Reclamada: ${a.reclamada}`].filter(Boolean).join(" · ") || "Todos os processos"}</div>
          </div>
          <button onClick={() => remover(a.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>Remover</button>
        </div>
      ))}
    </div>
  );
}
