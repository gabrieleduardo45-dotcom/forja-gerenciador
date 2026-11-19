import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plex = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Forja · Central", template: "%s · Forja" },
  description: "Central de comando da Forja: setores, agentes de IA e aprovação.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/icone.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Gestão Forja", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0e0d0c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${plex.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
