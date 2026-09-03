export type AccountValidationInput = {
  password: string;
  confirmPassword: string;
  intent: "create" | "join";
  inviteCode: string;
};

export function validateAccountForm({ password, confirmPassword, intent, inviteCode }: AccountValidationInput): string {
  if (password.length < 8) return "Use at least 8 characters for your password.";
  if (password !== confirmPassword) return "Passwords do not match. Check both fields and try again.";
  if (intent === "join" && !inviteCode.trim()) return "Enter the workspace invite code to continue.";
  return "";
}
