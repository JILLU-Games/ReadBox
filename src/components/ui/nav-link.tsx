import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

const navLinkVariants = cva(
  "inline-flex items-center gap-2 rounded-none text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        header: "shrink-0 px-2.5 py-1.5",
        sidebar: "flex min-h-8 w-full px-2.5",
        sidebarSub: "flex min-h-7 w-full px-2",
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "header",
        active: true,
        class: "bg-secondary text-foreground",
      },
      {
        variant: "header",
        active: false,
        class: "text-muted-foreground hover:bg-muted hover:text-foreground",
      },
      {
        variant: ["sidebar", "sidebarSub"],
        active: true,
        class: "bg-sidebar-active text-sidebar-active-foreground",
      },
      {
        variant: ["sidebar", "sidebarSub"],
        active: false,
        class: "text-sidebar-muted hover:bg-muted hover:text-sidebar-foreground",
      },
    ],
    defaultVariants: {
      variant: "header",
      active: false,
    },
  },
);

export type NavLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  VariantProps<typeof navLinkVariants> & {
    readonly active?: boolean;
    readonly children: ReactNode;
  };

export function NavLink({
  variant = "header",
  active = false,
  className,
  children,
  ...props
}: NavLinkProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(navLinkVariants({ variant, active }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
