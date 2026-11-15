"use client";

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
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="px-4 py-3">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenIndex((current) => (current === index ? null : index))
              }
              className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-foreground sm:text-sm"
            >
              <span>{item.question}</span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
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
    </div>
  );
}
