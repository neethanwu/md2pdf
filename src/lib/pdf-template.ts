import type { DocumentChrome, PageSize, PdfPreset } from "@/lib/document";
import { escapeHtml } from "@/lib/markdown";
import { type CjkScript, getCjkFontsLink } from "@/lib/pdf-cjk";
import { getEmojiFontsLink } from "@/lib/pdf-emoji";
import { getInlinedFontFaceCss } from "@/lib/pdf-fonts";
import { getInlinedKatexCss } from "@/lib/pdf-katex";
import {
  getPdfPresetCss,
  getPdfPresetExtraCss,
  isSerifPreset,
} from "@/lib/pdf-style-tokens";

type TemplateOptions = {
  html: string;
  preset: PdfPreset;
  title: string;
  chrome: DocumentChrome;
  pageSize: PageSize;
  hasMath: boolean;
  cjkScripts: CjkScript[];
  hasEmoji: boolean;
};

/* Escape a string for use as a CSS string literal (inside `content: "..."`). */
function escapeCssString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function formatChromeDate() {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export function buildPdfHtml({
  html,
  preset,
  title,
  chrome,
  pageSize,
  hasMath,
  cjkScripts,
  hasEmoji,
}: TemplateOptions) {
  /* Chrome content via CSS @page margin boxes — Chromium renders these at the
     document's actual scale with full CSS support, unlike puppeteer's headerTemplate
     which lives in a shrunk iframe. */
  const headerTitle = chrome.header ? chrome.title?.trim() || title : "";
  const headerDate = chrome.header && chrome.date ? formatChromeDate() : "";
  const footerNote = chrome.footer ? chrome.footerNote?.trim() || "" : "";
  const showPages = chrome.footer && chrome.pageNumbers;

  const isA4 = pageSize === "A4";
  const margins = {
    top: chrome.header ? (isA4 ? "32mm" : "1.25in") : isA4 ? "22mm" : "0.85in",
    bottom: chrome.footer ? (isA4 ? "34mm" : "1.35in") : isA4 ? "22mm" : "0.85in",
    x: isA4 ? "22mm" : "0.95in",
  };

  /* Chrome typography mirrors the preview: 8.5pt sans (matches preview's
     10.5px when both are scaled to true paper width), preset-aware colors
     via --pdf-muted/--pdf-ink so each preset's character carries through. */
  const headerCss =
    chrome.header && headerTitle
      ? `
    @top-left {
      content: "${escapeCssString(headerTitle)}";
      color: color-mix(in oklch, var(--pdf-ink) 70%, transparent);
      font-family: var(--pdf-body);
      font-size: 8.5pt;
      font-weight: 500;
      letter-spacing: 0.02em;
      vertical-align: bottom;
      padding-bottom: 54pt;
    }`
      : "";

  const headerDateCss =
    chrome.header && headerDate
      ? `
    @top-right {
      content: "${escapeCssString(headerDate)}";
      color: var(--pdf-muted);
      font-family: var(--pdf-body);
      font-size: 8.5pt;
      letter-spacing: 0.02em;
      vertical-align: bottom;
      padding-bottom: 54pt;
    }`
      : "";

  const footerNoteCss = footerNote
    ? `
    @bottom-left {
      content: "${escapeCssString(footerNote)}";
      color: color-mix(in oklch, var(--pdf-ink) 70%, transparent);
      font-family: var(--pdf-body);
      font-size: 8.5pt;
      font-weight: 500;
      letter-spacing: 0.02em;
      vertical-align: top;
      padding-top: 54pt;
    }`
    : "";

  /* Single-region page marker. Chromium's @page rendering doesn't honor
     ::before/::after pseudo-elements on margin boxes, so multi-color
     "PAGE 1 / 2" with separate label vs numbers isn't possible. The
     preview is simplified to match this uniform treatment. */
  const pagesCss = showPages
    ? `
    @bottom-right {
      content: "PAGE " counter(page) " / " counter(pages);
      color: var(--pdf-muted);
      font-family: var(--pdf-body);
      font-size: 7pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-variant-numeric: tabular-nums;
      vertical-align: top;
      padding-top: 54pt;
    }`
    : "";

  /* Link annotation: paper presets surface the destination after each external
     link via attr() in print. The data-print-url attribute is added by the
     markdown pipeline (see annotateExternalLinks in markdown.ts). */
  const showPrintUrls = preset === "editorial" || preset === "academic";
  const linkAnnotationCss = showPrintUrls
    ? `
    a[data-print-url]::after {
      content: " [" attr(data-print-url) "]";
      color: var(--pdf-muted);
      font-size: 0.78em;
      font-weight: 400;
      letter-spacing: 0.01em;
      overflow-wrap: anywhere;
      border-bottom: 0;
    }`
    : "";

  /* KaTeX is heavy (~395KB encoded) so we only emit it when the document
     actually has math. For the typical doc we save both the inline payload
     and the prior CDN round trip. */
  const katexCss = hasMath ? getInlinedKatexCss() : "";

  /* CJK fonts ride on Google Fonts CDN since inlining all four scripts
     × multiple weights would mean tens of MB per export. Only emitted when
     the document actually contains CJK characters — Latin-only docs stay
     fully self-contained. See lib/pdf-cjk.ts for the rationale. */
  const cjkLink = getCjkFontsLink({
    scripts: cjkScripts,
    serif: isSerifPreset(preset),
  });

  /* Emoji font is also CDN-loaded — Noto Color Emoji is ~4MB across nine
     unicode-range chunks, and Latin-only docs would pay that cost for nothing.
     Conditional gates keeps emoji-free exports fully self-contained. See
     lib/pdf-emoji.ts. */
  const emojiLink = getEmojiFontsLink(hasEmoji);

  /* Serif presets pair Source Serif 4 (x-height ratio ~0.50) with Noto Serif
     CJK families (~0.55 by default). Without normalization, Chinese paragraphs
     read ~10% taller than the surrounding English. font-size-adjust forces
     all fonts in the stack to render with a uniform x-height ratio so cross-
     script lines sit on the same visual baseline. Sans presets are paired
     with fonts of similar natural ratio so we leave them alone. */
  const serifSizeAdjust = isSerifPreset(preset) ? "font-size-adjust: 0.5;" : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  ${cjkLink}
  ${emojiLink}
  <style>
    /* Fonts inlined as base64 data URIs — see lib/pdf-fonts.ts. Identical
       bytes between browser preview (next/font/google self-hosted) and PDF
       lambda, no runtime CDN dependency, no silent Google Fonts fallback. */
    ${getInlinedFontFaceCss()}
    ${katexCss}

    @page {
      size: ${pageSize};
      margin: ${margins.top} ${margins.x} ${margins.bottom} ${margins.x};${headerCss}${headerDateCss}${footerNoteCss}${pagesCss}
    }
    :root { ${getPdfPresetCss(preset)} }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: var(--pdf-ink);
      font-family: var(--pdf-body);
      font-size: calc(var(--pdf-body-size-pt, 11.5) * 1pt);
      line-height: var(--pdf-line);
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      ${serifSizeAdjust}
    }
    main {
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4 {
      color: var(--pdf-ink);
      font-family: var(--pdf-heading);
      line-height: 1.14;
      page-break-after: avoid;
    }
    h1 {
      margin: 0 0 calc(var(--pdf-h1-mb-pt, 22) * 1pt);
      font-size: calc(var(--pdf-h1-size-pt, 30) * 1pt);
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    h2 {
      margin: calc(var(--pdf-h2-mt-pt, 32) * 1pt) 0 calc(var(--pdf-h2-mb-pt, 10) * 1pt);
      padding-top: calc(var(--pdf-h2-pt-pt, 14) * 1pt);
      border-top: 0.5pt solid var(--pdf-rule);
      font-size: calc(var(--pdf-h2-size-pt, 17) * 1pt);
      font-weight: 650;
      letter-spacing: -0.005em;
    }
    h2:first-child,
    h1 + h2 {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
    h3 {
      margin: calc(var(--pdf-h3-mt-pt, 22) * 1pt) 0 calc(var(--pdf-h3-mb-pt, 6) * 1pt);
      font-size: calc(var(--pdf-h3-size-pt, 13) * 1pt);
      font-weight: 700;
    }
    p, ul, ol, blockquote, table, pre { margin: 0 0 calc(var(--pdf-block-mb-pt, 12) * 1pt); }
    p, li { color: var(--pdf-ink); }
    ul, ol { padding-left: calc(var(--pdf-list-pl-pt, 20) * 1pt); }
    li + li { margin-top: calc(var(--pdf-li-mt-pt, 3) * 1pt); }
    a {
      color: var(--pdf-accent);
      text-decoration: none;
      border-bottom: 0.6pt solid color-mix(in oklch, var(--pdf-accent) 30%, transparent);
    }
    blockquote {
      margin: calc(var(--pdf-blockquote-my-pt, 16) * 1pt) 0;
      padding: calc(var(--pdf-blockquote-py-pt, 9) * 1pt) calc(var(--pdf-blockquote-px-pt, 14) * 1pt);
      border-left: 2pt solid var(--pdf-accent);
      background: color-mix(in oklch, var(--pdf-accent-soft) 60%, transparent);
      color: var(--pdf-muted);
      border-radius: 0 4px 4px 0;
    }
    /* Strip the bottom margin of the blockquote's last child (typically <p>)
       so it doesn't add a visible empty line on top of the blockquote's
       padding-bottom — matches the preview's .md-preview blockquote > :last-child rule. */
    blockquote > :last-child {
      margin-bottom: 0;
    }
    code {
      border-radius: 4px;
      background: var(--pdf-accent-soft);
      color: var(--pdf-ink);
      font-family: var(--pdf-mono);
      font-size: 0.86em;
      padding: 0.1em 0.32em;
    }
    pre {
      overflow: hidden;
      border-radius: calc(var(--pdf-pre-radius-pt, 6) * 1pt);
      background: oklch(0.18 0.018 250);
      color: oklch(0.95 0.008 250);
      padding: calc(var(--pdf-pre-py-pt, 12) * 1pt) calc(var(--pdf-pre-px-pt, 14) * 1pt) calc(var(--pdf-pre-pb-pt, 12) * 1pt);
      page-break-inside: avoid;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      font-size: calc(var(--pdf-pre-code-size-pt, 9.5) * 1pt);
      line-height: 1.62;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      font-size: calc(var(--pdf-table-size-pt, 10.2) * 1pt);
    }
    th { color: var(--pdf-ink); font-weight: 700; text-align: left; }
    th, td {
      border-bottom: 1px solid var(--pdf-rule);
      padding: calc(var(--pdf-cell-py-pt, 7) * 1pt) calc(var(--pdf-cell-px-pt, 8) * 1pt) calc(var(--pdf-cell-py-pt, 7) * 1pt) 0;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: color-mix(in oklch, var(--pdf-accent-soft) 45%, transparent); }
    /* Images and figures — atomic units that don't break across pages.
       Standalone <img> nodes (e.g., from inline image tokens) inherit the
       same treatment so an unwrapped image still feels like a figure. */
    img { max-width: 100%; height: auto; border-radius: 3px; display: block; margin: 0 auto; }
    figure {
      margin: calc(var(--pdf-figure-my-pt, 18) * 1pt) auto;
      padding: 0;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }
    figure img { margin: 0 auto; }
    figcaption {
      font-size: calc(var(--pdf-caption-size-pt, 9.5) * 1pt);
      color: var(--pdf-muted);
      font-style: italic;
      margin-top: calc(var(--pdf-caption-mt-pt, 6) * 1pt);
      line-height: 1.45;
      max-width: 56ch;
      margin-left: auto;
      margin-right: auto;
    }
    /* Broken image fallback — calm, in-flow, never a missing-glyph icon. */
    .md-image-broken {
      display: inline-block;
      padding: 4pt 8pt;
      border: 1px dashed var(--pdf-rule);
      color: var(--pdf-muted);
      font-style: italic;
      font-size: 0.92em;
      border-radius: 2pt;
    }

    /* Math display — center on the measure with breath above and below. */
    .katex-display {
      margin: calc(var(--pdf-math-my-pt, 14) * 1pt) 0;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow-x: auto;
    }
    .katex {
      color: var(--pdf-ink);
      font-size: 1.04em;
    }
    .katex-display > .katex { font-size: 1.12em; }

    /* Mermaid wrapper — paper-aligned, atomic, with academic-only rule frames. */
    .md-mermaid {
      margin: calc(var(--pdf-mermaid-my-pt, 18) * 1pt) auto;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
      max-width: 100%;
    }
    .md-mermaid svg {
      display: inline-block;
      max-width: 100%;
      height: auto;
    }
    .md-mermaid-error {
      text-align: left;
    }
    .md-mermaid-error pre {
      margin-bottom: 4pt;
    }
    .md-mermaid-error-note {
      font-style: italic;
      color: var(--pdf-muted);
      font-size: 0.92em;
      margin: 0;
    }

    hr { height: 1px; margin: 24pt 0; border: 0; background: var(--pdf-rule); }
    input[type="checkbox"] { margin-right: 6pt; transform: translateY(1px); }
    ${linkAnnotationCss}
    ${getPdfPresetExtraCss(preset)}
  </style>
</head>
<body>
  <main>${html}</main>
</body>
</html>`;
}

/* Chrome (header/footer) is now rendered via CSS @page margin boxes inside
   buildPdfHtml. puppeteer's headerTemplate/footerTemplate are no longer used. */
