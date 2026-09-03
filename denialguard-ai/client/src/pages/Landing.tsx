import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, FileWarning, Gavel, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const steps = [
  { number: "01", title: "Score before submission", description: "XGBoost surfaces preventable risk before a claim becomes payer rework.", icon: Sparkles },
  { number: "02", title: "Work the right denial first", description: "A deadline-aware queue keeps aging, dollars, and CARC context in one view.", icon: ClipboardCheck },
  { number: "03", title: "Close the feedback loop", description: "Outcomes and evidence stay connected so the next batch gets smarter.", icon: Gavel },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen overflow-hidden bg-[#F7F5F1] text-[#1E2F4D]">
      <header className="relative z-10 flex items-center justify-between border-b border-[#DDE4EC]/80 px-5 py-5 sm:px-10 lg:px-16">
        <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B8CBF] text-white font-bold text-base shadow-sm">
            DG
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-[-0.03em]">DenialGuard</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7C8A9C]">Revenue cycle workspace</div>
          </div>
        </button>

        <nav className="hidden items-center gap-7 text-[12px] font-semibold text-[#5D7188] md:flex">
          <a href="#workflow" className="transition hover:text-[#5B8CBF]">Workflow</a>
          <a href="#evidence" className="transition hover:text-[#5B8CBF]">Evidence</a>
          <a href="#security" className="transition hover:text-[#5B8CBF]">Security</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setLocation("/sign-in")} className="h-9 rounded-lg px-3 text-[12px] font-semibold text-[#38516E] hover:bg-white">
            Sign in
          </Button>
          <Button onClick={() => setLocation("/create-account")} className="h-9 rounded-lg bg-[#5B8CBF] px-3 text-[12px] font-semibold text-white shadow-[0_7px_18px_rgba(91,140,191,0.22)] hover:bg-[#4D7EAF]">
            Create account
          </Button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 pb-20 pt-16 sm:px-10 sm:pt-24 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-16 lg:pb-28">
          <div className="pointer-events-none absolute -left-20 top-4 h-[500px] w-[500px] rounded-full bg-[#DCEAF7]/55 blur-3xl" />
          <div className="relative">
            <div className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B8CBF]">
              <span className="h-px w-8 bg-[#5B8CBF]" />Revenue cycle command center
            </div>
            <h1 className="max-w-[760px] font-serif text-[50px] leading-[0.98] tracking-[-0.075em] text-[#1E2F4D] sm:text-[70px]">
              Catch the claim<br />
              <span className="text-[#5B8CBF]">before the payer does.</span>
            </h1>
            <p className="mt-7 max-w-[590px] text-[16px] leading-[1.7] text-[#48586B]">
              DenialGuard turns model signals into the next best action for billing teams—before a preventable denial becomes rework, delayed cash, or an appeal deadline.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setLocation("/dashboard")} className="liquid-sheen h-12 rounded-xl bg-[#5B8CBF] px-5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(91,140,191,0.24)] hover:bg-[#4D7EAF]">
                Open your workspace <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/sign-in")} className="h-12 rounded-xl px-5 text-[13px] font-semibold text-[#38516E] hover:bg-white">
                Already have access? Sign in
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-[#7C8A9C]">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#5FAE93]" />Pre-submission risk</span>
              <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#5FAE93]" />De-identified by default</span>
              <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#5FAE93]" />Outcome-aware</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-10 -top-12 h-64 w-64 rounded-full bg-[#E8F2EF] blur-3xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/60 p-3 shadow-[0_25px_70px_rgba(20,40,70,0.12)] backdrop-blur-xl">
              <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#EAF1FB] via-[#F4F8FB] to-[#E5EFF8] p-5 sm:p-7">
                <div className="relative">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-[#5B78A0]">
                    <span>Pre-submission signal</span>
                    <span className="rounded-full bg-white/90 px-2 py-1 font-mono text-[9px] shadow-sm text-[#38516E]">LIVE DEMO</span>
                  </div>
                  <div className="mt-10 rounded-2xl border border-white/85 bg-white/95 p-5 shadow-[0_15px_30px_rgba(20,40,70,0.09)]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-[#1E2F4D]">CLM-2026-08421</div>
                        <div className="mt-1 text-[12px] text-[#7C8A9C]">UnitedHealthcare · CPT 27447</div>
                      </div>
                      <span className="rounded-full bg-[#F8F0D9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9A762D]">Review</span>
                    </div>
                    <div className="mt-7 flex items-center gap-5">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[10px] border-[#C9A24B] bg-white font-serif text-[27px] text-[#1E2F4D]">
                        68<span className="text-sm">%</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Top signal</div>
                        <div className="mt-1 text-[14px] font-semibold text-[#1E2F4D]">Prior authorization</div>
                        <div className="mt-0.5 text-[11px] text-[#7C8A9C]">CO-197 · +0.31 impact</div>
                      </div>
                    </div>
                    <div className="mt-6 rounded-xl bg-[#F3F8F4] p-3 text-[11px] leading-relaxed text-[#48586B]">
                      <span className="font-bold text-[#3E896F]">Next best fix:</span> attach authorization reference before submission.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-[#DDE4EC] bg-white/45 px-5 py-16 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.5fr]">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B8CBF]">
                  <span className="h-px w-7 bg-[#5B8CBF]" />A different kind of RCM tool
                </div>
                <h2 className="font-serif text-[36px] leading-tight tracking-[-0.06em] text-[#1E2F4D]">
                  Less dashboard.<br />More decision.
                </h2>
                <p className="mt-4 max-w-[360px] text-[13px] leading-relaxed text-[#48586B]">
                  Built for the analyst who has to decide what to work next, what to attach, and when an appeal clock becomes a cash-flow problem.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {steps.map(({ number, title, description, icon: Icon }) => (
                  <div key={number} className="rounded-2xl border border-[#DDE4EC] bg-[#FBFAF8] p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-[#5B8CBF]">{number}</span>
                      <Icon className="h-5 w-5 text-[#5FAE93]" strokeWidth={1.8} />
                    </div>
                    <h3 className="mt-8 text-[14px] font-bold text-[#1E2F4D]">{title}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#7C8A9C]">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="evidence" className="mx-auto grid max-w-[1240px] gap-8 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:px-16 lg:py-24">
          <div className="overflow-hidden rounded-[24px] border border-[#DDE4EC] bg-[#FBFAF8] p-3 shadow-sm">
            <div className="relative min-h-[300px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#E6F0EB] via-[#EEF5F1] to-[#DCECE5] p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-emerald-900/10 pb-4">
                <span className="font-mono text-[11px] font-semibold text-[#2E5C49]">AUTH-RECORD-9902</span>
                <span className="rounded-full bg-[#5FAE93]/20 px-2 py-0.5 text-[10px] font-semibold text-[#245C47]">Verified</span>
              </div>
              <div className="my-4 space-y-2 text-[12px] text-[#3D5B4F]">
                <div className="flex justify-between"><span>Payer Policy</span><span className="font-semibold text-[#1E2F4D]">LCD L34212</span></div>
                <div className="flex justify-between"><span>Service Code</span><span className="font-semibold text-[#1E2F4D]">CPT 27447 (Knee Arthroplasty)</span></div>
                <div className="flex justify-between"><span>Clinical Note</span><span className="font-semibold text-[#1E2F4D]">Operative report attached</span></div>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/90 p-4 backdrop-blur-md shadow-sm">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3E896F]">
                  <FileWarning className="h-3.5 w-3.5" />Evidence stays with the claim
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#48586B]">
                  Authorization, clinical notes, and payer responses stay attached to the work your team is already doing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B8CBF]">
              <span className="h-px w-7 bg-[#5B8CBF]" />Designed for the day-to-day
            </div>
            <h2 className="font-serif text-[36px] leading-tight tracking-[-0.06em] text-[#1E2F4D]">
              A quiet surface<br />for noisy work.
            </h2>
            <p className="mt-5 max-w-[450px] text-[14px] leading-relaxed text-[#48586B]">
              Prioritized queues, inline code meaning, deadline-aware appeals, and a feedback loop that respects how revenue cycle teams actually work.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#DDE4EC] bg-white p-4 shadow-sm">
                <div className="font-serif text-[26px] text-[#1E2F4D]">18d</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Time to appeal</div>
              </div>
              <div className="rounded-xl border border-[#DDE4EC] bg-white p-4 shadow-sm">
                <div className="font-serif text-[26px] text-[#1E2F4D]">CO-197</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Reason, in context</div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="border-t border-[#DDE4EC] px-5 py-10 sm:px-10 lg:px-16">
          <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F3EE] text-[#3E896F]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-[#1E2F4D]">Built with clear boundaries.</div>
                <div className="mt-1 text-[11px] text-[#7C8A9C]">Prediction runs independently. Outcomes and documents stay scoped behind the workspace.</div>
              </div>
            </div>
            <Button onClick={() => setLocation("/create-account")} variant="ghost" className="h-10 rounded-lg text-[12px] font-semibold text-[#5B8CBF] hover:bg-white">
              Create your workspace <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="flex flex-col justify-between gap-3 border-t border-[#DDE4EC] px-5 py-6 text-[10px] uppercase tracking-[0.13em] text-[#9BA9B8] sm:flex-row sm:px-10 lg:px-16">
        <span>DenialGuard Revenue cycle workspace</span>
        <span>FastAPI prediction · Supabase outcomes · S3 documents</span>
      </footer>
    </div>
  );
}
