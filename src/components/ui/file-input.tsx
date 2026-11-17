import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function FileInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="file"
      className={cn(
        "block w-full rounded-none text-xs text-muted-foreground file:mr-2.5 file:cursor-pointer file:rounded-none file:border file:border-border file:bg-card file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
