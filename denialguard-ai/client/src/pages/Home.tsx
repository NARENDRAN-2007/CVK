import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
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
  Filter,
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
  Cell,
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

const denials: Denial[] = [
  { id: "CLM-2026-08421", patientRef: "PT-•••-4918", payer: "Aetna", cptCodes: ["99214", "93000"], billedAmount: 482, status: "denied", carcCode: "CO-50", carcDescription: "Medical necessity", rarcCode: "N130", groupCode: "CO", agingDays: 42, deadline: "Sep 06, 2026", deadlineDays: 3, assignedTo: "Maya Alvarez", avatar: "MA", department: "Cardiology" },
  { id: "CLM-2026-08397", patientRef: "PT-•••-7724", payer: "UnitedHealthcare", cptCodes: ["27447"], billedAmount: 18450, status: "denied", carcCode: "CO-197", carcDescription: "Prior authorization required", rarcCode: "N290", groupCode: "CO", agingDays: 38, deadline: "Sep 09, 2026", deadlineDays: 6, assignedTo: "Jordan Lee", avatar: "JL", department: "Orthopedics" },
  { id: "CLM-2026-08374", patientRef: "PT-•••-1153", payer: "Medicare Part B", cptCodes: ["64483", "77003"], billedAmount: 2180, status: "appealed", carcCode: "CO-16", carcDescription: "Missing required information", rarcCode: "N290", groupCode: "CO", agingDays: 31, deadline: "Sep 13, 2026", deadlineDays: 10, assignedTo: "Maya Alvarez", avatar: "MA", department: "Pain Medicine" },
  { id: "CLM-2026-08361", patientRef: "PT-•••-3881", payer: "Cigna", cptCodes: ["97110", "97140"], billedAmount: 960, status: "denied", carcCode: "CO-29", carcDescription: "Timely filing limit exceeded", rarcCode: "N211", groupCode: "CO", agingDays: 29, deadline: "Sep 18, 2026", deadlineDays: 15, assignedTo: "Priya Shah", avatar: "PS", department: "Rehab Services" },
  { id: "CLM-2026-08345", patientRef: "PT-•••-9026", payer: "Humana", cptCodes: ["99223"], billedAmount: 1240, status: "denied", carcCode: "CO-11", carcDescription: "Diagnosis inconsistent with procedure", rarcCode: "N386", groupCode: "CO", agingDays: 24, deadline: "Sep 20, 2026", deadlineDays: 17, assignedTo: "Jordan Lee", avatar: "JL", department: "Hospital Medicine" },
  { id: "CLM-2026-08298", patientRef: "PT-•••-0457", payer: "Aetna", cptCodes: ["29881"], billedAmount: 5320, status: "appealed", carcCode: "CO-204", carcDescription: "Service not covered under plan", rarcCode: "N115", groupCode: "CO", agingDays: 19, deadline: "Sep 25, 2026", deadlineDays: 22, assignedTo: "Maya Alvarez", avatar: "MA", department: "Orthopedics" },
  { id: "CLM-2026-08266", patientRef: "PT-•••-6189", payer: "Medicare Part B", cptCodes: ["G0463"], billedAmount: 385, status: "denied", carcCode: "PR-1", carcDescription: "Deductible amount", rarcCode: "N/A", groupCode: "PR", agingDays: 14, deadline: "Oct 02, 2026", deadlineDays: 29, assignedTo: "Priya Shah", avatar: "PS", department: "Primary Care" },
  { id: "CLM-2026-08211", patientRef: "PT-•••-2276", payer: "Cigna", cptCodes: ["90837"], billedAmount: 240, status: "denied", carcCode: "CO-18", carcDescription: "Duplicate claim/service", rarcCode: "N522", groupCode: "CO", agingDays: 8, deadline: "Oct 05, 2026", deadlineDays: 32, assignedTo: "Jordan Lee", avatar: "JL", department: "Behavioral Health" },
];

const appeals: Appeal[] = [
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
  { month: "Apr", rate: 8.4, target: 7.5 }, { month: "May", rate: 7.9, target: 7.5 }, { month: "Jun", rate: 7.6, target: 7.5 }, { month: "Jul", rate: 7.1, target: 7.5 }, { month: "Aug", rate: 6.8, target: 7.5 }, { month: "Sep", rate: 6.4, target: 7.5 },
];
const carcData = [
  { code: "CO", label: "Contractual obligation", value: 68, color: COLORS.blue },
  { code: "PR", label: "Patient responsibility", value: 16, color: COLORS.gold },
  { code: "OA", label: "Other adjustment", value: 9, color: COLORS.violet },
  { code: "PI", label: "Payer initiated", value: 7, color: COLORS.coral },
];
const analyticsData = [
  { name: "Aetna", denial: 8.2, recovered: 72 }, { name: "UHC", denial: 7.4, recovered: 68 }, { name: "Cigna", denial: 6.1, recovered: 75 }, { name: "Humana", denial: 5.8, recovered: 66 }, { name: "Medicare", denial: 4.9, recovered: 81 },
];

const navGroups: { label: string; items: { label: string; path: string; icon: LucideIcon; shortcut?: string }[] }[] = [
  { label: "Workspace", items: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Denial worklist", path: "/worklist", icon: ClipboardCheck, shortcut: "⌘ 1" },
    { label: "Predict risk", path: "/predict", icon: Target, shortcut: "⌘ 2" },
    { label: "Claims log", path: "/claims", icon: FileText },
    { label: "Appeals", path: "/appeals", icon: FileCheck2 },
  ] },
  { label: "Reference", items: [
    { label: "Payer rules", path: "/payers", icon: Library },
    { label: "Analytics", path: "/analytics", icon: TrendingUp },
    { label: "Settings", path: "/settings", icon: Settings2 },
  ] },
];

const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const shortMoney = (value: number) => value >= 1000 ? `$${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k` : money(value);

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
  return <span className={`status-badge ${item.className}`}><span className={`status-dot ${item.dot}`} />{item.label}</span>;
}

