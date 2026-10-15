import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const texto = Inter({ subsets: ["latin"], variable: "--font-texto" });
const titulo = Fraunces({ subsets: ["latin"], variable: "--font-titulo" });

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
