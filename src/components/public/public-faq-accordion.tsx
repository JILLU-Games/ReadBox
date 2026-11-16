"use client";

import { Icon, Panel } from "@/components/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PUBLIC_FAQ_ITEMS, type PublicFaqItem } from "./public-faq-data";

export { PUBLIC_FAQ_ITEMS, type PublicFaqItem };

export function PublicFaqAccordion({
  items = PUBLIC_FAQ_ITEMS,
}: {
  readonly items?: readonly PublicFaqItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Panel className="divide-y divide-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="px-3 py-2.5">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenIndex((current) => (current === index ? null : index))
              }
              className="flex w-full items-center justify-between gap-3 text-left text-xs font-medium text-foreground"
            >
              <span>{item.question}</span>
              <Icon
                glyph={ChevronDown}
                className={`size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
                  isOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>
            {isOpen ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </Panel>
  );
}
