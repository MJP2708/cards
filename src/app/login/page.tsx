import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getStoreName } from "@/lib/storeName";
import { signupAvailable } from "@/lib/auth/signup";

export default async function LoginPage() {
  const [storeName, canSignUp] = await Promise.all([getStoreName(), signupAvailable()]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      {/* LoginForm reads ?next= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <LoginForm storeName={storeName} signupAvailable={canSignUp} />
      </Suspense>
    </main>
  );
}
