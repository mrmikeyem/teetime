// Single source of truth for feedback categories — imported by the client
// form, the API validator, and the admin email template. No server-only deps
// so the client form can import it.

export const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug", hint: "Something's broken" },
  { value: "idea", label: "Idea", hint: "A feature or improvement" },
  { value: "other", label: "Other", hint: "Anything else" },
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

export const FEEDBACK_TYPE_VALUES: readonly FeedbackType[] =
  FEEDBACK_TYPES.map((t) => t.value);

export function isFeedbackType(v: unknown): v is FeedbackType {
  return (
    typeof v === "string" &&
    (FEEDBACK_TYPE_VALUES as readonly string[]).includes(v)
  );
}

export function feedbackTypeLabel(value: string): string {
  return FEEDBACK_TYPES.find((t) => t.value === value)?.label ?? "Feedback";
}

// Shared message length cap, enforced on both client (textarea) and server.
export const FEEDBACK_MAX_MESSAGE_LEN = 4000;
