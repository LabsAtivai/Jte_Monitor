"use client";
import { useState } from "react";
import { useAuth }  from "@/lib/auth";
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
    e.preventDefault(); setErro(""); setLoading(true);
    try {
      modo === "login" ? await login(email, senha) : await register(nome, email, senha);
      router.push("/dashboard");
    } catch (err) { setErro(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f7fa" }}>
      <div style={{ background:"#fff", borderRadius:10, border:"1px solid #e5e7eb", padding:"40px 36px", width:"100%", maxWidth:400, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:700, color:"#1a3a5c" }}>JTe Monitor</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>
            {modo==="login" ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </div>
        </div>
        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {modo==="register" && <F label="Nome" type="text" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome" required />}
          <F label="E-mail" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required />
          <F label="Senha"  type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder={modo==="register"?"Mínimo 8 caracteres":"Sua senha"} required />
          {erro && <div style={{ background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca", borderRadius:6, padding:"10px 14px", fontSize:13 }}>{erro}</div>}
          <button type="submit" disabled={loading} style={{ background:loading?"#93c5fd":"#1a3a5c", color:"#fff", border:"none", borderRadius:7, padding:12, fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer", marginTop:4 }}>
            {loading ? "Aguarde..." : modo==="login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <div style={{ textAlign:"center", marginTop:20, fontSize:13, color:"#6b7280" }}>
          {modo==="login"
            ? <>Não tem conta? <span onClick={()=>{setModo("register");setErro("");}} style={{ color:"#1a56a4", cursor:"pointer", fontWeight:500 }}>Cadastre-se grátis</span></>
            : <>Já tem conta? <span onClick={()=>{setModo("login");setErro("");}} style={{ color:"#1a56a4", cursor:"pointer", fontWeight:500 }}>Entrar</span></>}
        </div>
        {modo==="register" && (
          <div style={{ marginTop:20, padding:"12px 14px", background:"#f0fdf4", borderRadius:6, border:"1px solid #bbf7d0", fontSize:12, color:"#166534" }}>
            Conta gratuita: acesso a 5 processos. Upgrade para ilimitado + alertas.
          </div>
        )}
      </div>
    </div>
  );
}
function F({ label, ...p }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>{label}</label>
      <input {...p} style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:6, fontSize:14, color:"#111827", boxSizing:"border-box" }} />
    </div>
  );
}
