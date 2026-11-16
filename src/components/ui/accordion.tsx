"use client";

import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export interface AccordionItem {
  readonly id?: string;
  readonly title: string;
  readonly content: string;
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[];
  readonly defaultOpenIndex?: number | null;
  readonly className?: string;
}

export function Accordion({
  items,
  defaultOpenIndex = 0,
  className,
}: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <Panel className={cn("divide-y divide-border", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.id ?? item.title} className="px-3 py-2.5">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenIndex((current) => (current === index ? null : index))
              }
              className="flex w-full items-center justify-between gap-3 rounded-none text-left text-xs font-medium text-foreground transition-colors hover:text-primary"
            >
              <span>{item.title}</span>
              <Icon
                glyph={ChevronDown}
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                  isOpen && "rotate-180 text-primary",
                )}
              />
            </button>
            {isOpen ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.content}
              </p>
            ) : null}
          </div>
        );
      })}
    </Panel>
  );
}
