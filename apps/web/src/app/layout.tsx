import type { ReactNode } from "react";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });
const nunito = Nunito({subsets:["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito"});

export default function RootLayout({ children }: {children: ReactNode }) {
  return (
    <html lang="pt-BR" className={ `${fraunces.variable} ${nunito.variable}`}>
      <body className="bg-cream font-sans text-ink">{children}</body>
    </html>
  );
}
