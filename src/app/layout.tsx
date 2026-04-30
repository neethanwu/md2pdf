import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

/* Editorial + Academic presets render in Source Serif 4 (one serif covers
   both — alignment, italics, and paragraph indent carry the distinction).
   Self-hosted via next/font with a metric-matched fallback so first paint
   doesn't shift when the WOFF2 swaps in. The PDF lambda inlines the same
   font as a data URI (see lib/pdf-fonts.ts) so preview and export stay in
   lockstep. */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  style: ["normal", "italic"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "md2pdf",
  description: "Markdown to a finished PDF, without the design detour.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${hankenGrotesk.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        {/* DNS-prefetch hints for the CJK font CDN — cheap (a single DNS
            resolution, no body) and pre-warms resolution so when the workspace
            detects CJK and hoists the <link>, the actual CSS fetch is faster.
            The full stylesheet <link> is rendered conditionally from the
            workspace via React 19 hoisting — Latin-only sessions never load
            it. See md2pdf-workspace.tsx and lib/pdf-cjk.ts. */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
