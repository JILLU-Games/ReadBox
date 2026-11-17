"use client";

import { Accordion } from "@/components/ui";
import { PUBLIC_FAQ_ITEMS, type PublicFaqItem } from "./public-faq-data";

export { PUBLIC_FAQ_ITEMS, type PublicFaqItem };

export function PublicFaqAccordion({
  items = PUBLIC_FAQ_ITEMS,
}: {
  readonly items?: readonly PublicFaqItem[];
}) {
  return (
    <Accordion
      items={items.map((item) => ({
        title: item.question,
        content: item.answer,
      }))}
      defaultOpenIndex={0}
    />
  );
}
