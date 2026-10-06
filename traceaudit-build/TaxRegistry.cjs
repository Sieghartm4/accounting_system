var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  default: () => TaxRegistry
});
module.exports = __toCommonJS(stdin_exports);
var import_react = __toESM(require("react"));
var import_DynamicToast = __toESM(require("../../components/DynamicToast"));
var import_lucide_react = require("lucide-react");
var import_LoadingScreen = __toESM(require("../../components/LoadingScreen"));
var import_ProtectedAction = __toESM(require("../../components/ProtectedAction"));
var import_useTaxRegistry = __toESM(require("./useTaxRegistry"));
class Boundary extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { message: null };
  }
  static getDerivedStateFromError(err) {
    return { message: err?.message || "This page failed to render." };
  }
  render() {
    if (this.state.message) {
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "h-full flex items-center justify-center bg-[#f4f5f7] p-6" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg" }, /* @__PURE__ */ import_react.default.createElement("h2", { className: "font-black uppercase tracking-wide text-red-600 text-sm flex items-center gap-2" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.AlertCircle, { size: 16 }), "Tax page could not render"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[13px] font-medium text-gray-600 mt-2" }, this.state.message), /* @__PURE__ */ import_react.default.createElement(
        "button",
        {
          onClick: () => this.setState({ message: null }),
          className: "mt-4 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-black text-white hover:bg-red-600 transition-colors"
        },
        "Try again"
      )));
    }
    return this.props.children;
  }
}
const STATUS_STYLE = {
  applicable: "ring-1 ring-gray-200 bg-gray-50 text-black",
  conflict: "ring-1 ring-amber-200 bg-amber-50 text-amber-800",
  not_applicable: "ring-1 ring-gray-200 bg-gray-100 text-gray-400"
};
const FILING_STATUS_STYLE = {
  draft: "ring-1 ring-gray-200 bg-gray-100 text-gray-600",
  computed: "ring-1 ring-red-200 bg-red-50 text-red-700",
  acknowledged: "ring-1 ring-gray-200 bg-gray-50 text-black",
  filed: "ring-1 ring-gray-900 bg-black text-white",
  filed_with_bir: "ring-1 ring-gray-900 bg-black text-white",
  rejected: "ring-1 ring-red-200 bg-red-50 text-red-700",
  superseded: "ring-1 ring-gray-200 bg-gray-100 text-gray-400"
};
const CATEGORY_ORDER = [
  "VAT",
  "Withholding",
  "Income Tax",
  "Certificate",
  "Supporting Schedule"
];
const CATEGORY_ICON = {
  VAT: import_lucide_react.Percent,
  Withholding: import_lucide_react.Wallet,
  "Income Tax": import_lucide_react.ReceiptText,
  Certificate: import_lucide_react.BadgePercent,
  "Supporting Schedule": import_lucide_react.ListChecks
};
const TAB_IDS = ["computation", "profile", "deadlines", "filings"];
const RegistrySidebar = ({ byCategory, totalForms, activeForm, onSelect, resultByForm }) => {
  const [filter, setFilter] = (0, import_react.useState)("");
  const term = filter.trim().toLowerCase();
  const matches = (form) => !term || form.form_code.toLowerCase().includes(term) || (form.short_title || "").toLowerCase().includes(term);
  const groups = byCategory.map(({ cat, forms }) => ({ cat, forms: forms.filter(matches) })).filter((g) => g.forms.length > 0);
  return /* @__PURE__ */ import_react.default.createElement("aside", { className: "w-72 shrink-0 flex flex-col overflow-hidden bg-white border-r border-slate-200" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "p-3 border-b border-slate-200 bg-slate-50" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ import_react.default.createElement("h2", { className: "text-xs font-bold uppercase tracking-wider text-slate-500" }, "Tax Form Registry"), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded font-mono font-medium" }, totalForms, " Forms")), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "text",
      value: filter,
      onChange: (e) => setFilter(e.target.value),
      placeholder: "Filter by code or title...",
      className: "w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
    }
  )), /* @__PURE__ */ import_react.default.createElement("nav", { className: "flex-1 overflow-y-auto p-3 space-y-4 tax-scroll" }, groups.length === 0 && /* @__PURE__ */ import_react.default.createElement("p", { className: "text-xs text-slate-400 px-2 py-4 text-center" }, "No form matches \u201C", filter, "\u201D."), groups.map(({ cat, forms }) => {
    const Icon = CATEGORY_ICON[cat] || import_lucide_react.ListChecks;
    return /* @__PURE__ */ import_react.default.createElement("div", { key: cat }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center justify-between px-2 py-1 bg-zinc-900 text-white rounded text-[11px] font-bold tracking-wider uppercase border-l-4 border-brand-red" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ import_react.default.createElement(Icon, { size: 11, className: "text-brand-red" }), cat), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] opacity-70 font-normal" }, forms.length, " ", forms.length === 1 ? "item" : "items")), /* @__PURE__ */ import_react.default.createElement("div", { className: "space-y-0.5 mt-1" }, forms.map((f) => {
      const isActive = activeForm === f.form_code;
      const status = resultByForm.get(f.form_code)?.status ?? "not_applicable";
      return /* @__PURE__ */ import_react.default.createElement(
        "button",
        {
          key: f.form_code,
          onClick: () => onSelect(f.form_code),
          title: f.short_title,
          className: `w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition ${isActive ? "bg-brand-red text-white shadow-md font-medium" : "hover:bg-slate-100 text-slate-600"}`
        },
        /* @__PURE__ */ import_react.default.createElement("span", { className: "truncate pr-1" }, /* @__PURE__ */ import_react.default.createElement(
          "span",
          {
            className: `font-mono font-bold mr-2 ${isActive ? "text-white" : "text-brand-red"}`
          },
          f.form_code
        ), /* @__PURE__ */ import_react.default.createElement("span", { className: isActive ? "text-white" : "" }, f.short_title)),
        /* @__PURE__ */ import_react.default.createElement(
          "span",
          {
            className: `text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${isActive ? "bg-black/30 text-white uppercase" : "bg-slate-100 text-slate-400"}`
          },
          isActive ? "Active" : status === "not_applicable" ? "N/A" : status
        )
      );
    })));
  })));
};
const StatusBanner = ({ formDetail, status, reason, conflict, preview, gapCount }) => {
  let tone = "ready";
  let message = preview ? `Displaying the computed figures for BIR Form ${formDetail?.form_code}. Every amount links to the ledger lines it was summed from.` : `Displaying tax compliance requirements and rules for Form ${formDetail?.form_code}. Choose a period and compute to fill the return.`;
  let pill = preview ? "Computed" : "No computation yet";
  let Icon = import_lucide_react.Info;
  if (status === "not_applicable") {
    tone = "muted";
    Icon = import_lucide_react.AlertCircle;
    pill = "Not applicable";
    message = `This form does not apply to the selected company: ${reason || "no reason given"}. It stays viewable for reference.`;
  } else if (status === "conflict") {
    tone = "warn";
    Icon = import_lucide_react.AlertTriangle;
    pill = "Conflict";
    message = [reason, conflict].filter(Boolean).join(". ") || "The profile contradicts this form.";
  } else if (gapCount > 0) {
    tone = "warn";
    Icon = import_lucide_react.AlertTriangle;
    pill = `${gapCount} open item${gapCount === 1 ? "" : "s"}`;
    message = `${gapCount} fact${gapCount === 1 ? "" : "s"} behind these figures could not be confirmed from the ledger. They are listed under the form.`;
  }
  const pillTone = {
    ready: "bg-zinc-800 text-zinc-300 border-zinc-700",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    muted: "bg-zinc-800 text-zinc-400 border-zinc-700"
  }[tone];
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-gradient-to-r from-zinc-900 via-zinc-900 to-black text-white rounded-xl p-4 shadow-md border-l-4 border-brand-red flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "p-2 bg-brand-red/20 text-brand-red rounded-lg" }, /* @__PURE__ */ import_react.default.createElement(Icon, { size: 16 })), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("h3", { className: "text-xs font-bold text-white tracking-wide uppercase" }, "Form Status Notice"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-xs text-zinc-300 mt-0.5" }, message))), /* @__PURE__ */ import_react.default.createElement(
    "span",
    {
      className: `inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${pillTone}`
    },
    /* @__PURE__ */ import_react.default.createElement(
      "span",
      {
        className: `w-1.5 h-1.5 rounded-full mr-1.5 ${tone === "warn" ? "bg-amber-400" : "bg-brand-red"} ${preview && tone === "ready" ? "" : "animate-pulse"}`
      }
    ),
    pill
  ));
};
const ProfilePrompt = ({ missing, onOpen }) => {
  if (!missing || missing.length === 0) return null;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-start gap-2.5 min-w-0" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.AlertTriangle, { size: 16, className: "shrink-0 mt-0.5 text-amber-600" }), /* @__PURE__ */ import_react.default.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[12px] font-black text-amber-900" }, "Finish the taxpayer profile to see which returns apply"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[12px] font-medium text-amber-800 mt-0.5" }, "Still unknown: ", /* @__PURE__ */ import_react.default.createElement("strong", null, missing.join(", ")), ". Until these are confirmed, every form reads \u201Cnot applicable\u201D \u2014 nothing here says you have no obligations, it says nobody has told the system what you are."))), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      onClick: onOpen,
      className: "shrink-0 self-start sm:self-auto text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
    },
    "Complete profile"
  ));
};
const CollapsiblePanel = ({ title, icon, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = (0, import_react.useState)(defaultOpen);
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      onClick: () => setOpen(!open),
      "aria-expanded": open,
      className: "w-full flex items-center gap-2 px-5 py-2 bg-black border-l-4 border-red-600 text-left hover:bg-gray-900 transition-colors"
    },
    import_react.default.createElement(icon, { size: 13, className: "text-red-600 shrink-0" }),
    /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] font-black uppercase tracking-[3px] text-white" }, title),
    !open && summary && /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] font-bold text-gray-500 truncate ml-1" }, summary),
    /* @__PURE__ */ import_react.default.createElement(
      import_lucide_react.ChevronDown,
      {
        size: 15,
        className: `ml-auto shrink-0 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`
      }
    )
  ), open && /* @__PURE__ */ import_react.default.createElement("div", { className: "p-5" }, children));
};
const ProfilePanel = ({ profile, applicability, onSave, busy, defaultOpen = false }) => {
  const [draft, setDraft] = (0, import_react.useState)(null);
  const p = draft || profile || {};
  const set = (k) => (e) => setDraft({ ...p, [k]: e.target.value });
  const missing = applicability?.missing_profile_facts ?? [];
  const summary = missing.length > 0 ? `${missing.length} field(s) still unknown` : "complete";
  return /* @__PURE__ */ import_react.default.createElement(CollapsiblePanel, { title: "Taxpayer profile", icon: import_lucide_react.IdCard, summary, defaultOpen }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center justify-end mb-3" }, /* @__PURE__ */ import_react.default.createElement(import_ProtectedAction.default, { routeName: "tax_compliance", fallback: null }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: () => onSave(draft || profile),
      disabled: busy,
      className: "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-black disabled:opacity-50 transition-colors"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Save, { size: 13 }),
    "Save profile"
  ))), /* @__PURE__ */ import_react.default.createElement("div", { className: "space-y-4" }, missing.length > 0 && /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[12px] font-medium bg-amber-50 text-amber-900 border-l-4 border-amber-500 rounded-r-lg px-3 py-2" }, "Still unknown: ", /* @__PURE__ */ import_react.default.createElement("strong", null, missing.join(", ")), ". Forms that depend on these stay unclassified until you confirm them."), /* @__PURE__ */ import_react.default.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" }, [
    ["tin", "TIN", "text"],
    ["legal_name", "Registered name", "text"],
    ["rdo_code", "RDO code", "text"],
    ["taxpayer_type", "Taxpayer type", "text"],
    ["registered_address", "Registered address", "text"]
  ].map(([key, label, type]) => /* @__PURE__ */ import_react.default.createElement("label", { key, className: "block" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[9px] font-black uppercase tracking-[2px] text-gray-400" }, label), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type,
      value: p[key] ?? "",
      onChange: set(key),
      placeholder: "not set",
      className: "mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-black focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
    }
  ))), [
    ["vat_registered", "VAT registered"],
    ["subject_to_income_tax", "Subject to income tax"],
    ["ewt_remitter", "EWT remitter"]
  ].map(([key, label]) => /* @__PURE__ */ import_react.default.createElement("label", { key, className: "flex items-center gap-2 text-[13px] font-bold text-gray-800" }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: p[key] === true,
      onChange: (e) => setDraft({ ...p, [key]: e.target.checked }),
      className: "rounded border-gray-300 accent-red-600"
    }
  ), label))), applicability?.conflicts?.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "space-y-2" }, applicability.conflicts.map((c) => /* @__PURE__ */ import_react.default.createElement(
    "p",
    {
      key: c.id,
      className: "text-[12px] font-medium bg-amber-50 text-amber-900 border-l-4 border-amber-500 rounded-r-lg px-3 py-2 flex gap-2"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.AlertTriangle, { size: 15, className: "shrink-0 mt-0.5 text-amber-600" }),
    /* @__PURE__ */ import_react.default.createElement("span", null, c.message)
  )))));
};
const DeadlinesPanel = ({ deadlines, defaultOpen = false }) => {
  const rows = deadlines?.deadlines ?? [];
  if (rows.length === 0) return null;
  const soonest = [...rows].sort(
    (a, b) => new Date(a.deadline.due_date || 0) - new Date(b.deadline.due_date || 0)
  )[0];
  const summary = soonest ? `${rows.length} due \xB7 next ${soonest.form_code} ${soonest.deadline.due_label}` : `${rows.length} due`;
  return /* @__PURE__ */ import_react.default.createElement(CollapsiblePanel, { title: "Filing deadlines", icon: import_lucide_react.CalendarClock, summary, defaultOpen }, /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-2" }, "for ", deadlines?.year, deadlines?.month ? `, month ${deadlines.month}` : ""), /* @__PURE__ */ import_react.default.createElement("div", null, rows.map((d) => /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      key: d.form_code,
      className: "flex items-center justify-between py-1.5 px-2 -mx-2 rounded border-b border-gray-100 last:border-0 hover:bg-red-50 transition-colors"
    },
    /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-baseline gap-1.5 min-w-0" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "font-mono text-[11px] font-bold text-gray-400" }, d.form_code), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[12px] font-bold text-black truncate" }, d.short_title), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[9px] font-black uppercase tracking-widest text-gray-400" }, d.period_label)),
    /* @__PURE__ */ import_react.default.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[12px] font-black text-red-600 leading-tight" }, d.deadline.due_label), (() => {
      const due = /* @__PURE__ */ new Date(`${d.deadline.due_date}T00:00:00`);
      if (Number.isNaN(due.getTime())) return null;
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const days = Math.round((due - today) / 864e5);
      if (days > 0) {
        return /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest text-gray-400" }, "in ", days, " day", days === 1 ? "" : "s");
      }
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest text-red-700" }, days === 0 ? "due today" : `${Math.abs(days)} days overdue`);
    })(), d.deadline.grace_applied && /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[9px] font-black uppercase tracking-widest text-gray-400" }, "grace rule applied"))
  ))));
};
const FormViewer = ({
  formDetail,
  layout,
  preview,
  inputs,
  setInputs,
  readOnly,
  formatPHP
}) => {
  const values = preview?.result?.lines ?? {};
  const gapKeys = new Set((preview?.result?.gaps ?? []).map((g) => g.key));
  const period = preview?.period ?? null;
  const ledgerHref = (accountCode) => {
    const params = new URLSearchParams();
    if (accountCode) params.set("account_code", accountCode);
    const start = period?.start ?? period?.period_start ?? period?.start_date;
    const end = period?.end ?? period?.period_end ?? period?.end_date;
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    return `/general-ledger?${params.toString()}`;
  };
  const traceFor = (source) => preview?.result?.trace?.[source] ?? null;
  const figureHref = (accounts) => ledgerHref(accounts.length === 1 ? accounts[0].code : null);
  const figureTitle = (accounts) => accounts.length === 1 ? `View ${accounts[0].code} ${accounts[0].name} in the general ledger` : `View the ${accounts.length} accounts behind this figure in the general ledger`;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 px-5 py-2 bg-black border-b border-gray-100" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.FileCheck2, { size: 13, className: "text-red-600" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "font-mono text-[11px] font-black text-white" }, formDetail.form_code), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[11px] font-black uppercase tracking-[3px] text-white truncate" }, formDetail.short_title || formDetail.title), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] font-bold text-gray-500 ml-1 hidden sm:inline" }, String(formDetail.frequency || "").toLowerCase(), " \xB7 rev ", formDetail.form_revision), preview?.period && /* @__PURE__ */ import_react.default.createElement("span", { className: "ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-600 text-white rounded-md whitespace-nowrap" }, preview.period.label, " \xB7 ", preview.period.start, " \u2192 ", preview.period.end)), layout.headerFields.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "px-5 py-2.5 bg-gray-50 border-b border-gray-100" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5" }, layout.headerFields.map((f) => /* @__PURE__ */ import_react.default.createElement("div", { key: f.key, className: "flex items-baseline gap-1.5 min-w-0" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[9px] font-black uppercase tracking-[1.5px] text-gray-400 whitespace-nowrap" }, f.label), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[12px] font-bold text-black truncate" }, formDetail[f.key] ?? formDetail.header_values?.[f.key] ?? "\u2014"))))), /* @__PURE__ */ import_react.default.createElement("div", null, layout.sections.map((section) => /* @__PURE__ */ import_react.default.createElement("div", { key: section.name }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 px-5 py-1.5 bg-black border-l-4 border-red-600" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] font-black uppercase tracking-[3px] text-white" }, "Section ", section.name)), section.lines.map((line) => {
    const value = values[line.key];
    const editable = line.kind === "input" && !readOnly;
    const trace = traceFor(line.source);
    const accounts = trace?.accounts ?? [];
    const hasValue = value !== void 0 && value !== null;
    const linkable = hasValue && !editable && accounts.length > 0;
    return /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        key: line.key,
        title: line.source ? `Computed from ${line.source}` : void 0,
        className: `px-5 py-1.5 flex items-center justify-between gap-4 border-b border-gray-100 leading-tight transition-colors ${line.emphasis ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-red-50"}`
      },
      /* @__PURE__ */ import_react.default.createElement("div", { className: "flex-1 min-w-0 flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ import_react.default.createElement(
        "span",
        {
          className: `text-[12px] font-bold ${line.emphasis ? "text-black" : "text-gray-800"}`
        },
        line.label
      ), linkable && accounts.length > 1 && /* @__PURE__ */ import_react.default.createElement("span", { className: "flex flex-wrap items-center gap-0.5" }, accounts.map((account) => /* @__PURE__ */ import_react.default.createElement(
        "a",
        {
          key: account.code,
          href: ledgerHref(account.code),
          title: `View ${account.code} ${account.name} in the general ledger`,
          className: "inline-flex items-center gap-0.5 rounded-sm border border-gray-200 bg-white px-1 py-px font-mono text-[9px] font-bold text-gray-400 no-underline leading-tight hover:border-red-600 hover:text-red-600"
        },
        account.code,
        /* @__PURE__ */ import_react.default.createElement(import_lucide_react.ArrowUpRight, { size: 8, className: "text-gray-300" })
      ))), line.gap_key && gapKeys.has(line.gap_key) && /* @__PURE__ */ import_react.default.createElement("span", { className: "inline-block px-1.5 py-px bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-widest rounded" }, "needs a fact")),
      /* @__PURE__ */ import_react.default.createElement("div", { className: "w-32 shrink-0 text-right" }, editable ? /* @__PURE__ */ import_react.default.createElement(
        "input",
        {
          type: "number",
          step: "0.01",
          value: inputs[line.key] ?? "",
          placeholder: "0.00",
          onChange: (e) => setInputs({
            ...inputs,
            [line.key]: e.target.value === "" ? "" : Number(e.target.value)
          }),
          className: "w-full rounded-md border border-gray-200 px-1.5 py-1 text-right font-mono text-[13px] font-black text-black focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
        }
      ) : linkable ? /* @__PURE__ */ import_react.default.createElement(
        "a",
        {
          href: figureHref(accounts),
          title: figureTitle(accounts),
          className: `group inline-flex items-center justify-end gap-1 rounded px-1.5 py-0.5 font-mono text-[13px] font-black no-underline leading-tight hover:bg-red-50 hover:text-red-600 hover:underline transition-colors ${line.emphasis ? "text-red-600" : "text-black"}`
        },
        formatPHP(value),
        /* @__PURE__ */ import_react.default.createElement(
          import_lucide_react.ArrowUpRight,
          {
            size: 10,
            className: "text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          }
        )
      ) : /* @__PURE__ */ import_react.default.createElement(
        "span",
        {
          className: `font-mono text-[13px] font-black leading-tight ${hasValue ? line.emphasis ? "text-red-600" : "text-black" : "text-gray-200"}`
        },
        hasValue ? formatPHP(value) : "\u2014"
      ))
    );
  })))), preview?.result?.totals && /* @__PURE__ */ import_react.default.createElement("div", { className: "border-t-4 border-red-600 bg-black px-5 py-2.5 flex flex-wrap gap-x-8 gap-y-1" }, Object.entries(preview.result.totals).map(([k, v]) => /* @__PURE__ */ import_react.default.createElement("div", { key: k, className: "flex items-baseline gap-2" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[9px] font-black uppercase tracking-[2px] text-gray-500" }, k.replace(/_/g, " ")), /* @__PURE__ */ import_react.default.createElement("span", { className: "font-mono text-[15px] font-black text-white leading-tight" }, formatPHP(v))))), preview?.result?.gaps?.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "px-5 py-2.5 bg-gray-50 border-t border-gray-100 space-y-1.5" }, /* @__PURE__ */ import_react.default.createElement("h4", { className: "text-[10px] font-black uppercase tracking-[3px] text-gray-400" }, "Open items"), preview.result.gaps.map((g) => /* @__PURE__ */ import_react.default.createElement(
    "p",
    {
      key: g.key,
      className: `text-[11px] font-medium rounded px-2.5 py-1.5 border-l-4 ${g.severity === "info" ? "bg-white text-gray-600 border-gray-300" : "bg-amber-50 text-amber-900 border-amber-500"}`
    },
    g.message
  ))), layout.notes && /* @__PURE__ */ import_react.default.createElement("p", { className: "px-5 py-2 bg-gray-50 border-t border-gray-100 text-[11px font-medium text-gray-500 flex gap-2" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Info, { size: 13, className: "shrink-0 mt-0.5 text-red-600" }), /* @__PURE__ */ import_react.default.createElement("span", null, layout.notes)));
};
const FilingsPanel = ({
  filings,
  filingsActive,
  onAcknowledge,
  onMarkFiled,
  busy,
  monthDay,
  formatPHP
}) => {
  const [note, setNote] = (0, import_react.useState)("");
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 px-5 py-2 bg-black border-l-4 border-red-600" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.FileCheck2, { size: 14, className: "text-red-600" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[11px] font-black uppercase tracking-[3px] text-white truncate" }, "Filings for ", formCodeOf(filingsActive)), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-[10px] font-bold text-gray-500 ml-1" }, filings.length, " on record")), /* @__PURE__ */ import_react.default.createElement("div", { className: "p-5" }, filings.length === 0 ? /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[12px] font-bold text-gray-300" }, "No filings yet for this form.") : /* @__PURE__ */ import_react.default.createElement("div", null, filings.map((f) => /* @__PURE__ */ import_react.default.createElement(
    "div",
    {
      key: f.id,
      className: "py-1.5 flex items-center justify-between gap-3 border-b border-gray-100 hover:bg-red-50 transition-colors"
    },
    /* @__PURE__ */ import_react.default.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[13px] font-black text-black" }, f.period_label), /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[10px] font-black uppercase tracking-widest text-gray-400" }, monthDay(f.period_start), " \u2013 ", monthDay(f.period_end))),
    /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "font-mono text-[15px] font-black text-red-600" }, formatPHP(f.amount_still_due)), /* @__PURE__ */ import_react.default.createElement(
      "span",
      {
        className: `text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${FILING_STATUS_STYLE[f.status] || FILING_STATUS_STYLE.draft}`
      },
      String(f.status).replace(/_/g, " ")
    ))
  ))), filingsActive && /* @__PURE__ */ import_react.default.createElement("div", { className: "mt-4 pt-4 border-t border-gray-100 space-y-3" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "text-[12px] font-medium text-gray-600" }, "Filing ", /* @__PURE__ */ import_react.default.createElement("strong", { className: "font-black text-black" }, "#", filingsActive.id), " \u2014", " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "font-black uppercase tracking-widest text-gray-800" }, filingsActive.status.replace(/_/g, " ")), filingsActive.acknowledgement_note && /* @__PURE__ */ import_react.default.createElement("span", { className: "block text-[11px] text-gray-400 mt-1" }, "note: ", filingsActive.acknowledgement_note)), filingsActive.has_blocking_gaps && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
    "textarea",
    {
      value: note,
      onChange: (e) => setNote(e.target.value),
      rows: 2,
      placeholder: "Why is this acceptable? Acknowledging records your name and note.",
      className: "w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
    }
  ), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: () => onAcknowledge(filingsActive.id, note),
      disabled: busy || !note.trim(),
      className: "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-black disabled:opacity-50 transition-colors"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.CheckCircle2, { size: 13 }),
    "Acknowledge open items"
  )), !filingsActive.has_blocking_gaps && !["filed", "filed_with_bir"].includes(filingsActive.status) && /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: () => onMarkFiled(filingsActive.id),
      disabled: busy,
      className: "inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-black text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.FileCheck2, { size: 13 }),
    "Mark as filed with BIR"
  ), ["filed", "filed_with_bir"].includes(filingsActive.status) && /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[11px] font-medium text-gray-400 flex items-center gap-1.5" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.ShieldCheck, { size: 13, className: "text-red-600" }), "Filed ", monthDay(filingsActive.filed_at), ". A filed return is immutable and cannot be recomputed."))));
};
const formCodeLabel = (code) => code ? code : "this form";
const formCodeOf = (filing) => formCodeLabel(filing && filing.form_code);
function TaxRegistryContent() {
  const t = (0, import_useTaxRegistry.default)();
  const {
    companyId,
    companyName,
    registry,
    applicability,
    profile,
    deadlines,
    filings,
    filingDetail,
    activeForm,
    setActiveForm,
    formDetail,
    layout,
    resultByForm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    inputs,
    setInputs,
    preview,
    loading,
    busy,
    toast,
    setToast,
    runPreview,
    saveFiling,
    refreshFiling,
    acknowledge,
    markFiled,
    saveProfile,
    exportPdf
  } = t;
  const [tab, setTab] = (0, import_react.useState)("computation");
  if (loading) return /* @__PURE__ */ import_react.default.createElement(import_LoadingScreen.default, { label: "Loading tax registry..." });
  const forms = registry?.forms ?? [];
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    forms: forms.filter((f) => f.category === cat)
  })).filter((g) => g.forms.length > 0);
  const filingsActive = filingDetail?.filing ?? null;
  const filingsForForm = filings.filter((f) => f.form_code === activeForm);
  const activeResult = resultByForm.get(activeForm);
  const activeCategory = byCategory.find((g) => g.forms.some((f) => f.form_code === activeForm))?.cat ?? "registry";
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, toast && /* @__PURE__ */ import_react.default.createElement(
    import_DynamicToast.default,
    {
      type: toast.type,
      message: toast.message,
      onClose: () => setToast(null)
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { className: "flex h-full -m-4 overflow-hidden bg-slate-50" }, /* @__PURE__ */ import_react.default.createElement(
    RegistrySidebar,
    {
      byCategory,
      totalForms: forms.length,
      activeForm,
      onSelect: (code) => {
        setActiveForm(code);
        setTab("computation");
      },
      resultByForm
    }
  ), /* @__PURE__ */ import_react.default.createElement("main", { className: "flex-1 flex flex-col min-w-0 overflow-hidden" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white border-b border-slate-200 p-4 shadow-sm" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 text-xs text-slate-500 mb-1" }, /* @__PURE__ */ import_react.default.createElement("span", null, "Tax Registry"), /* @__PURE__ */ import_react.default.createElement(import_lucide_react.ChevronDown, { size: 10, className: "-rotate-90" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "uppercase font-semibold text-brand-red" }, activeCategory), /* @__PURE__ */ import_react.default.createElement(import_lucide_react.ChevronDown, { size: 10, className: "-rotate-90" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "font-mono font-bold text-slate-700" }, activeForm)), /* @__PURE__ */ import_react.default.createElement("h1", { className: "text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "truncate" }, formDetail?.short_title || formDetail?.title || "\u2014"), formDetail && /* @__PURE__ */ import_react.default.createElement("span", { className: "text-xs font-normal bg-zinc-900 text-white px-2 py-0.5 rounded font-mono" }, "BIR FORM ", formDetail.form_code))), /* @__PURE__ */ import_react.default.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Building2, { size: 12, className: "text-brand-red shrink-0" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-xs font-semibold text-slate-500 uppercase" }, "Company"), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-xs font-semibold text-slate-800" }, companyName || `Company ${companyId}`)), /* @__PURE__ */ import_react.default.createElement("div", { className: "flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5" }, /* @__PURE__ */ import_react.default.createElement(import_lucide_react.CalendarClock, { size: 12, className: "text-brand-red" }), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-xs font-semibold text-slate-500 uppercase" }, "Period"), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "date",
      value: startDate,
      onChange: (e) => setStartDate(e.target.value),
      className: "bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none cursor-pointer"
    }
  ), /* @__PURE__ */ import_react.default.createElement("span", { className: "text-xs font-semibold text-slate-400" }, "to"), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "date",
      value: endDate,
      onChange: (e) => setEndDate(e.target.value),
      className: "bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none cursor-pointer"
    }
  )), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: runPreview,
      disabled: busy,
      title: "Recompute this form from the ledger for the chosen period",
      className: "bg-brand-red hover:bg-brand-red-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
    },
    busy ? /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Loader2, { size: 12, className: "animate-spin" }) : /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Calculator, { size: 12 }),
    /* @__PURE__ */ import_react.default.createElement("span", null, busy ? "Computing" : "Compute")
  ), /* @__PURE__ */ import_react.default.createElement(import_ProtectedAction.default, { routeName: "tax_compliance", fallback: null }, /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: saveFiling,
      disabled: busy,
      className: "bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition border border-zinc-800 disabled:opacity-50"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Save, { size: 12 }),
    /* @__PURE__ */ import_react.default.createElement("span", null, "Save as draft")
  )), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      onClick: exportPdf,
      disabled: busy,
      className: "bg-white text-slate-700 hover:bg-slate-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-2 transition disabled:opacity-50"
    },
    /* @__PURE__ */ import_react.default.createElement(import_lucide_react.Download, { size: 12, className: "text-brand-red" }),
    /* @__PURE__ */ import_react.default.createElement("span", null, "Export PDF")
  ), filingsForForm.length > 0 && /* @__PURE__ */ import_react.default.createElement(
    "select",
    {
      value: filingsActive?.id ?? "",
      onChange: (e) => refreshFiling(Number(e.target.value)),
      className: "text-xs font-semibold rounded-lg border border-slate-300 bg-white px-2 py-2 text-slate-700 focus:outline-none focus:border-brand-red"
    },
    /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, "View a saved filing\u2026"),
    filingsForForm.map((f) => /* @__PURE__ */ import_react.default.createElement("option", { key: f.id, value: f.id }, "#", f.id, " ", f.period_label, " (", f.status, ")"))
  )))), /* @__PURE__ */ import_react.default.createElement("div", { className: "flex-1 overflow-y-auto p-4 space-y-6 tax-scroll" }, /* @__PURE__ */ import_react.default.createElement(
    ProfilePrompt,
    {
      missing: applicability?.missing_profile_facts,
      onOpen: () => setTab("profile")
    }
  ), /* @__PURE__ */ import_react.default.createElement(
    StatusBanner,
    {
      formDetail,
      status: activeResult?.status,
      reason: activeResult?.reason,
      conflict: activeResult?.conflict?.message,
      preview,
      gapCount: preview?.result?.gaps?.length ?? 0
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { className: "flex border-b border-slate-200 space-x-2 overflow-x-auto" }, [
    ["computation", import_lucide_react.Calculator, "Tax Computation Engine"],
    ["profile", import_lucide_react.IdCard, "Taxpayer Profile"],
    ["deadlines", import_lucide_react.CalendarClock, "Filing Deadlines Schedule"],
    ["filings", import_lucide_react.FolderOpen, `Filing History (${filingsForForm.length})`]
  ].map(([id, Icon, label]) => /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      key: id,
      onClick: () => setTab(id),
      "aria-current": tab === id,
      className: `px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${tab === id ? "border-brand-red text-brand-red" : "border-transparent text-slate-500 hover:text-slate-800"}`
    },
    /* @__PURE__ */ import_react.default.createElement(Icon, { size: 12 }),
    /* @__PURE__ */ import_react.default.createElement("span", null, label)
  ))), tab === "computation" && /* @__PURE__ */ import_react.default.createElement("div", { className: "space-y-6" }, formDetail && layout ? preview ? /* @__PURE__ */ import_react.default.createElement(
    FormViewer,
    {
      formDetail,
      layout,
      preview,
      inputs,
      setInputs,
      formatPHP: t.formatPHP
    }
  ) : /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center" }, /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[10px] font-black uppercase tracking-[3px] text-red-600 mb-1" }, "No computation yet"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[13px] font-bold text-gray-400" }, "Choose a period and press ", /* @__PURE__ */ import_react.default.createElement("strong", { className: "text-black" }, "Compute"), " to fill this form. Computing does not save anything.")) : /* @__PURE__ */ import_react.default.createElement("div", { className: "bg-white rounded-xl border border-slate-200 p-8 text-center" }, /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[10px] font-bold uppercase tracking-widest text-brand-red mb-1" }, "Pick a form"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-xs text-slate-500" }, "Choose a BIR return from the registry to begin."))), tab === "profile" && /* @__PURE__ */ import_react.default.createElement(
    ProfilePanel,
    {
      profile,
      applicability,
      onSave: saveProfile,
      busy,
      defaultOpen: true
    }
  ), tab === "deadlines" && /* @__PURE__ */ import_react.default.createElement(DeadlinesPanel, { deadlines, defaultOpen: true }), tab === "filings" && /* @__PURE__ */ import_react.default.createElement("div", { className: "space-y-6" }, filingsActive && /* @__PURE__ */ import_react.default.createElement(
    CollapsiblePanel,
    {
      title: `Filing #${filingsActive.id} \u2014 as filed`,
      icon: import_lucide_react.FileCheck2,
      defaultOpen: true,
      summary: `${String(filingsActive.status).replace(/_/g, " ")} \xB7 due ${t.formatPHP(filingsActive.amount_still_due)}`
    },
    /* @__PURE__ */ import_react.default.createElement("div", null, (filingsActive.lines ?? []).map((line) => /* @__PURE__ */ import_react.default.createElement(
      "div",
      {
        key: line.id,
        className: `py-1 flex justify-between border-b border-gray-100 last:border-0 ${line.emphasis ? "bg-red-50 -mx-2 px-2" : ""}`
      },
      /* @__PURE__ */ import_react.default.createElement(
        "span",
        {
          className: `text-[12px] ${line.emphasis ? "font-black text-black" : "font-bold text-gray-700"}`
        },
        line.label
      ),
      /* @__PURE__ */ import_react.default.createElement(
        "span",
        {
          className: `font-mono ${line.emphasis ? "text-[13px] font-black text-red-600" : "text-[13px] font-black text-black"}`
        },
        t.formatPHP(line.value)
      )
    ))),
    filingsActive.is_override && /* @__PURE__ */ import_react.default.createElement("p", { className: "text-[10px] font-black uppercase tracking-widest text-amber-600 mt-2" }, "Includes at least one manual override")
  ), /* @__PURE__ */ import_react.default.createElement(
    FilingsPanel,
    {
      filings: filingsForForm,
      filingsActive,
      onAcknowledge: acknowledge,
      onMarkFiled: markFiled,
      busy,
      monthDay: t.monthDay,
      formatPHP: t.formatPHP
    }
  ))))));
}
function TaxRegistry() {
  return /* @__PURE__ */ import_react.default.createElement(Boundary, null, /* @__PURE__ */ import_react.default.createElement(import_ProtectedAction.default, { routeName: "tax_compliance", fallback: null }, /* @__PURE__ */ import_react.default.createElement(TaxRegistryContent, null)));
}
