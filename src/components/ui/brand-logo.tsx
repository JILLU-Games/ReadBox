import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Mail, type LucideIcon } from "lucide-react";
import Image from "next/image";

export interface BrandLogoProps {
  readonly siteName: string;
  readonly logoUrl?: string;
  readonly size?: "sm" | "md";
  readonly fallbackIcon?: LucideIcon;
  readonly showName?: boolean;
  readonly className?: string;
  readonly nameClassName?: string;
}

const SIZE_CLASSES = {
  sm: { box: "size-6", icon: "size-3.5", px: 24 },
  md: { box: "size-7", icon: "size-4", px: 28 },
} as const;

export function BrandLogo({
  siteName,
  logoUrl,
  size = "md",
  fallbackIcon = Mail,
  showName = true,
  className,
  nameClassName,
}: BrandLogoProps) {
  const resolvedName = siteName.trim() || "ReadBox";
  const dims = SIZE_CLASSES[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {logoUrl ? (
        <span
          aria-hidden="true"
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-none border border-border bg-card p-0.5",
            dims.box,
          )}
        >
          <Image
            src={logoUrl}
            alt=""
            width={dims.px}
            height={dims.px}
            referrerPolicy="no-referrer"
            className="size-full object-contain"
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "grid shrink-0 place-items-center rounded-none bg-primary text-primary-foreground",
            dims.box,
          )}
        >
          <Icon glyph={fallbackIcon} className={dims.icon} />
        </span>
      )}
      {showName ? (
        <span
          className={cn(
            "truncate text-xs font-medium tracking-tight text-foreground",
            nameClassName,
          )}
        >
          {resolvedName}
        </span>
      ) : null}
    </span>
  );
}
