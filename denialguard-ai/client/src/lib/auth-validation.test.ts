import { describe, expect, it } from "vitest";
import { validateAccountForm } from "./auth-validation";

describe("validateAccountForm", () => {
  const base = { password: "securepass", confirmPassword: "securepass", intent: "create" as const, inviteCode: "" };

  it("requires a minimum password length", () => {
    expect(validateAccountForm({ ...base, password: "short", confirmPassword: "short" })).toBe("Use at least 8 characters for your password.");
  });

  it("rejects mismatched passwords", () => {
    expect(validateAccountForm({ ...base, confirmPassword: "different" })).toBe("Passwords do not match. Check both fields and try again.");
  });

  it("requires an invite code when joining", () => {
    expect(validateAccountForm({ ...base, intent: "join", inviteCode: "" })).toBe("Enter the workspace invite code to continue.");
  });

  it("accepts a complete create or join form", () => {
    expect(validateAccountForm(base)).toBe("");
    expect(validateAccountForm({ ...base, intent: "join", inviteCode: "DG-7F4K-92Q" })).toBe("");
  });
});
