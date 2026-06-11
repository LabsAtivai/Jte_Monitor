"use client";
import { useState }  from "react";
import { useAuth }   from "@/lib/auth";
import { useRouter } from "next/navigation";

function formatarCpfCnpj(v) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            .replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3")
            .replace(/(\d{3})(\d{0,3})/, "$1.$2");
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
          .replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4")
          .replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3")
          .replace(/(\d{2})(\d{0,3})/, "$1.$2");
}

function formatarTelefone(v) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/(\d{2})(\d{0,4})/, "($1) $2");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/(\d{2})(\d{0,5})/, "($1) $2");
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  const [modo,      setModo]      = useState("inicio");
  const [nome,      setNome]      = useState("");
  const [email,     setEmail]     = useState("");
  const [senha,     setSenha]     = useState("");
  const [telefone,  setTelefone]  = useState("");
  const [cpfCnpj,   setCpfCnpj]   = useState("");
  const [erro,      setErro]      = useState("");
  const [loading,   setLoading]   = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro("");
    if (modo === "register") {
      if (!telefone || telefone.replace(/\D/g,"").length < 10) { setErro("Informe um celular válido."); return; }
      if (!cpfCnpj  || cpfCnpj.replace(/\D/g,"").length < 11) { setErro("Informe um CPF ou CNPJ válido."); return; }
    }
    setLoading(true);
    try {
      if (modo === "login") {
        await login(email, senha);
      } else {
        await register(nome, email, senha, { telefone, cpfCnpj });
      }
      router.push("/dashboard");
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Tela inicial ─────────────────────────────────────────
  if (modo === "inicio") {
    return (
      <div style={{ minHeight: "100vh", background: "#111", fontFamily: "'Inter','Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>

        {/* Hero */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>

          {/* Logo */}
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
            <span style={{ color: "#fff" }}>Ativa.</span>
            <span style={{ color: "#E05A00" }}>LAW</span>
          </div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 48, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Prospecção Jurídica Inteligente
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", maxWidth: 640, margin: "0 auto 20px", lineHeight: 1.25, letterSpacing: "-0.02em" }}>
            Encontre empresas com processos<br />
            trabalhistas <span style={{ color: "#E05A00" }}>antes da concorrência.</span>
          </h1>
          <p style={{ fontSize: 16, color: "#777", maxWidth: 520, margin: "0 auto 52px", lineHeight: 1.7 }}>
            Monitoramento automático das pautas do TRT — leads com polo passivo sem advogado constituído, entregues direto no seu painel.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 64 }}>
            <button onClick={() => setModo("register")} style={{
              background: "#E05A00", color: "#fff", border: "none",
              borderRadius: 8, padding: "16px 36px", fontSize: 16, fontWeight: 800,
              cursor: "pointer", letterSpacing: "0.01em",
              boxShadow: "0 4px 24px rgba(224,90,0,0.35)",
            }}>
              Cadastre-se Aqui! →
            </button>
            <button onClick={() => setModo("login")} style={{
              background: "transparent", color: "#aaa",
              border: "1px solid #333", borderRadius: 8,
              padding: "16px 28px", fontSize: 15, cursor: "pointer",
            }}>
              Já tenho conta
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { valor: "5.000+", label: "processos/semana" },
              { valor: "100%",   label: "leads sem advogado" },
              { valor: "< 24h",  label: "do processo ao lead" },
              { valor: "93",     label: "varas monitoradas" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#E05A00" }}>{s.valor}</div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ background: "#161616", borderTop: "1px solid #1f1f1f", padding: "48px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
            {[
              { icon: "⚖️", titulo: "Filtro automático", desc: "Apenas processos com polo passivo sem advogado constituído." },
              { icon: "🔔", titulo: "Alertas em tempo real", desc: "Notificação assim que um novo lead elegível é detectado." },
              { icon: "📋", titulo: "Dados completos", desc: "CNPJ, razão social, data da audiência e vara trabalhista." },
              { icon: "🚀", titulo: "Você chega primeiro", desc: "Acesse o lead antes que qualquer concorrente saiba da audiência." },
            ].map(f => (
              <div key={f.titulo} style={{ textAlign: "center", padding: "8px 12px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 6 }}>{f.titulo}</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ background: "#E05A00", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 16 }}>
            Pronto para fechar mais contratos?
          </div>
          <button onClick={() => setModo("register")} style={{
            background: "#fff", color: "#E05A00", border: "none",
            borderRadius: 8, padding: "13px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}>
            Cadastre-se Aqui!
          </button>
        </div>
      </div>
    );
  }

  // ── Tela de login / cadastro ──────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#111", fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* Painel esquerdo */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 64px", borderRight: "1px solid #1f1f1f" }}>
        <button onClick={() => setModo("inicio")} style={{ background: "transparent", border: "none", color: "#555", fontSize: 13, cursor: "pointer", textAlign: "left", marginBottom: 40, padding: 0 }}>
          ← Voltar
        </button>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>
          <span style={{ color: "#fff" }}>Ativa.</span>
          <span style={{ color: "#E05A00" }}>LAW</span>
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 40 }}>Prospecção Jurídica Inteligente</div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 0 14px", lineHeight: 1.3, maxWidth: 340 }}>
          {modo === "login"
            ? "Bem-vindo de volta."
            : <>Acesse leads jurídicos qualificados <span style={{ color: "#E05A00" }}>direto no painel.</span></>}
        </h2>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.7, maxWidth: 340, margin: 0 }}>
          {modo === "login"
            ? "Entre na plataforma e acesse os leads do seu tribunal em tempo real."
            : "Cadastre-se para ter acesso completo. Após o cadastro, escolha o plano e comece a receber leads."}
        </p>

        {modo === "register" && (
          <div style={{ marginTop: 36, padding: "16px 18px", background: "rgba(224,90,0,0.08)", borderRadius: 8, border: "1px solid rgba(224,90,0,0.2)", fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
            🔒 Após o cadastro, o acesso aos leads é liberado mediante a assinatura de um dos planos disponíveis.
          </div>
        )}

        <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
          {[
            { valor: "93", label: "varas monitoradas" },
            { valor: "100%", label: "leads qualificados" },
            { valor: "< 24h", label: "tempo de entrega" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#E05A00" }}>{s.valor}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — form */}
      <div style={{ width: modo === "register" ? 480 : 440, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 48px", background: "#161616", overflowY: "auto" }}>
        <div style={{ width: "100%" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
              {modo === "login" ? "Entrar na plataforma" : "Cadastre-se Aqui!"}
            </div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 5 }}>
              {modo === "login" ? "Informe seu e-mail e senha" : "Preencha seus dados para criar sua conta"}
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {modo === "register" && (
              <>
                <Campo label="Nome completo *" type="text" value={nome}
                  onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" required />
                <Campo label="Celular *" type="tel" value={telefone}
                  onChange={e => setTelefone(formatarTelefone(e.target.value))}
                  placeholder="(11) 99999-9999" maxLength={15} required />
                <Campo label="CPF / CNPJ *" type="text" value={cpfCnpj}
                  onChange={e => setCpfCnpj(formatarCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00" maxLength={18} required />
              </>
            )}
            <Campo label="E-mail *" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            <Campo label="Senha *" type="password" value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder={modo === "register" ? "Mínimo 8 caracteres" : "Sua senha"} required />

            {erro && (
              <div style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
                {erro}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              background: loading ? "#7a3300" : "#E05A00",
              color: "#fff", border: "none", borderRadius: 7,
              padding: "13px", fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4, letterSpacing: "0.01em",
            }}>
              {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta →"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#555" }}>
            {modo === "login" ? (
              <>
                Não tem conta?{" "}
                <span onClick={() => { setModo("register"); setErro(""); }} style={{ color: "#E05A00", cursor: "pointer", fontWeight: 600 }}>
                  Cadastre-se aqui
                </span>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <span onClick={() => { setModo("login"); setErro(""); }} style={{ color: "#E05A00", cursor: "pointer", fontWeight: 600 }}>
                  Entrar
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, ...props }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 5, letterSpacing: "0.03em" }}>
        {label}
      </label>
      <input {...props} style={{
        width: "100%", padding: "10px 12px",
        border: "1px solid #2a2a2a", borderRadius: 6,
        fontSize: 14, color: "#fff", background: "#1e1e1e",
        boxSizing: "border-box", outline: "none",
      }} />
    </div>
  );
}