import { AlertCircle } from "lucide-react";

// One consistent error treatment (icon + message), used everywhere a mutation
// can fail — previously each dialog/form rendered its own bare red sentence
// in a different position with a different wrapper.
export function InlineError({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