function Deadline({ days, label }: { days: number; label: string }) {
  const tone = days <= 6 ? "deadline-critical" : days <= 14 ? "deadline-warning" : "deadline-safe";
  return <div className={`deadline ${tone}`}><span>{days < 0 ? "Past due" : `${days}d left`}</span><small>{label}</small></div>;
}

function Avatar({ initials, tone = "blue", size = "sm" }: { initials: string; tone?: "blue" | "violet" | "gold" | "green"; size?: "sm" | "md" | "lg" }) {
  return <div className={`avatar avatar-${tone} avatar-${size}`}>{initials}</div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Button({ children, variant = "primary", icon: Icon, className = "", onClick, type = "button" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: LucideIcon; className?: string; onClick?: () => void; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className={`ui-button button-${variant} ${variant === "primary" ? "liquid-sheen" : ""} ${className}`}>{Icon && <Icon size={16} strokeWidth={1.8} />}{children}</button>;
}

function KpiCard({ label, value, delta, detail, icon: Icon, tone, onClick }: { label: string; value: string; delta: string; detail: string; icon: LucideIcon; tone: "blue" | "coral" | "gold" | "violet"; onClick?: () => void }) {
  const toneMap = { blue: "kpi-blue", coral: "kpi-coral", gold: "kpi-gold", violet: "kpi-violet" };
  return <button onClick={onClick} className={`kpi-card liquid-sheen ${toneMap[tone]}`}><div className="kpi-top"><span>{label}</span><div className="kpi-icon"><Icon size={17} /></div></div><div className="kpi-value">{value}</div><div className="kpi-meta"><span className="delta-down"><TrendingDown size={13} />{delta}</span><span>{detail}</span></div></button>;
}

function FilterRail({ payer, setPayer, aging, setAging, assignee, setAssignee }: { payer: string; setPayer: (value: string) => void; aging: string; setAging: (value: string) => void; assignee: string; setAssignee: (value: string) => void }) {
  return <aside className="filter-rail"><div className="filter-title"><div><span className="eyebrow">Narrow queue</span><h3>Filters</h3></div><SlidersHorizontal size={16} color={COLORS.muted} /></div>
    <div className="filter-group"><label>Payer</label><select value={payer} onChange={(event) => setPayer(event.target.value)}><option value="all">All payers</option>{payerRules.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div>
    <div className="filter-group"><label>CARC group</label><div className="chip-grid"><button className="filter-chip active">All</button><button className="filter-chip">CO</button><button className="filter-chip">PR</button><button className="filter-chip">OA</button><button className="filter-chip">PI</button></div></div>
    <div className="filter-group"><label>Aging bucket</label><select value={aging} onChange={(event) => setAging(event.target.value)}><option value="all">All aging</option><option value="0-7">0–7 days</option><option value="8-30">8–30 days</option><option value="31-60">31–60 days</option><option value="60+">60+ days</option></select></div>
    <div className="filter-group"><label>Assigned to</label><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="all">Everyone</option><option value="Maya Alvarez">Maya Alvarez</option><option value="Jordan Lee">Jordan Lee</option><option value="Priya Shah">Priya Shah</option></select></div>
    <div className="filter-divider" /><div className="filter-summary"><div><span className="summary-dot dot-coral" /><span>Critical deadline</span><strong>2</strong></div><div><span className="summary-dot dot-gold" /><span>Due this week</span><strong>3</strong></div><div><span className="summary-dot dot-blue" /><span>Unassigned</span><strong>0</strong></div></div>
    <button className="clear-link" onClick={() => { setPayer("all"); setAging("all"); setAssignee("all"); }}>Clear all filters <X size={13} /></button>
  </aside>;
}

function Worklist({ onOpenClaim }: { onOpenClaim: (id: string) => void }) {
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
  }), [payer, aging, assignee, search]);
  const allSelected = filtered.length > 0 && filtered.every((claim) => selected.includes(claim.id));
  const toggleAll = () => setSelected(allSelected ? [] : filtered.map((claim) => claim.id));
  return <div className="page-content worklist-page"><SectionHeading eyebrow="Revenue integrity / Queue 01" title="Denial worklist" description="Prioritized by appeal deadline, aging, and financial exposure." action={<div className="heading-actions"><Button variant="secondary" icon={Download} onClick={() => toast.success("Worklist export queued", { description: "A CSV will be ready in your downloads shortly." })}>Export queue</Button><Button icon={Plus} onClick={() => toast.info("New denial intake", { description: "Connect your clearinghouse to import claims." })}>Add denial</Button></div>} />
    <div className="worklist-metrics"><div className="metric-inline"><span className="metric-icon coral"><AlertCircle size={15} /></span><div><strong>8</strong><span>open denials</span></div></div><div className="metric-inline"><span className="metric-icon gold"><CalendarClock size={15} /></span><div><strong>3</strong><span>deadlines ≤ 7d</span></div></div><div className="metric-inline"><span className="metric-icon blue"><CircleDollarSign size={15} /></span><div><strong>$35.2k</strong><span>exposure in queue</span></div></div><div className="metric-inline"><span className="metric-icon violet"><FileCheck2 size={15} /></span><div><strong>2</strong><span>in appeal</span></div></div></div>
    <div className="worklist-layout"><FilterRail {...{ payer, setPayer, aging, setAging, assignee, setAssignee }} /><section className="table-panel"><div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search claim, patient ref, payer, CARC..." /><kbd>⌘ K</kbd></div><div className="toolbar-actions"><button className="icon-button" title="Filter view"><ListFilter size={16} /></button><button className="icon-button" title="Refresh" onClick={() => toast.success("Queue refreshed")}><RefreshCw size={15} /></button><span className="table-count">{filtered.length} of {denials.length} claims</span></div></div>{selected.length > 0 && <div className="bulk-bar"><span><strong>{selected.length}</strong> selected</span><button onClick={() => toast.success("Claims assigned", { description: "Selected claims assigned to Maya Alvarez." })}><UsersRound size={14} />Assign</button><button onClick={() => toast.success("Marked for appeal")}><FileCheck2 size={14} />Mark for appeal</button><button onClick={() => toast.success("Export started")}><Download size={14} />Export</button><button className="bulk-clear" onClick={() => setSelected([])}><X size={14} /></button></div>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th className="check-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all claims" /></th><th>Claim / patient ref</th><th>Payer</th><th>Denial reason</th><th>Exposure</th><th>Aging</th><th>Appeal deadline</th><th>Owner</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((claim, index) => <tr key={claim.id} className="table-row" style={{ animationDelay: `${index * 40}ms` }} onClick={() => onOpenClaim(claim.id)}><td className="check-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.includes(claim.id)} onChange={() => setSelected((current) => current.includes(claim.id) ? current.filter((id) => id !== claim.id) : [...current, claim.id])} aria-label={`Select ${claim.id}`} /></td><td><div className="claim-cell"><strong>{claim.id}</strong><span>{claim.patientRef} <em>·</em> {claim.department}</span></div></td><td><div className="payer-cell"><span className="payer-mark">{claim.payer === "Medicare Part B" ? "MB" : claim.payer.slice(0, 2).toUpperCase()}</span>{claim.payer}</div></td><td><div className="reason-cell"><div><strong>{claim.carcCode}</strong><span>{claim.carcDescription}</span></div><small>{claim.rarcCode !== "N/A" ? `RARC ${claim.rarcCode}` : "No RARC"}</small></div></td><td><span className="tabular amount">{money(claim.billedAmount)}</span><small className="subtle">{claim.cptCodes.join(" · ")}</small></td><td><span className={`aging-number ${claim.agingDays > 30 ? "aging-high" : claim.agingDays > 14 ? "aging-mid" : "aging-low"}`}>{claim.agingDays}d</span></td><td><Deadline days={claim.deadlineDays} label={claim.deadline} /></td><td><div className="owner-cell"><Avatar initials={claim.avatar} tone={claim.avatar === "PS" ? "gold" : claim.avatar === "JL" ? "violet" : "blue"} /><span>{claim.assignedTo.split(" ")[0]}</span></div></td><td><StatusBadge status={claim.status} /></td><td><ChevronRight size={15} color={COLORS.muted} /></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="zero-state"><div className="empty-icon"><Search size={21} /></div><h3>No denials match these filters</h3><p>Try clearing a filter or searching for a different claim ID.</p><button className="clear-link" onClick={() => { setSearch(""); setPayer("all"); setAging("all"); setAssignee("all"); }}>Clear filters <X size={13} /></button></div>}</div>
      <div className="table-footer"><span>Showing {filtered.length} prioritized denials</span><div className="pagination"><button className="icon-button" disabled><ArrowLeft size={14} /></button><button className="page-number active">1</button><button className="page-number">2</button><button className="icon-button"><ArrowRight size={14} /></button></div></div></section></div></div>;
}

function Dashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <div className="page-content"><SectionHeading eyebrow="Portfolio overview / Sep 03, 2026" title="Good morning, Maya" description="Here’s the revenue integrity picture for Northstar Health System." action={<Button variant="secondary" icon={RefreshCw} onClick={() => toast.success("Dashboard refreshed")}>Refresh data</Button>} />
    <div className="kpi-grid"><KpiCard label="Open denials" value="$124,860" delta="12.8%" detail="vs. prior 30 days" icon={CircleDollarSign} tone="coral" onClick={() => onNavigate("/worklist")} /><KpiCard label="Denial rate" value="6.4%" delta="0.9 pts" detail="trailing 30 days" icon={TrendingDown} tone="blue" /><KpiCard label="Avg. days to resolve" value="18.6d" delta="2.4d" detail="faster than target" icon={Clock3} tone="gold" /><KpiCard label="Appeal win rate" value="71.8%" delta="4.6 pts" detail="year to date" icon={ShieldCheck} tone="violet" onClick={() => onNavigate("/appeals")} /></div>
    <div className="dashboard-grid"><section className="chart-panel panel"><div className="panel-header"><div><span className="eyebrow">Trend / trailing 6 months</span><h2>Denial rate is trending down</h2></div><div className="legend"><span><i className="legend-line blue-line" />Denial rate</span><span><i className="legend-line target-line" />Target</span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}><defs><linearGradient id="denialFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B8CBF" stopOpacity={0.26} /><stop offset="100%" stopColor="#5B8CBF" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#DDE4EC" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} /><YAxis domain={[4, 10]} axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={{ border: "1px solid #DDE4EC", borderRadius: 12, background: "#FBFAF8", fontSize: 12, color: COLORS.ink }} formatter={(value: number) => [`${value}%`, "Denial rate"]} /><Area type="monotone" dataKey="target" stroke="#C9A24B" strokeWidth={1.5} strokeDasharray="4 4" fill="none" /><Area type="monotone" dataKey="rate" stroke="#5B8CBF" strokeWidth={2.5} fill="url(#denialFill)" /></AreaChart></ResponsiveContainer></div><div className="chart-callout"><span className="callout-icon"><TrendingDown size={14} /></span><span><strong>1.3 pts lower</strong> than April — prior authorization edits are making the biggest impact.</span><button onClick={() => onNavigate("/analytics")}>View root causes <ArrowRight size={13} /></button></div></section>
      <section className="deadlines-panel panel"><div className="panel-header"><div><span className="eyebrow">Action queue</span><h2>Deadlines this week</h2></div><button className="text-button" onClick={() => onNavigate("/appeals")}>View all <ArrowRight size={13} /></button></div><div className="deadline-list">{appeals.filter((appeal) => appeal.daysToDeadline > 0 && appeal.daysToDeadline <= 14).map((appeal) => <button key={appeal.id} className="deadline-item" onClick={() => onNavigate("/appeals")}><div className={`deadline-count ${appeal.daysToDeadline <= 6 ? "critical" : "warning"}`}><strong>{appeal.daysToDeadline}</strong><span>days</span></div><div className="deadline-copy"><strong>{appeal.claimId}</strong><span>{appeal.payer} · Level {appeal.level} appeal</span></div><ChevronRight size={15} color={COLORS.muted} /></button>)}</div><div className="deadline-footer"><span className="mini-status"><span className="status-dot bg-[#C77B7B]" />2 need attention today</span><span className="mini-status"><span className="status-dot bg-[#C9A24B]" />$19.4k at risk</span></div></section></div>
    <div className="bottom-grid"><section className="panel carc-panel"><div className="panel-header"><div><span className="eyebrow">Distribution / open denials</span><h2>By CARC group code</h2></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="carc-list">{carcData.map((item) => <div className="carc-row" key={item.code}><div className="carc-label"><span className="carc-code" style={{ background: `${item.color}18`, color: item.color }}>{item.code}</span><span>{item.label}</span><strong>{item.value}%</strong></div><div className="bar-track"><span style={{ width: `${item.value}%`, background: item.color }} /></div></div>)}</div></section><section className="panel insight-panel"><div className="insight-kicker"><Sparkles size={15} /> Signal worth a look</div><h2>CO-197 is up 18% with UnitedHealthcare</h2><p>Prior authorization denials are now the largest avoidable category for Orthopedics. Review the payer rule before the next surgical batch.</p><button className="text-button" onClick={() => onNavigate("/payers")}>Open payer rules <ArrowRight size={13} /></button><div className="insight-footer"><span><AlertCircle size={14} /> 24 claims affected</span><span>$42.8k exposure</span></div></section></div></div>;
}

