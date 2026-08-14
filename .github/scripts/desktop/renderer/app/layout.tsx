import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppRail } from "@/components/app-rail";
import { TopBar } from "@/components/top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KFe Icons",
  description: "Local icon browser & editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Material Symbols Outlined — legacy chrome and JS-injected UI rely on
            these glyph names, so ship the same font Google-hosts as legacy did. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-25..0"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased overflow-hidden">
        <TooltipProvider>
          <div className="flex flex-col h-screen">
            <TopBar />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <AppRail />
              <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                {children}
              </main>
            </div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
