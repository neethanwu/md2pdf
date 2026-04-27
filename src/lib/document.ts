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
  summary: string;
  accent: string;
  swatch: string;
  previewClassName: string;
};

export const presets: PresetDefinition[] = [
  {
    id: "editorial",
    name: "Editorial",
    summary: "Refined longform rhythm with quiet serif headings.",
    accent: "Bistre ink",
    swatch: "oklch(0.47 0.065 64)",
    previewClassName: "preset-editorial",
  },
  {
    id: "technical",
    name: "Technical",
    summary: "Compact docs, strong code blocks, and precise tables.",
    accent: "Blueprint",
    swatch: "oklch(0.42 0.082 238)",
    previewClassName: "preset-technical",
  },
  {
    id: "business",
    name: "Business",
    summary: "Proposal-ready sections with measured confidence.",
    accent: "Deep laurel",
    swatch: "oklch(0.42 0.064 157)",
    previewClassName: "preset-business",
  },
  {
    id: "academic",
    name: "Academic",
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

export const sampleMarkdown = `# Field Notes for a Better Launch

A concise launch document should feel prepared, readable, and easy to share. MD2PDF keeps the writing in Markdown and moves the polish into presets.

## What matters

- A clear narrative arc
- Tables that survive the trip to PDF
- Code blocks that feel intentional
- Optional page chrome for multi-page handouts

| Phase | Owner | Status |
| --- | --- | --- |
| Draft | Product | Ready |
| Review | Design | In progress |
| Publish | Ops | Next |

> Good defaults are a form of momentum. They help the document look finished before anyone starts fiddling.

\`\`\`ts
type ExportState = "idle" | "rendering" | "ready";

const nextState: ExportState = "ready";
\`\`\`

## Final check

- [x] Paste Markdown
- [x] Pick a preset
- [ ] Export the PDF
`;
