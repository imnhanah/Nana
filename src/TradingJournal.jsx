import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from "recharts";
import {
  LayoutGrid, FileText, BarChart2, Calendar as CalendarIcon, Brain,
  Lightbulb, Newspaper, ListChecks, Settings, LogOut, Plus, X, Star,
  ChevronLeft, ChevronRight, Trash2, Pencil, Menu, Search, ChevronDown,
  ChevronUp, Trophy, Key, DollarSign, ShieldCheck, Satellite, Snowflake,
  ImagePlus, ClipboardCheck, ScanLine, CheckCircle2,
} from "lucide-react";
import AuthPage from "./AuthPage";
import ResetPasswordForm from "./ResetPasswordForm";
import logoUrl from "./assets/aaicorefx-logo.png";
import { supabase } from "./supabaseClient";
import { onAuthStateChange, getSession, signOut } from "./auth";
import { getCalendarWeek } from "./forexFactory";
import {
  fetchAllUserData, createAccount, updateAccount, deleteAccount, resetAccountData,
  createTrade, updateTrade, deleteTrade, createRule, updateRule, deleteRule, setCheckin,
  saveTypeTags, saveManagedLists, createMarkup, updateMarkup, deleteMarkup, saveTradeReview, hasMigratedLocalData, markLocalDataMigrated, importLegacyAccount,
} from "./db";

/* ----------------------------- constants ----------------------------- */

const SESSIONS = ["Asia", "London", "NY AM", "NY PM"];
const MOODS = ["Confident", "Neutral", "Fear", "FOMO", "Revenge", "Disciplined", "Anxious", "Excited"];
const DEFAULT_TYPE_TAGS = ["PDRR", "Breakout", "Reversal", "Trend", "Scalp", "Swing", "News Play"];
const DEFAULT_MISTAKE_TAGS = ["Overtrading", "Early Exit", "No Stop Loss", "Revenge Trade", "FOMO Entry",
  "Sized Too Big", "Sized Too Low", "Missed Entry", "Moved Stop", "Chased Entry", "Ignored Rules", "Bad Timing"];
const DEFAULT_INSTRUMENTS = [
  "AUD/USD", "EUR/USD", "GBP/USD", "GBPJPY", "NZD/USD", "USD/CAD", "USD/CHF", "USD/JPY",
  "XAU/USD", "XAG/USD", "WTI/USD", "US500", "US100", "US30", "BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD",
];
const MARKUP_BIASES = ["Bullish", "Bearish", "Neutral"];
const ACCOUNT_ICONS = ["🦈", "🏆", "🚀", "🔥", "🐂", "💎", "⚡", "🎯"];
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "markups", label: "Premarket Markups", icon: ScanLine },
  { id: "tradelog", label: "Trade Logs", icon: FileText },
  { id: "reviews", label: "Trade Review", icon: ClipboardCheck },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "psychology", label: "Psychology", icon: Brain },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "rules", label: "Rules", icon: ListChecks },
  { id: "news", label: "News", icon: Newspaper },
  { id: "management", label: "Management", icon: Settings },
];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const formatTime = (time) => {
  if (!time) return "Time not set";
  const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "Time not set";
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
};
const fmtMoney = (n) => {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtMoneyShort = (n) => {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = (v, max) => clamp((v / max) * 100, 0, 100);
const classify = (pnl, cap) => (Math.abs(pnl) <= cap ? "be" : pnl > 0 ? "win" : "loss");
const clsColor = (cls) => (cls === "win" ? "tj-green" : cls === "loss" ? "tj-red" : "tj-blue");
// Win-rate color system: >50% green, 30-50% yellow, <30% red — applied
// consistently to every win-rate percentage and its associated bar/ring.
const wrColorClass = (wr) => (wr > 50 ? "tj-green" : wr >= 30 ? "tj-wr-yellow" : "tj-red");
const wrBarClass = (wr) => (wr > 50 ? "tj-bar-green" : wr >= 30 ? "tj-bar-yellow" : "tj-bar-red");
const UI_COLORS = { primary: "var(--tj-green)", danger: "var(--tj-red)", warning: "var(--tj-amber)", info: "var(--tj-blue)", purple: "var(--tj-purple)" };
const CHART_TICK = { fill: "var(--tj-chart-text)", fontSize: 11 };
const CHART_TOOLTIP_STYLE = { background: "var(--tj-tooltip-bg)", color: "var(--tj-text)", border: "1px solid var(--tj-border)", borderRadius: 8, fontSize: 12, boxShadow: "var(--tj-shadow)" };
const wrHex = (wr) => (wr > 50 ? UI_COLORS.primary : wr >= 30 ? UI_COLORS.warning : UI_COLORS.danger);

/* ------------------------------ seed data ----------------------------- */
/* Exact dataset so every derived stat (totals, tag %, session P&L, day
   score, emotion win-rates) matches the reference screenshots 1:1.       */

/* ---------------------------- stats engine ---------------------------- */

function computeStats(trades, cap = 0) {
  const sorted = [...trades].sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = sorted.length;
  const wins = sorted.filter((t) => classify(t.pnl, cap) === "win");
  const losses = sorted.filter((t) => classify(t.pnl, cap) === "loss");
  const be = sorted.filter((t) => classify(t.pnl, cap) === "be");
  const netPnl = sorted.reduce((s, t) => s + t.pnl, 0);
  const winRate = total ? (wins.length / total) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const avgWinLoss = avgLoss ? avgWin / avgLoss : avgWin > 0 ? 3 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const grossPnl = sorted.reduce((s, t) => s + Number(t.grossPnl ?? t.pnl), 0);
  const totalCommission = sorted.reduce((s, t) => s + Number(t.commission || 0), 0);
  const totalSwap = sorted.reduce((s, t) => s + Number(t.swap || 0), 0);
  const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 3 : 0;

  // streak + best runs (trade-level)
  let streak = 0, streakType = null, bestWinStreak = 0, bestLossStreak = 0, run = 0, runType = null;
  sorted.forEach((t) => {
    const type = classify(t.pnl, cap);
    if (type === runType) run++;
    else { run = 1; runType = type; }
    if (type === "win") bestWinStreak = Math.max(bestWinStreak, run);
    if (type === "loss") bestLossStreak = Math.max(bestLossStreak, run);
  });
  for (let i = sorted.length - 1; i >= 0; i--) {
    const type = classify(sorted[i].pnl, cap);
    if (streakType === null) { streakType = type; streak = type === "be" ? 0 : 1; if (type === "be") break; }
    else if (type === streakType) streak++;
    else break;
  }

  const mean = total ? netPnl / total : 0;
  const variance = total ? sorted.reduce((s, t) => s + Math.pow(t.pnl - mean, 2), 0) / total : 0;
  const consistency = total ? clamp(100 - (Math.sqrt(variance) / (Math.abs(mean) || 1)) * 18, 0, 100) : 0;

  let afterLossTotal = 0, afterLossWins = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (classify(sorted[i - 1].pnl, cap) === "loss") {
      afterLossTotal++;
      if (classify(sorted[i].pnl, cap) === "win") afterLossWins++;
    }
  }
  const recovery = afterLossTotal ? (afterLossWins / afterLossTotal) * 100 : 50;

  const thunderScore = Math.round(
    winRate * 0.3 + norm(profitFactor, 3) * 0.25 + norm(avgWinLoss, 3) * 0.15 +
    consistency * 0.15 + recovery * 0.15
  );

  const byDay = {};
  sorted.forEach((t) => { byDay[t.date] = (byDay[t.date] || 0) + t.pnl; });
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1));
  const dayClasses = dayEntries.map(([date, pnl]) => ({ date, pnl, cls: classify(pnl, cap) }));
  const dayWinRate = dayClasses.length ? (dayClasses.filter((d) => d.cls === "win").length / dayClasses.length) * 100 : 0;

  return {
    total, wins: wins.length, losses: losses.length, be: be.length, netPnl, winRate, avgWin, avgLoss,
    avgWinLoss, profitFactor, streak, streakType, bestWinStreak, bestLossStreak, consistency, recovery,
    thunderScore, sorted, byDay, dayClasses, dayWinRate, grossPnl, grossProfit, totalCommission, totalSwap,
  };
}

/* ------------------------------ calendar ------------------------------ */

function groupByDay(trades, cap) {
  const map = {};
  trades.forEach((t) => {
    if (!map[t.date]) map[t.date] = { pnl: 0, count: 0 };
    map[t.date].pnl += t.pnl;
    map[t.date].count += 1;
  });
  Object.keys(map).forEach((k) => { map[k].cls = classify(map[k].pnl, cap); });
  return map;
}

function buildMonthGrid(year, month, byDay) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const info = byDay[iso];
    cells.push({ day: d, iso, pnl: info?.pnl || 0, count: info?.count || 0, cls: info?.cls });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function computeWeeklyBreakdown(trades, year, month, cap) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const weeksMap = {};
  trades.filter((t) => t.date.slice(0, 7) === monthKey).forEach((t) => {
    const d = new Date(t.date + "T00:00:00");
    const sunday = new Date(d); sunday.setDate(d.getDate() - d.getDay());
    const key = sunday.toISOString().slice(0, 10);
    (weeksMap[key] = weeksMap[key] || []).push(t);
  });
  return Object.entries(weeksMap).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, ts]) => {
    const sunday = new Date(key + "T00:00:00");
    const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
    const pnl = ts.reduce((s, t) => s + t.pnl, 0);
    const wins = ts.filter((t) => classify(t.pnl, cap) === "win").length;
    const winRate = ts.length ? (wins / ts.length) * 100 : 0;
    return {
      label: `${sunday.getDate()}-${saturday.getDate()} ${MONTH_ABBR[sunday.getMonth()]}`,
      pnl, winRate, count: ts.length,
    };
  });
}

/* ============================= UI PRIMITIVES =========================== */

function Card({ children, style, className = "" }) {
  return <div className={`tj-card ${className}`} style={style}>{children}</div>;
}

function MultiRing({ segments, size = 64 }) {
  const r = 26, c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--tj-border)" strokeWidth="6" />
      {segments.map((seg, i) => {
        if (seg.value <= 0) return null;
        const len = (seg.value / total) * c;
        const el = (
          <circle key={i} cx="32" cy="32" r={r} fill="none" stroke={seg.color} strokeWidth="6"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt"
            transform="rotate(-90 32 32)" />
        );
        acc += len;
        return el;
      })}
    </svg>
  );
}

function StatCard({ label, children }) {
  return (
    <Card className="tj-stat">
      <div className="tj-stat-label">{label}</div>
      {children}
    </Card>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="tj-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`tj-modal ${wide ? "tj-modal-wide" : ""}`}>
        <div className="tj-modal-head">
          <div className="tj-modal-title">{title}</div>
          <button className="tj-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="tj-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="tj-field"><div className="tj-field-label">{label}</div>{children}</div>;
}

function TagPicker({ options, selected, onToggle, color = "purple" }) {
  return (
    <div className="tj-tagwrap">
      {options.map((opt) => (
        <button key={opt} type="button"
          className={`tj-tag tj-tag-${color} ${selected.includes(opt) ? "tj-tag-active" : ""}`}
          onClick={() => onToggle(opt)}>{opt}</button>
      ))}
    </div>
  );
}

function Stars({ value, onChange }) {
  return (
    <div className="tj-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={20} fill={n <= value ? "#FBBF24" : "none"}
          stroke={n <= value ? "#FBBF24" : "var(--tj-muted)"} onClick={() => onChange(n)} style={{ cursor: "pointer" }} />
      ))}
      <span className="tj-stars-label">{value ? `${value}/5` : "Not rated"}</span>
    </div>
  );
}

const GRADE_LABELS = ["C-", "C", "B", "A", "A+"];
const GRADE_COLORS = [UI_COLORS.danger, UI_COLORS.warning, UI_COLORS.info, UI_COLORS.primary, UI_COLORS.primary];

function GradeRating({ value, onChange, size = "md" }) {
  return (
    <div className={`tj-grades tj-grades-${size}`}>
      {GRADE_LABELS.map((label, i) => {
        const tier = i + 1;
        const achieved = tier <= value;
        return (
          <span key={label}
            className={`tj-grade-pip ${achieved ? "tj-grade-pip-on" : ""}`}
            style={achieved ? { background: `${GRADE_COLORS[i]}26`, color: GRADE_COLORS[i], borderColor: GRADE_COLORS[i] } : {}}
            onClick={onChange ? () => onChange(tier) : undefined}
          >{label}</span>
        );
      })}
    </div>
  );
}

