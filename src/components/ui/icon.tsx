import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

type IconProps = Omit<ComponentProps<LucideIcon>, "ref"> & {
  glyph: LucideIcon;
  label?: string;
};

export function Icon({ glyph: Glyph, label, className, ...props }: IconProps) {
  return (
    <Glyph
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("size-4 shrink-0", className)}
      {...props}
    />
  );
}
