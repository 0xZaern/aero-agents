import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Montserrat, Prata } from "next/font/google";
import { themeScript } from "@/lib/theme";
import { MODEL_COUNT } from "@/lib/models";
import Providers from "./providers";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});
// High-contrast Didone for the æro wordmark.
const prata = Prata({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-prata",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aeroagents.io";
const TITLE = "aero - one interface, every AI model";
const DESCRIPTION = `Chat with ${MODEL_COUNT} frontier models, build agents that act, assemble teams, and track every token. One interface. Every AI model.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "aero",
    type: "website",
    images: [
      { url: "/og.png", width: 2530, height: 1041, alt: "aero - every model, every agent, one wallet" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
    site: "@aero_agents",
    creator: "@aero_agents",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} ${montserrat.variable} ${prata.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
