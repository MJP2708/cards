import { SignupForm } from "@/components/auth/SignupForm";

/**
 * Open to anyone: each sign-up creates its own store, so there is nothing here
 * for a stranger to reach into. See the route handler for why that is safe.
 */
export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <SignupForm />
    </main>
  );
}
