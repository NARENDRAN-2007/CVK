import { useMemo, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import { predictClaim, submitClaimOutcome, getCurrentUser, uploadClaimDocument, generateWorkspaceInvite, type PredictionResponse } from "@/lib/api";
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

type ClaimStatus = "paid" | "pending" | "denied" | "appealed" | "written_off";
type Denial = {
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

type Appeal = {
  id: string;
  claimId: string;
  payer: string;
  level: 1 | 2 | 3;
  status: "drafting" | "submitted" | "awaiting_response" | "won" | "lost";
  deadline: string;
  daysToDeadline: number;
  attachments: number;
  notes: string;
};

const INITIAL_DENIALS: Denial[] = [
  { id: "CLM-2026-08421", patientRef: "PT-•••-4918", payer: "Aetna", cptCodes: ["99214", "93000"], billedAmount: 482, status: "denied", carcCode: "CO-50", carcDescription: "Medical necessity", rarcCode: "N130", groupCode: "CO", agingDays: 42, deadline: "Sep 06, 2026", deadlineDays: 3, assignedTo: "Maya Alvarez", avatar: "MA", department: "Cardiology" },
  { id: "CLM-2026-08397", patientRef: "PT-•••-7724", payer: "UnitedHealthcare", cptCodes: ["27447"], billedAmount: 18450, status: "denied", carcCode: "CO-197", carcDescription: "Prior authorization required", rarcCode: "N290", groupCode: "CO", agingDays: 38, deadline: "Sep 09, 2026", deadlineDays: 6, assignedTo: "Jordan Lee", avatar: "JL", department: "Orthopedics" },
  { id: "CLM-2026-08374", patientRef: "PT-•••-1153", payer: "Medicare Part B", cptCodes: ["64483", "77003"], billedAmount: 2180, status: "appealed", carcCode: "CO-16", carcDescription: "Missing required information", rarcCode: "N290", groupCode: "CO", agingDays: 31, deadline: "Sep 13, 2026", deadlineDays: 10, assignedTo: "Maya Alvarez", avatar: "MA", department: "Pain Medicine" },
  { id: "CLM-2026-08361", patientRef: "PT-•••-3881", payer: "Cigna", cptCodes: ["97110", "97140"], billedAmount: 960, status: "denied", carcCode: "CO-29", carcDescription: "Timely filing limit exceeded", rarcCode: "N211", groupCode: "CO", agingDays: 29, deadline: "Sep 18, 2026", deadlineDays: 15, assignedTo: "Priya Shah", avatar: "PS", department: "Rehab Services" },
  { id: "CLM-2026-08345", patientRef: "PT-•••-9026", payer: "Humana", cptCodes: ["99223"], billedAmount: 1240, status: "denied", carcCode: "CO-11", carcDescription: "Diagnosis inconsistent with procedure", rarcCode: "N386", groupCode: "CO", agingDays: 24, deadline: "Sep 20, 2026", deadlineDays: 17, assignedTo: "Jordan Lee", avatar: "JL", department: "Hospital Medicine" },
  { id: "CLM-2026-08298", patientRef: "PT-•••-0457", payer: "Aetna", cptCodes: ["29881"], billedAmount: 5320, status: "appealed", carcCode: "CO-204", carcDescription: "Service not covered under plan", rarcCode: "N115", groupCode: "CO", agingDays: 19, deadline: "Sep 25, 2026", deadlineDays: 22, assignedTo: "Maya Alvarez", avatar: "MA", department: "Orthopedics" },
  { id: "CLM-2026-08266", patientRef: "PT-•••-6189", payer: "Medicare Part B", cptCodes: ["G0463"], billedAmount: 385, status: "denied", carcCode: "PR-1", carcDescription: "Deductible amount", rarcCode: "N/A", groupCode: "PR", agingDays: 14, deadline: "Oct 02, 2026", deadlineDays: 29, assignedTo: "Priya Shah", avatar: "PS", department: "Primary Care" },
  { id: "CLM-2026-08211", patientRef: "PT-•••-2276", payer: "Cigna", cptCodes: ["90837"], billedAmount: 240, status: "denied", carcCode: "CO-18", carcDescription: "Duplicate claim/service", rarcCode: "N522", groupCode: "CO", agingDays: 8, deadline: "Oct 05, 2026", deadlineDays: 32, assignedTo: "Jordan Lee", avatar: "JL", department: "Behavioral Health" },
];

const INITIAL_APPEALS: Appeal[] = [
  { id: "APL-1049", claimId: "CLM-2026-08374", payer: "Medicare Part B", level: 1, status: "awaiting_response", deadline: "Sep 13, 2026", daysToDeadline: 10, attachments: 4, notes: "Operative report and corrected claim attached." },
  { id: "APL-1045", claimId: "CLM-2026-08298", payer: "Aetna", level: 2, status: "submitted", deadline: "Sep 25, 2026", daysToDeadline: 22, attachments: 7, notes: "Peer-to-peer review requested by payer." },
  { id: "APL-1042", claimId: "CLM-2026-08174", payer: "Cigna", level: 1, status: "drafting", deadline: "Sep 08, 2026", daysToDeadline: 5, attachments: 2, notes: "Need updated therapy plan from Rehab Services." },
  { id: "APL-1038", claimId: "CLM-2026-07988", payer: "Humana", level: 1, status: "awaiting_response", deadline: "Sep 16, 2026", daysToDeadline: 13, attachments: 5, notes: "Medical records received by payer portal." },
  { id: "APL-1029", claimId: "CLM-2026-07745", payer: "UnitedHealthcare", level: 3, status: "won", deadline: "Aug 28, 2026", daysToDeadline: -6, attachments: 8, notes: "Reconsideration approved in full." },
];

const payerRules = [
  { name: "Aetna", initials: "AE", color: "#5B8CBF", filing: "180 days", auth: "Prior auth for advanced imaging, elective surgery", appeal: "180 days", method: "Provider portal" },
  { name: "Cigna", initials: "CI", color: "#8B7EC8", filing: "180 days", auth: "Auth required for PT after visit 6", appeal: "180 days", method: "Fax / portal" },
  { name: "Humana", initials: "HU", color: "#C9A24B", filing: "365 days", auth: "Auth for inpatient and DME", appeal: "60 days", method: "Provider portal" },
  { name: "Medicare Part B", initials: "MB", color: "#5FAE93", filing: "1 year", auth: "LCD/NCD-specific; check MAC", appeal: "120 days", method: "Electronic" },
  { name: "UnitedHealthcare", initials: "UH", color: "#C77B7B", filing: "90 days", auth: "Prior auth for surgery and specialty drugs", appeal: "180 days", method: "UHC Link" },
];

const trendData = [
  { month: "Apr", rate: 8.4, target: 7.5 },
  { month: "May", rate: 7.9, target: 7.5 },
  { month: "Jun", rate: 7.6, target: 7.5 },
  { month: "Jul", rate: 7.1, target: 7.5 },
  { month: "Aug", rate: 6.8, target: 7.5 },
  { month: "Sep", rate: 6.4, target: 7.5 },
];

const carcData = [
  { code: "CO", label: "Contractual obligation", value: 68, color: COLORS.blue },
  { code: "PR", label: "Patient responsibility", value: 16, color: COLORS.gold },
  { code: "OA", label: "Other adjustment", value: 9, color: COLORS.violet },
  { code: "PI", label: "Payer initiated", value: 7, color: COLORS.coral },
];

const analyticsData = [
  { name: "Aetna", denial: 8.2, recovered: 72 },
  { name: "UHC", denial: 7.4, recovered: 68 },
  { name: "Cigna", denial: 6.1, recovered: 75 },
  { name: "Humana", denial: 5.8, recovered: 66 },
  { name: "Medicare", denial: 4.9, recovered: 81 },
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

const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function StatusBadge({ status }: { status: ClaimStatus | Appeal["status"] }) {
  const config: Record<string, { label: string; className: string; dot: string }> = {
    paid: { label: "Paid", className: "badge-paid", dot: "bg-[#5FAE93]" },
    pending: { label: "Pending", className: "badge-pending", dot: "bg-[#C9A24B]" },
    denied: { label: "Denied", className: "badge-denied", dot: "bg-[#C77B7B]" },
    appealed: { label: "Appealed", className: "badge-appealed", dot: "bg-[#8B7EC8]" },
    written_off: { label: "Written off", className: "badge-neutral", dot: "bg-[#7C8A9C]" },
    drafting: { label: "Drafting", className: "badge-neutral", dot: "bg-[#7C8A9C]" },
    submitted: { label: "Submitted", className: "badge-appealed", dot: "bg-[#8B7EC8]" },
    awaiting_response: { label: "Awaiting response", className: "badge-pending", dot: "bg-[#C9A24B]" },
    won: { label: "Won", className: "badge-paid", dot: "bg-[#5FAE93]" },
    lost: { label: "Lost", className: "badge-denied", dot: "bg-[#C77B7B]" },
  };
  const item = config[status] ?? config.pending;
  return (
    <span className={`status-badge ${item.className}`}>
      <span className={`status-dot ${item.dot}`} />
      {item.label}
    </span>
  );
}

function Deadline({ days, label }: { days: number; label: string }) {
  const tone = days <= 6 ? "deadline-critical" : days <= 14 ? "deadline-warning" : "deadline-safe";
  return (
    <div className={`deadline ${tone}`}>
      <span>{days < 0 ? "Past due" : `${days}d left`}</span>
      <small>{label}</small>
    </div>
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
        <label>CARC group</label>
        <div className="chip-grid">
          <button className="filter-chip active">All</button>
          <button className="filter-chip">CO</button>
          <button className="filter-chip">PR</button>
          <button className="filter-chip">OA</button>
          <button className="filter-chip">PI</button>
        </div>
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
      <div className="filter-summary">
        <div><span className="summary-dot dot-coral" /><span>Critical deadline</span><strong>2</strong></div>
        <div><span className="summary-dot dot-gold" /><span>Due this week</span><strong>3</strong></div>
        <div><span className="summary-dot dot-blue" /><span>Unassigned</span><strong>0</strong></div>
      </div>
      <button className="clear-link" onClick={() => { setPayer("all"); setAging("all"); setAssignee("all"); }}>
        Clear all filters <X size={13} />
      </button>
    </aside>
  );
}

function Worklist({ denials, onOpenClaim, onAddDenial }: { denials: Denial[]; onOpenClaim: (id: string) => void; onAddDenial: () => void }) {
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
        eyebrow="Revenue integrity / Queue 01"
        title="Denial worklist"
        description="Prioritized by appeal deadline, aging, and financial exposure."
        action={
          <div className="heading-actions">
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
                toast.success("Worklist exported successfully", { description: "Downloaded CSV with active claims." });
              }}
            >
              Export queue
            </Button>
            <Button icon={Plus} onClick={onAddDenial}>Add denial</Button>
          </div>
        }
      />
      <div className="worklist-metrics">
        <div className="metric-inline"><span className="metric-icon coral"><AlertCircle size={15} /></span><div><strong>{filtered.filter(c => c.status === "denied").length}</strong><span>open denials</span></div></div>
        <div className="metric-inline"><span className="metric-icon gold"><CalendarClock size={15} /></span><div><strong>3</strong><span>deadlines ≤ 7d</span></div></div>
        <div className="metric-inline"><span className="metric-icon blue"><CircleDollarSign size={15} /></span><div><strong>${(filtered.reduce((acc, c) => acc + c.billedAmount, 0) / 1000).toFixed(1)}k</strong><span>exposure in queue</span></div></div>
        <div className="metric-inline"><span className="metric-icon violet"><FileCheck2 size={15} /></span><div><strong>{filtered.filter(c => c.status === "appealed").length}</strong><span>in appeal</span></div></div>
      </div>
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
              <button className="icon-button" title="Filter view"><ListFilter size={16} /></button>
              <button className="icon-button" title="Refresh" onClick={() => toast.success("Queue refreshed")}><RefreshCw size={15} /></button>
              <span className="table-count">{filtered.length} of {denials.length} claims</span>
            </div>
          </div>
          {selected.length > 0 && (
            <div className="bulk-bar">
              <span><strong>{selected.length}</strong> selected</span>
              <button onClick={() => toast.success("Claims assigned", { description: "Selected claims assigned to Maya Alvarez." })}>
                <UsersRound size={14} />Assign
              </button>
              <button onClick={() => toast.success("Marked for appeal")}>
                <FileCheck2 size={14} />Mark for appeal
              </button>
              <button onClick={() => toast.success("Export started")}>
                <Download size={14} />Export
              </button>
              <button className="bulk-clear" onClick={() => setSelected([])}><X size={14} /></button>
            </div>
          )}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="check-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all claims" /></th>
                  <th>Claim / patient ref</th>
                  <th>Payer</th>
                  <th>Denial reason</th>
                  <th>Exposure</th>
                  <th>Aging</th>
                  <th>Appeal deadline</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((claim, index) => (
                  <tr key={claim.id} className="table-row" style={{ animationDelay: `${index * 40}ms` }} onClick={() => onOpenClaim(claim.id)}>
                    <td className="check-cell" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(claim.id)} onChange={() => setSelected((current) => current.includes(claim.id) ? current.filter((id) => id !== claim.id) : [...current, claim.id])} aria-label={`Select ${claim.id}`} />
                    </td>
                    <td><div className="claim-cell"><strong>{claim.id}</strong><span>{claim.patientRef} <em>·</em> {claim.department}</span></div></td>
                    <td><div className="payer-cell"><span className="payer-mark">{claim.payer === "Medicare Part B" ? "MB" : claim.payer.slice(0, 2).toUpperCase()}</span>{claim.payer}</div></td>
                    <td><div className="reason-cell"><div><strong>{claim.carcCode}</strong><span>{claim.carcDescription}</span></div><small>{claim.rarcCode !== "N/A" ? `RARC ${claim.rarcCode}` : "No RARC"}</small></div></td>
                    <td><span className="tabular amount">{money(claim.billedAmount)}</span><small className="subtle">{claim.cptCodes.join(" · ")}</small></td>
                    <td><span className={`aging-number ${claim.agingDays > 30 ? "aging-high" : claim.agingDays > 14 ? "aging-mid" : "aging-low"}`}>{claim.agingDays}d</span></td>
                    <td><Deadline days={claim.deadlineDays} label={claim.deadline} /></td>
                    <td><div className="owner-cell"><Avatar initials={claim.avatar} tone={claim.avatar === "PS" ? "gold" : claim.avatar === "JL" ? "violet" : "blue"} /><span>{claim.assignedTo.split(" ")[0]}</span></div></td>
                    <td><StatusBadge status={claim.status} /></td>
                    <td><ChevronRight size={15} color={COLORS.muted} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="zero-state">
                <div className="empty-icon"><Search size={21} /></div>
                <h3>No denials match these filters</h3>
                <p>Try clearing a filter or searching for a different claim ID.</p>
                <button className="clear-link" onClick={() => { setSearch(""); setPayer("all"); setAging("all"); setAssignee("all"); }}>
                  Clear filters <X size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="table-footer">
            <span>Showing {filtered.length} prioritized denials</span>
            <div className="pagination">
              <button className="icon-button" disabled><ArrowLeft size={14} /></button>
              <button className="page-number active">1</button>
              <button className="page-number">2</button>
              <button className="icon-button"><ArrowRight size={14} /></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate, appeals }: { onNavigate: (path: string) => void; appeals: Appeal[] }) {
  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Portfolio overview / Sep 03, 2026"
        title="Good morning, Maya"
        description="Here’s the revenue integrity picture for Northstar Health System."
        action={<Button variant="secondary" icon={RefreshCw} onClick={() => toast.success("Dashboard refreshed")}>Refresh data</Button>}
      />
      <div className="kpi-grid">
        <KpiCard label="Open denials" value="$124,860" delta="12.8%" detail="vs. prior 30 days" icon={CircleDollarSign} tone="coral" onClick={() => onNavigate("/worklist")} />
        <KpiCard label="Denial rate" value="6.4%" delta="0.9 pts" detail="trailing 30 days" icon={TrendingDown} tone="blue" />
        <KpiCard label="Avg. days to resolve" value="18.6d" delta="2.4d" detail="faster than target" icon={Clock3} tone="gold" />
        <KpiCard label="Appeal win rate" value="71.8%" delta="4.6 pts" detail="year to date" icon={ShieldCheck} tone="violet" onClick={() => onNavigate("/appeals")} />
      </div>
      <div className="dashboard-grid">
        <section className="chart-panel panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Trend / trailing 6 months</span>
              <h2>Denial rate is trending down</h2>
            </div>
            <div className="legend">
              <span><i className="legend-line blue-line" />Denial rate</span>
              <span><i className="legend-line target-line" />Target</span>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="denialFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B8CBF" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#5B8CBF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#DDE4EC" strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} />
                <YAxis domain={[4, 10]} axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip contentStyle={{ border: "1px solid #DDE4EC", borderRadius: 12, background: "#FBFAF8", fontSize: 12, color: COLORS.ink }} formatter={(value: number) => [`${value}%`, "Denial rate"]} />
                <Area type="monotone" dataKey="target" stroke="#C9A24B" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                <Area type="monotone" dataKey="rate" stroke="#5B8CBF" strokeWidth={2.5} fill="url(#denialFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-callout">
            <span className="callout-icon"><TrendingDown size={14} /></span>
            <span><strong>1.3 pts lower</strong> than April — prior authorization edits are making the biggest impact.</span>
            <button onClick={() => onNavigate("/analytics")}>View root causes <ArrowRight size={13} /></button>
          </div>
        </section>

        <section className="deadlines-panel panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Action queue</span>
              <h2>Deadlines this week</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("/appeals")}>View all <ArrowRight size={13} /></button>
          </div>
          <div className="deadline-list">
            {appeals.filter((appeal) => appeal.daysToDeadline > 0 && appeal.daysToDeadline <= 14).map((appeal) => (
              <button key={appeal.id} className="deadline-item" onClick={() => onNavigate("/appeals")}>
                <div className={`deadline-count ${appeal.daysToDeadline <= 6 ? "critical" : "warning"}`}>
                  <strong>{appeal.daysToDeadline}</strong>
                  <span>days</span>
                </div>
                <div className="deadline-copy">
                  <strong>{appeal.claimId}</strong>
                  <span>{appeal.payer} · Level {appeal.level} appeal</span>
                </div>
                <ChevronRight size={15} color={COLORS.muted} />
              </button>
            ))}
          </div>
          <div className="deadline-footer">
            <span className="mini-status"><span className="status-dot bg-[#C77B7B]" />2 need attention today</span>
            <span className="mini-status"><span className="status-dot bg-[#C9A24B]" />$19.4k at risk</span>
          </div>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel carc-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Distribution / open denials</span>
              <h2>By CARC group code</h2>
            </div>
            <button className="icon-button"><MoreHorizontal size={17} /></button>
          </div>
          <div className="carc-list">
            {carcData.map((item) => (
              <div className="carc-row" key={item.code}>
                <div className="carc-label">
                  <span className="carc-code" style={{ background: `${item.color}18`, color: item.color }}>{item.code}</span>
                  <span>{item.label}</span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="bar-track">
                  <span style={{ width: `${item.value}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel insight-panel">
          <div className="insight-kicker"><Sparkles size={15} /> Signal worth a look</div>
          <h2>CO-197 is up 18% with UnitedHealthcare</h2>
          <p>Prior authorization denials are now the largest avoidable category for Orthopedics. Review the payer rule before the next surgical batch.</p>
          <button className="text-button" onClick={() => onNavigate("/payers")}>Open payer rules <ArrowRight size={13} /></button>
          <div className="insight-footer">
            <span><AlertCircle size={14} /> 24 claims affected</span>
            <span>$42.8k exposure</span>
          </div>
        </section>
      </div>
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
    diagnosis: "M17.11 — Unilateral primary osteoarthritis, right knee",
    paStatus: "Missing",
    eligibilityStatus: "Active",
    networkStatus: "In-Network",
    documentationFlag: "true",
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
        diagnosis: "M17.11 — Primary osteoarthritis, right knee",
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
        diagnosis: "I10 — Essential primary hypertension",
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
        providerSpecialty: "Rehab Services",
        cpt: "97110",
        icd10: "M54.5",
        diagnosis: "M54.5 — Low back pain",
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
        providerSpecialty: "Hospital Medicine",
        cpt: "99223",
        icd10: "J18.9",
        diagnosis: "J18.9 — Pneumonia, unspecified organism",
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
      billedAmount: Number(form.chargeAmount) || (form.cpt === "27447" ? 18450 : 2400),
      status: result.denialRiskScore > 35 ? "denied" : "paid",
      carcCode: result.predictedCarcCode,
      carcDescription: result.predictedCarcCode === "CLEAN" ? "Clean claim - verified for submission" : `Predicted ${result.predictedCarcCode}`,
      rarcCode: "N290",
      groupCode: "CO",
      agingDays: 1,
      deadline: "Oct 15, 2026",
      deadlineDays: Number(form.daysToDeadline) || 42,
      assignedTo: "Maya Alvarez",
      avatar: "MA",
      department: form.providerSpecialty,
    };
    onSaveClaim(newClaim);
    toast.success("Saved to Live Denial Worklist", { description: `Claim ${newClaim.id} registered in queue.` });
  };

  const riskScoreVal = result ? result.denialRiskScore : 0;
  const isHighRisk = riskScoreVal >= 50;
  const isModerateRisk = riskScoreVal >= 35 && riskScoreVal < 50;
  const riskColor = isHighRisk ? COLORS.coral : isModerateRisk ? COLORS.gold : COLORS.green;

  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Pre-submission intelligence"
        title="Predict denial risk"
        description="Run real-time XGBoost + SHAP inference against 120,000 CMS claim denial patterns before submission."
        action={
          <div className="flex items-center gap-2">
            <span className="prediction-badge"><span className="pulse-dot" />FastAPI + SHAP Active</span>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-[#7C8A9C] uppercase tracking-wider">Quick Presets:</span>
        <button type="button" onClick={() => loadPreset("high_risk")} className="rounded-lg border border-[#DDE4EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1E2F4D] hover:bg-[#F3F6F9] hover:border-[#5B8CBF] transition">
          High-Risk Ortho (Missing PA)
        </button>
        <button type="button" onClick={() => loadPreset("clean")} className="rounded-lg border border-[#DDE4EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1E2F4D] hover:bg-[#F3F6F9] hover:border-[#5B8CBF] transition">
          Clean Cardiology (Approved PA)
        </button>
        <button type="button" onClick={() => loadPreset("filing_limit")} className="rounded-lg border border-[#DDE4EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1E2F4D] hover:bg-[#F3F6F9] hover:border-[#5B8CBF] transition">
          Filing Limit Warning (4d Left)
        </button>
        <button type="button" onClick={() => loadPreset("missing_doc")} className="rounded-lg border border-[#DDE4EC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1E2F4D] hover:bg-[#F3F6F9] hover:border-[#5B8CBF] transition">
          Missing Clinical Documentation
        </button>
      </div>

      <div className="predict-layout">
        <form className="predict-form panel" onSubmit={runPrediction}>
          <div className="form-intro">
            <div className="form-icon"><Target size={18} /></div>
            <div>
              <h2>Claim Parameters</h2>
              <p>Enter claim attributes at charge capture. Masked & HIPAA compliant.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>Payer</span>
              <select value={form.payer} onChange={(event) => setForm({ ...form, payer: event.target.value })}>
                {payerRules.map((payer) => (
                  <option key={payer.name} value={payer.name}>{payer.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Provider Specialty</span>
              <select value={form.providerSpecialty} onChange={(event) => setForm({ ...form, providerSpecialty: event.target.value })}>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="General Surgery">General Surgery</option>
                <option value="Neurology">Neurology</option>
                <option value="Rehab Services">Rehab Services</option>
                <option value="Pain Medicine">Pain Medicine</option>
                <option value="Behavioral Health">Behavioral Health</option>
              </select>
            </label>
            <label className="form-field">
              <span>Primary CPT / HCPCS</span>
              <input value={form.cpt} onChange={(event) => setForm({ ...form, cpt: event.target.value })} placeholder="e.g. 27447" />
            </label>
            <label className="form-field">
              <span>Diagnosis ICD-10</span>
              <input value={form.icd10} onChange={(event) => setForm({ ...form, icd10: event.target.value })} placeholder="e.g. M17.11" />
            </label>
            <label className="form-field">
              <span>Prior Authorization</span>
              <select value={form.paStatus} onChange={(event) => setForm({ ...form, paStatus: event.target.value })}>
                <option value="Missing">Missing (Absent)</option>
                <option value="Approved">Approved (Verified)</option>
                <option value="Pending">Pending Review</option>
                <option value="Denied">Denied Prior Auth</option>
                <option value="Not Required">Not Required by Payer</option>
              </select>
            </label>
            <label className="form-field">
              <span>Patient Eligibility</span>
              <select value={form.eligibilityStatus} onChange={(event) => setForm({ ...form, eligibilityStatus: event.target.value })}>
                <option value="Active">Active (Verified on DOS)</option>
                <option value="Inactive">Inactive Coverage</option>
                <option value="Terminated">Coverage Terminated</option>
              </select>
            </label>
            <label className="form-field">
              <span>Billed Charge Amount ($)</span>
              <input type="number" value={form.chargeAmount} onChange={(event) => setForm({ ...form, chargeAmount: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Days to Filing Deadline</span>
              <input type="number" value={form.daysToDeadline} onChange={(event) => setForm({ ...form, daysToDeadline: event.target.value })} />
            </label>
            <label className="form-field">
              <span>Clinical Chart Notes Attached?</span>
              <select value={form.documentationFlag} onChange={(event) => setForm({ ...form, documentationFlag: event.target.value })}>
                <option value="true">Yes (Complete Chart Attached)</option>
                <option value="false">No (Documentation Missing)</option>
              </select>
            </label>
            <label className="form-field">
              <span>Network Status</span>
              <select value={form.networkStatus} onChange={(event) => setForm({ ...form, networkStatus: event.target.value })}>
                <option value="In-Network">In-Network Contracted</option>
                <option value="Out-of-Network">Out-of-Network Facility</option>
              </select>
            </label>
          </div>
          <div className="form-note">
            <LockKeyhole size={14} />
            <span>FastAPI ML engine runs exact TreeExplainer SHAP attribution on 120,000 real claims data.</span>
          </div>
          <Button type="submit" icon={Sparkles} className="predict-submit" disabled={loading}>
            {loading ? "Evaluating XGBoost Model..." : "Run ML Denial Prediction"}
          </Button>
        </form>

        <section className={`prediction-result panel ${result ? "revealed" : ""}`}>
          {result ? (
            <>
              <div className="result-header">
                <div>
                  <span className="eyebrow">Prediction result / {form.payer}</span>
                  <h2>{isHighRisk ? "High denial risk detected" : isModerateRisk ? "Moderate denial risk" : "Clean claim confidence"}</h2>
                </div>
                <span className="result-stamp">Inference latency: &lt; 80ms</span>
              </div>
              <div className="risk-readout">
                <div className="risk-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="49" fill="none" stroke="#E9E4DF" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="49"
                      fill="none"
                      stroke={riskColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="308"
                      strokeDashoffset={308 - (308 * Math.min(100, Math.max(0, riskScoreVal))) / 100}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div><strong>{riskScoreVal.toFixed(1)}%</strong><span>Risk</span></div>
                </div>
                <div className="risk-copy">
                  <span className="risk-label">{isHighRisk ? "Predicted CARC Reason" : "Claim Status"}</span>
                  <strong style={{ color: riskColor }}>{result.predictedCarcCode}</strong>
                  <p className="text-[13px] text-[#48586B]">{result.predictedCarcCode === "CLEAN" ? "Clean claim validation passed" : `Trigger Code ${result.predictedCarcCode}`}</p>
                  <div className="suggested-fix">
                    <CheckCircle2 size={15} color={COLORS.green} />
                    <span><strong>Action:</strong> {result.suggestedCorrectiveAction}</span>
                  </div>
                </div>
              </div>
              <div className="factor-heading">
                <span>SHAP Root Cause Factors</span>
                <span>Impact</span>
              </div>
              <div className="factor-list">
                {result.topContributingFactors.map((factor) => {
                  const isPositiveRisk = factor.direction === "positive" || factor.direction === "increases_risk";
                  return (
                    <div className="factor-row" key={factor.label}>
                      <div>
                        {isPositiveRisk ? (
                          <ArrowUpRight size={14} color={COLORS.coral} />
                        ) : (
                          <ArrowDownRight size={14} color={COLORS.green} />
                        )}
                        <span>{factor.label}</span>
                      </div>
                      <div className="factor-bar">
                        <span
                          style={{
                            width: `${Math.min(100, Math.abs(factor.impact) * 15)}%`,
                            background: !isPositiveRisk ? COLORS.green : Math.abs(factor.impact) > 2 ? COLORS.coral : COLORS.gold,
                          }}
                        />
                      </div>
                      <strong className={isPositiveRisk ? "text-coral" : "text-green"}>
                        {isPositiveRisk ? `+${factor.impact.toFixed(2)}` : factor.impact.toFixed(2)}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="result-actions">
                <Button variant="secondary" icon={FileText} onClick={saveToQueue}>Save to Worklist</Button>
                <Button icon={ArrowRight} onClick={() => toast.success("Claim validated", { description: "Claim packet ready for EDI transmission." })}>
                  Validate Next Claim
                </Button>
              </div>
            </>
          ) : (
            <div className="prediction-empty">
              <div className="empty-icon prediction"><Sparkles size={22} /></div>
              <span className="eyebrow">Awaiting claim parameters</span>
              <h2>Your real-time risk readout will appear here</h2>
              <p>Select a quick preset above or fill in claim fields to evaluate denial probability and SHAP root causes.</p>
              <div className="empty-rule"><span /><span /><span /></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Claims({ denials, onOpenClaim }: { denials: Denial[]; onOpenClaim: (id: string) => void }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const claims = denials.filter((claim) => (status === "all" || claim.status === status) && (!query || `${claim.id} ${claim.payer} ${claim.patientRef}`.toLowerCase().includes(query.toLowerCase())));

  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="All submissions / 2026"
        title="Claims log"
        description="The full claim history across statuses, payers, and departments."
        action={
          <Button
            icon={Download}
            variant="secondary"
            onClick={() => {
              toast.success("Claims export ready", { description: `Exported ${claims.length} claims records.` });
            }}
          >
            Export log
          </Button>
        }
      />
      <div className="claims-summary">
        <div><span>Total claims</span><strong>1,284</strong></div>
        <div><span>Paid</span><strong className="text-green">1,073</strong></div>
        <div><span>Pending</span><strong className="text-gold">103</strong></div>
        <div><span>Denied</span><strong className="text-coral">108</strong></div>
      </div>
      <section className="panel table-panel claims-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search claim ID, payer, patient ref..." />
          </div>
          <select className="compact-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="denied">Denied</option>
            <option value="appealed">Appealed</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table claims-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Patient ref</th>
                <th>Payer</th>
                <th>Submitted</th>
                <th>Amount</th>
                <th>Denial code</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr className="table-row" key={claim.id} onClick={() => onOpenClaim(claim.id)}>
                  <td><strong>{claim.id}</strong></td>
                  <td className="subtle">{claim.patientRef}</td>
                  <td>{claim.payer}</td>
                  <td className="tabular subtle">Aug {String(29 - (claim.agingDays % 20)).padStart(2, "0")}, 2026</td>
                  <td className="tabular amount">{money(claim.billedAmount)}</td>
                  <td><span className="code-pill">{claim.carcCode}</span><small className="subtle code-desc">{claim.carcDescription}</small></td>
                  <td><StatusBadge status={claim.status} /></td>
                  <td><ChevronRight size={15} color={COLORS.muted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ClaimDetail({
  claimId,
  denials,
  onBack,
  onUpdateStatus,
}: {
  claimId: string;
  denials: Denial[];
  onBack: () => void;
  onUpdateStatus: (id: string, newStatus: ClaimStatus) => void;
}) {
  const baseClaim = denials.find((item) => item.id === claimId) ?? denials[0];
  const [claim, setClaim] = useState<Denial>(baseClaim);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; date: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([
    "Reviewing documentation against the payer’s medical necessity policy. Requesting the operative note from Cardiology before Level 1 submission.",
  ]);
  const [noteInput, setNoteInput] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);

  useEffect(() => {
    setClaim(baseClaim);
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
          <Button variant="secondary" icon={MoreHorizontal} onClick={() => toast.info("Audit log and history exported")}>More</Button>
          <Button
            variant="secondary"
            icon={FileCheck2}
            onClick={() => {
              onUpdateStatus(claim.id, "appealed");
              toast.success("Appeal started", { description: "Claim moved to appealed status and Level 1 draft opened." });
            }}
          >
            Start appeal
          </Button>
          <Button
            icon={CheckCircle2}
            onClick={() => {
              onUpdateStatus(claim.id, "paid");
              toast.success("Claim marked paid", { description: "Revenue credited to department ledger." });
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
              <button className="icon-button" onClick={() => toast.info("CARC reference", { description: "Code detail copied to clipboard." })}>
                <HelpCircle size={16} />
              </button>
            </div>
          </section>

          <section className="panel timeline-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Lifecycle</span><h2>Claim timeline</h2></div>
              <span className="subtle">Last updated 2h ago</span>
            </div>
            <div className="timeline">
              <div className="timeline-item complete"><div className="timeline-node"><Check size={13} /></div><div><strong>Submitted</strong><span>Aug 22, 2026 · 09:14 AM</span></div></div>
              <div className="timeline-item complete"><div className="timeline-node"><Check size={13} /></div><div><strong>Processed</strong><span>Aug 25, 2026 · 03:42 PM</span></div></div>
              <div className="timeline-item current"><div className="timeline-node"><AlertCircle size={13} /></div><div><strong>Denied · {claim.carcCode}</strong><span>Aug 26, 2026 · {claim.carcDescription}</span></div></div>
              <div className={`timeline-item ${claim.status === "appealed" ? "complete" : ""}`}>
                <div className="timeline-node">{claim.status === "appealed" ? <Check size={13} /> : null}</div>
                <div><strong>Appeal</strong><span>{claim.status === "appealed" ? "Level 1 Appeal in review" : `Not started · deadline ${claim.deadline}`}</span></div>
              </div>
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
            <div className="panel-header">
              <span className="eyebrow">Ownership</span>
              <button className="icon-button"><MoreHorizontal size={16} /></button>
            </div>
            <div className="owner-large">
              <Avatar initials={claim.avatar} tone="blue" size="lg" />
              <div>
                <strong>{claim.assignedTo}</strong>
                <span>Denial analyst</span>
              </div>
            </div>
            <div className="owner-line"><span>Department</span><strong>{claim.department}</strong></div>
            <div className="owner-line"><span>Priority</span><strong className="text-coral">High · 3d to deadline</strong></div>
            <button className="assign-button" onClick={() => toast.success("Claim assigned to Priya Shah")}>
              Reassign claim <ChevronDown size={14} />
            </button>
          </section>

          <section className="panel details-panel">
            <div className="panel-header"><span className="eyebrow">Claim details</span></div>
            <div className="detail-list">
              <div><span>CPT / HCPCS</span><strong>{claim.cptCodes.join(" · ")}</strong></div>
              <div><span>Billed amount</span><strong>{money(claim.billedAmount)}</strong></div>
              <div><span>Allowed amount</span><strong>$0.00</strong></div>
              <div><span>Place of service</span><strong>22 · Outpatient hospital</strong></div>
              <div><span>Rendering provider</span><strong>Dr. Elena Rodriguez</strong></div>
            </div>
          </section>

          <section className="panel next-action">
            <div className="next-icon"><CalendarClock size={17} /></div>
            <div>
              <span className="eyebrow">Next best action</span>
              <strong>{uploadedFiles.length > 0 ? "Clinical evidence attached" : "Secure medical necessity documentation"}</strong>
              <p>{uploadedFiles.length > 0 ? `Attached ${uploadedFiles[0].name}. Claim is ready for expedited submission.` : `Upload the operative note before the appeal deadline to protect ${money(claim.billedAmount)}.`}</p>
              
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

function Appeals({ appeals, onAddAppeal }: { appeals: Appeal[]; onAddAppeal: () => void }) {
  const columns: { key: Appeal["status"]; label: string; note: string }[] = [
    { key: "drafting", label: "Drafting", note: "Needs analyst action" },
    { key: "submitted", label: "Submitted", note: "With payer" },
    { key: "awaiting_response", label: "Awaiting response", note: "Watch the clock" },
    { key: "won", label: "Resolved", note: "Closed this cycle" },
  ];

  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Appeal operations / 12 in flight"
        title="Appeals pipeline"
        description="Keep every submission moving before its payer SLA expires."
        action={<Button icon={Plus} onClick={onAddAppeal}>New appeal</Button>}
      />
      <div className="appeal-summary">
        <div><strong>{appeals.length}</strong><span>in flight</span></div>
        <div><strong className="text-coral">3</strong><span>due in 7 days</span></div>
        <div><strong className="text-violet">71.8%</strong><span>win rate YTD</span></div>
        <div><strong>$84.2k</strong><span>recoverable value</span></div>
      </div>
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
                  <button
                    className="appeal-card"
                    key={appeal.id}
                    onClick={() => toast.info(`${appeal.id} selected`, { description: "Open the linked claim to review the full record." })}
                  >
                    <div className="appeal-card-top">
                      <span className="appeal-id">{appeal.id}</span>
                      <span className={`level-pill level-${appeal.level}`}>L{appeal.level}</span>
                    </div>
                    <strong>{appeal.claimId}</strong>
                    <span className="appeal-payer">{appeal.payer}</span>
                    <div className="appeal-card-meta">
                      <span className={appeal.daysToDeadline <= 6 ? "text-coral" : appeal.daysToDeadline <= 14 ? "text-gold" : "text-green"}>
                        <Clock3 size={13} />
                        {appeal.daysToDeadline < 0 ? `${Math.abs(appeal.daysToDeadline)}d past due` : `${appeal.daysToDeadline}d to deadline`}
                      </span>
                      <span><Paperclip size={13} />{appeal.attachments}</span>
                    </div>
                    <div className="appeal-card-footer">
                      <span className="mini-status">
                        <span className={`status-dot ${appeal.status === "won" ? "bg-[#5FAE93]" : appeal.daysToDeadline <= 6 ? "bg-[#C77B7B]" : "bg-[#C9A24B]"}`} />
                        {appeal.notes}
                      </span>
                      <ChevronRight size={14} color={COLORS.muted} />
                    </div>
                  </button>
                ))}
              </div>
              {items.length === 0 && (
                <div className="column-empty"><Inbox size={18} /><span>No appeals here</span></div>
              )}
            </section>
          );
        })}
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
        eyebrow="Reference library / 5 payers"
        title="Payer rules"
        description="Timely filing, authorization, and appeal guidance for the payers your team works most."
        action={
          <Button variant="secondary" icon={Plus} onClick={() => toast.info("Payer rule request", { description: "Rule submission forwarded to Lead RCM specialist." })}>
            Request payer
          </Button>
        }
      />
      <div className="library-callout">
        <div className="callout-icon blue-bg"><Library size={17} /></div>
        <div>
          <strong>Rules last verified Aug 28, 2026</strong>
          <p>Deadlines are payer-specific. Always confirm the member plan and state contract before submitting an appeal.</p>
        </div>
        <button className="text-button" onClick={() => toast.info("Verification log opened", { description: "All 5 major payers audited and verified for Q3 2026." })}>
          View verification log <ArrowRight size={13} />
        </button>
      </div>
      <section className="panel table-panel payer-panel">
        <div className="table-toolbar">
          <div><span className="eyebrow">Coverage reference</span><h2>Filing & appeal requirements</h2></div>
          <div className="table-search compact">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payers..." />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table payer-table">
            <thead>
              <tr>
                <th>Payer</th>
                <th>Timely filing window</th>
                <th>Prior authorization</th>
                <th>Appeal deadline</th>
                <th>Submission method</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredPayers.map((payer) => (
                <tr className="table-row" key={payer.name}>
                  <td>
                    <div className="payer-name">
                      <span className="payer-mark large" style={{ background: `${payer.color}18`, color: payer.color }}>{payer.initials}</span>
                      <strong>{payer.name}</strong>
                    </div>
                  </td>
                  <td><span className="tabular">{payer.filing}</span></td>
                  <td><span className="rule-summary">{payer.auth}</span></td>
                  <td><span className="tabular text-gold">{payer.appeal}</span></td>
                  <td><span className="method-pill"><Send size={13} />{payer.method}</span></td>
                  <td><button className="icon-button"><ChevronRight size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="code-reference panel">
        <div>
          <span className="eyebrow">CARC quick reference</span>
          <h2>Common denial codes</h2>
          <p>Every code in the worklist links back to a plain-language definition.</p>
        </div>
        <div className="code-reference-list">
          <span><strong>CO-50</strong>Medical necessity</span>
          <span><strong>CO-197</strong>Prior authorization</span>
          <span><strong>CO-29</strong>Timely filing</span>
          <span><strong>CO-16</strong>Missing information</span>
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <div className="page-content">
      <SectionHeading
        eyebrow="Root-cause intelligence / YTD"
        title="Denial analytics"
        description="Find the patterns behind lost revenue and focus your next intervention."
        action={<Button variant="secondary" icon={Download} onClick={() => toast.success("Analytics report exported")}>Export report</Button>}
      />
      <div className="analytics-kpis">
        <div className="analytics-stat">
          <span>Preventable denial rate</span>
          <strong>3.1%</strong>
          <small className="text-green"><TrendingDown size={13} />0.8 pts vs. last quarter</small>
        </div>
        <div className="analytics-stat">
          <span>Top root cause</span>
          <strong>CO-197</strong>
          <small>Prior authorization</small>
        </div>
        <div className="analytics-stat">
          <span>Revenue recovered</span>
          <strong>$486.2k</strong>
          <small className="text-green"><TrendingUp size={13} />14.2% vs. last year</small>
        </div>
        <div className="analytics-stat">
          <span>Highest risk service line</span>
          <strong>Orthopedics</strong>
          <small>8.7% denial rate</small>
        </div>
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-chart">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Payer comparison</span>
              <h2>Denial rate vs. recovery</h2>
            </div>
            <div className="legend">
              <span><i className="legend-dot blue-dot" />Denial rate</span>
              <span><i className="legend-dot green-dot" />Recovered</span>
            </div>
          </div>
          <div className="analytics-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#DDE4EC" strokeDasharray="3 4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip contentStyle={{ border: "1px solid #DDE4EC", borderRadius: 12, background: "#FBFAF8", fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="denial" fill="#5B8CBF" radius={[4, 4, 0, 0]} barSize={18} name="Denial rate" />
                <Bar yAxisId="right" dataKey="recovered" fill="#5FAE93" radius={[4, 4, 0, 0]} barSize={18} name="Recovered" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel root-cause-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Avoidable revenue</span>
              <h2>Top root causes</h2>
            </div>
            <span className="subtle">$72.4k open</span>
          </div>
          <div className="root-cause-list">
            {[
              { code: "CO-197", label: "Prior authorization", value: "$42.8k", pct: 59, color: COLORS.coral },
              { code: "CO-50", label: "Medical necessity", value: "$17.6k", pct: 24, color: COLORS.gold },
              { code: "CO-16", label: "Missing information", value: "$8.1k", pct: 11, color: COLORS.blue },
              { code: "CO-29", label: "Timely filing", value: "$3.9k", pct: 6, color: COLORS.violet },
            ].map((item) => (
              <div className="root-cause" key={item.code}>
                <div>
                  <span className="code-pill">{item.code}</span>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="bar-track">
                  <span style={{ width: `${item.pct}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel service-line-panel">
        <div className="panel-header">
          <div><span className="eyebrow">Operational focus</span><h2>Denial rate by service line</h2></div>
          <button className="text-button" onClick={() => toast.info("All 14 clinical service lines loaded")}>View all departments <ArrowRight size={13} /></button>
        </div>
        <div className="service-grid">
          {[
            { name: "Orthopedics", rate: "8.7%", trend: "+1.2 pts", tone: "coral" },
            { name: "Cardiology", rate: "7.4%", trend: "−0.6 pts", tone: "gold" },
            { name: "Rehab Services", rate: "6.9%", trend: "−1.8 pts", tone: "blue" },
            { name: "Primary Care", rate: "4.2%", trend: "−0.4 pts", tone: "green" },
          ].map((item) => (
            <div className="service-card" key={item.name}>
              <div><span className={`service-signal ${item.tone}`} /><strong>{item.name}</strong></div>
              <b>{item.rate}</b>
              <small className={item.tone === "coral" ? "text-coral" : "text-green"}>{item.trend} MoM</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Settings() {
  const [activeTab, setActiveTab] = useState<"team" | "notifications" | "workflow" | "security">("team");
  const [notifications, setNotifications] = useState({
    deadlines: true,
    highRisk: true,
    weeklyBrief: false,
  });
  const [workflow, setWorkflow] = useState({
    autoAssign: true,
    priorityThreshold: "70",
    defaultAgingLimit: "30",
  });

  return (
    <div className="page-content settings-page">
      <SectionHeading
        eyebrow="Workspace administration"
        title="Settings"
        description="Manage your team, workflow defaults, and notification preferences."
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <button
            className={`settings-nav-item ${activeTab === "team" ? "active" : ""}`}
            onClick={() => setActiveTab("team")}
          >
            <UsersRound size={16} />Team & roles
          </button>
          <button
            className={`settings-nav-item ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            <Bell size={16} />Notifications
          </button>
          <button
            className={`settings-nav-item ${activeTab === "workflow" ? "active" : ""}`}
            onClick={() => setActiveTab("workflow")}
          >
            <SlidersHorizontal size={16} />Workflow defaults
          </button>
          <button
            className={`settings-nav-item ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <ShieldCheck size={16} />Security & access
          </button>
        </aside>

        <div className="settings-content">
          {activeTab === "team" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Northstar Health System</span><h2>Team & roles</h2></div>
                <Button
                  icon={Plus}
                  onClick={async () => {
                    const res = await generateWorkspaceInvite("Analyst");
                    toast.success(`Invite code generated: ${res.invite_code}`, {
                      description: "Share this 16-character code with teammates to auto-join this workspace with Analyst permissions.",
                      duration: 8000,
                    });
                  }}
                >
                  Invite member
                </Button>
              </div>
              <p className="panel-description">Roles control which claim actions and financial records each teammate can access.</p>
              <div className="team-list">
                {[
                  { name: "Maya Alvarez", email: "malvarez@northstar.health", role: "Denial analyst", badge: "MA", tone: "blue" },
                  { name: "Jordan Lee", email: "jlee@northstar.health", role: "Biller", badge: "JL", tone: "violet" },
                  { name: "Priya Shah", email: "pshah@northstar.health", role: "Denial analyst", badge: "PS", tone: "gold" },
                  { name: "Amelia Chen", email: "achen@northstar.health", role: "Admin", badge: "AC", tone: "green" },
                ].map((member) => (
                  <div className="team-row" key={member.email}>
                    <Avatar initials={member.badge} tone={member.tone as "blue" | "violet" | "gold" | "green"} size="md" />
                    <div className="team-member"><strong>{member.name}</strong><span>{member.email}</span></div>
                    <span className="role-pill">{member.role}</span>
                    <button className="icon-button" onClick={() => toast.info(`Permissions for ${member.name}`)}><MoreHorizontal size={16} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Personal preferences</span><h2>Notifications</h2></div>
              </div>
              <div className="preference-row cursor-pointer" onClick={() => setNotifications({ ...notifications, deadlines: !notifications.deadlines })}>
                <div><strong>Appeal deadlines</strong><span>Notify me 14, 7, and 2 days before a deadline.</span></div>
                <div className={`toggle ${notifications.deadlines ? "on" : ""}`}><span /></div>
              </div>
              <div className="preference-row cursor-pointer" onClick={() => setNotifications({ ...notifications, highRisk: !notifications.highRisk })}>
                <div><strong>High-risk predictions</strong><span>Send a digest when a predicted risk exceeds 70.</span></div>
                <div className={`toggle ${notifications.highRisk ? "on" : ""}`}><span /></div>
              </div>
              <div className="preference-row cursor-pointer" onClick={() => setNotifications({ ...notifications, weeklyBrief: !notifications.weeklyBrief })}>
                <div><strong>Weekly revenue integrity brief</strong><span>Monday summary of preventable denials and recovery.</span></div>
                <div className={`toggle ${notifications.weeklyBrief ? "on" : ""}`}><span /></div>
              </div>
            </section>
          )}

          {activeTab === "workflow" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Triage rules</span><h2>Workflow defaults</h2></div>
              </div>
              <div className="preference-row cursor-pointer" onClick={() => setWorkflow({ ...workflow, autoAssign: !workflow.autoAssign })}>
                <div><strong>Auto-assign high urgency claims</strong><span>Automatically route claims with &le; 7 days deadline to senior analysts.</span></div>
                <div className={`toggle ${workflow.autoAssign ? "on" : ""}`}><span /></div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span>High risk scoring threshold</span>
                  <input
                    type="number"
                    value={workflow.priorityThreshold}
                    onChange={(e) => setWorkflow({ ...workflow, priorityThreshold: e.target.value })}
                    className="w-20 rounded-lg border border-[#D9E0E8] bg-white px-2 py-1 text-center font-mono text-[12px]"
                  />
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span>Aging limit warning threshold (days)</span>
                  <input
                    type="number"
                    value={workflow.defaultAgingLimit}
                    onChange={(e) => setWorkflow({ ...workflow, defaultAgingLimit: e.target.value })}
                    className="w-20 rounded-lg border border-[#D9E0E8] bg-white px-2 py-1 text-center font-mono text-[12px]"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "security" && (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Compliance</span><h2>Security & Access</h2></div>
              </div>
              <div className="p-4 space-y-4 text-[13px] text-[#48586B]">
                <div className="flex items-center justify-between border-b border-[#DDE4EC] pb-3">
                  <div><strong>Two-Factor Authentication (2FA)</strong><p className="text-[11px] text-[#7C8A9C]">Enforced for all workspace administrators</p></div>
                  <span className="rounded-full bg-[#5FAE93]/15 px-2.5 py-1 text-[11px] font-semibold text-[#245C47]">Active</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#DDE4EC] pb-3">
                  <div><strong>HIPAA De-identification</strong><p className="text-[11px] text-[#7C8A9C]">Masking patient identifiers before model scoring</p></div>
                  <span className="rounded-full bg-[#5FAE93]/15 px-2.5 py-1 text-[11px] font-semibold text-[#245C47]">Enforced</span>
                </div>
                <div className="flex items-center justify-between">
                  <div><strong>Audit Logging</strong><p className="text-[11px] text-[#7C8A9C]">365-day immutable compliance retention</p></div>
                  <span className="rounded-full bg-[#5FAE93]/15 px-2.5 py-1 text-[11px] font-semibold text-[#245C47]">Compliant</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
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
          <div><strong>Systems operational</strong><span>Last sync 2 min ago</span></div>
          <CheckCircle2 size={15} color={COLORS.green} />
        </div>
        <button className="help-link" onClick={() => toast.info("Help center", { description: "DenialGuard playbook & ICD/CPT guidance is available." })}>
          <HelpCircle size={15} />Help center
        </button>

        <div className="flex items-center justify-between border-t border-[#DDE4EC] pt-3 mt-1">
          <div className="user-profile border-0 p-0 flex items-center gap-2">
            <Avatar initials={getCurrentUser().name.split(" ").map(n => n[0]).join("") || "MA"} tone="blue" />
            <div><strong>{getCurrentUser().name}</strong><span>{getCurrentUser().role}</span></div>
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

function Topbar({
  onNavigate,
  onLogout,
}: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const currentUser = getCurrentUser();
  const initials = currentUser.name.split(" ").map(n => n[0]).join("") || "MA";

  return (
    <header className="topbar glass">
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
        <button
          className="topbar-icon"
          onClick={() => toast.info("Notifications", { description: "3 claims have appeal deadlines due within 7 days." })}
        >
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
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

function AppShell({
  location,
  onNavigate,
  onLogout,
  children,
}: {
  location: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell ambient-shell">
      <Sidebar location={location} onNavigate={onNavigate} onLogout={onLogout} />
      <div className="app-main">
        <Topbar onNavigate={onNavigate} onLogout={onLogout} />
        <main className="main-surface">{children}</main>
      </div>
    </div>
  );
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const [denials, setDenials] = useState<Denial[]>(INITIAL_DENIALS);
  const [appeals, setAppeals] = useState<Appeal[]>(INITIAL_APPEALS);

  const path = location.split("?")[0];

  const handleLogout = () => {
    toast.success("Signed out", { description: "You have been logged out of Northstar Health workspace." });
    setLocation("/sign-in");
  };

  const handleAddDenial = () => {
    const newClaim: Denial = {
      id: `CLM-2026-0${Math.floor(1000 + Math.random() * 9000)}`,
      patientRef: `PT-•••-${Math.floor(1000 + Math.random() * 9000)}`,
      payer: "UnitedHealthcare",
      cptCodes: ["99213"],
      billedAmount: 320,
      status: "denied",
      carcCode: "CO-16",
      carcDescription: "Claim lacked required modifier or coding detail",
      rarcCode: "N290",
      groupCode: "CO",
      agingDays: 4,
      deadline: "Oct 12, 2026",
      deadlineDays: 39,
      assignedTo: "Maya Alvarez",
      avatar: "MA",
      department: "Internal Medicine",
    };
    setDenials([newClaim, ...denials]);
    toast.success("New denial claim added", { description: `Claim ${newClaim.id} registered in queue.` });
  };

  const handleAddAppeal = () => {
    const newAppeal: Appeal = {
      id: `APL-${Math.floor(1050 + Math.random() * 100)}`,
      claimId: `CLM-2026-08397`,
      payer: "UnitedHealthcare",
      level: 1,
      status: "drafting",
      deadline: "Sep 29, 2026",
      daysToDeadline: 26,
      attachments: 1,
      notes: "Appeal letter drafted with prior authorization proof.",
    };
    setAppeals([newAppeal, ...appeals]);
    toast.success("New appeal drafted", { description: `Appeal ${newAppeal.id} created in pipeline.` });
  };

  const handleUpdateStatus = (id: string, newStatus: ClaimStatus) => {
    setDenials(denials.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const renderPage = () => {
    if (path === "/dashboard") return <Dashboard onNavigate={setLocation} appeals={appeals} />;
    if (path === "/predict") return <Predict onSaveClaim={(c) => setDenials([c, ...denials])} />;
    if (path === "/claims") return <Claims denials={denials} onOpenClaim={(id) => setLocation(`/claims/${id}`)} />;
    if (path.startsWith("/claims/")) {
      return (
        <ClaimDetail
          claimId={path.split("/")[2] ?? denials[0].id}
          denials={denials}
          onBack={() => setLocation("/worklist")}
          onUpdateStatus={handleUpdateStatus}
        />
      );
    }
    if (path === "/appeals") return <Appeals appeals={appeals} onAddAppeal={handleAddAppeal} />;
    if (path === "/payers") return <Payers />;
    if (path === "/analytics") return <Analytics />;
    if (path === "/settings") return <Settings />;
    return <Worklist denials={denials} onOpenClaim={(id) => setLocation(`/claims/${id}`)} onAddDenial={handleAddDenial} />;
  };

  return (
    <AppShell location={path} onNavigate={setLocation} onLogout={handleLogout}>
      {renderPage()}
    </AppShell>
  );
}
