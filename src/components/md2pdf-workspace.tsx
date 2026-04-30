"use client";

import {
  ArrowDownToLineIcon,
  EyeIcon,
  FileTextIcon,
  KeyboardIcon,
  Loader2Icon,
  PencilIcon,
  SlidersHorizontalIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type Command,
  CommandPalette,
  ShortcutsOverlay,
} from "@/components/command-palette";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShortcutKeys } from "@/components/ui/kbd";
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
import { CJK_FONTS_HREF, hasCJK } from "@/lib/pdf-cjk";

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
  title: "",
  date: true,
  pageNumbers: true,
  footerNote: "",
};

function TooltipShortcut({ label, keys }: { label: string; keys: string[] }) {
  return (
    <span className="tooltip-shortcut">
      <span>{label}</span>
      <ShortcutKeys keys={keys} />
    </span>
  );
}

type RecentFile = { name: string; markdown: string; ts: number };
const RECENTS_KEY = "md2pdf:recents";
const RECENTS_MAX = 3;

/* Upload + paste limits. The markdown source can carry pasted data URLs, so
   the source ceiling is 4MB; an individual pasted image caps at 3MB so a
   single screenshot can never crowd out the rest of the document. */
const MAX_MARKDOWN_BYTES = 4_000_000;
const MAX_INLINE_IMAGE_BYTES = 3_000_000;

/* Inspect the markdown for what's inside so the export toast can describe the
   stages truthfully — never claim to render math that isn't there. */
