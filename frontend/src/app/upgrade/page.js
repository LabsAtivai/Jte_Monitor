// frontend/src/app/upgrade/page.js
"use client";
import { useRouter } from "next/navigation";

export default function UpgradePage() {
  const router = useRouter();
  return (
    <div style={{ minHeight:"100vh", background:"#f5f7fa", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:760, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:"#111827", margin:"0 0 8px" }}>Escolha seu plano</h1>
          <p style={{ color:"#6b7280", fontSize:15, margin:0 }}>Monitore processos sem representação antes da audiência</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <Plano nome="Free" preco="R$0" sub="para sempre" cor="#6b7280"
            features={["5 processos visíveis","Filtro por vara e data","Busca por número e reclamada","Sem alertas por e-mail","Sem exportação"]}
            cta="Continuar grátis" onCta={() => router.push("/dashboard")} />
          <Plano nome="Premium" preco="R$147" sub="/mês" cor="#1a3a5c" destaque
            features={["Processos ilimitados","Alertas por e-mail em tempo real","Filtros salvos personalizados","Exportação CSV","Histórico completo","Suporte prioritário"]}
            cta="Assinar Premium" onCta={() => alert("Integração com pagamento em breve!")} />
        </div>
        <div style={{ textAlign:"center", marginTop:24, fontSize:13, color:"#9ca3af" }}>
          Dúvidas? contato@jte-monitor.com.br
        </div>
      </div>
    </div>
  );
}

function Plano({ nome, preco, sub, cor, destaque, features, cta, onCta }) {
  return (
    <div style={{ background:"#fff", border:`${destaque?2:1}px solid ${destaque?cor:"#e5e7eb"}`,
      borderRadius:12, padding:"28px 24px", position:"relative",
      boxShadow:destaque?`0 8px 32px rgba(26,58,92,.12)`:"none" }}>
      {destaque && (
        <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
          background:cor, color:"#fff", borderRadius:20, padding:"4px 16px", fontSize:11, fontWeight:700 }}>
          MAIS POPULAR
        </div>
      )}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:700, color:"#111827" }}>{nome}</div>
        <div style={{ marginTop:8 }}>
          <span style={{ fontSize:32, fontWeight:800, color:cor }}>{preco}</span>
          <span style={{ fontSize:14, color:"#6b7280", marginLeft:4 }}>{sub}</span>
        </div>
      </div>
      <ul style={{ listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:10 }}>
        {features.map(f => (
          <li key={f} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:14, color:"#374151" }}>
            <span style={{ color:destaque?cor:"#9ca3af", fontWeight:700, marginTop:1 }}>{destaque?"✓":"–"}</span>
            {f}
          </li>
        ))}
      </ul>
      <button onClick={onCta} style={{ width:"100%", padding:12,
        background:destaque?cor:"#fff", color:destaque?"#fff":cor,
        border:`1.5px solid ${cor}`, borderRadius:7, fontSize:14, fontWeight:600, cursor:"pointer" }}>
        {cta}
      </button>
    </div>
  );
}
