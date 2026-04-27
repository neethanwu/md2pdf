"use client";

import {
  ArrowDownToLineIcon,
  Loader2Icon,
  SlidersHorizontalIcon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getPreset,
  inferTitle,
  type PageSize,
  type PdfPreset,
  presets,
  sampleMarkdown,
} from "@/lib/document";
import { cn } from "@/lib/utils";

type ChromeState = {
  header: boolean;
  footer: boolean;
  title: string;
  date: boolean;
  pageNumbers: boolean;
  footerNote: string;
};

const initialChrome: ChromeState = {
  header: true,
  footer: true,
  title: "Field Notes",
  date: true,
  pageNumbers: true,
  footerNote: "",
};

/** Pick a default page size based on the user's locale.
 *  Letter for North America (US/CA/MX), A4 everywhere else. */
const LETTER_LOCALES = /^(en-US|en-CA|es-MX|fr-CA)/i;

function detectPageSize(): PageSize {
  if (typeof navigator === "undefined") return "Letter";
  const lang = navigator.language || "";
  return LETTER_LOCALES.test(lang) ? "Letter" : "A4";
}

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return isMac;
}

export function Md2PdfWorkspace() {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [preset, setPreset] = useState<PdfPreset>("editorial");
  const [pageSize, setPageSize] = useState<PageSize>("Letter");
  const [filename, setFilename] = useState("field-notes");
  const [chrome, setChrome] = useState<ChromeState>(initialChrome);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMac = useIsMac();
  const modKey = isMac ? "⌘" : "Ctrl";

  // Pick the right default page size for the user once we have access to navigator.
  // SSR-safe: useState initialised to "Letter", then we adjust to "A4" if locale calls for it.
  useEffect(() => {
    setPageSize((current) => {
      const detected = detectPageSize();
      return current === detected ? current : detected;
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const inferredTitle = useMemo(() => inferTitle(markdown), [markdown]);
  const activePreset = getPreset(preset);
  const wordCount = useMemo(
    () => markdown.trim().split(/\s+/).filter(Boolean).length,
    [markdown],
  );

  function updateChrome(next: Partial<ChromeState>) {
    setChrome((current) => ({ ...current, ...next }));
  }

  async function handleFile(file: File) {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      toast.error("Markdown files only", {
        description: "Upload a .md, .markdown, or .txt file.",
      });
      return;
    }

    if (file.size > 500_000) {
      toast.error("File is too large", {
        description: "Files up to 500 KB are supported.",
      });
      return;
    }

    const text = await file.text();
    setMarkdown(text);
    setFilename(file.name.replace(/\.(md|markdown|txt)$/i, ""));
    setChrome((current) => ({ ...current, title: inferTitle(text) }));
    toast.success("Markdown loaded", { description: file.name });
  }

  function exportPdf() {
    if (!markdown.trim()) {
      toast.error("Nothing to export yet", {
        description: "Paste or drop Markdown to get started.",
      });
      return;
    }

    startTransition(async () => {
      const exportToast = toast.loading("Typesetting PDF");

      try {
        const response = await fetch("/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown,
            preset,
            pageSize,
            filename,
            chrome: {
              header: chrome.header,
              footer: chrome.footer,
              title: chrome.title || inferredTitle,
              date: chrome.date,
              pageNumbers: chrome.pageNumbers,
              footerNote: chrome.footerNote,
            },
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "The PDF could not be generated.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename.trim() || inferredTitle}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        toast.success("PDF exported", {
          id: exportToast,
          description: `${activePreset.name} · ${pageSize}`,
        });
      } catch (error) {
        toast.error("Export failed", {
          id: exportToast,
          description: error instanceof Error ? error.message : "Try again in a moment.",
        });
      }
    });
  }

  function applySample() {
    setMarkdown(sampleMarkdown);
    setChrome((c) => ({ ...c, title: inferTitle(sampleMarkdown) }));
    setFilename("field-notes");
  }

  function loadSample() {
    const dirty = markdown.trim() !== "" && markdown !== sampleMarkdown;
    if (!dirty) {
      applySample();
      return;
    }
    toast.warning("Replace your content?", {
      description: "Your current Markdown will be overwritten.",
      action: { label: "Replace", onClick: applySample },
    });
  }

  // Stable refs for the global keydown handler — avoids re-binding on every render.
  const exportRef = useRef(exportPdf);
  exportRef.current = exportPdf;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.altKey) return;
      const key = e.key.toLowerCase();

      if (key === "e" && !e.shiftKey) {
        e.preventDefault();
        exportRef.current();
        return;
      }
      if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (key === "/" && !e.shiftKey) {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }
      const idx = ["1", "2", "3", "4"].indexOf(key);
      if (idx >= 0 && presets[idx]) {
        e.preventDefault();
        setPreset(presets[idx].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <TooltipProvider>
      <main className="flex h-dvh flex-col bg-background text-foreground">
        {/* ———————————————————— Top bar —————————————————————— */}
        <header className="relative z-20 flex h-14 items-center justify-between gap-4 border-b border-[var(--rule)] bg-background/90 px-5 backdrop-blur-sm sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="brand select-none">md2pdf</span>
            <span aria-hidden="true" className="h-3.5 w-px bg-[var(--rule)]" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="truncate text-xs text-muted-foreground">
                    {inferredTitle}
                  </span>
                }
              />
              <TooltipContent>Document title · from first heading</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Upload Markdown file"
                    onClick={() => fileInputRef.current?.click()}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <UploadIcon aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent>Upload Markdown · {modKey}O</TooltipContent>
            </Tooltip>

            <SettingsPopover
              chrome={chrome}
              filename={filename}
              inferredTitle={inferredTitle}
              modKey={modKey}
              onChromeChange={updateChrome}
              onChromeReset={() =>
                setChrome((c) => ({
                  ...c,
                  header: true,
                  footer: true,
                  date: true,
                  pageNumbers: true,
                  footerNote: "",
                }))
              }
              onFilenameChange={setFilename}
              onOpenChange={setSettingsOpen}
              onPageSizeChange={setPageSize}
              open={settingsOpen}
              pageSize={pageSize}
            />

            <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--rule)]" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    disabled={isPending}
                    onClick={exportPdf}
                    size="sm"
                    type="button"
                  >
                    {isPending ? (
                      <Loader2Icon
                        aria-hidden="true"
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ArrowDownToLineIcon aria-hidden="true" data-icon="inline-start" />
                    )}
                    Export PDF
                  </Button>
                }
              />
              <TooltipContent>Export · {modKey}E</TooltipContent>
            </Tooltip>

            <input
              ref={fileInputRef}
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </div>
        </header>

        {/* ———————————————————— Workspace —————————————————————— */}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(360px,0.9fr)_minmax(480px,1.1fr)] lg:grid-rows-1">
          {/* Editor */}
          <section
            aria-label="Markdown editor"
            className="relative flex min-h-[50dvh] min-w-0 flex-col border-b border-[var(--rule)] lg:min-h-0 lg:border-r lg:border-b-0"
            data-dragging={isDragging}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="relative flex-1 min-h-0 overflow-auto">
              <textarea
                aria-label="Markdown source"
                className="editor"
                onChange={(event) => setMarkdown(event.target.value)}
                placeholder="Paste or drop Markdown here…"
                spellCheck={false}
                value={markdown}
              />
              <div aria-hidden="true" className="drop-hint">
                Drop your Markdown file
              </div>
            </div>

            {/* Stats rail */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--rule)] px-5 py-2.5 text-[11.5px] text-muted-foreground">
              <span className="tabular-nums tracking-wide">
                {wordCount.toLocaleString()} words
                <span className="mx-1.5 opacity-40">·</span>
                {markdown.length.toLocaleString()} chars
              </span>
              <button
                className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground active:scale-[0.97]"
                onClick={loadSample}
                type="button"
              >
                Load sample
              </button>
            </div>
          </section>

          {/* Preview */}
          <section
            aria-label="PDF preview"
            className="flex min-w-0 flex-col bg-[var(--desk)]"
          >
            {/* Preset row */}
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--rule)] bg-background/70 px-5 py-3 backdrop-blur-sm sm:px-6">
              <fieldset className="preset-row">
                <legend className="sr-only">Preset</legend>
                {presets.map((p) => (
                  <Tooltip key={p.id}>
                    <TooltipTrigger
                      render={
                        <button
                          aria-label={`${p.name} preset`}
                          aria-pressed={preset === p.id}
                          className="preset-chip"
                          data-active={preset === p.id}
                          onClick={() => setPreset(p.id)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="dot"
                            style={{ color: p.swatch }}
                          />
                          {p.name}
                        </button>
                      }
                    />
                    <TooltipContent>{p.summary}</TooltipContent>
                  </Tooltip>
                ))}
              </fieldset>
            </div>

            {/* Paper */}
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="px-5 py-8 sm:px-10 sm:py-12">
                <MarkdownPreview
                  chromeTitle={chrome.title || inferredTitle}
                  footerNote={chrome.footerNote}
                  markdown={markdown || "# Untitled document"}
                  pageSize={pageSize}
                  preset={preset}
                  showDate={chrome.date}
                  showFooter={chrome.footer}
                  showHeader={chrome.header}
                  showPageNumbers={chrome.pageNumbers}
                />
              </div>
            </div>

            {/* Preview-foot meta */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--rule)] bg-background/70 px-5 py-2.5 text-[11.5px] text-muted-foreground sm:px-6">
              <span className="truncate">
                <span className="text-foreground/85">{activePreset.name}</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="truncate">{activePreset.summary}</span>
              </span>
              <span className="hidden shrink-0 tabular-nums sm:inline">
                {pageSize}
                <span className="mx-1.5 opacity-40">·</span>
                {filename || "md2pdf-export"}.pdf
              </span>
            </div>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}

