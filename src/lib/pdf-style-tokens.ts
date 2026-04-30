import type { PdfPreset } from "@/lib/document";
import { CJK_MONO_STACK, CJK_SANS_STACK, CJK_SERIF_STACK } from "@/lib/pdf-cjk";

type FontKind = "sans" | "serif";

type PresetTokens = {
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  rule: string;
  heading: FontKind;
  body: FontKind;
  line: number;
  measure: string;
  spacing: Partial<Record<SpacingToken, number>>;
};

type SpacingToken =
  | "bodySize"
  | "h1Size"
  | "h1Mb"
  | "h2Mt"
  | "h2Mb"
  | "h2Pt"
  | "h2Size"
  | "h3Mt"
  | "h3Mb"
  | "h3Size"
  | "blockMb"
  | "listPl"
  | "liMt"
  | "blockquoteMy"
  | "blockquotePy"
  | "blockquotePx"
  | "prePy"
  | "prePx"
  | "prePb"
  | "preRadius"
  | "preCodeSize"
  | "tableSize"
  | "cellPy"
  | "cellPx"
  | "figureMy"
  | "figurePy"
  | "figurePb"
  | "captionSize"
  | "captionMt"
  | "mathMy"
  | "mermaidMy";

const BASE_SPACING: Record<SpacingToken, number> = {
  bodySize: 11.5,
  h1Size: 30,
  h1Mb: 22,
  h2Mt: 32,
  h2Mb: 10,
  h2Pt: 14,
  h2Size: 17,
  h3Mt: 22,
  h3Mb: 6,
  h3Size: 13,
  blockMb: 12,
  listPl: 20,
  liMt: 3,
  blockquoteMy: 16,
  blockquotePy: 9,
  blockquotePx: 14,
  prePy: 12,
  prePx: 14,
  prePb: 12,
  preRadius: 6,
  preCodeSize: 9.5,
  tableSize: 10.2,
  cellPy: 7,
  cellPx: 8,
  figureMy: 18,
  figurePy: 0,
  figurePb: 0,
  captionSize: 9.5,
  captionMt: 6,
  mathMy: 14,
  mermaidMy: 18,
};

export const PDF_PRESET_TOKENS: Record<PdfPreset, PresetTokens> = {
  editorial: {
    accent: "oklch(0.45 0.08 60)",
    accentSoft: "oklch(0.96 0.014 65)",
    ink: "oklch(0.18 0.022 65)",
    muted: "oklch(0.46 0.025 65)",
    rule: "oklch(0.86 0.014 65)",
    heading: "serif",
    body: "sans",
    line: 1.7,
    measure: "64ch",
    spacing: {
      h1Mb: 26,
      h2Mt: 48,
      h2Pt: 18,
      blockquoteMy: 18,
      blockquotePy: 6,
      blockquotePx: 18,
    },
  },
  technical: {
    accent: "oklch(0.48 0.13 245)",
    accentSoft: "oklch(0.95 0.022 245)",
    ink: "oklch(0.16 0.018 250)",
    muted: "oklch(0.45 0.024 250)",
    rule: "oklch(0.84 0.018 250)",
    heading: "sans",
    body: "sans",
    line: 1.55,
    measure: "72ch",
    spacing: {
      h1Size: 26,
      h1Mb: 4,
      h2Mt: 26,
      h2Mb: 8,
      h2Pt: 0,
      h2Size: 14,
      h3Size: 9,
      listPl: 18,
      blockquotePy: 10,
      blockquotePx: 14,
      prePy: 14,
      prePb: 12,
      tableSize: 9.89,
      cellPy: 6,
      cellPx: 10,
    },
  },
  business: {
    accent: "oklch(0.4 0.09 158)",
    accentSoft: "oklch(0.95 0.018 158)",
    ink: "oklch(0.17 0.018 158)",
    muted: "oklch(0.45 0.022 158)",
    rule: "oklch(0.85 0.014 158)",
    heading: "sans",
    body: "sans",
    line: 1.62,
    measure: "68ch",
    spacing: {
      h1Size: 32,
      h1Mb: 6,
      h2Mt: 32,
      h2Mb: 11,
      h2Pt: 0,
      h2Size: 16,
      h3Mt: 20,
      h3Mb: 5,
      h3Size: 12,
      blockquotePy: 14,
      blockquotePx: 18,
      cellPy: 8,
      cellPx: 11,
    },
  },
  academic: {
    accent: "oklch(0.46 0.12 30)",
    accentSoft: "oklch(0.96 0.018 30)",
    ink: "oklch(0.18 0.018 30)",
    muted: "oklch(0.42 0.02 30)",
    rule: "oklch(0.84 0.014 30)",
    heading: "serif",
    body: "serif",
    line: 1.78,
    measure: "66ch",
    spacing: {
      h2Mt: 28,
      h2Mb: 10,
      h2Pt: 0,
      h2Size: 14,
      h3Size: 12.5,
      blockquotePy: 14,
      blockquotePx: 22,
      figurePy: 12,
      figurePb: 10,
    },
  },
};

