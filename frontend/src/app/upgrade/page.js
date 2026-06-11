"use client";
import { useRouter } from "next/navigation";

const C = {
  black:   "#111111",
  orange:  "#E05A00",
  white:   "#FFFFFF",
  gray:    "#F4F4F4",
  border:  "#E5E7EB",
  text:    "#1A1A1A",
  textSub: "#6B6B6B",
};

export default function UpgradePage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: C.black,
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        background: C.black, borderBottom: `1px solid #1f1f1f`,
        padding: "0 28px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: C.white }}>Ativa.</span>
          <span style={{ color: C.orange }}>LAW</span>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          style={{ background: "transparent", color: "#666", border: "1px solid #333", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}
        >
          ← Voltar
        </button>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "56px 24px" }}>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.white, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Escolha seu plano
          </h1>
          <p style={{ color: "#666", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
            Acesse processos trabalhistas com polo passivo sem advogado —<br />
            entregues direto no seu painel antes da audiência.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Plano Sem Suporte */}
          <div style={{
            background: "#161616",
            border: `1px solid #2a2a2a`,
            borderRadius: 14,
            padding: "36px 32px",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Plataforma</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, margin: "0 0 4px", lineHeight: 1.3 }}>
                Processos Jurídicos<br />
                <span style={{ color: "#555", fontWeight: 400 }}>sem Suporte</span>
              </h2>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: C.white }}>R$ 1.995</span>
                <span style={{ fontSize: 13, color: "#555", marginLeft: 6 }}>/mês</span>
              </div>
              <p style={{ fontSize: 13, color: "#666", margin: "12px 0 0", lineHeight: 1.6 }}>
                Ferramenta que ajuda na geração de leads jurídicos com dados de contato das empresas reclamadas.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {[
                "Acesso completo à plataforma",
                "Leads com polo passivo sem advogado",
                "Filtros por vara, data e empresa",
                "Exportação CSV dos contatos",
                "Contatos enriquecidos via Snov.io",
              ].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#aaa" }}>
                  <span style={{ color: C.orange, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
              {[
                "Sem suporte do time Ativa.ai",
                "Sem onboarding assistido",
              ].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#333", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✕</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => alert("Em breve — entre em contato: contato@ativa.law")}
              style={{
                width: "100%", padding: "13px",
                background: "transparent",
                color: C.white,
                border: `1.5px solid #333`,
                borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Contratar plano
            </button>
          </div>

          {/* Plano Com Suporte — destaque */}
          <div style={{
            background: "#1a1a1a",
            border: `2px solid ${C.orange}`,
            borderRadius: 14,
            padding: "36px 32px",
            display: "flex", flexDirection: "column",
            position: "relative",
            boxShadow: `0 0 40px rgba(224,90,0,0.15)`,
          }}>
            {/* Badge */}
            <div style={{
              position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
              background: C.orange, color: C.white,
              borderRadius: 20, padding: "4px 18px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", whiteSpace: "nowrap",
            }}>
              RECOMENDADO
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Plataforma + Suporte</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, margin: "0 0 4px", lineHeight: 1.3 }}>
                Processos Jurídicos<br />
                <span style={{ color: C.orange }}>com Suporte Ativa.ai</span>
              </h2>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: C.orange }}>R$ 2.995</span>
                <span style={{ fontSize: 13, color: "#888", marginLeft: 6 }}>/mês</span>
              </div>
              <p style={{ fontSize: 13, color: "#888", margin: "12px 0 0", lineHeight: 1.6 }}>
                Ferramenta que ajuda na geração de leads jurídicos com dados de contato, com o time Ativa.ai operando junto.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {[
                "Tudo do plano sem suporte",
                "Onboarding assistido pelo time Ativa.ai",
                "Suporte dedicado via WhatsApp",
                "Configuração e operação assistida",
                "Estratégia de abordagem dos leads",
                "Relatórios mensais de desempenho",
                "Atualizações e melhorias incluídas",
                "SLA de resposta em até 4h úteis",
              ].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#ccc" }}>
                  <span style={{ color: C.orange, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => alert("Em breve — entre em contato: contato@ativa.law")}
              style={{
                width: "100%", padding: "13px",
                background: C.orange,
                color: C.white,
                border: "none",
                borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.01em",
              }}
            >
              Contratar com suporte
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: "center", marginTop: 40, fontSize: 13, color: "#444" }}>
          Dúvidas? Fale com a gente:{" "}
          <a href="mailto:contato@ativa.law" style={{ color: C.orange, textDecoration: "none", fontWeight: 500 }}>
            contato@ativa.law
          </a>
        </div>
      </div>
    </div>
  );
}