"use client";

import "katex/dist/katex.min.css";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkUnwrapImages from "remark-unwrap-images";
import { getPreset, type PageSize, type PdfPreset } from "@/lib/document";
import { cn } from "@/lib/utils";

/* The preview's sanitizer mirrors the server pipeline so KaTeX + figures +
   mermaid wrappers survive unchanged. Kept inline so the preview can evolve
   independently of the export schema if needed. */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
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
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ["target"], ["rel"], ["className"]],
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
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
    math: [["xmlns"]],
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      ["className"],
      ["style"],
      ["ariaHidden"],
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "data"],
    href: ["http", "https", "mailto", "tel"],
  },
};

function stripUrlForPrint(href: string) {
  return href
    .replace(/^https?:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/\/$/, "");
}

/* Components are built per render so MermaidBlock receives the active preset
   and can re-render with the matching theme. Keyed by preset so every block
   remounts cleanly on preset switch — avoids mermaid's render-id collisions
   and guarantees fresh theme vars are read from the host element. */
function buildComponents(preset: PdfPreset): Components {
  return {
    // React-markdown wraps every fenced block in <pre><code>. For Mermaid we
    // unwrap so the dark code-block background doesn't sit behind the diagram.
    pre: ({ children, ...rest }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const className =
        child &&
        typeof child === "object" &&
        "props" in child &&
        child.props &&
        typeof child.props === "object" &&
        "className" in child.props &&
        typeof child.props.className === "string"
          ? child.props.className
          : "";
      if (/(?:^|\s)language-mermaid(?:\s|$)/.test(className)) {
        return <>{children}</>;
      }
      return <pre {...rest}>{children}</pre>;
    },
    a: ({ children, href }) => {
      if (!href) return <>{children}</>;
      const isExternal = /^https?:|^mailto:/i.test(href);
      return (
        <a
          href={href}
          rel="noreferrer"
          target={isExternal && !href.startsWith("mailto:") ? "_blank" : undefined}
          data-print-url={isExternal ? stripUrlForPrint(href) : undefined}
        >
          {children}
        </a>
      );
    },
    code: ({ className, children, ...rest }) => {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      if (lang === "mermaid") {
        const source = String(children).replace(/\n$/, "");
        // Key by preset so every diagram remounts on preset change. Fresh
        // mount → fresh useId → no mermaid render-id collision, theme
        // variables read from the new preset's host element.
        return <MermaidBlock key={preset} preset={preset} source={source} />;
      }
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
    img: ({ src, alt, title, width, height }) => {
      if (!src || typeof src !== "string") return null;
      const captionText = title?.trim();
      return (
        <figure className="md-image-figure">
          <ImageWithFallback
            alt={alt ?? ""}
            height={
              typeof height === "string" || typeof height === "number"
                ? height
                : undefined
            }
            src={src}
            width={
              typeof width === "string" || typeof width === "number" ? width : undefined
            }
          />
          {captionText ? <figcaption>{captionText}</figcaption> : null}
        </figure>
      );
    },
  };
}

type MarkdownPreviewProps = {
  markdown: string;
  preset: PdfPreset;
  pageSize: PageSize;
  showHeader: boolean;
  showFooter: boolean;
  chromeTitle?: string;
  showDate: boolean;
  showPageNumbers: boolean;
  footerNote?: string;
  /** True briefly after a preset switch — adds a whisper of blur to mask reflow. */
  switching?: boolean;
};

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const KEEP_TOGETHER_SELECTOR = "figure, .md-mermaid, .katex-display";

/**
 * Smart pagination — figure out where each page should start so that:
 *   1. No element is sliced horizontally across a page boundary.
 *   2. Headings aren't orphaned — if breaking would leave an h1–h6 alone at the
 *      bottom of a page, the heading is pulled to the next page with its content.
 *   3. Figures, math display blocks, and mermaid diagrams stay together with
 *      their preceding heading and any caption — they are atomic units.
 *
 * Returns an array of content-y offsets, one per page (always starts with [0]).
 */
function computePageOffsets(content: HTMLElement, bodyH: number): number[] {
  const offsets = [0];
  if (bodyH <= 0) return offsets;

  const children = Array.from(content.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0,
  );
  if (children.length === 0) return offsets;

  let currentPageStart = 0;

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;

    if (bottom <= currentPageStart + bodyH) continue;
    if (top <= currentPageStart) continue;

    let breakAt = top;

    const prev = i > 0 ? children[i - 1] : null;
    if (prev && HEADING_TAGS.has(prev.tagName) && prev.offsetTop > currentPageStart) {
      breakAt = prev.offsetTop;
    }
    // Atomic units (figures, mermaid, display math) shouldn't get sliced. If
    // the element straddling the break is one of them, push the whole thing
    // to the next page by breaking at its top — even if there's no heading.
    if (el.matches?.(KEEP_TOGETHER_SELECTOR) && top > currentPageStart) {
      breakAt = top;
    }

    offsets.push(breakAt);
    currentPageStart = breakAt;
  }

  return offsets;
}

