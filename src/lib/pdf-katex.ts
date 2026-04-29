import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* KaTeX CSS + fonts inlined as base64 data URIs. Same reasoning as pdf-fonts.ts:
   no runtime CDN dependency, no DNS+TLS on cold start, deterministic output.
   The cost is heavier than the sans/serif inlines (~395KB encoded total across
   20 woff2 files) so we only emit this block when the markdown actually
   contains math — see hasMath() in this file. */

const KATEX_DIR = join(process.cwd(), "node_modules/katex/dist");

function loadKatexCss(): string {
  const css = readFileSync(join(KATEX_DIR, "katex.min.css"), "utf8");
  const fontsDir = join(KATEX_DIR, "fonts");
  const woff2Files = readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));

  /* Drop any url() that isn't woff2 (.woff/.ttf fallbacks) — Chromium reads
     woff2, the others are dead weight in our payload. The regex tolerates
     KaTeX's exact `src:url(fonts/X.woff2) format("woff2"),url(fonts/X.woff)
     format("woff"),url(fonts/X.ttf) format("truetype")` shape. */
  const woff2Map = new Map<string, string>();
  for (const file of woff2Files) {
    const buffer = readFileSync(join(fontsDir, file));
    woff2Map.set(file, buffer.toString("base64"));
  }

  /* Replace woff2 url(fonts/NAME.woff2) → url(data:font/woff2;base64,...).
     Drop the .woff and .ttf fallbacks entirely since Chromium prefers woff2
     and including them would balloon the payload by ~50%. */
  let out = css.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (_, file) => {
    const b64 = woff2Map.get(file);
    if (!b64) return `url(fonts/${file})`;
    return `url(data:font/woff2;base64,${b64})`;
  });
  /* Strip the fallback url() entries and their format() suffix, leaving only
     the woff2 entry per @font-face src declaration. */
  out = out.replace(/,url\(fonts\/[^)]+\.(woff|ttf)\)\s*format\("[^"]+"\)/g, "");

  return out;
}

let cachedCss: string | null = null;

export function getInlinedKatexCss(): string {
  if (cachedCss === null) {
    cachedCss = loadKatexCss();
  }
  return cachedCss;
}

/* Cheap structural check — matches `$$…$$` blocks and `$…$` inline math. We
   over-include rather than under-include: a false positive ships a heavier
   PDF; a false negative renders math as raw `$x^2$` text in the export. */
export function hasMath(markdown: string): boolean {
  return /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)/.test(markdown);
}
