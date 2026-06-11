import { AuthProvider } from "@/lib/auth";

export const metadata = {
  title: "Ativa.LAW",
  description: "Processos sem polo passivo — TRT-2 SP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f7fa" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
