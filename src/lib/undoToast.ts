import { toast } from "sonner";

// Optimistic-delete pattern: the action only actually runs after the toast's
// grace period elapses, so "Undo" can cancel it outright instead of requiring
// a confirm() dialog before every destructive click.
export function actionWithUndo(message: string, onConfirmed: () => void, durationMs = 4500) {
  let cancelled = false;
  const timer = setTimeout(() => {
    if (!cancelled) onConfirmed();
  }, durationMs);

  toast(message, {
    duration: durationMs,
    action: {
      label: "Undo",
      onClick: () => {
        cancelled = true;
        clearTimeout(timer);
      },
    },
  });
}
