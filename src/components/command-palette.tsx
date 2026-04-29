"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type Command = {
  id: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string;
  shortcut?: string[];
  group?: string;
  disabled?: boolean;
  action: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
};

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands by lowercase substring across label + keywords.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => !c.disabled);
    return commands.filter((c) => {
      if (c.disabled) return false;
      const haystack = `${c.label} ${c.keywords ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  // Group commands for display, preserving insertion order.
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const key = c.group ?? "";
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  /* Clamp the cursor to the filtered list at read time instead of syncing
     via useEffect. selectedIdx may drift past the list as the user types,
     but the value we render and act on is always in range. */
  const clampedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));

  /* Reset query at the source of the change — when the palette is closed —
     rather than reacting to `open` via useEffect. Same for cursor reset on
     query change: lift the side effect to the setter. */
  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setSelectedIdx(0);
    }
    onOpenChange(next);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setSelectedIdx(0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(Math.min(filtered.length - 1, clampedIdx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(Math.max(0, clampedIdx - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[clampedIdx];
      if (cmd) {
        handleOpenChange(false);
        // Defer so the close animation can start before the action fires.
        requestAnimationFrame(() => cmd.action());
      }
    }
  }

  return (
    <DialogPrimitive.Root onOpenChange={handleOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="cmdk-backdrop" />
        <DialogPrimitive.Popup
          className="cmdk-popup"
          initialFocus={inputRef}
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Commands</DialogPrimitive.Title>
          <input
            aria-label="Command search"
            className="cmdk-input"
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search commands…"
            ref={inputRef}
            type="text"
            value={query}
          />
          <div className="cmdk-list" role="listbox">
            {filtered.length === 0 ? (
              <div className="cmdk-empty">No matches</div>
            ) : (
              groups.map(([group, items]) => (
                <div key={group || "default"}>
                  {group ? <div className="cmdk-group-label">{group}</div> : null}
                  {items.map((cmd) => {
                    const flatIdx = filtered.indexOf(cmd);
                    const Icon = cmd.icon;
                    return (
                      <button
                        aria-selected={flatIdx === clampedIdx}
                        className="cmdk-item"
                        data-selected={flatIdx === clampedIdx}
                        key={cmd.id}
                        onClick={() => {
                          handleOpenChange(false);
                          requestAnimationFrame(() => cmd.action());
                        }}
                        onMouseEnter={() => setSelectedIdx(flatIdx)}
                        role="option"
                        tabIndex={-1}
                        type="button"
                      >
                        {Icon ? (
                          <Icon aria-hidden="true" className="cmdk-item-icon" />
                        ) : (
                          <span aria-hidden="true" className="cmdk-item-icon" />
                        )}
                        <span className="cmdk-item-label">{cmd.label}</span>
                        {cmd.shortcut ? (
                          <span className="cmdk-item-shortcut">
                            {cmd.shortcut.map((k) => (
                              <kbd className="cmdk-kbd" key={`${cmd.id}-${k}`}>
                                {k}
                              </kbd>
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type ShortcutsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modKey: string;
};

export function ShortcutsOverlay({ open, onOpenChange, modKey }: ShortcutsOverlayProps) {
  const groups: { label: string; items: { keys: string[]; description: string }[] }[] = [
    {
      label: "Document",
      items: [
        { keys: [modKey, "E"], description: "Export PDF" },
        { keys: [modKey, "O"], description: "Open Markdown file" },
      ],
    },
    {
      label: "Presets",
      items: [
        { keys: [modKey, "1"], description: "Editorial" },
        { keys: [modKey, "2"], description: "Technical" },
        { keys: [modKey, "3"], description: "Business" },
        { keys: [modKey, "4"], description: "Academic" },
      ],
    },
    {
      label: "View",
      items: [
        { keys: [modKey, "K"], description: "Open command palette" },
        { keys: [modKey, "/"], description: "Document settings" },
        { keys: [modKey, "D"], description: "Toggle dark mode" },
        { keys: ["?"], description: "Show this overlay" },
      ],
    },
  ];

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="cmdk-backdrop" />
        <DialogPrimitive.Popup className="cmdk-popup">
          <DialogPrimitive.Title className="cmdk-input" style={{ fontWeight: 600 }}>
            Keyboard shortcuts
          </DialogPrimitive.Title>
          <div className="cmdk-list">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="cmdk-group-label">{g.label}</div>
                {g.items.map((it) => (
                  <div className="cmdk-item" key={`${g.label}-${it.description}`}>
                    <span className="cmdk-item-icon" />
                    <span className="cmdk-item-label">{it.description}</span>
                    <span className="cmdk-item-shortcut">
                      {it.keys.map((k) => (
                        <kbd
                          className="cmdk-kbd"
                          key={`${g.label}-${it.description}-${k}`}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
