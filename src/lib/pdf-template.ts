import type { DocumentChrome, PageSize, PdfPreset } from "@/lib/document";
import { escapeHtml } from "@/lib/markdown";

type TemplateOptions = {
  html: string;
  preset: PdfPreset;
  title: string;
};

const presetCss: Record<PdfPreset, string> = {
  editorial: `
    --pdf-accent: oklch(0.45 0.08 60);
    --pdf-accent-soft: oklch(0.96 0.014 65);
    --pdf-ink: oklch(0.18 0.022 65);
    --pdf-muted: oklch(0.46 0.025 65);
    --pdf-rule: oklch(0.86 0.014 65);
    --pdf-paper: oklch(0.998 0.003 80);
    --pdf-heading: "Iowan Old Style", "Charter", "Palatino", Georgia, serif;
    --pdf-body: "Inter", "Avenir Next", "SF Pro Text", system-ui, sans-serif;
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
    --pdf-paper: oklch(0.995 0.005 248);
    --pdf-heading: "Inter", "Aptos", "Segoe UI", system-ui, sans-serif;
    --pdf-body: "Inter", "Aptos", "Segoe UI", system-ui, sans-serif;
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
    --pdf-paper: oklch(0.997 0.004 158);
    --pdf-heading: "Inter", "Avenir Next", "Segoe UI", system-ui, sans-serif;
    --pdf-body: "Inter", "Avenir Next", "Segoe UI", system-ui, sans-serif;
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
    --pdf-paper: oklch(0.998 0.003 30);
    --pdf-heading: "Libertinus Serif", "Iowan Old Style", "Charter", Georgia, serif;
    --pdf-body: "Libertinus Serif", "Iowan Old Style", "Charter", Georgia, serif;
    --pdf-mono: "SFMono-Regular", "JetBrains Mono", Consolas, monospace;
    --pdf-line: 1.78;
    --pdf-measure: 66ch;
  `,
};

const presetExtraCss: Record<PdfPreset, string> = {
  editorial: `
    h1 { font-weight: 600; }
    h2 { margin-top: 36pt; padding-top: 14pt; }
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
      border-radius: 3pt;
    }
    th {
      background: color-mix(in oklch, var(--pdf-accent) 8%, transparent);
      color: var(--pdf-ink);
      padding: 9pt 12pt;
      font-size: 0.82em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      border-bottom: 1px solid var(--pdf-rule);
    }
    td {
      padding: 9pt 12pt;
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
  `,
};

export function buildPdfHtml({ html, preset, title }: TemplateOptions) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 0; }
    :root { ${presetCss[preset]} }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--pdf-paper);
      color: var(--pdf-ink);
      font-family: var(--pdf-body);
      font-size: 11.5pt;
      line-height: var(--pdf-line);
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
    }
    main {
      max-width: var(--pdf-measure);
      margin: 0 auto;
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
      margin: 30pt 0 8pt;
      padding-top: 5pt;
      border-top: 1px solid var(--pdf-rule);
      font-size: 17pt;
      font-weight: 650;
      letter-spacing: -0.005em;
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
    img { max-width: 100%; height: auto; border-radius: 4px; }
    hr { height: 1px; margin: 24pt 0; border: 0; background: var(--pdf-rule); }
    input[type="checkbox"] { margin-right: 6pt; transform: translateY(1px); }
    ${presetExtraCss[preset]}
  </style>
</head>
<body>
  <main>${html}</main>
</body>
</html>`;
}

export function getPdfMargins(chrome: DocumentChrome, pageSize: PageSize) {
  const horizontal = pageSize === "A4" ? "18mm" : "0.72in";
  const isA4 = pageSize === "A4";

  const top = chrome.header ? (isA4 ? "26mm" : "1in") : isA4 ? "21mm" : "0.82in";

  const bottom = chrome.footer ? (isA4 ? "27mm" : "1.04in") : isA4 ? "22mm" : "0.86in";

  return { top, right: horizontal, bottom, left: horizontal };
}

const chromeStyle = `width:100%; padding:0 0.72in; font-family:Inter, "SF Pro Text", system-ui, sans-serif; font-size:8px; color:#76716a; display:flex; justify-content:space-between; align-items:center; letter-spacing:0.02em;`;

export function buildHeaderTemplate(chrome: DocumentChrome, title: string) {
  if (!chrome.header) {
    return "<span></span>";
  }

  const date = chrome.date
    ? `<span>${escapeHtml(
        new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date()),
      )}</span>`
    : "<span></span>";

  return `<div style="${chromeStyle}">
    <span style="font-weight:500;">${escapeHtml(chrome.title?.trim() || title)}</span>
    ${date}
  </div>`;
}

export function buildFooterTemplate(chrome: DocumentChrome) {
  if (!chrome.footer) {
    return "<span></span>";
  }

  const note = chrome.footerNote?.trim()
    ? `<span>${escapeHtml(chrome.footerNote.trim())}</span>`
    : "<span></span>";

  const pages = chrome.pageNumbers
    ? `<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`
    : "<span></span>";

  return `<div style="${chromeStyle}">
    ${note}
    ${pages}
  </div>`;
}
