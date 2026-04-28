"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { getPreset, type PageSize, type PdfPreset } from "@/lib/document";
import { cn } from "@/lib/utils";

const components: Components = {
  a: ({ children, href }) => (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
};

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

/**
 * Smart pagination — figure out where each page should start so that:
 *   1. No element is sliced horizontally across a page boundary.
 *   2. Headings aren't orphaned — if breaking would leave an h1–h6 alone at the
 *      bottom of a page, the heading is pulled to the next page with its content.
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

    // Element fits within current page → keep going.
    if (bottom <= currentPageStart + bodyH) continue;

    // Element doesn't fit but starts at the page top → can't avoid a cut, accept it.
    if (top <= currentPageStart) continue;

    // Break candidate is this element's top.
    let breakAt = top;

    // If the previous element is a heading, pull it to the next page so it stays
    // attached to its content. Only pull if it still leaves something on the current page.
    const prev = i > 0 ? children[i - 1] : null;
    if (prev && HEADING_TAGS.has(prev.tagName) && prev.offsetTop > currentPageStart) {
      breakAt = prev.offsetTop;
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

  // Page 1 renders unconditionally and serves as the measurement source.
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

  // Fit-to-width: scale the page-stack down so the 760px page fits the
  // container at narrow widths. We never reflow content — the page renders at
  // its true dimensions and the wrapper visually scales it. This keeps the
  // mobile preview honest: same layout, same pagination, just zoomed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps trigger a re-measure when stack composition changes
  useLayoutEffect(() => {
    const scaler = scalerRef.current;
    const stack = stackRef.current;
    if (!scaler || !stack) return;

    const PAGE_W = 760;

    const apply = () => {
      const available = scaler.clientWidth;
      if (available <= 0) return;
      const scale = Math.min(1, available / PAGE_W);
      // Natural height of the stack (set by paper heights + gaps), unaffected
      // by transform: scale because transforms don't influence layout.
      const naturalH = stack.scrollHeight;
      scaler.style.setProperty("--preview-scale", String(scale));
      scaler.style.setProperty("--preview-stack-h", `${naturalH * scale}px`);
    };

    const observer = new ResizeObserver(apply);
    observer.observe(scaler);
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

  const article = (
    <ReactMarkdown
      components={components}
      rehypePlugins={[rehypeSanitize]}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );

  return (
    <div className="page-stack-scaler" ref={scalerRef}>
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