type SettingsPopoverProps = {
  chrome: ChromeState;
  filename: string;
  inferredTitle: string;
  modKey: string;
  open: boolean;
  pageSize: PageSize;
  onChromeChange: (next: Partial<ChromeState>) => void;
  onChromeReset: () => void;
  onFilenameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPageSizeChange: (value: PageSize) => void;
};

function SettingsPopover({
  chrome,
  filename,
  inferredTitle,
  modKey,
  open,
  pageSize,
  onChromeChange,
  onChromeReset,
  onFilenameChange,
  onOpenChange,
  onPageSizeChange,
}: SettingsPopoverProps) {
  const isChromeDefault =
    chrome.header &&
    chrome.footer &&
    chrome.date &&
    chrome.pageNumbers &&
    chrome.footerNote === "";

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label="Document settings"
              render={
                <Button size="icon-sm" type="button" variant="ghost">
                  <SlidersHorizontalIcon aria-hidden="true" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Document settings · {modKey}/</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={10}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] font-medium tracking-tight">Document settings</p>
            <p className="text-[11.5px] leading-[1.55] text-muted-foreground">
              How the PDF exports.
            </p>
          </div>

          <label className="flex flex-col gap-1.5" htmlFor="filename">
            <span className="field-label">Filename</span>
            <Input
              id="filename"
              onChange={(e) => onFilenameChange(e.target.value)}
              placeholder="md2pdf-export"
              value={filename}
            />
          </label>

          <div className="flex items-center justify-between gap-4">
            <span className="field-label">Page size</span>
            <fieldset className="size-toggle">
              <legend className="sr-only">Page size</legend>
              <button
                aria-label="Letter page size"
                aria-pressed={pageSize === "Letter"}
                data-active={pageSize === "Letter"}
                onClick={() => onPageSizeChange("Letter")}
                type="button"
              >
                Letter
              </button>
              <button
                aria-label="A4 page size"
                aria-pressed={pageSize === "A4"}
                data-active={pageSize === "A4"}
                onClick={() => onPageSizeChange("A4")}
                type="button"
              >
                A4
              </button>
            </fieldset>
          </div>

          <div className="h-px bg-[var(--rule)]" />

          {/* Header group */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-[12.5px] font-medium" htmlFor="chrome-header">
                Header
              </label>
              <Switch
                checked={chrome.header}
                id="chrome-header"
                onCheckedChange={(v) => onChromeChange({ header: Boolean(v) })}
              />
            </div>
            <div
              className={cn(
                "flex flex-col gap-3 transition-opacity duration-150",
                !chrome.header && "pointer-events-none opacity-45",
              )}
            >
              <label className="flex flex-col gap-1.5" htmlFor="chrome-title">
                <span className="field-label">Title</span>
                <Input
                  disabled={!chrome.header}
                  id="chrome-title"
                  onChange={(e) => onChromeChange({ title: e.target.value })}
                  placeholder={inferredTitle}
                  value={chrome.title}
                />
              </label>
              <div className="flex items-center justify-between gap-4">
                <label className="field-label" htmlFor="chrome-date">
                  Show date
                </label>
                <Switch
                  checked={chrome.date}
                  disabled={!chrome.header}
                  id="chrome-date"
                  onCheckedChange={(v) => onChromeChange({ date: Boolean(v) })}
                  size="sm"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--rule)]" />

          {/* Footer group */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-[12.5px] font-medium" htmlFor="chrome-footer-on">
                Footer
              </label>
              <Switch
                checked={chrome.footer}
                id="chrome-footer-on"
                onCheckedChange={(v) => onChromeChange({ footer: Boolean(v) })}
              />
            </div>
            <div
              className={cn(
                "flex flex-col gap-3 transition-opacity duration-150",
                !chrome.footer && "pointer-events-none opacity-45",
              )}
            >
              <label className="flex flex-col gap-1.5" htmlFor="chrome-footer-note">
                <span className="field-label">Text</span>
                <Input
                  disabled={!chrome.footer}
                  id="chrome-footer-note"
                  onChange={(e) => onChromeChange({ footerNote: e.target.value })}
                  placeholder="Optional"
                  value={chrome.footerNote}
                />
              </label>
              <div className="flex items-center justify-between gap-4">
                <label className="field-label" htmlFor="chrome-pages">
                  Page numbers
                </label>
                <Switch
                  checked={chrome.pageNumbers}
                  disabled={!chrome.footer}
                  id="chrome-pages"
                  onCheckedChange={(v) => onChromeChange({ pageNumbers: Boolean(v) })}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {!isChromeDefault ? (
            <button
              className="-mt-1 self-end text-[11.5px] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground active:scale-[0.97]"
              onClick={onChromeReset}
              type="button"
            >
              Reset to defaults
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
