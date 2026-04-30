import type * as React from "react";
import { cn } from "@/lib/utils";

type KbdProps = React.ComponentProps<"kbd">;

function Kbd({ className, children, ...props }: KbdProps) {
  const label = typeof children === "string" ? children : "";

  return (
    <kbd
      className={cn("ui-kbd", className)}
      data-wide={label.length > 1 || undefined}
      {...props}
    >
      {children}
    </kbd>
  );
}

function ShortcutKeys({
  className,
  keyClassName,
  keys,
}: {
  className?: string;
  keyClassName?: string;
  keys: string[];
}) {
  return (
    <span className={cn("shortcut-keys", className)}>
      {keys.map((key) => (
        <Kbd className={keyClassName} key={key}>
          {key}
        </Kbd>
      ))}
    </span>
  );
}

export { Kbd, ShortcutKeys };