function RatingDisplay({ value = 0, noRules = false, showValue = false }) {
  if (noRules) return <span className="tj-muted-txt">No rules configured</span>;
  const rating = clamp(Number(value) || 0, 0, 5);
  return <span className="tj-rating-readout" aria-label={`${rating.toFixed(2)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => <span key={star} className={rating >= star ? "tj-star-full" : rating >= star - 0.5 ? "tj-star-half" : "tj-star-empty"}>{rating >= star ? "★" : rating >= star - 0.5 ? "◐" : "☆"}</span>)}
    {showValue && <span className="tj-stars-label">{rating.toFixed(2)}/5</span>}
  </span>;
}

function getGrade(winRate, pnl, count) {
  if (!count) return "-";
  if (winRate >= 70 && pnl > 0) return "A+";
  if (winRate >= 60 && pnl > 0) return "A";
  if (winRate >= 50) return "B";
  if (winRate >= 30) return "C";
  return "D";
}

/* ============================ SHARED IMAGE VIEWER ======================= */

const ImageViewerContext = React.createContext(() => {});

function ImageViewer({ src, alt = "Full-size image", onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [src, onClose]);
  if (!src) return null;
  return <div className="tj-image-viewer" role="dialog" aria-modal="true" aria-label={alt} onMouseDown={onClose}>
    <button className="tj-image-viewer-close" aria-label="Close image viewer" onClick={onClose}><X size={20}/></button>
    <img src={src} alt={alt} onMouseDown={(event) => event.stopPropagation()} />
  </div>;
}

function ImagePreview({ src, alt = "Uploaded image", className = "" }) {
  const openImage = React.useContext(ImageViewerContext);
  return <button type="button" className={`tj-image-preview ${className}`} onClick={(event) => { event.stopPropagation(); openImage(src); }} aria-label={`View ${alt}`}><img src={src} alt={alt} /></button>;
}

/* ============================ SCREENSHOT UPLOADER ======================= */

function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ScreenshotUploader({ screenshots, onChange }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    const room = 5 - screenshots.length;
    const list = Array.from(files).slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    for (const f of list) {
      try {
        const dataUrl = await downscaleImage(f);
        onChange((prev) => (prev.length >= 5 ? prev : [...prev, dataUrl]));
      } catch (e) { /* ignore unreadable file */ }
    }
  }, [screenshots.length, onChange]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
      if (items.length) { addFiles(items.map((it) => it.getAsFile())); e.preventDefault(); }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [addFiles]);

  return (
    <div className="tj-field">
      <div className="tj-field-label">Screenshots ({screenshots.length}/5)</div>
      <div
        className={`tj-dropzone ${dragOver ? "tj-dropzone-active" : ""}`}
        onClick={() => screenshots.length < 5 && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        {screenshots.length === 0 ? (
          <>
            <ImagePlus size={20} color="var(--tj-muted)" />
            <div className="tj-dropzone-text">Paste · Drag · Click — {5 - screenshots.length} slots left</div>
          </>
        ) : (
          <div className="tj-shot-grid">
            {screenshots.map((src, i) => (
              <div key={i} className="tj-shot-thumb">
                <ImagePreview src={src} alt={`Screenshot ${i + 1}`} />
                <button type="button" className="tj-shot-remove"
                  onClick={(e) => { e.stopPropagation(); onChange((prev) => prev.filter((_, idx) => idx !== i)); }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {screenshots.length < 5 && (
              <div className="tj-shot-add"><Plus size={16} color="var(--tj-muted)" /></div>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="tj-dropzone-warn">Original images are preserved. Upload only the charts you need.</div>
    </div>
  );
}

/* ============================== NEW TRADE MODAL ========================= */

function NewTradeModal({ onClose, onSave, editing, typeTags, mistakeTags, confluenceSessions, markups, rules, instruments = [], defaultCommission }) {
  const [form, setForm] = useState(() => {
    const base = { id: uid(), date: todayISO(), time: nowTime(), asset: "", direction: "BUY", grossPnl: "", commission: defaultCommission || 0, swap: 0, pnl: "", rr: "", entryType: "", entrySession: SESSIONS[2], session: SESSIONS[2], confluence: [], types: [], mistakes: [], moodBefore: "Neutral", moodAfter: "Neutral", context: "", screenshots: [], premarketMarkupId: null, ruleEvaluations: [] };
    if (!editing) return base;
    return { ...base, ...editing, time: editing.time || nowTime(), entryType: editing.entryType || editing.confluenceSession || "", entrySession: editing.entrySession || editing.session || SESSIONS[2], confluence: editing.confluence || editing.types || [], ruleEvaluations: editing.ruleEvaluations || [] };
  });
  const activeRules = rules.filter((rule) => rule.active);
  const instrumentOptions = useMemo(() => [...DEFAULT_INSTRUMENTS, ...instruments.filter((instrument) => !DEFAULT_INSTRUMENTS.some((preset) => preset.toLowerCase() === instrument.toLowerCase()))], [instruments]);
  const completedRules = activeRules.filter((rule) => form.ruleEvaluations.some((entry) => entry.ruleId === rule.id && entry.checked)).length;
  const calculatedRating = activeRules.length ? (completedRules / activeRules.length) * 5 : 0;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleArr = (key, value) => setForm((current) => ({
    ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
  }));
  const setScreenshots = (updater) => setForm((current) => ({ ...current, screenshots: updater(current.screenshots) }));
  const toggleRule = (rule, checked) => setForm((current) => ({
    ...current,
    ruleEvaluations: [...current.ruleEvaluations.filter((entry) => entry.ruleId !== rule.id), { ruleId: rule.id, name: rule.text, checked }],
  }));
  const save = () => {
    if (!form.asset.trim() || form.grossPnl === "" || !form.time) return;
    const grossPnl = Number(form.grossPnl), commission = Number(form.commission) || 0, swap = Number(form.swap) || 0;
    if (!Number.isFinite(grossPnl)) return;
    onSave({ ...form, session: form.entrySession, types: form.confluence, confluenceSession: form.entryType, grossPnl, commission, swap, pnl: grossPnl - commission - swap, rr: parseFloat(form.rr) || 0, rating: calculatedRating });
  };
  return <Modal title={editing ? "Edit Trade" : "New Trade"} onClose={onClose} wide>
    <div className="tj-section-label">Trade Details</div>
    <div className="tj-grid4">
      <Field label="Instrument *"><input className="tj-input" placeholder="Select or enter an instrument..." value={form.asset} onChange={(event) => set("asset", event.target.value)} list="tj-instrument-list" /><datalist id="tj-instrument-list">{instrumentOptions.map((instrument) => <option key={instrument} value={instrument} />)}</datalist></Field>
      <Field label="Direction"><select className="tj-input" value={form.direction} onChange={(event) => set("direction", event.target.value)}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></Field>
      <Field label="Date"><input type="date" className="tj-input" value={form.date} onChange={(event) => set("date", event.target.value)} /></Field>
      <Field label="Time *"><input type="time" required className="tj-input" value={form.time} onChange={(event) => set("time", event.target.value)} /></Field>
    </div>
    <div className="tj-grid3">
      <Field label="Gross P&L ($) *"><input type="number" className="tj-input" placeholder="-50" value={form.grossPnl} onChange={(event) => set("grossPnl", event.target.value)} /></Field>
      <Field label="Commission ($)"><input type="number" className="tj-input" value={form.commission} onChange={(event) => set("commission", event.target.value)} /></Field>
      <Field label="Swap ($)"><input type="number" className="tj-input" value={form.swap} onChange={(event) => set("swap", event.target.value)} /></Field>
    </div>
    <div className="tj-grid2">
      <Field label="Net P&L ($)"><input className="tj-input" readOnly value={fmtMoney((Number(form.grossPnl) || 0) - (Number(form.commission) || 0) - (Number(form.swap) || 0))} /></Field>
      <Field label="RR"><input type="number" step="0.1" className="tj-input" placeholder="2.5" value={form.rr} onChange={(event) => set("rr", event.target.value)} /></Field>
    </div>
    <div className="tj-section-label">Entry Type &amp; Markup</div>
    <div className="tj-grid2">
      <Field label="Entry Type"><select className="tj-input" value={form.entryType} onChange={(event) => set("entryType", event.target.value)}><option value="">None</option>{confluenceSessions.map((entryType) => <option key={entryType} value={entryType}>{entryType}</option>)}</select></Field>
      <Field label="Markup"><select className="tj-input" value={form.premarketMarkupId || ""} onChange={(event) => set("premarketMarkupId", event.target.value || null)}><option value="">None</option>{markups.map((markup) => <option key={markup.id} value={markup.id}>{markup.date} · {markup.instrument || markup.market || "Untitled"} · {markup.bias || "No bias"}</option>)}</select></Field>
    </div>
    <div className="tj-section-label">Entry Session</div>
    <Field label="Entry Session"><select className="tj-input" value={form.entrySession} onChange={(event) => set("entrySession", event.target.value)}>{SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}</select></Field>
    <div className="tj-section-label">Confluence</div>
    <TagPicker options={typeTags} selected={form.confluence} onToggle={(value) => toggleArr("confluence", value)} color="purple" />
    <div className="tj-section-label">Mistakes</div>
    <TagPicker options={mistakeTags} selected={form.mistakes} onToggle={(value) => toggleArr("mistakes", value)} color="red" />
    <div className="tj-section-label">Rule Evaluation</div>
    {activeRules.length ? <>
      <div className="tj-rating-summary"><div><div className="tj-field-label">Trade Rating</div><RatingDisplay value={calculatedRating} showValue /></div><div className="tj-rating-completion">{completedRules} / {activeRules.length} rules completed</div></div>
      <div className="tj-rule-list">{activeRules.map((rule) => { const current = form.ruleEvaluations.find((entry) => entry.ruleId === rule.id); return <label key={rule.id} className="tj-rule-row"><span>{rule.text}</span><input type="checkbox" checked={!!current?.checked} onChange={(event) => toggleRule(rule, event.target.checked)} /></label>; })}</div>
    </> : <div className="tj-empty">No rules configured. Add rules before logging a rated trade.</div>}
    <div className="tj-section-label">Psychology</div>
    <div className="tj-grid2"><Field label="Before"><select className="tj-input" value={form.moodBefore} onChange={(event) => set("moodBefore", event.target.value)}>{MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}</select></Field><Field label="After"><select className="tj-input" value={form.moodAfter} onChange={(event) => set("moodAfter", event.target.value)}>{MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}</select></Field></div>
    <ScreenshotUploader screenshots={form.screenshots} onChange={setScreenshots} />
    <Field label="Notes"><textarea className="tj-input tj-textarea" placeholder="Context..." value={form.context} onChange={(event) => set("context", event.target.value)} /></Field>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>Save</button></div>
  </Modal>;
}

/* ============================ ACCOUNT MODALS =========================== */

function AccountSettingsModal({ account, onClose, onSave }) {
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(account.balance);
  const [beCap, setBeCap] = useState(account.breakevenCap);
  const [theme, setTheme] = useState(account.theme);
  const [defaultCommission, setDefaultCommission] = useState(account.defaultCommission || 0);
  return (
    <Modal title={<span><Settings size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Account Settings</span>} onClose={onClose}>
      <Field label="Display Name"><input className="tj-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Starting Balance ($)"><input type="number" className="tj-input" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
      <Field label="Breakeven Cap ($)">
        <input type="number" className="tj-input" value={beCap} onChange={(e) => setBeCap(e.target.value)} />
        <div className="tj-chip-row">
          {[0, 10, 20, 35, 50].map((v) => (
            <button key={v} className={`tj-chip ${Number(beCap) === v ? "tj-chip-active" : ""}`} onClick={() => setBeCap(v)}>${v}</button>
          ))}
        </div>
      </Field>
      <Field label="Default Commission ($ per trade)"><input type="number" className="tj-input" value={defaultCommission} onChange={(e) => setDefaultCommission(e.target.value)} /><div className="tj-muted-txt" style={{fontSize:11,marginTop:5}}>Pre-filled on new trades; individual trades can override it.</div></Field>
      <div className="tj-field-label">Theme</div>
      <div className="tj-chip-row tj-theme-choice-row">
        <button type="button" aria-pressed={theme === "dark"} className={`tj-chip-big tj-theme-choice ${theme === "dark" ? "tj-chip-active" : ""}`} onClick={() => setTheme("dark")}>DARK</button>
        <button type="button" aria-pressed={theme === "light"} className={`tj-chip-big tj-theme-choice ${theme === "light" ? "tj-chip-active" : ""}`} onClick={() => setTheme("light")}>LIGHT</button>
      </div>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" onClick={onClose}>Cancel</button>
        <button className="tj-btn-primary" onClick={() => onSave({ ...account, name, balance: parseFloat(balance) || 0, breakevenCap: parseFloat(beCap) || 0, defaultCommission: parseFloat(defaultCommission) || 0, theme })}>Save</button>
      </div>
    </Modal>
  );
}

function ListManager({ title, items, onSave, note }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);
  const add = () => { const v=value.trim(); if(v && !items.some((x)=>x.toLowerCase()===v.toLowerCase())) { onSave([...items,v]); setValue(""); } };
  const remove = (v) => { if (window.confirm(`Remove “${v}” from future trade entry? Historical trades retain their saved value.`)) onSave(items.filter((x) => x !== v)); };
  const rename = (old) => { const next=(editing || "").trim(); if(next && !items.some(x=>x !== old && x.toLowerCase()===next.toLowerCase())) onSave(items.map(x=>x===old?next:x)); setEditing(null); };
  return <Card className="tj-panel"><div className="tj-bold" style={{fontSize:16}}>{title}</div><div className="tj-muted-txt" style={{fontSize:12,margin:"5px 0 12px"}}>{note}</div><div className="tj-inline-add"><input className="tj-input" value={value} placeholder={`Add ${title.toLowerCase()}...`} onChange={(e)=>setValue(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} /><button className="tj-btn-primary" onClick={add}>Add</button></div><div className="tj-rule-list" style={{marginTop:12}}>{items.length?items.map((x)=><div className="tj-rule-row" key={x}>{editing !== null && editing.old === x ? <input autoFocus className="tj-input" value={editing.value} onChange={(e)=>setEditing({...editing,value:e.target.value})} onKeyDown={(e)=>e.key==="Enter"&&rename(x)} /> : <span>{x}</span>}<span><button className="tj-icon-btn" title="Edit" onClick={()=>editing?.old===x?rename(x):setEditing({old:x,value:x})}><Pencil size={14}/></button><button className="tj-icon-btn" title="Remove" onClick={()=>remove(x)}><Trash2 size={14}/></button></span></div>):<div className="tj-empty">Nothing added yet.</div>}</div></Card>;
}

function ManagementPage({ typeTags, mistakeTags, confluenceSessions, onTypeTags, onMistakes, onConfluence }) {
  return <><div className="tj-page-intro"><div className="tj-bold" style={{fontSize:18}}>Management</div><div className="tj-muted-txt" style={{fontSize:12}}>Manage the entry options available on future trades. Historical records retain their saved values.</div></div><div className="tj-row3 tj-management-grid">
    <ListManager title="Entry Type" items={confluenceSessions} onSave={onConfluence} note="Former Confluence Session records. Used for trade classification and Entry Type analytics." />
    <ListManager title="Confluence" items={typeTags} onSave={onTypeTags} note="Former tag records. Select one or more confluences while logging a trade." />
    <ListManager title="Mistake Management" items={mistakeTags} onSave={onMistakes} note="Multi-select mistakes available when logging a trade." />
  </div></>;
}

function MarkupModal({ onClose, onSave, editing, instruments = [] }) {
  const [f,setF]=useState(() => {
    const base = { id: uid(), date:todayISO(), time:nowTime(), market:"", instrument:"", bias:"", levels:"", structure:"", notes:"", screenshots:{preM15:[],preH4:[],postD1:[],postH4:[],postM15:[]} };
    if (!editing) return base;
    return { ...base, ...editing, time: editing.time || nowTime(), screenshots: { ...base.screenshots, ...(editing.screenshots && !Array.isArray(editing.screenshots) ? editing.screenshots : {}) } };
  });
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setShots=(slot)=>(updater)=>setF(x=>({...x,screenshots:{...x.screenshots,[slot]:updater(x.screenshots[slot])}}));
  const instrumentOptions = useMemo(() => [...DEFAULT_INSTRUMENTS, ...instruments.filter((instrument) => !DEFAULT_INSTRUMENTS.some((preset) => preset.toLowerCase() === instrument.toLowerCase()))], [instruments]);
  return <Modal title={editing ? "Edit Premarket Markup" : "New Premarket Markup"} onClose={onClose} wide>
    <div className="tj-grid4"><Field label="Date"><input type="date" className="tj-input" value={f.date} onChange={e=>set("date",e.target.value)}/></Field><Field label="Time *"><input type="time" required className="tj-input" value={f.time} onChange={e=>set("time",e.target.value)}/></Field><Field label="Market / Session"><select className="tj-input" value={f.market} onChange={e=>set("market",e.target.value)}><option value="">Select session</option>{SESSIONS.map((session)=><option key={session} value={session}>{session}</option>)}</select></Field><Field label="Instrument"><input className="tj-input" placeholder="Select or enter an instrument..." value={f.instrument} onChange={e=>set("instrument",e.target.value)} list="tj-instrument-list" /><datalist id="tj-instrument-list">{instrumentOptions.map((instrument)=><option key={instrument} value={instrument}/>)}</datalist></Field></div>
    <div className="tj-markup-section"><div className="tj-section-label">Pre-Session Analysis</div><div className="tj-grid2"><Field label="Bias"><select className="tj-input" value={f.bias} onChange={e=>set("bias",e.target.value)}><option value="">Select bias</option>{MARKUP_BIASES.map((bias)=><option key={bias} value={bias}>{bias}</option>)}</select></Field><Field label="Key levels, liquidity & zones"><input className="tj-input" value={f.levels} onChange={e=>set("levels",e.target.value)}/></Field></div><Field label="Market structure / narrative"><textarea className="tj-input tj-textarea" placeholder="HTF context, structure and key areas..." value={f.structure} onChange={e=>set("structure",e.target.value)}/></Field><div className="tj-grid2"><div><div className="tj-field-label">LTF (M15) chart</div><ScreenshotUploader screenshots={f.screenshots.preM15} onChange={setShots("preM15")}/></div><div><div className="tj-field-label">MTF (H4) chart</div><ScreenshotUploader screenshots={f.screenshots.preH4} onChange={setShots("preH4")}/></div></div></div>
    <div className="tj-markup-section"><div className="tj-section-label">Expectations</div><Field label="Core narrative / what am I expecting?"><textarea className="tj-input tj-textarea" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="What needs to happen for the idea to be valid? Include entry conditions and invalidation."/></Field></div>
    <div className="tj-markup-section"><div className="tj-section-label">Post-Session Markup</div><div className="tj-grid3"><div><div className="tj-field-label">HTF (D1) chart</div><ScreenshotUploader screenshots={f.screenshots.postD1} onChange={setShots("postD1")}/></div><div><div className="tj-field-label">MTF (H4) chart</div><ScreenshotUploader screenshots={f.screenshots.postH4} onChange={setShots("postH4")}/></div><div><div className="tj-field-label">LTF (M15) chart</div><ScreenshotUploader screenshots={f.screenshots.postM15} onChange={setShots("postM15")}/></div></div></div>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={()=>f.time&&onSave(f)}>{editing ? "Save Changes" : "Save Markup"}</button></div>
  </Modal>;
}
function MarkupsPage({ markups, trades, onNew, onEdit, onDelete }) {
  const [open,setOpen]=useState({});
  const slots = [["preM15", "LTF (M15)"], ["preH4", "MTF (H4)"], ["postD1", "Post Market HTF (D1)"], ["postH4", "Post Market MTF (H4)"], ["postM15", "Post Market LTF (M15)"]];
  return <><div className="tj-rules-head"><div><div className="tj-bold" style={{fontSize:16}}>Premarket Markups</div><div className="tj-muted-txt" style={{fontSize:12}}>Prepare context before execution, then attach the resulting trades.</div></div><button className="tj-btn-primary" onClick={onNew}><Plus size={15}/> New Markup</button></div><div className="tj-tlog-list">{markups.length ? markups.map((markup) => {
    const linked=trades.filter((trade)=>trade.premarketMarkupId===markup.id), pnl=linked.reduce((sum,trade)=>sum+trade.pnl,0), expanded=!!open[markup.id];
    return <Card key={markup.id} className="tj-tlog-card"><div className="tj-tlog-row" onClick={()=>setOpen((state)=>({...state,[markup.id]:!state[markup.id]}))}><div className="tj-tlog-main"><div className="tj-tlog-asset">{markup.instrument||markup.market||"Untitled markup"} <span className="tj-sesspill">{markup.bias||"No bias"}</span></div><div className="tj-muted-txt" style={{fontSize:12}}>{markup.date} · {formatTime(markup.time)} · {markup.market||"No session"} · {linked.length} linked trade{linked.length===1?"":"s"}</div></div><div className={`tj-tlog-pnl ${pnl>=0?"tj-green":"tj-red"}`}>{fmtMoney(pnl)}</div><button className="tj-btn-edit" onClick={(event)=>{event.stopPropagation();onEdit(markup)}}>Edit</button><button className="tj-icon-btn" title="Delete markup" onClick={(event)=>{event.stopPropagation();onDelete(markup.id)}}><Trash2 size={14}/></button><ChevronDown size={16} style={{transform:expanded?"rotate(180deg)":"none"}}/></div>{expanded&&<div className="tj-tlog-detail"><div className="tj-tlog-detail-grid"><div><div className="tj-mlabel">LEVELS / ZONES</div><div>{markup.levels||"—"}</div></div><div><div className="tj-mlabel">STRUCTURE</div><div>{markup.structure||"—"}</div></div><div><div className="tj-mlabel">EXPECTATIONS</div><div>{markup.notes||"—"}</div></div></div><div className="tj-section-label">Markup Images</div><div className="tj-markup-images">{slots.map(([slot,label])=>{const images=markup.screenshots?.[slot]||[];return images.length?<div key={slot} className="tj-markup-image-section"><div className="tj-mlabel">{label}</div><div className="tj-tlog-shots">{images.map((src,index)=><ImagePreview key={index} src={src} alt={`${label} chart`}/>)}</div></div>:null;})}</div><div className="tj-section-label">Linked Trades</div>{linked.length?linked.map((trade)=><div key={trade.id} className="tj-rule-row"><span>{trade.date} · {formatTime(trade.time)} · {trade.asset} · {trade.direction} <span className="tj-muted-txt">· {trade.entryType||trade.confluenceSession||"No entry type"}</span></span><span className="tj-linked-trade-metrics"><RatingDisplay value={trade.rating} noRules={!trade.ruleEvaluations?.length&&!trade.rating}/><strong className={trade.pnl>=0?"tj-green":"tj-red"}>{fmtMoney(trade.pnl)}</strong></span></div>):<div className="tj-empty">No trades linked yet.</div>}</div>}</Card>;
  }):<div className="tj-empty-block"><ScanLine size={32}/><div className="tj-empty-title">No premarket markups</div><button className="tj-btn-primary" onClick={onNew}>Create your first markup</button></div>}</div></>;
}
function ReviewsPage({ reviews, trades, onSave }) {
  const empty = { tradeId:"", date:todayISO(), time:nowTime(), doneWell:"", wentWrong:"", execution:"", adherence:"", psychology:"", lessons:"", actions:"", notes:"", screenshots:[] };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState({});
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const save = () => { if (!form.tradeId || !form.time) return; onSave(form); setForm({ ...empty, date: todayISO(), time: nowTime() }); };
  return <>
    <Card className="tj-panel"><div className="tj-bold" style={{fontSize:16}}>Trade Review</div><div className="tj-muted-txt" style={{fontSize:12,margin:"4px 0 14px"}}>Capture execution, rule adherence and the next improvement—not just the result.</div>
      <div className="tj-grid3"><Field label="Trade reference *"><select className="tj-input" value={form.tradeId} onChange={(e)=>set("tradeId",e.target.value)}><option value="">Select a completed trade</option>{trades.map((t)=><option key={t.id} value={t.id}>{t.date} · {t.asset} · Net {fmtMoney(t.pnl)}</option>)}</select></Field><Field label="Review date"><input type="date" className="tj-input" value={form.date} onChange={(e)=>set("date",e.target.value)} /></Field><Field label="Review time *"><input type="time" required className="tj-input" value={form.time} onChange={(e)=>set("time",e.target.value)} /></Field></div>
      <div className="tj-grid2"><Field label="What went well"><textarea className="tj-input tj-textarea" value={form.doneWell} onChange={(e)=>set("doneWell",e.target.value)} /></Field><Field label="What went wrong"><textarea className="tj-input tj-textarea" value={form.wentWrong} onChange={(e)=>set("wentWrong",e.target.value)} /></Field></div>
      <div className="tj-grid3"><Field label="Execution review"><textarea className="tj-input tj-textarea" value={form.execution} onChange={(e)=>set("execution",e.target.value)} /></Field><Field label="Rule adherence"><textarea className="tj-input tj-textarea" value={form.adherence} onChange={(e)=>set("adherence",e.target.value)} /></Field><Field label="Psychology"><textarea className="tj-input tj-textarea" value={form.psychology} onChange={(e)=>set("psychology",e.target.value)} /></Field></div>
      <div className="tj-grid2"><Field label="Lessons learned"><textarea className="tj-input tj-textarea" value={form.lessons} onChange={(e)=>set("lessons",e.target.value)} /></Field><Field label="Improvement / action items"><textarea className="tj-input tj-textarea" value={form.actions} onChange={(e)=>set("actions",e.target.value)} /></Field></div>
      <Field label="Review notes"><textarea className="tj-input tj-textarea" value={form.notes} onChange={(e)=>set("notes",e.target.value)} /></Field><ScreenshotUploader screenshots={form.screenshots} onChange={(u)=>setForm((f)=>({...f,screenshots:u(f.screenshots)}))}/><div className="tj-modal-actions"><button className="tj-btn-primary" onClick={save}>Save Review</button></div>
    </Card>
    <div className="tj-tlog-list" style={{marginTop:14}}>{reviews.length?reviews.map((r)=>{const t=trades.find((x)=>x.id===r.tradeId);return <Card key={r.id} className="tj-tlog-card"><div className="tj-tlog-row" onClick={()=>setOpen(x=>({...x,[r.id]:!x[r.id]}))}><div className="tj-tlog-main"><div className="tj-tlog-asset">{t?.asset||"Historical trade"} {t&&<span className={`tj-dirpill-sm ${t.direction==="BUY"?"tj-green":"tj-red"}`}>{t.direction}</span>}</div><div className="tj-muted-txt" style={{fontSize:12}}>{r.date} · {formatTime(r.time)} · Net P&amp;L {t?fmtMoney(t.pnl):"—"}</div></div>{t&&<RatingDisplay value={t.rating} noRules={!t.ruleEvaluations?.length&&!t.rating}/>}<ChevronDown size={16} style={{transform:open[r.id]?"rotate(180deg)":"none"}}/></div>{open[r.id]&&<div className="tj-tlog-detail"><div className="tj-tlog-detail-grid"><div><div className="tj-mlabel">ENTRY TYPE</div><div>{t?.entryType||t?.confluenceSession||"—"}</div></div><div><div className="tj-mlabel">ENTRY SESSION</div><div>{t?.entrySession||t?.session||"—"}</div></div><div><div className="tj-mlabel">CONFLUENCE</div><div>{(t?.confluence||t?.types||[]).join(", ")||"—"}</div></div><div><div className="tj-mlabel">MISTAKES</div><div>{t?.mistakes?.join(", ")||"—"}</div></div><div><div className="tj-mlabel">WHAT WENT WELL</div><div>{r.doneWell||"—"}</div></div><div><div className="tj-mlabel">WHAT WENT WRONG</div><div>{r.wentWrong||"—"}</div></div><div><div className="tj-mlabel">EXECUTION</div><div>{r.execution||"—"}</div></div><div><div className="tj-mlabel">RULE ADHERENCE</div><div>{r.adherence||"—"}</div></div></div><div className="tj-tlog-context">{r.lessons||r.actions||r.notes||"No lessons recorded."}</div>{r.screenshots?.length>0&&<div className="tj-tlog-shots">{r.screenshots.map((src,i)=><ImagePreview key={i} src={src} alt="Trade review screenshot"/>)}</div>}</div>}</Card>}):<div className="tj-empty">No reviews yet.</div>}</div>
  </>;
}

function AddAccountModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(10000);
  const [icon, setIcon] = useState(ACCOUNT_ICONS[0]);
  return (
    <Modal title="Add Account" onClose={onClose}>
      <Field label="Account Name"><input className="tj-input" placeholder="e.g. Prop Firm Challenge" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Starting Balance ($)"><input type="number" className="tj-input" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
      <div className="tj-field-label">Icon</div>
      <div className="tj-chip-row">
        {ACCOUNT_ICONS.map((ic) => <button key={ic} className={`tj-chip-big ${icon === ic ? "tj-chip-active" : ""}`} onClick={() => setIcon(ic)}>{ic}</button>)}
      </div>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" onClick={onClose}>Cancel</button>
        <button className="tj-btn-primary" onClick={() => {
          if (!name.trim()) return;
          onCreate({ id: "acc-" + uid(), name: name.trim(), icon, balance: parseFloat(balance) || 0, breakevenCap: 20, ratingStyle: "stars", theme: "dark", trades: [], rules: [], checkins: {} });
        }}>Create Account</button>
      </div>
    </Modal>
  );
}

/* ============================ DAY TRADES MODAL =========================== */

function DayTradesModal({ date, trades, markups = [], reviews = [], account, onClose, onEdit, onDelete }) {
  const d = new Date(date + "T00:00:00");
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const datedRecords = [
    ...markups.map((markup) => ({ id: `markup-${markup.id}`, time: markup.time, text: `Premarket Markup · ${markup.instrument || markup.market || "Untitled"}` })),
    ...reviews.map((review) => ({ id: `review-${review.id}`, time: review.time, text: "Trade Review" })),
  ].sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
  return (
    <Modal title={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClose={onClose} wide>
      <div className="tj-daymodal-summary">
        <span className={dayPnl >= 0 ? "tj-green" : "tj-red"} style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney(dayPnl)}</span>
        <span className="tj-muted-txt"> · {trades.length} trade{trades.length !== 1 ? "s" : ""}</span>
      </div>
      {datedRecords.length > 0 && <div className="tj-day-record-list">{datedRecords.map((record) => <div className="tj-day-record" key={record.id}><span>{formatTime(record.time)}</span><span>{record.text}</span></div>)}</div>}
      <div className="tj-tlog-list">
        {trades.map((t) => {
          const cls = classify(t.pnl, account.breakevenCap);
          return (
            <Card key={t.id} className={`tj-tlog-card tj-tlog-${cls}`}>
              <div className="tj-tlog-row">
                <span className={`tj-tlog-dot tj-dot-${cls}`} />
                <div className="tj-tlog-main">
                  <div className="tj-tlog-asset">{t.asset} <span className="tj-muted-txt" style={{fontSize:11}}>· {formatTime(t.time)}</span></div>
                  <div className="tj-tlog-pills">
                    <span className={`tj-dirpill-sm ${t.direction === "BUY" ? "tj-green" : "tj-red"}`}>{t.direction}</span>
                    <span className="tj-sesspill">{t.session}</span>
                  </div>
                </div>
                <div className="tj-tlog-pnl-block">
                  <div className={cls === "be" ? "tj-blue tj-tlog-pnl" : (t.pnl >= 0 ? "tj-green tj-tlog-pnl" : "tj-red tj-tlog-pnl")}>{cls === "be" ? "B/E" : fmtMoney(t.pnl)}</div>
                  {t.rr > 0 && <div className="tj-tlog-rr">{t.rr.toFixed(2)}R</div>}
                </div>
                <div className="tj-tlog-types">{(t.confluence || t.types || []).map((item) => <span key={item} className="tj-tag tj-tag-purple tj-tag-active tj-tag-xs">{item}</span>)}</div>
                <span className={`tj-statuspill tj-statuspill-${cls}`}>{cls === "win" ? "WIN" : cls === "loss" ? "LOSS" : "B/E"}</span>
                <div className="tj-tlog-actions">
                  <button className="tj-btn-edit" onClick={() => onEdit(t)}>Edit</button>
                  <button className="tj-btn-del" onClick={() => onDelete(t.id)}>Del</button>
                </div>
              </div>
              {t.screenshots?.length > 0 && (
                <div className="tj-tlog-shots" style={{ padding: "0 14px 12px" }}>{t.screenshots.map((src, i) => <ImagePreview key={i} src={src} alt="Trade screenshot" />)}</div>
              )}
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}

/* ================================ DASHBOARD ============================= */

function DashboardPage({ account, stats, monthCursor, setMonthCursor, onDayClick }) {
  const radarData = [
    { metric: "Win %", value: stats.winRate },
    { metric: "PF", value: norm(stats.profitFactor, 3) },
    { metric: "AVG W/L", value: norm(stats.avgWinLoss, 3) },
    { metric: "Consist.", value: stats.consistency },
    { metric: "Recovery", value: stats.recovery },
  ];
  const cumulative = useMemo(() => {
    let running = 0;
    return stats.sorted.map((t) => { running += t.pnl; return { date: t.date.slice(5), cum: +running.toFixed(2) }; });
  }, [stats.sorted]);
  const dailyData = useMemo(() => stats.dayClasses.map((d) => ({ date: d.date.slice(5), pnl: +d.pnl.toFixed(2), cls: d.cls })), [stats.dayClasses]);

  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  const byDayFull = groupByDay(account.trades, account.breakevenCap);
  const weeks = buildMonthGrid(year, month, byDayFull);
  const monthTrades = account.trades.filter((t) => t.date.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`);
  const monthProfit = monthTrades.filter((t) => classify(t.pnl, account.breakevenCap) === "win").length;
  const monthLoss = monthTrades.filter((t) => classify(t.pnl, account.breakevenCap) === "loss").length;
  const monthBE = monthTrades.length - monthProfit - monthLoss;
  const weeklyBreakdown = computeWeeklyBreakdown(account.trades, year, month, account.breakevenCap);

  const pctChange = account.balance ? (stats.netPnl / account.balance) * 100 : 0;
  const grossProfit = stats.sorted.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLossAmt = stats.sorted.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0);
  const winSegPct = stats.avgWin + stats.avgLoss ? (stats.avgWin / (stats.avgWin + stats.avgLoss)) * 100 : 50;
  const accountValue = account.balance + stats.netPnl;
  const latestTrade = stats.sorted[stats.sorted.length - 1];

  return (
    <>
      <Card className="tj-command-panel">
        <div className="tj-command-copy">
          <div className="tj-command-eyebrow"><span className="tj-command-live" /> JOURNAL OVERVIEW</div>
          <div className="tj-command-title">Trade with a clear read on your account.</div>
          <div className="tj-command-sub">
            {latestTrade
              ? `Last trade: ${latestTrade.asset} · ${formatTime(latestTrade.time)} · ${fmtMoney(latestTrade.pnl)}`
              : "Your workspace is ready. Log a trade when your plan is complete."}
          </div>
        </div>
        <div className="tj-command-metrics">
          <div className="tj-command-metric"><span>ACCOUNT VALUE</span><strong>{fmtMoney(accountValue)}</strong></div>
          <div className="tj-command-metric"><span>NET P&amp;L</span><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.netPnl)}</strong></div>
          <div className="tj-command-metric"><span>WIN RATE</span><strong className={wrColorClass(stats.winRate)}>{stats.winRate.toFixed(0)}%</strong></div>
          <div className="tj-command-metric"><span>TRADES LOGGED</span><strong>{stats.total}</strong></div>
        </div>
      </Card>
      <div className="tj-stats-grid">
        <StatCard label={`NET P&L · ${stats.total}T`}>
          <div className={`tj-stat-value ${stats.netPnl > 0 ? "tj-green" : stats.netPnl < 0 ? "tj-red" : ""}`}>{fmtMoney(stats.netPnl)}</div>
          <div className="tj-stat-sub"><span className="tj-green">{fmtMoneyShort(grossProfit)}</span>{"   "}<span className="tj-muted-txt">{pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%</span>{"   "}<span className="tj-red">{fmtMoneyShort(grossLossAmt)}</span></div>
        </StatCard>

        <StatCard label="TRADING COSTS">
          <div className="tj-stat-value tj-red">{fmtMoney(-(stats.totalCommission + stats.totalSwap))}</div>
          <div className="tj-stat-sub">Commission {fmtMoney(-stats.totalCommission)} · Swap {fmtMoney(-stats.totalSwap)}</div>
        </StatCard>

        <StatCard label="TRADE WIN %">
          <div className="tj-stat-row">
            <div><div className={`tj-stat-value ${wrColorClass(stats.winRate)}`}>{stats.winRate.toFixed(1)}%</div></div>
            <MultiRing segments={[{ value: stats.wins, color: UI_COLORS.primary }, { value: stats.be, color: UI_COLORS.info }, { value: stats.losses, color: UI_COLORS.danger }]} />
          </div>
          <div className="tj-badge-dot">
            <span className="tj-dot tj-dot-green">{stats.wins}</span>
            <span className="tj-dot tj-dot-blue">{stats.be}</span>
            <span className="tj-dot tj-dot-red">{stats.losses}</span>
          </div>
        </StatCard>

        <StatCard label="PROFIT FACTOR">
          <div className="tj-stat-row">
            <div><div className="tj-stat-value">{stats.profitFactor.toFixed(2)}</div></div>
            <MultiRing segments={[{ value: norm(stats.profitFactor, 3), color: "#FBBF24" }, { value: 100 - norm(stats.profitFactor, 3), color: "var(--tj-border)" }]} />
          </div>
        </StatCard>

        <StatCard label="WIN STREAK">
          <div className="tj-stat-row">
            <div>
              <div className="tj-stat-value" style={{ color: stats.streakType === "loss" ? "var(--tj-red)" : "var(--tj-green)" }}>
                {stats.streak === 0 ? "0" : (stats.streakType === "loss" ? "-" : "+") + stats.streak}
              </div>
              <div className="tj-stat-sub"><Snowflake size={11} style={{ verticalAlign: -1 }} /> Best: {stats.bestWinStreak}W · Loss streak: {stats.bestLossStreak}L</div>
            </div>
            <MultiRing segments={[{ value: stats.wins, color: UI_COLORS.primary }, { value: stats.losses, color: UI_COLORS.danger }]} />
          </div>
        </StatCard>

        <StatCard label="AVG WIN/LOSS">
          <div className="tj-stat-value">{stats.avgLoss ? stats.avgWinLoss.toFixed(2) : "∞"}</div>
          <div className="tj-winloss-bar">
            <div className="tj-winloss-fill" style={{ width: `${winSegPct}%` }} />
          </div>
          <div className="tj-stat-sub-row"><span className="tj-green">+{fmtMoneyShort(stats.avgWin).replace("+", "")}</span><span className="tj-red">-{fmtMoneyShort(stats.avgLoss).replace("-", "")}</span></div>
        </StatCard>
      </div>

      <div className="tj-row3">
        <Card className="tj-panel">
          <div className="tj-panel-head"><span className="tj-thunder">⚡ THUNDER SCORE</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} outerRadius={65}>
              <PolarGrid stroke="var(--tj-chart-grid)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 10 }} />
              <Radar dataKey="value" stroke={UI_COLORS.primary} fill={UI_COLORS.primary} fillOpacity={0.32} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="tj-avgrr-label">Avg RR</div>
          <div className="tj-gauge-track">
            <div className="tj-gauge-knob" style={{ left: `${stats.thunderScore}%` }} />
          </div>
          <div className="tj-gauge-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          <div className="tj-edge-num">{stats.thunderScore}</div>
          <div className="tj-edge-label">THUNDER SCORE</div>
        </Card>

        <Card className="tj-panel tj-panel-wide">
          <div className="tj-panel-head">
            <span>Cumulative P&L</span>
            <span className={`tj-pill ${stats.netPnl >= 0 ? "tj-pill-green" : "tj-pill-red"}`}>{pctChange >= 0 ? "↑" : "↓"}{Math.abs(pctChange).toFixed(2)}% {fmtMoney(stats.netPnl)}</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={cumulative}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), "Cumulative"]} />
              <Area type="monotone" dataKey="cum" stroke={UI_COLORS.primary} fill="url(#cumGrad)" strokeWidth={2.5} dot={{ r: 3, fill: UI_COLORS.primary, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="tj-panel">
          <div className="tj-panel-head"><span>Daily P&L</span><span className="tj-pill tj-pill-neutral">{stats.wins}/{stats.total}</span></div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyData}>
              <CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), "P&L"]} />
              <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                {dailyData.map((d, i) => <Cell key={i} fill={d.cls === "loss" ? UI_COLORS.danger : d.cls === "be" ? UI_COLORS.info : UI_COLORS.primary} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="tj-row2">
        <Card className="tj-panel tj-panel-wide">
          <div className="tj-panel-head">
            <span>{MONTH_NAMES[month]} {year}</span>
            <div className="tj-month-nav">
              <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
              <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="tj-month-summary">
            <div><div className="tj-green tj-mnum">{monthProfit}</div><div className="tj-mlabel">PROFIT</div></div>
            <div><div className="tj-red tj-mnum">{monthLoss}</div><div className="tj-mlabel">LOSS</div></div>
            <div><div className="tj-blue tj-mnum">{monthBE}</div><div className="tj-mlabel">B/E</div></div>
            <div><div className="tj-mnum">{monthTrades.length}</div><div className="tj-mlabel">TRADES</div></div>
          </div>
          <div className="tj-cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="tj-cal-grid">
            {weeks.flat().map((cell, i) => (
              <div key={i}
                className={`tj-cal-cell tj-dock-cell ${cell ? `tj-cal-${cell.cls || "none"}` : "tj-cal-empty"} ${cell?.iso === todayISO() ? "tj-cal-today" : ""} ${cell && cell.count > 0 ? "tj-cal-clickable" : ""}`}
                onClick={() => cell && cell.count > 0 && onDayClick(cell.iso)}>
                {cell && (<>
                  <div className="tj-cal-day">{cell.day}</div>
                  {cell.count > 0 && (<>
                    <div className={`tj-cal-pnl ${clsColor(cell.cls)}`}>{fmtMoneyShort(cell.pnl)}</div>
                    <div className="tj-cal-tcount">{cell.count}t</div>
                    <div className="tj-cal-dots">{Array.from({ length: Math.min(cell.count, 5) }).map((_, k) => <span key={k} className={`tj-mini-dot tj-dot-${cell.cls}`} />)}</div>
                  </>)}
                </>)}
              </div>
            ))}
          </div>
        </Card>
        <Card className="tj-panel">
          <div className="tj-panel-head"><span>Weekly P&L</span></div>
          {weeklyBreakdown.length === 0 ? <div className="tj-empty">No trades this month.</div> : (
            <div className="tj-weekly-list">
              {weeklyBreakdown.map((w, i) => (
                <div key={i} className="tj-weekly-item">
                  <div className="tj-weekly-item-label">{w.label}</div>
                  <div className={`tj-weekly-item-num ${w.pnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(w.pnl)}</div>
                  <div className="tj-weekly-item-sub"><span className={wrColorClass(w.winRate)}>{w.winRate.toFixed(0)}%</span> · {w.count}t</div>
                  <div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(w.winRate)}`} style={{ width: `${w.winRate}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ================================ TRADE LOG ============================= */

function TradeLogPage({ account, reviews = [], onEdit, onDelete, onNewTrade }) {
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState({});

  const cap = account.breakevenCap;
  const reviewedTradeIds = useMemo(() => new Set(reviews.map((review) => review.tradeId || review.trade_id).filter(Boolean)), [reviews]);
  const assets = useMemo(() => ["All", ...Array.from(new Set(account.trades.map((t) => t.asset)))], [account.trades]);
  const sessionsUsed = useMemo(() => ["All", ...Array.from(new Set(account.trades.map((t) => t.session)))], [account.trades]);

  let filtered = account.trades.filter((t) => {
    if (search && !(`${t.asset} ${t.context}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (assetFilter !== "All" && t.asset !== assetFilter) return false;
    if (sessionFilter !== "All" && t.session !== sessionFilter) return false;
    if (resultFilter !== "All" && classify(t.pnl, cap) !== resultFilter) return false;
    return true;
  });
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    else if (sortKey === "pnl") cmp = a.pnl - b.pnl;
    else if (sortKey === "asset") cmp = a.asset.localeCompare(b.asset);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const stats = computeStats(account.trades, cap);
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <>
      <div className="tj-toolbar">
        <div className="tj-toolbar-search">
          <Search size={15} className="tj-toolbar-search-icon" />
          <input className="tj-toolbar-search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="tj-toolbar-right">
          <select className="tj-toolbar-dd" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
            {assets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="tj-toolbar-dd" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
            {sessionsUsed.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="tj-toolbar-dd" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
            <option value="All">All</option><option value="win">Win</option><option value="loss">Loss</option><option value="be">B/E</option>
          </select>
          <button className={`tj-toolbar-dd tj-toolbar-btn ${sortKey === "date" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("date")}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : "↓"}</button>
          <button className={`tj-toolbar-pill ${sortKey === "pnl" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("pnl")}>P&L</button>
          <button className={`tj-toolbar-pill ${sortKey === "asset" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("asset")}>Instrument</button>
        </div>
      </div>

      <div className="tj-tradelog-stats">
        <Card className="tj-mini-stat"><div className="tj-mlabel">SHOWING</div><div className="tj-mnum-sm">{filtered.length} trades</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">NET P&L</div><div className={`tj-mnum-sm ${stats.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(stats.netPnl)}</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">WIN RATE</div><div className={`tj-mnum-sm ${wrColorClass(stats.winRate)}`}>{stats.winRate.toFixed(0)}%</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">W/L/BE</div><div className="tj-mnum-sm">{stats.wins}/{stats.losses}/{stats.be}</div></Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="tj-panel"><div className="tj-empty">No trades match these filters.</div></Card>
      ) : (
        <div className="tj-tlog-list">
          {filtered.map((t) => {
            const cls = classify(t.pnl, cap);
            const isOpen = !!expanded[t.id];
            const isReviewed = reviewedTradeIds.has(t.id);
            return (
              <Card key={t.id} className={`tj-tlog-card tj-tlog-${cls}`}>
                <div className="tj-tlog-row" onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>
                  <span className={`tj-tlog-dot tj-dot-${cls}`} />
                  <div className="tj-tlog-main">
                    <div className="tj-tlog-asset">{t.asset}</div>
                    <div className="tj-tlog-pills">
                      <span className={`tj-dirpill-sm ${t.direction === "BUY" ? "tj-green" : "tj-red"}`}>{t.direction}</span>
                      <span className="tj-sesspill">{t.session}</span>
                    </div>
                  </div>
                  <div className="tj-tlog-date">{new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}<br/><span className="tj-muted-txt">{formatTime(t.time)}</span></div>
                  <div className="tj-tlog-pnl-block">
                    <div className={cls === "be" ? "tj-blue tj-tlog-pnl" : (t.pnl >= 0 ? "tj-green tj-tlog-pnl" : "tj-red tj-tlog-pnl")}>{cls === "be" ? "B/E" : fmtMoney(t.pnl)}</div>
                    {t.rr > 0 && <div className="tj-tlog-rr">{t.rr.toFixed(2)}R</div>}
                  </div>
                  <div className="tj-tlog-types">{(t.confluence || t.types || []).map((item) => <span key={item} className="tj-tag tj-tag-purple tj-tag-active tj-tag-xs">{item}</span>)}</div>
                  <div className="tj-tlog-stars"><RatingDisplay value={t.rating} noRules={!t.ruleEvaluations?.length&&!t.rating} /></div>
                  <span className={`tj-review-status ${isReviewed ? "tj-review-reviewed" : "tj-review-pending"}`} title={isReviewed ? "This trade has a linked review" : "No trade review has been added yet"}>
                    {isReviewed ? <><CheckCircle2 size={12} /> Reviewed</> : "Review Pending"}
                  </span>
                  <div className="tj-tlog-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="tj-btn-edit" onClick={() => onEdit(t)}>Edit</button>
                    <button className="tj-btn-del" onClick={() => onDelete(t.id)}>Del</button>
                  </div>
                  <button className="tj-icon-btn">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                </div>
                {isOpen && (
                  <div className="tj-tlog-expand">
                    <div className="tj-tlog-detail-grid">
                      <div><div className="tj-mlabel">DATE &amp; TIME</div><div>{new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(t.time)}</div></div>
                      <div><div className="tj-mlabel">EMOTION BEFORE</div><div className="tj-purple-txt">{t.moodBefore}</div></div>
                      <div><div className="tj-mlabel">EMOTION AFTER</div><div className="tj-purple-txt">{t.moodAfter}</div></div>
                      <div><div className="tj-mlabel">ENTRY TYPE</div><div>{t.entryType || t.confluenceSession || "—"}</div></div>
                      <div><div className="tj-mlabel">ENTRY SESSION</div><div>{t.entrySession || t.session || "—"}</div></div>
                      <div><div className="tj-mlabel">RULE RATING</div><div><RatingDisplay value={t.rating} noRules={!t.ruleEvaluations?.length&&!t.rating} /> <span className="tj-muted-txt">{t.ruleEvaluations?.filter((entry)=>entry.checked).length || 0}/{t.ruleEvaluations?.length || 0}</span></div></div>
                    </div>
                    {t.mistakes.length > 0 && (
                      <div className="tj-tlog-mistakes">{t.mistakes.map((m) => <span key={m} className="tj-tag tj-tag-red tj-tag-active tj-tag-xs">{m}</span>)}</div>
                    )}
                    {t.screenshots?.length > 0 && (
                      <div className="tj-tlog-shots">{t.screenshots.map((src, i) => <ImagePreview key={i} src={src} alt="Trade screenshot" />)}</div>
                    )}
                    {t.context && <div className="tj-tlog-context">"{t.context}"</div>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <button className="tj-fab" onClick={onNewTrade}><Plus size={16} /> New Trade</button>
    </>
  );
}

/* ================================ ANALYTICS ============================= */

function AnalyticsPage({ account }) {
  const trades = account.trades;
  const cap = account.breakevenCap;
  const stats = computeStats(trades, cap);

  const tagStats = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      const tag = t.entryType || t.confluenceSession;
      if (!tag) return;
      if (!map[tag]) map[tag] = { tag, count: 0, netPnl: 0, wins: 0, rrSum: 0, best: -Infinity, worst: Infinity };
      const m = map[tag];
      m.count++; m.netPnl += t.pnl; m.rrSum += t.rr || 0;
      if (classify(t.pnl, cap) === "win") m.wins++;
      m.best = Math.max(m.best, t.pnl); m.worst = Math.min(m.worst, t.pnl);
    });
    return Object.values(map).map((m) => ({ ...m, winRate: m.count ? (m.wins / m.count) * 100 : 0, avgRR: m.count ? m.rrSum / m.count : 0 }));
  }, [trades, cap]);

  const sessionStats = useMemo(() => SESSIONS.map((s) => {
    const ts = trades.filter((t) => t.session === s);
    const wins = ts.filter((t) => classify(t.pnl, cap) === "win").length;
    const losses = ts.filter((t) => classify(t.pnl, cap) === "loss").length;
    const netPnl = ts.reduce((s2, t) => s2 + t.pnl, 0);
    const winRate = ts.length ? (wins / ts.length) * 100 : 0;
    return { session: s, count: ts.length, netPnl, wins, losses, winRate,
      radar: [
        { metric: "WR", value: winRate },
        { metric: "Vol", value: norm(ts.length, 6) },
        { metric: "Avg", value: norm(ts.length ? netPnl / ts.length : 0, 200) },
        { metric: "Cons", value: ts.length ? 100 - clamp((losses / (ts.length || 1)) * 100, 0, 100) : 0 },
      ] };
  }).filter((s) => s.count > 0), [trades, cap]);

  const instrumentStats = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      if (!map[t.asset]) map[t.asset] = { asset: t.asset, count: 0, netPnl: 0, wins: 0, rrSum: 0 };
      map[t.asset].count++; map[t.asset].netPnl += t.pnl; map[t.asset].rrSum += t.rr || 0;
      if (classify(t.pnl, cap) === "win") map[t.asset].wins++;
    });
    return Object.values(map).map((m) => {
      const winRate = m.count ? (m.wins / m.count) * 100 : 0;
      return { ...m, winRate, avgRR: m.count ? m.rrSum / m.count : 0, grade: getGrade(winRate, m.netPnl, m.count) };
    }).sort((a, b) => b.netPnl - a.netPnl);
  }, [trades, cap]);

  const tradingDays = stats.dayClasses;
  const greenDays = tradingDays.filter((d) => d.cls === "win").length;
  const redDays = tradingDays.filter((d) => d.cls === "loss").length;
  const flatDays = tradingDays.filter((d) => d.cls === "be").length;
  const avgPerDay = tradingDays.length ? stats.netPnl / tradingDays.length : 0;
  const dayScore = Math.round(clamp(stats.dayWinRate * 0.6 + norm(avgPerDay, 200) * 0.4, 0, 100));
  const dayLabel = dayScore >= 86 ? "Elite" : dayScore >= 66 ? "Solid" : dayScore >= 35 ? "Developing" : "Needs Work";
  const dayColor = dayScore >= 66 ? UI_COLORS.primary : dayScore >= 35 ? UI_COLORS.warning : UI_COLORS.danger;

  let runs = [], run = null;
  tradingDays.forEach((d) => {
    if (run && run.cls === d.cls) run.len++;
    else { run = { cls: d.cls, len: 1 }; runs.push(run); }
  });
  const bestRun = runs.length ? Math.max(...runs.map((r) => r.len)) : 0;
  const worstRun = runs.length ? Math.min(...runs.map((r) => r.len)) : 0;
  const lastRun = runs[runs.length - 1];
  const currentRunLabel = !lastRun || lastRun.cls === "be" ? "—" : `${lastRun.len}${lastRun.cls === "win" ? "W" : "L"}`;

  const bestDay = tradingDays.length ? tradingDays.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worstDay = tradingDays.length ? tradingDays.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
  const last6 = tradingDays.slice(-6);
  const maxAbsLast6 = Math.max(1, ...last6.map((d) => Math.abs(d.pnl)));

  const equityData = useMemo(() => {
    let running = account.balance;
    const arr = [{ label: "Start", equity: running }];
    stats.sorted.forEach((t, i) => { running += t.pnl; arr.push({ label: `T${i + 1}`, equity: +running.toFixed(2) }); });
    return arr;
  }, [stats.sorted, account.balance]);
  const equityChangePct = account.balance ? (stats.netPnl / account.balance) * 100 : 0;

  const maxAbsTagPnl = Math.max(1, ...tagStats.map((t) => Math.abs(t.netPnl)));
  const scatterPoints = useMemo(() => {
    const placed = [];
    return tagStats.map((t, index) => {
      const baseLeft = clamp(50 + (t.netPnl / maxAbsTagPnl) * 43, 8, 92);
      const baseTop = clamp(100 - t.winRate, 9, 91);
      const nearby = placed.filter((p) => Math.hypot(p.left - baseLeft, p.top - baseTop) < 12).length;
      const angle = nearby * 2.4 + index * 0.65;
      const left = nearby ? clamp(baseLeft + Math.cos(angle) * (nearby + 1) * 5, 8, 92) : baseLeft;
      const top = nearby ? clamp(baseTop + Math.sin(angle) * (nearby + 1) * 5, 9, 91) : baseTop;
      const point = { ...t, left, top };
      placed.push(point);
      return point;
    });
  }, [tagStats, maxAbsTagPnl]);

  // Entry Type performance comparison
  const [comboMode, setComboMode] = useState("AND");
  const [comboTypes, setComboTypes] = useState([]);
  const [comboOther, setComboOther] = useState([]);
  const allTypeTags = Array.from(new Set(trades.map((t) => t.entryType || t.confluenceSession).filter(Boolean)));
  const otherChips = Array.from(new Set([...SESSIONS, ...trades.map((t) => t.asset)]));
  const toggleCombo = (arr, setArr, val) => setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  const comboSelected = [...comboTypes, ...comboOther];
  const comboMatches = comboSelected.length === 0 ? [] : trades.filter((t) => {
    const hay = [t.entryType || t.confluenceSession, t.entrySession || t.session, t.asset];
    return comboMode === "AND" ? comboSelected.every((c) => hay.includes(c)) : comboSelected.some((c) => hay.includes(c));
  });
  const comboPnl = comboMatches.reduce((s, t) => s + t.pnl, 0);

  if (trades.length === 0) {
    return <Card className="tj-panel"><div className="tj-empty">Log some trades to unlock analytics for this account.</div></Card>;
  }

  return (
    <div className="tj-analytics">
      <div className="tj-tradelog-stats" style={{ marginBottom: 14 }}>
        <Card className="tj-mini-stat"><div className="tj-mlabel">GROSS P&amp;L</div><div className={`tj-mnum-sm ${stats.grossPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(stats.grossPnl)}</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">COMMISSIONS PAID</div><div className="tj-mnum-sm tj-red">{fmtMoney(-stats.totalCommission)}</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">SWAP PAID</div><div className="tj-mnum-sm tj-red">{fmtMoney(-stats.totalSwap)}</div></Card>
        <Card className="tj-mini-stat"><div className="tj-mlabel">NET P&amp;L</div><div className={`tj-mnum-sm ${stats.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(stats.netPnl)}</div><div className="tj-muted-txt" style={{fontSize:10}}>{stats.grossProfit > 0 ? `${(((stats.totalCommission + stats.totalSwap) / stats.grossProfit) * 100).toFixed(1)}% of gross profit in costs` : "No gross profit yet"}</div></Card>
      </div>
      <div className="tj-row2">
        <Card className="tj-panel">
          <div className="tj-panel-head"><span>Performance</span></div>
          <div className="tj-perf-list">
            <div><span>Total</span><span className="tj-mono">{stats.total}</span></div>
            <div><span>Wins</span><span className="tj-mono tj-green">{stats.wins}</span></div>
            <div><span>Losses</span><span className="tj-mono tj-red">{stats.losses}</span></div>
            <div><span>B/E</span><span className="tj-mono tj-blue">{stats.be}</span></div>
          </div>
        </Card>
        <Card className="tj-panel">
          <div className="tj-panel-head"><span>💳 Entry Type Performance</span></div>
          <table className="tj-simple-table">
            <thead><tr><th>ENTRY TYPE</th><th>NET P&amp;L</th><th>WR</th></tr></thead>
            <tbody>{tagStats.map((t) => (
              <tr key={t.tag}><td className="tj-bold">{t.tag}</td><td className={t.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(t.netPnl)}</td><td className={wrColorClass(t.winRate)}>{t.winRate.toFixed(0)}%</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head">
          <span>🔍 Entry Type Scatter (WR vs P&amp;L)</span>
          <span className="tj-scatter-legend"><i className="tj-dot-green" /> High WR <i className="tj-dot-amber" /> Mid WR <i className="tj-dot-red" /> Low WR</span>
        </div>
        <div className="tj-scatter-box">
          <div className="tj-scatter-bg tj-scatter-bg-tl" />
          <div className="tj-scatter-bg tj-scatter-bg-tr" />
          <div className="tj-scatter-bg tj-scatter-bg-bl" />
          <div className="tj-scatter-bg tj-scatter-bg-br" />
          <div className="tj-scatter-midline" />
          <div className="tj-scatter-quad tj-scatter-tl">HIGH WR · LOSING</div>
          <div className="tj-scatter-quad tj-scatter-tr tj-scatter-good">HIGH WR · PROFIT ★</div>
          <div className="tj-scatter-quad tj-scatter-bl tj-scatter-bad">LOW WR · LOSING ⚠</div>
          <div className="tj-scatter-quad tj-scatter-br">LOW WR · PROFIT</div>
          <div className="tj-scatter-axis-y-top">High WR</div>
          <div className="tj-scatter-axis-y-bot">Low WR</div>
          <div className="tj-scatter-axis-x-left">Loss</div>
          <div className="tj-scatter-axis-x-mid">$0</div>
          <div className="tj-scatter-axis-x-right">Profit</div>
          {scatterPoints.map((t) => {
            const { left, top } = t;
            const size = clamp(36 + t.count * 6, 36, 70);
            const color = wrHex(t.winRate);
            const wins = Math.round((t.winRate / 100) * t.count);
            const flipDown = top < 35;
            return (
              <div key={t.tag} className="tj-scatter-dot-wrap" style={{ left: `${left}%`, top: `${top}%` }}>
                <div className="tj-scatter-dot" style={{ width: size, height: size, borderColor: color, color }}>{t.tag}</div>
                <div className={`tj-scatter-tooltip ${flipDown ? "tj-scatter-tooltip-below" : ""}`}>
                  <div className="tj-scatter-tooltip-title">{t.tag}</div>
                  <div className="tj-scatter-tooltip-row"><span>Net P&L</span><span className={t.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(t.netPnl)}</span></div>
                  <div className="tj-scatter-tooltip-row"><span>Win Rate</span><span className={`tj-bold ${wrColorClass(t.winRate)}`}>{t.winRate.toFixed(1)}%</span></div>
                  <div className="tj-scatter-tooltip-row"><span>Trades</span><span className="tj-bold">{t.count} ({wins}W/{t.count - wins}L)</span></div>
                  <div className="tj-scatter-tooltip-row"><span>Avg RR</span><span className="tj-purple-txt tj-bold">{t.avgRR.toFixed(2)}</span></div>
                  <div className="tj-scatter-tooltip-row"><span>Entry Type</span><span className="tj-bold">{t.tag}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head"><span>Entry Types</span></div>
        <div className="tj-setup-tags">
          {tagStats.map((t) => {
            const grade = getGrade(t.winRate, t.netPnl, t.count);
            const wins = Math.round((t.winRate / 100) * t.count);
            return (
              <div key={t.tag} className="tj-setup-card">
                <div className="tj-setup-head"><span className="tj-bold">{t.tag}</span><span className="tj-grade-badge">{grade}</span></div>
                <div className="tj-setup-grid">
                  <div><div className="tj-mlabel">NET P&L</div><div className={`tj-bold ${t.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(t.netPnl)}</div></div>
                  <div><div className="tj-mlabel">WIN RATE</div><div className={`tj-bold ${wrColorClass(t.winRate)}`}>{t.winRate.toFixed(0)}%</div></div>
                  <div><div className="tj-mlabel">TRADES</div><div className="tj-bold">{t.count} <span className="tj-muted-txt" style={{ fontSize: 11 }}>({wins}W/{t.count - wins}L)</span></div></div>
                  <div><div className="tj-mlabel">AVG RR</div><div className="tj-bold tj-purple-txt">{t.avgRR.toFixed(2)}</div></div>
                </div>
                <div className="tj-setup-bw">
                  <div className="tj-setup-bw-box tj-setup-bw-best"><div className="tj-mlabel">Best</div><div className="tj-green tj-bold">{fmtMoneyShort(t.best)}</div></div>
                  <div className="tj-setup-bw-box tj-setup-bw-worst"><div className="tj-mlabel">Worst</div><div className="tj-red tj-bold">{fmtMoneyShort(t.worst)}</div></div>
                </div>
                <div className="tj-bar-track" style={{ marginTop: 8 }}><div className={`tj-bar-fill ${wrBarClass(t.winRate)}`} style={{ width: `${t.winRate}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head"><span>Session Performance</span></div>
        <div className="tj-session-grid">
          {sessionStats.map((s) => (
            <div key={s.session} className="tj-session-card">
              <div className="tj-session-top"><span className="tj-sesspill-lg">{s.session}</span><span className="tj-muted-txt">{s.count} trades</span></div>
              <ResponsiveContainer width="100%" height={100}>
                <RadarChart data={s.radar} outerRadius={38}>
                  <PolarGrid stroke="var(--tj-chart-grid)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 8 }} />
                  <Radar dataKey="value" stroke={UI_COLORS.primary} fill={UI_COLORS.primary} fillOpacity={0.38} />
                </RadarChart>
              </ResponsiveContainer>
              <div className={`tj-session-pnl ${s.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(s.netPnl)}</div>
              <div className="tj-session-wl"><span className="tj-green">✓{s.wins}W</span><span className="tj-red">✗{s.losses}L</span></div>
              <div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(s.winRate)}`} style={{ width: `${s.winRate}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-day-score-row">
          <div className="tj-day-score-circle" style={{ borderColor: dayColor }}>
            <div className="tj-day-score-num" style={{ color: dayColor }}>{dayScore}</div>
            <div className="tj-day-score-max">/100</div>
          </div>
          <div>
            <div className="tj-day-score-label" style={{ color: dayColor }}>{dayLabel}</div>
            <div className="tj-muted-txt">{tradingDays.length} trading days · avg {fmtMoney(avgPerDay)}/day</div>
            <div className="tj-day-legend">
              <span><i className="tj-dot-green" /> {greenDays} green</span>
              <span><i className="tj-dot-red" /> {redDays} red</span>
              <span><i className="tj-dot-blue" /> {flatDays} flat</span>
            </div>
          </div>
        </div>
        <div className="tj-mlabel" style={{ marginTop: 16 }}>DAY DISTRIBUTION</div>
        <div className="tj-day-dist">
          {greenDays > 0 && <div style={{ width: `${(greenDays / tradingDays.length) * 100}%`, background: UI_COLORS.primary }} />}
          {flatDays > 0 && <div style={{ width: `${(flatDays / tradingDays.length) * 100}%`, background: UI_COLORS.info }} />}
          {redDays > 0 && <div style={{ width: `${(redDays / tradingDays.length) * 100}%`, background: UI_COLORS.danger }} />}
        </div>
        <div className="tj-day-quad-stats">
          <div><div className="tj-mlabel">CURRENT</div><div className="tj-bold">{currentRunLabel}</div></div>
          <div><div className="tj-mlabel">BEST RUN</div><div className="tj-bold">{bestRun}d</div></div>
          <div><div className="tj-mlabel">WORST RUN</div><div className="tj-bold">{worstRun}d</div></div>
          <div><div className="tj-mlabel">AVG/DAY</div><div className="tj-bold">{fmtMoney(avgPerDay)}</div></div>
        </div>
        <div className="tj-day-bestworst">
          <div className="tj-day-bw-box tj-day-bw-best">
            <div className="tj-mlabel">BEST DAY</div>
            <div className="tj-green tj-bold" style={{ fontSize: 18 }}>{fmtMoney(bestDay.pnl)}</div>
            <div className="tj-muted-txt">{new Date(bestDay.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
          </div>
          <div className="tj-day-bw-box tj-day-bw-worst">
            <div className="tj-mlabel">WORST DAY</div>
            <div className="tj-red tj-bold" style={{ fontSize: 18 }}>{fmtMoney(worstDay.pnl)}</div>
            <div className="tj-muted-txt">{new Date(worstDay.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
          </div>
        </div>
        <div className="tj-mlabel" style={{ marginTop: 16 }}>LAST {last6.length} TRADING DAYS</div>
        <div className="tj-last6-track">
          {last6.map((d, i) => (
            <div key={i} className="tj-last6-bar" style={{ background: d.cls === "loss" ? UI_COLORS.danger : d.cls === "be" ? UI_COLORS.info : UI_COLORS.primary, flex: Math.max(0.3, Math.abs(d.pnl) / maxAbsLast6) }} title={`${d.date}: ${fmtMoney(d.pnl)}`} />
          ))}
        </div>
        <div className="tj-last6-dates">{last6.map((d, i) => <span key={i}>{d.date.slice(5)}</span>)}</div>
        <div className="tj-last6-legend"><span><i className="tj-dot-green" />Profit day</span><span><i className="tj-dot-red" />Loss day</span><span><i className="tj-dot-blue" />Flat day</span></div>
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head"><span>🏆 Instrument Performance</span></div>
        <div className="tj-table-wrap">
        <table className="tj-simple-table tj-instrument-table">
          <thead><tr><th>INSTRUMENT</th><th>NET P&L</th><th>WIN RATE</th><th>TRADES</th><th>AVG RR</th><th>GRADE</th></tr></thead>
          <tbody>
            {instrumentStats.map((m) => (
              <tr key={m.asset}>
                <td className="tj-bold">{m.asset === instrumentStats[0].asset && "⭐ "}{m.asset}</td>
                <td className={m.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(m.netPnl)}</td>
                <td><div className="tj-inline-bar"><div className="tj-bar-track" style={{ width: 90 }}><div className={`tj-bar-fill ${wrBarClass(m.winRate)}`} style={{ width: `${m.winRate}%` }} /></div><span className={wrColorClass(m.winRate)}>{m.winRate.toFixed(0)}%</span></div></td>
                <td className="tj-purple-txt tj-bold">{m.count}</td>
                <td className="tj-purple-txt">{m.avgRR.toFixed(2)}</td>
                <td><span className={`tj-grade-badge ${m.grade === "D" || m.grade === "C" ? "tj-grade-bad" : ""}`}>{m.grade}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head">
          <span>🧪 Entry Type Comparison</span>
          <div className="tj-tabs"><button className={`tj-tab ${comboMode === "AND" ? "tj-tab-active" : ""}`} onClick={() => setComboMode("AND")}>AND</button><button className={`tj-tab ${comboMode === "OR" ? "tj-tab-active" : ""}`} onClick={() => setComboMode("OR")}>OR</button></div>
        </div>
        <div className="tj-mlabel">ENTRY TYPES</div>
        <div className="tj-chip-row" style={{ marginBottom: 10 }}>
          {allTypeTags.map((t) => <button key={t} className={`tj-chip ${comboTypes.includes(t) ? "tj-chip-active" : ""}`} onClick={() => toggleCombo(comboTypes, setComboTypes, t)}>{t}</button>)}
        </div>
        <div className="tj-chip-row">
          {otherChips.map((t) => <button key={t} className={`tj-chip ${comboOther.includes(t) ? "tj-chip-active" : ""}`} onClick={() => toggleCombo(comboOther, setComboOther, t)}>{t}</button>)}
        </div>
        {comboSelected.length > 0 && (
          <div className="tj-combo-result">{comboMatches.length} trades matched · <span className={comboPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(comboPnl)}</span></div>
        )}
      </Card>

      <Card className="tj-panel" style={{ marginTop: 14 }}>
        <div className="tj-panel-head"><span>Equity</span><span className={`tj-pill ${equityChangePct >= 0 ? "tj-pill-green" : "tj-pill-red"}`}>{equityChangePct >= 0 ? "↑" : "↓"}{Math.abs(equityChangePct).toFixed(2)}%</span></div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={equityData}>
            <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={0.38} /><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={["dataMin - 200", "dataMax + 200"]} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), "Equity"]} />
            <Area type="monotone" dataKey="equity" stroke={UI_COLORS.primary} fill="url(#eqGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ================================ CALENDAR =============================== */

function computeMonthlyPerformance(trades, cap, balance) {
  const map = {};
  trades.forEach((t) => {
    const key = t.date.slice(0, 7);
    if (!map[key]) map[key] = { key, pnl: 0, wins: 0, count: 0 };
    map[key].pnl += t.pnl; map[key].count++;
    if (classify(t.pnl, cap) === "win") map[key].wins++;
  });
  return Object.values(map).sort((a, b) => (a.key < b.key ? -1 : 1)).map((m) => ({
    ...m,
    label: new Date(m.key + "-01T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    winRate: m.count ? (m.wins / m.count) * 100 : 0,
    pctGain: balance ? (m.pnl / balance) * 100 : 0,
  }));
}

function computeWeeklyPerformanceAll(trades, cap, balance) {
  const map = {};
  trades.forEach((t) => {
    const d = new Date(t.date + "T00:00:00");
    const sunday = new Date(d); sunday.setDate(d.getDate() - d.getDay());
    const key = sunday.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { key, pnl: 0, wins: 0, count: 0 };
    map[key].pnl += t.pnl; map[key].count++;
    if (classify(t.pnl, cap) === "win") map[key].wins++;
  });
  return Object.values(map).sort((a, b) => (a.key < b.key ? -1 : 1)).map((m) => {
    const sunday = new Date(m.key + "T00:00:00");
    const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
    return {
      ...m, label: `${fmtShortDate(sunday)} – ${fmtShortDate(saturday)}`,
      winRate: m.count ? (m.wins / m.count) * 100 : 0,
      pctGain: balance ? (m.pnl / balance) * 100 : 0,
    };
  });
}

function computeDayOfWeekPerformance(trades, cap) {
  const map = {};
  trades.forEach((t) => {
    const dow = new Date(t.date + "T00:00:00").getDay();
    if (!map[dow]) map[dow] = { dow, pnl: 0, wins: 0, count: 0 };
    map[dow].pnl += t.pnl; map[dow].count++;
    if (classify(t.pnl, cap) === "win") map[dow].wins++;
  });
  return Object.values(map)
    .map((m) => ({ ...m, label: DOW[m.dow], winRate: m.count ? (m.wins / m.count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

function PerformanceTable({ title, rows, unitLabel }) {
  if (rows.length === 0) return <div className="tj-empty">No data yet.</div>;
  const best = rows.reduce((a, b) => (b.pnl > a.pnl ? b : a));
  const worst = rows.reduce((a, b) => (b.pnl < a.pnl ? b : a));
  const avg = rows.reduce((s, r) => s + r.pnl, 0) / rows.length;
  return (
    <>
      <Card className="tj-panel">
        <div className="tj-panel-head"><span>{title}</span><span className="tj-muted-txt" style={{ fontSize: 11 }}>{rows.length} {unitLabel}{rows.length !== 1 ? "s" : ""}</span></div>
        <div className="tj-table-wrap">
          <table className="tj-simple-table tj-perf-table">
            <thead><tr><th>{unitLabel.toUpperCase()}</th><th>NET P&L</th><th>% GAIN</th><th>TRADES</th><th>WIN RATE</th><th>RESULT</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.key}>
                  <td className="tj-bold">{r.label}</td>
                  <td className={r.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(r.pnl)}</td>
                  <td><span className={`tj-pill ${r.pctGain >= 0 ? "tj-pill-green" : "tj-pill-red"}`}>{r.pctGain >= 0 ? "+" : ""}{r.pctGain.toFixed(2)}%</span></td>
                  <td className="tj-purple-txt tj-bold">{r.count}</td>
                  <td><div className="tj-inline-bar"><div className="tj-bar-track" style={{ width: 90 }}><div className={`tj-bar-fill ${wrBarClass(r.winRate)}`} style={{ width: `${r.winRate}%` }} /></div><span className={wrColorClass(r.winRate)}>{r.winRate.toFixed(0)}%</span></div></td>
                  <td><span className={`tj-statuspill tj-statuspill-${r.pnl >= 0 ? "win" : "loss"}`}>{r.pnl >= 0 ? "PROFIT" : "LOSS"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="tj-perf-summary-grid">
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">BEST {unitLabel.toUpperCase()}</div>
          <div className="tj-green tj-bold" style={{ fontSize: 20 }}>{fmtMoney(best.pnl)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 11 }}>{best.label}</div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">WORST {unitLabel.toUpperCase()}</div>
          <div className="tj-red tj-bold" style={{ fontSize: 20 }}>{fmtMoney(worst.pnl)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 11 }}>{worst.label}</div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">AVG {unitLabel.toUpperCase()}LY</div>
          <div className={`tj-bold ${avg >= 0 ? "tj-green" : "tj-red"}`} style={{ fontSize: 20 }}>{fmtMoney(avg)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 11 }}>Average</div>
        </Card>
      </div>
    </>
  );
}

function DailyPerformanceView({ trades, cap }) {
  const rows = computeDayOfWeekPerformance(trades, cap);
  if (rows.length === 0) return <Card className="tj-panel"><div className="tj-empty">No data yet.</div></Card>;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  const most = rows[0];
  const least = rows[rows.length - 1];
  return (
    <>
      <Card className="tj-panel">
        <div className="tj-panel-head"><span>Performance by Day of Week</span></div>
        <div className="tj-dow-list">
          {rows.map((r, i) => (
            <div key={r.dow} className="tj-dow-row">
              <span className="tj-dow-label">{r.label}</span>
              <span className={`tj-dow-pnl ${r.pnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(r.pnl)}</span>
              {i === 0 && <span className="tj-daytag tj-daytag-today">BEST</span>}
              <div className="tj-bar-track tj-dow-bar"><div className={`tj-bar-fill ${r.pnl >= 0 ? "tj-bar-green" : "tj-bar-red"}`} style={{ width: `${(Math.abs(r.pnl) / maxAbs) * 100}%` }} /></div>
              <span className={`tj-dow-wr ${wrColorClass(r.winRate)}`}>{r.winRate.toFixed(0)}% WR</span>
              <span className="tj-purple-txt tj-bold tj-dow-count">{r.count}t</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="tj-perf-summary-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">MOST PROFITABLE DAY</div>
          <div className="tj-green tj-bold" style={{ fontSize: 20 }}>{DOW_FULL[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(most.label)]}</div>
          <div className="tj-muted-txt" style={{ fontSize: 11 }}>{fmtMoney(most.pnl)} · <span className={wrColorClass(most.winRate)}>{most.winRate.toFixed(0)}% WR</span></div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">LEAST PROFITABLE DAY</div>
          <div className={`tj-bold ${least.pnl >= 0 ? "tj-green" : "tj-red"}`} style={{ fontSize: 20 }}>{DOW_FULL[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(least.label)]}</div>
          <div className="tj-muted-txt" style={{ fontSize: 11 }}>{fmtMoney(least.pnl)} · <span className={wrColorClass(least.winRate)}>{least.winRate.toFixed(0)}% WR</span></div>
        </Card>
      </div>
    </>
  );
}

function CalendarPage({ account, monthCursor, setMonthCursor, onDayClick }) {
  const [calTab, setCalTab] = useState("calendar");
  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  const byDay = groupByDay(account.trades, account.breakevenCap);
  const weeks = buildMonthGrid(year, month, byDay);
  const monthTrades = account.trades.filter((t) => t.date.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`);
  const monthProfit = monthTrades.filter((t) => classify(t.pnl, account.breakevenCap) === "win").length;
  const monthLoss = monthTrades.filter((t) => classify(t.pnl, account.breakevenCap) === "loss").length;
  const monthBE = monthTrades.length - monthProfit - monthLoss;
  const weeklyBreakdown = computeWeeklyBreakdown(account.trades, year, month, account.breakevenCap);
  const weeksBack = 16;
  const heat = [];
  const monthColLabels = [];
  const start = new Date();
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - weeksBack * 7 - ((start.getDay() + 6) % 7));
  for (let w = 0; w < weeksBack; w++) {
    const col = [];
    let monthLabel = "";
    for (let d = 0; d < 7; d++) {
      const dt = new Date(startMonday);
      dt.setDate(startMonday.getDate() + w * 7 + d);
      if (dt.getDate() <= 7 && d === 0) monthLabel = MONTH_ABBR[dt.getMonth()].slice(0, 3);
      const iso = dt.toISOString().slice(0, 10);
      col.push({ iso, pnl: byDay[iso]?.pnl || 0, count: byDay[iso]?.count || 0, cls: byDay[iso]?.cls });
    }
    heat.push(col);
    monthColLabels.push(monthLabel);
  }
  const heatColor = (cell) => {
    if (!cell.count) return "var(--tj-border)";
    if (cell.cls === "win") return cell.pnl > 200 ? "#166534" : UI_COLORS.primary;
    if (cell.cls === "loss") return cell.pnl < -200 ? "#991B1B" : UI_COLORS.danger;
    return UI_COLORS.info;
  };

  return (
    <div>
      <div className="tj-cal-tabs">
        <button className={`tj-newstab ${calTab === "calendar" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("calendar")}>📅 Calendar</button>
        <button className={`tj-newstab ${calTab === "monthly" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("monthly")}>Monthly</button>
        <button className={`tj-newstab ${calTab === "weekly" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("weekly")}>Weekly</button>
        <button className={`tj-newstab ${calTab === "daily" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("daily")}>Daily</button>
      </div>

      {calTab === "calendar" && (
        <div className="tj-row2">
          <div>
            <Card className="tj-panel">
              <div className="tj-panel-head">
                <span>{MONTH_NAMES[month]} {year}</span>
                <div className="tj-month-nav">
                  <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
                  <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
                </div>
              </div>
              <div className="tj-month-summary">
                <div><div className="tj-green tj-mnum">{monthProfit}</div><div className="tj-mlabel">PROFIT</div></div>
                <div><div className="tj-red tj-mnum">{monthLoss}</div><div className="tj-mlabel">LOSS</div></div>
                <div><div className="tj-blue tj-mnum">{monthBE}</div><div className="tj-mlabel">B/E</div></div>
                <div><div className="tj-mnum">{monthTrades.length}</div><div className="tj-mlabel">TRADES</div></div>
              </div>
              <div className="tj-cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
              <div className="tj-cal-grid">
                {weeks.flat().map((cell, i) => (
                  <div key={i}
                    className={`tj-cal-cell tj-dock-cell ${cell ? `tj-cal-${cell.cls || "none"}` : "tj-cal-empty"} ${cell?.iso === todayISO() ? "tj-cal-today" : ""} ${cell && cell.count > 0 ? "tj-cal-clickable" : ""}`}
                    onClick={() => cell && cell.count > 0 && onDayClick(cell.iso)}>
                    {cell && (<><div className="tj-cal-day">{cell.day}</div>{cell.count > 0 && <div className="tj-cal-tcount">{cell.count} {cell.count === 1 ? "Trade" : "Trades"}</div>}</>) }
                  </div>
                ))}
              </div>
            </Card>

            <Card className="tj-panel" style={{ marginTop: 16 }}>
              <div className="tj-panel-head"><span>Activity Heatmap</span></div>
              <div className="tj-heat-sub">Last {weeksBack} weeks · Mon → Sun · click any cell to see trades</div>
              <div className="tj-heat-months">{monthColLabels.map((m, i) => <span key={i} className="tj-heat-month-label">{m}</span>)}</div>
              <div className="tj-heatmap">
                {heat.map((col, i) => (
                  <div key={i} className="tj-heat-col">{col.map((cell, j) => <div key={j} className="tj-heat-cell" style={{ background: heatColor(cell) }} title={`${cell.iso}: ${fmtMoney(cell.pnl)}`} />)}</div>
                ))}
              </div>
              <div className="tj-heat-legend">
                <span>Less</span>
                <span className="tj-heat-cell" style={{ background: "var(--tj-border)" }} />
                <span className="tj-heat-cell" style={{ background: UI_COLORS.primary }} />
                <span className="tj-heat-cell" style={{ background: "#15803D" }} />
                <span>More Profit</span>
                <span style={{ marginLeft: 14 }}>|</span>
                <span className="tj-heat-cell" style={{ background: UI_COLORS.danger }} />
                <span className="tj-heat-cell" style={{ background: "#991B1B" }} />
                <span>Loss</span>
                <span className="tj-heat-cell" style={{ background: UI_COLORS.info, marginLeft: 14 }} />
                <span>B/E</span>
              </div>
            </Card>
          </div>

          <Card className="tj-panel">
            <div className="tj-panel-head"><span>Weekly P&L</span></div>
            {weeklyBreakdown.length === 0 ? <div className="tj-empty">No trades this month.</div> : (
              <div className="tj-weekly-list">
                {weeklyBreakdown.map((w, i) => (
                  <div key={i} className="tj-weekly-item">
                    <div className="tj-weekly-item-label">{w.label}</div>
                    <div className={`tj-weekly-item-num ${w.pnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(w.pnl)}</div>
                    <div className="tj-weekly-item-sub"><span className={wrColorClass(w.winRate)}>{w.winRate.toFixed(0)}%</span> · {w.count}t</div>
                    <div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(w.winRate)}`} style={{ width: `${w.winRate}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {calTab === "monthly" && (
        <PerformanceTable title="Monthly Performance" unitLabel="month" rows={computeMonthlyPerformance(account.trades, account.breakevenCap, account.balance)} />
      )}
      {calTab === "weekly" && (
        <PerformanceTable title="Weekly Performance" unitLabel="week" rows={computeWeeklyPerformanceAll(account.trades, account.breakevenCap, account.balance)} />
      )}
      {calTab === "daily" && (
        <DailyPerformanceView trades={account.trades} cap={account.breakevenCap} />
      )}
    </div>
  );
}

/* =============================== PSYCHOLOGY ============================= */

function PsychologyPage({ account }) {
  const trades = account.trades;
  const cap = account.breakevenCap;
  const moodMap = {};
  trades.forEach((t) => {
    if (!moodMap[t.moodBefore]) moodMap[t.moodBefore] = { count: 0, wins: 0 };
    moodMap[t.moodBefore].count++;
    if (classify(t.pnl, cap) === "win") moodMap[t.moodBefore].wins++;
  });
  const moodData = Object.entries(moodMap).map(([mood, v]) => ({ mood, count: v.count, winRate: (v.wins / v.count) * 100 }))
    .sort((a, b) => b.count - a.count);

  const mistakeMap = {};
  trades.forEach((t) => t.mistakes.forEach((m) => { mistakeMap[m] = (mistakeMap[m] || 0) + 1; }));
  const mistakeList = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="tj-row2">
      <Card className="tj-panel">
        <div className="tj-panel-head"><span>Win Rate by Emotion</span></div>
        {moodData.length === 0 ? <div className="tj-empty">Log trades with a mood to see this.</div> : (
          <div className="tj-mood-list">
            {moodData.map((m) => (
              <div key={m.mood}>
                <div className="tj-mood-header"><span className="tj-bold">{m.mood}</span><span className={`tj-bold ${wrColorClass(m.winRate)}`}>{m.winRate.toFixed(0)}%</span></div>
                <div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(m.winRate)}`} style={{ width: `${m.winRate}%` }} /></div>
                <div className="tj-muted-txt" style={{ fontSize: 11, marginTop: 2 }}>{m.count} trades</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="tj-panel">
        <div className="tj-panel-head"><span>Mistakes</span></div>
        {mistakeList.length === 0 ? <div className="tj-empty">No mistakes</div> : (
          <div className="tj-mistake-list">
            {mistakeList.map(([m, count]) => (
              <div key={m} className="tj-mistake-row"><span>{m}</span><span className="tj-tag tj-tag-red tj-tag-active tj-tag-xs">{count}</span></div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================================ INSIGHTS =============================== */

function InsightsPage({ account }) {
  const trades = account.trades;
  const cap = account.breakevenCap;
  if (trades.length < 3) {
    return <Card className="tj-panel"><div className="tj-empty">Log a few more trades and Insights will start surfacing patterns automatically.</div></Card>;
  }
  const tagMap = {};
  trades.forEach((t) => {
    const tag = t.entryType || t.confluenceSession;
    if (!tag) return;
    if (!tagMap[tag]) tagMap[tag] = { tag, count: 0, netPnl: 0, wins: 0 };
    tagMap[tag].count++; tagMap[tag].netPnl += t.pnl;
    if (classify(t.pnl, cap) === "win") tagMap[tag].wins++;
  });
  const tagStats = Object.values(tagMap).map((t) => ({ ...t, winRate: (t.wins / t.count) * 100 }));
  const bestTag = tagStats.sort((a, b) => b.netPnl - a.netPnl)[0];

  const assetMap = {};
  trades.forEach((t) => {
    if (!assetMap[t.asset]) assetMap[t.asset] = { asset: t.asset, count: 0, netPnl: 0, wins: 0 };
    assetMap[t.asset].count++; assetMap[t.asset].netPnl += t.pnl;
    if (classify(t.pnl, cap) === "win") assetMap[t.asset].wins++;
  });
  const assetStats = Object.values(assetMap).map((a) => ({ ...a, winRate: (a.wins / a.count) * 100 }));
  const bestAsset = assetStats.sort((a, b) => b.winRate - a.winRate)[0];

  const sessionMap = {};
  trades.forEach((t) => {
    if (!sessionMap[t.session]) sessionMap[t.session] = { session: t.session, count: 0, netPnl: 0, wins: 0 };
    sessionMap[t.session].count++; sessionMap[t.session].netPnl += t.pnl;
    if (classify(t.pnl, cap) === "win") sessionMap[t.session].wins++;
  });
  const sessionStats = Object.values(sessionMap).map((s) => ({ ...s, winRate: (s.wins / s.count) * 100 }));
  const bestSession = sessionStats.sort((a, b) => b.netPnl - a.netPnl)[0];

  const expectancy = trades.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;

  return (
    <>
      {bestTag && (
        <Card className="tj-panel" style={{ marginBottom: 14 }}>
          <div className="tj-panel-head"><span>🔑 Best Entry Type</span></div>
          <div className="tj-setup-card" style={{ maxWidth: 280 }}>
            <div className="tj-bold">{bestTag.tag}</div>
            <div className="tj-green tj-bold" style={{ fontSize: 16 }}>{fmtMoney(bestTag.netPnl)}</div>
            <div className="tj-muted-txt" style={{ fontSize: 11, marginBottom: 6 }}><span className={wrColorClass(bestTag.winRate)}>{bestTag.winRate.toFixed(0)}% WR</span> · {bestTag.count}t</div>
            <div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(bestTag.winRate)}`} style={{ width: `${bestTag.winRate}%` }} /></div>
          </div>
        </Card>
      )}
      {bestAsset && (
        <Card className="tj-panel" style={{ marginBottom: 14 }}>
          <div className="tj-panel-head"><span>⭐ Best Instruments by Win Rate</span></div>
          <div className="tj-setup-card" style={{ maxWidth: 220 }}>
            <div className="tj-bold">{bestAsset.asset}</div>
            <div className={`tj-bold ${wrColorClass(bestAsset.winRate)}`} style={{ fontSize: 20 }}>{bestAsset.winRate.toFixed(0)}%</div>
            <div className="tj-muted-txt" style={{ fontSize: 11 }}>{bestAsset.count} trades · {fmtMoney(bestAsset.netPnl)}</div>
          </div>
        </Card>
      )}
      <div className="tj-insight-grid">
        {bestSession && (
          <div className="tj-insight-card">
            <div className="tj-insight-title"><Trophy size={16} color="#FBBF24" /> Best session: {bestSession.session}</div>
            <div className="tj-muted-txt">Your highest P&amp;L comes from {bestSession.session} (<span className={wrColorClass(bestSession.winRate)}>{bestSession.winRate.toFixed(0)}% WR</span>, {fmtMoneyShort(bestSession.netPnl)}). Prioritize this window.</div>
          </div>
        )}
        {bestAsset && (
          <div className="tj-insight-card">
            <div className="tj-insight-title"><Star size={16} color="#FBBF24" /> Best instrument: {bestAsset.asset}</div>
            <div className="tj-muted-txt">{bestAsset.asset} yields {fmtMoneyShort(bestAsset.netPnl)} with <span className={wrColorClass(bestAsset.winRate)}>{bestAsset.winRate.toFixed(0)}% WR</span> across {bestAsset.count} trades.</div>
          </div>
        )}
        {bestTag && (
          <div className="tj-insight-card">
            <div className="tj-insight-title"><Key size={16} color="#FBBF24" /> Best entry type: "{bestTag.tag}"</div>
            <div className="tj-muted-txt">Trades with Entry Type "{bestTag.tag}" produce {fmtMoneyShort(bestTag.netPnl)} with <span className={wrColorClass(bestTag.winRate)}>{bestTag.winRate.toFixed(0)}% WR</span>. This is your strongest setup.</div>
          </div>
        )}
        <div className="tj-insight-card">
          <div className="tj-insight-title"><DollarSign size={16} color="#FBBF24" /> {expectancy >= 0 ? "Strong positive expectancy" : "Negative expectancy"}</div>
          <div className="tj-muted-txt">Per-trade expectancy: {fmtMoney(expectancy)}. {expectancy >= 0 ? "Your edge is real — stay consistent and scale up." : "Review your tagged mistakes before increasing size."}</div>
        </div>
      </div>
    </>
  );
}

/* ================================== NEWS ================================= */

const MOCK_EVENTS = [
  { dow: 1, time: "08:30", currency: "USD", impact: "high", title: "Non-Farm Payrolls", forecast: "185K", previous: "206K" },
  { dow: 1, time: "10:00", currency: "EUR", impact: "medium", title: "ZEW Economic Sentiment", forecast: "12.4", previous: "10.1" },
  { dow: 2, time: "02:00", currency: "GBP", impact: "low", title: "BRC Retail Sales Monitor", forecast: "0.9%", previous: "0.7%" },
  { dow: 2, time: "12:30", currency: "USD", impact: "medium", title: "Core CPI m/m", forecast: "0.3%", previous: "0.2%" },
  { dow: 3, time: "14:00", currency: "USD", impact: "high", title: "FOMC Statement", forecast: "—", previous: "—" },
  { dow: 3, time: "09:00", currency: "EUR", impact: "medium", title: "Industrial Production m/m", forecast: "-0.2%", previous: "0.1%" },
  { dow: 4, time: "08:30", currency: "USD", impact: "high", title: "Unemployment Claims", forecast: "224K", previous: "231K" },
  { dow: 4, time: "04:30", currency: "JPY", impact: "low", title: "Tertiary Industry Activity", forecast: "0.1%", previous: "-0.3%" },
  { dow: 5, time: "10:00", currency: "USD", impact: "medium", title: "Michigan Consumer Sentiment", forecast: "68.5", previous: "67.2" },
  { dow: 5, time: "05:00", currency: "AUD", impact: "low", title: "Retail Sales m/m", forecast: "0.2%", previous: "0.1%" },
];
const MOCK_HOLIDAYS = [
  { date: "Aug 25", country: "UK", name: "Summer Bank Holiday" },
  { date: "Sep 1", country: "US/CA", name: "Labor Day" },
  { date: "Oct 13", country: "US/CA", name: "Thanksgiving (CA) / Columbus Day (US)" },
  { date: "Nov 11", country: "US", name: "Veterans Day" },
];
const DOW_FULL = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const WEEK_LABELS = { "-1": "Last Week", "0": "This Week", "1": "Next Week" };

function getWeekRangeFromEvents(offset) {
  // Fallback range (used before real data loads / if unavailable): the
  // calendar week (Sun–Sat) containing "today + offset weeks".
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { sunday, saturday };
}
const fmtShortDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtLongDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function sampleWeekEvents(offset) {
  if (offset !== 0) return [];
  const { sunday } = getWeekRangeFromEvents(0);
  return MOCK_EVENTS.map((e) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + e.dow);
    const [h, m] = e.time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return {
      dateKey: d.toDateString(),
      time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      currency: e.currency, impact: e.impact, title: e.title,
      forecast: e.forecast, previous: e.previous,
    };
  });
}

function NewsPage() {
  const [impact, setImpact] = useState({ high: true, medium: true, low: false });
  const [currency, setCurrency] = useState("ALL");
  const [tab, setTab] = useState("calendar");
  const [weekOffset, setWeekOffset] = useState(0);
  const [feed, setFeed] = useState({ events: null, source: "loading", fetchedAt: null });
  const currencies = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];

  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "Local"; } })();
  const offsetMin = -new Date().getTimezoneOffset();
  const gmtLabel = `GMT${offsetMin >= 0 ? "+" : ""}${(offsetMin / 60).toFixed(offsetMin % 60 === 0 ? 0 : 1)}`;

  useEffect(() => {
    let cancelled = false;
    setFeed({ events: null, source: "loading", fetchedAt: null });
    getCalendarWeek(weekOffset).then((result) => {
      if (cancelled) return;
      if (!result.events) {
        // Live feed truly unavailable (e.g. blocked in this preview sandbox,
        // offline, or rate-limited with no prior cache) — fall back to a
        // small bundled sample so the page still demonstrates the feature.
        setFeed({ events: sampleWeekEvents(weekOffset), source: "sample", fetchedAt: null });
      } else {
        setFeed(result);
      }
    });
    return () => { cancelled = true; };
  }, [weekOffset]);

  const events = feed.events || [];
  const filtered = events.filter((e) => (impact[e.impact] || e.impact === "holiday") && (currency === "ALL" || e.currency === currency));
  const byDay = {};
  filtered.forEach((e) => { (byDay[e.dateKey] = byDay[e.dateKey] || []).push(e); });
  const dayKeysSorted = Object.keys(byDay).sort((a, b) => new Date(a) - new Date(b));
  const todayKey = new Date().toDateString();

  const highCount = filtered.filter((e) => e.impact === "high").length;
  const medCount = filtered.filter((e) => e.impact === "medium").length;
  const currencyCount = new Set(filtered.map((e) => e.currency)).size;

  const rangeFallback = getWeekRangeFromEvents(weekOffset);
  const rangeStart = dayKeysSorted.length ? new Date(dayKeysSorted[0]) : rangeFallback.sunday;
  const rangeEnd = dayKeysSorted.length ? new Date(dayKeysSorted[dayKeysSorted.length - 1]) : rangeFallback.saturday;

  const statusPill = feed.source === "live"
    ? <span className="tj-pill tj-pill-green">● LIVE FF</span>
    : feed.source === "cache"
    ? <span className="tj-pill" style={{ background: "rgba(96,165,250,0.15)", color: "#60A5FA" }}>CACHED</span>
    : feed.source === "stale-cache"
    ? <span className="tj-pill" style={{ background: "rgba(96,165,250,0.15)", color: "#60A5FA" }}>CACHED (offline)</span>
    : feed.source === "loading"
    ? <span className="tj-pill tj-pill-neutral">LOADING…</span>
    : <span className="tj-pill" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>SAMPLE DATA</span>;

  return (
    <Card className="tj-panel">
      <div className="tj-news-head">
        <div><span className="tj-bold">📅 Economic Calendar</span><div className="tj-muted-txt" style={{ fontSize: 11 }}>ForexFactory events · times shown in your timezone</div></div>
        <div className="tj-news-head-right">
          {statusPill}
          <span className="tj-tz-pill">🌐 {tz} {gmtLabel}</span>
        </div>
      </div>

      <div className="tj-news-tabs">
        <button className={`tj-newstab ${tab === "calendar" ? "tj-newstab-active" : ""}`} onClick={() => setTab("calendar")}>📅 Calendar</button>
        <button className={`tj-newstab ${tab === "holidays" ? "tj-newstab-active" : ""}`} onClick={() => setTab("holidays")}>🏦 Bank Holidays</button>
        <button className={`tj-newstab ${tab === "impact" ? "tj-newstab-active" : ""}`} onClick={() => setTab("impact")}>📊 Impact Analysis</button>
        <div className="tj-news-weeknav">
          <button className="tj-icon-btn" disabled={weekOffset <= -1} onClick={() => setWeekOffset((w) => Math.max(-1, w - 1))}><ChevronLeft size={16} /></button>
          <button className={`tj-chip ${weekOffset === 0 ? "tj-chip-active" : ""}`} onClick={() => setWeekOffset(0)}>{WEEK_LABELS[String(weekOffset)] || "This Week"}</button>
          <button className="tj-icon-btn" disabled={weekOffset >= 1} onClick={() => setWeekOffset((w) => Math.min(1, w + 1))}><ChevronRight size={16} /></button>
          <span className="tj-muted-txt" style={{ fontSize: 12 }}>{fmtShortDate(rangeStart)} – {fmtShortDate(rangeEnd)}</span>
        </div>
      </div>

      {tab === "calendar" && (
        <>
          <div className="tj-news-filters">
            <span className="tj-mlabel">IMPACT:</span>
            {["high", "medium", "low"].map((lvl) => (
              <button key={lvl} className={`tj-impact-chip tj-impact-${lvl} ${impact[lvl] ? "tj-impact-on" : ""}`}
                onClick={() => setImpact((i) => ({ ...i, [lvl]: !i[lvl] }))}>{lvl[0].toUpperCase() + lvl.slice(1)}</button>
            ))}
            <span className="tj-mlabel" style={{ marginLeft: 14 }}>CURRENCY:</span>
            {currencies.map((c) => (
              <button key={c} className={`tj-chip ${currency === c ? "tj-chip-active" : ""}`} onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>

          <div className="tj-news-infobar">
            <span>⚡ All times shown in: <span className="tj-purple-txt">{tz} {gmtLabel}</span></span>
            <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="tj-openff">Open FF ↗</a>
          </div>

          <div className="tj-news-stats">
            <div><div className="tj-mnum">{filtered.length}</div><div className="tj-mlabel">EVENTS THIS WEEK</div></div>
            <div><div className="tj-mnum tj-red">{highCount}</div><div className="tj-mlabel">HIGH IMPACT 🔴</div></div>
            <div><div className="tj-mnum" style={{ color: "#FBBF24" }}>{medCount}</div><div className="tj-mlabel">MEDIUM IMPACT 🟠</div></div>
            <div><div className="tj-mnum tj-purple-txt">{currencyCount}</div><div className="tj-mlabel">CURRENCIES</div></div>
          </div>

          {feed.source === "loading" ? (
            <div className="tj-empty-block"><div className="tj-spinner" style={{ margin: "0 auto" }} /><div className="tj-empty-sub" style={{ marginTop: 10 }}>Loading calendar…</div></div>
          ) : dayKeysSorted.length === 0 ? (
            <div className="tj-empty-block">
              <div style={{ fontSize: 32 }}>📅</div>
              <div className="tj-empty-title">No events match your filters this week</div>
              <div className="tj-empty-sub">Try adjusting the impact filter or switching weeks</div>
            </div>
          ) : (
            dayKeysSorted.map((key) => {
              const d = new Date(key);
              const isToday = key === todayKey;
              const isPast = d < new Date(new Date().toDateString());
              const redFolderCount = byDay[key].filter((e) => e.impact === "high").length;
              return (
                <div key={key} className="tj-news-day-block">
                  <div className="tj-news-day-head">
                    <span className="tj-news-day-title">{DOW_FULL[d.getDay()]}, {fmtLongDate(d).toUpperCase()}</span>
                    {isToday && <span className="tj-daytag tj-daytag-today">TODAY</span>}
                    {isPast && !isToday && <span className="tj-daytag tj-daytag-past">PAST</span>}
                    <span className="tj-news-day-count">{byDay[key].length} event{byDay[key].length !== 1 ? "s" : ""}{redFolderCount > 0 ? ` · ${redFolderCount} red folder${redFolderCount !== 1 ? "s" : ""}` : ""}</span>
                  </div>
                  <div className="tj-event-list">
                    {byDay[key].map((e, i) => (
                      <div key={i} className="tj-event-row">
                        <span className={`tj-impact-dot tj-impact-dot-${e.impact}`} />
                        <span className="tj-event-time tj-mono">{e.time}</span>
                        <span className="tj-sesspill" style={{ minWidth: 34, textAlign: "center" }}>{e.currency}</span>
                        <div className="tj-event-main">
                          <div className="tj-event-title">{e.title}</div>
                          {e.impact !== "holiday" && (
                            <div className="tj-event-sub">Prev: <span className="tj-mono">{e.previous}</span>{"   "}Fcst: <span className="tj-mono tj-purple-txt">{e.forecast}</span></div>
                          )}
                        </div>
                        <span className={`tj-impactpill tj-impactpill-${e.impact}`}>{e.impact === "holiday" ? "HOL" : e.impact === "high" ? "HIGH" : e.impact === "medium" ? "MED" : "LOW"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {tab === "holidays" && (
        <div className="tj-holiday-list">
          {MOCK_HOLIDAYS.map((h, i) => (
            <div key={i} className="tj-holiday-row">
              <span className="tj-mono tj-purple-txt" style={{ width: 60 }}>{h.date}</span>
              <span className="tj-sesspill">{h.country}</span>
              <span>{h.name}</span>
            </div>
          ))}
          <div className="tj-muted-txt" style={{ fontSize: 11, marginTop: 8 }}>Sample list — the live feed above (Calendar tab) already includes real bank holidays inline with the day they fall on.</div>
        </div>
      )}

      {tab === "impact" && (
        <div>
          <div className="tj-mlabel" style={{ marginBottom: 8 }}>EVENTS BY IMPACT ({WEEK_LABELS[String(weekOffset)] || "this week"})</div>
          {["high", "medium", "low"].map((lvl) => {
            const count = events.filter((e) => e.impact === lvl).length;
            const pct = events.length ? (count / events.length) * 100 : 0;
            const color = lvl === "high" ? UI_COLORS.danger : lvl === "medium" ? UI_COLORS.warning : UI_COLORS.primary;
            return (
              <div key={lvl} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{lvl[0].toUpperCase() + lvl.slice(1)} impact</span><span className="tj-bold">{count}</span>
                </div>
                <div className="tj-bar-track"><div className="tj-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ================================== RULES ================================ */

function RulesPage({ account, onToggleCheckin, onAddRule, onUpdateRule, onRemoveRule }) {
  const [tab, setTab] = useState("today");
  const [newRule, setNewRule] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const today = todayISO();
  const todayChecks = account.checkins[today] || {};
  const toggleRule = (id) => onToggleCheckin(id, today, !todayChecks[id]);
  const addRule = () => { if (!newRule.trim()) return; onAddRule(newRule.trim()); setNewRule(""); };
  const removeRule = (id) => onRemoveRule(id);
  const saveRuleEdit = () => {
    const text = editingRule?.text?.trim();
    if (!text || !editingRule) return;
    onUpdateRule(editingRule.id, text);
    setEditingRule(null);
  };
  const activeRules = account.rules.filter((r) => r.active);
  const historyDates = Object.keys(account.checkins).sort().reverse().slice(0, 14);

  return (
    <Card className="tj-panel">
      <div className="tj-rules-head">
        <div><div className="tj-bold" style={{ fontSize: 16 }}>Trading Rules</div><div className="tj-muted-txt" style={{ fontSize: 11 }}>{account.rules.length} rules · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div></div>
        <div className="tj-tabs">
          <button className={`tj-tab ${tab === "today" ? "tj-tab-active" : ""}`} onClick={() => setTab("today")}>📋 Today</button>
          <button className={`tj-tab ${tab === "history" ? "tj-tab-active" : ""}`} onClick={() => setTab("history")}>📅 History</button>
          <button className={`tj-tab ${tab === "manage" ? "tj-tab-active" : ""}`} onClick={() => setTab("manage")}>⚙ Manage</button>
        </div>
      </div>
      {tab === "today" && (activeRules.length === 0 ? (
        <div className="tj-empty-block">
          <ShieldCheck size={32} color="var(--tj-muted)" />
          <div className="tj-empty-title">No rules yet</div>
          <div className="tj-empty-sub">Add your trading rules first, then use this page for your daily check-in.</div>
          <button className="tj-btn-primary" onClick={() => setTab("manage")}><Plus size={14} /> Add Rules</button>
        </div>
      ) : (
        <div className="tj-rule-list">
          {activeRules.map((r) => (
            <label key={r.id} className="tj-rule-row"><span className={todayChecks[r.id] ? "tj-rule-done" : ""}>{r.text}</span><input type="checkbox" checked={!!todayChecks[r.id]} onChange={() => toggleRule(r.id)} /></label>
          ))}
        </div>
      ))}
      {tab === "history" && (historyDates.length === 0 ? <div className="tj-empty">No check-in history yet.</div> : (
        <div className="tj-history-list">
          {historyDates.map((d) => {
            const checks = account.checkins[d]; const done = Object.values(checks).filter(Boolean).length; const total = account.rules.length || 1;
            return (
              <div key={d} className="tj-history-row"><span>{d}</span><div className="tj-bar-track" style={{ flex: 1, margin: "0 10px" }}><div className="tj-bar-fill tj-bar-green" style={{ width: `${(done / total) * 100}%` }} /></div><span className="tj-mono">{done}/{total}</span></div>
            );
          })}
        </div>
      ))}
      {tab === "manage" && (
        <div>
          <div className="tj-inline-add">
            <input className="tj-input" placeholder="New rule..." value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRule()} />
            <button className="tj-btn-outline" onClick={addRule}>Add</button>
          </div>
          <div className="tj-rule-list" style={{ marginTop: 12 }}>
            {account.rules.map((r) => {
              const editing = editingRule?.id === r.id;
              return <div key={r.id} className="tj-rule-row">
                {editing ? <input autoFocus className="tj-input" value={editingRule.text} onChange={(event) => setEditingRule({ ...editingRule, text: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveRuleEdit(); if (event.key === "Escape") setEditingRule(null); }} /> : <span>{r.text}</span>}
                <span className="tj-rule-actions">
                  {editing ? <><button className="tj-icon-btn" title="Save rule" onClick={saveRuleEdit}><CheckCircle2 size={15} /></button><button className="tj-icon-btn" title="Cancel edit" onClick={() => setEditingRule(null)}><X size={15} /></button></> : <button className="tj-icon-btn" title="Edit rule" onClick={() => setEditingRule({ id: r.id, text: r.text })}><Pencil size={14} /></button>}
                  <button className="tj-icon-btn" title="Delete rule" onClick={() => removeRule(r.id)}><Trash2 size={14} /></button>
                </span>
              </div>;
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

/* =============================== MAIN APP ============================== */

/* =============================== MAIN APP ============================== */

const LEGACY_STORAGE_PREFIX = "tj:trading-journal:state:v2:";

function getLegacyLocalData(email) {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_PREFIX + email);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts : null;
  } catch (e) {
    return null;
  }
}

function MigrationPromptModal({ count, onImport, onSkip, busy }) {
  return (
    <Modal title="Import your previous local data?" onClose={onSkip}>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 16 }}>
        We found {count} trading account{count !== 1 ? "s" : ""} saved locally in this browser from before
        cloud sync was added. Would you like to import {count !== 1 ? "them" : "it"} into your account so
        it's backed up and available on any device?
      </p>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" disabled={busy} onClick={onSkip}>Skip</button>
        <button className="tj-btn-primary" disabled={busy} onClick={onImport}>{busy ? "Importing…" : "Import my data"}</button>
      </div>
    </Modal>
  );
}

function TradingJournalApp({ user, onLogout }) {
  const displayName = user.user_metadata?.display_name || (user.email ? user.email.split("@")[0] : "Trader");
  const [accounts, setAccounts] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);
  useEffect(() => {
    if (!showAccountMenu) return;
    const onDocClick = (e) => { if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setShowAccountMenu(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAccountMenu]);
  const [modal, setModal] = useState(null);
  const [dayModalDate, setDayModalDate] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null);
  const [editingMarkup, setEditingMarkup] = useState(null);
  const [imageViewerSrc, setImageViewerSrc] = useState(null);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [typeTags, setTypeTags] = useState(DEFAULT_TYPE_TAGS);
  const [mistakeTags, setMistakeTags] = useState(DEFAULT_MISTAKE_TAGS);
  const [confluenceSessions, setConfluenceSessions] = useState([]);
  const [customInstruments, setCustomInstruments] = useState([]);
  const [markups, setMarkups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth > 900));
  const [toast, setToast] = useState(null); // { type: 'error'|'info', text }
  const [migration, setMigration] = useState({ checked: false, pending: null, busy: false });

  const showError = useCallback((text) => {
    setToast({ type: "error", text });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 6000);
  }, []);

  const loadFromServer = useCallback(async () => {
    const result = await fetchAllUserData(user.id);
    if (result.error) {
      showError(result.error);
      setAccounts([]);
      setLoaded(true);
      return;
    }
    setAccounts(result.data.accounts);
    setTypeTags(result.data.typeTags || DEFAULT_TYPE_TAGS);
    setMistakeTags(result.data.mistakeTags || DEFAULT_MISTAKE_TAGS);
    setConfluenceSessions(result.data.confluenceSessions || []);
    setCustomInstruments(result.data.customInstruments || []);
    setMarkups(result.data.markups || []);
    setReviews(result.data.reviews || []);
    if (result.data.accounts.length) setActiveId(result.data.accounts[0].id);
    setLoaded(true);
  }, [user.id, showError]);

  // Initial load: fetch cloud data, and separately check for pre-Supabase
  // local data worth offering to migrate (requirement: migration strategy).
  useEffect(() => {
    (async () => {
      await loadFromServer();
      try {
        const already = await hasMigratedLocalData(user.id);
        if (!already) {
          const legacy = getLegacyLocalData(user.email);
          if (legacy && legacy.length) setMigration({ checked: true, pending: legacy, busy: false });
          else { setMigration({ checked: true, pending: null, busy: false }); await markLocalDataMigrated(user.id); }
        } else {
          setMigration({ checked: true, pending: null, busy: false });
        }
      } catch (e) {
        setMigration({ checked: true, pending: null, busy: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If a signed-up user genuinely has zero accounts (new user, and nothing
  // to migrate), give them one empty starter account instead of a dead end.
  useEffect(() => {
    if (!loaded || !migration.checked || migration.pending) return;
    if (accounts && accounts.length === 0) {
      (async () => {
        const res = await createAccount(user.id, { name: "Main Account", icon: "🦈", balance: 10000, breakevenCap: 20, ratingStyle: "stars", theme: "dark" });
        if (res.error) { showError(res.error); return; }
        setAccounts([res.data]);
        setActiveId(res.data.id);
      })();
    }
  }, [loaded, migration.checked, migration.pending, accounts, user.id, showError]);

  const runMigration = async () => {
    setMigration((m) => ({ ...m, busy: true }));
    for (const legacyAccount of migration.pending) {
      const res = await importLegacyAccount(user.id, legacyAccount);
      if (res.error) { showError(res.error); }
    }
    await markLocalDataMigrated(user.id);
    try { window.localStorage.removeItem(LEGACY_STORAGE_PREFIX + user.email); } catch (e) {}
    setMigration({ checked: true, pending: null, busy: false });
    await loadFromServer();
  };
  const skipMigration = async () => {
    await markLocalDataMigrated(user.id);
    setMigration({ checked: true, pending: null, busy: false });
  };

  const account = useMemo(() => {
    if (!accounts) return null;
    return accounts.find((a) => a.id === activeId) || accounts[0] || null;
  }, [accounts, activeId]);
  useEffect(() => {
    if (account && account.id !== activeId) setActiveId(account.id);
  }, [account, activeId]);
  const stats = useMemo(() => (account ? computeStats(account.trades, account.breakevenCap) : null), [account]);

  if (!loaded || !account || !stats) {
    return (
      <div className="tj-root tj-loading">
        <style>{CSS}</style>
        <div className="tj-spinner" />
        <div>Loading your journal…</div>
      </div>
    );
  }

  const knownInstruments = Array.from(new Set([
    ...customInstruments,
    ...account.trades.map((trade) => trade.asset),
    ...markups.filter((markup) => markup.accountId === account.id).map((markup) => markup.instrument),
  ].map((instrument) => instrument?.trim()).filter(Boolean)));

  const saveTrade = async (trade) => {
    const exists = account.trades.some((t) => t.id === trade.id);
    if (exists) {
      const res = await updateTrade(trade.id, { ...trade, userId: user.id, accountId: account.id });
      if (res.error) { showError(res.error); return; }
      setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: a.trades.map((t) => (t.id === trade.id ? trade : t)) })));
    } else {
      const res = await createTrade(user.id, account.id, trade);
      if (res.error) { showError(res.error); return; }
      setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: [...a.trades, res.data] })));
    }
    await persistCustomInstrument(trade.asset);
    setModal(null); setEditingTrade(null);
  };

  const handleDeleteTrade = async (id) => {
    const res = await deleteTrade(id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: a.trades.filter((t) => t.id !== id) })));
  };

  const addTypeTag = async (tag) => {
    if (typeTags.includes(tag)) return;
    const next = [...typeTags, tag];
    setTypeTags(next);
    const res = await saveTypeTags(user.id, next);
    if (res.error) showError(res.error);
  };
  const persistCustomInstrument = async (value) => {
    const instrument = value.trim();
    if (!instrument || DEFAULT_INSTRUMENTS.some((preset) => preset.toLowerCase() === instrument.toLowerCase()) || customInstruments.some((item) => item.toLowerCase() === instrument.toLowerCase())) return;
    const next = [...customInstruments, instrument];
    const res = await saveManagedLists(user.id, { instruments: next });
    if (res.error) return showError(res.error);
    setCustomInstruments(next);
  };
  const saveList = async (kind, next) => {
    const res = await saveManagedLists(user.id, kind === "types" ? {typeTags:next} : kind === "mistakes" ? {mistakeTags:next} : {confluenceSessions:next});
    if (res.error) return showError(res.error);
    if (kind === "types") setTypeTags(next); else if (kind === "mistakes") setMistakeTags(next); else setConfluenceSessions(next);
  };
  const handleSaveMarkup = async (markup) => {
    const exists = markups.some((item) => item.id === markup.id);
    const res = exists ? await updateMarkup(markup.id, markup) : await createMarkup(user.id, account.id, markup);
    if (res.error) return showError(res.error);
    setMarkups((items) => exists ? items.map((item) => item.id === markup.id ? res.data : item) : [res.data, ...items]);
    await persistCustomInstrument(markup.instrument);
    setModal(null); setEditingMarkup(null);
  };
  const handleDeleteMarkup = async (id) => { if(!window.confirm("Delete this markup? Linked trades will retain their historical reference as empty.")) return; const res=await deleteMarkup(id); if(res.error)return showError(res.error); setMarkups(x=>x.filter(m=>m.id!==id)); };
  const handleSaveReview = async (r) => { const res=await saveTradeReview(user.id,account.id,r); if(res.error)return showError(res.error);setReviews(x=>{const i=x.findIndex(v=>v.id===res.data.id);return i<0?[res.data,...x]:x.map(v=>v.id===res.data.id?res.data:v);}); };

  const handleResetData = async () => {
    if (!window.confirm("Delete every trade for this account and reset it to its starting balance? This can't be undone.")) return;
    const res = await resetAccountData(account.id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id === account.id ? { ...a, trades: [], checkins: {} } : a)));
  };

  const handleDeleteAccount = async (a) => {
    if (!window.confirm(`Delete "${a.name}"? All its trades and history will be permanently lost.`)) return;
    const res = await deleteAccount(a.id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => {
      const remaining = accs.filter((acc) => acc.id !== a.id);
      if (a.id === activeId) setActiveId(remaining[0]?.id || null);
      return remaining;
    });
  };

  const handleCreateAccount = async (fields) => {
    const res = await createAccount(user.id, fields);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => [...accs, res.data]);
    setActiveId(res.data.id);
    setModal(null);
  };

  const handleSaveAccountSettings = async (updated) => {
    const res = await updateAccount(updated.id, updated);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id === updated.id ? updated : a)));
    setModal(null);
  };

  const handleToggleCheckin = async (ruleId, date, checked) => {
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, checkins: { ...a.checkins, [date]: { ...(a.checkins[date] || {}), [ruleId]: checked } } })));
    const res = await setCheckin(user.id, account.id, ruleId, date, checked);
    if (res.error) showError(res.error);
  };
  const handleAddRule = async (text) => {
    const res = await createRule(user.id, account.id, text);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, rules: [...a.rules, res.data] })));
  };
  const handleRemoveRule = async (id) => {
    const res = await deleteRule(id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, rules: a.rules.filter((r) => r.id !== id) })));
  };
  const handleUpdateRule = async (id, text) => {
    const res = await updateRule(id, text);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, rules: a.rules.map((rule) => rule.id === id ? res.data : rule) })));
  };

  const netTotal = account.balance + stats.netPnl;
  const netPct = account.balance ? (stats.netPnl / account.balance) * 100 : 0;

  return (
    <ImageViewerContext.Provider value={setImageViewerSrc}>
    <div className={`tj-root ${account.theme === "light" ? "tj-theme-light" : "tj-theme-dark"}`}>
      <style>{CSS}</style>
      {toast && <div className={`tj-toast tj-toast-${toast.type}`}>{toast.text}</div>}
      <div className={`tj-sidebar ${sidebarOpen ? "tj-sidebar-shown" : "tj-sidebar-collapsed"}`}>
        <div className="tj-sidebar-scroll">
          <div className="tj-logo" aria-label="AAICOREFX CoreFX">
            <img src={logoUrl} alt="AAICOREFX CoreFX" />
          </div>
          <div className="tj-nav-label">NAVIGATION</div>
          <div className="tj-nav">{NAV.map((n) => <button key={n.id} className={`tj-nav-item ${page === n.id ? "tj-nav-active" : ""}`} onClick={() => { setPage(n.id); setShowAccountMenu(false); if (window.innerWidth <= 900) setSidebarOpen(false); }}><n.icon size={16} /> <span>{n.label}</span></button>)}</div>
          <div className="tj-nav-label">SETTINGS</div>
          <div className="tj-nav">
            <button className="tj-nav-item" onClick={() => setModal("editaccount")}><Settings size={16} /> <span>Settings &amp; Account</span></button>
            <button className="tj-nav-item" onClick={handleResetData}><Trash2 size={16} /> <span>Reset Data</span></button>
            <button className="tj-nav-item tj-nav-danger" onClick={onLogout}><LogOut size={16} /> <span>Log Out</span></button>
          </div>
          <div className="tj-logged-in-as">Logged in as <span className="tj-bold">{displayName}</span></div>
        </div>
        <div className="tj-sidebar-footer" ref={accountMenuRef}>
          {showAccountMenu && (
            <div className="tj-account-menu">
              <div className="tj-account-menu-head">
                <div className="tj-avatar">{account.icon}</div>
                <div><div className="tj-account-name">{account.name}</div><div className="tj-account-sub">${account.balance.toLocaleString()} <span className={netPct >= 0 ? "tj-green" : "tj-red"}>({netPct >= 0 ? "+" : ""}{netPct.toFixed(2)}%)</span></div></div>
              </div>
              <div className="tj-account-balance-row">
                <div><div className="tj-mono tj-bold">${netTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div className="tj-mlabel">BALANCE</div></div>
                <div><div className={`tj-mono tj-bold ${stats.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoneyShort(stats.netPnl)}</div><div className="tj-mlabel">P&amp;L</div></div>
              </div>
              <div className="tj-nav-label" style={{ marginTop: 10 }}>ACCOUNTS</div>
              {accounts.map((a) => (
                <div key={a.id} className={`tj-account-row-wrap ${a.id === activeId ? "tj-account-row-active" : ""}`}>
                  <button className="tj-account-row" onClick={() => { setActiveId(a.id); setShowAccountMenu(false); }}>
                    <span className="tj-avatar-sm">{a.icon}</span><span className="tj-account-row-name">{a.name}{a.id === activeId && <span className="tj-active-tag">• Active</span>}</span>
                  </button>
                  {accounts.length > 1 && (
                    <button className="tj-account-delete" title="Delete account" onClick={(e) => { e.stopPropagation(); handleDeleteAccount(a); }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
              <button className="tj-account-row tj-add-account" onClick={() => { setModal("addaccount"); setShowAccountMenu(false); }}><Plus size={14} /> Add Account</button>
            </div>
          )}
          <button className="tj-sidebar-user" onClick={() => setShowAccountMenu((v) => !v)}>
            <div className="tj-avatar">{account.icon}</div>
            <div style={{ textAlign: "left" }}><div className="tj-account-name">{account.name.length > 14 ? account.name.slice(0, 14) + "…" : account.name}</div><div className="tj-account-sub">${account.balance.toLocaleString()} <span className={netPct >= 0 ? "tj-green" : "tj-red"}>({netPct >= 0 ? "+" : ""}{netPct.toFixed(2)}%)</span></div></div>
          </button>
        </div>
      </div>
      {sidebarOpen && <div className="tj-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className="tj-main">
        <div className="tj-topbar">
          <div className="tj-topbar-left">
            <button className="tj-icon-btn" onClick={() => setSidebarOpen((v) => !v)}><Menu size={18} /></button>
            <div><div className="tj-page-title">{NAV.find((n) => n.id === page)?.label || "Settings"}</div><div className="tj-page-sub">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div></div>
          </div>
          <div className="tj-topbar-account">{account.name}</div>
          <button className="tj-btn-primary" onClick={() => { setEditingTrade(null); setModal("newtrade"); }}><Plus size={16} /> New Trade</button>
        </div>
        <div className="tj-content">
          {page === "dashboard" && <DashboardPage account={account} stats={stats} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={setDayModalDate} />}
          {page === "tradelog" && <TradeLogPage account={account} reviews={reviews.filter((review) => review.accountId === account.id)} onNewTrade={() => { setEditingTrade(null); setModal("newtrade"); }} onEdit={(t) => { setEditingTrade(t); setModal("newtrade"); }} onDelete={handleDeleteTrade} />}
          {page === "analytics" && <AnalyticsPage account={account} />}
          {page === "calendar" && <CalendarPage account={account} markups={markups.filter((markup)=>markup.accountId===account.id)} reviews={reviews.filter((review)=>review.accountId===account.id)} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={setDayModalDate} />}
          {page === "psychology" && <PsychologyPage account={account} />}
          {page === "insights" && <InsightsPage account={account} />}
          {page === "news" && <NewsPage />}
          {page === "rules" && <RulesPage account={account} onToggleCheckin={handleToggleCheckin} onAddRule={handleAddRule} onUpdateRule={handleUpdateRule} onRemoveRule={handleRemoveRule} />}
          {page === "management" && <ManagementPage typeTags={typeTags} mistakeTags={mistakeTags} confluenceSessions={confluenceSessions} onTypeTags={(x)=>saveList("types",x)} onMistakes={(x)=>saveList("mistakes",x)} onConfluence={(x)=>saveList("confluence",x)} />}
          {page === "markups" && <MarkupsPage markups={markups.filter((markup)=>markup.accountId===account.id)} trades={account.trades} onNew={()=>{setEditingMarkup(null);setModal("markup");}} onEdit={(markup)=>{setEditingMarkup(markup);setModal("markup");}} onDelete={handleDeleteMarkup} />}
          {page === "reviews" && <ReviewsPage reviews={reviews.filter(r=>r.accountId===account.id)} trades={account.trades} onSave={handleSaveReview} />}
        </div>
      </div>
      {modal === "newtrade" && <NewTradeModal editing={editingTrade} typeTags={typeTags} mistakeTags={mistakeTags} confluenceSessions={confluenceSessions} instruments={knownInstruments} markups={markups.filter((markup)=>markup.accountId===account.id)} rules={account.rules} defaultCommission={account.defaultCommission} onClose={() => { setModal(null); setEditingTrade(null); }} onSave={saveTrade} />}
      {modal === "editaccount" && <AccountSettingsModal account={account} onClose={() => setModal(null)} onSave={handleSaveAccountSettings} />}
      {modal === "markup" && <MarkupModal editing={editingMarkup} instruments={knownInstruments} onClose={()=>{setModal(null);setEditingMarkup(null);}} onSave={handleSaveMarkup} />}
      {modal === "addaccount" && <AddAccountModal onClose={() => setModal(null)} onCreate={handleCreateAccount} />}
      {dayModalDate && (
        <DayTradesModal
          date={dayModalDate}
          trades={account.trades.filter((t) => t.date === dayModalDate)}
          markups={markups.filter((markup) => markup.accountId === account.id && markup.date === dayModalDate)}
          reviews={reviews.filter((review) => review.accountId === account.id && review.date === dayModalDate)}
          account={account}
          onClose={() => setDayModalDate(null)}
          onEdit={(t) => { setDayModalDate(null); setEditingTrade(t); setModal("newtrade"); }}
          onDelete={(id) => handleDeleteTrade(id)}
        />
      )}
      {migration.pending && (
        <MigrationPromptModal count={migration.pending.length} busy={migration.busy} onImport={runMigration} onSkip={skipMigration} />
      )}
    </div>
    <ImageViewer src={imageViewerSrc} onClose={() => setImageViewerSrc(null)} />
    </ImageViewerContext.Provider>
  );
}

/* ================================== CSS ================================= */

const CSS = `
.tj-toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 200000; padding: 12px 20px; border-radius: 10px; font-size: 13.5px; font-weight: 600; box-shadow: 0 12px 30px rgba(0,0,0,0.5); max-width: 90vw; text-align: center; }
.tj-toast-error { background: #2A1215; border: 1px solid #F87171; color: #F87171; }
.tj-toast-info { background: #12241A; border: 1px solid var(--tj-green); color: var(--tj-green); }
:root {
  --tj-bg: #0A121B; --tj-panel: #101B27; --tj-panel-alt: #162432; --tj-border: #2B3B4C;
  --tj-text: #F2F6FA; --tj-muted: #A5B4C7; --tj-green: #228B22; --tj-red: #FB7185;
  --tj-purple: #8B7CF6; --tj-blue: #60A5FA; --tj-amber: #FBBF24;
  --tj-input-bg: #0D1823; --tj-chart-bg: #101B27; --tj-chart-grid: #29394A; --tj-chart-text: #C8D4E0;
  --tj-tooltip-bg: #222730; --tj-primary-hover: #1B6F1B; --tj-primary-muted: rgba(34,139,34,0.22);
  --tj-shadow: 0 16px 36px rgba(0,0,0,0.32); --tj-primary-contrast: #FFFFFF; --tj-grid-line: rgba(148,163,184,0.05);
}
.tj-theme-light {
  --tj-bg: #F3F6F4; --tj-panel: #FFFFFF; --tj-panel-alt: #F7FAF8; --tj-border: #D4E1D7;
  --tj-text: #17221A; --tj-muted: #65746A; --tj-green: #228B22; --tj-red: #C7374B;
  --tj-purple: #6D5FD8; --tj-blue: #2563EB; --tj-amber: #B45309;
  --tj-input-bg: #FFFFFF; --tj-chart-bg: #FFFFFF; --tj-chart-grid: #D7E1D9; --tj-chart-text: #536258;
  --tj-tooltip-bg: #FFFFFF; --tj-primary-hover: #1B6F1B; --tj-primary-muted: rgba(34,139,34,0.12);
  --tj-shadow: 0 14px 30px rgba(19,35,26,0.10); --tj-primary-contrast: #FFFFFF; --tj-grid-line: rgba(34,139,34,0.06);
}
.tj-theme-light .tj-modal-overlay { background: rgba(0,0,0,0.35); }
.tj-theme-light .tj-backdrop { background: rgba(0,0,0,0.35); }
.tj-theme-light ::placeholder { color: #9CA3AF; }
.tj-theme-light .tj-btn-primary, .tj-theme-light .auth-submit { color: #FFFFFF; }
.tj-theme-light .tj-panel, .tj-theme-light .tj-modal { box-shadow: 0 5px 18px rgba(15,23,42,0.07); }
.tj-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: var(--tj-bg); background-image: linear-gradient(var(--tj-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--tj-grid-line) 1px, transparent 1px); background-size: 32px 32px; color: var(--tj-text); display: flex; height: 100vh; width: 100%; font-size: 14px; overflow: hidden; }
.tj-loading { align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--tj-muted); }
.tj-spinner { width: 28px; height: 28px; border: 3px solid var(--tj-border); border-top-color: var(--tj-purple); border-radius: 50%; animation: tj-spin 0.8s linear infinite; }
@keyframes tj-spin { to { transform: rotate(360deg); } }
.tj-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.tj-bold { font-weight: 700; }
.tj-green { color: var(--tj-green); } .tj-red { color: var(--tj-red); } .tj-blue { color: var(--tj-blue); }
.tj-muted-txt { color: var(--tj-muted); } .tj-purple-txt { color: var(--tj-purple); }

.tj-sidebar { width: 220px; min-width: 220px; height: 100vh; background: color-mix(in srgb, var(--tj-panel) 96%, transparent); border-right: 1px solid var(--tj-border); display: flex; flex-direction: column; padding: 18px 14px; position: relative; flex-shrink: 0; transition: transform 0.25s, width 0.2s, min-width 0.2s; box-shadow: 12px 0 28px rgba(0,0,0,0.08); }
.tj-sidebar-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.tj-sidebar-collapsed { width: 0; min-width: 0; padding: 0; overflow: hidden; border: none; }
.tj-backdrop { display: none; }
.tj-logo { height: 76px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--tj-border); border-radius: 12px; background: linear-gradient(135deg, var(--tj-panel-alt), var(--tj-panel)); padding: 6px; text-align: center; margin-bottom: 22px; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
.tj-logo img { display: block; width: 64px; height: 64px; object-fit: contain; border-radius: 50%; mix-blend-mode: screen; filter: brightness(1.5) contrast(1.18) drop-shadow(0 2px 5px rgba(0,0,0,.18)); }
.tj-theme-light .tj-logo img { mix-blend-mode: multiply; filter: contrast(1.1) drop-shadow(0 2px 5px rgba(0,0,0,.12)); }
.tj-nav-label { font-size: 10px; letter-spacing: 1.2px; color: var(--tj-muted); margin: 14px 4px 8px; font-weight: 600; }
.tj-nav { display: flex; flex-direction: column; gap: 2px; }
.tj-nav-item { display: flex; align-items: center; gap: 10px; background: none; border: 1px solid transparent; color: var(--tj-muted); padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 13.5px; text-align: left; font-family: inherit; transition: background .16s ease, color .16s ease, border-color .16s ease; }
.tj-nav-item:hover { background: var(--tj-panel-alt); color: var(--tj-text); }
.tj-nav-active { background: var(--tj-primary-muted); border-color: rgba(34,139,34,0.34); color: var(--tj-green) !important; font-weight: 700; box-shadow: inset 3px 0 0 var(--tj-green); }
.tj-nav-danger:hover { color: var(--tj-red) !important; }
.tj-logged-in-as { font-size: 10.5px; color: var(--tj-muted); text-align: center; margin-top: 8px; padding: 0 4px; }
.tj-sidebar-footer { position: relative; flex-shrink: 0; padding-top: 10px; }
.tj-sidebar-user { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 8px 10px; cursor: pointer; font-family: inherit; color: var(--tj-text); }
.tj-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--tj-panel); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.tj-avatar-sm { width: 22px; height: 22px; border-radius: 50%; background: var(--tj-panel); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
.tj-account-name { font-size: 13px; font-weight: 600; } .tj-account-sub { font-size: 11px; color: var(--tj-muted); }
.tj-account-menu { position: absolute; bottom: 58px; left: 0; width: 260px; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 12px; padding: 14px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); z-index: 30; }
.tj-account-menu-head { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.tj-account-balance-row { display: flex; gap: 16px; background: var(--tj-panel); border: 1px solid var(--tj-border); border-radius: 8px; padding: 8px 10px; }
.tj-account-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; background: none; border: none; color: var(--tj-text); padding: 8px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; text-align: left; }
.tj-account-row-wrap { display: flex; align-items: center; margin-top: 2px; border-radius: 8px; }
.tj-account-row-wrap:hover { background: var(--tj-panel); }
.tj-account-row-active { background: rgba(139,124,246,0.15); }
.tj-account-delete { background: none; border: none; color: var(--tj-muted); cursor: pointer; padding: 6px; border-radius: 6px; flex-shrink: 0; }
.tj-account-delete:hover { color: var(--tj-red); background: rgba(248,113,113,0.12); }
.tj-account-row-name { display: flex; flex-direction: column; } .tj-active-tag { font-size: 10px; color: var(--tj-green); } .tj-add-account { color: var(--tj-purple); }

.tj-main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100vh; overflow: hidden; }
.tj-topbar { display: flex; align-items: center; justify-content: space-between; padding: 15px 24px; border-bottom: 1px solid var(--tj-border); background: color-mix(in srgb, var(--tj-panel) 90%, transparent); backdrop-filter: blur(14px); gap: 12px; }
.tj-topbar-left { display: flex; align-items: center; gap: 10px; }
.tj-page-title { font-weight: 700; font-size: 16px; } .tj-page-sub { font-size: 11px; color: var(--tj-muted); }
.tj-topbar-account { color: var(--tj-green); font-weight: 700; flex: 1; text-align: center; font-size: 12px; letter-spacing: .02em; }
.tj-content { padding: 22px 24px 32px; overflow-y: auto; flex: 1; min-height: 0; }
.tj-topbar { flex-shrink: 0; }

.tj-btn-primary { background: var(--tj-green); color: var(--tj-primary-contrast); border: 1px solid var(--tj-green); border-radius: 8px; padding: 9px 16px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; white-space: nowrap; box-shadow: 0 7px 16px rgba(34,139,34,0.22); transition: transform .16s ease, background .16s ease, box-shadow .16s ease; }
.tj-btn-primary:hover { background: var(--tj-primary-hover); transform: translateY(-1px); box-shadow: 0 9px 20px rgba(34,139,34,0.28); }
.tj-btn-outline { background: none; border: 1px solid var(--tj-border); color: var(--tj-text); border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.tj-btn-outline:hover { background: var(--tj-panel-alt); }
.tj-icon-btn { background: none; border: none; color: var(--tj-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: inline-flex; }
.tj-icon-btn:hover { background: var(--tj-panel-alt); color: var(--tj-text); }
.tj-fab { position: sticky; bottom: 16px; margin: 16px auto 0; display: flex; background: var(--tj-green); color: var(--tj-primary-contrast); border: none; border-radius: 24px; padding: 10px 18px; font-weight: 700; cursor: pointer; align-items: center; gap: 6px; box-shadow: var(--tj-shadow); }

.tj-card { background: color-mix(in srgb, var(--tj-panel) 96%, transparent); border: 1px solid var(--tj-border); border-radius: 12px; box-shadow: 0 8px 22px rgba(0,0,0,0.05); }
.tj-stats-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.tj-command-panel { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 20px 22px; margin-bottom: 16px; background: linear-gradient(112deg, color-mix(in srgb, var(--tj-panel) 98%, transparent), color-mix(in srgb, var(--tj-panel-alt) 86%, var(--tj-green) 14%)); }
.tj-command-panel::after { content: ""; position: absolute; inset: auto -46px -72px auto; width: 240px; height: 240px; border-radius: 50%; border: 1px solid rgba(34,139,34,.20); box-shadow: 0 0 0 32px rgba(34,139,34,.035), 0 0 0 64px rgba(34,139,34,.025); pointer-events: none; }
.tj-command-copy { min-width: 0; position: relative; z-index: 1; }
.tj-command-eyebrow { display: flex; align-items: center; gap: 7px; color: var(--tj-green); font-size: 10px; font-weight: 800; letter-spacing: .13em; }
.tj-command-live { width: 7px; height: 7px; border-radius: 999px; background: var(--tj-green); box-shadow: 0 0 0 4px var(--tj-primary-muted); }
.tj-command-title { max-width: 560px; margin-top: 8px; font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: clamp(19px, 2vw, 27px); font-weight: 750; letter-spacing: -.035em; line-height: 1.12; }
.tj-command-sub { color: var(--tj-muted); font-size: 12.5px; margin-top: 7px; }
.tj-command-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(100px, 1fr)); gap: 8px; min-width: min(100%, 530px); }
.tj-command-metric { min-width: 0; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--tj-border) 88%, var(--tj-green) 12%); background: color-mix(in srgb, var(--tj-panel) 78%, transparent); border-radius: 9px; }
.tj-command-metric span { display: block; color: var(--tj-muted); font-size: 9.5px; letter-spacing: .08em; font-weight: 700; white-space: nowrap; }
.tj-command-metric strong { display: block; margin-top: 5px; font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tj-stat { padding: 14px 16px; }
.tj-stat-label { font-size: 10.5px; letter-spacing: 0.5px; color: var(--tj-muted); font-weight: 600; margin-bottom: 6px; }
.tj-stat-row { display: flex; align-items: center; justify-content: space-between; }
.tj-stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; }
.tj-stat-sub { font-size: 11px; color: var(--tj-muted); margin-top: 4px; }
.tj-stat-sub-row { display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px; }
.tj-badge-dot { display: flex; gap: 6px; margin-top: 6px; }
.tj-dot { font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
.tj-dot-green { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-dot-red { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-dot-blue { background: rgba(96,165,250,0.15); color: var(--tj-blue); }
i.tj-dot-green, i.tj-dot-red, i.tj-dot-blue, i.tj-dot-amber { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
i.tj-dot-green { background: var(--tj-green); } i.tj-dot-red { background: var(--tj-red); } i.tj-dot-blue { background: var(--tj-blue); } i.tj-dot-amber { background: var(--tj-amber); }
.tj-winloss-bar { height: 6px; border-radius: 6px; overflow: hidden; background: var(--tj-red); margin-top: 8px; }
.tj-winloss-fill { height: 100%; background: var(--tj-green); }

.tj-row3 { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: 14px; margin-bottom: 16px; }
.tj-row2 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.tj-panel { padding: 16px; }
.tj-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-weight: 600; font-size: 13px; }
.tj-thunder { color: var(--tj-purple); font-size: 12px; letter-spacing: 0.5px; }
.tj-pill { font-size: 11px; padding: 3px 8px; border-radius: 20px; font-weight: 700; }
.tj-pill-green { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-pill-red { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-pill-neutral { background: var(--tj-panel-alt); color: var(--tj-muted); }

.tj-avgrr-label { text-align: center; font-size: 10px; color: var(--tj-muted); margin-top: 4px; }
.tj-gauge-track { height: 8px; border-radius: 6px; background: linear-gradient(90deg, var(--tj-red), var(--tj-amber), var(--tj-green)); position: relative; margin-top: 4px; }
.tj-gauge-knob { position: absolute; top: -3px; width: 14px; height: 14px; border-radius: 50%; background: var(--tj-panel); border: 2px solid var(--tj-bg); transform: translateX(-50%); }
.tj-gauge-scale { display: flex; justify-content: space-between; font-size: 9px; color: var(--tj-muted); margin-top: 3px; }
.tj-edge-num { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 800; text-align: center; margin-top: 8px; color: var(--tj-purple); }
.tj-edge-label { text-align: center; font-size: 10px; letter-spacing: 1px; color: var(--tj-muted); margin-top: -4px; }

.tj-bar-track { height: 6px; border-radius: 6px; background: var(--tj-border); overflow: hidden; }
.tj-bar-fill { height: 100%; } .tj-bar-green { background: var(--tj-green); } .tj-bar-red { background: var(--tj-red); } .tj-bar-yellow { background: var(--tj-amber); }
.tj-wr-yellow { color: var(--tj-amber); }

.tj-month-nav { display: flex; gap: 2px; }
.tj-month-summary { display: flex; justify-content: space-around; text-align: center; padding: 10px 0 16px; border-bottom: 1px solid var(--tj-border); margin-bottom: 10px; }
.tj-mnum { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; }
.tj-mlabel { font-size: 10px; color: var(--tj-muted); letter-spacing: 0.5px; }
.tj-cal-dow { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--tj-muted); margin-bottom: 4px; }
.tj-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; min-width: 0; width: 100%; }
.tj-cal-cell { aspect-ratio: 1.1; background: var(--tj-panel-alt); border-radius: 8px; padding: 6px; border: 1px solid transparent; overflow: hidden; min-width: 0; }
.tj-cal-empty { background: none; }
.tj-cal-win { background: rgba(34,139,34,0.10); border-color: rgba(34,139,34,0.4); }
.tj-cal-loss { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.4); }
.tj-cal-be { background: rgba(96,165,250,0.10); border-color: rgba(96,165,250,0.4); }
.tj-cal-today { box-shadow: 0 0 0 1px var(--tj-purple) inset; }
.tj-cal-day { font-size: 11px; color: var(--tj-muted); margin-bottom: 2px; }
.tj-cal-pnl { font-size: 12px; font-weight: 600; }
.tj-cal-tcount { font-size: 10px; color: var(--tj-muted); margin-top: 1px; }
.tj-dock-cell { transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s; transform-origin: center bottom; will-change: transform; position: relative; }
.tj-dock-cell:hover { transform: scale(1.16) translateY(-4px); z-index: 5; }
.tj-cal-clickable { cursor: pointer; }
.tj-cal-dots { display: flex; gap: 2px; margin-top: 3px; }
.tj-mini-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
.tj-mini-dot.tj-dot-win { background: var(--tj-green); } .tj-mini-dot.tj-dot-loss { background: var(--tj-red); } .tj-mini-dot.tj-dot-be { background: var(--tj-blue); }

.tj-weekly-list { display: flex; flex-direction: column; gap: 14px; }
.tj-weekly-item-label { font-size: 10.5px; color: var(--tj-muted); letter-spacing: 0.5px; }
.tj-weekly-item-num { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; margin-top: 2px; }
.tj-weekly-item-sub { font-size: 11px; color: var(--tj-muted); margin-bottom: 4px; }
.tj-cal-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.tj-perf-table th, .tj-perf-table td { white-space: nowrap; }
.tj-perf-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
.tj-perf-summary-card { text-align: center; }
.tj-dow-list { display: flex; flex-direction: column; gap: 14px; }
.tj-dow-row { display: flex; align-items: center; gap: 10px; }
.tj-dow-label { width: 40px; color: var(--tj-muted); font-size: 12.5px; flex-shrink: 0; }
.tj-dow-pnl { font-weight: 700; font-size: 13px; width: 60px; flex-shrink: 0; }
.tj-dow-bar { flex: 1; height: 8px; }
.tj-dow-wr { font-size: 11px; flex-shrink: 0; width: 60px; }
.tj-dow-count { font-size: 11px; flex-shrink: 0; width: 26px; text-align: right; }

.tj-empty { color: var(--tj-muted); font-size: 13px; padding: 30px 0; text-align: center; }
.tj-empty-block { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.tj-empty-title { font-weight: 700; font-size: 15px; }
.tj-empty-sub { font-size: 12px; color: var(--tj-muted); text-align: center; max-width: 320px; margin-bottom: 6px; }

/* trade log */
.tj-toolbar {
  display: flex; align-items: center; gap: 12px; width: 100%; height: 48px;
  background: var(--tj-panel); border: 1px solid var(--tj-border); border-radius: 12px;
  padding: 0 14px; margin-bottom: 14px; font-family: 'Inter', system-ui, sans-serif;
}
.tj-toolbar-search {
  display: flex; align-items: center; gap: 8px; flex: 1 1 65%; min-width: 0; height: 36px;
  background: var(--tj-input-bg); border: 1px solid var(--tj-border); border-radius: 9px; padding: 0 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.tj-toolbar-search:focus-within { border-color: var(--tj-green); box-shadow: 0 0 0 3px rgba(34,139,34,0.16), 0 0 14px rgba(34,139,34,0.18); }
.tj-toolbar-search-icon { color: var(--tj-muted); flex-shrink: 0; }
.tj-toolbar-search-input { background: none; border: none; outline: none; color: var(--tj-text); font-size: 13.5px; font-weight: 500; width: 100%; font-family: inherit; }
.tj-toolbar-search-input::placeholder { color: var(--tj-muted); }
.tj-toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tj-toolbar-dd, .tj-toolbar-pill {
  height: 34px; background: var(--tj-input-bg); border: 1px solid var(--tj-border); border-radius: 9px;
  color: var(--tj-text); font-size: 13px; font-weight: 500; font-family: 'Inter', system-ui, sans-serif;
  padding: 0 12px; cursor: pointer; white-space: nowrap;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.tj-toolbar-dd:hover, .tj-toolbar-pill:hover { transform: translateY(-2px); border-color: var(--tj-muted); }
.tj-toolbar-pill { display: inline-flex; align-items: center; justify-content: center; }
.tj-toolbar-btn-active { background: var(--tj-primary-muted) !important; border-color: var(--tj-green) !important; color: var(--tj-green) !important; }
.tj-tradelog-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.tj-mini-stat { padding: 12px 14px; }
.tj-mnum-sm { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; margin-top: 2px; }
.tj-tlog-list { display: flex; flex-direction: column; gap: 10px; }
.tj-tlog-card { padding: 0; overflow: hidden; border-left-width: 3px; }
.tj-tlog-win { border-left: 3px solid var(--tj-green); } .tj-tlog-loss { border-left: 3px solid var(--tj-red); } .tj-tlog-be { border-left: 3px solid var(--tj-blue); }
.tj-tlog-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; flex-wrap: wrap; }
.tj-tlog-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.tj-tlog-main { min-width: 90px; } .tj-tlog-asset { font-weight: 700; font-size: 14px; }
.tj-tlog-pills { display: flex; gap: 4px; margin-top: 3px; }
.tj-dirpill-sm { font-size: 10px; font-weight: 700; background: var(--tj-panel-alt); border-radius: 4px; padding: 1px 5px; }
.tj-sesspill { font-size: 10px; color: var(--tj-muted); background: var(--tj-panel-alt); border-radius: 4px; padding: 1px 5px; }
.tj-tlog-date { font-size: 12px; color: var(--tj-muted); min-width: 70px; }
.tj-tlog-pnl-block { min-width: 80px; }
.tj-tlog-pnl { font-weight: 700; font-size: 14px; }
.tj-tlog-rr { font-size: 10px; color: var(--tj-muted); }
.tj-tlog-types, .tj-tlog-stars { min-width: 60px; }
.tj-statuspill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; }
.tj-statuspill-win { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-statuspill-loss { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-statuspill-be { background: rgba(96,165,250,0.15); color: var(--tj-blue); }
.tj-review-status { display: inline-flex; align-items: center; gap: 4px; min-width: 104px; justify-content: center; font-size: 10px; font-weight: 700; padding: 4px 8px; border: 1px solid transparent; border-radius: 10px; white-space: nowrap; }
.tj-review-reviewed { background: var(--tj-primary-muted); color: var(--tj-green); border-color: rgba(34,139,34,0.36); }
.tj-review-pending { background: rgba(248,113,113,0.14); color: var(--tj-red); border-color: rgba(248,113,113,0.32); }
.tj-tlog-actions { display: flex; gap: 6px; }
.tj-btn-edit, .tj-btn-del { border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer; }
.tj-btn-edit { background: var(--tj-panel-alt); color: var(--tj-text); border: 1px solid var(--tj-border); }
.tj-btn-del { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-tlog-expand { padding: 14px; border-top: 1px solid var(--tj-border); background: var(--tj-panel-alt); }
.tj-tlog-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.tj-tlog-mistakes, .tj-tlog-shots { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.tj-tlog-shots img { width: 90px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--tj-border); }
.tj-tlog-context { margin-top: 10px; font-style: italic; color: var(--tj-muted); font-size: 12.5px; }
.tj-daymodal-summary { margin-bottom: 14px; font-size: 13px; }
.tj-day-record-list { display: flex; flex-direction: column; gap: 6px; margin: 0 0 14px; }
.tj-day-record { display: flex; gap: 10px; padding: 8px 10px; border-radius: 7px; background: var(--tj-panel-alt); font-size: 12px; }
.tj-day-record > span:first-child { color: var(--tj-green); font-weight: 700; min-width: 74px; }

/* modals & forms */
.tj-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.tj-modal { background: var(--tj-panel); border: 1px solid var(--tj-border); border-radius: 14px; width: 440px; max-width: 100%; max-height: 88vh; overflow-y: auto; }
.tj-modal-wide { width: 620px; }
.tj-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--tj-border); position: sticky; top: 0; background: var(--tj-panel); z-index: 2;}
.tj-modal-title { font-weight: 700; font-size: 15px; }
.tj-modal-body { padding: 16px 18px; }
.tj-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.tj-field { margin-bottom: 12px; }
.tj-field-label { font-size: 10.5px; letter-spacing: 0.5px; color: var(--tj-muted); font-weight: 700; margin-bottom: 6px; }
.tj-section-label { font-size: 11px; letter-spacing: 0.5px; color: var(--tj-green); font-weight: 700; margin: 16px 0 8px; text-transform: uppercase; }
.tj-input { width: 100%; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-text); border-radius: 8px; padding: 9px 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
.tj-textarea { min-height: 70px; resize: vertical; }
.tj-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.tj-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.tj-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.tj-inline-add { display: flex; gap: 8px; margin-top: 8px; }
.tj-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.tj-chip { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.tj-chip-active { border-color: var(--tj-green); color: var(--tj-green); background: var(--tj-primary-muted); box-shadow: 0 0 0 1px rgba(34,139,34,0.16); }
.tj-chip-big { flex: 1; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 8px; padding: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.tj-theme-choice-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tj-theme-choice { transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
.tj-theme-choice.tj-chip-active { background: var(--tj-primary-muted); color: var(--tj-green); border-color: var(--tj-green); box-shadow: inset 3px 0 0 var(--tj-green), 0 0 0 1px rgba(34,139,34,0.22); }
.tj-theme-choice:hover { border-color: var(--tj-green); color: var(--tj-text); }
.tj-tagwrap { display: flex; flex-wrap: wrap; gap: 6px; }
.tj-tag { border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); color: var(--tj-muted); }
.tj-tag-purple.tj-tag-active { background: rgba(139,124,246,0.18); border-color: var(--tj-purple); color: var(--tj-purple); }
.tj-tag-red.tj-tag-active { background: rgba(248,113,113,0.15); border-color: var(--tj-red); color: var(--tj-red); }
.tj-tag-xs { font-size: 10px !important; padding: 2px 6px !important; margin: 1px; }
.tj-stars { display: flex; align-items: center; gap: 4px; } .tj-stars-label { color: var(--tj-muted); font-size: 12px; margin-left: 8px; }
.tj-rating-readout { display: inline-flex; align-items: center; gap: 1px; letter-spacing: 1px; font-size: 15px; }
.tj-star-full, .tj-star-half { color: var(--tj-amber); } .tj-star-empty { color: var(--tj-muted); }
.tj-rating-summary { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); margin-bottom: 8px; }
.tj-rating-completion { color: var(--tj-green); font-weight: 700; font-size: 12px; }
.tj-grades { display: flex; gap: 5px; align-items: center; }
.tj-grade-pip { border: 1px solid var(--tj-border); color: var(--tj-muted); background: none; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
.tj-grades-sm .tj-grade-pip { padding: 1px 6px; font-size: 10px; cursor: default; }

.tj-dropzone { border: 1.5px dashed var(--tj-border); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--tj-panel-alt); }
.tj-dropzone-active { border-color: var(--tj-purple); background: rgba(139,124,246,0.08); }
.tj-dropzone-text { font-size: 12px; color: var(--tj-muted); }
.tj-dropzone-warn { font-size: 10.5px; color: var(--tj-amber); margin-top: 6px; }
.tj-shot-grid { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
.tj-shot-thumb { position: relative; width: 132px; height: 88px; border-radius: 8px; overflow: hidden; border: 1px solid var(--tj-border); }
.tj-image-preview { display: block; appearance: none; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); padding: 0; border-radius: 8px; overflow: hidden; cursor: zoom-in; line-height: 0; }
.tj-image-preview img { display: block; width: 100%; height: 100%; object-fit: contain; background: var(--tj-panel-alt); }
.tj-shot-thumb .tj-image-preview { width: 100%; height: 100%; border: none; border-radius: 0; }
.tj-shot-remove { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); border: none; color: #fff; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.tj-shot-add { width: 132px; height: 88px; border-radius: 8px; border: 1px dashed var(--tj-border); display: flex; align-items: center; justify-content: center; }
.tj-tlog-shots { display: flex; gap: 10px; flex-wrap: wrap; }
.tj-tlog-shots .tj-image-preview { width: min(260px, 100%); height: 180px; }
.tj-markup-images { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; align-items: start; }
.tj-markup-image-section { min-width: 0; background: var(--tj-panel); border: 1px solid var(--tj-border); border-radius: 10px; padding: 10px; }
.tj-markup-image-section .tj-tlog-shots { margin-top: 8px; }
.tj-markup-image-section .tj-image-preview { width: 100%; height: 220px; }
.tj-image-viewer { position: fixed; inset: 0; z-index: 200100; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0,0,0,0.78); backdrop-filter: blur(5px); cursor: zoom-out; }
.tj-image-viewer img { display: block; max-width: min(1400px, 96vw); max-height: 90vh; width: auto; height: auto; object-fit: contain; border-radius: 10px; box-shadow: var(--tj-shadow); cursor: default; }
.tj-image-viewer-close { position: fixed; top: 18px; right: 18px; width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.42); background: rgba(0,0,0,0.55); color: #FFF; border-radius: 50%; cursor: pointer; }

/* calendar heatmap */
.tj-heatmap { display: flex; gap: 3px; overflow-x: auto; padding: 6px 0; }
.tj-heat-col { display: flex; flex-direction: column; gap: 3px; }
.tj-heat-cell { width: 11px; height: 11px; border-radius: 3px; }
.tj-heat-sub { font-size: 11px; color: var(--tj-muted); margin-bottom: 6px; }
.tj-heat-months { display: flex; gap: 3px; margin-bottom: 2px; }
.tj-heat-month-label { width: 11px; font-size: 9px; color: var(--tj-muted); }
.tj-heat-legend { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--tj-muted); margin-top: 8px; flex-wrap: wrap; }
.tj-cal-record { display: flex; gap: 3px; font-size: 8px; line-height: 1.25; color: var(--tj-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tj-cal-record span:first-child { color: var(--tj-green); font-weight: 700; flex-shrink: 0; }
.tj-cal-record span:last-child { overflow: hidden; text-overflow: ellipsis; }
.tj-cal-more { color: var(--tj-muted); font-size: 8px; margin-top: 2px; }

/* psychology */
.tj-mood-list { display: flex; flex-direction: column; gap: 12px; }
.tj-mood-header { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
.tj-mistake-list { display: flex; flex-direction: column; gap: 8px; }
.tj-mistake-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }

/* insights */
.tj-insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.tj-insight-card { background: rgba(34,139,34,0.07); border: 1px solid rgba(34,139,34,0.25); border-radius: 10px; padding: 14px; }
.tj-insight-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--tj-green); margin-bottom: 6px; font-size: 13.5px; }

/* analytics */
.tj-perf-list { display: flex; flex-direction: column; gap: 10px; }
.tj-perf-list > div { display: flex; justify-content: space-between; font-size: 13px; padding-bottom: 8px; border-bottom: 1px solid var(--tj-border); }
.tj-simple-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tj-table-wrap { overflow-x: auto; }
.tj-simple-table th { text-align: left; color: var(--tj-muted); font-weight: 600; padding: 6px 8px; font-size: 10.5px; letter-spacing: 0.3px; border-bottom: 1px solid var(--tj-border); }
.tj-simple-table td { padding: 7px 8px; border-bottom: 1px solid var(--tj-border); }
.tj-scatter-legend { font-size: 11px; color: var(--tj-muted); display: flex; align-items: center; gap: 4px; }
.tj-scatter-box { position: relative; height: clamp(400px, 46vw, 540px); max-width: none; margin: 8px 0 24px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-chart-bg); overflow: hidden; }
.tj-scatter-bg { position: absolute; width: 50%; height: 50%; }
.tj-scatter-bg-tl { top: 0; left: 0; background: rgba(34,139,34,0.04); border-top-left-radius: 10px; }
.tj-scatter-bg-tr { top: 0; right: 0; background: rgba(34,139,34,0.14); border-top-right-radius: 10px; }
.tj-scatter-bg-bl { bottom: 0; left: 0; background: rgba(248,113,113,0.12); border-bottom-left-radius: 10px; }
.tj-scatter-bg-br { bottom: 0; right: 0; background: rgba(248,113,113,0.03); border-bottom-right-radius: 10px; }
.tj-scatter-midline { position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed var(--tj-border); }
.tj-scatter-quad { position: absolute; font-size: 10px; color: var(--tj-muted); padding: 12px; letter-spacing: 0.45px; font-weight: 700; z-index: 1; }
.tj-scatter-good { color: var(--tj-green); } .tj-scatter-bad { color: var(--tj-red); }
.tj-scatter-tl { top: 0; left: 0; } .tj-scatter-tr { top: 0; right: 0; text-align: right; }
.tj-scatter-bl { bottom: 0; left: 0; } .tj-scatter-br { bottom: 0; right: 0; text-align: right; }
.tj-scatter-axis-y-top { position: absolute; top: 46%; left: 4px; font-size: 9px; color: var(--tj-muted); }
.tj-scatter-axis-y-bot { position: absolute; bottom: 4px; left: 4px; font-size: 9px; color: var(--tj-muted); }
.tj-scatter-axis-x-left { position: absolute; bottom: -18px; left: 4px; font-size: 9px; color: var(--tj-muted); }
.tj-scatter-axis-x-mid { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--tj-muted); }
.tj-scatter-axis-x-right { position: absolute; bottom: -18px; right: 4px; font-size: 9px; color: var(--tj-muted); }
.tj-scatter-dot-wrap { position: absolute; transform: translate(-50%, -50%); z-index: 2; }
.tj-scatter-dot { border: 2px solid; border-radius: 999px; display: flex; align-items: center; justify-content: center; min-width: 36px; max-width: 116px; font-size: 10px; font-weight: 700; background: var(--tj-panel); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 3px 8px; cursor: pointer; transition: transform 0.15s ease; box-shadow: 0 3px 9px rgba(0,0,0,0.16); }
.tj-scatter-dot-wrap:hover .tj-scatter-dot { transform: scale(1.1); }
.tj-scatter-tooltip { position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%); background: var(--tj-tooltip-bg); border: 1px solid var(--tj-border); border-radius: 10px; padding: 10px 12px; width: 164px; box-shadow: var(--tj-shadow); opacity: 0; pointer-events: none; transition: opacity 0.15s ease; z-index: 10; }
.tj-scatter-dot-wrap:hover .tj-scatter-tooltip { opacity: 1; }
.tj-scatter-tooltip-below { bottom: auto; top: calc(100% + 10px); }
.tj-scatter-tooltip-title { font-weight: 800; font-size: 12px; margin-bottom: 6px; }
.tj-scatter-tooltip-row { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--tj-muted); margin-bottom: 3px; }
.tj-setup-tags { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.tj-setup-card { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 12px; }
.tj-setup-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tj-grade-badge { background: rgba(139,124,246,0.18); color: var(--tj-purple); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.tj-grade-bad { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-setup-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px; }
.tj-setup-bw { display: flex; gap: 8px; margin-bottom: 6px; }
.tj-setup-bw-box { flex: 1; border-radius: 8px; padding: 6px 8px; }
.tj-setup-bw-best { background: rgba(34,139,34,0.1); } .tj-setup-bw-worst { background: rgba(248,113,113,0.1); }
.tj-session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.tj-session-card { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 12px; text-align: center; }
.tj-session-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px; }
.tj-sesspill-lg { background: rgba(139,124,246,0.15); color: var(--tj-purple); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.tj-session-pnl { font-size: 18px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
.tj-session-wl { display: flex; justify-content: center; gap: 10px; font-size: 11px; margin: 4px 0; font-weight: 700; }
.tj-day-score-row { display: flex; align-items: center; gap: 18px; }
.tj-day-score-circle { width: 84px; height: 84px; border-radius: 50%; border: 4px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
.tj-day-score-num { font-size: 26px; font-weight: 800; font-family: 'Space Grotesk', sans-serif; line-height: 1; }
.tj-day-score-max { font-size: 10px; color: var(--tj-muted); }
.tj-day-score-label { font-size: 16px; font-weight: 700; }
.tj-day-legend { display: flex; gap: 12px; font-size: 11px; color: var(--tj-muted); margin-top: 6px; }
.tj-day-dist { display: flex; height: 8px; border-radius: 6px; overflow: hidden; margin-top: 6px; }
.tj-day-quad-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
.tj-day-quad-stats > div { background: var(--tj-panel-alt); border-radius: 8px; padding: 10px; text-align: center; }
.tj-day-bestworst { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.tj-day-bw-box { border-radius: 8px; padding: 12px; }
.tj-day-bw-best { background: rgba(34,139,34,0.1); } .tj-day-bw-worst { background: rgba(248,113,113,0.1); }
.tj-last6-track { display: flex; gap: 3px; height: 34px; margin-top: 8px; align-items: stretch; }
.tj-last6-bar { border-radius: 4px; }
.tj-last6-dates { display: flex; justify-content: space-between; font-size: 9px; color: var(--tj-muted); margin-top: 4px; }
.tj-last6-legend { display: flex; gap: 14px; font-size: 11px; color: var(--tj-muted); margin-top: 8px; }
.tj-instrument-table td { vertical-align: middle; }
.tj-inline-bar { display: flex; align-items: center; gap: 8px; }
.tj-combo-result { margin-top: 12px; font-size: 13px; background: var(--tj-panel-alt); border-radius: 8px; padding: 10px; }

/* news */
.tj-news-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.tj-news-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tj-tz-pill { font-size: 11px; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-purple); padding: 3px 10px; border-radius: 20px; }
.tj-news-tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; border-bottom: 1px solid var(--tj-border); padding-bottom: 12px; }
.tj-newstab { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 600; }
.tj-newstab-active { background: rgba(248,113,113,0.12); color: var(--tj-red); border-color: rgba(248,113,113,0.4); }
.tj-news-weeknav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.tj-news-infobar { display: flex; justify-content: space-between; align-items: center; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-bottom: 12px; flex-wrap: wrap; gap: 6px; }
.tj-openff { color: var(--tj-green); text-decoration: none; font-weight: 700; font-size: 12px; }
.tj-openff:hover { text-decoration: underline; }
.tj-news-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.tj-news-stats > div { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 8px; padding: 10px; text-align: center; }
.tj-holiday-list { display: flex; flex-direction: column; gap: 10px; }
.tj-holiday-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 8px 0; border-bottom: 1px solid var(--tj-border); }
.tj-news-filters { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.tj-news-day-block { margin-bottom: 16px; }
.tj-news-day-label { font-weight: 700; font-size: 12.5px; color: var(--tj-purple); margin-bottom: 6px; }
.tj-impact-chip { border: 1px solid var(--tj-border); background: var(--tj-panel-alt); color: var(--tj-muted); border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
.tj-impact-high.tj-impact-on { background: rgba(248,113,113,0.15); color: var(--tj-red); border-color: var(--tj-red); }
.tj-impact-medium.tj-impact-on { background: rgba(251,191,36,0.15); color: var(--tj-amber); border-color: var(--tj-amber); }
.tj-impact-low.tj-impact-on { background: var(--tj-primary-muted); color: var(--tj-green); border-color: var(--tj-green); }
.tj-impact-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tj-impact-dot-high { background: var(--tj-red); } .tj-impact-dot-medium { background: var(--tj-amber); } .tj-impact-dot-low { background: var(--tj-green); } .tj-impact-dot-holiday { background: var(--tj-blue); }
.tj-news-day-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.tj-news-day-title { font-weight: 700; font-size: 12.5px; color: var(--tj-text); letter-spacing: 0.3px; }
.tj-daytag { font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; }
.tj-daytag-today { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-daytag-past { background: var(--tj-panel-alt); color: var(--tj-muted); }
.tj-news-day-count { margin-left: auto; font-size: 11px; color: var(--tj-muted); }
.tj-event-list { display: flex; flex-direction: column; }
.tj-event-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--tj-border); }
.tj-event-time { width: 66px; flex-shrink: 0; font-size: 12px; color: var(--tj-muted); }
.tj-event-main { flex: 1; min-width: 0; }
.tj-event-title { font-size: 13px; font-weight: 500; }
.tj-event-sub { font-size: 11px; color: var(--tj-muted); margin-top: 2px; }
.tj-impactpill { font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px; flex-shrink: 0; }
.tj-impactpill-high { background: rgba(248,113,113,0.15); color: var(--tj-red); }
.tj-impactpill-medium { background: rgba(251,191,36,0.15); color: var(--tj-amber); }
.tj-impactpill-low { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-impactpill-holiday { background: rgba(96,165,250,0.15); color: var(--tj-blue); }

/* rules */
.tj-rules-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.tj-tabs { display: flex; gap: 4px; background: var(--tj-panel-alt); border-radius: 8px; padding: 3px; }
.tj-tab { background: none; border: none; color: var(--tj-muted); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
.tj-tab-active { background: var(--tj-panel); color: var(--tj-text); }
.tj-rule-list { display: flex; flex-direction: column; gap: 8px; }
.tj-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--tj-panel-alt); border-radius: 8px; font-size: 13px; justify-content: space-between; }
.tj-rule-actions { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.tj-rule-done { text-decoration: line-through; color: var(--tj-muted); }
.tj-history-list { display: flex; flex-direction: column; gap: 8px; }
.tj-history-row { display: flex; align-items: center; font-size: 12.5px; }

/* AAICOREFX workspace surfaces use the shared tokens above, so the same
   hierarchy carries cleanly through Light and Dark mode. */
.tj-panel, .tj-tlog-card, .tj-management-grid > .tj-panel { box-shadow: 0 10px 24px rgba(1,10,20,.07); }
.tj-panel { background: linear-gradient(150deg, color-mix(in srgb, var(--tj-panel) 98%, transparent), color-mix(in srgb, var(--tj-panel-alt) 46%, var(--tj-panel) 54%)); }
.tj-page-intro { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 4px 2px 15px; margin-bottom: 2px; border-bottom: 1px solid var(--tj-border); }
.tj-management-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.tj-management-grid > .tj-panel { min-height: 270px; position: relative; overflow: hidden; }
.tj-management-grid > .tj-panel::before { content: ""; display: block; width: 30px; height: 3px; border-radius: 99px; background: var(--tj-green); margin-bottom: 12px; }
.tj-toolbar { background: color-mix(in srgb, var(--tj-panel) 94%, transparent); box-shadow: 0 8px 20px rgba(1,10,20,.05); }
.tj-toolbar-search, .tj-toolbar-dd, .tj-toolbar-pill { background: color-mix(in srgb, var(--tj-input-bg) 94%, transparent); }
.tj-tlog-card { border-radius: 10px; background: color-mix(in srgb, var(--tj-panel) 97%, transparent); transition: border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
.tj-tlog-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--tj-border) 65%, var(--tj-green) 35%); box-shadow: 0 13px 26px rgba(1,10,20,.10); }
.tj-tlog-row { min-height: 58px; }
.tj-tlog-date { font-variant-numeric: tabular-nums; }
.tj-tradelog-stats > .tj-card, .tj-stat { position: relative; overflow: hidden; }
.tj-tradelog-stats > .tj-card::before, .tj-stat::before { content: ""; position: absolute; top: 0; left: 0; width: 26px; height: 2px; border-radius: 0 0 99px 0; background: var(--tj-green); opacity: .8; }
.tj-tlog-expand { background: color-mix(in srgb, var(--tj-panel-alt) 78%, transparent); }
.tj-markup-image-section, .tj-setup-card, .tj-session-card { background: color-mix(in srgb, var(--tj-panel-alt) 72%, var(--tj-panel) 28%); }
.tj-cal-cell { transition: border-color .16s ease, background .16s ease, transform .16s cubic-bezier(.2,.8,.2,1); }
.tj-cal-cell:hover { border-color: color-mix(in srgb, var(--tj-border) 55%, var(--tj-green) 45%); }

@media (max-width: 900px) {
  .tj-toolbar { overflow-x: auto; }
  .tj-toolbar-search { flex: 0 0 180px; }
  .tj-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .tj-row3 { grid-template-columns: 1fr; }
  .tj-row2 { grid-template-columns: 1fr; }
  .tj-tradelog-stats { grid-template-columns: repeat(2, 1fr); }
  .tj-sidebar { position: fixed; z-index: 50; top: 0; left: 0; box-shadow: 0 0 0 9999px transparent; }
  .tj-sidebar.tj-sidebar-collapsed { width: 220px; min-width: 220px; padding: 18px 14px; transform: translateX(-100%); border-right: 1px solid var(--tj-border); }
  .tj-sidebar.tj-sidebar-shown { transform: translateX(0); box-shadow: 20px 0 40px rgba(0,0,0,0.5); }
  .tj-backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 45; }
  .tj-topbar { padding: 12px 14px; flex-wrap: wrap; row-gap: 8px; }
  .tj-topbar-account { display: none; }
  .tj-content { padding: 14px; }
  .tj-day-score-row { flex-direction: column; align-items: flex-start; }
  .tj-day-quad-stats { grid-template-columns: repeat(2, 1fr); }
  .tj-day-bestworst { grid-template-columns: 1fr; }
  .tj-setup-tags { grid-template-columns: 1fr; }
  .tj-session-grid { grid-template-columns: 1fr; }
  .tj-grid4 { grid-template-columns: repeat(2, 1fr); }
  .tj-command-panel { align-items: stretch; flex-direction: column; gap: 16px; }
  .tj-command-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); min-width: 0; }
  .tj-management-grid { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .tj-toolbar { flex-direction: column; height: auto; align-items: stretch; padding: 12px; gap: 10px; overflow-x: visible; }
  .tj-toolbar-search { flex: none; width: 100%; height: 40px; }
  .tj-toolbar-right { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
  .tj-toolbar-dd, .tj-toolbar-pill { width: 100%; height: 38px; text-align: center; justify-content: center; }
}
@media (max-width: 520px) {
  .tj-command-panel { padding: 16px; }
  .tj-command-title { font-size: 20px; }
  .tj-command-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-stats-grid { grid-template-columns: 1fr 1fr; }
  .tj-tradelog-stats { grid-template-columns: 1fr 1fr; }
  .tj-tlog-row { gap: 8px; }
  .tj-modal-wide { width: 100%; }
  .tj-grid3, .tj-grid2, .tj-grid4 { grid-template-columns: 1fr; }
  .tj-scatter-box { height: 330px; }
  .tj-markup-images { grid-template-columns: 1fr; }
  .tj-markup-image-section .tj-image-preview { height: 190px; }
  .tj-tlog-shots .tj-image-preview { width: min(100%, 280px); height: 180px; }
  .tj-cal-cell { aspect-ratio: 0.85; padding: 3px; border-radius: 6px; }
  .tj-cal-day { font-size: 9px; margin-bottom: 0; }
  .tj-cal-pnl { font-size: 9px; line-height: 1.1; }
  .tj-cal-tcount { font-size: 7.5px; margin-top: 0; }
  .tj-cal-grid { gap: 2px; }
  .tj-cal-dow { font-size: 9px; }
}
@media (max-width: 560px) {
  .tj-image-viewer { padding: 14px; }
  .tj-image-viewer img { max-width: 96vw; max-height: 84vh; }
  .tj-image-viewer-close { top: 10px; right: 10px; }
  .tj-shot-thumb, .tj-shot-add { width: 112px; height: 76px; }
  .tj-tlog-shots .tj-image-preview { width: 100%; height: 185px; }
  .tj-scatter-quad { font-size: 8px; padding: 7px; }
  .tj-scatter-dot { max-width: 80px; font-size: 8.5px; padding: 2px 5px; }
}
`;

/* =============================== AUTH ROOT =============================== */
/* Gates the app behind real Supabase authentication. Session state is
   restored from Supabase's own persisted session (localStorage-backed by
   the SDK itself, refreshed automatically) — not a custom scheme.        */

export default function AppRoot() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Restore whatever session Supabase already has persisted (this is what
    // makes "close the browser, come back later, still logged in" work).
    (async () => {
      const session = await getSession();
      if (!cancelled) setUser(session ? session.user : null);
    })();

    // Live updates: covers sign-in, sign-out in another tab, token refresh,
    // and the special PASSWORD_RECOVERY event fired when someone arrives via
    // a "reset your password" email link.
    const unsubscribe = onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") { setPasswordRecovery(true); return; }
      setUser(session ? session.user : null);
    });

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  if (user === undefined) {
    return (
      <div className="tj-root tj-loading">
        <style>{`.tj-root{font-family:'Inter',system-ui,sans-serif;background:#0A0B0D;color:#A0A7B2;} .tj-spinner{width:28px;height:28px;border:3px solid #262A31;border-top-color:#228B22;border-radius:50%;animation:tj-spin 0.8s linear infinite;} @keyframes tj-spin{to{transform:rotate(360deg);}}`}</style>
        <div className="tj-spinner" />
        <div>Restoring your session…</div>
      </div>
    );
  }

  if (passwordRecovery) {
    return <ResetPasswordForm onDone={() => setPasswordRecovery(false)} />;
  }

  if (!user) {
    return <AuthPage onAuthed={(u) => setUser(u)} brand="AAICOREFX" />;
  }

  return (
    <TradingJournalApp
      user={user}
      onLogout={async () => { await signOut(); setUser(null); }}
    />
  );
}
