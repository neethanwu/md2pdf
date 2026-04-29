import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Inline-as-data-URI font loader for the PDF route. The lambda has no shared
   filesystem with the browser bundle, and depending on Google Fonts at render
   time means cold-start DNS + TLS plus a silent failure mode if Google has an
   outage. Reading from Fontsource's node_modules and base64-encoding once at
   module load gives us deterministic, self-contained PDF rendering — the same
   bytes every time, no network call from puppeteer.

   Latin-only / weight-variable WOFF2 covers the markdown surface (no CJK or
   ext-Latin requirements yet). Add subsets here if that changes. */

type FontFaceSpec = {
  family: string;
  style: "normal" | "italic";
  weightRange: string; // e.g. "200 900"
  packagePath: string; // path under node_modules
  fileName: string;
};

const FONTS: FontFaceSpec[] = [
  {
    family: "Hanken Grotesk Variable",
    style: "normal",
    weightRange: "100 900",
    packagePath: "@fontsource-variable/hanken-grotesk/files",
    fileName: "hanken-grotesk-latin-wght-normal.woff2",
  },
  {
    family: "Hanken Grotesk Variable",
    style: "italic",
    weightRange: "100 900",
    packagePath: "@fontsource-variable/hanken-grotesk/files",
    fileName: "hanken-grotesk-latin-wght-italic.woff2",
  },
  {
    family: "Source Serif 4 Variable",
    style: "normal",
    weightRange: "200 900",
    packagePath: "@fontsource-variable/source-serif-4/files",
    fileName: "source-serif-4-latin-wght-normal.woff2",
  },
  {
    family: "Source Serif 4 Variable",
    style: "italic",
    weightRange: "200 900",
    packagePath: "@fontsource-variable/source-serif-4/files",
    fileName: "source-serif-4-latin-wght-italic.woff2",
  },
];

function loadFontFaceCss(): string {
  const decls = FONTS.map((font) => {
    const filePath = join(process.cwd(), "node_modules", font.packagePath, font.fileName);
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString("base64");
    return `@font-face {
  font-family: '${font.family}';
  font-style: ${font.style};
  font-display: swap;
  font-weight: ${font.weightRange};
  src: url(data:font/woff2;base64,${base64}) format('woff2-variations');
}`;
  });

  return decls.join("\n");
}

/* Module-scoped cache. Cold start pays the read+encode once (~225KB total
   after base64); every warm invocation reuses the string. */
let cachedCss: string | null = null;

export function getInlinedFontFaceCss(): string {
  if (cachedCss === null) {
    cachedCss = loadFontFaceCss();
  }
  return cachedCss;
}
