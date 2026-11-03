import type { ReactNode } from "react";
import { Fraunces, Nunito } from "next/font/google";
import { SocketProvider } from "@/components/socket-provider";
import { getSession } from "@/server/auth/session";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });
const nunito = Nunito({subsets:["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito"});

export default async function RootLayout({ children }: {children: ReactNode }) {
  const session = await getSession();
  return (
    <html lang="pt-BR" className={ `${fraunces.variable} ${nunito.variable}`}>
      <body className="bg-cream font-sans text-ink">
        { session ? <SocketProvider>{children}</SocketProvider> : children}
      </body>
    </html>
  );
}
