import { Icon } from "@/components/ui/icon";
import { PageTitle } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  readonly id?: string;
  readonly title: ReactNode;
  readonly icon?: LucideIcon;
  readonly badge?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function PageHeader({
  id,
  title,
  icon,
  badge,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-none border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <Icon glyph={icon} className="size-4 shrink-0 text-primary" />
          ) : null}
          <PageTitle id={id} className="truncate">
            {title}
          </PageTitle>
          {badge}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </header>
  );
}
