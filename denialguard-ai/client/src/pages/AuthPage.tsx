import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { validateAccountForm } from "@/lib/auth-validation";
import { toast } from "sonner";

type AuthMode = "sign-in" | "create-account";
type WorkspaceIntent = "create" | "join";

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const [, setLocation] = useLocation();
  const isCreate = mode === "create-account";
  const [intent, setIntent] = useState<WorkspaceIntent>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intent") === "join" ? "join" : "create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [formError, setFormError] = useState(() => {
    if (typeof window === "undefined") return "";
    const state = new URLSearchParams(window.location.search).get("state");
    if (state === "mismatch") return "Passwords do not match. Check both fields and try again.";
    if (state === "short-password") return "Use at least 8 characters for your password.";
    if (state === "missing-invite") return "Enter the workspace invite code to continue.";
    return "";
  });
  const [submitted, setSubmitted] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (isCreate) {
      const validationError = validateAccountForm({ password, confirmPassword, intent, inviteCode });
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }
    setSubmitted(true);
    toast.success(isCreate ? "Workspace account created" : "Signed in successfully", {
      description: "Welcome to DenialGuard AI revenue cycle workspace.",
    });
    setTimeout(() => {
      setLocation("/dashboard");
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#1E2F4D]">
      <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#1E2F4D] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#5B8CBF]/25 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-[#5FAE93]/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B8CBF] text-white font-bold text-base shadow-sm">
              DG
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-[-0.03em]">DenialGuard</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B7CBE0]">Revenue cycle workspace</div>
            </div>
          </div>
          <div className="relative max-w-[470px]">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8DB4D9]">
              <span className="h-px w-7 bg-[#8DB4D9]" />Workspace access
            </div>
            <h1 className="font-serif text-[56px] leading-[0.98] tracking-[-0.07em]">
              The worklist<br />starts with<br /><span className="text-[#9BD1B8]">a signal.</span>
            </h1>
            <p className="mt-7 max-w-[390px] text-[14px] leading-relaxed text-[#B7CBE0]">
              A focused workspace for billers and denial analysts who need to know what matters next—not another dashboard to interpret.
            </p>
            <div className="mt-9 space-y-3">
              {["Pre-submission risk scoring", "CARC/RARC context in-line", "Evidence and outcomes connected"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-[12px] text-[#D5E1ED]">
                  <CheckCircle2 className="h-4 w-4 text-[#8BD0B5]" />{item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.12em] text-[#91A6BD]">
            <span>Internal RCM workspace</span>
            <span>v0.9.4</span>
          </div>
        </section>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between px-5 py-6 sm:px-10 lg:px-16">
            <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-2 text-[11px] font-semibold text-[#5D7188] hover:text-[#5B8CBF]">
              <ArrowLeft className="h-4 w-4" />Back to DenialGuard
            </button>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7C8A9C]">
              <ShieldCheck className="h-4 w-4 text-[#5FAE93]" />Private workspace
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col justify-center px-5 pb-14 pt-8 sm:px-10">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B8CBF] text-white font-bold text-base shadow-sm">
                  DG
                </div>
                <div>
                  <div className="text-[15px] font-bold tracking-[-0.03em]">DenialGuard</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7C8A9C]">Revenue cycle workspace</div>
                </div>
              </div>
            </div>

            <h2 className="font-serif text-[40px] leading-tight tracking-[-0.07em] text-[#1E2F4D]">
              {isCreate ? (intent === "join" ? "Join the right queue." : "Start with a clearer queue.") : "Return to the signal."}
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#48586B]">
              {isCreate ? (intent === "join" ? "Use your invitation to join an existing DenialGuard workspace." : "Set up a private DenialGuard workspace for your revenue cycle team.") : "Sign in to review denials, deadlines, appeals, and claim evidence."}
            </p>

            <form onSubmit={submit} className="mt-8 rounded-2xl border border-white/80 bg-white/70 p-5 shadow-[0_14px_40px_rgba(20,40,70,0.07)] backdrop-blur-xl sm:p-7">
              {isCreate && (
                <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#EEF2F4] p-1">
                  <button
                    type="button"
                    onClick={() => { setIntent("create"); setFormError(""); }}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition ${intent === "create" ? "bg-white text-[#1E2F4D] shadow-[0_3px_10px_rgba(20,40,70,0.08)]" : "text-[#7C8A9C] hover:text-[#48586B]"}`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />Create new
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIntent("join"); setFormError(""); }}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition ${intent === "join" ? "bg-white text-[#1E2F4D] shadow-[0_3px_10px_rgba(20,40,70,0.08)]" : "text-[#7C8A9C] hover:text-[#48586B]"}`}
                  >
                    <UsersRound className="h-3.5 w-3.5" />Join existing
                  </button>
                </div>
              )}

              {isCreate && intent === "create" && (
                <label className="mb-4 block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#7C8A9C]">Workspace name</span>
                  <input
                    value={workspace}
                    onChange={(event) => setWorkspace(event.target.value)}
                    placeholder="Northline Revenue Cycle"
                    required
                    className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] px-3 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF] focus:ring-2 focus:ring-[#DCEAF7]"
                  />
                </label>
              )}

              {isCreate && intent === "join" && (
                <label className="mb-4 block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#7C8A9C]">Workspace invite code</span>
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="DG-7F4K-92Q"
                    required
                    className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] px-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[#1E2F4D] outline-none focus:border-[#5B8CBF] focus:ring-2 focus:ring-[#DCEAF7]"
                  />
                  <span className="mt-2 flex items-center gap-1.5 text-[10px] text-[#7C8A9C]">
                    <KeyRound className="h-3 w-3" />Ask your workspace owner for the invitation code.
                  </span>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#7C8A9C]">Work email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@organization.org"
                  required
                  className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] px-3 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF] focus:ring-2 focus:ring-[#DCEAF7]"
                />
              </label>

              <div className={isCreate ? "mt-4 grid gap-4 sm:grid-cols-2" : "mt-4"}>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#7C8A9C]">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] px-3 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF] focus:ring-2 focus:ring-[#DCEAF7]"
                  />
                </label>
                {isCreate && (
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#7C8A9C]">Confirm password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat your password"
                      required
                      className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] px-3 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF] focus:ring-2 focus:ring-[#DCEAF7]"
                    />
                  </label>
                )}
              </div>

              {formError && (
                <div className="mt-4 rounded-lg border border-[#E4C8C8] bg-[#FDF5F5] px-3 py-2.5 text-[11px] leading-relaxed text-[#A95E62]">
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                className="mt-6 h-11 w-full rounded-xl bg-[#5B8CBF] text-[13px] font-semibold text-white shadow-[0_9px_22px_rgba(91,140,191,0.2)] hover:bg-[#4D7EAF]"
              >
                {isCreate ? (intent === "join" ? "Join workspace" : "Create account") : "Sign in"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-[#7C8A9C]">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5FAE93]" />
                {isCreate ? "Your account is protected by secure workspace authentication." : "Your session is protected by secure workspace authentication."}
              </div>

              {submitted && (
                <div className="mt-4 rounded-lg bg-[#E6F3EE] px-3 py-2 text-[11px] text-[#3E896F]">
                  Opening secure session…
                </div>
              )}
            </form>

            <div className="mt-6 text-center text-[12px] text-[#7C8A9C]">
              {isCreate ? "Already have a workspace?" : "New to DenialGuard?"}{" "}
              <button
                type="button"
                onClick={() => setLocation(isCreate ? "/sign-in" : "/create-account")}
                className="font-semibold text-[#5B8CBF] hover:underline"
              >
                {isCreate ? "Sign in" : "Create an account"}
              </button>
            </div>
          </main>

          <footer className="px-5 pb-6 text-center text-[10px] uppercase tracking-[0.12em] text-[#9BA9B8] sm:px-10 lg:px-16">
            DenialGuard AI / Prediction path online
          </footer>
        </section>
      </div>
    </div>
  );
}
