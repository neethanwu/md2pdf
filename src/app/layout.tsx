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
        {/* Noto Sans/Serif CJK across SC + TC + JP + KR. Loaded via Google
            Fonts <link> rather than next/font so the browser smart-subsets via
            unicode-range at runtime — Latin-only sessions never download any
            CJK woff2; Chinese-only sessions skip the JP/KR chunks; etc.
            Mirrored in lib/pdf-cjk.ts so the PDF export uses identical fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Noto+Serif+KR:wght@400;500;600;700&display=swap"
        />
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
