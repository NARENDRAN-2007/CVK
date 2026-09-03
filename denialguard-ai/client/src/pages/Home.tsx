import { useMemo, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  predictClaim,
  submitClaimOutcome,
  getCurrentUser,
  uploadClaimDocument,
  fetchClaimDocuments,
  fetchClaimsLog,
  fetchAppeals,
  createAppeal,
  updateAppealStatus,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchWorkspaceSettings,
  saveWorkspaceSettings,
  fetchSecuritySettings,
  saveSecuritySettings,
  generateWorkspaceInvite,
  fetchWorkspaceMembers,
  type PredictionResponse,
  type AppealItem,
  type NotificationItem,
  type WorkspaceSettings,
  type SecuritySettings,
  type WorkspaceMember,
} from "@/lib/api";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileCheck2,
  FileText,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Library,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const COLORS = {
  ink: "#1E2F4D",
  body: "#48586B",
  muted: "#7C8A9C",
  blue: "#5B8CBF",
  blueSoft: "#EAF1FB",
  green: "#5FAE93",
  gold: "#C9A24B",
  coral: "#C77B7B",
  violet: "#8B7EC8",
};

export type ClaimStatus = "paid" | "pending" | "denied" | "appealed" | "written_off";

export type Denial = {
  id: string;
  patientRef: string;
  payer: string;
  cptCodes: string[];
  billedAmount: number;
  status: ClaimStatus;
  carcCode: string;
  carcDescription: string;
  rarcCode: string;
  groupCode: "CO" | "PR" | "OA" | "PI";
  agingDays: number;
  deadline: string;
  deadlineDays: number;
  assignedTo: string;
  avatar: string;
  department: string;
};

const payerRules = [
  { name: "Aetna", initials: "AE", color: "#5B8CBF", filing: "180 days", auth: "Prior auth for advanced imaging, elective surgery", appeal: "180 days", method: "Provider portal" },
  { name: "BlueCross", initials: "BC", color: "#5B8CBF", filing: "180 days", auth: "Prior auth for surgical & specialty procedures", appeal: "180 days", method: "Availity portal" },
  { name: "Cigna", initials: "CI", color: "#8B7EC8", filing: "180 days", auth: "Auth required for PT after visit 6", appeal: "180 days", method: "Fax / portal" },
  { name: "Humana", initials: "HU", color: "#C9A24B", filing: "365 days", auth: "Auth for inpatient and DME", appeal: "60 days", method: "Provider portal" },
  { name: "Medicaid", initials: "MD", color: "#5FAE93", filing: "90 days", auth: "Prior auth for specialized clinical care", appeal: "90 days", method: "State portal" },
  { name: "Medicare", initials: "MC", color: "#5FAE93", filing: "1 year", auth: "LCD/NCD-specific; check MAC", appeal: "120 days", method: "Electronic" },
  { name: "UnitedHealthcare", initials: "UH", color: "#C77B7B", filing: "90 days", auth: "Prior auth for surgery and specialty drugs", appeal: "180 days", method: "UHC Link" },
];

const navGroups: { label: string; items: { label: string; path: string; icon: LucideIcon; shortcut?: string }[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Denial worklist", path: "/worklist", icon: ClipboardCheck, shortcut: "⌘ 1" },
      { label: "Predict risk", path: "/predict", icon: Target, shortcut: "⌘ 2" },
      { label: "Claims log", path: "/claims", icon: FileText },
      { label: "Appeals", path: "/appeals", icon: FileCheck2 },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Payer rules", path: "/payers", icon: Library },
      { label: "Analytics", path: "/analytics", icon: TrendingUp },
      { label: "Settings", path: "/settings", icon: Settings2 },
    ],
  },
];

const money = (value: number) => `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; dot: string }> = {
    paid: { label: "Paid", className: "badge-paid", dot: "bg-[#5FAE93]" },
    pending: { label: "Pending", className: "badge-pending", dot: "bg-[#C9A24B]" },
    denied: { label: "Denied", className: "badge-denied", dot: "bg-[#C77B7B]" },
    appealed: { label: "Appealed", className: "badge-appealed", dot: "bg-[#8B7EC8]" },
    written_off: { label: "Written off", className: "badge-neutral", dot: "bg-[#7C8A9C]" },
    drafting: { label: "Drafting", className: "badge-neutral", dot: "bg-[#7C8A9C]" },
    submitted: { label: "Submitted", className: "badge-appealed", dot: "bg-[#8B7EC8]" },
    payer_review: { label: "Payer Review", className: "badge-pending", dot: "bg-[#C9A24B]" },
    resolved: { label: "Resolved", className: "badge-paid", dot: "bg-[#5FAE93]" },
  };
  const item = config[status.toLowerCase()] ?? { label: status, className: "badge-neutral", dot: "bg-[#7C8A9C]" };
  return (
    <span className={`status-badge ${item.className}`}>
      <span className={`status-dot ${item.dot}`} />
      {item.label}
    </span>
  );
}

function Avatar({ initials, tone = "blue", size = "sm" }: { initials: string; tone?: "blue" | "violet" | "gold" | "green"; size?: "sm" | "md" | "lg" }) {
  return <div className={`avatar avatar-${tone} avatar-${size}`}>{initials}</div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Button({ children, variant = "primary", icon: Icon, className = "", onClick, type = "button" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: LucideIcon; className?: string; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} className={`ui-button button-${variant} ${variant === "primary" ? "liquid-sheen" : ""} ${className}`}>
      {Icon && <Icon size={16} strokeWidth={1.8} />}
      {children}
    </button>
  );
}

function KpiCard({ label, value, delta, detail, icon: Icon, tone, onClick }: { label: string; value: string; delta: string; detail: string; icon: LucideIcon; tone: "blue" | "coral" | "gold" | "violet"; onClick?: () => void }) {
  const toneMap = { blue: "kpi-blue", coral: "kpi-coral", gold: "kpi-gold", violet: "kpi-violet" };
  return (
    <button onClick={onClick} className={`kpi-card liquid-sheen ${toneMap[tone]}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <div className="kpi-icon">
          <Icon size={17} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-meta">
        <span className="delta-down">
          <TrendingDown size={13} />
          {delta}
        </span>
        <span>{detail}</span>
      </div>
    </button>
  );
}

