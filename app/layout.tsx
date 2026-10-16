import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { scriptTema } from "@/lib/tema";
import "./globals.css";

// Lexend: feita para facilitar a leitura, letras abertas e zero sem risco (preços ficam limpos).
const texto = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-texto" });

export const metadata: Metadata = {
  title: "Bússola do Ciclo Pecuário",
  description: "Em que fase está o ciclo do boi, o que esperar dos preços e quando comprar, com dados reais e previsão conferida toda semana.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={texto.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
