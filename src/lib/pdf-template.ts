import type { DocumentChrome, PageSize, PdfPreset } from "@/lib/document";
import { escapeHtml } from "@/lib/markdown";

type TemplateOptions = {
  html: string;
  preset: PdfPreset;
  title: string;
  chrome: DocumentChrome;
  pageSize: PageSize;
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

const presetCss: Record<PdfPreset, string> = {
  editorial: `
    --pdf-accent: oklch(0.45 0.08 60);
    --pdf-accent-soft: oklch(0.96 0.014 65);
    --pdf-ink: oklch(0.18 0.022 65);
    --pdf-muted: oklch(0.46 0.025 65);
    --pdf-rule: oklch(0.86 0.014 65);
    --pdf-heading: "Iowan Old Style", "Charter", "Palatino", Georgia, serif;
    --pdf-body: "Hanken Grotesk", "Avenir Next", "SF Pro Text", system-ui, sans-serif;
    --pdf-mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
    --pdf-line: 1.7;
    --pdf-measure: 64ch;
  `,
  technical: `
    --pdf-accent: oklch(0.48 0.13 245);
    --pdf-accent-soft: oklch(0.95 0.022 245);
    --pdf-ink: oklch(0.16 0.018 250);
    --pdf-muted: oklch(0.45 0.024 250);
    --pdf-rule: oklch(0.84 0.018 250);
    --pdf-heading: "Hanken Grotesk", "Aptos", "Segoe UI", system-ui, sans-serif;
    --pdf-body: "Hanken Grotesk", "Aptos", "Segoe UI", system-ui, sans-serif;
    --pdf-mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
    --pdf-line: 1.55;
    --pdf-measure: 72ch;
  `,
  business: `
    --pdf-accent: oklch(0.4 0.09 158);
    --pdf-accent-soft: oklch(0.95 0.018 158);
    --pdf-ink: oklch(0.17 0.018 158);
    --pdf-muted: oklch(0.45 0.022 158);
    --pdf-rule: oklch(0.85 0.014 158);
    --pdf-heading: "Hanken Grotesk", "Avenir Next", "Segoe UI", system-ui, sans-serif;
    --pdf-body: "Hanken Grotesk", "Avenir Next", "Segoe UI", system-ui, sans-serif;
    --pdf-mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
    --pdf-line: 1.62;
    --pdf-measure: 68ch;
  `,
  academic: `
    --pdf-accent: oklch(0.46 0.12 30);
    --pdf-accent-soft: oklch(0.96 0.018 30);
    --pdf-ink: oklch(0.18 0.018 30);
    --pdf-muted: oklch(0.42 0.02 30);
    --pdf-rule: oklch(0.84 0.014 30);
    --pdf-heading: "Libertinus Serif", "Iowan Old Style", "Charter", Georgia, serif;
    --pdf-body: "Libertinus Serif", "Iowan Old Style", "Charter", Georgia, serif;
    --pdf-mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
    --pdf-line: 1.78;
    --pdf-measure: 66ch;
  `,
};

const presetExtraCss: Record<PdfPreset, string> = {
  editorial: `
    h1 { font-weight: 600; margin-bottom: 26pt; }
    h2 { margin-top: 48pt; padding-top: 18pt; }
    h3 { font-style: italic; font-weight: 600; }
    ul { list-style: none; padding-left: 0; }
    ul > li { padding-left: 14pt; position: relative; }
    ul > li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.78em;
      width: 5pt;
      height: 1px;
      background: var(--pdf-muted);
    }
    blockquote {
      background: transparent;
      border-left: 2pt solid var(--pdf-accent);
      padding: 6pt 0 6pt 18pt;
      margin: 18pt 0;
      border-radius: 0;
      font-style: italic;
      color: var(--pdf-ink);
    }
    table th {
      text-transform: uppercase;
      font-size: 0.78em;
      letter-spacing: 0.06em;
      font-weight: 600;
      color: var(--pdf-muted);
      border-bottom: 1px solid var(--pdf-ink);
      padding-bottom: 6pt;
    }
  `,
  technical: `
    h1 {
      font-weight: 700;
      letter-spacing: -0.022em;
      font-size: 26pt;
      margin: 0 0 4pt;
    }
    h1 + p {
      color: var(--pdf-muted);
      font-size: 0.96em;
      padding-bottom: 14pt;
      margin-bottom: 22pt;
      border-bottom: 1px solid var(--pdf-rule);
    }
    h2 {
      border-top: 0;
      border-left: 2pt solid var(--pdf-accent);
      padding: 0 0 0 11pt;
      margin: 26pt 0 8pt;
      font-size: 14pt;
    }
    h3 {
      color: var(--pdf-accent);
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    pre {
      background: oklch(0.16 0.02 248);
      border: 0;
      border-radius: 6pt;
      padding: 14pt 14pt 12pt;
    }
    code {
      background: color-mix(in oklch, var(--pdf-accent) 14%, transparent);
      color: var(--pdf-accent);
      font-weight: 500;
    }
    pre code {
      background: transparent;
      color: oklch(0.95 0.008 250);
      font-weight: 400;
    }
    table {
      font-variant-numeric: tabular-nums;
      font-size: 0.86em;
    }
    th {
      border-bottom: 2pt solid var(--pdf-accent);
      padding: 6pt 10pt 6pt 0;
      text-transform: uppercase;
      font-size: 0.86em;
      letter-spacing: 0.06em;
      color: var(--pdf-muted);
    }
    td { padding: 6pt 10pt 6pt 0; }
    tr:nth-child(even) td {
      background: color-mix(in oklch, var(--pdf-accent) 6%, transparent);
    }
    hr { background: var(--pdf-accent); opacity: 0.5; }
    ul { list-style: none; padding-left: 18pt; }
    ul > li { position: relative; }
    ul > li::before {
      content: "›";
      position: absolute;
      left: -12pt;
      top: 0;
      color: var(--pdf-accent);
      font-weight: 700;
    }
    blockquote {
      background: color-mix(in oklch, var(--pdf-accent) 6%, transparent);
      border-left: 2pt solid var(--pdf-accent);
      border-radius: 0 4pt 4pt 0;
      padding: 10pt 14pt;
      color: var(--pdf-ink);
    }
  `,
  business: `
    body { counter-reset: section; }
    h1 {
      font-weight: 700;
      letter-spacing: -0.03em;
      font-size: 32pt;
      margin: 0 0 6pt;
    }
    h1 + p {
      color: var(--pdf-muted);
      padding-bottom: 16pt;
      border-bottom: 1px solid var(--pdf-rule);
      margin-bottom: 26pt;
    }
    h2 {
      counter-increment: section;
      margin: 32pt 0 11pt;
      padding: 0;
      border-top: 0;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: -0.012em;
      display: flex;
      align-items: baseline;
      gap: 11pt;
    }
    h2::before {
      content: counter(section, decimal-leading-zero);
      flex: none;
      color: var(--pdf-accent);
      font-weight: 600;
      font-size: 0.78em;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
    }
    h3 {
      font-weight: 700;
      color: var(--pdf-ink);
      font-size: 12pt;
      margin: 20pt 0 5pt;
      padding-left: 11pt;
      position: relative;
    }
    h3::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.42em;
      width: 5pt;
      height: 5pt;
      background: var(--pdf-accent);
      border-radius: 1px;
    }
    ol > li::marker { color: var(--pdf-accent); font-weight: 700; }
    ul > li::marker { color: var(--pdf-accent); }
    blockquote {
      background: color-mix(in oklch, var(--pdf-accent) 5%, transparent);
      border-left: 3pt solid var(--pdf-accent);
      border-radius: 0 4pt 4pt 0;
      color: var(--pdf-ink);
      padding: 14pt 18pt;
      font-weight: 500;
    }
    table {
      border: 1px solid var(--pdf-rule);
      border-radius: 4pt;
      overflow: hidden; /* clips zebra/header backgrounds against the rounded outer border, matches preview */
    }
    th {
      background: color-mix(in oklch, var(--pdf-accent) 8%, transparent);
      color: var(--pdf-ink);
      padding: 8pt 11pt;
      font-size: 0.82em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      border-bottom: 1px solid var(--pdf-rule);
    }
    td {
      padding: 8pt 11pt;
      border-bottom: 1px solid var(--pdf-rule);
    }
    tr:last-child td { border-bottom: 0; }
    td + td, th + th { border-left: 1px solid var(--pdf-rule); }
  `,
  academic: `
    h1 { text-align: center; font-weight: 600; letter-spacing: 0; }
    h2 {
      border-top: 0;
      text-align: center;
      font-style: italic;
      font-weight: 600;
      margin: 28pt 0 10pt;
      padding-top: 0;
      font-size: 14pt;
    }
    h3 { font-size: 12.5pt; font-weight: 700; }
    p + p { text-indent: 1.4em; margin-top: 0; }
    blockquote {
      border-left: 0;
      border-top: 1px solid var(--pdf-rule);
      border-bottom: 1px solid var(--pdf-rule);
      padding: 14pt 22pt;
      background: transparent;
      border-radius: 0;
      text-align: justify;
      font-style: italic;
    }
    hr {
      height: 0;
      border: 0;
      margin: 24pt auto;
      width: 50pt;
      border-top: 1px solid var(--pdf-rule);
      background: transparent;
    }
    table th {
      border-top: 2pt solid var(--pdf-ink);
      border-bottom: 1px solid var(--pdf-ink);
      padding: 7pt 10pt 7pt 0;
    }
    table tr:last-child td { border-bottom: 2pt solid var(--pdf-ink); }
    /* Academic figures take a journal-style rule above and below — signals
       "this is a figure" without a heavy box. */
    figure, .md-mermaid {
      border-top: 0.5pt solid var(--pdf-rule);
      border-bottom: 0.5pt solid var(--pdf-rule);
      padding: 12pt 0 10pt;
    }
  `,
};

export function buildPdfHtml({ html, preset, title, chrome, pageSize }: TemplateOptions) {
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;650;700&display=swap"
    rel="stylesheet"
  />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
    integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+"
    crossorigin="anonymous"
  />
  <style>
    @page {
      size: ${pageSize};
      margin: ${margins.top} ${margins.x} ${margins.bottom} ${margins.x};${headerCss}${headerDateCss}${footerNoteCss}${pagesCss}
    }
    :root { ${presetCss[preset]} }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: var(--pdf-ink);
      font-family: var(--pdf-body);
      font-size: 11.5pt;
      line-height: var(--pdf-line);
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
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
      margin: 0 0 22pt;
      font-size: 30pt;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    h2 {
      margin: 32pt 0 10pt;
      padding-top: 14pt;
      border-top: 0.5pt solid var(--pdf-rule);
      font-size: 17pt;
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
      margin: 22pt 0 6pt;
      font-size: 13pt;
      font-weight: 700;
    }
    p, ul, ol, blockquote, table, pre { margin: 0 0 12pt; }
    p, li { color: var(--pdf-ink); }
    ul, ol { padding-left: 20pt; }
    li + li { margin-top: 3pt; }
    a {
      color: var(--pdf-accent);
      text-decoration: none;
      border-bottom: 0.6pt solid color-mix(in oklch, var(--pdf-accent) 30%, transparent);
    }
    blockquote {
      margin: 16pt 0;
      padding: 9pt 14pt;
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
      border-radius: 6px;
      background: oklch(0.18 0.018 250);
      color: oklch(0.95 0.008 250);
      padding: 12pt 14pt;
      page-break-inside: avoid;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      font-size: 9.5pt;
      line-height: 1.62;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      font-size: 10.2pt;
    }
    th { color: var(--pdf-ink); font-weight: 700; text-align: left; }
    th, td {
      border-bottom: 1px solid var(--pdf-rule);
      padding: 7pt 8pt 7pt 0;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: color-mix(in oklch, var(--pdf-accent-soft) 45%, transparent); }
    /* Images and figures — atomic units that don't break across pages.
       Standalone <img> nodes (e.g., from inline image tokens) inherit the
       same treatment so an unwrapped image still feels like a figure. */
    img { max-width: 100%; height: auto; border-radius: 3px; display: block; margin: 0 auto; }
    figure {
      margin: 18pt auto;
      padding: 0;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }
    figure img { margin: 0 auto; }
    figcaption {
      font-size: 9.5pt;
      color: var(--pdf-muted);
      font-style: italic;
      margin-top: 6pt;
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
      margin: 14pt 0;
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
      margin: 18pt auto;
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
    ${presetExtraCss[preset]}
  </style>
</head>
<body>
  <main>${html}</main>
</body>
</html>`;
}

/* Chrome (header/footer) is now rendered via CSS @page margin boxes inside
   buildPdfHtml. puppeteer's headerTemplate/footerTemplate are no longer used. */
