import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

export type Role = "OWNER" | "MEMBER";

/**
 * Credentials-only auth against our own User table.
 *
 * Signing up creates a store and its OWNER; every other account is added by that
 * owner from within the app, so there is no email verification step here.
 *
 * Sessions are JWT rather than database-backed: the Credentials provider does not
 * support database sessions, and a long-lived token is what keeps someone from being
 * logged out mid-shift at the booth.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — a whole convention weekend and then some
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // Unscoped on purpose: sign-in is how we discover which store someone
        // belongs to, so there is no storeId to scope by yet. Email is unique
        // across the whole install, so this can only ever match one account.
        const user = await prisma.user.findUnique({ where: { email } });
        // Same null result for "no such user" and "wrong password" so the response
        // can't be used to enumerate which emails have accounts.
        if (!user) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          storeId: user.storeId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: Role }).role ?? "MEMBER";
        token.storeId = (user as { storeId?: string }).storeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? "MEMBER";
        session.user.storeId = token.storeId as string;
      }
      return session;
    },
  },
});