function FilterRail({ payer, setPayer, aging, setAging, assignee, setAssignee }: { payer: string; setPayer: (value: string) => void; aging: string; setAging: (value: string) => void; assignee: string; setAssignee: (value: string) => void }) {
  return (
    <aside className="filter-rail">
      <div className="filter-title">
        <div>
          <span className="eyebrow">Narrow queue</span>
          <h3>Filters</h3>
        </div>
        <SlidersHorizontal size={16} color={COLORS.muted} />
      </div>
      <div className="filter-group">
        <label>Payer</label>
        <select value={payer} onChange={(event) => setPayer(event.target.value)}>
          <option value="all">All payers</option>
          {payerRules.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Aging bucket</label>
        <select value={aging} onChange={(event) => setAging(event.target.value)}>
          <option value="all">All aging</option>
          <option value="0-7">0–7 days</option>
          <option value="8-30">8–30 days</option>
          <option value="31-60">31–60 days</option>
          <option value="60+">60+ days</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Assigned to</label>
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="all">Everyone</option>
          <option value="Maya Alvarez">Maya Alvarez</option>
          <option value="Jordan Lee">Jordan Lee</option>
          <option value="Priya Shah">Priya Shah</option>
        </select>
      </div>
      <div className="filter-divider" />
      <button className="clear-link" onClick={() => { setPayer("all"); setAging("all"); setAssignee("all"); }}>
        Clear all filters <X size={13} />
      </button>
    </aside>
  );
}

function Dashboard({ onNavigate, denials, appeals }: { onNavigate: (path: string) => void; denials: Denial[]; appeals: AppealItem[] }) {
  const atRiskDenials = denials.filter(d => d.status === "denied" || d.carcCode !== "CLEAN");
  const totalBilledAtRisk = atRiskDenials.reduce((acc, d) => acc + (d.billedAmount || 0), 0);
  const cleanCount = denials.filter(d => d.status === "paid" || d.carcCode === "CLEAN").length;
  const cleanRate = denials.length > 0 ? ((cleanCount / denials.length) * 100).toFixed(1) + "%" : "100%";
  const preCatches = denials.filter(d => d.agingDays <= 7).length;

  return (
    <div className="page-content dashboard-page">
      <SectionHeading
        eyebrow="Northstar Health System / Revenue Integrity"
        title="Command center"
        description="Pre-submission denial prevention, live worklist telemetry, and appeal deadlines."
        action={
          <div className="heading-actions">
            <Button variant="secondary" icon={RefreshCw} onClick={() => toast.success("Refreshed live telemetry")}>
              Refresh data
            </Button>
            <Button icon={Target} onClick={() => onNavigate("/predict")}>
              Score new claim
            </Button>
          </div>
        }
      />

      <div className="kpi-grid">
        <KpiCard
          label="Active denials in queue"
          value={String(atRiskDenials.length)}
          delta="Real-time"
          detail="Active in worklist"
          icon={AlertCircle}
          tone="coral"
          onClick={() => onNavigate("/worklist")}
        />
        <KpiCard
          label="Dollars at risk"
          value={money(totalBilledAtRisk)}
          delta="Pre-submission"
          detail="Awaiting review"
          icon={CircleDollarSign}
          tone="gold"
          onClick={() => onNavigate("/worklist")}
        />
        <KpiCard
          label="Clean claim pass rate"
          value={cleanRate}
          delta="Target: 95%"
          detail="Evaluated submissions"
          icon={CheckCircle2}
          tone="blue"
          onClick={() => onNavigate("/analytics")}
        />
        <KpiCard
          label="Active appeals"
          value={String(appeals.length)}
          delta="In progress"
          detail="Across 4 stages"
          icon={FileCheck2}
          tone="violet"
          onClick={() => onNavigate("/appeals")}
        />
      </div>

      {denials.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#D9E0E8] bg-white/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B8CBF]/15 text-[#5B8CBF]">
            <Target size={24} />
          </div>
          <h3 className="mt-4 font-serif text-[22px] text-[#1E2F4D]">Clean Workspace Initialized</h3>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#7C8A9C]">
            No claims or denials have been scored in this workspace yet. Use the Pre-Submission Predictor to evaluate claims against the XGBoost & SHAP models.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button icon={Target} onClick={() => onNavigate("/predict")}>Score First Claim</Button>
            <Button variant="secondary" icon={UsersRound} onClick={() => onNavigate("/settings")}>Invite Team Members</Button>
          </div>
        </div>
      ) : (
        <div className="charts-grid mt-6">
          <section className="panel chart-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Worklist Telemetry</span>
                <h2>Active Claim Risk Exposure</h2>
              </div>
              <Button variant="ghost" onClick={() => onNavigate("/worklist")}>View Worklist <ArrowRight size={13} /></Button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {denials.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-[#EEF2F6] bg-white p-3 shadow-sm hover:border-[#5B8CBF]/40 cursor-pointer" onClick={() => onNavigate(`/claims/${d.id}`)}>
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[13px] font-bold text-[#1E2F4D]">
                        {d.id}
                        <span className="rounded-md bg-[#EEF2F6] px-1.5 py-0.5 font-sans text-[10px] text-[#7C8A9C]">{d.payer}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#7C8A9C]">{d.carcCode}: {d.carcDescription}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-[#1E2F4D]">{money(d.billedAmount)}</div>
                      <StatusBadge status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="deadlines-panel panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Action queue</span>
                <h2>Active Appeals</h2>
              </div>
              <button className="text-button" onClick={() => onNavigate("/appeals")}>View all <ArrowRight size={13} /></button>
            </div>
            <div className="deadline-list">
              {appeals.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-[#7C8A9C]">
                  No appeals currently in progress. Start an appeal from the worklist or appeals pipeline.
                </div>
              ) : (
                appeals.map((appeal) => (
                  <button key={appeal.id} className="deadline-item" onClick={() => onNavigate("/appeals")}>
                    <div className="deadline-copy">
                      <strong>{appeal.claim_id}</strong>
                      <span>{appeal.payer} · {appeal.appeal_level} ({appeal.status})</span>
                    </div>
                    <ChevronRight size={15} color={COLORS.muted} />
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Worklist({ denials, onOpenClaim, onScoreClaim }: { denials: Denial[]; onOpenClaim: (id: string) => void; onScoreClaim: () => void }) {
  const [payer, setPayer] = useState("all");
  const [aging, setAging] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => denials.filter((claim) => {
    const matchesPayer = payer === "all" || claim.payer === payer;
    const matchesAssignee = assignee === "all" || claim.assignedTo === assignee;
    const matchesAging = aging === "all" || (aging === "0-7" && claim.agingDays <= 7) || (aging === "8-30" && claim.agingDays >= 8 && claim.agingDays <= 30) || (aging === "31-60" && claim.agingDays >= 31 && claim.agingDays <= 60) || (aging === "60+" && claim.agingDays > 60);
    const query = search.toLowerCase();
    const matchesSearch = !query || [claim.id, claim.patientRef, claim.payer, claim.carcCode, claim.carcDescription, claim.assignedTo].some((value) => value.toLowerCase().includes(query));
    return matchesPayer && matchesAssignee && matchesAging && matchesSearch;
  }), [denials, payer, aging, assignee, search]);

  const allSelected = filtered.length > 0 && filtered.every((claim) => selected.includes(claim.id));
  const toggleAll = () => setSelected(allSelected ? [] : filtered.map((claim) => claim.id));

  return (
    <div className="page-content worklist-page">
      <SectionHeading
        eyebrow="Revenue integrity / Active Queue"
        title="Denial worklist"
        description="Prioritized by appeal deadline, aging, and financial exposure."
        action={
          <div className="heading-actions">
            {filtered.length > 0 && (
              <Button
                variant="secondary"
                icon={Download}
                onClick={() => {
                  const header = "Claim ID,Patient Ref,Payer,CARC,Amount,Aging,Deadline,Owner,Status\n";
                  const rows = filtered.map(c => `${c.id},${c.patientRef},${c.payer},${c.carcCode},${c.billedAmount},${c.agingDays},${c.deadline},${c.assignedTo},${c.status}`).join("\n");
                  const blob = new Blob([header + rows], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `denials-worklist-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  toast.success("Worklist exported successfully");
                }}
              >
                Export queue
              </Button>
            )}
            <Button icon={Plus} onClick={onScoreClaim}>Score claim</Button>
          </div>
        }
      />

      {denials.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#D9E0E8] bg-white/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B8CBF]/15 text-[#5B8CBF]">
            <ClipboardCheck size={24} />
          </div>
          <h3 className="mt-4 font-serif text-[22px] text-[#1E2F4D]">Worklist is Clean</h3>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#7C8A9C]">
            No claims currently require denial remediation or appeal action. Run pre-submission scoring on pending claims to catch rejections before submission.
          </p>
          <div className="mt-6">
            <Button icon={Target} onClick={onScoreClaim}>Score Pending Claim</Button>
          </div>
        </div>
      ) : (
        <div className="worklist-layout">
          <FilterRail {...{ payer, setPayer, aging, setAging, assignee, setAssignee }} />
          <section className="table-panel">
            <div className="table-toolbar">
              <div className="table-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search claim, patient ref, payer, CARC..." />
                <kbd>⌘ K</kbd>
              </div>
              <div className="toolbar-actions">
                <button className="icon-button" title="Refresh" onClick={() => toast.success("Queue refreshed")}><RefreshCw size={15} /></button>
                <span className="table-count">{filtered.length} of {denials.length} claims</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="claim-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, paddingLeft: 16 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                    <th style={{ minWidth: 160 }}>Claim ID / Patient</th>
                    <th style={{ minWidth: 130 }}>Payer</th>
                    <th style={{ minWidth: 260 }}>CARC / Reason</th>
                    <th className="text-right" style={{ minWidth: 120, textAlign: "right" }}>Denied Amt</th>
                    <th style={{ minWidth: 100 }}>Deadline</th>
                    <th style={{ minWidth: 100 }}>Status</th>
                    <th style={{ minWidth: 130, paddingRight: 16 }}>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((claim) => (
                    <tr key={claim.id} onClick={() => onOpenClaim(claim.id)} className="clickable-row">
                      <td style={{ width: 44, paddingLeft: 16 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(claim.id)}
                          onChange={() => setSelected(selected.includes(claim.id) ? selected.filter(id => id !== claim.id) : [...selected, claim.id])}
                        />
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <strong className="block font-bold text-[#1E2F4D]">{claim.id}</strong>
                        <span className="subtle">{claim.patientRef} · {claim.cptCodes.join(", ")}</span>
                      </td>
                      <td style={{ minWidth: 130 }} className="whitespace-nowrap font-medium text-[#1E2F4D]">{claim.payer}</td>
                      <td style={{ minWidth: 260 }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="carc-code-tag">{claim.carcCode}</span>
                          <span className="subtle">{claim.carcDescription}</span>
                        </div>
                      </td>
                      <td style={{ minWidth: 120 }} className="text-right font-mono font-bold text-[#1E2F4D] whitespace-nowrap">{money(claim.billedAmount)}</td>
                      <td style={{ minWidth: 100 }} className="whitespace-nowrap"><span className="text-[11px] font-mono text-[#7C8A9C]">{claim.deadline}</span></td>
                      <td style={{ minWidth: 100 }} className="whitespace-nowrap"><StatusBadge status={claim.status} /></td>
                      <td style={{ minWidth: 130, paddingRight: 16 }}>
                        <div className="flex items-center gap-1.5 text-[12px] whitespace-nowrap">
                          <Avatar initials={claim.avatar} tone="blue" size="sm" />
                          <span>{claim.assignedTo}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Predict({ onSaveClaim }: { onSaveClaim: (claim: Denial) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [form, setForm] = useState({
    payer: "UnitedHealthcare",
    providerSpecialty: "Orthopedics",
    cpt: "27447",
    icd10: "M17.11",
    paStatus: "Missing",
    eligibilityStatus: "Active",
    networkStatus: "In-Network",
    documentationFlag: "false",
    chargeAmount: "18450",
    daysToDeadline: "45",
  });

  const loadPreset = (presetType: "high_risk" | "clean" | "filing_limit" | "missing_doc") => {
    if (presetType === "high_risk") {
      setForm({
        payer: "UnitedHealthcare",
        providerSpecialty: "Orthopedics",
        cpt: "27447",
        icd10: "M17.11",
        paStatus: "Missing",
        eligibilityStatus: "Active",
        networkStatus: "In-Network",
        documentationFlag: "true",
        chargeAmount: "18450",
        daysToDeadline: "45",
      });
    } else if (presetType === "clean") {
      setForm({
        payer: "Aetna",
        providerSpecialty: "Cardiology",
        cpt: "99214",
        icd10: "I10",
        paStatus: "Approved",
        eligibilityStatus: "Active",
        networkStatus: "In-Network",
        documentationFlag: "true",
        chargeAmount: "482",
        daysToDeadline: "85",
      });
    } else if (presetType === "filing_limit") {
      setForm({
        payer: "Cigna",
        providerSpecialty: "Orthopedics",
        cpt: "97110",
        icd10: "M54.5",
        paStatus: "Approved",
        eligibilityStatus: "Active",
        networkStatus: "In-Network",
        documentationFlag: "true",
        chargeAmount: "960",
        daysToDeadline: "4",
      });
    } else if (presetType === "missing_doc") {
      setForm({
        payer: "Humana",
        providerSpecialty: "Internal Medicine",
        cpt: "99223",
        icd10: "J18.9",
        paStatus: "Not Required",
        eligibilityStatus: "Active",
        networkStatus: "In-Network",
        documentationFlag: "false",
        chargeAmount: "1240",
        daysToDeadline: "30",
      });
    }
  };

  const runPrediction = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await predictClaim({
        payer: form.payer,
        providerSpecialty: form.providerSpecialty,
        cpt: form.cpt,
        icd10: form.icd10,
        paStatus: form.paStatus,
        eligibilityStatus: form.eligibilityStatus,
        networkStatus: form.networkStatus,
        documentationFlag: form.documentationFlag === "true",
        chargeAmount: Number(form.chargeAmount) || 18450,
        daysToDeadline: Number(form.daysToDeadline) || 45,
      });
      setResult(res);
      toast.success("Denial prediction complete", {
        description: `Risk score: ${res.denialRiskScore.toFixed(1)}% | CARC Code: ${res.predictedCarcCode}`,
      });
    } catch (err: any) {
      toast.error("Prediction failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const saveToQueue = () => {
    if (!result) return;
    const newClaim: Denial = {
      id: result.claimId || `CLM-2026-0${Math.floor(1000 + Math.random() * 9000)}`,
      patientRef: `PT-•••-${Math.floor(1000 + Math.random() * 9000)}`,
      payer: form.payer,
      cptCodes: [form.cpt],
      billedAmount: Number(form.chargeAmount) || 18450,
      status: result.denialRiskScore >= 60 ? "denied" : "pending",
      carcCode: result.predictedCarcCode,
      carcDescription: result.predictedCarcCode === "CO-197"
        ? "Precertification / authorization absent"
        : result.predictedCarcCode === "CO-16"
        ? "Missing required clinical documentation"
        : "Pre-submission risk flagged",
      rarcCode: "N290",
      groupCode: "CO",
      agingDays: 1,
      deadline: "30 days",
      deadlineDays: Number(form.daysToDeadline) || 30,
      assignedTo: getCurrentUser().name || "Maya Alvarez",
      avatar: (getCurrentUser().name || "Maya Alvarez").split(" ").map(n => n[0]).join(""),
      department: form.providerSpecialty,
    };
    onSaveClaim(newClaim);
    toast.success("Claim added to Worklist", {
      description: `${newClaim.id} is now tracked in your active queue.`,
    });
  };

  return (
    <div className="page-content predict-page">
      <SectionHeading
        eyebrow="Pre-submission Intelligence"
        title="Predict denial risk"
        description="Score claim attributes against XGBoost + SHAP before transmitting EDI 837."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Quick presets:</span>
        <button onClick={() => loadPreset("high_risk")} className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E2F4D] hover:border-[#5B8CBF]">
          🚨 High-Risk Ortho (CO-197)
        </button>
        <button onClick={() => loadPreset("clean")} className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E2F4D] hover:border-[#5B8CBF]">
          ✅ Clean Cardiology (Passed)
        </button>
        <button onClick={() => loadPreset("filing_limit")} className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E2F4D] hover:border-[#5B8CBF]">
          ⏳ Timely Filing Warning (CO-29)
        </button>
        <button onClick={() => loadPreset("missing_doc")} className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E2F4D] hover:border-[#5B8CBF]">
          📄 Missing Chart Notes (CO-16)
        </button>
      </div>

      <div className="predict-grid">
        <form onSubmit={runPrediction} className="predict-form panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">CMS-1500 / UB-04 Parameters</span>
              <h2>Claim Parameters</h2>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Payer</label>
              <select value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })}>
                {payerRules.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Specialty</label>
              <select value={form.providerSpecialty} onChange={(e) => setForm({ ...form, providerSpecialty: e.target.value })}>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Cardiology">Cardiology</option>
                <option value="General Practice">General Practice</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Oncology">Oncology</option>
                <option value="Radiology">Radiology</option>
                <option value="Neurology">Neurology</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="Emergency Medicine">Emergency Medicine</option>
              </select>
            </div>
            <div className="form-field">
              <label>Eligibility Status</label>
              <select value={form.eligibilityStatus} onChange={(e) => setForm({ ...form, eligibilityStatus: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
            <div className="form-field">
              <label>CPT Code</label>
              <input value={form.cpt} onChange={(e) => setForm({ ...form, cpt: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>ICD-10 Diagnosis</label>
              <input value={form.icd10} onChange={(e) => setForm({ ...form, icd10: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Prior Authorization</label>
              <select value={form.paStatus} onChange={(e) => setForm({ ...form, paStatus: e.target.value })}>
                <option value="Missing">Missing</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Denied">Denied</option>
                <option value="Not Required">Not Required</option>
              </select>
            </div>
            <div className="form-field">
              <label>Documentation Attached</label>
              <select value={form.documentationFlag} onChange={(e) => setForm({ ...form, documentationFlag: e.target.value })}>
                <option value="true">Yes · Operative/Chart note attached</option>
                <option value="false">No · Unattached</option>
              </select>
            </div>
            <div className="form-field">
              <label>Billed Charge ($)</label>
              <input type="number" value={form.chargeAmount} onChange={(e) => setForm({ ...form, chargeAmount: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Days to Filing Deadline</label>
              <input type="number" value={form.daysToDeadline} onChange={(e) => setForm({ ...form, daysToDeadline: e.target.value })} required />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" icon={Target} className={loading ? "opacity-75" : ""}>
              {loading ? "Running XGBoost & SHAP..." : "Evaluate Denial Risk"}
            </Button>
          </div>
        </form>

        <section className="predict-result panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Explainable AI</span>
              <h2>Prediction & Root Causes</h2>
            </div>
          </div>

          {result ? (
            <div className="space-y-5 p-2">
              <div className="flex items-center justify-between rounded-2xl bg-[#EEF2F6] p-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7C8A9C]">Predicted Denial Risk</div>
                  <div className="font-serif text-[42px] leading-tight text-[#1E2F4D]">
                    {result.denialRiskScore.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7C8A9C]">Likely CARC</div>
                  <div className="font-mono text-[22px] font-bold text-[#C77B7B]">{result.predictedCarcCode}</div>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Top Contributing SHAP Factors</h4>
                <div className="mt-2 space-y-2">
                  {result.topContributingFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-[#DDE4EC] bg-white p-2.5 text-[12px]">
                      <span className="font-medium text-[#1E2F4D]">{f.label}</span>
                      <span className={`font-mono font-bold ${f.direction === "positive" || f.direction === "increases_risk" ? "text-[#C77B7B]" : "text-[#5FAE93]"}`}>
                        {f.direction === "positive" || f.direction === "increases_risk" ? `+${f.impact.toFixed(2)}` : `-${Math.abs(f.impact).toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#5B8CBF]/30 bg-[#5B8CBF]/10 p-3 text-[12px] text-[#1E2F4D]">
                <strong>Suggested Fix:</strong>
                <p className="mt-1 text-[#48586B]">{result.suggestedCorrectiveAction}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button icon={Plus} onClick={saveToQueue}>Save to Worklist</Button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-[#7C8A9C]">
              <Target size={32} className="mx-auto mb-3 text-[#5B8CBF]/40" />
              <p className="text-[13px]">Configure claim parameters and click "Evaluate Denial Risk" to run inference.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ClaimDetail({
  claimId,
  denials,
  onBack,
  onUpdateStatus,
  onRefresh,
  onNavigate,
}: {
  claimId: string;
  denials: Denial[];
  onBack: () => void;
  onUpdateStatus: (id: string, newStatus: ClaimStatus) => void;
  onRefresh?: () => void;
  onNavigate?: (path: string) => void;
}) {
  const baseClaim = denials.find((item) => item.id === claimId) || {
    id: claimId,
    patientRef: "PT-•••-7724",
    payer: "UnitedHealthcare",
    cptCodes: ["27447"],
    billedAmount: 18450,
    status: "denied" as ClaimStatus,
    carcCode: "CO-16",
    carcDescription: "Missing required clinical documentation",
    rarcCode: "N290",
    groupCode: "CO" as const,
    agingDays: 1,
    deadline: "30 days",
    deadlineDays: 30,
    assignedTo: getCurrentUser().name || "Maya Alvarez",
    avatar: "MA",
    department: "Orthopedics",
  };

  const [claim, setClaim] = useState<Denial>(baseClaim);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; date: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([
    "Reviewing documentation against the payer’s medical necessity policy.",
  ]);
  const [noteInput, setNoteInput] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);

  useEffect(() => {
    setClaim(baseClaim);
    if (baseClaim?.id) {
      fetchClaimDocuments(baseClaim.id).then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setUploadedFiles(
            docs.map((d: any) => ({
              name: d.document_title || d.name || "Document",
              date: d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently",
            }))
          );
        } else {
          setUploadedFiles([]);
        }
      });
    }
  }, [baseClaim]);

  const addNote = () => {
    if (!noteInput.trim()) return;
    setNotes([noteInput.trim(), ...notes]);
    setNoteInput("");
    setShowAddNote(false);
    toast.success("Note added to claim record");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const res = await uploadClaimDocument(claim.id, file, "operative_report");
      setUploadedFiles(prev => [{ name: file.name, date: "Just now" }, ...prev]);

      if (res.new_prediction) {
        setClaim(prev => ({
          ...prev,
          carcCode: res.new_prediction.predicted_carc_code || "CLEAN",
          carcDescription: res.new_prediction.predicted_carc_code === "CLEAN"
            ? "Clean claim - clinical documentation verified"
            : prev.carcDescription,
        }));
      }

      toast.success("Document uploaded & prediction re-calculated", {
        description: `Attached ${file.name}. Denial risk updated in real time.`,
      });
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    }
  };

  return (
    <div className="page-content claim-detail-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={15} />Back to worklist</button>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">Claim record / {claim.department}</div>
          <h1>{claim.id}</h1>
          <p>{claim.patientRef} <span>·</span> {claim.payer} <span>·</span> submitted Aug 22, 2026</p>
        </div>
        <div className="detail-actions">
          <Button
            variant="secondary"
            icon={FileCheck2}
            onClick={async () => {
              try {
                const appeal = await createAppeal({
                  claim_id: claim.id,
                  appeal_level: "Level 1",
                  notes: `Initiated appeal from claim record for ${claim.payer}.`,
                });
                onUpdateStatus(claim.id, "appealed");
                toast.success("Appeal started", { description: `Appeal ${appeal.id} created in Drafting column.` });
                if (onRefresh) onRefresh();
                if (onNavigate) onNavigate("/appeals");
              } catch (err: any) {
                toast.error("Failed to start appeal", { description: err.message });
              }
            }}
          >
            Start appeal
          </Button>
          <Button
            icon={CheckCircle2}
            onClick={async () => {
              await submitClaimOutcome(claim.id, "paid");
              onUpdateStatus(claim.id, "paid");
              toast.success("Claim marked paid", { description: "Adjudication outcome recorded." });
            }}
          >
            Mark paid
          </Button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel claim-summary-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Current state</span><h2>Denial summary</h2></div>
              <StatusBadge status={claim.status} />
            </div>
            <div className="summary-grid">
              <div><span>Denied amount</span><strong>{money(claim.billedAmount)}</strong></div>
              <div><span>CARC / group</span><strong>{claim.carcCode} <em>{claim.groupCode}</em></strong></div>
              <div><span>Aging</span><strong className="text-coral">{claim.agingDays} days</strong></div>
              <div><span>Appeal deadline</span><strong className={claim.deadlineDays <= 6 ? "text-coral" : "text-gold"}>{claim.deadline}</strong></div>
            </div>
            <div className="code-callout">
              <div className="code-callout-badge">{claim.carcCode}</div>
              <div>
                <strong>{claim.carcDescription}</strong>
                <p>RARC {claim.rarcCode} · The payer indicates the service was not supported under the submitted documentation or coverage policy.</p>
              </div>
            </div>
          </section>

          <section className="panel timeline-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Lifecycle</span><h2>Claim timeline</h2></div>
            </div>
            <div className="timeline">
              <div className="timeline-item complete"><div className="timeline-node"><Check size={13} /></div><div><strong>Submitted</strong><span>Aug 22, 2026 · 09:14 AM</span></div></div>
              <div className="timeline-item current"><div className="timeline-node"><AlertCircle size={13} /></div><div><strong>Evaluated · {claim.carcCode}</strong><span>{claim.carcDescription}</span></div></div>
              {uploadedFiles.map((doc, idx) => (
                <div className="timeline-item complete" key={idx}>
                  <div className="timeline-node"><Check size={13} /></div>
                  <div><strong>Document attached · {doc.name}</strong><span>{doc.date} · Operative record</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel notes-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Work notes</span><h2>Analyst notes</h2></div>
              <Button variant="ghost" icon={Plus} onClick={() => setShowAddNote(!showAddNote)}>
                {showAddNote ? "Cancel" : "Add note"}
              </Button>
            </div>

            {showAddNote && (
              <div className="mb-4 rounded-xl border border-[#DDE4EC] bg-[#F7F5F1] p-3">
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Enter analyst note regarding payer outreach or evidence..."
                  className="w-full rounded-lg border border-[#D9E0E8] bg-white p-2 text-[12px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF]"
                  rows={2}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setShowAddNote(false)} className="px-3 py-1 text-[11px] text-[#7C8A9C]">Cancel</button>
                  <button onClick={addNote} className="rounded-lg bg-[#5B8CBF] px-3 py-1 text-[11px] font-semibold text-white">Save note</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {notes.map((noteText, idx) => (
                <div className="note-entry" key={idx}>
                  <Avatar initials="MA" tone="blue" size="md" />
                  <div>
                    <p>{noteText}</p>
                    <span>Maya Alvarez · Sep 03, 2026</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <section className="panel owner-panel">
            <div className="panel-header"><span className="eyebrow">Ownership</span></div>
            <div className="owner-large">
              <Avatar initials={claim.avatar} tone="blue" size="lg" />
              <div>
                <strong>{claim.assignedTo}</strong>
                <span>Denial analyst</span>
              </div>
            </div>
            <div className="owner-line"><span>Department</span><strong>{claim.department}</strong></div>
            <div className="owner-line"><span>Priority</span><strong className="text-coral">High · 3d to deadline</strong></div>
          </section>

          <section className="panel details-panel">
            <div className="panel-header"><span className="eyebrow">Claim details</span></div>
            <div className="detail-list">
              <div><span>CPT / HCPCS</span><strong>{claim.cptCodes.join(" · ")}</strong></div>
              <div><span>Billed amount</span><strong>{money(claim.billedAmount)}</strong></div>
              <div><span>Place of service</span><strong>11 · Office / Outpatient</strong></div>
            </div>
          </section>

          <section className="panel next-action">
            <div className="next-icon"><CalendarClock size={17} /></div>
            <div>
              <span className="eyebrow">Next best action</span>
              <strong>{uploadedFiles.length > 0 ? "Clinical evidence attached" : "Secure medical necessity documentation"}</strong>
              <p>{uploadedFiles.length > 0 ? `Attached ${uploadedFiles[0].name}. Claim is ready for submission.` : `Upload the operative note to protect ${money(claim.billedAmount)}.`}</p>
              
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
                className="hidden"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />

              <button className="text-button" onClick={() => fileInputRef.current?.click()}>
                {uploadedFiles.length > 0 ? "Attach another document" : "Upload document"} <ArrowRight size={13} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Appeals({
  appeals,
  denials,
  onRefresh,
}: {
  appeals: AppealItem[];
  denials: Denial[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState(denials[0]?.id || "");
  const [appealLevel, setAppealLevel] = useState<"Level 1" | "Level 2">("Level 1");
  const [claimDocs, setClaimDocs] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedClaimId) {
      fetchClaimDocuments(selectedClaimId).then(setClaimDocs);
      setSelectedDocIds([]);
    }
  }, [selectedClaimId]);

  const handleCreateAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimId) {
      toast.error("Please select a claim to appeal");
      return;
    }
    setSubmitting(true);
    try {
      await createAppeal({
        claim_id: selectedClaimId,
        appeal_level: appealLevel,
        attached_document_ids: selectedDocIds,
        notes,
      });
      toast.success("Appeal initiated", {
        description: `${appealLevel} appeal created for claim ${selectedClaimId}.`,
      });
      setShowModal(false);
      setNotes("");
      onRefresh();
    } catch (err: any) {
      toast.error("Failed to create appeal", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (appealId: string, newStatus: "drafting" | "submitted" | "payer_review" | "resolved") => {
    try {
      await updateAppealStatus(appealId, newStatus);
      toast.success(`Appeal updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error("Status update failed", { description: err.message });
    }
  };

  const columns: { key: AppealItem["status"]; label: string; note: string }[] = [
    { key: "drafting", label: "Drafting", note: "Needs analyst action" },
    { key: "submitted", label: "Submitted", note: "With payer" },
    { key: "payer_review", label: "Payer Review", note: "Watch the clock" },
    { key: "resolved", label: "Resolved", note: "Closed this cycle" },
  ];

  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Appeal operations"
        title="Appeals pipeline"
        description="Track and progress clinical appeals with real attached documentation."
        action={<Button icon={Plus} onClick={() => setShowModal(true)}>New appeal</Button>}
      />

      <div className="kanban">
        {columns.map((column) => {
          const items = appeals.filter((appeal) => appeal.status === column.key);
          return (
            <section className="kanban-column" key={column.key}>
              <div className="kanban-header">
                <div>
                  <h3>{column.label}</h3>
                  <span>{column.note}</span>
                </div>
                <span className="column-count">{items.length}</span>
              </div>
              <div className="kanban-cards">
                {items.map((appeal) => (
                  <div className="appeal-card" key={appeal.id}>
                    <div className="appeal-card-top">
                      <span className="appeal-id">{appeal.id}</span>
                      <span className="level-pill level-1">{appeal.appeal_level}</span>
                    </div>
                    <strong>{appeal.claim_id}</strong>
                    <span className="appeal-payer">{appeal.payer}</span>
                    <div className="appeal-card-meta">
                      <span><Paperclip size={13} /> {appeal.attached_document_ids?.length || 0} docs attached</span>
                    </div>
                    {appeal.notes && <p className="mt-2 text-[11px] text-[#7C8A9C] italic">"{appeal.notes}"</p>}
                    <div className="mt-3 flex gap-1 pt-2 border-t border-[#EEF2F6]">
                      {column.key !== "submitted" && (
                        <button onClick={() => handleStatusChange(appeal.id, "submitted")} className="text-[10px] font-bold text-[#5B8CBF] hover:underline">
                          Mark Submitted →
                        </button>
                      )}
                      {column.key === "submitted" && (
                        <button onClick={() => handleStatusChange(appeal.id, "resolved")} className="text-[10px] font-bold text-[#5FAE93] hover:underline">
                          Mark Resolved ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {items.length === 0 && (
                <div className="column-empty"><Inbox size={18} /><span>No appeals here</span></div>
              )}
            </section>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/80 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-3">
              <h3 className="font-serif text-[20px] text-[#1E2F4D]">Initiate Clinical Appeal</h3>
              <button onClick={() => setShowModal(false)} className="text-[#7C8A9C] hover:text-[#1E2F4D]"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateAppeal} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Select Claim</label>
                <select
                  value={selectedClaimId}
                  onChange={(e) => setSelectedClaimId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] p-2.5 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF]"
                  required
                >
                  {denials.length === 0 && <option value="">No claims available — score a claim first</option>}
                  {denials.map((d) => (
                    <option key={d.id} value={d.id}>{d.id} — {d.payer} ({money(d.billedAmount)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Appeal Level</label>
                <select
                  value={appealLevel}
                  onChange={(e) => setAppealLevel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] p-2.5 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF]"
                >
                  <option value="Level 1">Level 1 — Reconsideration with Payer</option>
                  <option value="Level 2">Level 2 — External Independent Medical Review</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Attach Uploaded Documents</label>
                {claimDocs.length === 0 ? (
                  <p className="mt-1 text-[11px] text-[#7C8A9C]">No documents uploaded for this claim yet. You can upload chart notes on the claim details page.</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto rounded-xl border border-[#D9E0E8] p-2 bg-[#FBFAF8]">
                    {claimDocs.map((doc) => (
                      <label key={doc.id} className="flex items-center gap-2 text-[12px] text-[#1E2F4D] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocIds([...selectedDocIds, doc.id]);
                            else setSelectedDocIds(selectedDocIds.filter(id => id !== doc.id));
                          }}
                        />
                        <span>{doc.document_title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C8A9C]">Analyst Rationale / Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Medical necessity justification or policy citations..."
                  className="mt-1 w-full rounded-xl border border-[#D9E0E8] bg-[#FBFAF8] p-2.5 text-[13px] text-[#1E2F4D] outline-none focus:border-[#5B8CBF]"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EEF2F6]">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" icon={FileCheck2} className={submitting ? "opacity-75" : ""}>
                  {submitting ? "Submitting..." : "Create Appeal Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimsLogView({ denials, onOpenClaim }: { denials: Denial[]; onOpenClaim: (id: string) => void }) {
  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Audit trail"
        title="Claims log"
        description="Immutable audit history of all claims scored, outcomes submitted, and predictions executed."
      />
      <div className="table-wrap panel mt-4">
        {denials.length === 0 ? (
          <div className="p-12 text-center text-[#7C8A9C]">
            <FileText size={32} className="mx-auto mb-3 text-[#5B8CBF]/40" />
            <p className="text-[13px]">No claim records logged yet.</p>
          </div>
        ) : (
          <table className="claim-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Payer</th>
                <th>Procedure Code</th>
                <th className="text-right">Billed Amount</th>
                <th>CARC Flag</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {denials.map((d) => (
                <tr key={d.id} className="clickable-row" onClick={() => onOpenClaim(d.id)}>
                  <td className="font-mono font-bold text-[#1E2F4D]">{d.id}</td>
                  <td>{d.payer}</td>
                  <td>{d.cptCodes.join(", ")}</td>
                  <td className="text-right font-mono font-bold">{money(d.billedAmount)}</td>
                  <td><span className="carc-code-tag">{d.carcCode}</span></td>
                  <td><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Payers() {
  const [search, setSearch] = useState("");
  const filteredPayers = payerRules.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.auth.toLowerCase().includes(search.toLowerCase()) ||
    p.method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Reference library / 5 major payers"
        title="Payer rules"
        description="Timely filing, authorization, and appeal guidance for active health plans."
      />
      <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPayers.map((p) => (
          <div key={p.name} className="panel p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar initials={p.initials} tone="blue" size="md" />
              <div>
                <strong className="text-[15px] text-[#1E2F4D]">{p.name}</strong>
                <div className="text-[11px] text-[#7C8A9C]">Filing limit: {p.filing}</div>
              </div>
            </div>
            <div className="text-[12px] text-[#48586B]">
              <strong>Prior Auth:</strong> <p>{p.auth}</p>
            </div>
            <div className="text-[12px] text-[#48586B]">
              <strong>Appeal Window:</strong> {p.appeal} ({p.method})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Intelligence & Reporting"
        title="Denial analytics"
        description="Payer performance benchmarks, avoidable denial distributions, and recovery metrics."
      />
      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h3 className="font-serif text-[18px] text-[#1E2F4D]">Historical Denial Rates by Payer</h3>
          <p className="text-[12px] text-[#7C8A9C] mt-1">Based on benchmark priors from 120k claim records</p>
          <div className="mt-4 space-y-3">
            {[
              { payer: "UnitedHealthcare", rate: "18.4%", risk: "High", color: "#C77B7B" },
              { payer: "Aetna", rate: "14.2%", risk: "Moderate", color: "#C9A24B" },
              { payer: "Cigna", rate: "12.8%", risk: "Moderate", color: "#C9A24B" },
              { payer: "Humana", rate: "11.5%", risk: "Low", color: "#5FAE93" },
              { payer: "Medicare Part B", rate: "8.9%", risk: "Low", color: "#5FAE93" },
            ].map(item => (
              <div key={item.payer} className="flex items-center justify-between border-b border-[#EEF2F6] pb-2 text-[13px]">
                <span className="font-medium text-[#1E2F4D]">{item.payer}</span>
                <span className="font-mono font-bold" style={{ color: item.color }}>{item.rate} ({item.risk})</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <h3 className="font-serif text-[18px] text-[#1E2F4D]">Top Preventable Reason Codes (CARC)</h3>
          <p className="text-[12px] text-[#7C8A9C] mt-1">Target areas for pre-submission clinical intervention</p>
          <div className="mt-4 space-y-3">
            {[
              { code: "CO-197", desc: "Prior Authorization Missing", pct: "38%" },
              { code: "CO-16", desc: "Missing Clinical Documentation", pct: "27%" },
              { code: "CO-29", desc: "Timely Filing Limit Exceeded", pct: "16%" },
              { code: "CO-27", desc: "Coverage Inactive on Date of Service", pct: "11%" },
              { code: "CO-50", desc: "Medical Necessity Deviation", pct: "8%" },
            ].map(item => (
              <div key={item.code} className="flex items-center justify-between border-b border-[#EEF2F6] pb-2 text-[13px]">
                <div>
                  <span className="font-mono font-bold text-[#1E2F4D]">{item.code}</span>
                  <span className="ml-2 text-[12px] text-[#7C8A9C]">{item.desc}</span>
                </div>
                <span className="font-mono font-bold text-[#5B8CBF]">{item.pct}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsView() {
  const [activeTab, setActiveTab] = useState<"team" | "workflow" | "security">("team");
  const [settings, setSettings] = useState<WorkspaceSettings>({
    workspace_id: "ws-northstar-001",
    auto_assign: true,
    default_appeal_deadline_days: 30,
    high_risk_threshold: 60,
    email_notifications: true,
    deadline_alerts: true,
    weekly_digest: false,
    updated_at: new Date().toISOString(),
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    workspace_id: "ws-northstar-001",
    session_timeout_minutes: 60,
    audit_log_retention_days: 2555,
    enforce_ip_allowlist: false,
    updated_at: new Date().toISOString(),
  });

  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadMembers = () => {
    setLoadingMembers(true);
    fetchWorkspaceMembers()
      .then((members) => {
        if (Array.isArray(members) && members.length > 0) {
          setTeamMembers(members);
        }
      })
      .finally(() => setLoadingMembers(false));
  };

  useEffect(() => {
    fetchWorkspaceSettings().then(setSettings);
    fetchSecuritySettings().then(setSecurity);
    loadMembers();
  }, []);

  useEffect(() => {
    if (activeTab === "team") {
      loadMembers();
    }
  }, [activeTab]);

  const handleSaveWorkflow = async () => {
    setSaving(true);
    try {
      const updated = await saveWorkspaceSettings(settings);
      setSettings(updated);
      toast.success("Workflow settings saved", { description: "Triage rules updated across workspace." });
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSaving(true);
    try {
      const updated = await saveSecuritySettings(security);
      setSecurity(updated);
      toast.success("Security settings saved");
    } catch (err: any) {
      toast.error("Failed to save security settings", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content settings-page">
      <SectionHeading
        eyebrow="Workspace administration"
        title="Settings"
        description="Manage your team invites, persisted workflow rules, and compliance security settings."
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <button className={`settings-nav-item ${activeTab === "team" ? "active" : ""}`} onClick={() => setActiveTab("team")}>
            <UsersRound size={16} />Team & Invites
          </button>
          <button className={`settings-nav-item ${activeTab === "workflow" ? "active" : ""}`} onClick={() => setActiveTab("workflow")}>
            <SlidersHorizontal size={16} />Workflow Defaults
          </button>
          <button className={`settings-nav-item ${activeTab === "security" ? "active" : ""}`} onClick={() => setActiveTab("security")}>
            <ShieldCheck size={16} />Security & Compliance
          </button>
        </aside>

        <div className="settings-content">
          {activeTab === "team" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Team Management</span><h2>Workspace Invites</h2></div>
                <Button
                  icon={Plus}
                  onClick={async () => {
                    try {
                      const res = await generateWorkspaceInvite("Analyst");
                      toast.success(`Invite Code: ${res.invite_code}`, {
                        description: "Valid for 7 days. Share this code with colleagues to auto-join this workspace.",
                        duration: 10000,
                      });
                      loadMembers();
                    } catch (err: any) {
                      toast.error("Invite generation failed", { description: err.message });
                    }
                  }}
                >
                  Generate Invite Code
                </Button>
              </div>
              <p className="panel-description">
                Invite team members with role-based access. New users enter this code at <code>/create-account</code> to automatically join your organization.
              </p>
              <div className="team-list">
                {teamMembers.length === 0 ? (
                  <div className="p-6 text-center text-[12px] text-[#7C8A9C]">
                    {loadingMembers ? "Loading team members..." : "No team members found."}
                  </div>
                ) : (
                  teamMembers.map((member) => {
                    const initials = (member.name || member.work_email || "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "U";
                    const tone =
                      member.role === "Admin"
                        ? "blue"
                        : member.role === "Analyst"
                        ? "violet"
                        : member.role === "Biller"
                        ? "gold"
                        : "green";
                    return (
                      <div className="team-row" key={member.id || member.work_email}>
                        <Avatar initials={initials} tone={tone} size="md" />
                        <div className="team-member">
                          <strong>{member.name || member.work_email}</strong>
                          <span>{member.work_email}</span>
                        </div>
                        <span className="role-pill">{member.role}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeTab === "workflow" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Triage Rules</span><h2>Workflow Defaults</h2></div>
                <Button onClick={handleSaveWorkflow} className={saving ? "opacity-75" : ""}>
                  {saving ? "Saving..." : "Save Workflow Rules"}
                </Button>
              </div>
              <div className="p-4 space-y-4 text-[13px]">
                <div className="preference-row cursor-pointer" onClick={() => setSettings({ ...settings, auto_assign: !settings.auto_assign })}>
                  <div><strong>Auto-assign high urgency claims</strong><span>Automatically route claims with &le; 7 days deadline to senior analysts.</span></div>
                  <div className={`toggle ${settings.auto_assign ? "on" : ""}`}><span /></div>
                </div>
                <div className="flex items-center justify-between border-t border-[#EEF2F6] pt-3">
                  <div><strong>High-Risk Scoring Cutoff (%)</strong><p className="text-[11px] text-[#7C8A9C]">Claims scoring above this threshold generate urgent alerts</p></div>
                  <input
                    type="number"
                    value={settings.high_risk_threshold}
                    onChange={(e) => setSettings({ ...settings, high_risk_threshold: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[#D9E0E8] p-1.5 text-center font-mono text-[13px]"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-[#EEF2F6] pt-3">
                  <div><strong>Default Appeal Deadline (Days)</strong><p className="text-[11px] text-[#7C8A9C]">Standard SLA for Level 1 appeal submissions</p></div>
                  <input
                    type="number"
                    value={settings.default_appeal_deadline_days}
                    onChange={(e) => setSettings({ ...settings, default_appeal_deadline_days: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[#D9E0E8] p-1.5 text-center font-mono text-[13px]"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "security" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Compliance</span><h2>Security Settings</h2></div>
                <Button onClick={handleSaveSecurity} className={saving ? "opacity-75" : ""}>
                  {saving ? "Saving..." : "Save Security"}
                </Button>
              </div>
              <div className="p-4 space-y-4 text-[13px]">
                <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-3">
                  <div>
                    <strong>Two-Factor Authentication (2FA)</strong>
                    <p className="text-[11px] text-[#7C8A9C]">Hardware Security Keys & TOTP authenticator app enforcement</p>
                  </div>
                  <span className="rounded-full bg-[#7C8A9C]/15 px-2.5 py-1 text-[11px] font-semibold text-[#7C8A9C]">
                    Coming soon in Enterprise v1.2
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-3">
                  <div>
                    <strong>Session Timeout (Minutes)</strong>
                    <p className="text-[11px] text-[#7C8A9C]">Automatic logout duration for inactivity</p>
                  </div>
                  <input
                    type="number"
                    value={security.session_timeout_minutes}
                    onChange={(e) => setSecurity({ ...security, session_timeout_minutes: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[#D9E0E8] p-1.5 text-center font-mono text-[13px]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Audit Log Retention (Days)</strong>
                    <p className="text-[11px] text-[#7C8A9C]">HIPAA-compliant immutable audit log preservation</p>
                  </div>
                  <input
                    type="number"
                    value={security.audit_log_retention_days}
                    onChange={(e) => setSecurity({ ...security, audit_log_retention_days: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[#D9E0E8] p-1.5 text-center font-mono text-[13px]"
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Topbar({
  onNavigate,
  onLogout,
  notifications,
  onRefreshNotifications,
}: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  notifications: NotificationItem[];
  onRefreshNotifications: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const currentUser = getCurrentUser();
  const initials = currentUser.name.split(" ").map(n => n[0]).join("") || "MA";
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    onRefreshNotifications();
    toast.success("All notifications marked as read");
  };

  const handleNotifClick = async (notif: NotificationItem) => {
    await markNotificationRead(notif.id);
    onRefreshNotifications();
    setShowNotifPanel(false);
    if (notif.link) {
      onNavigate(notif.link);
    }
  };

  return (
    <header className="topbar glass relative">
      <button className="mobile-menu icon-button"><Menu size={19} /></button>
      <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>Revenue integrity</strong></div>
      <div className="global-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onNavigate("/worklist");
              toast.success(query ? `Searching for ${query}` : "Opened worklist");
            }
          }}
          placeholder="Search claims, payers, patient refs..."
        />
        <kbd><Command size={12} />K</kbd>
      </div>
      <div className="topbar-actions relative">
        <div className="relative">
          <button
            className="topbar-icon relative"
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C77B7B] text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifPanel && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-white/80 bg-white p-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-[#EEF2F6] pb-2">
                <strong className="text-[13px] text-[#1E2F4D]">Notifications ({unreadCount} unread)</strong>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-[#5B8CBF] hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-[11px] text-[#7C8A9C]">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`rounded-xl p-2.5 text-[12px] cursor-pointer transition ${n.is_read ? "bg-white hover:bg-[#F8FAFC]" : "bg-[#5B8CBF]/10 font-medium"}`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-[#1E2F4D] text-[12px]">{n.title}</strong>
                        <span className="text-[9px] text-[#7C8A9C] font-mono">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#48586B] leading-tight">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-divider" />
        <div className="relative">
          <button
            className="topbar-user"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <Avatar initials={initials} tone="blue" />
            <span>{currentUser.name.split(" ")[0]}</span>
            <ChevronDown size={13} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_15px_35px_rgba(20,40,70,0.12)] backdrop-blur-xl">
              <div className="border-b border-[#DDE4EC] px-3 py-2">
                <div className="text-[13px] font-bold text-[#1E2F4D]">{currentUser.name}</div>
                <div className="text-[11px] text-[#7C8A9C]">{currentUser.email}</div>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); onNavigate("/settings"); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-[#48586B] hover:bg-[#F3F6F9]"
              >
                <Settings2 size={14} /> Workspace Settings
              </button>
              <button
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-[#C77B7B] hover:bg-[#FDF5F5]"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  location,
  onNavigate,
  onLogout,
}: {
  location: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const currentUser = getCurrentUser();
  const initials = currentUser.name.split(" ").map(n => n[0]).join("") || "MA";

  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brand-mark">DG</div>
        <div><strong>DenialGuard <em>AI</em></strong><span>RCM OPERATIONS</span></div>
      </div>
      <button className="workspace-switcher" onClick={() => onNavigate("/settings")}>
        <span className="workspace-avatar"><Building2 size={16} /></span>
        <span><strong>Northstar Health</strong><small>Revenue Integrity</small></span>
        <ChevronDown size={14} />
      </button>
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label} className="nav-group">
            <span className="nav-label">{group.label}</span>
            {group.items.map((item) => {
              const active = location === item.path || (item.path === "/worklist" && location === "/") || (item.path === "/claims" && location.startsWith("/claims/"));
              return (
                <button key={item.path} className={`nav-item ${active ? "active" : ""}`} onClick={() => onNavigate(item.path)}>
                  <item.icon size={17} strokeWidth={active ? 2.1 : 1.7} />
                  <span>{item.label}</span>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-status">
          <span className="pulse-dot green" />
          <div><strong>Systems operational</strong><span>XGBoost & SHAP Ready</span></div>
          <CheckCircle2 size={15} color={COLORS.green} />
        </div>
        <div className="flex items-center justify-between border-t border-[#DDE4EC] pt-3 mt-1">
          <div className="user-profile border-0 p-0 flex items-center gap-2">
            <Avatar initials={initials} tone="blue" />
            <div><strong>{currentUser.name}</strong><span>{currentUser.role}</span></div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7C8A9C] hover:bg-[#FDF2F2] hover:text-[#C77B7B] transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const [denials, setDenials] = useState<Denial[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const path = location.split("?")[0];

  const loadData = async () => {
    try {
      const [logs, appls, notifs] = await Promise.all([
        fetchClaimsLog(),
        fetchAppeals(),
        fetchNotifications(),
      ]);

      const mappedDenials: Denial[] = logs.map((row: any) => ({
        id: row.claim_id,
        patientRef: row.patient_id ? `PT-•••-${row.patient_id.slice(-4)}` : "PT-•••-7724",
        payer: row.payer || "UnitedHealthcare",
        cptCodes: [row.cpt_code || "27447"],
        billedAmount: Number(row.charge_amount) || 18450,
        status: (row.actual_outcome === "paid" ? "paid" : row.actual_outcome === "denied" ? "denied" : (row.predicted_risk_score && row.predicted_risk_score >= 60 ? "denied" : "pending")) as ClaimStatus,
        carcCode: row.predicted_carc_code || "CO-16",
        carcDescription: row.suggested_corrective_action || "Pre-submission review recommended",
        rarcCode: "N290",
        groupCode: "CO",
        agingDays: row.days_to_filing_deadline ? Math.max(1, 90 - row.days_to_filing_deadline) : 1,
        deadline: `${row.days_to_filing_deadline || 30} days`,
        deadlineDays: row.days_to_filing_deadline || 30,
        assignedTo: "Maya Alvarez",
        avatar: "MA",
        department: row.provider_specialty || "Orthopedics",
      }));

      setDenials(mappedDenials);
      setAppeals(appls);
      setNotifications(notifs);
    } catch (err) {
      console.warn("Could not load backend data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_profile");
    toast.success("Signed out successfully");
    setLocation("/sign-in");
  };

  const handleSaveClaim = (claim: Denial) => {
    setDenials(prev => [claim, ...prev]);
    loadData();
  };

  const handleUpdateStatus = (id: string, newStatus: ClaimStatus) => {
    setDenials(denials.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const renderPage = () => {
    if (path === "/dashboard") return <Dashboard onNavigate={setLocation} denials={denials} appeals={appeals} />;
    if (path === "/predict") return <Predict onSaveClaim={handleSaveClaim} />;
    if (path === "/claims") return <ClaimsLogView denials={denials} onOpenClaim={(id) => setLocation(`/claims/${id}`)} />;
    if (path.startsWith("/claims/")) {
      const targetId = path.split("/")[2];
      return (
        <ClaimDetail
          claimId={targetId}
          denials={denials}
          onBack={() => setLocation("/worklist")}
          onUpdateStatus={handleUpdateStatus}
          onRefresh={loadData}
          onNavigate={setLocation}
        />
      );
    }
    if (path === "/appeals") return <Appeals appeals={appeals} denials={denials} onRefresh={loadData} />;
    if (path === "/payers") return <Payers />;
    if (path === "/analytics") return <Analytics />;
    if (path === "/settings") return <SettingsView />;
    return <Worklist denials={denials} onOpenClaim={(id) => setLocation(`/claims/${id}`)} onScoreClaim={() => setLocation("/predict")} />;
  };

  return (
    <div className="app-shell ambient-shell">
      <Sidebar location={path} onNavigate={setLocation} onLogout={handleLogout} />
      <div className="app-main">
        <Topbar
          onNavigate={setLocation}
          onLogout={handleLogout}
          notifications={notifications}
          onRefreshNotifications={loadData}
        />
        <main className="main-surface">{renderPage()}</main>
      </div>
    </div>
  );
}
