import { PUBLIC_FAQ_ITEMS, type PublicFaqItem } from "@/components/public/public-faq-data";

const ANYINBOX_FAQ_ITEMS: readonly PublicFaqItem[] = [
  {
    question: "What is AnyInbox used for?",
    answer: "AnyInbox helps you manage custom-domain mailboxes and read incoming email in one workspace. It is designed for inbound email management.",
  },
  {
    question: "Can I use my own email domain?",
    answer: "Custom-domain onboarding is available through the domain setup and verification process. Mailbox access depends on domains assigned to your account.",
  },
  {
    question: "Can teammates access a shared inbox?",
    answer: "Assigned team members can receive read access to shared mailboxes without sharing one account password. Access is subject to administrator permissions.",
  },
  {
    question: "Can AnyInbox send outbound email or connect through IMAP or POP3?",
    answer: "No. This workspace focuses on receiving and reading email. It does not include email compose/send, SMTP submission, or public IMAP/POP3 access.",
  },
  {
    question: "Where can I get help with domains and mailboxes?",
    answer: "Use the Contact page for domain onboarding, mailbox access questions, and workspace support.",
  },
];

const READBOX_HERO =
  "Self-service custom-domain mailboxes and private team workspaces.";

export interface PublicBrandPresentation {
  readonly displayName: string;
  readonly isAnyInbox: boolean;
  readonly heroTitle: string;
  readonly faqItems: readonly PublicFaqItem[];
  readonly aboutDescription: string;
  readonly aboutPoints: readonly string[];
}

/** Brand copy is isolated to the verified public origin; OSS ReadBox defaults stay intact. */
export function isAnyInboxOrigin(publicOrigin: string): boolean {
  try {
    const url = new URL(publicOrigin);
    return url.protocol === "https:" &&
      (url.hostname.toLowerCase() === "anyinbox.cc" ||
       url.hostname.toLowerCase() === "www.anyinbox.cc");
  } catch {
    return false;
  }
}

export function getPublicBrandPresentation(
  configuredSiteName: string,
  publicOrigin: string,
): PublicBrandPresentation {
  if (isAnyInboxOrigin(publicOrigin)) {
    return {
      displayName: "AnyInbox",
      isAnyInbox: true,
      heroTitle: "Your Email. One Simple Workspace.",
      faqItems: ANYINBOX_FAQ_ITEMS,
      aboutDescription: "AnyInbox is a custom-domain email and inbox management workspace for receiving and organizing incoming messages.",
      aboutPoints: [
        "Connect and verify approved custom domains, then create mailboxes on the domains available to your account.",
        "Read incoming messages, view attachments, and collaborate through mailbox permissions.",
        "AnyInbox is inbound-only: no outbound message composer, SMTP submission, or public IMAP/POP3 access is provided.",
      ],
    };
  }
  return {
    displayName: configuredSiteName || "ReadBox",
    isAnyInbox: false,
    heroTitle: READBOX_HERO,
    faqItems: PUBLIC_FAQ_ITEMS,
    aboutDescription: "A workspace for custom-domain mailboxes, shared inbox access, and reading incoming email.",
    aboutPoints: [
      "Create and manage mailboxes on domains available to your workspace.",
      "Read incoming messages and manage shared mailbox access.",
      "Outbound compose/send and public IMAP/POP3 are not provided.",
    ],
  };
}