function inspectMarkdown(md: string) {
  const hasMath = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+?\$)/.test(md);
  const mermaidCount = (md.match(/```mermaid\s/g) ?? []).length;
  const imageCount = (md.match(/!\[[^\]]*\]\(/g) ?? []).length;
  return { hasMath, mermaidCount, imageCount };
}

type ToastStage = { id: string; description: string; durationMs: number };

function planExportStages({
  hasMath,
  mermaidCount,
  imageCount,
}: ReturnType<typeof inspectMarkdown>): ToastStage[] {
  const stages: ToastStage[] = [];
  if (hasMath)
    stages.push({ id: "math", description: "Rendering math…", durationMs: 400 });
  if (mermaidCount > 0)
    stages.push({
      id: "diagrams",
      description: "Drawing diagrams…",
      durationMs: 600 * mermaidCount,
    });
  if (imageCount > 0)
    stages.push({
      id: "images",
      description: "Loading images…",
      durationMs: Math.min(2000, 250 * imageCount),
    });
  // Final stage holds the toast until the response resolves; duration is unused.
  stages.push({ id: "typeset", description: "Typesetting PDF", durationMs: 0 });
  return stages;
}

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

function loadRecents(): RecentFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecents(recents: RecentFile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(recents.slice(0, RECENTS_MAX)),
    );
  } catch {
    /* ignore storage errors */
  }
}

export function Md2PdfWorkspace() {
  const [markdown, setMarkdown] = useState("");
  const [preset, setPreset] = useState<PdfPreset>("editorial");
  const [pageSize, setPageSize] = useState<PageSize>("Letter");
  const [filename, setFilename] = useState("md2pdf-export");
  const [chrome, setChrome] = useState<ChromeState>(initialChrome);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [titleFocusRequest, setTitleFocusRequest] = useState(0);
  const [pulseFidelity, setPulseFidelity] = useState(false);
  const [justActivatedPreset, setJustActivatedPreset] = useState<PdfPreset | null>(null);
  const [presetSwitching, setPresetSwitching] = useState(false);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  // Mobile view toggle — at <lg the workspace shows one pane at a time so
  // each gets the full viewport. Desktop ignores this and renders the split.
  const [view, setView] = useState<"edit" | "preview">("edit");
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

  // Load recents from localStorage on mount.
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  /* Pre-warm the PDF lambda. Vercel cold-starts cost ~1-2s for chromium's
     brotli extraction; if we kick it off while the user is reading or pasting
     markdown, their first export hits a warm lambda and feels instant. The
     HEAD handler returns immediately and triggers getBrowser() in the
     background. Failures are silent — warmup must never surface. */
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/pdf`, {
      method: "HEAD",
    }).catch(() => {
      /* ignore — warmup is best-effort */
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);

  const inferredTitle = useMemo(() => inferTitle(markdown), [markdown]);

  /* Detect CJK reactively so the Noto Sans/Serif CDN load only happens when
     the user actually has CJK content in the editor or document title.
     Latin-only sessions (the majority) skip the CSS fetch entirely. Once
     loaded the browser caches it so adding more CJK content is free.
     The dns-prefetch hints in layout.tsx pre-warm the CDN connection so
     this lazy load lands faster when it does fire. */
  const needsCjkFonts = useMemo(
    () => hasCJK(`${markdown}\n${chrome.title}`),
    [markdown, chrome.title],
  );
  const activePreset = getPreset(preset);
  const wordCount = useMemo(
    () => markdown.trim().split(/\s+/).filter(Boolean).length,
    [markdown],
  );
  const isEmpty = markdown.trim().length === 0;
  const showInferredTitle = !isEmpty && inferredTitle !== "Untitled document";

  const updateChrome = useCallback((next: Partial<ChromeState>) => {
    setChrome((current) => ({ ...current, ...next }));
  }, []);

  const recordRecent = useCallback((name: string, content: string) => {
    setRecents((prev) => {
      const next = [
        { name, markdown: content, ts: Date.now() },
        ...prev.filter((r) => r.name !== name),
      ].slice(0, RECENTS_MAX);
      saveRecents(next);
      return next;
    });
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(md|markdown|txt)$/i)) {
        toast.error("Markdown files only", {
          description: "Upload a .md, .markdown, or .txt file.",
        });
        return;
      }

      if (file.size > MAX_MARKDOWN_BYTES) {
        toast.error("File too large", {
          description: "Markdown files this size aren't supported (limit: 4 MB).",
        });
        return;
      }

      const text = await file.text();
      setMarkdown(text);
      setFilename(file.name.replace(/\.(md|markdown|txt)$/i, ""));
      setChrome((current) => ({ ...current, title: inferTitle(text) }));
      recordRecent(file.name, text);
      toast.success(`Loaded — ${file.name}`);
    },
    [recordRecent],
  );

  // Read an image File, encode as a data URL, and splice ![](data:…) at the
  // textarea cursor — preserving the user's caret position. Used by both
  // paste and drop. Refuses anything over 3MB so pasted screenshots can't
  // accidentally inflate the source past the upload ceiling.
  const insertImageAtCursor = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return false;
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      toast.error("Image too large", {
        description:
          "Embedded images can be up to 3 MB. Host larger images and link them instead.",
      });
      return true; // handled (rejected) — caller should not fall through
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const insertion = `![](${dataUrl})`;
    const textarea = editorRef.current;

    setMarkdown((current) => {
      const start = textarea?.selectionStart ?? current.length;
      const end = textarea?.selectionEnd ?? current.length;
      const next = current.slice(0, start) + insertion + current.slice(end);
      // Restore cursor on the next paint, after React applies the new value.
      requestAnimationFrame(() => {
        if (!textarea) return;
        const cursor = start + insertion.length;
        textarea.setSelectionRange(cursor, cursor);
        textarea.focus();
      });
      return next;
    });

    toast.success("Image embedded");
    return true;
  }, []);

  const exportPdf = useCallback(() => {
    if (!markdown.trim()) {
      toast.error("Nothing to export yet", {
        description: "Paste or drop Markdown to get started.",
      });
      return;
    }

    /* Multi-stage toast — describe what's happening in honest terms.
       Stages are derived from the markdown's actual contents, so a plain-text
       document still sees a single "Typesetting PDF" message. The toast id
       is shared across stages so we update in place rather than spawning
       new toasts. */
    const stages = planExportStages(inspectMarkdown(markdown));
    const exportToast = toast.loading(stages[0].description);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (let i = 1; i < stages.length; i++) {
      elapsed += stages[i - 1].durationMs;
      const stage = stages[i];
      timers.push(
        setTimeout(() => toast.loading(stage.description, { id: exportToast }), elapsed),
      );
    }
    // Honest fallback if the real export overshoots the estimate by 4s.
    const totalEstimate = stages.slice(0, -1).reduce((acc, s) => acc + s.durationMs, 0);
    timers.push(
      setTimeout(
        () => toast.loading("Still typesetting…", { id: exportToast }),
        totalEstimate + 4000,
      ),
    );
    const clearStageTimers = () => {
      for (const t of timers) clearTimeout(t);
    };

    startTransition(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/pdf`,
          {
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
          },
        );

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

        clearStageTimers();
        toast.success("PDF exported", {
          id: exportToast,
          description: `${activePreset.name} · ${pageSize}`,
        });

        /* Quiet sky pulse on the fidelity tag — closes the loop where the eye
           returns. Cleared on animationend so CSS owns the duration. */
        setPulseFidelity(true);
      } catch (error) {
        clearStageTimers();
        toast.error("Export failed", {
          id: exportToast,
          description: error instanceof Error ? error.message : "Try again in a moment.",
        });
      }
    });
  }, [
    activePreset.name,
    chrome.date,
    chrome.footer,
    chrome.footerNote,
    chrome.header,
    chrome.pageNumbers,
    chrome.title,
    filename,
    inferredTitle,
    markdown,
    pageSize,
    preset,
  ]);

  const applySample = useCallback(() => {
    setMarkdown(sampleMarkdown);
    setChrome((c) => ({ ...c, title: "" }));
    setFilename("welcome");
  }, []);

  const loadSample = useCallback(() => {
    const dirty = markdown.trim() !== "" && markdown !== sampleMarkdown;
    if (!dirty) {
      applySample();
      return;
    }
    toast.warning("Replace your content?", {
      description: "Your current Markdown will be overwritten.",
      action: { label: "Replace", onClick: applySample },
    });
  }, [markdown, applySample]);

  // User-driven preset change. Triggers a one-shot chip glow and a brief
  // document-content blur to mask reflow. No-op when the preset is unchanged.
  const pickPreset = useCallback((next: PdfPreset) => {
    setPreset((current) => {
      if (current === next) return current;
      setJustActivatedPreset(next);
      setPresetSwitching(true);
      return next;
    });
  }, []);

  function openTitleEdit() {
    setSettingsOpen(true);
    setTitleFocusRequest((n) => n + 1);
  }

  const loadRecent = useCallback((recent: RecentFile) => {
    setMarkdown(recent.markdown);
    setFilename(recent.name.replace(/\.(md|markdown|txt)$/i, ""));
    setChrome((current) => ({ ...current, title: inferTitle(recent.markdown) }));
    toast.success(`Loaded — ${recent.name}`);
  }, []);

  // Stable refs for the global keydown handler — avoids re-binding on every render.
  const exportRef = useRef(exportPdf);
  exportRef.current = exportPdf;
  const loadSampleRef = useRef(loadSample);
  loadSampleRef.current = loadSample;
  const pickPresetRef = useRef(pickPreset);
  pickPresetRef.current = pickPreset;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const isMod = e.metaKey || e.ctrlKey;

      // ? opens shortcuts overlay (only when not editing text).
      if (!isMod && !e.altKey && e.key === "?" && !inEditable) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (!isMod || e.altKey) return;
      const key = e.key.toLowerCase();

      // ⌘K opens the command palette.
      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
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
        pickPresetRef.current(presets[idx].id);
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
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    /* Prefer markdown when both kinds are dropped — the .md is the headline
       action; images are an additive convenience. */
    const markdownFile = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
    if (markdownFile) {
      void handleFile(markdownFile);
      return;
    }
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (imageFile) {
      void insertImageAtCursor(imageFile);
      return;
    }
    // Falls through to the existing markdown validator's error path so the
    // user gets a clear "Markdown files only" toast for unsupported types.
    void handleFile(files[0]);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find(
      (it) => it.kind === "file" && it.type.startsWith("image/"),
    );
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    void insertImageAtCursor(file);
  }

  // Build commands for the palette. Order matters — first match is the default-selected.
  const commands: Command[] = useMemo(() => {
    const presetCommands: Command[] = presets.map((p, i) => ({
      id: `preset-${p.id}`,
      label: `${p.name} · ${p.verb}`,
      keywords: `${p.verb} ${p.summary} ${p.accent}`,
      shortcut: [modKey, String(i + 1)],
      group: "Presets",
      action: () => pickPreset(p.id),
    }));

    const recentCommands: Command[] = recents.map((r) => ({
      id: `recent-${r.name}`,
      label: r.name,
      keywords: "recent file",
      group: "Recent",
      icon: FileTextIcon,
      action: () => loadRecent(r),
    }));

    return [
      ...recentCommands,
      {
        id: "export",
        label: "Export PDF",
        keywords: "download save pdf",
        shortcut: [modKey, "E"],
        group: "Document",
        icon: ArrowDownToLineIcon,
        action: () => exportRef.current(),
      },
      {
        id: "open",
        label: "Open Markdown file…",
        keywords: "upload file md",
        shortcut: [modKey, "O"],
        group: "Document",
        icon: UploadIcon,
        action: () => fileInputRef.current?.click(),
      },
      {
        id: "sample",
        label: "Load sample document",
        keywords: "demo welcome",
        group: "Document",
        action: () => loadSampleRef.current(),
      },
      ...presetCommands,
      {
        id: "size-letter",
        label: "Page size · Letter",
        keywords: "us letter inches",
        group: "View",
        action: () => setPageSize("Letter"),
      },
      {
        id: "size-a4",
        label: "Page size · A4",
        keywords: "metric european",
        group: "View",
        action: () => setPageSize("A4"),
      },
      {
        id: "toggle-header",
        label: chrome.header ? "Hide document header" : "Show document header",
        group: "View",
        action: () => updateChrome({ header: !chrome.header }),
      },
      {
        id: "toggle-footer",
        label: chrome.footer ? "Hide document footer" : "Show document footer",
        group: "View",
        action: () => updateChrome({ footer: !chrome.footer }),
      },
      {
        id: "settings",
        label: "Document settings",
        keywords: "options chrome header footer",
        shortcut: [modKey, "/"],
        group: "View",
        icon: SlidersHorizontalIcon,
        action: () => setSettingsOpen(true),
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        keywords: "help hotkeys",
        shortcut: ["?"],
        group: "View",
        icon: KeyboardIcon,
        action: () => setShortcutsOpen(true),
      },
    ];
  }, [
    chrome.footer,
    chrome.header,
    modKey,
    recents,
    updateChrome,
    loadRecent,
    pickPreset,
  ]);

  return (
    <TooltipProvider>
      {/* React 19 hoists <link> to <head>. Rendered only when the markdown
          (or document title) contains CJK characters, so Latin-only users
          never pay the CSS fetch. Browser caches the response after first
          load, so toggling content in/out of CJK doesn't refetch. */}
      {needsCjkFonts ? <link rel="stylesheet" href={CJK_FONTS_HREF} /> : null}
      <main className="flex h-dvh flex-col bg-background text-foreground">
        {/* ———————————————————— Top bar — sticky on every viewport.
            Mobile is upgraded to a three-column grid in CSS so the view
            switcher stays centered while the right-side actions fit cleanly.
            lg+ keeps the normal flex row and lets the title chip breathe. */}
        <header className="topbar relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--rule)] bg-background/90 px-4 backdrop-blur-sm sm:gap-4 sm:px-7">
          <div className="topbar-brand flex min-w-0 flex-1 items-center gap-3 lg:flex-initial">
            <span className="brand select-none">md2pdf</span>
            {showInferredTitle ? (
              <>
                <span
                  aria-hidden="true"
                  className="hidden h-3.5 w-px bg-[var(--rule)] lg:block"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        aria-label="Edit document title"
                        className="title-chip hidden max-w-[28ch] truncate text-xs lg:inline-flex"
                        onClick={openTitleEdit}
                        type="button"
                      >
                        {inferredTitle}
                      </button>
                    }
                  />
                  <TooltipContent>Edit title</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>

          {/* Mobile/tablet view switcher — replaces the split layout below `lg`. */}
          <fieldset className="view-tabs lg:hidden" aria-label="View">
            <legend className="sr-only">View</legend>
            <button
              aria-label="Edit Markdown"
              aria-pressed={view === "edit"}
              data-active={view === "edit"}
              onClick={() => setView("edit")}
              type="button"
            >
              <PencilIcon aria-hidden="true" className="size-3.5" />
              <span>Edit</span>
            </button>
            <button
              aria-label="Preview document"
              aria-pressed={view === "preview"}
              data-active={view === "preview"}
              onClick={() => setView("preview")}
              type="button"
            >
              <EyeIcon aria-hidden="true" className="size-3.5" />
              <span>Preview</span>
            </button>
          </fieldset>

          <div className="topbar-actions flex flex-1 items-center justify-end gap-1 lg:flex-initial">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Upload Markdown file"
                    className="mobile-upload-trigger"
                    onClick={() => fileInputRef.current?.click()}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <UploadIcon aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent>
                <TooltipShortcut keys={[modKey, "O"]} label="Open" />
              </TooltipContent>
            </Tooltip>

            <SettingsPopover
              chrome={chrome}
              filename={filename}
              focusTitleRequest={titleFocusRequest}
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
                    aria-label={isPending ? "Exporting PDF" : "Export PDF"}
                    className="export-button"
                    disabled={isPending}
                    onClick={exportPdf}
                    size="sm"
                    type="button"
                    variant="accent"
                  >
                    <span
                      className="icon-stack"
                      data-icon="inline-start"
                      data-pending={isPending}
                    >
                      <ArrowDownToLineIcon aria-hidden="true" data-role="default" />
                      <Loader2Icon
                        aria-hidden="true"
                        className="animate-spin"
                        data-role="pending"
                      />
                    </span>
                    <span className="export-button-label">
                      <span className="export-button-label-short">
                        {isPending ? "…" : "PDF"}
                      </span>
                      <span className="export-button-label-full">
                        {isPending ? "Exporting…" : "Export PDF"}
                      </span>
                    </span>
                  </Button>
                }
              />
              <TooltipContent>
                <TooltipShortcut keys={[modKey, "E"]} label="Export" />
              </TooltipContent>
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

        {/* ———————————————————— Workspace — fixed-viewport grid with
            internal pane scrolling. Top bar stays sticky on every device.
            <lg: a single full-height pane chosen by the view toggle, so the
            content has the room it needs and the keyboard never collides.
            lg+: classic two-pane split. */}
        <div className="grid flex-1 min-h-0 grid-cols-1 grid-rows-1 lg:grid-cols-[minmax(360px,0.9fr)_minmax(480px,1.1fr)]">
          {/* Editor */}
          <section
            aria-label="Markdown editor"
            className="relative flex min-h-0 min-w-0 flex-col overflow-hidden lg:border-r lg:border-[var(--rule)] data-[mobile-hidden=true]:hidden lg:!flex"
            data-dragging={isDragging}
            data-mobile-hidden={view !== "edit"}
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
                onPaste={handlePaste}
                ref={editorRef}
                spellCheck={false}
                value={markdown}
              />
              {/* Empty-state hint sits behind the textarea while there's no content. */}
              <div
                aria-hidden="true"
                className="editor-empty"
                data-hidden={!isEmpty || isDragging}
              >
                <span className="editor-empty-icon">
                  <FileTextIcon aria-hidden="true" className="size-5" />
                </span>
                <span className="editor-empty-prompt">
                  Paste Markdown, drop a{" "}
                  <code className="font-mono text-[12px]">.md</code> file, or{" "}
                  <button onClick={loadSample} type="button">
                    load the sample
                  </button>
                  .
                  <span className="editor-empty-secondary">
                    Math, diagrams, and images render too.
                  </span>
                </span>
              </div>
              <div aria-hidden="true" className="drop-hint">
                Drop your Markdown file
              </div>
            </div>

            {/* Stats rail — taller on touch so "Load sample" is a real
                tap target, normal on desktop where pointer-fine handles it. */}
            <div className="stats-rail flex shrink-0 items-center justify-between gap-3 border-t border-[var(--rule)] px-5 text-[11.5px] text-muted-foreground sm:px-7">
              <span className="tabular-nums tracking-wide">
                {wordCount.toLocaleString()} words
                <span className="mx-1.5 opacity-40">·</span>
                {markdown.length.toLocaleString()} chars
              </span>
              <button
                className="stats-rail-action text-muted-foreground hover:text-foreground active:scale-[0.97]"
                onClick={loadSample}
                style={{
                  transition:
                    "color 160ms var(--ease-out), transform 140ms var(--ease-out)",
                }}
                type="button"
              >
                Load sample
              </button>
            </div>
          </section>

          {/* Preview */}
          <section
            aria-label="PDF preview"
            className="flex min-w-0 flex-col bg-[var(--desk)] data-[mobile-hidden=true]:hidden lg:!flex"
            data-mobile-hidden={view !== "preview"}
          >
            {/* Preset row — tighter vertical chrome on phones so the paper
                wins more of the small viewport; restored on desktop. */}
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--rule)] bg-background/70 px-5 py-2.5 backdrop-blur-sm sm:px-7 sm:py-3">
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
                          data-just-activated={justActivatedPreset === p.id}
                          onAnimationEnd={(e) => {
                            /* Clear the one-shot glow when its keyframe ends.
                               CSS owns the 600ms duration; we just react. */
                            if (
                              e.animationName === "chip-activate" &&
                              justActivatedPreset === p.id
                            ) {
                              setJustActivatedPreset(null);
                            }
                          }}
                          onClick={() => pickPreset(p.id)}
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
                    <TooltipContent>
                      <span className="tooltip-verb">{p.verb}</span>
                      <span className="tooltip-sep" aria-hidden="true">
                        {" · "}
                      </span>
                      <span className="tooltip-summary">{p.summary}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </fieldset>
            </div>

            {/* Paper — internal scroll on every viewport so the navbar
                stays sticky and only the preview pane scrolls. Phone-tight
                vertical padding keeps `--desk` from dwarfing the document. */}
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="px-5 py-6 sm:px-10 sm:py-16">
                <MarkdownPreview
                  chromeTitle={chrome.title || inferredTitle}
                  footerNote={chrome.footerNote}
                  markdown={markdown || "# Untitled document"}
                  onSwitchingDone={() => setPresetSwitching(false)}
                  pageSize={pageSize}
                  preset={preset}
                  showDate={chrome.date}
                  showFooter={chrome.footer}
                  showHeader={chrome.header}
                  showPageNumbers={chrome.pageNumbers}
                  switching={presetSwitching}
                />
              </div>
            </div>

            {/* Preview-foot meta */}
            <div className="preview-foot flex shrink-0 items-center justify-between gap-3 border-t border-[var(--rule)] bg-background/70 px-5 py-2 text-[11.5px] text-muted-foreground sm:px-7">
              <span className="min-w-0 flex-1 truncate">
                <span className="text-foreground/85">{activePreset.name}</span>
                <span className="mx-1.5 hidden opacity-40 sm:inline">·</span>
                <span className="hidden truncate sm:inline">{activePreset.summary}</span>
              </span>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="fidelity-tag inline-flex shrink-0">
                      <span
                        aria-hidden
                        className="fidelity-tag-dot"
                        data-pulse={pulseFidelity}
                        onAnimationEnd={(e) => {
                          /* The dot also runs `fidelity-breath` infinitely;
                             we only care about the one-shot pulse. */
                          if (e.animationName === "fidelity-pulse") {
                            setPulseFidelity(false);
                          }
                        }}
                      />
                      <span className="hidden sm:inline">Matches PDF</span>
                    </span>
                  }
                />
                <TooltipContent>Frame-perfect — no surprises on export.</TooltipContent>
              </Tooltip>

              <span className="hidden shrink-0 tabular-nums sm:inline">
                {pageSize}
                <span className="mx-1.5 opacity-40">·</span>
                {filename || "md2pdf-export"}.pdf
              </span>
            </div>
          </section>
        </div>
      </main>

      <CommandPalette
        commands={commands}
        onOpenChange={setPaletteOpen}
        open={paletteOpen}
      />
      <ShortcutsOverlay
        modKey={modKey}
        onOpenChange={setShortcutsOpen}
        open={shortcutsOpen}
      />
    </TooltipProvider>
  );
}

type SettingsPopoverProps = {
  chrome: ChromeState;
  filename: string;
  focusTitleRequest: number;
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
  focusTitleRequest,
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

  const titleInputRef = useRef<HTMLInputElement>(null);

  // When the parent asks us to focus the title field, do so on the next paint
  // (after the popover has rendered).
  useEffect(() => {
    if (focusTitleRequest > 0 && open) {
      const id = requestAnimationFrame(() => titleInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [focusTitleRequest, open]);

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label="Document settings"
              render={
                <Button
                  className="settings-trigger"
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <SlidersHorizontalIcon aria-hidden="true" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>
          <TooltipShortcut keys={[modKey, "/"]} label="Settings" />
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium tracking-tight">Document settings</p>
            <ShortcutKeys
              className="cmdk-item-shortcut"
              keyClassName="cmdk-kbd"
              keys={[modKey, "/"]}
            />
          </div>

          <label className="flex flex-col gap-1.5" htmlFor="filename">
            <span className="field-label">Filename</span>
            <span className="filename-row">
              <Input
                id="filename"
                onChange={(e) => onFilenameChange(e.target.value)}
                placeholder="md2pdf-export"
                value={filename}
              />
            </span>
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
            <div className="collapsible-rows" data-collapsed={!chrome.header}>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5" htmlFor="chrome-title">
                  <span className="field-label">Title</span>
                  <Input
                    disabled={!chrome.header}
                    id="chrome-title"
                    onChange={(e) => onChromeChange({ title: e.target.value })}
                    placeholder={inferredTitle}
                    ref={titleInputRef}
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
                  />
                </div>
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
            <div className="collapsible-rows" data-collapsed={!chrome.footer}>
              <div className="flex flex-col gap-3">
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
                  />
                </div>
              </div>
            </div>
          </div>

          {!isChromeDefault ? (
            <button className="reset-defaults" onClick={onChromeReset} type="button">
              Reset to defaults
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
