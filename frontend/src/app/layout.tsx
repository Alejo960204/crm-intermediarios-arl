import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = { title: "CRM Intermediarios ARL" };

// Aplica el tema guardado (o el del sistema) antes de pintar, para evitar el parpadeo claro/oscuro.
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");if(t==="oscuro"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} /></head>
      <body className="min-h-screen bg-slate-50 text-slate-800"><AppShell>{children}</AppShell></body>
    </html>
  );
}
