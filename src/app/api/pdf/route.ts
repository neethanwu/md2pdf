import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import {
  inferTitle,
  isPageSize,
  isPdfPreset,
  normalizeFilename,
  type PdfRequest,
} from "@/lib/document";
import { markdownToHtml } from "@/lib/markdown";
import {
  buildFooterTemplate,
  buildHeaderTemplate,
  buildPdfHtml,
  getPdfMargins,
} from "@/lib/pdf-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  if (markdown.length > 500_000) {
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

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    const payload = parseRequest(await request.json());
    const title = payload.chrome.title?.trim() || inferTitle(payload.markdown);
    const html = await markdownToHtml(payload.markdown);
    const documentHtml = buildPdfHtml({
      html,
      preset: payload.preset,
      title,
    });

    browser = await puppeteer.launch({
      args: getLaunchArgs(),
      defaultViewport: { width: 1200, height: 1600 },
      executablePath: await getExecutablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(documentHtml, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    const showChrome = payload.chrome.header || payload.chrome.footer;

    const pdf = await page.pdf({
      format: payload.pageSize,
      printBackground: true,
      displayHeaderFooter: showChrome,
      headerTemplate: buildHeaderTemplate(payload.chrome, title),
      footerTemplate: buildFooterTemplate(payload.chrome),
      margin: getPdfMargins(payload.chrome, payload.pageSize),
      preferCSSPageSize: false,
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
    await browser?.close();
  }
}
