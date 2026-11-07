import { CircleAlert } from "lucide-react";

/** Form-level error banner. Eases in when it appears so a failed submit is noticed. */
export default function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0"
    >
      <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