const PREVIEW_FONT_STACKS = {
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
} as const;

const PDF_FONT_STACKS = {
  sans: `"Hanken Grotesk Variable", ${CJK_SANS_STACK}, "Avenir Next", "SF Pro Text", system-ui, sans-serif`,
  technicalSans: `"Hanken Grotesk Variable", ${CJK_SANS_STACK}, "Aptos", "Segoe UI", system-ui, sans-serif`,
  serif: `"Source Serif 4 Variable", ${CJK_SERIF_STACK}, "Iowan Old Style", "Charter", Georgia, serif`,
  mono: `"SFMono-Regular", "JetBrains Mono", Consolas, ${CJK_MONO_STACK}, monospace`,
} as const;

function spacingForPreset(preset: PdfPreset) {
  return { ...BASE_SPACING, ...PDF_PRESET_TOKENS[preset].spacing };
}

function cssVarName(token: SpacingToken) {
  return `--pdf-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-pt`;
}

function ptVar(token: SpacingToken, fallback: number) {
  return `calc(var(${cssVarName(token)}, ${fallback}) * 1pt)`;
}

function pdfStack(preset: PdfPreset, kind: FontKind) {
  if (kind === "serif") return PDF_FONT_STACKS.serif;
  return preset === "technical" ? PDF_FONT_STACKS.technicalSans : PDF_FONT_STACKS.sans;
}

export function isSerifPreset(preset: PdfPreset) {
  const tokens = PDF_PRESET_TOKENS[preset];
  return tokens.heading === "serif" || tokens.body === "serif";
}

export function getPreviewPresetStyle(
  preset: PdfPreset,
): Record<string, string | number> {
  const tokens = PDF_PRESET_TOKENS[preset];
  const spacing = spacingForPreset(preset);
  const style: Record<string, string | number> = {
    "--pdf-accent": tokens.accent,
    "--pdf-accent-soft": tokens.accentSoft,
    "--pdf-ink": tokens.ink,
    "--pdf-muted": tokens.muted,
    "--pdf-rule": tokens.rule,
    "--pdf-heading": PREVIEW_FONT_STACKS[tokens.heading],
    "--pdf-body": PREVIEW_FONT_STACKS[tokens.body],
    "--pdf-mono": PREVIEW_FONT_STACKS.mono,
    "--pdf-line": tokens.line,
    "--pdf-measure": tokens.measure,
  };

  for (const [key, value] of Object.entries(spacing)) {
    style[cssVarName(key as SpacingToken)] = String(value);
  }

  if (isSerifPreset(preset)) {
    style.fontSizeAdjust = "0.5";
  }

  return style;
}

export function getPdfPresetCss(preset: PdfPreset) {
  const tokens = PDF_PRESET_TOKENS[preset];
  const spacing = spacingForPreset(preset);
  const spacingVars = Object.entries(spacing)
    .map(
      ([key, value]) =>
        `--pdf-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-pt: ${value};`,
    )
    .join("\n    ");

  return `
    --pdf-accent: ${tokens.accent};
    --pdf-accent-soft: ${tokens.accentSoft};
    --pdf-ink: ${tokens.ink};
    --pdf-muted: ${tokens.muted};
    --pdf-rule: ${tokens.rule};
    --pdf-heading: ${pdfStack(preset, tokens.heading)};
    --pdf-body: ${pdfStack(preset, tokens.body)};
    --pdf-mono: ${PDF_FONT_STACKS.mono};
    --pdf-line: ${tokens.line};
    --pdf-measure: ${tokens.measure};
    ${spacingVars}
  `;
}

