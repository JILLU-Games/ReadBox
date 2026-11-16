import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      isAdministrator: boolean;
      isSuperuser: boolean;
      authSource?: "admin_table" | "user_table";
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    isAdministrator: boolean;
    isSuperuser: boolean;
    authSource?: "admin_table" | "user_table";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    username?: string;
    isAdministrator?: boolean;
    isSuperuser?: boolean;
    authSource?: "admin_table" | "user_table";
  }
}
