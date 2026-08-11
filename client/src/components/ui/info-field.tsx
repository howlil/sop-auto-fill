import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface InfoFieldProps {
  /** Label (e.g. "Tanggal", "OPD", "Status") */
  label: string;
  /** Value — string or ReactNode (e.g. Badge, StatusBadge) */
  children?: ReactNode;
  /** Optional icon before the label. */
  icon?: ReactNode;
  /** Layout direction. */
  direction?: "horizontal" | "vertical";
  className?: string;
}

/**
 * A label:value display pair used in detail pages, info cards, and grid layouts.
 * Replaces the ~30 instances of ad-hoc `<span class="text-muted-foreground">Label:</span> <span>Value</span>` patterns.
 */
export function InfoField({
  label,
  children,
  icon,
  direction = "horizontal",
  className,
}: InfoFieldProps) {
  if (direction === "vertical") {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex items-center gap-1">
          {icon && (
            <span className="text-muted-foreground shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">
              {icon}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground leading-none">
            {label}
          </span>
        </div>
        <div className="text-xs font-medium text-foreground mt-0.5 truncate">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0 text-xs", className)}>
      {icon && (
        <span className="text-muted-foreground shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">
          {icon}
        </span>
      )}
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground truncate">{children}</span>
    </div>
  );
}
