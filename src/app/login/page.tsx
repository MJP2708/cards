import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/storeName";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      {/* The product name, not a store name: a signed-out visitor has no store
          yet, so there is nothing tenant-specific to show here. */}
      <Suspense fallback={null}>
        <LoginForm appName={APP_NAME} />
      </Suspense>
    </main>
  );
}
