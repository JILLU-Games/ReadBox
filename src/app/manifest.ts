import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MailStack",
    short_name: "MailStack",
    description: "Private team mailbox workspace",
    start_url: "/users",
    display: "standalone",
    background_color: "#f3f6f8",
    theme_color: "#2457c5",
    icons: [
      {
        src: "/icons/mailstack.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