function Predict() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ payer: "UnitedHealthcare", cpt: "27447", diagnosis: "M17.11 — Unilateral primary osteoarthritis, right knee", auth: "No authorization on file" });
  const runPrediction = (event: React.FormEvent) => { event.preventDefault(); setSubmitted(true); toast.success("Prediction complete", { description: "Risk factors have been scored against current payer rules." }); };
  return <div className="page-content"><SectionHeading eyebrow="Pre-submission intelligence" title="Predict denial risk" description="Catch avoidable denials before the claim leaves your work queue." action={<div className="prediction-badge"><span className="pulse-dot" />Model updated 2h ago</div>} />
    <div className="predict-layout"><form className="predict-form panel" onSubmit={runPrediction}><div className="form-intro"><div className="form-icon"><Target size={18} /></div><div><h2>Check a claim</h2><p>Use the claim details you have at charge capture. No PHI required.</p></div></div><div className="form-grid"><label className="form-field"><span>Payer</span><select value={form.payer} onChange={(event) => setForm({ ...form, payer: event.target.value })}>{payerRules.map((payer) => <option key={payer.name}>{payer.name}</option>)}</select></label><label className="form-field"><span>Primary CPT / HCPCS</span><input value={form.cpt} onChange={(event) => setForm({ ...form, cpt: event.target.value })} /></label><label className="form-field full"><span>Diagnosis code</span><input value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></label><label className="form-field full"><span>Authorization status</span><select value={form.auth} onChange={(event) => setForm({ ...form, auth: event.target.value })}><option>No authorization on file</option><option>Authorization verified</option><option>Authorization pending</option><option>Not required by payer</option></select></label></div><div className="form-note"><LockKeyhole size={14} /><span>Prediction uses de-identified claim attributes and current payer rules. It does not make coverage decisions.</span></div><Button type="submit" icon={Sparkles} className="predict-submit">Run denial prediction</Button></form>
      <section className={`prediction-result panel ${submitted ? "revealed" : ""}`}>{submitted ? <><div className="result-header"><div><span className="eyebrow">Prediction result / {form.payer}</span><h2>High denial risk detected</h2></div><span className="result-stamp">Just now</span></div><div className="risk-readout"><div className="risk-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="49" fill="none" stroke="#E9E4DF" strokeWidth="8" /><circle cx="60" cy="60" r="49" fill="none" stroke="#C77B7B" strokeWidth="8" strokeLinecap="round" strokeDasharray="308" strokeDashoffset="71" transform="rotate(-90 60 60)" /></svg><div><strong>77</strong><span>/ 100</span></div></div><div className="risk-copy"><span className="risk-label">Likely denial</span><strong>CO-197</strong><p>Prior authorization required</p><div className="suggested-fix"><CheckCircle2 size={15} /><span><strong>Suggested fix:</strong> Verify authorization for CPT {form.cpt} before submission.</span></div></div></div><div className="factor-heading"><span>Contributing factors</span><span>Impact</span></div><div className="factor-list"><div className="factor-row"><div><ArrowUpRight size={14} color={COLORS.coral} /><span>Missing prior authorization</span></div><div className="factor-bar"><span style={{ width: "92%", background: COLORS.coral }} /></div><strong>+38</strong></div><div className="factor-row"><div><ArrowUpRight size={14} color={COLORS.coral} /><span>High-value surgical CPT</span></div><div className="factor-bar"><span style={{ width: "54%", background: COLORS.gold }} /></div><strong>+22</strong></div><div className="factor-row"><div><ArrowDownRight size={14} color={COLORS.green} /><span>Diagnosis supports procedure</span></div><div className="factor-bar"><span style={{ width: "31%", background: COLORS.green }} /></div><strong>-8</strong></div></div><div className="result-actions"><Button variant="secondary" icon={FileText} onClick={() => toast.success("Recommendation saved to claim notes")}>Save to claim</Button><Button icon={ArrowRight} onClick={() => toast.info("Claim intake is ready")}>Review next step</Button></div></> : <div className="prediction-empty"><div className="empty-icon prediction"><Sparkles size={22} /></div><span className="eyebrow">Awaiting claim details</span><h2>Your risk readout will appear here</h2><p>Run a prediction to see the likely CARC code, risk factors, and the next best action.</p><div className="empty-rule"><span /><span /><span /></div></div>}</section></div></div>;
}

