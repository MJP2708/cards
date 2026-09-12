import { redirect } from "next/navigation";
import { signupAvailable } from "@/lib/auth/signup";
import { SignupForm } from "@/components/auth/SignupForm";

/**
 * Bootstrap-only. Once the store has an owner this page stops existing and sends
 * visitors to /login; the route handler enforces the same rule independently, so
 * a direct POST can't get around a stale page.
 */
export default async function SignupPage() {
  if (!(await signupAvailable())) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <SignupForm />
    </main>
  );
}
