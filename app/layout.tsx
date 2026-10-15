import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible: letras desenhadas para não serem confundidas (l/I/1, O/0), boa para ler números.
const texto = Atkinson_Hyperlegible_Next({ subsets: ["latin", "latin-ext"], variable: "--font-texto" });
const titulo = Atkinson_Hyperlegible_Next({ subsets: ["latin", "latin-ext"], variable: "--font-titulo", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Bússola do Ciclo Pecuário",
  description: "Em que fase está o ciclo do boi, o que esperar dos preços e quando comprar, com dados reais e previsão conferida toda semana.",
};

export const viewport: Viewport = { themeColor: "#0b0f0d" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${texto.variable} ${titulo.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
