export type PdfPreset = "editorial" | "technical" | "business" | "academic";

export type PageSize = "Letter" | "A4";

export type DocumentChrome = {
  header: boolean;
  footer: boolean;
  title?: string;
  date?: boolean;
  pageNumbers?: boolean;
  footerNote?: string;
};

export type PdfRequest = {
  markdown: string;
  preset: PdfPreset;
  pageSize: PageSize;
  chrome: DocumentChrome;
  filename?: string;
};

export type PresetDefinition = {
  id: PdfPreset;
  name: string;
  /** A verb capturing the document's mode of use. Surfaces in tooltips and palette. */
  verb: string;
  summary: string;
  accent: string;
  swatch: string;
  previewClassName: string;
};

export const presets: PresetDefinition[] = [
  {
    id: "editorial",
    name: "Editorial",
    verb: "Read it",
    summary: "Refined longform rhythm with quiet serif headings.",
    accent: "Bistre ink",
    swatch: "oklch(0.47 0.065 64)",
    previewClassName: "preset-editorial",
  },
  {
    id: "technical",
    name: "Technical",
    verb: "Build it",
    summary: "Compact docs, strong code blocks, and precise tables.",
    accent: "Blueprint",
    swatch: "oklch(0.42 0.082 238)",
    previewClassName: "preset-technical",
  },
  {
    id: "business",
    name: "Business",
    verb: "Send it",
    summary: "Proposal-ready sections with measured confidence.",
    accent: "Deep laurel",
    swatch: "oklch(0.42 0.064 157)",
    previewClassName: "preset-business",
  },
  {
    id: "academic",
    name: "Academic",
    verb: "Cite it",
    summary: "Paper-like typography for formal reading.",
    accent: "Oxide",
    swatch: "oklch(0.45 0.078 31)",
    previewClassName: "preset-academic",
  },
];

export const presetIds = presets.map((preset) => preset.id);

export function isPdfPreset(value: unknown): value is PdfPreset {
  return typeof value === "string" && presetIds.includes(value as PdfPreset);
}

export function isPageSize(value: unknown): value is PageSize {
  return value === "Letter" || value === "A4";
}

export function getPreset(id: PdfPreset): PresetDefinition {
  return presets.find((preset) => preset.id === id) ?? presets[0];
}

export function normalizeFilename(filename?: string) {
  const fallback = "md2pdf-export";
  const name = filename?.trim() || fallback;
  const withoutExtension = name.replace(/\.pdf$/i, "");
  const slug = withoutExtension
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);

  return `${slug || fallback}.pdf`;
}

export function inferTitle(markdown: string) {
  const heading = markdown
    .split("\n")
    .find((line) => /^#\s+/.test(line.trim()))
    ?.replace(/^#\s+/, "")
    .trim();

  return heading || "Untitled document";
}

export const sampleMarkdown = `# Welcome to md2pdf

This is a live preview. Edit the Markdown on the left, pick a preset above, then export — the PDF will match this preview exactly.

## Try the presets

Each preset is a typographic system. Same Markdown, different document.

- **Editorial** — refined longform with serif headings
- **Technical** — compact docs with strong code blocks
- **Business** — proposal-ready, numbered sections
- **Academic** — journal-style with indented paragraphs

## Formatting at a glance

| Element | Renders as | You write |
| --- | --- | --- |
| Headings | Per-preset hierarchy | \`# H1\` to \`#### H4\` |
| Tables | Tabular, kerned | \`\\| a \\| b \\|\` |
| Code | Monospaced, language-tagged | triple backticks |
| Blockquotes | Pull-quote treatment | \`> quote\` |

> Good defaults are a form of momentum. They help the document look finished before anyone starts fiddling.

\`\`\`ts
type State = "idle" | "ready";
\`\`\`

When this looks right, press **Export** at the top.
`;
