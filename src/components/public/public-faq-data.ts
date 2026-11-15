export interface PublicFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const PUBLIC_FAQ_ITEMS: readonly PublicFaqItem[] = [
  {
    question: "How is MailStack different from standard consumer email?",
    answer:
      "MailStack is built for custom domains and controlled organizational workflows. Instead of unmanaged personal accounts, administrators provision mailboxes, control who can read each address, verify DNS records, and maintain a complete audit trail.",
  },
  {
    question: "Can multiple team members read the same mailbox?",
    answer:
      "Yes. You can grant specific users read access to shared mailboxes such as support@, billing@, or operations@ without sharing a single password across your team.",
  },
  {
    question: "How does MailStack protect users when viewing HTML emails?",
    answer:
      "All HTML email bodies are sanitized on the server, stripped of scripts and unsafe attributes, and rendered inside a sandboxed iframe with remote tracking images and external stylesheets blocked.",
  },
  {
    question: "What DNS records are required for a custom domain?",
    answer:
      "Each domain uses standard MX, SPF, DKIM, and DMARC records. The MailStack administration console generates the exact records required for your domain and verifies them with live DNS checks.",
  },
  {
    question: "How do we request a new mailbox or custom domain setup?",
    answer:
      "Use the online contact form to share your domain, expected mailbox count, and team requirements. Our administration team reviews each request and guides you through onboarding.",
  },
];
