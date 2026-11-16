export interface PublicFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const PUBLIC_FAQ_ITEMS: readonly PublicFaqItem[] = [
  {
    question: "How do I create an account and start using my mailbox workspace?",
    answer:
      "Click Sign up to register your workspace account. Depending on the platform's active User Control policy, your account is either activated immediately or queued for quick administrator approval, after which you can sign in to /users and create mailboxes on allowed domains.",
  },
  {
    question: "Can multiple team members read the same mailbox?",
    answer:
      "Yes. You can grant specific users read access to shared mailboxes such as support@, billing@, or operations@ without sharing a single password across your team, while also allowing self-service mailbox creation within each user's assigned quota.",
  },
  {
    question: "How do domain permissions, mailbox quotas, and auto-delete policies work?",
    answer:
      "Administrators configure global and per-user governance rules in the Users Control console—defining which verified domains a user can access, their maximum mailbox quota, self-service creation rights, and automated email retention (auto-delete) windows.",
  },
  {
    question: "How does the platform protect users when viewing HTML emails?",
    answer:
      "All HTML email bodies are sanitized on the server, stripped of scripts and unsafe attributes, and rendered inside a sandboxed iframe with remote tracking images and external stylesheets blocked.",
  },
  {
    question: "What DNS records are required for custom or enterprise domains?",
    answer:
      "Each domain uses standard MX, SPF, DKIM, and DMARC records. The administration console generates the exact records required for your domain and verifies them with live DNS checks. For custom enterprise domain onboarding, reach out via our Contact page.",
  },
];