function Claims({ onOpenClaim }: { onOpenClaim: (id: string) => void }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const claims = denials.filter((claim) => (status === "all" || claim.status === status) && (!query || `${claim.id} ${claim.payer} ${claim.patientRef}`.toLowerCase().includes(query.toLowerCase())));
  return <div className="page-content"><SectionHeading eyebrow="All submissions / 2026" title="Claims log" description="The full claim history across statuses, payers, and departments." action={<Button icon={Download} variant="secondary" onClick={() => toast.success("Claims export queued")}>Export log</Button>} /><div className="claims-summary"><div><span>Total claims</span><strong>1,284</strong></div><div><span>Paid</span><strong className="text-green">1,073</strong></div><div><span>Pending</span><strong className="text-gold">103</strong></div><div><span>Denied</span><strong className="text-coral">108</strong></div></div><section className="panel table-panel claims-panel"><div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search claim ID, payer, patient ref..." /></div><select className="compact-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="denied">Denied</option><option value="appealed">Appealed</option><option value="pending">Pending</option><option value="paid">Paid</option></select></div><div className="table-scroll"><table className="data-table claims-table"><thead><tr><th>Claim ID</th><th>Patient ref</th><th>Payer</th><th>Submitted</th><th>Amount</th><th>Denial code</th><th>Status</th><th /></tr></thead><tbody>{claims.map((claim) => <tr className="table-row" key={claim.id} onClick={() => onOpenClaim(claim.id)}><td><strong>{claim.id}</strong></td><td className="subtle">{claim.patientRef}</td><td>{claim.payer}</td><td className="tabular subtle">Aug {String(29 - claim.agingDays % 20).padStart(2, "0")}, 2026</td><td className="tabular amount">{money(claim.billedAmount)}</td><td><span className="code-pill">{claim.carcCode}</span><small className="subtle code-desc">{claim.carcDescription}</small></td><td><StatusBadge status={claim.status} /></td><td><ChevronRight size={15} color={COLORS.muted} /></td></tr>)}</tbody></table></div></section></div>;
}

function ClaimDetail({ claimId, onBack }: { claimId: string; onBack: () => void }) {
  const claim = denials.find((item) => item.id === claimId) ?? denials[0];
  return <div className="page-content claim-detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={15} />Back to worklist</button><div className="detail-heading"><div><div className="eyebrow">Claim record / {claim.department}</div><h1>{claim.id}</h1><p>{claim.patientRef} <span>·</span> {claim.payer} <span>·</span> submitted Aug 22, 2026</p></div><div className="detail-actions"><Button variant="secondary" icon={MoreHorizontal} onClick={() => toast.info("More claim actions")}>More</Button><Button variant="secondary" icon={FileCheck2} onClick={() => toast.success("Appeal started", { description: "A Level 1 appeal draft has been created." })}>Start appeal</Button><Button icon={CheckCircle2} onClick={() => toast.success("Claim marked paid")}>Mark paid</Button></div></div><div className="detail-grid"><div className="detail-main"><section className="panel claim-summary-panel"><div className="panel-header"><div><span className="eyebrow">Current state</span><h2>Denial summary</h2></div><StatusBadge status={claim.status} /></div><div className="summary-grid"><div><span>Denied amount</span><strong>{money(claim.billedAmount)}</strong></div><div><span>CARC / group</span><strong>{claim.carcCode} <em>{claim.groupCode}</em></strong></div><div><span>Aging</span><strong className="text-coral">{claim.agingDays} days</strong></div><div><span>Appeal deadline</span><strong className={claim.deadlineDays <= 6 ? "text-coral" : "text-gold"}>{claim.deadline}</strong></div></div><div className="code-callout"><div className="code-callout-badge">{claim.carcCode}</div><div><strong>{claim.carcDescription}</strong><p>RARC {claim.rarcCode} · The payer indicates the service was not supported under the submitted documentation or coverage policy.</p></div><button className="icon-button" onClick={() => toast.info("CARC reference", { description: "Code detail copied to clipboard." })}><HelpCircle size={16} /></button></div></section><section className="panel timeline-panel"><div className="panel-header"><div><span className="eyebrow">Lifecycle</span><h2>Claim timeline</h2></div><span className="subtle">Last updated 2h ago</span></div><div className="timeline"><div className="timeline-item complete"><div className="timeline-node"><Check size={13} /></div><div><strong>Submitted</strong><span>Aug 22, 2026 · 09:14 AM</span></div></div><div className="timeline-item complete"><div className="timeline-node"><Check size={13} /></div><div><strong>Processed</strong><span>Aug 25, 2026 · 03:42 PM</span></div></div><div className="timeline-item current"><div className="timeline-node"><AlertCircle size={13} /></div><div><strong>Denied · {claim.carcCode}</strong><span>Aug 26, 2026 · Medical necessity</span></div></div><div className="timeline-item"><div className="timeline-node" /><div><strong>Appeal</strong><span>Not started · deadline {claim.deadline}</span></div></div></div></section><section className="panel notes-panel"><div className="panel-header"><div><span className="eyebrow">Work notes</span><h2>Analyst notes</h2></div><Button variant="ghost" icon={Plus} onClick={() => toast.info("Note composer opened")}>Add note</Button></div><div className="note-entry"><Avatar initials="MA" tone="blue" size="md" /><div><p>Reviewing documentation against the payer’s medical necessity policy. Requesting the operative note from Cardiology before Level 1 submission.</p><span>Maya Alvarez · Sep 03, 2026 at 10:18 AM</span></div></div></section></div><aside className="detail-side"><section className="panel owner-panel"><div className="panel-header"><span className="eyebrow">Ownership</span><button className="icon-button"><MoreHorizontal size={16} /></button></div><div className="owner-large"><Avatar initials={claim.avatar} tone="blue" size="lg" /><div><strong>{claim.assignedTo}</strong><span>Denial analyst</span></div></div><div className="owner-line"><span>Department</span><strong>{claim.department}</strong></div><div className="owner-line"><span>Priority</span><strong className="text-coral">High · 3d to deadline</strong></div><button className="assign-button" onClick={() => toast.success("Assignment updated")}>Reassign claim <ChevronDown size={14} /></button></section><section className="panel details-panel"><div className="panel-header"><span className="eyebrow">Claim details</span></div><div className="detail-list"><div><span>CPT / HCPCS</span><strong>{claim.cptCodes.join(" · ")}</strong></div><div><span>Billed amount</span><strong>{money(claim.billedAmount)}</strong></div><div><span>Allowed amount</span><strong>$0.00</strong></div><div><span>Place of service</span><strong>22 · Outpatient hospital</strong></div><div><span>Rendering provider</span><strong>Dr. Elena Rodriguez</strong></div></div></section><section className="panel next-action"><div className="next-icon"><CalendarClock size={17} /></div><div><span className="eyebrow">Next best action</span><strong>Secure medical necessity documentation</strong><p>Upload the operative note before the appeal deadline to protect {money(claim.billedAmount)}.</p><button className="text-button" onClick={() => toast.info("Document uploader opened")}>Upload document <ArrowRight size={13} /></button></div></section></aside></div></div>;
}

