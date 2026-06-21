import type { Metadata } from "next";
import { JetBrains_Mono, Source_Sans_3, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./workspace.css";

const fontBody = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const fontHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JP Family Office — AI Investment Cockpit",
  description:
    "A BYOK AI investment cockpit: deterministic quant engine grounded, LLM red-team debate, 3-lens advisory, human-in-the-loop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fontBody.variable} ${fontHeading.variable} ${fontMono.variable} industrial-theme`}>{children}</body>
    </html>
  );
}
