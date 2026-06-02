"use client";
import { useState }  from "react";
import { useAuth }   from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  const [modo,    setModo]    = useState("login");
  const [nome,    setNome]    = useState("");
  const [email,   setEmail]   = useState("");
  const [senha,   setSenha]   = useState("");
  const [erro,    setErro]    = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      if (modo === "login") {
        await login(email, senha);
      } else {
        await register(nome, email, senha);
      }
      router.push("/dashboard");
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#111111",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Painel esquerdo — branding */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 64px",
        borderRight: "1px solid #1f1f1f",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em" }}>
            <span style={{ color: "#ffffff" }}>Ativa.</span>
            <span style={{ color: "#E05A00" }}>LAW</span>
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 6, letterSpacing: "0.02em" }}>
            Prospecção Jurídica Inteligente
          </div>
        </div>

        {/* Tagline */}
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: "0 0 16px", lineHeight: 1.3, maxWidth: 380 }}>
          Encontre empresas com processos trabalhistas{" "}
          <span style={{ color: "#E05A00" }}>antes da concorrência.</span>
        </h1>
        <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 360, margin: 0 }}>
          Monitoramento automático das pautas do TRT — leads qualificados com polo passivo sem advogado constituído, entregues direto no seu painel.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
          {[
            { valor: "5.000+", label: "processos/semana" },
            { valor: "100%",   label: "sem advogado" },
            { valor: "< 24h",  label: "do processo ao lead" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#E05A00" }}>{s.valor}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        width: 440,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 48px",
        background: "#161616",
      }}>
        <div style={{ width: "100%" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff" }}>
              {modo === "login" ? "Entrar na plataforma" : "Criar sua conta"}
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
              {modo === "login" ? "Bem-vindo de volta" : "Acesso gratuito, sem cartão de crédito"}
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {modo === "register" && (
              <Campo label="Nome completo" type="text" value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome" required />
            )}
            <Campo label="E-mail" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required />
            <Campo label="Senha" type="password" value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder={modo === "register" ? "Mínimo 8 caracteres" : "Sua senha"}
              required />

            {erro && (
              <div style={{
                background: "rgba(220,38,38,0.1)", color: "#f87171",
                border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6,
                padding: "10px 14px", fontSize: 13,
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#7a3300" : "#E05A00",
                color: "#fff", border: "none", borderRadius: 7,
                padding: "13px", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4, letterSpacing: "0.01em",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta grátis"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#555" }}>
            {modo === "login" ? (
              <>
                Não tem conta?{" "}
                <span
                  onClick={() => { setModo("register"); setErro(""); }}
                  style={{ color: "#E05A00", cursor: "pointer", fontWeight: 600 }}
                >
                  Cadastre-se grátis
                </span>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <span
                  onClick={() => { setModo("login"); setErro(""); }}
                  style={{ color: "#E05A00", cursor: "pointer", fontWeight: 600 }}
                >
                  Entrar
                </span>
              </>
            )}
          </div>

          {modo === "register" && (
            <div style={{
              marginTop: 20, padding: "12px 14px",
              background: "rgba(224,90,0,0.08)", borderRadius: 6,
              border: "1px solid rgba(224,90,0,0.2)", fontSize: 12, color: "#aaa",
            }}>
              Conta gratuita inclui acesso completo aos leads. Upgrade Premium desbloqueia alertas por e-mail em tempo real.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, ...props }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 600,
        color: "#aaa", marginBottom: 6, letterSpacing: "0.03em",
      }}>
        {label}
      </label>
      <input
        {...props}
        style={{
          width: "100%", padding: "10px 12px",
          border: "1px solid #2a2a2a", borderRadius: 6,
          fontSize: 14, color: "#ffffff",
          background: "#1e1e1e",
          boxSizing: "border-box", outline: "none",
        }}
      />
    </div>
  );
}