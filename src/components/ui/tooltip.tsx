"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function TooltipProvider({
  delay = 350,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider closeDelay={closeDelay} delay={delay} {...props} />;
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/* Module-scoped count of currently-mounted tooltip popups. When a new one
   mounts and finds the count > 0, another popup is already on-screen — we
   mark this one data-instant so it skips the enter animation. Linear/Vercel
   pattern: the first tooltip is deliberate, every adjacent one is instant. */
let openTooltipCount = 0;

function TooltipContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "side" | "sideOffset" | "align" | "alignOffset"
  >) {
  /* Snapshot the count synchronously during the first render so the attribute
     is correct on first paint. The lazy initializer runs once per mount. */
  const [instant] = useState(() => openTooltipCount > 0);

  useEffect(() => {
    openTooltipCount += 1;
    return () => {
      openTooltipCount -= 1;
    };
  }, []);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          data-instant={instant ? "" : undefined}
          className={cn("tooltip-content", className)}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
