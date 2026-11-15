import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      isAdministrator: boolean;
      isSuperuser: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    isAdministrator: boolean;
    isSuperuser: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    username?: string;
    isAdministrator?: boolean;
    isSuperuser?: boolean;
  }
}