function Appeals() {
  const columns: { key: Appeal["status"]; label: string; note: string }[] = [{ key: "drafting", label: "Drafting", note: "Needs analyst action" }, { key: "submitted", label: "Submitted", note: "With payer" }, { key: "awaiting_response", label: "Awaiting response", note: "Watch the clock" }, { key: "won", label: "Resolved", note: "Closed this cycle" }];
  return <div className="page-content"><SectionHeading eyebrow="Appeal operations / 12 in flight" title="Appeals pipeline" description="Keep every submission moving before its payer SLA expires." action={<Button icon={Plus} onClick={() => toast.info("New appeal draft", { description: "Select a denied claim to begin." })}>New appeal</Button>} /><div className="appeal-summary"><div><strong>12</strong><span>in flight</span></div><div><strong className="text-coral">3</strong><span>due in 7 days</span></div><div><strong className="text-violet">71.8%</strong><span>win rate YTD</span></div><div><strong>$84.2k</strong><span>recoverable value</span></div></div><div className="kanban">{columns.map((column) => { const items = appeals.filter((appeal) => appeal.status === column.key); return <section className="kanban-column" key={column.key}><div className="kanban-header"><div><h3>{column.label}</h3><span>{column.note}</span></div><span className="column-count">{items.length}</span></div><div className="kanban-cards">{items.map((appeal) => <button className="appeal-card" key={appeal.id} onClick={() => toast.info(`${appeal.id} selected`, { description: "Open the linked claim to review the full record." })}><div className="appeal-card-top"><span className="appeal-id">{appeal.id}</span><span className={`level-pill level-${appeal.level}`}>L{appeal.level}</span></div><strong>{appeal.claimId}</strong><span className="appeal-payer">{appeal.payer}</span><div className="appeal-card-meta"><span className={appeal.daysToDeadline <= 6 ? "text-coral" : appeal.daysToDeadline <= 14 ? "text-gold" : "text-green"}><Clock3 size={13} />{appeal.daysToDeadline < 0 ? `${Math.abs(appeal.daysToDeadline)}d past due` : `${appeal.daysToDeadline}d to deadline`}</span><span><Paperclip size={13} />{appeal.attachments}</span></div><div className="appeal-card-footer"><span className="mini-status"><span className={`status-dot ${appeal.status === "won" ? "bg-[#5FAE93]" : appeal.daysToDeadline <= 6 ? "bg-[#C77B7B]" : "bg-[#C9A24B]"}`} />{appeal.notes}</span><ChevronRight size={14} color={COLORS.muted} /></div></button>)}</div>{items.length === 0 && <div className="column-empty"><Inbox size={18} /><span>No appeals here</span></div>}</section> })}</div></div>;
}

function Payers() {
  return <div className="page-content"><SectionHeading eyebrow="Reference library / 5 payers" title="Payer rules" description="Timely filing, authorization, and appeal guidance for the payers your team works most." action={<Button variant="secondary" icon={Plus} onClick={() => toast.info("Payer rule request", { description: "Contact an administrator to add a payer." })}>Request payer</Button>} /><div className="library-callout"><div className="callout-icon blue-bg"><Library size={17} /></div><div><strong>Rules last verified Aug 28, 2026</strong><p>Deadlines are payer-specific. Always confirm the member plan and state contract before submitting an appeal.</p></div><button className="text-button" onClick={() => toast.info("Verification log opened")}>View verification log <ArrowRight size={13} /></button></div><section className="panel table-panel payer-panel"><div className="table-toolbar"><div><span className="eyebrow">Coverage reference</span><h2>Filing & appeal requirements</h2></div><div className="table-search compact"><Search size={15} /><input placeholder="Search payers..." /></div></div><div className="table-scroll"><table className="data-table payer-table"><thead><tr><th>Payer</th><th>Timely filing window</th><th>Prior authorization</th><th>Appeal deadline</th><th>Submission method</th><th /></tr></thead><tbody>{payerRules.map((payer) => <tr className="table-row" key={payer.name}><td><div className="payer-name"><span className="payer-mark large" style={{ background: `${payer.color}18`, color: payer.color }}>{payer.initials}</span><strong>{payer.name}</strong></div></td><td><span className="tabular">{payer.filing}</span></td><td><span className="rule-summary">{payer.auth}</span></td><td><span className="tabular text-gold">{payer.appeal}</span></td><td><span className="method-pill"><Send size={13} />{payer.method}</span></td><td><button className="icon-button"><ChevronRight size={15} /></button></td></tr>)}</tbody></table></div></section><div className="code-reference panel"><div><span className="eyebrow">CARC quick reference</span><h2>Common denial codes</h2><p>Every code in the worklist links back to a plain-language definition.</p></div><div className="code-reference-list"><span><strong>CO-50</strong>Medical necessity</span><span><strong>CO-197</strong>Prior authorization</span><span><strong>CO-29</strong>Timely filing</span><span><strong>CO-16</strong>Missing information</span></div></div></div>;
}

