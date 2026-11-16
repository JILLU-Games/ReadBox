export interface PublicFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const PUBLIC_FAQ_ITEMS: readonly PublicFaqItem[] = [
  {
    question: "How do I create an account and start using my mailbox workspace?",
    answer:
      "Click Sign up to register your workspace account. Once your account is active, you can sign in to your workspace and create mailboxes on available domains.",
  },
  {
    question: "Can multiple team members read the same mailbox?",
    answer:
      "Yes. You can grant specific users read access to shared mailboxes such as support@, billing@, or operations@ without sharing a single password across your team, while also allowing self-service mailbox creation within each user's assigned limit.",
  },
  {
    question: "How do domain permissions, mailbox limits, and message retention work?",
    answer:
      "Each workspace account includes defined domain access, mailbox creation limits, and optional automated message retention windows so your inboxes stay organized automatically.",
  },
  {
    question: "How does the platform protect users when viewing HTML emails?",
    answer:
      "All HTML email bodies are cleaned before display, with scripts, tracking pixels, and unsafe external content blocked automatically.",
  },
  {
    question: "How can I connect a custom or organization domain?",
    answer:
      "To onboard a custom domain for your team or organization, submit a request through our Contact page and our support team will assist with setup and verification.",
  },
];
