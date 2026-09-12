import type { DefaultSession } from "next-auth";

type Role = "OWNER" | "MEMBER";

declare module "next-auth" {
  interface Session {
    // storeId rides in the token so every request can scope its queries without
    // a database round-trip just to discover which store the user belongs to.
    user: { id: string; role: Role; storeId: string } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    storeId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    storeId?: string;
  }
}