function Analytics() {
  return <div className="page-content"><SectionHeading eyebrow="Root-cause intelligence / YTD" title="Denial analytics" description="Find the patterns behind lost revenue and focus your next intervention." action={<Button variant="secondary" icon={Download} onClick={() => toast.success("Analytics export queued")}>Export report</Button>} /><div className="analytics-kpis"><div className="analytics-stat"><span>Preventable denial rate</span><strong>3.1%</strong><small className="text-green"><TrendingDown size={13} />0.8 pts vs. last quarter</small></div><div className="analytics-stat"><span>Top root cause</span><strong>CO-197</strong><small>Prior authorization</small></div><div className="analytics-stat"><span>Revenue recovered</span><strong>$486.2k</strong><small className="text-green"><TrendingUp size={13} />14.2% vs. last year</small></div><div className="analytics-stat"><span>Highest risk service line</span><strong>Orthopedics</strong><small>8.7% denial rate</small></div></div><div className="analytics-grid"><section className="panel analytics-chart"><div className="panel-header"><div><span className="eyebrow">Payer comparison</span><h2>Denial rate vs. recovery</h2></div><div className="legend"><span><i className="legend-dot blue-dot" />Denial rate</span><span><i className="legend-dot green-dot" />Recovered</span></div></div><div className="analytics-chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}><CartesianGrid vertical={false} stroke="#DDE4EC" strokeDasharray="3 4" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} /><YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={{ border: "1px solid #DDE4EC", borderRadius: 12, background: "#FBFAF8", fontSize: 12 }} /><Bar yAxisId="left" dataKey="denial" fill="#5B8CBF" radius={[4, 4, 0, 0]} barSize={18} name="Denial rate" /><Bar yAxisId="right" dataKey="recovered" fill="#5FAE93" radius={[4, 4, 0, 0]} barSize={18} name="Recovered" /></BarChart></ResponsiveContainer></div></section><section className="panel root-cause-panel"><div className="panel-header"><div><span className="eyebrow">Avoidable revenue</span><h2>Top root causes</h2></div><span className="subtle">$72.4k open</span></div><div className="root-cause-list">{[{ code: "CO-197", label: "Prior authorization", value: "$42.8k", pct: 59, color: COLORS.coral }, { code: "CO-50", label: "Medical necessity", value: "$17.6k", pct: 24, color: COLORS.gold }, { code: "CO-16", label: "Missing information", value: "$8.1k", pct: 11, color: COLORS.blue }, { code: "CO-29", label: "Timely filing", value: "$3.9k", pct: 6, color: COLORS.violet }].map((item) => <div className="root-cause" key={item.code}><div><span className="code-pill">{item.code}</span><span>{item.label}</span><strong>{item.value}</strong></div><div className="bar-track"><span style={{ width: `${item.pct}%`, background: item.color }} /></div></div>)}</div></section></div><section className="panel service-line-panel"><div className="panel-header"><div><span className="eyebrow">Operational focus</span><h2>Denial rate by service line</h2></div><button className="text-button">View all departments <ArrowRight size={13} /></button></div><div className="service-grid">{[{ name: "Orthopedics", rate: "8.7%", trend: "+1.2 pts", tone: "coral" }, { name: "Cardiology", rate: "7.4%", trend: "−0.6 pts", tone: "gold" }, { name: "Rehab Services", rate: "6.9%", trend: "−1.8 pts", tone: "blue" }, { name: "Primary Care", rate: "4.2%", trend: "−0.4 pts", tone: "green" }].map((item) => <div className="service-card" key={item.name}><div><span className={`service-signal ${item.tone}`} /><strong>{item.name}</strong></div><b>{item.rate}</b><small className={item.tone === "coral" ? "text-coral" : "text-green"}>{item.trend} MoM</small></div>)}</div></section></div>;
}

function Settings() {
  return <div className="page-content settings-page"><SectionHeading eyebrow="Workspace administration" title="Settings" description="Manage your team, workflow defaults, and notification preferences." /><div className="settings-layout"><aside className="settings-nav"><button className="settings-nav-item active"><UsersRound size={16} />Team & roles</button><button className="settings-nav-item"><Bell size={16} />Notifications</button><button className="settings-nav-item"><SlidersHorizontal size={16} />Workflow defaults</button><button className="settings-nav-item"><ShieldCheck size={16} />Security & access</button></aside><div className="settings-content"><section className="panel settings-panel"><div className="panel-header"><div><span className="eyebrow">Northstar Health System</span><h2>Team & roles</h2></div><Button icon={Plus} onClick={() => toast.success("Invite flow opened")}>Invite member</Button></div><p className="panel-description">Roles control which claim actions and financial records each teammate can access.</p><div className="team-list">{[{ name: "Maya Alvarez", email: "malvarez@northstar.health", role: "Denial analyst", badge: "MA", tone: "blue" }, { name: "Jordan Lee", email: "jlee@northstar.health", role: "Biller", badge: "JL", tone: "violet" }, { name: "Priya Shah", email: "pshah@northstar.health", role: "Denial analyst", badge: "PS", tone: "gold" }, { name: "Amelia Chen", email: "achen@northstar.health", role: "Admin", badge: "AC", tone: "green" }].map((member) => <div className="team-row" key={member.email}><Avatar initials={member.badge} tone={member.tone as "blue" | "violet" | "gold" | "green"} size="md" /><div className="team-member"><strong>{member.name}</strong><span>{member.email}</span></div><span className="role-pill">{member.role}</span><button className="icon-button"><MoreHorizontal size={16} /></button></div>)}</div></section><section className="panel settings-panel"><div className="panel-header"><div><span className="eyebrow">Personal preferences</span><h2>Notifications</h2></div></div><div className="preference-row"><div><strong>Appeal deadlines</strong><span>Notify me 14, 7, and 2 days before a deadline.</span></div><div className="toggle on"><span /></div></div><div className="preference-row"><div><strong>High-risk predictions</strong><span>Send a digest when a predicted risk exceeds 70.</span></div><div className="toggle on"><span /></div></div><div className="preference-row"><div><strong>Weekly revenue integrity brief</strong><span>Monday summary of preventable denials and recovery.</span></div><div className="toggle"><span /></div></div></section></div></div></div>;
}

