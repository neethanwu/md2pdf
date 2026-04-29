import type { Schema } from "hast-util-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkUnwrapImages from "remark-unwrap-images";
import { unified } from "unified";

// KaTeX (HTML-only mode) emits a tree of <span> with semantic classes plus
// inline styles for glyph metrics, and a sibling MathML subtree for screen
// readers. The sanitizer needs to recognise both branches without becoming a
// blanket allow-list, so we name the tags explicitly.
const KATEX_HTML_ATTRS = ["className", "style", "ariaHidden"];
const KATEX_MATHML_TAGS = [
  "math",
  "annotation",
  "semantics",
  "mtext",
  "mn",
  "mo",
  "mi",
  "mspace",
  "mover",
  "munder",
  "munderover",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "mroot",
  "msqrt",
  "mtable",
  "mtr",
  "mtd",
  "mlabeledtr",
  "mrow",
  "menclose",
  "mstyle",
  "mpadded",
  "mphantom",
  "mglyph",
];

const schema: Schema = {
  ...defaultSchema,
  // Allow MathML + figure/figcaption to pass through alongside the existing tags.
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    ...KATEX_MATHML_TAGS,
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ["target"],
      ["rel"],
      ["className"],
      ["dataPrintUrl"],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className"],
      // We use this attribute to ferry the original mermaid source through
      // the sanitizer to the preview/PDF without re-escaping it.
      ["dataMermaidSource"],
    ],
    pre: [...(defaultSchema.attributes?.pre ?? []), ["className"]],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className"],
      ["style"],
      ["ariaHidden"],
    ],
    div: [...(defaultSchema.attributes?.div ?? []), ["className"], ["style"]],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      ["src"],
      ["alt"],
      ["title"],
      ["width"],
      ["height"],
      ["loading"],
    ],
    figure: [["className"]],
    figcaption: [["className"]],
    // KaTeX HTML tree
    math: [["xmlns"]],
    mi: [["mathvariant"]],
    mo: [
      ["fence"],
      ["lspace"],
      ["rspace"],
      ["stretchy"],
      ["accent"],
      ["minsize"],
      ["maxsize"],
    ],
    mover: [["accent"]],
    munder: [["accentunder"]],
    munderover: [["accent"], ["accentunder"]],
    mfrac: [["linethickness"]],
    mspace: [["width"], ["height"], ["depth"]],
    annotation: [["encoding"]],
    semantics: [],
    mrow: [],
    mn: [],
    mtext: [],
    msup: [],
    msub: [],
    msubsup: [],
    mroot: [],
    msqrt: [],
    mtable: [["columnalign"], ["rowspacing"], ["columnspacing"]],
    mtr: [],
    mtd: [],
    mstyle: [["mathcolor"], ["mathbackground"], ["scriptlevel"], ["displaystyle"]],
    mpadded: [["height"], ["depth"], ["width"]],
    mphantom: [],
    menclose: [["notation"]],
    // Allow KaTeX HTML attributes on every emitted element so positioning
    // styles survive sanitization.
    "*": [...(defaultSchema.attributes?.["*"] ?? []), ...KATEX_HTML_ATTRS],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "data"],
    href: ["http", "https", "mailto", "tel"],
  },
};

/* Strip the protocol and any trailing slash so the printed annotation reads
   as a destination, not as a URL. Long links wrap softly via CSS. */
function stripProtocol(href: string) {
  return href
    .replace(/^https?:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/\/$/, "");
}

/* remark-unwrap-images already lifts solo images out of paragraphs, so the
   HTML has bare top-level <img> tags. Wrap each one in a <figure>; if the
   image carries a `title`, surface it as a <figcaption> beneath. Mirrors
   the React preview's `img` component for shared figure typography. */
function liftImagesIntoFigures(html: string) {
  return html.replace(/<img\b[^>]*?>/gi, (imgTag: string) => {
    const titleMatch = imgTag.match(/\stitle="([^"]+)"/i);
    const caption = titleMatch?.[1]?.trim();
    // Drop the title attribute so it doesn't double as a browser tooltip
    // once we've promoted it to the visible caption — captions belong
    // beneath the image, not in a hover tip.
    const cleaned = caption ? imgTag.replace(/\stitle="[^"]*"/i, "") : imgTag;
    const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
    return `<figure class="md-image-figure">${cleaned}${figcaption}</figure>`;
  });
}

/* Tag every external link with a `data-print-url` attribute so the paper
   presets can surface it with attr() in print/preview without a JS pass. */
function annotateExternalLinks(html: string) {
  return html.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]+|mailto:[^"]+)"([^>]*)>/gi,
    (_, before, href, after) => {
      const display = stripProtocol(href);
      const escaped = display.replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return `<a ${before}href="${href}"${after} data-print-url="${escaped}">`;
    },
  );
}

export async function markdownToHtml(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    // Lift solo-image paragraphs so the <figure>/<figcaption> we wrap in is
    // structurally valid HTML (figure can't nest inside p). Same plugin as
    // the preview side — single source of truth.
    .use(remarkUnwrapImages)
    .use(remarkRehype)
    .use(rehypeKatex, {
      // KaTeX renders by default with both an HTML tree and a MathML one.
      // We keep both: the HTML tree typesets, the MathML carries semantics
      // for screen readers and accessible PDF tools. `strict: "ignore"`
      // means malformed math renders as the source instead of throwing —
      // rehype-katex sets `throwOnError: false` for us internally.
      strict: "ignore",
      output: "htmlAndMathml",
    })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify)
    .process(markdown);

  return annotateExternalLinks(liftImagesIntoFigures(String(file)));
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