export function getPdfPresetExtraCss(preset: PdfPreset) {
  switch (preset) {
    case "editorial":
      return `
    h1 { font-weight: 600; margin-bottom: ${ptVar("h1Mb", 26)}; }
    h2 { margin-top: ${ptVar("h2Mt", 48)}; padding-top: ${ptVar("h2Pt", 18)}; }
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
      padding: ${ptVar("blockquotePy", 6)} 0 ${ptVar("blockquotePy", 6)} ${ptVar("blockquotePx", 18)};
      margin: ${ptVar("blockquoteMy", 18)} 0;
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
  `;
    case "technical":
      return `
    h1 {
      font-weight: 700;
      letter-spacing: -0.022em;
      font-size: ${ptVar("h1Size", 26)};
      margin: 0 0 ${ptVar("h1Mb", 4)};
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
      margin: ${ptVar("h2Mt", 26)} 0 ${ptVar("h2Mb", 8)};
      font-size: ${ptVar("h2Size", 14)};
    }
    h3 {
      color: var(--pdf-accent);
      font-size: ${ptVar("h3Size", 9)};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    pre {
      background: oklch(0.16 0.02 248);
      border: 0;
      border-radius: ${ptVar("preRadius", 6)};
      padding: ${ptVar("prePy", 14)} ${ptVar("prePx", 14)} ${ptVar("prePb", 12)};
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
      padding: ${ptVar("cellPy", 6)} ${ptVar("cellPx", 10)} ${ptVar("cellPy", 6)} 0;
      text-transform: uppercase;
      font-size: 0.86em;
      letter-spacing: 0.06em;
      color: var(--pdf-muted);
    }
    td { padding: ${ptVar("cellPy", 6)} ${ptVar("cellPx", 10)} ${ptVar("cellPy", 6)} 0; }
    tr:nth-child(even) td {
      background: color-mix(in oklch, var(--pdf-accent) 6%, transparent);
    }
    hr { background: var(--pdf-accent); opacity: 0.5; }
    ul { list-style: none; padding-left: ${ptVar("listPl", 18)}; }
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
      padding: ${ptVar("blockquotePy", 10)} ${ptVar("blockquotePx", 14)};
      color: var(--pdf-ink);
    }
  `;
    case "business":
      return `
    body { counter-reset: section; }
    h1 {
      font-weight: 700;
      letter-spacing: -0.03em;
      font-size: ${ptVar("h1Size", 32)};
      margin: 0 0 ${ptVar("h1Mb", 6)};
    }
    h1 + p {
      color: var(--pdf-muted);
      padding-bottom: 16pt;
      border-bottom: 1px solid var(--pdf-rule);
      margin-bottom: 26pt;
    }
    h2 {
      counter-increment: section;
      margin: ${ptVar("h2Mt", 32)} 0 ${ptVar("h2Mb", 11)};
      padding: 0;
      border-top: 0;
      font-size: ${ptVar("h2Size", 16)};
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
      font-size: ${ptVar("h3Size", 12)};
      margin: ${ptVar("h3Mt", 20)} 0 ${ptVar("h3Mb", 5)};
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
      padding: ${ptVar("blockquotePy", 14)} ${ptVar("blockquotePx", 18)};
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
      padding: ${ptVar("cellPy", 8)} ${ptVar("cellPx", 11)};
      font-size: 0.82em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      border-bottom: 1px solid var(--pdf-rule);
    }
    td {
      padding: ${ptVar("cellPy", 8)} ${ptVar("cellPx", 11)};
      border-bottom: 1px solid var(--pdf-rule);
    }
    tr:last-child td { border-bottom: 0; }
    td + td, th + th { border-left: 1px solid var(--pdf-rule); }
  `;
    case "academic":
      return `
    h1 { text-align: center; font-weight: 600; letter-spacing: 0; }
    h2 {
      border-top: 0;
      text-align: center;
      font-style: italic;
      font-weight: 600;
      margin: ${ptVar("h2Mt", 28)} 0 ${ptVar("h2Mb", 10)};
      padding-top: 0;
      font-size: ${ptVar("h2Size", 14)};
    }
    h3 { font-size: ${ptVar("h3Size", 12.5)}; font-weight: 700; }
    p + p { text-indent: 1.4em; margin-top: 0; }
    blockquote {
      border-left: 0;
      border-top: 1px solid var(--pdf-rule);
      border-bottom: 1px solid var(--pdf-rule);
      padding: ${ptVar("blockquotePy", 14)} ${ptVar("blockquotePx", 22)};
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
    figure, .md-mermaid {
      border-top: 0.5pt solid var(--pdf-rule);
      border-bottom: 0.5pt solid var(--pdf-rule);
      padding: ${ptVar("figurePy", 12)} 0 ${ptVar("figurePb", 10)};
    }
  `;
  }
}