function Login({ onLogin }: { onLogin: () => void }) {
  return <div className="login-page ambient-shell"><div className="login-aside"><div className="brand lockup"><div className="brand-mark">DG</div><div><strong>DenialGuard <em>AI</em></strong><span>RCM OPERATIONS</span></div></div><div className="login-quote"><span className="eyebrow">Revenue integrity, with signal</span><h1>Turn denials into decisions.</h1><p>One calm workspace for triage, appeals, payer rules, and the next best action.</p><div className="quote-rule"><span /><span /><span /></div></div><div className="login-aside-footer"><span>Trusted workflow controls for modern RCM teams</span><span>v2.4.0 · SOC 2 ready</span></div></div><div className="login-card-wrap"><div className="login-card glass"><div className="login-card-top"><div className="mobile-brand brand lockup"><div className="brand-mark">DG</div><div><strong>DenialGuard <em>AI</em></strong></div></div><span className="secure-label"><LockKeyhole size={13} /> Secure sign in</span></div><div className="login-card-heading"><span className="eyebrow">Northstar Health System</span><h2>Welcome back</h2><p>Sign in to your revenue integrity workspace.</p></div><button className="sso-button" onClick={onLogin}><span className="sso-logo">N</span>Continue with Northstar SSO <ArrowRight size={16} /></button><div className="or-rule"><span />or<span /></div><label className="form-field"><span>Work email</span><input type="email" placeholder="you@northstar.health" /></label><Button className="login-button" onClick={onLogin}>Sign in</Button><p className="login-help">Having trouble? <button onClick={() => toast.info("Support request", { description: "Your IT administrator can reset your SSO access." })}>Contact your administrator</button></p><div className="login-legal"><span>Protected workspace</span><span>Privacy · Terms</span></div></div></div></div>;
}

function Sidebar({ location, onNavigate }: { location: string; onNavigate: (path: string) => void }) {
  return <aside className="sidebar glass"><div className="brand"><div className="brand-mark">DG</div><div><strong>DenialGuard <em>AI</em></strong><span>RCM OPERATIONS</span></div></div><button className="workspace-switcher"><span className="workspace-avatar"><Building2 size={16} /></span><span><strong>Northstar Health</strong><small>Revenue Integrity</small></span><ChevronDown size={14} /></button><nav className="sidebar-nav">{navGroups.map((group) => <div key={group.label} className="nav-group"><span className="nav-label">{group.label}</span>{group.items.map((item) => { const active = location === item.path || (item.path === "/worklist" && location === "/") || (item.path === "/claims" && location.startsWith("/claims/")); return <button key={item.path} className={`nav-item ${active ? "active" : ""}`} onClick={() => onNavigate(item.path)}><item.icon size={17} strokeWidth={active ? 2.1 : 1.7} /><span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button> })}</div>)}</nav><div className="sidebar-bottom"><div className="system-status"><span className="pulse-dot green" /><div><strong>Systems operational</strong><span>Last sync 2 min ago</span></div><CheckCircle2 size={15} color={COLORS.green} /></div><button className="help-link" onClick={() => toast.info("Help center", { description: "Guides for your daily denial workflow are coming soon." })}><HelpCircle size={15} />Help center</button><div className="user-profile"><Avatar initials="MA" tone="blue" /><div><strong>Maya Alvarez</strong><span>Denial analyst</span></div><button className="icon-button" onClick={() => toast.info("Profile menu")}><MoreHorizontal size={15} /></button></div></div></aside>;
}

function Topbar({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  return <header className="topbar glass"><button className="mobile-menu icon-button"><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>Revenue integrity</strong></div><div className="global-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { onNavigate("/worklist"); toast.success(query ? `Searching for ${query}` : "Opened worklist"); } }} placeholder="Search claims, payers, patient refs..." /><kbd><Command size={12} />K</kbd></div><div className="topbar-actions"><button className="topbar-icon" onClick={() => toast.info("No new notifications", { description: "You’re all caught up on appeal deadlines." })}><Bell size={18} /><span className="notification-dot" /></button><div className="topbar-divider" /><button className="topbar-user" onClick={() => toast.info("Signed in as Maya Alvarez")}><Avatar initials="MA" tone="blue" /><span>Maya</span><ChevronDown size={13} /></button></div></header>;
}

function AppShell({ location, onNavigate, children }: { location: string; onNavigate: (path: string) => void; children: React.ReactNode }) {
  return <div className="app-shell ambient-shell"><Sidebar location={location} onNavigate={onNavigate} /><div className="app-main"><Topbar onNavigate={onNavigate} /><main className="main-surface">{children}</main></div></div>;
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const path = location.split("?")[0];
  if (path === "/login") return <Login onLogin={() => setLocation("/worklist")} />;
  const renderPage = () => {
    if (path === "/dashboard") return <Dashboard onNavigate={setLocation} />;
    if (path === "/predict") return <Predict />;
    if (path === "/claims") return <Claims onOpenClaim={(id) => setLocation(`/claims/${id}`)} />;
    if (path.startsWith("/claims/")) return <ClaimDetail claimId={path.split("/")[2] ?? denials[0].id} onBack={() => setLocation("/worklist")} />;
    if (path === "/appeals") return <Appeals />;
    if (path === "/payers") return <Payers />;
    if (path === "/analytics") return <Analytics />;
    if (path === "/settings") return <Settings />;
    return <Worklist onOpenClaim={(id) => setLocation(`/claims/${id}`)} />;
  };
  return <AppShell location={path} onNavigate={setLocation}>{renderPage()}</AppShell>;
}
