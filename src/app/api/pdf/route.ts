import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import {
  inferTitle,
  isPageSize,
  isPdfPreset,
  normalizeFilename,
  type PdfRequest,
} from "@/lib/document";
import { markdownToHtml } from "@/lib/markdown";
import { hasCJK } from "@/lib/pdf-cjk";
import { hasMath } from "@/lib/pdf-katex";
import { buildPdfHtml } from "@/lib/pdf-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Raised from 500KB to make pasted-image documents practical. The hard ceiling
   keeps the PDF route honest about timeouts and memory while giving rich
   markdown room to breathe. */
const MAX_MARKDOWN_BYTES = 4_000_000;
const mermaidBrowserBundlePath = join(
  process.cwd(),
  "node_modules",
  "mermaid",
  "dist",
  "mermaid.min.js",
);

let mermaidBrowserScriptPromise: Promise<string> | null = null;

function hasMermaid(markdown: string) {
  return /```mermaid(?:\s|\n)/.test(markdown);
}

function getMermaidBrowserScript() {
  mermaidBrowserScriptPromise ??= readFile(mermaidBrowserBundlePath, "utf8");
  return mermaidBrowserScriptPromise;
}

const localChromePaths = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

async function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (!process.env.VERCEL && process.platform === "darwin") {
    const { existsSync } = await import("node:fs");
    const localPath = localChromePaths.find((path) => existsSync(path));

    if (localPath) {
      return localPath;
    }
  }

  return chromium.executablePath();
}

function getLaunchArgs() {
  if (process.env.VERCEL) {
    return chromium.args;
  }

  return ["--no-sandbox", "--disable-setuid-sandbox"];
}

/* Module-scoped browser kept alive across warm invocations. Vercel keeps the
   lambda hot for several minutes between requests; relaunching puppeteer for
   each export costs ~500ms that we can amortize away. The promise (not the
   browser) is cached so concurrent first-requests share one launch. If the
   browser disconnects (chromium crash, lambda eviction), we drop the cache
   and the next request relaunches transparently. */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.connected) return existing;
    } catch {
      /* fall through and relaunch */
    }
  }
  browserPromise = (async () => {
    const browser = await puppeteer.launch({
      args: getLaunchArgs(),
      defaultViewport: { width: 1200, height: 1600 },
      executablePath: await getExecutablePath(),
      headless: true,
    });
    browser.on("disconnected", () => {
      browserPromise = null;
    });
    return browser;
  })();
  return browserPromise;
}

function parseRequest(body: unknown): PdfRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body.");
  }

  const value = body as Partial<PdfRequest>;
  const markdown = typeof value.markdown === "string" ? value.markdown : "";
  const preset = isPdfPreset(value.preset) ? value.preset : "editorial";
  const pageSize = isPageSize(value.pageSize) ? value.pageSize : "Letter";

  if (!markdown.trim()) {
    throw new Error("Add Markdown before exporting.");
  }

  if (markdown.length > MAX_MARKDOWN_BYTES) {
    throw new Error("This document is too large for the first version.");
  }

  return {
    markdown,
    preset,
    pageSize,
    filename: typeof value.filename === "string" ? value.filename : undefined,
    chrome: {
      header: Boolean(value.chrome?.header),
      footer: Boolean(value.chrome?.footer),
      title: typeof value.chrome?.title === "string" ? value.chrome.title : undefined,
      date: Boolean(value.chrome?.date),
      pageNumbers: Boolean(value.chrome?.pageNumbers),
      footerNote:
        typeof value.chrome?.footerNote === "string"
          ? value.chrome.footerNote
          : undefined,
    },
  };
}

/* Run inside the Puppeteer page after content + fonts settle. Mermaid is
   injected from the local npm bundle only when needed, then each ```mermaid block is
   replaced with the rendered SVG. Theme variables come from the document's
   active preset CSS vars so diagrams take the preset's ink. Images are
   awaited (and broken ones replaced with a calm in-flow fallback) so the
   capture happens against a settled page. */
const POST_RENDER_SCRIPT = `
(async () => {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  /* Mermaid's color parser doesn't accept OKLCH. Resolve each CSS variable
     through a 1×1 canvas (which IS oklch-aware) and read the rendered
     pixel back as hex. Cheap, deterministic, no library. */
  const cssToHex = (input, fallback) => {
    if (!input) return fallback;
    const trimmed = String(input).trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith("#")) return trimmed;
    try {
      const c = document.createElement("canvas");
      c.width = 1; c.height = 1;
      const ctx = c.getContext("2d");
      if (!ctx) return fallback;
      ctx.fillStyle = "#000";
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const hex = (n) => n.toString(16).padStart(2, "0");
      return "#" + hex(data[0]) + hex(data[1]) + hex(data[2]);
    } catch (e) { return fallback; }
  };
  const v = (name, fallback) => cssToHex(cs.getPropertyValue(name), fallback);

  // Mermaid — only load if there's at least one block.
  const mermaidBlocks = Array.from(document.querySelectorAll("pre > code.language-mermaid"));
  if (mermaidBlocks.length > 0) {
    if (!window.mermaid) {
      throw new Error("Mermaid renderer was not loaded.");
    }
    const mermaid = window.mermaid;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      htmlLabels: false,
      fontFamily: "inherit",
      // Root-level htmlLabels: false is required in Mermaid 11; per-diagram
      // htmlLabels is deprecated and loses to the root default.
      // SVG-text labels measure against the actual rendered font, so shapes
      // size correctly even when the web font finishes loading mid-render.
      flowchart: { htmlLabels: false },
      sequence: { htmlLabels: false },
      class: { htmlLabels: false },
      state: { htmlLabels: false },
      themeVariables: {
        primaryColor: v("--pdf-accent-soft", "#f5f1ea"),
        primaryTextColor: v("--pdf-ink", "#1c1c1c"),
        primaryBorderColor: v("--pdf-accent", "#7b4a1f"),
        lineColor: v("--pdf-muted", "#6b6b6b"),
        secondaryColor: v("--pdf-accent-soft", "#f0ece5"),
        tertiaryColor: v("--pdf-accent-soft", "#f5f1ea"),
        background: v("--paper", "#ffffff"),
        fontSize: "13px",
      },
    });
    const swapToFallback = (wrapper, source) => {
      const fallback = document.createElement("div");
      fallback.className = "md-mermaid md-mermaid-error";
      const pre = document.createElement("pre");
      const c = document.createElement("code");
      c.textContent = source;
      pre.appendChild(c);
      const note = document.createElement("p");
      note.className = "md-mermaid-error-note";
      note.textContent = "Diagram couldn't render — showing source.";
      fallback.appendChild(pre);
      fallback.appendChild(note);
      wrapper.replaceWith(fallback);
    };
    await Promise.all(mermaidBlocks.map(async (code, i) => {
      const wrapper = code.closest("pre");
      if (!wrapper) return;
      const source = code.textContent || "";
      // Validate before render — mermaid.render() leaks a "Syntax error in
      // text" SVG into the document on failure even with strict security,
      // and that bomb icon would ship in the PDF. parse() with suppressErrors
      // gives us a clean boolean instead.
      const isValid = await mermaid.parse(source, { suppressErrors: true });
      if (!isValid) {
        swapToFallback(wrapper, source);
        return;
      }
      try {
        const { svg } = await mermaid.render("md2pdf-mermaid-" + i, source);
        const div = document.createElement("div");
        div.className = "md-mermaid";
        div.setAttribute("role", "img");
        div.setAttribute("aria-label", "Diagram");
        div.innerHTML = svg;
        wrapper.replaceWith(div);
      } catch (err) {
        swapToFallback(wrapper, source);
      }
    }));
    // Belt-and-braces: scrub any orphan mermaid bomb the renderer may have
    // attached to <body>, regardless of whether parse() caught the error.
    document.querySelectorAll('body > [id^="dmermaid-"], body > [id^="md2pdf-mermaid-"]').forEach((node) => node.remove());
  }

  // Images — after domcontentloaded, local/data images are usually already
  // complete. Handle those synchronously; only register listeners for
  // in-flight images.
  const swapBroken = (img) => {
    const span = document.createElement("span");
    span.className = "md-image-broken";
    span.textContent = "Image: " + (img.alt || "untitled");
    img.replaceWith(span);
  };
  const images = Array.from(document.images);
  await Promise.all(images.map((img) => {
    if (img.complete) {
      if (img.naturalWidth === 0) swapBroken(img);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      img.addEventListener("load", () => resolve(undefined), { once: true });
      img.addEventListener("error", () => {
        swapBroken(img);
        resolve(undefined);
      }, { once: true });
    });
  }));

  // Webfonts — include after image swaps so any fallback text picks up the
  // typeset font, not the metric-matched fallback.
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
})();
`;

/* HEAD /api/pdf — used by the workspace to pre-warm the lambda when the user
   opens the app, so the first real export skips chromium's brotli extraction
   and puppeteer launch. Cheap: triggers `getBrowser()` once and returns
   immediately. Errors are swallowed because warmup must not surface to the UI. */
export async function HEAD() {
  getBrowser().catch(() => {
    /* warmup failure is a non-event */
  });
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  let page: Awaited<ReturnType<Browser["newPage"]>> | undefined;

  try {
    const payload = parseRequest(await request.json());
    const title = payload.chrome.title?.trim() || inferTitle(payload.markdown);
    /* Inspect the markdown content + the user-provided chrome title (which
       can carry CJK independently of the body). Both feed into whether we
       emit the Google Fonts <link> for CJK. */
    const cjkSource = `${payload.markdown}\n${payload.chrome.title ?? ""}`;
    const mathPresent = hasMath(payload.markdown);
    const cjkPresent = hasCJK(cjkSource);
    const mermaidPresent = hasMermaid(payload.markdown);

    /* Markdown processing and browser launch are independent — run them in
       parallel so the slower one sets the floor. On a warm lambda this saves
       ~50ms (markdown is fast); on cold start the launch dominates and the
       overlap helps less, but it never hurts. Mermaid's browser bundle is
       read from local disk only when the document contains diagrams, avoiding
       a multi-second CDN wait inside Puppeteer. */
    const [html, browser, mermaidScript] = await Promise.all([
      markdownToHtml(payload.markdown),
      getBrowser(),
      mermaidPresent ? getMermaidBrowserScript() : Promise.resolve(null),
    ]);
    const documentHtml = buildPdfHtml({
      html,
      preset: payload.preset,
      title,
      chrome: payload.chrome,
      pageSize: payload.pageSize,
      hasMath: mathPresent,
      hasCJK: cjkPresent,
    });

    page = await browser.newPage();
    /* domcontentloaded instead of networkidle0: with fonts and KaTeX inlined,
       the page has no external network requests at parse time. networkidle0's
       500ms idle window was pure dead waiting. The post-render script below
       still awaits document.fonts.ready, mermaid render, and image loads —
       those are the things that actually need to settle before PDF capture. */
    await page.setContent(documentHtml, { waitUntil: "domcontentloaded" });
    if (mermaidScript) {
      await page.addScriptTag({ content: mermaidScript });
    }
    await page.evaluate(POST_RENDER_SCRIPT);
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${normalizeFilename(
          payload.filename || title,
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "The PDF could not be generated.",
      },
      { status: 400 },
    );
  } finally {
    /* Close the page, not the browser — singleton stays alive for the next
       warm invocation. */
    await page?.close().catch(() => {
      /* ignore close errors */
    });
  }
}