export function MarkdownPreview({
  markdown,
  preset,
  pageSize,
  showHeader,
  showFooter,
  chromeTitle,
  showDate,
  showPageNumbers,
  footerNote,
  switching = false,
}: MarkdownPreviewProps) {
  const presetDefinition = getPreset(preset);
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const headerHasContent = (chromeTitle?.trim() ?? "") !== "" || showDate;
  const footerHasContent = (footerNote?.trim() ?? "") !== "" || showPageNumbers;
  const renderHeader = showHeader && headerHasContent;
  const renderFooter = showFooter && footerHasContent;

  const scalerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageOffsets, setPageOffsets] = useState<number[]>([0]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps drive a re-measure on layout-affecting prop changes
  useLayoutEffect(() => {
    const clip = clipRef.current;
    const content = contentRef.current;
    if (!clip || !content) return;

    const measure = () => {
      const clipH = clip.clientHeight;
      if (clipH <= 0) return;
      const next = computePageOffsets(content, clipH);
      setPageOffsets((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, [pageSize, preset, renderHeader, renderFooter]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps trigger a re-measure when stack composition changes
  useLayoutEffect(() => {
    const scaler = scalerRef.current;
    const stack = stackRef.current;
    if (!scaler || !stack) return;

    /* CSS owns the scale (container query in .page-stack-scaler), so JS
       only needs to publish the unscaled stack height. CSS multiplies by
       the scale to reserve the right visual height. This removes the
       first-paint snap that was visible as the chrome "re-positioning"
       into place — scale is correct from the very first style resolution. */
    const apply = () => {
      const naturalH = stack.scrollHeight;
      if (naturalH <= 0) return;
      scaler.style.setProperty("--preview-stack-natural-h", `${naturalH}px`);
    };

    const observer = new ResizeObserver(apply);
    observer.observe(stack);
    apply();
    return () => observer.disconnect();
  }, [pageOffsets.length, pageSize, renderHeader, renderFooter]);

  const pageCount = pageOffsets.length;
  const pages = pageOffsets.map((offset, index) => {
    const nextOffset = pageOffsets[index + 1];
    const window = nextOffset !== undefined ? nextOffset - offset : null;
    return {
      index,
      offset,
      window,
      id: `${pageSize}-page-${index + 1}`,
    };
  });

  const components = useMemo(() => buildComponents(preset), [preset]);

  const article = (
    <ReactMarkdown
      components={components}
      rehypePlugins={[
        [rehypeKatex, { strict: "ignore" }],
        [rehypeSanitize, sanitizeSchema],
      ]}
      // remarkUnwrapImages lifts solo-image paragraphs out of <p>, so the
      // <figure>/<figcaption> we render in the img component is structurally
      // valid HTML (figure can't nest inside p — would break hydration).
      remarkPlugins={[remarkMath, remarkGfm, remarkUnwrapImages]}
      // React-markdown's default urlTransform strips data: URLs. Our
      // sanitizer already governs which protocols are safe (http/https/data
      // for src), so we pass urls through and let the schema be the gate.
      urlTransform={(url) => url}
    >
      {markdown}
    </ReactMarkdown>
  );

  return (
    /* data-page-size keys CSS to a sensible single-page natural-h on first
       paint (see globals.css). After mount, JS setProperty updates the inline
       --preview-stack-natural-h to the measured stack height. Inline style
       beats data-attribute rules, so the measured value wins once available
       — and the seed is correct for the empty-doc first render. */
    <div className="page-stack-scaler" ref={scalerRef} data-page-size={pageSize}>
      <div className="page-stack" ref={stackRef}>
        {pages.map((page) => {
          const isFirst = page.index === 0;
          return (
            <article
              className={cn(
                "paper md-preview",
                presetDefinition.previewClassName,
                renderHeader && "has-document-chrome-top",
                renderFooter && "has-document-chrome-bottom",
              )}
              data-size={pageSize}
              key={page.id}
            >
              {renderHeader ? (
                <header className="document-chrome document-chrome-top">
                  <span>{chromeTitle?.trim() || "Untitled document"}</span>
                  {showDate ? <span>{date}</span> : <span />}
                </header>
              ) : null}
              <div className="document-body">
                <div className="document-body-clip" ref={isFirst ? clipRef : undefined}>
                  <div
                    className="document-content"
                    data-switching={switching || undefined}
                    ref={isFirst ? contentRef : undefined}
                    style={
                      {
                        "--page-offset": `${page.offset}px`,
                        ...(page.window != null
                          ? { "--page-window": `${page.window}px` }
                          : {}),
                      } as React.CSSProperties
                    }
                  >
                    {article}
                  </div>
                </div>
              </div>
              {renderFooter ? (
                <footer className="document-chrome document-chrome-bottom">
                  <span>{footerNote?.trim() ?? ""}</span>
                  {showPageNumbers ? (
                    <span className="page-marker">
                      <span className="page-marker-label">Page</span>
                      <span className="page-marker-numbers">
                        <span className="page-marker-current">{page.index + 1}</span>
                        <span aria-hidden className="page-marker-of">
                          /
                        </span>
                        <span className="page-marker-total">{pageCount}</span>
                      </span>
                    </span>
                  ) : (
                    <span />
                  )}
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* —————————————————————————————————————————————————————————————
   Image — calm, recoverable lifecycle.
   - loading: 1px-thick neutral border placeholder until decode resolves
   - loaded: border fades, image is shown
   - broken: replaced by an italic alt-text marker so the document still reads
*/
type ImageState = "loading" | "loaded" | "broken";
type ImageDim = string | number | undefined;

function ImageWithFallback({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width?: ImageDim;
  height?: ImageDim;
}) {
  const [state, setState] = useState<ImageState>("loading");

  // Reset on src change so a swapped-in image re-runs the lifecycle instead of
  // leaving the placeholder up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: src drives the reset; the setter doesn't need to be in deps
  useEffect(() => {
    setState("loading");
  }, [src]);

  if (state === "broken") {
    return (
      <span
        className="md-image-broken"
        role="img"
        aria-label={`Image: ${alt || "untitled"}`}
      >
        Image: {alt || "untitled"}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: react-markdown emits raw <img>; next/image isn't applicable inside dangerously-typeset content
    <img
      alt={alt}
      data-state={state}
      height={height}
      loading="lazy"
      onError={() => setState("broken")}
      onLoad={() => setState("loaded")}
      src={src}
      width={width}
    />
  );
}

/* —————————————————————————————————————————————————————————————
   Mermaid — dynamic-imported so the bundle only pays for it on demand.
   Each diagram measures itself as a paper-aligned skeleton first, then
   blur-fades into the rendered SVG. Init runs once per session; theme
   variables track the active preset by reading the document's CSS vars.
*/
type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  parse: (
    source: string,
    opts?: { suppressErrors?: boolean },
  ) => Promise<boolean | { config?: unknown }>;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("mermaid").then((m) => {
    const api = (m.default ?? m) as MermaidApi;
    api.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "inherit",
      // htmlLabels: false makes mermaid render labels as native SVG <text>
      // and measure their bounds against the actual rendered font. With
      // htmlLabels: true (the default), shapes are sized before the web
      // font finishes loading so longer words like "Preset" get clipped.
      flowchart: { htmlLabels: false },
      sequence: { htmlLabels: false },
      class: { htmlLabels: false },
      state: { htmlLabels: false },
    });
    return api;
  });
  return mermaidPromise;
}

/* Mermaid's color parser only knows hex/rgb/hsl — it chokes on OKLCH. We
   resolve every CSS color through a 1×1 canvas (which IS oklch-aware) and
   read the rendered pixel back as hex. Cheap, deterministic, no library. */
function cssColorToHex(input: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  if (!input) return fallback;
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) return trimmed;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#000";
    ctx.fillStyle = trimmed; // browser silently rejects invalid colors → previous black sticks
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return fallback;
  }
}

function readPresetVars(host: HTMLElement) {
  const cs = getComputedStyle(host);
  const v = (name: string, fallback: string) =>
    cssColorToHex(cs.getPropertyValue(name), fallback);
  return {
    primaryColor: v("--pdf-accent-soft", "#f5f1ea"),
    primaryTextColor: v("--pdf-ink", "#1c1c1c"),
    primaryBorderColor: v("--pdf-accent", "#7b4a1f"),
    lineColor: v("--pdf-muted", "#6b6b6b"),
    secondaryColor: v("--pdf-accent-soft", "#f0ece5"),
    tertiaryColor: v("--pdf-accent-soft", "#f5f1ea"),
    background: v("--paper", "#ffffff"),
    fontFamily: "inherit",
    fontSize: "13px",
  };
}

function MermaidBlock({ source, preset }: { source: string; preset: PdfPreset }) {
  const id = useId().replace(/:/g, "-");
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"pending" | "ready" | "error">("pending");
  const [svg, setSvg] = useState<string>("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: preset is the trigger — re-runs with the new preset's theme variables on switch
  useEffect(() => {
    // preset is in deps so the diagram re-renders with the new preset's theme
    // variables when the user switches presets. Without this, the SVG stays
    // colored for whichever preset was active at first mount.
    let cancelled = false;
    setState("pending");
    loadMermaid()
      .then(async (api) => {
        if (cancelled) return;
        if (hostRef.current) {
          // Re-init per render so the preset's CSS vars feed the diagram. Mermaid
          // honours the latest themeVariables on each render call.
          api.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            fontFamily: "inherit",
            flowchart: { htmlLabels: false },
            sequence: { htmlLabels: false },
            class: { htmlLabels: false },
            state: { htmlLabels: false },
            themeVariables: readPresetVars(hostRef.current),
          });
        }
        // Validate first so a bad diagram falls into our calm error state
        // instead of mermaid's own bomb-icon SVG.
        const isValid = await api.parse(source, { suppressErrors: true });
        if (cancelled) return;
        if (!isValid) {
          setState("error");
          return;
        }
        const { svg } = await api.render(`mermaid-${id}`, source);
        if (cancelled) return;
        setSvg(svg);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, source, preset]);

  if (state === "error") {
    return (
      <div className="md-mermaid md-mermaid-error">
        <pre>
          <code>{source}</code>
        </pre>
        <p className="md-mermaid-error-note">Diagram couldn't render — showing source.</p>
      </div>
    );
  }

  return (
    <div
      aria-label="Diagram"
      className="md-mermaid"
      data-state={state}
      ref={hostRef}
      role="img"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is sanitized by mermaid itself; securityLevel:strict is set
      dangerouslySetInnerHTML={state === "ready" ? { __html: svg } : undefined}
    />
  );
}
