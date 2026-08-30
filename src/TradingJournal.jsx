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
  ImagePlus, ClipboardCheck, ScanLine, CheckCircle2, SlidersHorizontal, ArrowDownUp,
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
  saveTypeTags, saveManagedLists, createMarkup, updateMarkup, deleteMarkup, saveTradeReview, savePeriodReview, hasMigratedLocalData, markLocalDataMigrated, importLegacyAccount,
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

function accountGuardrails(account, trades, now = new Date()) {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearKey = String(now.getFullYear());
  const dateKey = now.toISOString().slice(0, 10);
  const total = (items) => items.reduce((sum, item) => sum + Number(item.pnl || 0), 0);
  const monthlyPnl = total(trades.filter((trade) => trade.date?.slice(0, 7) === monthKey));
  const yearlyPnl = total(trades.filter((trade) => trade.date?.slice(0, 4) === yearKey));
  const dailyPnl = total(trades.filter((trade) => trade.date === dateKey));
  const balance = Number(account.balance) || 0;
  const monthlyGoalPct = Math.max(0, Number(account.monthlyGoalPct) || 0);
  const yearlyGoalPct = Math.max(0, Number(account.yearlyGoalPct) || 0);
  const dailyLossLimitPct = Math.max(0, Number(account.dailyLossLimitPct) || 0);
  const monthlyLossLimitPct = Math.max(0, Number(account.monthlyLossLimitPct) || 0);
  const monthlyGoal = balance * monthlyGoalPct / 100;
  const yearlyGoal = balance * yearlyGoalPct / 100;
  const dailyLossCap = balance * dailyLossLimitPct / 100;
  const monthlyLossCap = balance * monthlyLossLimitPct / 100;
  const dailyLossHit = dailyLossCap > 0 && dailyPnl <= -dailyLossCap;
  const monthlyLossHit = monthlyLossCap > 0 && monthlyPnl <= -monthlyLossCap;
  return {
    enabled: [monthlyGoalPct, yearlyGoalPct, dailyLossLimitPct, monthlyLossLimitPct].some((value) => value > 0),
    monthlyPnl, yearlyPnl, dailyPnl, monthlyGoal, yearlyGoal, dailyLossCap, monthlyLossCap,
    monthlyGoalPct, yearlyGoalPct, dailyLossLimitPct, monthlyLossLimitPct,
    dailyLossHit, monthlyLossHit, tradeEntryLocked: dailyLossHit || monthlyLossHit,
  };
}

function progressPct(value, target) {
  if (!target) return 0;
  return clamp((Math.max(0, value) / target) * 100, 0, 100);
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

function ScreenshotUploader({ screenshots, onChange, max = 5 }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    const room = max - screenshots.length;
    const list = Array.from(files).slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    for (const f of list) {
      try {
        const dataUrl = await downscaleImage(f);
        onChange((prev) => (prev.length >= max ? prev : [...prev, dataUrl]));
      } catch (e) { /* ignore unreadable file */ }
    }
  }, [screenshots.length, onChange, max]);

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
      <div className="tj-field-label">Screenshots ({screenshots.length}/{max})</div>
      <div
        className={`tj-dropzone ${dragOver ? "tj-dropzone-active" : ""}`}
        onClick={() => screenshots.length < max && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        {screenshots.length === 0 ? (
          <>
            <ImagePlus size={20} color="var(--tj-muted)" />
            <div className="tj-dropzone-text">Paste · Drag · Click — {max - screenshots.length} slots left</div>
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
            {screenshots.length < max && (
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

function NewTradeModal({ onClose, onSave, editing, draft, typeTags, mistakeTags, confluenceSessions, markups, rules, instruments = [], defaultCommission }) {
  const [form, setForm] = useState(() => {
    const base = { id: uid(), date: todayISO(), time: nowTime(), asset: "", direction: "BUY", grossPnl: "", commission: defaultCommission || 0, swap: 0, pnl: "", rr: "", entryType: "", entrySession: SESSIONS[2], session: SESSIONS[2], confluence: [], types: [], mistakes: [], moodBefore: "Neutral", moodAfter: "Neutral", context: "", screenshots: [], premarketMarkupId: null, ruleEvaluations: [] };
    if (!editing && !draft) return base;
    const source = editing || draft;
    return { ...base, ...source, time: source.time || nowTime(), entryType: source.entryType || source.confluenceSession || "", entrySession: source.entrySession || source.session || SESSIONS[2], confluence: source.confluence || source.types || [], ruleEvaluations: source.ruleEvaluations || [] };
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
  const [icon, setIcon] = useState(account.icon || ACCOUNT_ICONS[0]);
  const [profileImage, setProfileImage] = useState(account.profileImage || "");
  const [monthlyGoalPct, setMonthlyGoalPct] = useState(account.monthlyGoalPct || 0);
  const [yearlyGoalPct, setYearlyGoalPct] = useState(account.yearlyGoalPct || 0);
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState(account.dailyLossLimitPct || 0);
  const [monthlyLossLimitPct, setMonthlyLossLimitPct] = useState(account.monthlyLossLimitPct || 0);
  const [open, setOpen] = useState({ identity: true, defaults: false, appearance: false, goals: false, guardrails: false, danger: false });
  const photoRef = useRef(null);
  const toggle = (section) => setOpen((current) => ({ ...current, [section]: !current[section] }));
  const uploadProfile = async (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try { setProfileImage(await downscaleImage(file)); } catch (error) { /* leave the current image intact */ }
  };
  const GuardrailField = ({ label, value, onChange, placeholder, hint }) => <Field label={label}>
    <input type="number" min="0" step="0.1" className="tj-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    {hint && <div className="tj-muted-txt tj-settings-hint">{hint}</div>}
  </Field>;
  const goalsEnabled = Number(monthlyGoalPct) > 0 || Number(yearlyGoalPct) > 0;
  const guardrailsEnabled = Number(dailyLossLimitPct) > 0 || Number(monthlyLossLimitPct) > 0;
  const Section = ({ id, title, children, note, status, danger = false }) => <section className={`tj-settings-section ${danger ? "tj-settings-section-danger" : ""}`}>
    <button type="button" className="tj-settings-section-head" onClick={() => toggle(id)} aria-expanded={open[id]}>
      <span><strong>{title}</strong>{note && <small>{note}</small>}</span><span className="tj-settings-section-end">{status && <em>{status}</em>}<ChevronDown size={16} style={{ transform: open[id] ? "rotate(180deg)" : "none" }} /></span>
    </button>
    {open[id] && <div className="tj-settings-section-body">{children}</div>}
  </section>;
  return (
    <Modal title={<span><Settings size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Account Settings</span>} onClose={onClose} wide>
      <div className="tj-settings-account-hero">
        <button type="button" className="tj-settings-hero-avatar" onClick={() => photoRef.current?.click()} aria-label="Upload account photo">{profileImage ? <img src={profileImage} alt="Account profile" /> : <span>{icon}</span>}</button>
        <div className="tj-settings-hero-copy"><span>ACCOUNT CONTROL CENTER</span><strong>{name.trim() || "Main Account"}</strong><p>Build the account once, then let goals and guardrails carry through the dashboard, analytics, and daily workflow.</p></div>
        <div className="tj-settings-hero-metrics"><div><small>STARTING BALANCE</small><b>{fmtMoney(Number(balance) || 0)}</b><span>Account base</span></div><div className={Number(monthlyGoalPct) > 0 ? "tj-settings-goal-on" : ""}><small>MONTHLY GOAL</small><b>{Number(monthlyGoalPct) > 0 ? `${Number(monthlyGoalPct)}%` : "Optional"}</b><span>{Number(monthlyGoalPct) > 0 ? "Dashboard target" : "Set a monthly target"}</span></div><div className={Number(yearlyGoalPct) > 0 ? "tj-settings-goal-on" : ""}><small>YEARLY GOAL</small><b>{Number(yearlyGoalPct) > 0 ? `${Number(yearlyGoalPct)}%` : "Optional"}</b><span>{Number(yearlyGoalPct) > 0 ? "Runway target" : "Keep the runway open"}</span></div><div className={Number(dailyLossLimitPct) > 0 ? "tj-settings-risk-on" : ""}><small>DAILY LOSS</small><b>{Number(dailyLossLimitPct) > 0 ? `${Number(dailyLossLimitPct)}%` : "Optional"}</b><span>{Number(dailyLossLimitPct) > 0 ? "Entry lock enabled" : "No daily lock"}</span></div><div className={Number(monthlyLossLimitPct) > 0 ? "tj-settings-risk-on" : ""}><small>MONTHLY LOSS</small><b>{Number(monthlyLossLimitPct) > 0 ? `${Number(monthlyLossLimitPct)}%` : "Optional"}</b><span>{Number(monthlyLossLimitPct) > 0 ? "Entry lock enabled" : "No monthly lock"}</span></div></div>
      </div>
      <Section id="identity" title="Identity & Profile" note="Make the workspace feel like its own funded account." status={profileImage ? "Photo ready" : "Badge ready"}>
        <div className="tj-profile-row">
          <button type="button" className="tj-profile-preview" onClick={() => photoRef.current?.click()} aria-label="Upload account photo">
            {profileImage ? <img src={profileImage} alt="Account profile" /> : <span>{icon}</span>}
          </button>
          <div className="tj-profile-actions"><div className="tj-muted-txt" style={{ fontSize: 12 }}>Upload an account photo, or use a badge as the fallback.</div><div className="tj-chip-row"><button type="button" className="tj-btn-outline tj-btn-small" onClick={() => photoRef.current?.click()}>Upload photo</button>{profileImage && <button type="button" className="tj-btn-outline tj-btn-small" onClick={() => setProfileImage("")}>Remove</button>}</div></div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { uploadProfile(event.target.files); event.target.value = ""; }} />
        </div>
        <Field label="Display Name"><input className="tj-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="tj-field-label">Account Badge</div><div className="tj-chip-row">{ACCOUNT_ICONS.map((value) => <button key={value} type="button" className={`tj-chip-big ${icon === value ? "tj-chip-active" : ""}`} onClick={() => setIcon(value)}>{value}</button>)}</div>
      </Section>
      <Section id="defaults" title="Journal Defaults" note="Tune how new trades are graded and pre-filled across the journal." status={`B/E $${Number(beCap) || 0} · Fee $${Number(defaultCommission) || 0}`}>
        <Field label="Starting Balance ($)"><input type="number" min="0" className="tj-input" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
        <Field label="Breakeven Cap ($)"><input type="number" min="0" className="tj-input" value={beCap} onChange={(e) => setBeCap(e.target.value)} /><div className="tj-chip-row">{[0, 10, 20, 35, 50].map((v) => <button type="button" key={v} className={`tj-chip ${Number(beCap) === v ? "tj-chip-active" : ""}`} onClick={() => setBeCap(v)}>${v}</button>)}</div></Field>
        <Field label="Default Commission ($ per trade)"><input type="number" min="0" className="tj-input" value={defaultCommission} onChange={(e) => setDefaultCommission(e.target.value)} /><div className="tj-muted-txt tj-settings-hint">Pre-filled on new trades; an individual trade can override it.</div></Field>
      </Section>
      <Section id="appearance" title="Appearance" note="Choose how this account feels when you switch into its workspace." status={theme === "light" ? "Light surface" : "Dark surface"}>
        <div className="tj-field-label">Theme</div><div className="tj-chip-row tj-theme-choice-row"><button type="button" aria-pressed={theme === "dark"} className={`tj-chip-big tj-theme-choice ${theme === "dark" ? "tj-chip-active" : ""}`} onClick={() => setTheme("dark")}><span>Dark</span><small>Low-light focus</small></button><button type="button" aria-pressed={theme === "light"} className={`tj-chip-big tj-theme-choice ${theme === "light" ? "tj-chip-active" : ""}`} onClick={() => setTheme("light")}><span>Light</span><small>Bright workspace</small></button></div><div className="tj-settings-off-note">The selected theme is highlighted immediately and is applied to the whole account when you save.</div>
      </Section>
      <Section id="goals" title="Goals" note="Optional monthly and yearly targets that appear in analytics and review summaries." status={goalsEnabled ? "Active" : "Optional"}>
        <div className="tj-grid2"><GuardrailField label="Monthly Goal (%)" value={monthlyGoalPct} onChange={setMonthlyGoalPct} placeholder="e.g. 4" /><GuardrailField label="Yearly Goal (%)" value={yearlyGoalPct} onChange={setYearlyGoalPct} placeholder="e.g. 25" /></div>
      </Section>
      <Section id="guardrails" title="Risk Guardrails" note="Optional loss caps that pause trade execution once the limit is hit." status={guardrailsEnabled ? "Active" : "Off"}>
        <div className="tj-grid2"><GuardrailField label="Daily Loss Cap (%)" value={dailyLossLimitPct} onChange={setDailyLossLimitPct} placeholder="e.g. 2" /><GuardrailField label="Monthly Loss Cap (%)" value={monthlyLossLimitPct} onChange={setMonthlyLossLimitPct} placeholder="e.g. 6" /></div>
        <div className="tj-settings-off-note">Set every goal and loss-cap value to 0 to hide Account Guardrails on the Dashboard.</div>
      </Section>
      <Section id="danger" title="Danger Zone" note="Resetting journal data is kept separate to prevent accidental loss." status="Protected" danger>
        <div className="tj-settings-danger-copy"><strong>Need to start this account over?</strong><span>Use Reset Data in the sidebar. It asks for confirmation before removing trade history and cannot be undone.</span></div>
      </Section>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" onClick={onClose}>Cancel</button>
        <button className="tj-btn-primary" onClick={() => onSave({ ...account, name: name.trim() || "Main Account", icon, profileImage, balance: parseFloat(balance) || 0, breakevenCap: parseFloat(beCap) || 0, defaultCommission: parseFloat(defaultCommission) || 0, monthlyGoalPct: parseFloat(monthlyGoalPct) || 0, yearlyGoalPct: parseFloat(yearlyGoalPct) || 0, dailyLossLimitPct: parseFloat(dailyLossLimitPct) || 0, monthlyLossLimitPct: parseFloat(monthlyLossLimitPct) || 0, theme })}>Save Settings</button>
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

function InstrumentManager({ instruments, onSave }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);
  const isDefault = (instrument) => DEFAULT_INSTRUMENTS.some((item) => item.toLowerCase() === instrument.toLowerCase());
  const add = () => { const next = value.trim(); if (!next || isDefault(next) || instruments.some((item) => item.toLowerCase() === next.toLowerCase())) return; onSave([...instruments, next]); setValue(""); };
  const rename = (old) => { const next = editing?.value?.trim(); if (!next || isDefault(next) || instruments.some((item) => item !== old && item.toLowerCase() === next.toLowerCase())) return setEditing(null); onSave(instruments.map((item) => item === old ? next : item)); setEditing(null); };
  const available = [...DEFAULT_INSTRUMENTS, ...instruments.filter((instrument) => !isDefault(instrument))];
  return <Card className="tj-panel tj-instrument-manager"><div className="tj-bold" style={{fontSize:16}}>Instrument Management</div><div className="tj-muted-txt" style={{fontSize:12,margin:"5px 0 12px"}}>Controls the instrument list in Trade Logs and Premarket Markups.</div><div className="tj-inline-add"><input className="tj-input" value={value} placeholder="Add an instrument..." onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} /><button className="tj-btn-primary" onClick={add}>Add</button></div><div className="tj-management-list">{available.map((instrument) => { const fixed = isDefault(instrument); return <div className="tj-rule-row" key={instrument}>{editing?.old === instrument ? <input autoFocus className="tj-input" value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onKeyDown={(event) => event.key === "Enter" && rename(instrument)} /> : <span>{instrument}</span>}<span className="tj-management-row-actions">{fixed ? <em className="tj-management-default">Default</em> : <><button className="tj-icon-btn" title="Edit custom instrument" onClick={() => editing?.old === instrument ? rename(instrument) : setEditing({ old: instrument, value: instrument })}><Pencil size={14}/></button><button className="tj-icon-btn" title="Remove custom instrument" onClick={() => { if (window.confirm(`Remove “${instrument}” from future instrument choices? Historical trades will not change.`)) onSave(instruments.filter((item) => item !== instrument)); }}><Trash2 size={14}/></button></>}</span></div>; })}</div></Card>;
}

function ManagementPage({ typeTags, mistakeTags, confluenceSessions, instruments, onTypeTags, onMistakes, onConfluence, onInstruments }) {
  return <div className="tj-management-workspace"><div className="tj-page-intro"><div><div className="tj-bold" style={{fontSize:18}}>Management</div><div className="tj-muted-txt" style={{fontSize:12}}>Configure the options available on future trades and markups. Historical records remain unchanged.</div></div><span className="tj-management-rules-note">Rules are managed from the Rules page</span></div><div className="tj-management-grid">
    <InstrumentManager instruments={instruments} onSave={onInstruments} />
    <ListManager title="Confluence" items={typeTags} onSave={onTypeTags} note="Former tag records. Select one or more confluences while logging a trade." />
    <ListManager title="Entry Type" items={confluenceSessions} onSave={onConfluence} note="Former Confluence Session records. Drives Entry Type analytics and setup cards." />
    <ListManager title="Mistake Management" items={mistakeTags} onSave={onMistakes} note="Multi-select mistakes available when logging a trade." />
  </div></div>;
}

function MarkupModal({ onClose, onSave, editing, instruments = [] }) {
  const [f,setF]=useState(() => {
    const base = { id: uid(), date:todayISO(), time:nowTime(), market:"", instrument:"", bias:"", status:"Planned", levels:"", structure:"", notes:"", screenshots:{preM15:[],preH4:[],postD1:[],postH4:[],postM15:[]} };
    if (!editing) return base;
    return { ...base, ...editing, time: editing.time || nowTime(), screenshots: { ...base.screenshots, ...(editing.screenshots && !Array.isArray(editing.screenshots) ? editing.screenshots : {}) } };
  });
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setShots=(slot)=>(updater)=>setF(x=>({...x,screenshots:{...x.screenshots,[slot]:updater(x.screenshots[slot])}}));
  const instrumentOptions = useMemo(() => [...DEFAULT_INSTRUMENTS, ...instruments.filter((instrument) => !DEFAULT_INSTRUMENTS.some((preset) => preset.toLowerCase() === instrument.toLowerCase()))], [instruments]);
  return <Modal title={editing ? "Edit Premarket Markup" : "New Premarket Markup"} onClose={onClose} wide>
    <div className="tj-grid4"><Field label="Date"><input type="date" className="tj-input" value={f.date} onChange={e=>set("date",e.target.value)}/></Field><Field label="Time *"><input type="time" required className="tj-input" value={f.time} onChange={e=>set("time",e.target.value)}/></Field><Field label="Market / Session"><select className="tj-input" value={f.market} onChange={e=>set("market",e.target.value)}><option value="">Select session</option>{SESSIONS.map((session)=><option key={session} value={session}>{session}</option>)}</select></Field><Field label="Instrument"><input className="tj-input" placeholder="Select or enter an instrument..." value={f.instrument} onChange={e=>set("instrument",e.target.value)} list="tj-instrument-list" /><datalist id="tj-instrument-list">{instrumentOptions.map((instrument)=><option key={instrument} value={instrument}/>)}</datalist></Field></div><Field label="Status"><select className="tj-input" value={f.status} onChange={e=>set("status",e.target.value)}>{["Planned","Watching","Executed","Passed"].map((status)=><option key={status} value={status}>{status}</option>)}</select><div className="tj-muted-txt tj-settings-hint">Linking a trade to this markup automatically sets its status to Executed.</div></Field>
    <div className="tj-markup-section"><div className="tj-section-label">Pre-Session Analysis</div><div className="tj-grid2"><Field label="Bias"><select className="tj-input" value={f.bias} onChange={e=>set("bias",e.target.value)}><option value="">Select bias</option>{MARKUP_BIASES.map((bias)=><option key={bias} value={bias}>{bias}</option>)}</select></Field><Field label="Key levels, liquidity & zones"><input className="tj-input" value={f.levels} onChange={e=>set("levels",e.target.value)}/></Field></div><Field label="Market structure / narrative"><textarea className="tj-input tj-textarea" placeholder="HTF context, structure and key areas..." value={f.structure} onChange={e=>set("structure",e.target.value)}/></Field><div className="tj-grid2"><div><div className="tj-field-label">LTF (M15) chart</div><ScreenshotUploader max={2} screenshots={f.screenshots.preM15} onChange={setShots("preM15")}/></div><div><div className="tj-field-label">MTF (H4) chart</div><ScreenshotUploader max={2} screenshots={f.screenshots.preH4} onChange={setShots("preH4")}/></div></div></div>
    <div className="tj-markup-section"><div className="tj-section-label">Expectations</div><Field label="Core narrative / what am I expecting?"><textarea className="tj-input tj-textarea" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="What needs to happen for the idea to be valid? Include entry conditions and invalidation."/></Field></div>
    <div className="tj-markup-section"><div className="tj-section-label">Post-Session Markup</div><div className="tj-grid3"><div><div className="tj-field-label">HTF (D1) chart</div><ScreenshotUploader max={2} screenshots={f.screenshots.postD1} onChange={setShots("postD1")}/></div><div><div className="tj-field-label">MTF (H4) chart</div><ScreenshotUploader max={2} screenshots={f.screenshots.postH4} onChange={setShots("postH4")}/></div><div><div className="tj-field-label">LTF (M15) chart</div><ScreenshotUploader max={2} screenshots={f.screenshots.postM15} onChange={setShots("postM15")}/></div></div></div>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={()=>f.time&&onSave(f)}>{editing ? "Save Changes" : "Save Markup"}</button></div>
  </Modal>;
}
function MarkupsPage({ markups, trades, onNew, onEdit, onDelete }) {
  const [open,setOpen]=useState({});
  const slots = [["preM15", "LTF (M15)"], ["preH4", "MTF (H4)"], ["postD1", "Post Market HTF (D1)"], ["postH4", "Post Market MTF (H4)"], ["postM15", "Post Market LTF (M15)"]];
  return <><div className="tj-rules-head"><div><div className="tj-bold" style={{fontSize:16}}>Premarket Markups</div><div className="tj-muted-txt" style={{fontSize:12}}>Prepare context before execution, then attach the resulting trades.</div></div><button className="tj-btn-primary" onClick={onNew}><Plus size={15}/> New Markup</button></div><div className="tj-tlog-list">{markups.length ? markups.map((markup) => {
    const linked=trades.filter((trade)=>trade.premarketMarkupId===markup.id), pnl=linked.reduce((sum,trade)=>sum+trade.pnl,0), expanded=!!open[markup.id];
    return <Card key={markup.id} className="tj-tlog-card"><div className="tj-tlog-row" onClick={()=>setOpen((state)=>({...state,[markup.id]:!state[markup.id]}))}><div className="tj-tlog-main"><div className="tj-tlog-asset">{markup.instrument||markup.market||"Untitled markup"} <span className="tj-sesspill">{markup.bias||"No bias"}</span> <span className={`tj-markup-status tj-markup-status-${String(markup.status||"Planned").toLowerCase()}`}>{markup.status||"Planned"}</span></div><div className="tj-muted-txt" style={{fontSize:12}}>{markup.date} · {formatTime(markup.time)} · {markup.market||"No session"} · {linked.length} linked trade{linked.length===1?"":"s"}</div></div><div className={`tj-tlog-pnl ${pnl>=0?"tj-green":"tj-red"}`}>{fmtMoney(pnl)}</div><button className="tj-btn-edit" onClick={(event)=>{event.stopPropagation();onEdit(markup)}}>Edit</button><button className="tj-icon-btn" title="Delete markup" onClick={(event)=>{event.stopPropagation();onDelete(markup.id)}}><Trash2 size={14}/></button><ChevronDown size={16} style={{transform:expanded?"rotate(180deg)":"none"}}/></div>{expanded&&<div className="tj-tlog-detail"><div className="tj-tlog-detail-grid"><div><div className="tj-mlabel">STATUS</div><div>{markup.status||"Planned"}</div></div><div><div className="tj-mlabel">LEVELS / ZONES</div><div>{markup.levels||"—"}</div></div><div><div className="tj-mlabel">STRUCTURE</div><div>{markup.structure||"—"}</div></div><div><div className="tj-mlabel">EXPECTATIONS</div><div>{markup.notes||"—"}</div></div></div><div className="tj-section-label">Markup Images</div><div className="tj-markup-images">{slots.map(([slot,label])=>{const images=markup.screenshots?.[slot]||[];return images.length?<div key={slot} className="tj-markup-image-section"><div className="tj-mlabel">{label}</div><div className="tj-tlog-shots">{images.map((src,index)=><ImagePreview key={index} src={src} alt={`${label} chart`}/>)}</div></div>:null;})}</div><div className="tj-section-label">Linked Trades</div>{linked.length?linked.map((trade)=><div key={trade.id} className="tj-rule-row"><span>{trade.date} · {formatTime(trade.time)} · {trade.asset} · {trade.direction} <span className="tj-muted-txt">· {trade.entryType||trade.confluenceSession||"No entry type"}</span></span><span className="tj-linked-trade-metrics"><RatingDisplay value={trade.rating} noRules={!trade.ruleEvaluations?.length&&!trade.rating}/><strong className={trade.pnl>=0?"tj-green":"tj-red"}>{fmtMoney(trade.pnl)}</strong></span></div>):<div className="tj-empty">No trades linked yet.</div>}</div>}</Card>;
  }):<div className="tj-empty-block"><ScanLine size={32}/><div className="tj-empty-title">No premarket markups</div><button className="tj-btn-primary" onClick={onNew}>Create your first markup</button></div>}</div></>;
}
function ReferenceMarkupsPage({ markups, trades, onNew, onEdit, onDelete, onTrade }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [session, setSession] = useState("All");
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const slots = [["preM15", "Pre-session M15"], ["preH4", "Pre-session H4"], ["postD1", "Post-session D1"], ["postH4", "Post-session H4"], ["postM15", "Post-session M15"]];
  const linkedTrades = (markup) => trades.filter((trade) => trade.premarketMarkupId === markup.id);
  const totalLinkedPnl = (markup) => linkedTrades(markup).reduce((sum, trade) => sum + trade.pnl, 0);
  const top = (items, key) => Object.entries(items.reduce((all, item) => ({ ...all, [item[key] || "Unspecified"]: (all[item[key] || "Unspecified"] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const linked = markups.filter((markup) => linkedTrades(markup).length > 0);
  const allLinkedTrades = linked.flatMap(linkedTrades);
  const allPnl = linked.reduce((sum, markup) => sum + totalLinkedPnl(markup), 0);
  const coverage = (predicate) => markups.length ? Math.round(markups.filter(predicate).length / markups.length * 100) : 0;
  const countWith = (keys) => (markup) => keys.some((key) => markup.screenshots?.[key]?.length);
  const planCoverage = coverage((markup) => markup.levels || markup.structure || markup.notes || markup.bias);
  const preCoverage = coverage(countWith(["preM15", "preH4"]));
  const postCoverage = coverage(countWith(["postD1", "postH4", "postM15"]));
  const sessions = ["All", ...Array.from(new Set(markups.map((markup) => markup.market).filter(Boolean)))];
  const shown = markups.filter((markup) => {
    const haystack = `${markup.instrument} ${markup.market} ${markup.bias} ${markup.status}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (status === "All" || (markup.status || "Planned") === status) && (session === "All" || markup.market === session);
  }).sort((a, b) => {
    if (sort === "oldest") return `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`);
    if (sort === "pnl") return totalLinkedPnl(b) - totalLinkedPnl(a);
    if (sort === "links") return linkedTrades(b).length - linkedTrades(a).length;
    return `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`);
  });
  const executed = markups.filter((markup) => markup.status === "Executed").length;
  const planned = markups.filter((markup) => markup.status === "Planned").length;
  const executionMatch = markups.length ? Math.round(linked.length / markups.length * 100) : 0;
  const best = linked.length ? Math.max(...linked.map(totalLinkedPnl)) : 0;
  const worst = linked.length ? Math.min(...linked.map(totalLinkedPnl)) : 0;
  const profitableLinked = allLinkedTrades.filter((trade) => trade.pnl > 0).length;
  const losingLinked = allLinkedTrades.filter((trade) => trade.pnl < 0).length;

  return <div className="tj-reference-markups">
    <div className="tj-rules-head"><div><div className="tj-bold" style={{ fontSize: 18 }}>Markups</div><div className="tj-muted-txt" style={{ fontSize: 12 }}>Prepare context before execution, then attach the final trade to its plan.</div></div><button className="tj-btn-primary" onClick={onNew}><Plus size={15}/> New Markup</button></div>
    <div className="tj-markup-overview-grid">
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">MARKUPS IN VIEW</div><strong>{markups.length}</strong><span>{top(markups, "instrument")} is showing up most</span><div className="tj-markup-progress"><i style={{width: markups.length ? "100%" : "0%"}}/></div><small>Top session: {top(markups, "market")} · {executed} executed · {planned} planned</small></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">EXECUTION MATCH</div><strong className={executionMatch >= 70 ? "tj-green" : "tj-amber-txt"}>{executionMatch}%</strong><span>{linked.length} of {markups.length} markups were linked to execution</span><div className="tj-markup-split"><i style={{width: `${executionMatch}%`}}/><b style={{width: `${100 - executionMatch}%`}}/></div><small>{allLinkedTrades.length} linked trades · {profitableLinked} profitable · {losingLinked} losing</small></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">LINKED P&amp;L</div><strong className={allPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(allPnl)}</strong><span>Average {linked.length ? fmtMoney(allPnl / linked.length) : "$0.00"} per linked markup</span><div className="tj-markup-bestworst"><div><small>Best linked</small><b className={best >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(best)}</b></div><div><small>Worst linked</small><b className={worst >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(worst)}</b></div></div></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">CAPTURE COVERAGE</div><strong>{Math.round((planCoverage + preCoverage + postCoverage) / 3)}%</strong><span>How complete the markup journal is across plan, pre-session, and review assets.</span><div className="tj-markup-coverage"><div><small>Plan</small><i><b style={{width: `${planCoverage}%`}}/></i><em>{planCoverage}%</em></div><div><small>Pre</small><i><b style={{width: `${preCoverage}%`}}/></i><em>{preCoverage}%</em></div><div><small>Post</small><i><b style={{width: `${postCoverage}%`}}/></i><em>{postCoverage}%</em></div></div></Card>
    </div>
    <div className="tj-markup-toolbar"><div className="tj-markup-toolbar-actions"><button className={`tj-icon-btn tj-markup-toolbar-button ${filtersOpen ? "tj-icon-btn-active" : ""}`} title="Filter markups" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={16}/></button><button className={`tj-icon-btn tj-markup-toolbar-button ${sortOpen ? "tj-icon-btn-active" : ""}`} title="Sort markups" onClick={() => setSortOpen((value) => !value)}><ArrowDownUp size={16}/></button></div><div className="tj-markup-toolbar-status"><span>{shown.length} shown</span><b>All visible</b></div>{filtersOpen && <div className="tj-markup-filter-controls"><div className="tj-toolbar-search"><Search size={15} className="tj-toolbar-search-icon"/><input className="tj-toolbar-search-input" placeholder="Search markups..." value={search} onChange={(event) => setSearch(event.target.value)}/></div><select className="tj-toolbar-dd" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option>{["Planned", "Watching", "Executed", "Passed"].map((item) => <option key={item}>{item}</option>)}</select><select className="tj-toolbar-dd" value={session} onChange={(event) => setSession(event.target.value)}>{sessions.map((item) => <option key={item}>{item}</option>)}</select></div>}{sortOpen && <div className="tj-markup-sort-controls"><span>Sort markups by</span><select className="tj-toolbar-dd" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="pnl">Linked P&amp;L</option><option value="links">Most linked trades</option></select></div>}</div>
    <div className="tj-tlog-list">{shown.length ? shown.map((markup) => {
      const related = linkedTrades(markup), pnl = totalLinkedPnl(markup), expanded = !!open[markup.id];
      return <Card key={markup.id} className="tj-tlog-card tj-reference-markup-card"><div className="tj-tlog-row" onClick={() => setOpen((current) => ({ ...current, [markup.id]: !current[markup.id] }))}><div className="tj-tlog-main"><div className="tj-tlog-asset">{markup.instrument || "Untitled markup"} <span className="tj-sesspill">{markup.bias || "No bias"}</span> <span className={`tj-markup-status tj-markup-status-${String(markup.status || "Planned").toLowerCase()}`}>{markup.status || "Planned"}</span></div><div className="tj-muted-txt" style={{fontSize: 12}}>{markup.date} · {formatTime(markup.time)} · {markup.market || "No session"} · {related.length} linked trade{related.length === 1 ? "" : "s"}</div></div><div className="tj-markup-pnl"><strong className={pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(pnl)}</strong><span>linked P&amp;L</span></div><button className="tj-btn-outline tj-btn-small" onClick={(event) => { event.stopPropagation(); onTrade(markup); }}>Trade</button><button className="tj-icon-btn" title="Edit markup" onClick={(event) => { event.stopPropagation(); onEdit(markup); }}><Pencil size={15}/></button><button className="tj-icon-btn" title="Delete markup" onClick={(event) => { event.stopPropagation(); onDelete(markup.id); }}><Trash2 size={14}/></button><ChevronDown size={16} style={{ transform: expanded ? "rotate(180deg)" : "none" }}/></div>{expanded && <div className="tj-tlog-detail"><div className="tj-markup-detail-top"><div><div className="tj-mlabel">SESSION</div><strong>{markup.market || "—"}</strong></div><div><div className="tj-mlabel">PLAN FILLED</div><strong>{markup.levels || markup.structure || markup.notes ? "100%" : "0%"}</strong></div><div><div className="tj-mlabel">LINKED TRADES</div><strong>{related.length}</strong></div><div><div className="tj-mlabel">CHARTS SAVED</div><strong>{slots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0)}</strong></div></div><div className="tj-section-label">Pre-session Plan</div><div className="tj-tlog-detail-grid"><div><div className="tj-mlabel">BIAS</div><div>{markup.bias || "—"}</div></div><div><div className="tj-mlabel">STATUS</div><div>{markup.status || "Planned"}</div></div><div><div className="tj-mlabel">STRUCTURE</div><div>{markup.structure || "—"}</div></div><div><div className="tj-mlabel">LEVELS / ZONES</div><div>{markup.levels || "—"}</div></div><div><div className="tj-mlabel">EXPECTATIONS</div><div>{markup.notes || "—"}</div></div></div><div className="tj-section-label">Linked Trades</div>{related.length ? <div className="tj-linked-markup-trades">{related.map((trade) => <div className="tj-linked-markup-trade" key={trade.id}><div><strong>{trade.asset} · {trade.direction}</strong><span>{trade.date} · {formatTime(trade.time)} · R:R {trade.rr ? `${trade.rr.toFixed(2)}R` : "—"}</span></div><div><RatingDisplay value={trade.rating} noRules={!trade.ruleEvaluations?.length&&!trade.rating}/><strong className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</strong></div></div>)}</div> : <div className="tj-empty">No trades are linked yet. Use Trade to pre-link a new trade to this markup.</div>}<div className="tj-section-label">Charts</div><div className="tj-markup-images">{slots.map(([key, label]) => { const images = markup.screenshots?.[key] || []; return images.length ? <div className="tj-markup-image-section" key={key}><div className="tj-mlabel">{label}</div><div className="tj-tlog-shots">{images.map((source, index) => <ImagePreview key={index} src={source} alt={label}/>)}</div></div> : null; })}</div></div>}</Card>;
    }) : <div className="tj-empty-block"><ScanLine size={32} color="var(--tj-muted)"/><div className="tj-empty-title">No markups match these filters</div><button className="tj-btn-primary" onClick={onNew}>Create a markup</button></div>}</div>
  </div>;
}

const periodMatchesTrade = (trade, type, key) => {
  if (!trade.date) return false;
  if (type === "monthly") return trade.date.slice(0, 7) === key;
  if (type === "annual") return trade.date.slice(0, 4) === key;
  const [year, quarter] = key.split("-Q");
  return trade.date.slice(0, 4) === year && Math.floor(new Date(`${trade.date}T00:00:00`).getMonth() / 3) + 1 === Number(quarter);
};

function reviewPeriodStats(trades, reviews, account, type, key) {
  const periodTrades = trades.filter((trade) => periodMatchesTrade(trade, type, key));
  const reviewedIds = new Set(reviews.map((review) => review.tradeId).filter(Boolean));
  const reviewedTrades = periodTrades.filter((trade) => reviewedIds.has(trade.id));
  const wins = periodTrades.filter((trade) => classify(trade.pnl, account.breakevenCap) === "win");
  const losses = periodTrades.filter((trade) => classify(trade.pnl, account.breakevenCap) === "loss");
  const netPnl = periodTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const coverage = periodTrades.length ? reviewedTrades.length / periodTrades.length : 0;
  const sessions = periodTrades.reduce((all, trade) => {
    const name = trade.entrySession || trade.session || "Unspecified";
    const item = all[name] || { name, pnl: 0, trades: 0 };
    item.pnl += trade.pnl; item.trades += 1; all[name] = item;
    return all;
  }, {});
  const entryTypes = periodTrades.reduce((all, trade) => {
    const name = trade.entryType || trade.confluenceSession || "Unspecified";
    const item = all[name] || { name, pnl: 0, trades: 0 };
    item.pnl += trade.pnl; item.trades += 1; all[name] = item;
    return all;
  }, {});
  return {
    trades: periodTrades,
    reviewedTrades,
    total: periodTrades.length,
    reviewed: reviewedTrades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: periodTrades.length - wins.length - losses.length,
    netPnl,
    returnPct: account.balance ? (netPnl / account.balance) * 100 : 0,
    winRate: periodTrades.length ? wins.length / periodTrades.length * 100 : 0,
    avgRR: periodTrades.length ? periodTrades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / periodTrades.length : 0,
    coverage,
    performance: Number((coverage * 5).toFixed(1)),
    bestSession: Object.values(sessions).sort((a, b) => b.pnl - a.pnl)[0]?.name || "—",
    strongestEdge: Object.values(entryTypes).sort((a, b) => b.pnl - a.pnl)[0]?.name || "—",
  };
}

function TradeReviewEditorModal({ trade, existing, onClose, onSave }) {
  const blank = { tradeId: trade.id, date: todayISO(), time: nowTime(), doneWell: "", wentWrong: "", execution: "", adherence: "", psychology: "", lessons: "", actions: "", notes: "", screenshots: [] };
  const [form, setForm] = useState(() => existing ? { ...blank, ...existing, tradeId: trade.id } : blank);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => { if (!form.time) return; const didSave = await onSave(form); if (didSave !== false) onClose(); };
  return <Modal title={`${existing ? "Edit" : "Review"} ${trade.asset || "Trade"}`} onClose={onClose} wide>
    <div className="tj-review-trade-meta"><strong>{trade.asset} · {trade.direction}</strong><span>{trade.date} · {formatTime(trade.time)} · Net {fmtMoney(trade.pnl)}</span></div>
    <div className="tj-grid2"><Field label="Review date"><input type="date" className="tj-input" value={form.date} onChange={(event) => set("date", event.target.value)} /></Field><Field label="Review time *"><input type="time" required className="tj-input" value={form.time} onChange={(event) => set("time", event.target.value)} /></Field></div>
    <div className="tj-grid2"><Field label="What went well"><textarea className="tj-input tj-textarea" value={form.doneWell} onChange={(event) => set("doneWell", event.target.value)} /></Field><Field label="What went wrong"><textarea className="tj-input tj-textarea" value={form.wentWrong} onChange={(event) => set("wentWrong", event.target.value)} /></Field></div>
    <div className="tj-grid3"><Field label="Execution review"><textarea className="tj-input tj-textarea" value={form.execution} onChange={(event) => set("execution", event.target.value)} /></Field><Field label="Rule adherence"><textarea className="tj-input tj-textarea" value={form.adherence} onChange={(event) => set("adherence", event.target.value)} /></Field><Field label="Psychology"><textarea className="tj-input tj-textarea" value={form.psychology} onChange={(event) => set("psychology", event.target.value)} /></Field></div>
    <div className="tj-grid2"><Field label="Lessons learned"><textarea className="tj-input tj-textarea" value={form.lessons} onChange={(event) => set("lessons", event.target.value)} /></Field><Field label="Improvement / action items"><textarea className="tj-input tj-textarea" value={form.actions} onChange={(event) => set("actions", event.target.value)} /></Field></div>
    <Field label="Review notes"><textarea className="tj-input tj-textarea" value={form.notes} onChange={(event) => set("notes", event.target.value)} /></Field>
    <ScreenshotUploader screenshots={form.screenshots} onChange={(update) => setForm((current) => ({ ...current, screenshots: update(current.screenshots) }))} />
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>Save Trade Review</button></div>
  </Modal>;
}

const PERIOD_REVIEW_FIELDS = {
  technical: [
    ["technicalWins", "What commonalities were present in my winning trades?"],
    ["technicalLosses", "What commonalities were present in my losing trades?"],
    ["technicalRules", "Are there any strategy rules I need to tweak, add, or remove?"],
  ],
  mistakes: [["mistakes", "Which mistakes need the clearest correction next period?"]],
  habits: [["habits", "Which habits helped, and which habits need stronger structure?"]],
  markups: [["markups", "How did my preparation and markup process support execution?"]],
  goals: [["goals", "What is the most important goal for the next period?"]],
  overall: [
    ["overallWell", "What did I do well this period?"],
    ["overallLessons", "What are my top lessons from this period?"],
    ["overallAdjustment", "What is the single most important adjustment for next period?"],
  ],
};

function PeriodReviewModal({ period, saved, reviews, onClose, onSave, onStartTradeReview }) {
  const initialContent = { overview: "", invalid: "", missedTrades: "", strategyPerformance: "", ...(saved?.content || {}) };
  const [content, setContent] = useState(initialContent);
  const [completed, setCompleted] = useState(!!saved?.completed);
  const [openSections, setOpenSections] = useState({ technical: true, overall: true });
  const set = (key, value) => setContent((current) => ({ ...current, [key]: value }));
  const reviewByTrade = new Map(reviews.map((review) => [review.tradeId, review]));
  const save = async () => { const didSave = await onSave({ type: period.type, key: period.key, content, completed }); if (didSave !== false) onClose(); };
  const stat = period.stats;
  const section = (id, title) => <section className="tj-period-section" key={id}><button type="button" className="tj-period-section-head" onClick={() => setOpenSections((current) => ({ ...current, [id]: !current[id] }))}><strong>{title}</strong><ChevronDown size={17} style={{ transform: openSections[id] ? "rotate(180deg)" : "none" }} /></button>{openSections[id] && <div className="tj-period-section-body">{PERIOD_REVIEW_FIELDS[id].map(([key, label]) => <Field key={key} label={label}><textarea className="tj-input tj-textarea" placeholder="Write your review…" value={content[key] || ""} onChange={(event) => set(key, event.target.value)} /></Field>)}</div>}</section>;
  return <Modal title={`${period.label} Review`} onClose={onClose} wide>
    <div className="tj-period-review-summary">
      <div className="tj-period-review-title"><div className="tj-section-label">{period.label.toUpperCase()} REVIEW</div><span>{period.year} · {stat.total} trade{stat.total === 1 ? "" : "s"} closed · {stat.reviewed} reviewed</span></div>
      <div className="tj-period-metric-grid"><div><small>COMPLETED</small><strong>{completed ? "Yes" : "No"}</strong><span>Lock it in when the reflection is ready.</span></div><div><small>NET P&amp;L</small><strong className={stat.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stat.netPnl)}</strong><span>{stat.returnPct >= 0 ? "+" : ""}{stat.returnPct.toFixed(2)}% of account base</span></div><div><small>WIN RATE</small><strong>{stat.winRate.toFixed(1)}%</strong><span>{stat.wins} wins · {stat.losses} losses · {stat.breakeven} B/E</span></div><div><small>PERFORMANCE (0–5)</small><strong>{stat.performance.toFixed(1)}/5</strong><span>Review coverage drives this score.</span></div><div><small>AVG RR</small><strong>{stat.avgRR.toFixed(2)}R</strong><span>Risk quality for the period.</span></div><div><small>BEST SESSION</small><strong>{stat.bestSession}</strong><span>Highest net P&amp;L session.</span></div></div>
      <div className="tj-period-meter-grid"><div><small>REVIEW COVERAGE</small><b>{stat.reviewed}/{stat.total || 0}</b><i><em style={{ width: `${stat.coverage * 100}%` }} /></i></div><div><small>RESULT MIX</small><b>{stat.wins}W · {stat.losses}L · {stat.breakeven} B/E</b><i className="tj-result-meter"><em style={{ width: `${stat.total ? stat.wins / stat.total * 100 : 0}%` }} /><strong style={{ width: `${stat.total ? stat.losses / stat.total * 100 : 0}%` }} /></i></div><div><small>STRONGEST EDGE</small><b>{stat.strongestEdge}</b><span>Based on the saved Entry Type.</span></div></div>
    </div>
    <section className="tj-period-at-glance"><div className="tj-bold">Period At A Glance</div><div className="tj-muted-txt" style={{ fontSize: 12 }}>Quick reads for what mattered across this period.</div><Field label="My performance"><input className="tj-input" placeholder="Add a short read…" value={content.overview || ""} onChange={(event) => set("overview", event.target.value)} /></Field><Field label="Invalid"><input className="tj-input" placeholder="Add a short read…" value={content.invalid || ""} onChange={(event) => set("invalid", event.target.value)} /></Field><Field label="Missed trades"><input className="tj-input" placeholder="Add a short read…" value={content.missedTrades || ""} onChange={(event) => set("missedTrades", event.target.value)} /></Field><Field label="Strategy performance"><input className="tj-input" placeholder="Add a short read…" value={content.strategyPerformance || ""} onChange={(event) => set("strategyPerformance", event.target.value)} /></Field></section>
    <div className="tj-period-sections">{section("technical", "Technical")}{section("mistakes", "Mistakes")}{section("habits", "Habits")}{section("markups", "Markups")}{section("goals", "Goals")}{section("overall", "Overall Performance")}</div>
    <section className="tj-period-trades"><div className="tj-period-trades-head"><div><div className="tj-bold">Trades Taken</div><div className="tj-muted-txt" style={{ fontSize: 12 }}>Review coverage stays linked to the original trade record.</div></div><span className="tj-count-badge">{stat.total}</span></div>{stat.trades.length ? stat.trades.sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)).map((trade) => { const review = reviewByTrade.get(trade.id); return <div className="tj-period-trade-row" key={trade.id}><div><strong>{trade.asset || "No instrument"}</strong><span className={`tj-dirpill-sm ${trade.direction === "BUY" ? "tj-green" : "tj-red"}`}>{trade.direction}</span><span className="tj-sesspill">{trade.entrySession || trade.session || "—"}</span><span className="tj-sesspill">{trade.entryType || trade.confluenceSession || "—"}</span><small>{trade.date} · {trade.rr ? `${Number(trade.rr).toFixed(2)}R` : "—"}</small></div><div><span className={review ? "tj-review-status-done" : "tj-review-status-pending"}>{review ? "✓ Reviewed" : "Review Pending"}</span><button className="tj-btn-outline tj-btn-small" onClick={() => onStartTradeReview(trade, review)}>{review ? "Edit" : "Review"}</button></div></div>; }) : <div className="tj-empty">No trades were logged for this period.</div>}</section>
    <div className="tj-modal-actions"><button className={`tj-btn-outline ${completed ? "tj-chip-active" : ""}`} onClick={() => setCompleted((value) => !value)}>{completed ? "✓ Review complete" : "Mark review complete"}</button><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>Save Review</button></div>
  </Modal>;
}

function ReviewLibraryPage({ account, trades, reviews, periodReviews, onSavePeriod, onSaveTrade }) {
  const currentYear = new Date().getFullYear();
  const [reviewYear, setReviewYear] = useState(currentYear);
  const [activePeriod, setActivePeriod] = useState(null);
  const [tradeEditor, setTradeEditor] = useState(null);
  const savedByPeriod = new Map(periodReviews.map((review) => [`${review.type}:${review.key}`, review]));
  const months = MONTH_NAMES.map((name, index) => {
    const key = `${reviewYear}-${String(index + 1).padStart(2, "0")}`;
    return { type: "monthly", key, label: name, year: reviewYear, stats: reviewPeriodStats(trades, reviews, account, "monthly", key) };
  });
  const quarters = [1, 2, 3, 4].map((quarter) => {
    const key = `${reviewYear}-Q${quarter}`;
    return { type: "quarterly", key, label: `Q${quarter} ${reviewYear}`, year: reviewYear, stats: reviewPeriodStats(trades, reviews, account, "quarterly", key) };
  });
  const annual = { type: "annual", key: String(reviewYear), label: `${reviewYear} Annual`, year: reviewYear, stats: reviewPeriodStats(trades, reviews, account, "annual", String(reviewYear)) };
  const activeMonth = `${reviewYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const pending = trades.filter((trade) => trade.date?.slice(0, 7) === activeMonth && !reviews.some((review) => review.tradeId === trade.id));
  const openPeriod = (period) => setActivePeriod(period);
  const renderPeriodCard = (period, compact = false) => {
    const saved = savedByPeriod.get(`${period.type}:${period.key}`);
    const stat = period.stats;
    return <button type="button" key={period.key} className={`tj-review-library-card ${compact ? "tj-review-library-card-compact" : ""} ${stat.total ? "tj-review-library-card-live" : ""}`} onClick={() => openPeriod(period)}><div className="tj-review-card-top"><span>{period.label.toUpperCase()}</span>{stat.total ? <b className={stat.netPnl >= 0 ? "tj-green" : "tj-red"}>{stat.returnPct >= 0 ? "+" : ""}{stat.returnPct.toFixed(2)}%</b> : <b>—</b>}</div>{stat.total ? <><strong>{stat.reviewed}/{stat.total}</strong><small>{stat.reviewed} reviewed · {stat.performance.toFixed(1)}/5</small><div className="tj-review-card-foot"><span>{stat.total} trades</span><span>{stat.winRate.toFixed(0)}% WR</span></div><i><em style={{ width: `${stat.coverage * 100}%` }} /></i></> : <><strong>No trades</strong><small>{saved?.completed ? "Reflection saved" : "Empty period"}</small><div className="tj-review-card-foot"><span>0 trades</span><span>0% WR</span></div></>}</button>;
  };
  return <div className="tj-review-library">
    <Card className="tj-review-workspace"><div className="tj-review-library-head"><div><div className="tj-section-label">REVIEW WORKSPACE</div><div className="tj-bold" style={{ fontSize: 22 }}>Review Library</div><div className="tj-muted-txt" style={{ fontSize: 12 }}>Monthly, quarterly, and annual reflection in one clear workspace.</div></div><div className="tj-review-year-switch"><button className="tj-icon-btn" onClick={() => setReviewYear((year) => year - 1)}><ChevronLeft size={17}/></button><strong>{reviewYear}</strong><button className="tj-icon-btn" onClick={() => setReviewYear((year) => year + 1)}><ChevronRight size={17}/></button></div></div><div className="tj-review-period-title">MONTHLY REVIEW</div><div className="tj-review-month-grid">{months.map((period) => renderPeriodCard(period))}</div><div className="tj-review-period-title">QUARTERLY REVIEW</div><div className="tj-review-quarter-grid">{quarters.map((period) => renderPeriodCard(period, true))}</div><div className="tj-review-period-title">ANNUAL REVIEW</div><div className="tj-review-annual-grid">{renderPeriodCard(annual, true)}</div></Card>
    <Card className="tj-trades-to-review"><div className="tj-period-trades-head"><div><div className="tj-bold">Trades to Review</div><div className="tj-muted-txt" style={{ fontSize: 12 }}>Closed trades from this month still waiting for a write-up.</div></div><span className="tj-count-badge">{pending.length}</span></div>{pending.length ? <div className="tj-review-pending-list">{pending.map((trade) => <div className="tj-period-trade-row" key={trade.id}><div><strong>{trade.asset || "No instrument"}</strong><span className={`tj-dirpill-sm ${trade.direction === "BUY" ? "tj-green" : "tj-red"}`}>{trade.direction}</span><span className="tj-sesspill">{trade.entrySession || trade.session || "—"}</span><small>{trade.date} · {formatTime(trade.time)} · {fmtMoney(trade.pnl)}</small></div><button className="tj-btn-primary tj-btn-small" onClick={() => setTradeEditor({ trade })}>Review trade</button></div>)}</div> : <div className="tj-empty">Everything closed this month already has a saved trade review.</div>}</Card>
    {activePeriod && <PeriodReviewModal period={activePeriod} saved={savedByPeriod.get(`${activePeriod.type}:${activePeriod.key}`)} reviews={reviews} onClose={() => setActivePeriod(null)} onSave={onSavePeriod} onStartTradeReview={(trade, existing) => setTradeEditor({ trade, existing })} />}
    {tradeEditor && <TradeReviewEditorModal trade={tradeEditor.trade} existing={tradeEditor.existing} onClose={() => setTradeEditor(null)} onSave={onSaveTrade} />}
  </div>;
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
          onCreate({ id: "acc-" + uid(), name: name.trim(), icon, profileImage: "", balance: parseFloat(balance) || 0, breakevenCap: 0, ratingStyle: "stars", theme: "dark", defaultCommission: 0, monthlyGoalPct: 0, yearlyGoalPct: 0, dailyLossLimitPct: 0, monthlyLossLimitPct: 0, trades: [], rules: [], checkins: {} });
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

/* ====================== REFERENCE-STYLE DASHBOARD ====================== */

function GuardrailMetric({ label, value, target, suffix, loss = false, hit = false }) {
  const percent = progressPct(value, target);
  return <div className={`tj-guardrail-metric ${loss && hit ? "tj-guardrail-hit" : ""}`}>
    <div className="tj-mlabel">{label}</div>
    <div className={loss && hit ? "tj-red tj-guardrail-value" : "tj-guardrail-value"}>{fmtMoney(value)} <span className="tj-muted-txt">/ {fmtMoney(target)}</span></div>
    <div className="tj-bar-track"><div className={`tj-bar-fill ${loss && hit ? "tj-bar-red" : "tj-bar-green"}`} style={{ width: `${percent}%` }} /></div>
    <div className="tj-stat-sub">{hit ? "Limit reached — trade entry paused" : suffix}</div>
  </div>;
}

function ReferenceDashboardPage({ account, stats, monthCursor, setMonthCursor, onDayClick, guardrails }) {
  const [view, setView] = useState("recent");
  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const byDay = groupByDay(account.trades, account.breakevenCap);
  const weeks = buildMonthGrid(year, month, byDay);
  const monthTrades = account.trades.filter((trade) => trade.date?.slice(0, 7) === monthKey);
  const monthStats = computeStats(monthTrades, account.breakevenCap);
  const weeklyBreakdown = computeWeeklyBreakdown(account.trades, year, month, account.breakevenCap);
  const recentTrades = [...account.trades].sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)).slice(0, 8);
  const lastSix = recentTrades.slice(0, 6).reverse();
  // Dashboard headline metrics are all-time. The month-specific cards below
  // remain scoped to the selected calendar month.
  const thisYearStats = stats;
  const bestSession = SESSIONS.map((session) => ({ session, pnl: account.trades.filter((trade) => (trade.entrySession || trade.session) === session).reduce((sum, trade) => sum + trade.pnl, 0) })).sort((a, b) => b.pnl - a.pnl)[0];
  const hotPair = Object.entries(account.trades.reduce((all, trade) => ({ ...all, [trade.asset]: (all[trade.asset] || 0) + trade.pnl }), {})).sort((a, b) => b[1] - a[1])[0];
  const flowPct = account.balance ? (stats.netPnl / account.balance) * 100 : 0;
  const allTradesSorted = [...account.trades].sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  const cumulative = useMemo(() => {
    let running = 0;
    return allTradesSorted.map((trade) => { running += trade.pnl; return { date: trade.date.slice(5), cumulative: +running.toFixed(2) }; });
  }, [allTradesSorted]);
  const monthFlow = useMemo(() => {
    let running = 0;
    return [...monthTrades].sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`)).map((trade) => { running += trade.pnl; return { date: trade.date.slice(8), pnl: +running.toFixed(2) }; });
  }, [monthTrades]);
  const dailyData = useMemo(() => thisYearStats.dayClasses.map((day) => ({ date: day.date.slice(5), pnl: +day.pnl.toFixed(2), cls: day.cls })), [thisYearStats.dayClasses]);
  const radarData = [
    { metric: "Win rate", value: thisYearStats.winRate },
    { metric: "PF", value: norm(thisYearStats.profitFactor, 5) },
    { metric: "Avg RR", value: norm(thisYearStats.avgWinLoss, 3) },
    { metric: "Consistency", value: thisYearStats.consistency },
    { metric: "Recovery", value: thisYearStats.recovery },
  ];
  const allTimeReturn = account.balance ? (thisYearStats.netPnl / account.balance) * 100 : 0;
  const payoffSegment = thisYearStats.avgWin + thisYearStats.avgLoss ? clamp((thisYearStats.avgWin / (thisYearStats.avgWin + thisYearStats.avgLoss)) * 100, 0, 100) : 50;
  const dayWinBars = thisYearStats.dayClasses.slice(-13);
  const lastSixPositive = lastSix.filter((trade) => trade.pnl > account.breakevenCap).length;

  return <div className="tj-reference-dashboard">
    {guardrails.enabled && <Card className="tj-panel tj-guardrails">
      <div className="tj-panel-head"><div><span>Account Guardrails</span><div className="tj-muted-txt tj-guardrails-note">Goals track performance. A loss cap pauses new trade entry until its reset period; markups remain available.</div></div><span className={`tj-pill ${guardrails.tradeEntryLocked ? "tj-pill-red" : "tj-pill-green"}`}>{guardrails.tradeEntryLocked ? "Trade entry paused" : "Active"}</span></div>
      <div className="tj-guardrail-grid">
        {guardrails.monthlyGoalPct > 0 && <GuardrailMetric label="Monthly Goal" value={guardrails.monthlyPnl} target={guardrails.monthlyGoal} suffix={`${guardrails.monthlyGoalPct}% target`} />}
        {guardrails.yearlyGoalPct > 0 && <GuardrailMetric label="Yearly Goal" value={guardrails.yearlyPnl} target={guardrails.yearlyGoal} suffix={`${guardrails.yearlyGoalPct}% target`} />}
        {guardrails.dailyLossLimitPct > 0 && <GuardrailMetric loss label="Daily Loss Cap" value={Math.max(0, -guardrails.dailyPnl)} target={guardrails.dailyLossCap} suffix={`${guardrails.dailyLossLimitPct}% cap`} hit={guardrails.dailyLossHit} />}
        {guardrails.monthlyLossLimitPct > 0 && <GuardrailMetric loss label="Monthly Loss Cap" value={Math.max(0, -guardrails.monthlyPnl)} target={guardrails.monthlyLossCap} suffix={`${guardrails.monthlyLossLimitPct}% cap`} hit={guardrails.monthlyLossHit} />}
      </div>
    </Card>}

    <div className="tj-reference-kpis">
      <Card className="tj-reference-kpi tj-kpi-equity"><div className="tj-kpi-top"><div className="tj-stat-label">ALL-TIME NET P&amp;L</div><span>{allTimeReturn >= 0 ? "+" : ""}{allTimeReturn.toFixed(2)}%</span></div><div className={`tj-reference-kpi-value ${thisYearStats.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(thisYearStats.netPnl)}</div><div className="tj-stat-sub">{thisYearStats.total} trades across your journal</div><div className="tj-kpi-spark"><ResponsiveContainer width="100%" height={26}><AreaChart data={cumulative}><Area type="monotone" dataKey="cumulative" stroke={UI_COLORS.primary} fill="none" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></div><small>Streak {thisYearStats.streak ? `${thisYearStats.streakType === "loss" ? "-" : "+"}${thisYearStats.streak}` : "—"}</small></Card>
      <Card className="tj-reference-kpi"><div className="tj-kpi-top"><div className="tj-stat-label">PROFIT FACTOR</div><span className={thisYearStats.profitFactor >= 1.5 ? "tj-green" : "tj-red"}>{thisYearStats.profitFactor >= 1.5 ? "healthy" : "needs work"}</span></div><div className="tj-reference-kpi-value">{thisYearStats.profitFactor.toFixed(2)}</div><div className="tj-kpi-line"><i style={{width: `${clamp(norm(thisYearStats.profitFactor, 5), 0, 100)}%`}}/></div><div className="tj-stat-sub">Risk-adjusted payoff quality.</div><small>Recovery {thisYearStats.recovery.toFixed(0)}% <em>Core Score {thisYearStats.thunderScore}</em></small></Card>
      <Card className="tj-reference-kpi"><div className="tj-kpi-top"><div className="tj-stat-label">DAY WIN %</div><span>{thisYearStats.dayClasses.length} days</span></div><div className={`tj-reference-kpi-value ${wrColorClass(thisYearStats.dayWinRate)}`}>{thisYearStats.dayWinRate.toFixed(2)}%</div><div className="tj-day-bar-strip">{dayWinBars.length ? dayWinBars.map((day) => <i key={day.date} className={day.cls === "win" ? "tj-day-bar-win" : day.cls === "loss" ? "tj-day-bar-loss" : "tj-day-bar-be"}/>) : <span>No completed days</span>}</div><div className="tj-stat-sub">{thisYearStats.dayClasses.length} trading days · {monthStats.dayClasses.length} this month</div></Card>
      <Card className="tj-reference-kpi"><div className="tj-kpi-top"><div className="tj-stat-label">WIN RATE %</div><span>{thisYearStats.total} total</span></div><div className={`tj-reference-kpi-value ${wrColorClass(thisYearStats.winRate)}`}>{thisYearStats.winRate.toFixed(2)}%</div><div className="tj-kpi-split"><i style={{width: `${thisYearStats.winRate}%`}}/><b style={{width: `${100 - thisYearStats.winRate}%`}}/></div><div className="tj-stat-sub"><strong className="tj-green">{thisYearStats.wins} wins</strong><strong className="tj-red">{thisYearStats.losses} losses</strong></div></Card>
      <Card className="tj-reference-kpi"><div className="tj-kpi-top"><div className="tj-stat-label">AVG WIN/LOSS TRADE</div><span>{thisYearStats.avgWinLoss >= 1.5 ? "strong" : "building"}</span></div><div className="tj-reference-kpi-value">{thisYearStats.avgLoss ? thisYearStats.avgWinLoss.toFixed(2) : "—"}</div><div className="tj-kpi-split"><i style={{width: `${payoffSegment}%`}}/><b style={{width: `${100 - payoffSegment}%`}}/></div><div className="tj-stat-sub">Winner vs loser edge.</div><small>Best run {thisYearStats.bestWinStreak}W <em>Max loss run {thisYearStats.bestLossStreak}L</em></small></Card>
    </div>

    <div className="tj-reference-hero-grid">
      <Card className="tj-panel tj-reference-calendar">
        <div className="tj-reference-month-head"><div className="tj-month-nav"><button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16}/></button><strong>{MONTH_NAMES[month]} {year}</strong><button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}><ChevronRight size={16}/></button><button className="tj-btn-outline tj-btn-small" onClick={() => setMonthCursor(new Date())}>This month</button></div><div className="tj-reference-month-total"><strong className={monthStats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(monthStats.netPnl)}</strong><span>{monthStats.dayClasses.length} days</span><span>{monthStats.wins}W</span><span>{monthStats.losses}L</span><span>{monthStats.be} B/E</span></div></div>
        <div className="tj-reference-calendar-body"><div><div className="tj-cal-dow">{DOW.map((day) => <div key={day}>{day}</div>)}</div><div className="tj-cal-grid">{weeks.flat().map((cell, index) => <div key={index} className={`tj-cal-cell tj-dock-cell ${cell ? `tj-cal-${cell.cls || "none"}` : "tj-cal-empty"} ${cell?.iso === todayISO() ? "tj-cal-today" : ""} ${cell?.count ? "tj-cal-clickable" : ""}`} onClick={() => cell?.count && onDayClick(cell.iso)}>{cell && <><div className="tj-cal-day">{cell.day}</div>{cell.count > 0 && <><div className={`tj-cal-pnl ${clsColor(cell.cls)}`}>{fmtMoneyShort(cell.pnl)}</div><div className="tj-cal-tcount">{cell.count}</div></>}</>}</div>)}</div></div><aside className="tj-reference-week-rail">{weeklyBreakdown.map((week, index) => { const percent = account.balance ? week.pnl / account.balance * 100 : 0; return <div className={`tj-reference-week ${week.count ? "tj-reference-week-active" : ""}`} key={week.label}><div><span>WEEK {index + 1}</span><strong className={week.pnl >= 0 ? "tj-green" : "tj-red"}>{week.count ? `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%` : "0.00%"}</strong></div><i><b style={{width: `${week.count ? week.winRate : 0}%`}}/></i><small>{week.count ? `${week.count} days · ${week.winRate.toFixed(0)}% win` : "Quiet week"}</small></div>; })}</aside></div>
      </Card>
      <Card className="tj-panel tj-reference-flow">
        <div className="tj-reference-flow-head"><div><strong>Performance Flow</strong><span>Current month pulse across closes, strongest context, and recent outcomes.</span></div><div className="tj-tabs"><button className={`tj-tab ${view === "recent" ? "tj-tab-active" : ""}`} onClick={() => setView("recent")}>Recent Trades</button><button className={`tj-tab ${view === "flow" ? "tj-tab-active" : ""}`} onClick={() => setView("flow")}>Performance Flow</button></div></div>
        {view === "recent" ? <div className="tj-recent-table"><div className="tj-recent-head"><span>Close Date</span><span>Instrument</span><span>Side</span><span>Session</span><span>Net P&amp;L</span></div>{recentTrades.length ? recentTrades.map((trade) => <div className="tj-recent-row" key={trade.id}><span>{trade.date} · {formatTime(trade.time)}</span><strong>{trade.asset}</strong><span className={trade.direction === "BUY" ? "tj-green" : "tj-red"}>{trade.direction}</span><span>{trade.entrySession || trade.session || "—"}</span><strong className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</strong></div>) : <div className="tj-empty">No trades yet. Your newest completed trade will appear here.</div>}</div> : <><div className="tj-reference-flow-metrics"><div><span>LAST 6 CLOSES</span><strong className={flowPct >= 0 ? "tj-green" : "tj-red"}>{flowPct >= 0 ? "+" : ""}{flowPct.toFixed(2)}%</strong><small>{fmtMoney(stats.netPnl)}</small></div><div><span>BEST SESSION</span><strong>{bestSession?.session || "—"}</strong><small className={bestSession?.pnl >= 0 ? "tj-green" : "tj-red"}>{bestSession ? fmtMoney(bestSession.pnl) : "No trades"}</small></div><div><span>HOT INSTRUMENT</span><strong>{hotPair?.[0] || "—"}</strong><small className={hotPair?.[1] >= 0 ? "tj-green" : "tj-red"}>{hotPair ? fmtMoney(hotPair[1]) : "No trades"}</small></div><div><span>CURRENT STREAK</span><strong className={stats.streakType === "loss" ? "tj-red" : "tj-green"}>{stats.streak ? `${stats.streakType === "loss" ? "-" : "+"}${stats.streak}` : "—"}</strong><small>{lastSixPositive}/{lastSix.length || 0} recent closes green</small></div></div><div className="tj-reference-flow-chart"><ResponsiveContainer width="100%" height={170}><AreaChart data={monthFlow}><defs><linearGradient id="dashboardFlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.26}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Month flow"]}/><Area type="monotone" dataKey="pnl" stroke={UI_COLORS.primary} fill="url(#dashboardFlow)" strokeWidth={2.25} dot={false}/></AreaChart></ResponsiveContainer></div><div className="tj-reference-flow-trades">{recentTrades.slice(0, 3).map((trade) => <div key={trade.id}><span><strong>{trade.asset}</strong> {trade.direction} · {trade.entrySession || trade.session || "—"} · {trade.date.slice(5)}</span><b className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</b></div>)}</div></>}
      </Card>
    </div>

    <div className="tj-dashboard-analytics-grid">
      <Card className="tj-panel tj-dashboard-core-score"><div className="tj-panel-head"><div><span>Core Score</span><div className="tj-muted-txt">Consistency, recovery and payoff quality.</div></div><strong>{thisYearStats.thunderScore}</strong></div><ResponsiveContainer width="100%" height={220}><RadarChart data={radarData} outerRadius={72}><PolarGrid stroke="var(--tj-chart-grid)"/><PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 10 }}/><Radar dataKey="value" stroke={UI_COLORS.primary} fill={UI_COLORS.primary} fillOpacity={.24}/></RadarChart></ResponsiveContainer><div className="tj-core-score-metrics">{radarData.map((item) => <span key={item.metric}>{item.metric} <b>{item.metric === "PF" ? thisYearStats.profitFactor.toFixed(2) : item.metric === "Avg RR" ? thisYearStats.avgWinLoss.toFixed(2) : `${item.value.toFixed(0)}${item.metric === "Win rate" || item.metric === "Recovery" ? "%" : ""}`}</b></span>)}</div></Card>
      <Card className="tj-panel tj-dashboard-equity"><div className="tj-panel-head"><div><span>Daily Net Cumulative P&amp;L</span><div className="tj-muted-txt">Track how equity has built over time.</div></div><span className={`tj-pill ${allTimeReturn >= 0 ? "tj-pill-green" : "tj-pill-red"}`}>{allTimeReturn >= 0 ? "+" : ""}{allTimeReturn.toFixed(2)}%</span></div><ResponsiveContainer width="100%" height={280}><AreaChart data={cumulative}><defs><linearGradient id="dashboardEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.32}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`}/><Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Cumulative"]}/><Area type="monotone" dataKey="cumulative" stroke={UI_COLORS.primary} fill="url(#dashboardEquity)" strokeWidth={2.5} dot={false}/></AreaChart></ResponsiveContainer></Card>
      <Card className="tj-panel tj-dashboard-daily"><div className="tj-panel-head"><div><span>Net Daily P&amp;L</span><div className="tj-muted-txt">Green and red daily closes, day by day.</div></div><span className="tj-muted-txt">{dailyData.length} days</span></div><ResponsiveContainer width="100%" height={280}><BarChart data={dailyData}><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`}/><Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Net P&L"]}/><Bar dataKey="pnl" radius={[4, 4, 4, 4]}>{dailyData.map((day, index) => <Cell key={index} fill={day.cls === "loss" ? UI_COLORS.danger : day.cls === "be" ? UI_COLORS.info : UI_COLORS.primary}/>)}</Bar></BarChart></ResponsiveContainer></Card>
    </div>
  </div>;
}

/* ================================ TRADE LOG ============================= */

function TradeLogPage({ account, reviews = [], markups = [], onEdit, onDelete, onNewTrade }) {
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

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
  const netReturn = account.balance ? (stats.netPnl / account.balance) * 100 : 0;
  const grossReturn = account.balance ? (stats.grossPnl / account.balance) * 100 : 0;
  const totalCosts = stats.totalCommission + stats.totalSwap;
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <>
      <div className="tj-tradelog-reference-summary">
        <div><span>Showing</span><strong>{filtered.length} trades</strong><small>{assetFilter === "All" ? "All instruments" : assetFilter} · {sessionFilter === "All" ? "All sessions" : sessionFilter} · {resultFilter === "All" ? "All results" : resultFilter}</small></div>
        <div><span>Net Return</span><strong className={netReturn >= 0 ? "tj-green" : "tj-red"}>{netReturn >= 0 ? "+" : ""}{netReturn.toFixed(2)}%</strong><small>{fmtMoney(stats.netPnl)}</small></div>
        <div><span>Gross Return</span><strong className={grossReturn >= 0 ? "tj-green" : "tj-red"}>{grossReturn >= 0 ? "+" : ""}{grossReturn.toFixed(2)}%</strong><small>{fmtMoney(stats.grossPnl)}</small></div>
        <div><span>Costs</span><strong className={totalCosts > 0 ? "tj-red" : "tj-muted-txt"}>{account.balance ? `-${((totalCosts / account.balance) * 100).toFixed(2)}%` : "—"}</strong><small>{fmtMoney(-totalCosts)}</small></div>
        <div><span>Win Rate</span><strong className={wrColorClass(stats.winRate)}>{stats.winRate.toFixed(0)}%</strong><small>{stats.wins}W · {stats.losses}L · {stats.be} B/E</small></div>
        <div><span>Avg RR</span><strong>{stats.avgLoss ? stats.avgWinLoss.toFixed(2) : "—"}R</strong><small>All results</small></div>
      </div>

      <div className="tj-tradelog-compact-toolbar"><div className="tj-markup-toolbar-actions"><button className={`tj-icon-btn tj-markup-toolbar-button ${filtersOpen ? "tj-icon-btn-active" : ""}`} title="Filter trade log" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={16}/></button><button className={`tj-icon-btn tj-markup-toolbar-button ${sortOpen ? "tj-icon-btn-active" : ""}`} title="Sort trade log" onClick={() => setSortOpen((value) => !value)}><ArrowDownUp size={16}/></button></div><div className="tj-markup-toolbar-status"><span>{filtered.length} shown</span><b>All visible</b></div>{filtersOpen && <div className="tj-tradelog-filter-controls"><div className="tj-toolbar-search"><Search size={15} className="tj-toolbar-search-icon"/><input className="tj-toolbar-search-input" placeholder="Search trades..." value={search} onChange={(event) => setSearch(event.target.value)}/></div><select className="tj-toolbar-dd" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}>{assets.map((asset) => <option key={asset} value={asset}>{asset}</option>)}</select><select className="tj-toolbar-dd" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>{sessionsUsed.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="tj-toolbar-dd" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="All">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="be">Break-even</option></select></div>}{sortOpen && <div className="tj-tradelog-sort-controls"><span>Sort trades by</span><button className={`tj-toolbar-pill ${sortKey === "date" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("date")}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button><button className={`tj-toolbar-pill ${sortKey === "pnl" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("pnl")}>P&amp;L</button><button className={`tj-toolbar-pill ${sortKey === "asset" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("asset")}>Instrument</button></div>}</div>

      {filtered.length === 0 ? (
        <Card className="tj-panel"><div className="tj-empty">No trades match these filters.</div></Card>
      ) : (
        <div className="tj-tlog-list">
          {filtered.map((t) => {
            const cls = classify(t.pnl, cap);
            const isOpen = !!expanded[t.id];
            const isReviewed = reviewedTradeIds.has(t.id);
            const linkedMarkup = markups.find((markup) => markup.id === t.premarketMarkupId);
            const tradeReturn = account.balance ? (t.pnl / account.balance) * 100 : 0;
            const grossTradeReturn = account.balance ? (Number(t.grossPnl ?? t.pnl) / account.balance) * 100 : 0;
            const confluenceCount = (t.confluence || t.types || []).length;
            const screenshotCount = t.screenshots?.length || 0;
            return (
              <Card key={t.id} className={`tj-tlog-card tj-reference-tradelog-row tj-tlog-${cls}`}>
                <div className="tj-tlog-row" onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>
                  <div className="tj-tlog-main">
                    <div className="tj-tlog-asset">{t.asset || "No instrument"}</div>
                    <div className="tj-tlog-pills">
                      <span className={`tj-dirpill-sm ${t.direction === "BUY" ? "tj-green" : "tj-red"}`}>{t.direction}</span>
                      <span className="tj-sesspill">{t.entrySession || t.session || "—"}</span>
                      {(t.entryType || t.confluenceSession) && <span className="tj-sesspill">{t.entryType || t.confluenceSession}</span>}
                      <span className={`tj-review-status ${isReviewed ? "tj-review-reviewed" : "tj-review-pending"}`} title={isReviewed ? "This trade has a linked review" : "No trade review has been added yet"}>{isReviewed ? <><CheckCircle2 size={12} /> Reviewed</> : "Review Pending"}</span>
                    </div>
                  </div>
                  <div className="tj-reference-trade-meta"><span>{new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })} · {formatTime(t.time)}</span><span>{linkedMarkup ? "Linked markup" : "No linked markup"} · {confluenceCount} confluence{confluenceCount === 1 ? "" : "s"}{screenshotCount ? ` · ${screenshotCount} screenshot${screenshotCount === 1 ? "" : "s"}` : ""}</span></div>
                  <div className="tj-tlog-pnl-block">
                    <div className={cls === "be" ? "tj-blue tj-tlog-pnl" : (t.pnl >= 0 ? "tj-green tj-tlog-pnl" : "tj-red tj-tlog-pnl")}>{cls === "be" ? "B/E" : fmtMoney(t.pnl)}</div>
                    <div className="tj-reference-trade-return">{tradeReturn >= 0 ? "+" : ""}{tradeReturn.toFixed(2)}% {t.rr ? `· ${t.rr.toFixed(2)}R` : ""}</div>
                  </div>
                  <span className={`tj-statuspill tj-statuspill-${cls}`}>{cls === "win" ? "WIN" : cls === "loss" ? "LOSS" : "B/E"}</span>
                  <div className="tj-tlog-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="tj-icon-btn" title="Edit trade" onClick={() => onEdit(t)}><Pencil size={15}/></button>
                    <button className="tj-icon-btn tj-reference-delete" title="Delete trade" onClick={() => onDelete(t.id)}><Trash2 size={14}/></button>
                  </div>
                  <button className="tj-icon-btn">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                </div>
                {isOpen && (
                  <div className="tj-tlog-expand">
                    <div className="tj-reference-trade-detail-summary"><div><span>NET RETURN</span><strong className={t.pnl >= 0 ? "tj-green" : "tj-red"}>{tradeReturn >= 0 ? "+" : ""}{tradeReturn.toFixed(2)}% · {fmtMoney(t.pnl)}</strong></div><div><span>GROSS RETURN</span><strong>{account.balance ? `${grossTradeReturn >= 0 ? "+" : ""}${grossTradeReturn.toFixed(2)}%` : "—"} · {fmtMoney(Number(t.grossPnl ?? t.pnl))}</strong></div><div><span>COSTS</span><strong className="tj-red">{fmtMoney(-((Number(t.commission) || 0) + (Number(t.swap) || 0)))}</strong></div><div><span>R:R</span><strong>{t.rr ? `${t.rr.toFixed(2)}R` : "—"}</strong></div><div><span>RULES CHECKED</span><strong>{t.ruleEvaluations?.filter((entry) => entry.checked).length || 0}/{t.ruleEvaluations?.length || 0}</strong></div></div>
                    <div className="tj-tlog-detail-grid">
                      <div><div className="tj-mlabel">DATE &amp; TIME</div><div>{new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(t.time)}</div></div>
                      <div><div className="tj-mlabel">EMOTION BEFORE</div><div className="tj-purple-txt">{t.moodBefore}</div></div>
                      <div><div className="tj-mlabel">EMOTION AFTER</div><div className="tj-purple-txt">{t.moodAfter}</div></div>
                      <div><div className="tj-mlabel">ENTRY TYPE</div><div>{t.entryType || t.confluenceSession || "—"}</div></div>
                      <div><div className="tj-mlabel">ENTRY SESSION</div><div>{t.entrySession || t.session || "—"}</div></div>
                      <div><div className="tj-mlabel">RULE RATING</div><div><RatingDisplay value={t.rating} noRules={!t.ruleEvaluations?.length&&!t.rating} /> <span className="tj-muted-txt">{t.ruleEvaluations?.filter((entry)=>entry.checked).length || 0}/{t.ruleEvaluations?.length || 0}</span></div></div>
                    </div>
                    <div className="tj-reference-linked-markup"><div><span>Linked Markup</span><strong>{linkedMarkup ? `${linkedMarkup.date} · ${linkedMarkup.instrument || "Untitled markup"}` : "No linked markup"}</strong><small>{linkedMarkup ? `${linkedMarkup.market || "No session"} · ${linkedMarkup.bias || "No bias"} · ${linkedMarkup.status || "Planned"}` : "Link a trade to a saved markup from the trade form."}</small></div><span className={linkedMarkup?.status === "Executed" ? "tj-green" : "tj-muted-txt"}>{linkedMarkup?.status || "—"}</span></div>
                    <div className="tj-section-label">Journal Detail</div>
                    <div className="tj-tlog-types">{(t.confluence || t.types || []).length ? (t.confluence || t.types || []).map((item) => <span key={item} className="tj-tag tj-tag-purple tj-tag-active tj-tag-xs">{item}</span>) : <span className="tj-muted-txt">No confluences logged.</span>}</div>
                    {t.mistakes?.length > 0 && (
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
    return Object.values(map).map((m) => ({ ...m, winRate: m.count ? (m.wins / m.count) * 100 : 0, avgRR: m.count ? m.rrSum / m.count : 0 })).sort((a, b) => b.netPnl - a.netPnl);
  }, [trades, cap]);

  const confluenceStats = useMemo(() => {
    const map = {};
    trades.forEach((trade) => {
      (trade.confluence || trade.types || []).forEach((name) => {
        if (!name) return;
        if (!map[name]) map[name] = { name, count: 0, netPnl: 0, wins: 0, rrSum: 0, best: -Infinity, worst: Infinity };
        const item = map[name];
        item.count += 1; item.netPnl += trade.pnl; item.rrSum += Number(trade.rr) || 0;
        if (classify(trade.pnl, cap) === "win") item.wins += 1;
        item.best = Math.max(item.best, trade.pnl); item.worst = Math.min(item.worst, trade.pnl);
      });
    });
    return Object.values(map).map((item) => ({ ...item, winRate: item.count ? item.wins / item.count * 100 : 0, avgRR: item.count ? item.rrSum / item.count : 0, grade: getGrade(item.count ? item.wins / item.count * 100 : 0, item.netPnl, item.count) })).sort((a, b) => b.netPnl - a.netPnl);
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
  const currentEquity = account.balance + stats.netPnl;
  const highestEquity = equityData.reduce((best, point) => Math.max(best, point.equity), account.balance);
  const bestConfluence = confluenceStats[0];
  const bestEntryType = tagStats[0];
  const bestInstrument = instrumentStats[0];
  const costPct = stats.grossProfit > 0 ? ((stats.totalCommission + stats.totalSwap) / stats.grossProfit) * 100 : 0;
  const activeDates = new Set(trades.map((trade) => trade.date)).size;

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
    <div className="tj-analytics tj-analytics-workspace">
      <Card className="tj-analytics-equity-hero">
        <div className="tj-analytics-equity-head"><div><div className="tj-section-label">ALL-TIME EQUITY</div><h2>Balance has moved from {fmtMoney(account.balance)} to {fmtMoney(currentEquity)}.</h2><p>This curve stays all-time, so the read reflects the full journal rather than one month or calendar year.</p></div><div className="tj-analytics-hero-return"><strong className={equityChangePct >= 0 ? "tj-green" : "tj-red"}>{equityChangePct >= 0 ? "+" : ""}{equityChangePct.toFixed(2)}%</strong><span>{stats.total} trades tracked</span></div></div>
        <div className="tj-analytics-equity-main"><div className="tj-analytics-equity-chart"><ResponsiveContainer width="100%" height={245}><AreaChart data={equityData}><defs><linearGradient id="analyticsEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.32}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} domain={["dataMin - 100", "dataMax + 100"]}/><Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Equity"]}/><Area type="monotone" dataKey="equity" stroke={UI_COLORS.primary} fill="url(#analyticsEquity)" strokeWidth={2.5} dot={false}/></AreaChart></ResponsiveContainer><div className="tj-analytics-equity-milestones"><div><small>BASE</small><strong>{fmtMoney(account.balance)}</strong></div><div><small>LOW PRINT</small><strong>{fmtMoney(Math.min(...equityData.map((point) => point.equity)))}</strong></div><div><small>HIGH-WATER</small><strong>{fmtMoney(highestEquity)}</strong></div><div><small>NOW</small><strong>{fmtMoney(currentEquity)}</strong></div></div></div><div className="tj-analytics-equity-side"><div><small>NET P&amp;L</small><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.netPnl)}</strong><span>{equityChangePct >= 0 ? "+" : ""}{equityChangePct.toFixed(2)}% versus journal base</span></div><div><small>HIGH-WATER LIFT</small><strong className="tj-green">{fmtMoney(highestEquity - account.balance)}</strong><span>{fmtMoney(highestEquity - currentEquity)} from peak</span></div><div><small>CURVE RANGE</small><strong>{fmtMoney(highestEquity - Math.min(...equityData.map((point) => point.equity)))}</strong><span>Start through high-water</span></div><div><small>AVG LIFT / TRADE</small><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.total ? stats.netPnl / stats.total : 0)}</strong><span>{stats.total} trades tracked</span></div></div></div>
      </Card>

      <div className="tj-analytics-command-grid">
        <Card className="tj-analytics-engine"><div className="tj-panel-head"><div><span>TRADING ENGINE</span><div className="tj-muted-txt">Read the journal at engine level before drilling into trades.</div></div></div><div className="tj-engine-value"><div><span>Your journal has generated</span><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.netPnl)}</strong><div className="tj-engine-pills"><i>{equityChangePct >= 0 ? "+" : ""}{equityChangePct.toFixed(2)}% on starting equity</i><i>{fmtMoney(stats.total ? stats.netPnl / stats.total : 0)} expectancy per trade</i><i>{stats.total ? (trades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / stats.total).toFixed(2) : "0.00"} avg RR</i></div></div><div className="tj-engine-score"><small>EXECUTION QUALITY</small><strong>{stats.thunderScore}</strong><span>Based on actual results</span></div></div><div className="tj-engine-metrics"><div><small>WIN RATE</small><strong className={wrColorClass(stats.winRate)}>{stats.winRate.toFixed(0)}%</strong><span>{stats.wins} wins from {stats.total} trades</span></div><div><small>PROFIT FACTOR</small><strong>{stats.profitFactor.toFixed(2)}</strong><span>{stats.avgWinLoss.toFixed(2)} avg win/loss edge</span></div><div><small>CONSISTENCY</small><strong>{stats.consistency.toFixed(0)}</strong><span>{stats.bestWinStreak}W best run · {stats.bestLossStreak}L max loss run</span></div><div><small>RECOVERY</small><strong>{stats.recovery.toFixed(0)}%</strong><span>How often the next trade recovers a loss</span></div><div><small>LARGEST WIN</small><strong className="tj-green">{fmtMoney(Math.max(...trades.map((trade) => trade.pnl)))}</strong><span>Best closed trade</span></div><div><small>LARGEST LOSS</small><strong className="tj-red">{fmtMoney(Math.min(...trades.map((trade) => trade.pnl)))}</strong><span>Largest closed loss</span></div></div><div className="tj-engine-trade-mix"><span>TRADE MIX</span><i><em style={{ width: `${stats.total ? stats.wins / stats.total * 100 : 0}%` }}/><b style={{ width: `${stats.total ? stats.losses / stats.total * 100 : 0}%` }}/></i><small>{stats.wins}W / {stats.losses}L / {stats.be} B/E</small></div></Card>
        <Card className="tj-analytics-rhythm"><div className="tj-panel-head"><div><span>Execution Rhythm</span><div className="tj-muted-txt">Actual rhythm across {activeDates} active trading days.</div></div><span className="tj-muted-txt">{activeDates} days</span></div><div className="tj-rhythm-top"><div><small>BEST DAY</small><strong>{bestDay ? new Date(bestDay.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }) : "—"}</strong><span>{bestDay ? fmtMoney(bestDay.pnl) : "No trades"}</span></div><div><small>BEST SESSION</small><strong>{sessionStats.slice().sort((a, b) => b.netPnl - a.netPnl)[0]?.session || "—"}</strong><span>{sessionStats.length ? fmtMoney(sessionStats.slice().sort((a, b) => b.netPnl - a.netPnl)[0].netPnl) : "No session data"}</span></div><div><small>CURRENT STREAK</small><strong>{currentRunLabel}</strong><span>{last6.length} recent trading days</span></div><div><small>MONTHLY NET</small><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.netPnl)}</strong><span>All-time journal read</span></div></div><div className="tj-rhythm-bars">{tradingDays.slice(-6).map((day) => <div key={day.date}><span>{day.date.slice(5)}</span><i><em className={day.cls === "loss" ? "tj-rhythm-loss" : day.cls === "be" ? "tj-rhythm-flat" : ""} style={{ width: `${Math.max(18, Math.abs(day.pnl) / maxAbsLast6 * 100)}%` }}/></i><b className={day.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(day.pnl)}</b></div>)}</div></Card>
        <Card className="tj-analytics-coach"><div className="tj-panel-head"><span>Coach Notes</span><span className="tj-pill tj-pill-green">Live</span></div><div className="tj-coach-note tj-coach-good"><small>LEAN IN</small><strong>{bestConfluence ? `${bestConfluence.name} is the strongest added confirmation right now.` : "Build a sample of confluence data."}</strong><span>{bestConfluence ? `${fmtMoney(bestConfluence.netPnl)} across ${bestConfluence.count} trades with ${bestConfluence.winRate.toFixed(0)}% win rate.` : "Add confluences to future trades to unlock this read."}</span></div><div className="tj-coach-note tj-coach-good"><small>BEST WINDOW</small><strong>{bestInstrument ? `${bestInstrument.asset} is currently your best instrument.` : "No instrument lead yet."}</strong><span>{bestInstrument ? `${fmtMoney(bestInstrument.netPnl)} across ${bestInstrument.count} trades at ${bestInstrument.winRate.toFixed(0)}% WR.` : "Log more trades to establish a lead."}</span></div><div className="tj-coach-note tj-coach-warn"><small>TRIM FIRST</small><strong>{worstDay && worstDay.pnl < 0 ? `${new Date(worstDay.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} needs the next review pass.` : "No losing day needs attention yet."}</strong><span>{worstDay && worstDay.pnl < 0 ? `${fmtMoney(worstDay.pnl)} was the worst daily close. Review execution before increasing size.` : "Keep recording review notes as your trade sample grows."}</span></div><div className="tj-coach-risk"><small>RISK CONTEXT</small><strong>{costPct.toFixed(1)}% of gross profit is going to costs</strong><span>Gross {fmtMoney(stats.grossPnl)} · Commission &amp; swap {fmtMoney(-(stats.totalCommission + stats.totalSwap))}</span></div></Card>
      </div>

      <Card className="tj-analytics-confluence"><div className="tj-panel-head"><div><span>Confluence Performance</span><div className="tj-muted-txt">Conditions stacked around each trade, kept separate from the Entry Type.</div></div><span className="tj-muted-txt">{confluenceStats.length} confluence{confluenceStats.length === 1 ? "" : "s"}</span></div>{confluenceStats.length ? <div className="tj-confluence-cards">{confluenceStats.map((item) => <div key={item.name} className="tj-confluence-card"><div className="tj-confluence-card-head"><span>CONFLUENCE</span><b className={`tj-grade-badge ${item.grade === "D" || item.grade === "C" ? "tj-grade-bad" : ""}`}>{item.grade}</b></div><strong>{item.name}</strong><div className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</div><div className="tj-confluence-metrics"><span><small>WIN RATE</small><b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}%</b></span><span><small>TRADES</small><b>{item.count}</b></span><span><small>AVG RR</small><b>{item.avgRR.toFixed(2)}</b></span></div><div className="tj-confluence-bars"><span>IMPACT</span><i><em style={{ width: `${Math.abs(item.netPnl) / Math.max(1, Math.abs(confluenceStats[0].netPnl)) * 100}%` }}/></i><b>{fmtMoney(item.netPnl)}</b><span>QUALITY</span><i><em style={{ width: `${item.winRate}%` }}/></i><b>{item.winRate.toFixed(0)}%</b></div></div>)}</div> : <div className="tj-empty">Add Confluence to trades to unlock this comparison.</div>}</Card>

      <div className="tj-analytics-performance-grid">
        <Card className="tj-analytics-entry-types"><div className="tj-panel-head"><div><span>Entry Type Performance</span><div className="tj-muted-txt">Compare the base entry idea independently from the confluence stack.</div></div><span className="tj-muted-txt">{bestEntryType ? `${bestEntryType.tag} leads` : "No Entry Types"}</span></div><div className="tj-entry-type-highlights"><div><small>BEST MODEL</small><strong>{bestEntryType?.tag || "—"}</strong><span>{bestEntryType ? `${fmtMoney(bestEntryType.netPnl)} · ${bestEntryType.winRate.toFixed(0)}% WR` : "No trade data"}</span></div><div><small>TRIM FIRST</small><strong>{tagStats.slice().sort((a, b) => a.netPnl - b.netPnl)[0]?.tag || "—"}</strong><span>Review weaker entry quality first.</span></div><div><small>BEST PAIRING</small><strong>{bestEntryType?.tag || "—"}</strong><span>{bestEntryType ? `${bestEntryType.count} trades logged` : "No pairing yet"}</span></div></div><div className="tj-setup-tags">{tagStats.map((item) => { const wins = Math.round(item.winRate / 100 * item.count); const grade = getGrade(item.winRate, item.netPnl, item.count); return <div key={item.tag} className="tj-setup-card"><div className="tj-setup-head"><span className="tj-bold">{item.tag}</span><span className={`tj-grade-badge ${grade === "D" || grade === "C" ? "tj-grade-bad" : ""}`}>{grade}</span></div><div className="tj-setup-grid"><div><div className="tj-mlabel">NET P&amp;L</div><div className={`tj-bold ${item.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(item.netPnl)}</div></div><div><div className="tj-mlabel">WIN RATE</div><div className={`tj-bold ${wrColorClass(item.winRate)}`}>{item.winRate.toFixed(0)}%</div></div><div><div className="tj-mlabel">TRADES</div><div className="tj-bold">{item.count} <span className="tj-muted-txt" style={{ fontSize: 10 }}>({wins}W/{item.count - wins}L)</span></div></div><div><div className="tj-mlabel">AVG RR</div><div className="tj-bold tj-purple-txt">{item.avgRR.toFixed(2)}</div></div></div><div className="tj-setup-bw"><div className="tj-setup-bw-box tj-setup-bw-best"><div className="tj-mlabel">Best</div><div className="tj-green tj-bold">{fmtMoneyShort(item.best)}</div></div><div className="tj-setup-bw-box tj-setup-bw-worst"><div className="tj-mlabel">Worst</div><div className="tj-red tj-bold">{fmtMoneyShort(item.worst)}</div></div></div><div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(item.winRate)}`} style={{ width: `${item.winRate}%` }} /></div></div>; })}</div></Card>
        <Card className="tj-analytics-days"><div className="tj-panel-head"><div><span>Day Distribution</span><div className="tj-muted-txt">How green, red, and flat days are distributed.</div></div><span className="tj-muted-txt">{dayLabel}</span></div><div className="tj-day-score-row"><div className="tj-day-score-circle" style={{ borderColor: dayColor }}><div className="tj-day-score-num" style={{ color: dayColor }}>{dayScore}</div><div className="tj-day-score-max">/100</div></div><div><div className="tj-day-score-label" style={{ color: dayColor }}>{dayLabel}</div><div className="tj-muted-txt">{tradingDays.length} trading days · avg {fmtMoney(avgPerDay)}/day</div><div className="tj-day-legend"><span><i className="tj-dot-green" /> {greenDays} green</span><span><i className="tj-dot-red" /> {redDays} red</span><span><i className="tj-dot-blue" /> {flatDays} flat</span></div></div></div><div className="tj-mlabel" style={{ marginTop: 14 }}>DAY DISTRIBUTION</div><div className="tj-day-dist">{greenDays > 0 && <div style={{ width: `${greenDays / tradingDays.length * 100}%`, background: UI_COLORS.primary }} />}{flatDays > 0 && <div style={{ width: `${flatDays / tradingDays.length * 100}%`, background: UI_COLORS.info }} />}{redDays > 0 && <div style={{ width: `${redDays / tradingDays.length * 100}%`, background: UI_COLORS.danger }} />}</div><div className="tj-day-quad-stats"><div><div className="tj-mlabel">CURRENT</div><div className="tj-bold">{currentRunLabel}</div></div><div><div className="tj-mlabel">BEST RUN</div><div className="tj-bold">{bestRun}d</div></div><div><div className="tj-mlabel">WORST RUN</div><div className="tj-bold">{worstRun}d</div></div><div><div className="tj-mlabel">AVG/DAY</div><div className="tj-bold">{fmtMoney(avgPerDay)}</div></div></div><div className="tj-day-bestworst"><div className="tj-day-bw-box tj-day-bw-best"><div className="tj-mlabel">BEST DAY</div><div className="tj-green tj-bold" style={{ fontSize: 18 }}>{fmtMoney(bestDay.pnl)}</div><div className="tj-muted-txt">{new Date(bestDay.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div></div><div className="tj-day-bw-box tj-day-bw-worst"><div className="tj-mlabel">WORST DAY</div><div className="tj-red tj-bold" style={{ fontSize: 18 }}>{fmtMoney(worstDay.pnl)}</div><div className="tj-muted-txt">{new Date(worstDay.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div></div></div><div className="tj-mlabel" style={{ marginTop: 14 }}>LAST {last6.length} TRADING DAYS</div><div className="tj-last6-track">{last6.map((day) => <div key={day.date} className="tj-last6-bar" style={{ background: day.cls === "loss" ? UI_COLORS.danger : day.cls === "be" ? UI_COLORS.info : UI_COLORS.primary, flex: Math.max(.3, Math.abs(day.pnl) / maxAbsLast6) }} title={`${day.date}: ${fmtMoney(day.pnl)}`} />)}</div><div className="tj-last6-dates">{last6.map((day) => <span key={day.date}>{day.date.slice(5)}</span>)}</div></Card>
      </div>

      <Card className="tj-panel tj-analytics-scatter">
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

      <div className="tj-analytics-lower-grid">
      <Card className="tj-panel tj-analytics-instruments"><div className="tj-panel-head"><span>🏆 Instrument Performance</span><span className="tj-muted-txt">{instrumentStats.length} instruments</span></div>
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
      <Card className="tj-panel tj-analytics-lab">
        <div className="tj-panel-head">
          <span>🧪 Entry + Confluence Lab</span>
          <div className="tj-tabs"><button className={`tj-tab ${comboMode === "AND" ? "tj-tab-active" : ""}`} onClick={() => setComboMode("AND")}>AND</button><button className={`tj-tab ${comboMode === "OR" ? "tj-tab-active" : ""}`} onClick={() => setComboMode("OR")}>OR</button></div>
        </div>
        <div className="tj-mlabel">ENTRY TYPES</div>
        <div className="tj-chip-row" style={{ marginBottom: 10 }}>
          {allTypeTags.map((t) => <button key={t} className={`tj-chip ${comboTypes.includes(t) ? "tj-chip-active" : ""}`} onClick={() => toggleCombo(comboTypes, setComboTypes, t)}>{t}</button>)}
        </div>
        <div className="tj-mlabel">SESSIONS &amp; INSTRUMENTS</div><div className="tj-chip-row">{otherChips.map((t) => <button key={t} className={`tj-chip ${comboOther.includes(t) ? "tj-chip-active" : ""}`} onClick={() => toggleCombo(comboOther, setComboOther, t)}>{t}</button>)}</div>
        {comboSelected.length > 0 && (
          <div className="tj-combo-result">{comboMatches.length} trades matched · <span className={comboPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(comboPnl)}</span></div>
        )}
      </Card>
      </div>
      <Card className="tj-panel tj-analytics-sessions"><div className="tj-panel-head"><span>Session Performance</span><span className="tj-muted-txt">Performance by Entry Session</span></div><div className="tj-session-grid">{sessionStats.map((session) => <div key={session.session} className="tj-session-card"><div className="tj-session-top"><span className="tj-sesspill-lg">{session.session}</span><span className="tj-muted-txt">{session.count} trades</span></div><ResponsiveContainer width="100%" height={100}><RadarChart data={session.radar} outerRadius={38}><PolarGrid stroke="var(--tj-chart-grid)"/><PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 8 }}/><Radar dataKey="value" stroke={UI_COLORS.primary} fill={UI_COLORS.primary} fillOpacity={.38}/></RadarChart></ResponsiveContainer><div className={`tj-session-pnl ${session.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(session.netPnl)}</div><div className="tj-session-wl"><span className="tj-green">✓{session.wins}W</span><span className="tj-red">✗{session.losses}L</span></div><div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(session.winRate)}`} style={{ width: `${session.winRate}%` }}/></div></div>)}</div></Card>
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
        <div className="tj-reference-calendar-layout tj-standalone-calendar-layout">
          <div>
            <Card className="tj-panel tj-reference-calendar tj-standalone-calendar">
              <div className="tj-reference-month-head">
                <div className="tj-month-nav">
                  <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
                  <strong>{MONTH_NAMES[month]} {year}</strong>
                  <button className="tj-icon-btn" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
                </div>
                <div className="tj-reference-month-total"><span>{monthProfit}W</span><span>{monthLoss}L</span><span>{monthBE} B/E</span><span>{monthTrades.length} trades</span></div>
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

          <Card className="tj-panel tj-reference-weeks">
            <div className="tj-panel-head"><span>Weekly Snapshot</span></div>
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
  const [newTradeDraft, setNewTradeDraft] = useState(null);
  const [editingMarkup, setEditingMarkup] = useState(null);
  const [imageViewerSrc, setImageViewerSrc] = useState(null);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [typeTags, setTypeTags] = useState(DEFAULT_TYPE_TAGS);
  const [mistakeTags, setMistakeTags] = useState(DEFAULT_MISTAKE_TAGS);
  const [confluenceSessions, setConfluenceSessions] = useState([]);
  const [customInstruments, setCustomInstruments] = useState([]);
  const [markups, setMarkups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [periodReviews, setPeriodReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth > 900));
  const [toast, setToast] = useState(null); // { type: 'error'|'info', text }
  const [migration, setMigration] = useState({ checked: false, pending: null, busy: false });

  const showError = useCallback((text) => {
    setToast({ type: "error", text });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 6000);
  }, []);
  const showInfo = useCallback((text) => {
    setToast({ type: "info", text });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 4500);
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
    setPeriodReviews(result.data.periodReviews || []);
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
        const res = await createAccount(user.id, { name: "Main Account", icon: "🦈", balance: 10000, breakevenCap: 0, ratingStyle: "stars", theme: "dark", defaultCommission: 0, monthlyGoalPct: 0, yearlyGoalPct: 0, dailyLossLimitPct: 0, monthlyLossLimitPct: 0 });
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
  const guardrails = useMemo(() => (account ? accountGuardrails(account, account.trades) : null), [account]);

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

  const markMarkupExecuted = async (markupId) => {
    if (!markupId) return;
    const markup = markups.find((item) => item.id === markupId && item.accountId === account.id);
    if (!markup || markup.status === "Executed") return;
    const result = await updateMarkup(markup.id, { ...markup, status: "Executed" });
    if (result.error) { showError(result.error); return; }
    setMarkups((items) => items.map((item) => item.id === markup.id ? result.data : item));
  };

  const saveTrade = async (trade) => {
    const exists = account.trades.some((t) => t.id === trade.id);
    if (!exists && guardrails.tradeEntryLocked) {
      showInfo("Trade entry is paused by your account loss cap. Markups remain available.");
      return;
    }
    if (exists) {
      const res = await updateTrade(trade.id, { ...trade, userId: user.id, accountId: account.id });
      if (res.error) { showError(res.error); return; }
      setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: a.trades.map((t) => (t.id === trade.id ? trade : t)) })));
    } else {
      const res = await createTrade(user.id, account.id, trade);
      if (res.error) { showError(res.error); return; }
      setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: [...a.trades, res.data] })));
    }
    await markMarkupExecuted(trade.premarketMarkupId);
    await persistCustomInstrument(trade.asset);
    setModal(null); setEditingTrade(null); setNewTradeDraft(null);
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
    const res = await saveManagedLists(user.id, kind === "types" ? {typeTags:next} : kind === "mistakes" ? {mistakeTags:next} : kind === "instruments" ? {instruments:next} : {confluenceSessions:next});
    if (res.error) return showError(res.error);
    if (kind === "types") setTypeTags(next); else if (kind === "mistakes") setMistakeTags(next); else if (kind === "instruments") setCustomInstruments(next); else setConfluenceSessions(next);
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
  const handleSaveReview = async (r) => { const res=await saveTradeReview(user.id,account.id,r); if(res.error){showError(res.error);return false;}setReviews(x=>{const i=x.findIndex(v=>v.id===res.data.id);return i<0?[res.data,...x]:x.map(v=>v.id===res.data.id?res.data:v);}); return true; };
  const handleSavePeriodReview = async (review) => { const res = await savePeriodReview(user.id, account.id, review); if (res.error) { showError(res.error); return false; } setPeriodReviews((items) => { const index = items.findIndex((item) => item.id === res.data.id || (item.accountId === account.id && item.type === res.data.type && item.key === res.data.key)); return index < 0 ? [res.data, ...items] : items.map((item, itemIndex) => itemIndex === index ? res.data : item); }); return true; };

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
  const openNewTrade = (draft = null) => {
    if (guardrails.tradeEntryLocked) return showInfo("Trade entry is paused by your account loss cap. Adjust the guardrail or wait for its reset period.");
    setEditingTrade(null); setNewTradeDraft(draft); setModal("newtrade");
  };
  const openDayDetails = (date) => {
    if (guardrails.tradeEntryLocked) return showInfo("Calendar trade details are paused while the loss cap is active. Premarket markups remain available.");
    setDayModalDate(date);
  };

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
                <div className="tj-avatar">{account.profileImage ? <img src={account.profileImage} alt="" /> : account.icon}</div>
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
                    <span className="tj-avatar-sm">{a.profileImage ? <img src={a.profileImage} alt="" /> : a.icon}</span><span className="tj-account-row-name">{a.name}{a.id === activeId && <span className="tj-active-tag">• Active</span>}</span>
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
            <div className="tj-avatar">{account.profileImage ? <img src={account.profileImage} alt="" /> : account.icon}</div>
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
          {page === "dashboard" ? <button className="tj-btn-primary" onClick={() => { setEditingMarkup(null); setModal("markup"); }}><Plus size={16} /> Start Day</button> : <button className={`tj-btn-primary ${guardrails.tradeEntryLocked ? "tj-btn-disabled" : ""}`} disabled={guardrails.tradeEntryLocked} title={guardrails.tradeEntryLocked ? "Trade entry is paused by your account loss cap" : "Log a new trade"} onClick={() => openNewTrade()}><Plus size={16} /> {guardrails.tradeEntryLocked ? "Trade Locked" : "Log Trade"}</button>}
        </div>
        <div className="tj-content">
          {page === "dashboard" && <ReferenceDashboardPage account={account} stats={stats} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={openDayDetails} guardrails={guardrails} />}
          {page === "tradelog" && <TradeLogPage account={account} reviews={reviews.filter((review) => review.accountId === account.id)} markups={markups.filter((markup) => markup.accountId === account.id)} onNewTrade={() => openNewTrade()} onEdit={(t) => { setNewTradeDraft(null); setEditingTrade(t); setModal("newtrade"); }} onDelete={handleDeleteTrade} />}
          {page === "analytics" && <AnalyticsPage account={account} />}
          {page === "calendar" && <CalendarPage account={account} markups={markups.filter((markup)=>markup.accountId===account.id)} reviews={reviews.filter((review)=>review.accountId===account.id)} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={openDayDetails} />}
          {page === "psychology" && <PsychologyPage account={account} />}
          {page === "insights" && <InsightsPage account={account} />}
          {page === "news" && <NewsPage />}
          {page === "rules" && <RulesPage account={account} onToggleCheckin={handleToggleCheckin} onAddRule={handleAddRule} onUpdateRule={handleUpdateRule} onRemoveRule={handleRemoveRule} />}
          {page === "management" && <ManagementPage typeTags={typeTags} mistakeTags={mistakeTags} confluenceSessions={confluenceSessions} instruments={customInstruments} onTypeTags={(x)=>saveList("types",x)} onMistakes={(x)=>saveList("mistakes",x)} onConfluence={(x)=>saveList("confluence",x)} onInstruments={(x)=>saveList("instruments",x)} />}
          {page === "markups" && <ReferenceMarkupsPage markups={markups.filter((markup)=>markup.accountId===account.id)} trades={account.trades} onNew={()=>{setEditingMarkup(null);setModal("markup");}} onEdit={(markup)=>{setEditingMarkup(markup);setModal("markup");}} onDelete={handleDeleteMarkup} onTrade={(markup)=>openNewTrade({ premarketMarkupId: markup.id, asset: markup.instrument || "", entrySession: markup.market || SESSIONS[2], session: markup.market || SESSIONS[2] })} />}
          {page === "reviews" && <ReviewLibraryPage account={account} reviews={reviews.filter(r=>r.accountId===account.id)} trades={account.trades} periodReviews={periodReviews.filter(r=>r.accountId===account.id)} onSavePeriod={handleSavePeriodReview} onSaveTrade={handleSaveReview} />}
        </div>
      </div>
      {modal === "newtrade" && <NewTradeModal editing={editingTrade} draft={newTradeDraft} typeTags={typeTags} mistakeTags={mistakeTags} confluenceSessions={confluenceSessions} instruments={knownInstruments} markups={markups.filter((markup)=>markup.accountId===account.id)} rules={account.rules} defaultCommission={account.defaultCommission} onClose={() => { setModal(null); setEditingTrade(null); setNewTradeDraft(null); }} onSave={saveTrade} />}
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
          onEdit={(t) => { setDayModalDate(null); setNewTradeDraft(null); setEditingTrade(t); setModal("newtrade"); }}
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
.tj-management-workspace { display: grid; gap: 14px; }.tj-management-workspace .tj-page-intro { margin: 0; padding: 1px 0 14px; }.tj-management-rules-note { padding: 4px 8px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 10px; font-weight: 700; white-space: nowrap; }
.tj-management-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tj-management-grid > .tj-panel { min-height: 330px; position: relative; overflow: hidden; }
.tj-management-grid > .tj-panel::before { content: ""; display: block; width: 30px; height: 3px; border-radius: 99px; background: var(--tj-green); margin-bottom: 12px; }
.tj-management-grid .tj-inline-add { margin-top: 0; }.tj-management-grid .tj-inline-add .tj-btn-primary { padding-inline: 11px; }.tj-management-grid .tj-rule-list, .tj-management-list { display: grid; gap: 7px; max-height: 430px; margin-top: 12px; overflow: auto; padding-right: 2px; }.tj-management-grid .tj-rule-row { min-height: 37px; padding: 8px 9px; font-size: 12px; }.tj-management-grid .tj-rule-row > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.tj-management-row-actions { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }.tj-management-default { padding: 3px 6px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 8px; font-style: normal; font-weight: 800; letter-spacing: .35px; }
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
.tj-markup-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 7px; border: 1px solid var(--tj-border); font-size: 9px; font-weight: 800; letter-spacing: .35px; text-transform: uppercase; vertical-align: 1px; }.tj-markup-status-planned { color: var(--tj-blue); background: color-mix(in srgb, var(--tj-blue) 12%, transparent); border-color: color-mix(in srgb, var(--tj-blue) 42%, var(--tj-border)); }.tj-markup-status-watching { color: var(--tj-amber); background: color-mix(in srgb, var(--tj-amber) 12%, transparent); border-color: color-mix(in srgb, var(--tj-amber) 42%, var(--tj-border)); }.tj-markup-status-executed { color: var(--tj-green); background: var(--tj-primary-muted); border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); }.tj-markup-status-passed { color: var(--tj-muted); background: var(--tj-panel-alt); }
.tj-reference-markups { display: grid; gap: 14px; }.tj-markup-overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }.tj-markup-overview-card { min-height: 136px; padding: 14px; display: grid; align-content: start; gap: 5px; }.tj-markup-overview-card strong { font-size: 22px; font-variant-numeric: tabular-nums; }.tj-markup-overview-card span { color: var(--tj-muted); font-size: 11px; line-height: 1.35; }.tj-markup-overview-card > small { color: var(--tj-muted); font-size: 9px; font-weight: 700; letter-spacing: .45px; text-transform: uppercase; }.tj-markup-progress, .tj-markup-split { height: 6px; overflow: hidden; display: flex; border-radius: 99px; background: var(--tj-panel-alt); margin-top: 4px; }.tj-markup-progress i, .tj-markup-split i, .tj-markup-split b { display: block; height: 100%; transition: width .2s ease; }.tj-markup-progress i, .tj-markup-split i { background: var(--tj-green); }.tj-markup-split b { background: var(--tj-red); opacity: .82; }.tj-markup-bestworst { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 2px; }.tj-markup-bestworst > div { min-width: 0; padding: 7px 8px; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); border-radius: 7px; display: grid; gap: 2px; }.tj-markup-bestworst small { color: var(--tj-muted); font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }.tj-markup-bestworst b { font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }.tj-markup-coverage { display: grid; gap: 5px; margin-top: 3px; }.tj-markup-coverage > div { display: grid; grid-template-columns: 30px minmax(0, 1fr) 27px; gap: 6px; align-items: center; }.tj-markup-coverage small, .tj-markup-coverage em { color: var(--tj-muted); font-size: 9px; font-weight: 700; font-style: normal; text-transform: uppercase; }.tj-markup-coverage em { text-align: right; font-variant-numeric: tabular-nums; }.tj-markup-coverage i { display: block; height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-markup-coverage b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-markup-coverage > div:nth-child(2) b { opacity: .78; }.tj-markup-coverage > div:nth-child(3) b { opacity: .58; }.tj-markup-toolbar { display: grid; grid-template-columns: 1fr auto; gap: 9px; align-items: center; min-height: 32px; }.tj-markup-toolbar-actions { display: flex; gap: 8px; }.tj-markup-toolbar-button { width: 32px; height: 32px; border-radius: 50%; }.tj-icon-btn-active { color: var(--tj-green); border-color: color-mix(in srgb, var(--tj-green) 55%, var(--tj-border)); background: var(--tj-primary-muted); }.tj-markup-toolbar-status { display: flex; gap: 10px; align-items: center; color: var(--tj-muted); font-size: 10px; }.tj-markup-toolbar-status b { color: var(--tj-green); font-size: 10px; }.tj-markup-filter-controls, .tj-markup-sort-controls { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: color-mix(in srgb, var(--tj-panel-alt) 84%, transparent); }.tj-markup-filter-controls .tj-toolbar-search { flex: 1; }.tj-markup-sort-controls { justify-content: flex-start; }.tj-markup-sort-controls > span { color: var(--tj-muted); font-size: 11px; }.tj-reference-markup-card .tj-tlog-row { min-height: 62px; cursor: pointer; }.tj-reference-markup-card .tj-tlog-main { min-width: 270px; }.tj-markup-pnl { display: grid; gap: 2px; min-width: 105px; text-align: right; }.tj-markup-pnl strong { font-variant-numeric: tabular-nums; }.tj-markup-pnl span { color: var(--tj-muted); font-size: 10px; }.tj-markup-detail-top { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-bottom: 16px; }.tj-markup-detail-top > div { padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); display: grid; gap: 4px; }.tj-linked-markup-trades { display: grid; gap: 7px; }.tj-linked-markup-trade { display: flex; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-linked-markup-trade > div { display: grid; gap: 3px; }.tj-linked-markup-trade span { font-size: 11px; color: var(--tj-muted); }.tj-linked-markup-trade > div:last-child { text-align: right; justify-items: end; }

/* Account control center */
.tj-settings-summary { display: grid; gap: 5px; padding: 12px 14px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-primary-muted); color: var(--tj-muted); font-size: 12px; line-height: 1.45; margin-bottom: 12px; }
.tj-settings-summary-kicker { color: var(--tj-green); font-weight: 800; font-size: 10px; letter-spacing: .9px; }
.tj-settings-account-hero { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 13px; padding: 16px; margin-bottom: 12px; border: 1px solid color-mix(in srgb, var(--tj-green) 36%, var(--tj-border)); border-radius: 13px; background: linear-gradient(135deg, color-mix(in srgb, var(--tj-green) 12%, var(--tj-panel-alt)), var(--tj-panel-alt)); }
.tj-settings-hero-avatar { grid-row: span 2; width: 74px; height: 74px; overflow: hidden; border: 1px solid var(--tj-border); border-radius: 15px; background: var(--tj-panel); color: var(--tj-text); font-size: 28px; cursor: pointer; }.tj-settings-hero-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }.tj-settings-hero-copy { display: grid; align-content: center; gap: 5px; }.tj-settings-hero-copy > span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: 1.1px; }.tj-settings-hero-copy strong { font-size: 23px; letter-spacing: -.4px; }.tj-settings-hero-copy p { max-width: 560px; margin: 0; color: var(--tj-muted); font-size: 11px; line-height: 1.42; }
.tj-settings-hero-metrics { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }.tj-settings-hero-metrics > div { display: grid; gap: 3px; min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: color-mix(in srgb, var(--tj-panel) 87%, transparent); }.tj-settings-hero-metrics small { color: var(--tj-muted); font-size: 8px; font-weight: 800; letter-spacing: .55px; }.tj-settings-hero-metrics b { overflow: hidden; font-size: 15px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-settings-hero-metrics span { color: var(--tj-muted); font-size: 9px; line-height: 1.25; }.tj-settings-hero-metrics .tj-settings-goal-on { border-color: color-mix(in srgb, var(--tj-green) 46%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-goal-on b { color: var(--tj-green); }.tj-settings-hero-metrics .tj-settings-risk-on { border-color: color-mix(in srgb, var(--tj-red) 42%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-risk-on b { color: var(--tj-red); }
.tj-settings-section { border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); margin: 10px 0; overflow: hidden; }
.tj-settings-section-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: none; background: none; color: var(--tj-text); padding: 13px 14px; text-align: left; cursor: pointer; font: inherit; }.tj-settings-section-head:hover { background: color-mix(in srgb, var(--tj-panel) 42%, transparent); }
.tj-settings-section-head > span:first-child { display: grid; gap: 3px; }.tj-settings-section-head small { color: var(--tj-muted); font-size: 11px; font-weight: 400; }.tj-settings-section-head svg { transition: transform .16s ease; color: var(--tj-muted); }.tj-settings-section-end { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; }.tj-settings-section-end em { max-width: 140px; overflow: hidden; padding: 3px 8px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 9px; font-style: normal; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.tj-settings-section-body { border-top: 1px solid var(--tj-border); padding: 14px; }.tj-settings-section-body .tj-field:last-child { margin-bottom: 0; }.tj-settings-hint { font-size: 11px; line-height: 1.4; margin-top: 5px; }.tj-settings-off-note { margin-top: 4px; color: var(--tj-muted); font-size: 11px; line-height: 1.4; }
.tj-settings-section-danger { border-color: color-mix(in srgb, var(--tj-red) 46%, var(--tj-border)); }.tj-settings-section-danger .tj-settings-section-head strong { color: var(--tj-red); }.tj-settings-danger-copy { display: grid; gap: 5px; padding: 2px; }.tj-settings-danger-copy span { color: var(--tj-muted); font-size: 11px; line-height: 1.42; }
.tj-profile-row { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--tj-border); }.tj-profile-preview { width: 58px; height: 58px; padding: 0; flex: 0 0 58px; overflow: hidden; border: 1px solid var(--tj-border); border-radius: 50%; background: var(--tj-panel); color: var(--tj-text); font-size: 23px; cursor: pointer; }.tj-profile-preview img { width: 100%; height: 100%; display: block; object-fit: cover; }.tj-profile-actions { display: grid; gap: 8px; }.tj-btn-small { font-size: 11px; min-height: 28px; padding: 5px 9px; }
.tj-theme-choice { min-height: 62px; display: grid; align-content: center; gap: 3px; text-align: left; }.tj-theme-choice span { font-size: 13px; }.tj-theme-choice small { color: var(--tj-muted); font-size: 10px; font-weight: 500; }.tj-theme-choice.tj-chip-active small { color: color-mix(in srgb, var(--tj-green) 76%, var(--tj-muted)); }
.tj-avatar { overflow: hidden; }.tj-avatar img, .tj-avatar-sm img { width: 100%; height: 100%; object-fit: cover; display: block; }.tj-avatar-sm { overflow: hidden; }
.tj-btn-disabled { opacity: .58; cursor: not-allowed; filter: saturate(.35); }

/* Dashboard inspired by the referenced workflow, with AAICOREFX data. */
.tj-reference-dashboard { display: grid; gap: 14px; }.tj-guardrails { padding: 16px; }.tj-guardrails-note { font-size: 11px; line-height: 1.35; font-weight: 400; margin-top: 3px; max-width: 720px; }.tj-guardrail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }.tj-guardrail-metric { border: 1px solid var(--tj-border); background: var(--tj-panel-alt); border-radius: 9px; padding: 11px; min-width: 0; }.tj-guardrail-hit { border-color: var(--tj-red); background: color-mix(in srgb, var(--tj-red) 9%, var(--tj-panel-alt)); }.tj-guardrail-value { margin: 5px 0 8px; font-weight: 800; font-variant-numeric: tabular-nums; }.tj-guardrail-value .tj-muted-txt { font-size: 11px; font-weight: 500; white-space: nowrap; }
.tj-reference-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; padding: 1px; overflow: hidden; border: 1px solid var(--tj-border); border-radius: 14px; background: var(--tj-border); }.tj-reference-kpi { min-height: 124px; padding: 13px 14px; border: 0; border-radius: 0; box-shadow: none; background: color-mix(in srgb, var(--tj-panel) 94%, var(--tj-panel-alt)); display: grid; align-content: start; gap: 5px; }.tj-reference-kpi-value { font-size: 21px; font-weight: 800; margin: 1px 0 0; font-variant-numeric: tabular-nums; letter-spacing: -.35px; }.tj-kpi-top, .tj-reference-month-head, .tj-reference-flow-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.tj-kpi-top > span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .35px; text-transform: uppercase; }.tj-kpi-top > span.tj-green, .tj-kpi-top > span.tj-red { color: inherit; }.tj-reference-kpi .tj-stat-sub { min-height: 14px; overflow: hidden; color: var(--tj-muted); font-size: 10px; line-height: 1.35; }.tj-reference-kpi small { display: flex; justify-content: space-between; gap: 6px; color: var(--tj-muted); font-size: 9px; font-weight: 700; letter-spacing: .2px; }.tj-reference-kpi small em { font-style: normal; }.tj-kpi-spark { height: 26px; margin-top: -1px; }.tj-kpi-line, .tj-kpi-split { display: flex; height: 5px; overflow: hidden; margin-top: 3px; border-radius: 99px; background: var(--tj-panel-alt); }.tj-kpi-line i, .tj-kpi-split i, .tj-kpi-split b { display: block; height: 100%; }.tj-kpi-line i, .tj-kpi-split i { background: var(--tj-green); }.tj-kpi-split b { background: var(--tj-red); opacity: .8; }.tj-day-bar-strip { height: 14px; display: flex; align-items: center; gap: 3px; overflow: hidden; margin: 1px 0; }.tj-day-bar-strip i { display: block; flex: 1; min-width: 7px; height: 5px; border-radius: 99px; }.tj-day-bar-win { background: var(--tj-green); }.tj-day-bar-loss { background: var(--tj-red); }.tj-day-bar-be { background: var(--tj-blue); }.tj-day-bar-strip span { color: var(--tj-muted); font-size: 10px; }
.tj-reference-hero-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(350px, 1fr); gap: 14px; }.tj-reference-calendar-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(250px, .75fr); gap: 14px; }.tj-reference-calendar, .tj-reference-weeks, .tj-reference-flow { padding: 16px; }.tj-reference-month-head { align-items: center; min-height: 30px; margin-bottom: 13px; }.tj-reference-month-head .tj-month-nav { display: flex; align-items: center; gap: 8px; }.tj-reference-month-head .tj-month-nav strong { white-space: nowrap; font-size: 17px; }.tj-reference-month-total { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; color: var(--tj-muted); font-size: 9px; font-weight: 800; }.tj-reference-month-total strong { font-size: 16px; margin-right: 3px; }.tj-reference-month-total span { padding: 3px 7px; border-radius: 99px; background: var(--tj-panel-alt); }.tj-reference-calendar-body { display: grid; grid-template-columns: minmax(0, 1fr) 126px; gap: 13px; }.tj-reference-calendar .tj-month-summary { margin-bottom: 14px; }.tj-reference-calendar .tj-cal-cell { min-height: 72px; padding: 8px; border-radius: 14px; background: color-mix(in srgb, var(--tj-panel-alt) 82%, transparent); }.tj-reference-calendar .tj-cal-cell.tj-cal-win { border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 11%, var(--tj-panel-alt)); }.tj-reference-calendar .tj-cal-cell.tj-cal-loss { border-color: color-mix(in srgb, var(--tj-red) 42%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, var(--tj-panel-alt)); }.tj-reference-calendar .tj-cal-tcount { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; min-height: 17px; padding: 0 4px; margin-top: 5px; border: 1px solid var(--tj-border); border-radius: 99px; color: var(--tj-muted); font-size: 9px; line-height: 1; }.tj-reference-week-rail { display: grid; grid-auto-rows: 1fr; gap: 8px; }.tj-reference-week { padding: 9px; min-height: 57px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); display: grid; align-content: center; gap: 5px; }.tj-reference-week-active { background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); border-color: color-mix(in srgb, var(--tj-green) 28%, var(--tj-border)); }.tj-reference-week > div { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }.tj-reference-week span, .tj-reference-week small { color: var(--tj-muted); font-size: 9px; font-weight: 700; letter-spacing: .45px; }.tj-reference-week strong { font-size: 14px; font-variant-numeric: tabular-nums; }.tj-reference-week i { display: block; overflow: hidden; height: 4px; border-radius: 99px; background: var(--tj-border); }.tj-reference-week b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-reference-weeks .tj-weekly-list { max-height: 385px; overflow: auto; padding-right: 2px; }.tj-standalone-calendar .tj-month-summary { margin-top: 4px; }
.tj-reference-flow { display: grid; align-content: start; gap: 12px; min-height: 472px; }.tj-reference-flow-head { align-items: start; border-bottom: 1px solid var(--tj-border); padding-bottom: 10px; }.tj-reference-flow-head > div:first-child { display: grid; gap: 4px; }.tj-reference-flow-head > div:first-child > strong { font-size: 16px; }.tj-reference-flow-head > div:first-child > span { color: var(--tj-muted); font-size: 11px; line-height: 1.35; }.tj-reference-flow .tj-tabs { flex-shrink: 0; }.tj-reference-flow .tj-tab { font-size: 10px; padding: 5px 7px; }.tj-reference-flow-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.tj-reference-flow-metrics > div { min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); display: grid; gap: 3px; }.tj-reference-flow-metrics span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .55px; }.tj-reference-flow-metrics strong { overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-metrics small { overflow: hidden; color: var(--tj-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-chart { min-height: 170px; }.tj-reference-flow-trades { display: grid; gap: 7px; }.tj-reference-flow-trades > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); font-size: 11px; }.tj-reference-flow-trades span { overflow: hidden; color: var(--tj-muted); text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-trades span strong { color: var(--tj-text); margin-right: 4px; }.tj-reference-flow-trades b { flex-shrink: 0; font-variant-numeric: tabular-nums; }.tj-recent-table { display: grid; gap: 2px; }.tj-recent-head, .tj-recent-row { display: grid; grid-template-columns: 1.35fr 1fr .65fr .85fr .8fr; align-items: center; gap: 12px; }.tj-recent-head { color: var(--tj-muted); font-size: 10px; letter-spacing: .55px; font-weight: 700; text-transform: uppercase; padding: 0 11px 8px; }.tj-recent-row { min-height: 44px; padding: 8px 11px; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); border-radius: 8px; font-size: 12px; }.tj-recent-row strong:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.tj-dashboard-analytics-grid { display: grid; grid-template-columns: minmax(250px, .9fr) minmax(380px, 1.35fr) minmax(290px, 1fr); gap: 14px; }.tj-dashboard-analytics-grid > .tj-panel { min-height: 385px; padding: 16px; }.tj-dashboard-core-score .tj-panel-head > strong { display: grid; place-items: center; min-width: 48px; min-height: 48px; border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 14%, var(--tj-panel-alt)); color: var(--tj-green); font-size: 20px; }.tj-core-score-metrics { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px 11px; color: var(--tj-muted); font-size: 9px; }.tj-core-score-metrics b { color: var(--tj-text); margin-left: 3px; }.tj-dashboard-analytics-grid .tj-panel-head .tj-muted-txt { margin-top: 3px; font-size: 11px; }

/* Dense Trade Log layout follows the same reference hierarchy while retaining
   AAICOREFX review status, automatic rating and linked-markup data. */
.tj-tradelog-reference-summary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-bottom: 14px; padding: 1px; border: 1px solid var(--tj-border); border-radius: 14px; background: var(--tj-border); }.tj-tradelog-reference-summary > div { min-width: 0; padding: 12px 14px; background: var(--tj-panel); display: grid; gap: 3px; }.tj-tradelog-reference-summary span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }.tj-tradelog-reference-summary strong { overflow: hidden; font-size: 16px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-tradelog-reference-summary small { overflow: hidden; color: var(--tj-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.tj-tradelog-compact-toolbar { display: grid; grid-template-columns: 1fr auto; gap: 9px; align-items: center; min-height: 32px; margin-bottom: 14px; }.tj-tradelog-filter-controls, .tj-tradelog-sort-controls { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: color-mix(in srgb, var(--tj-panel-alt) 84%, transparent); }.tj-tradelog-filter-controls .tj-toolbar-search { flex: 1; }.tj-tradelog-sort-controls > span { color: var(--tj-muted); font-size: 11px; }.tj-reference-tradelog-row .tj-tlog-row { min-height: 62px; flex-wrap: nowrap; gap: 10px; }.tj-reference-tradelog-row .tj-tlog-main { min-width: 150px; }.tj-reference-tradelog-row .tj-tlog-pills { flex-wrap: wrap; align-items: center; }.tj-reference-tradelog-row .tj-review-status { min-width: auto; padding: 2px 6px; border-radius: 5px; font-size: 9px; }.tj-reference-trade-meta { flex: 1; min-width: 170px; display: grid; gap: 3px; color: var(--tj-muted); font-size: 10px; line-height: 1.2; }.tj-reference-trade-meta span:first-child { color: var(--tj-text); }.tj-reference-tradelog-row .tj-tlog-pnl-block { min-width: 108px; text-align: right; }.tj-reference-trade-return { color: var(--tj-muted); font-size: 10px; }.tj-reference-tradelog-row .tj-statuspill { flex-shrink: 0; }.tj-reference-delete { color: var(--tj-red); border-color: color-mix(in srgb, var(--tj-red) 40%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, transparent); }.tj-reference-trade-detail-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 13px; }.tj-reference-trade-detail-summary > div { padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); display: grid; gap: 4px; }.tj-reference-trade-detail-summary span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .5px; }.tj-reference-trade-detail-summary strong { overflow: hidden; font-size: 12px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-linked-markup { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; margin-top: 12px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); }.tj-reference-linked-markup > div { display: grid; gap: 3px; }.tj-reference-linked-markup span { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .45px; text-transform: uppercase; }.tj-reference-linked-markup strong { font-size: 12px; }.tj-reference-linked-markup small { color: var(--tj-muted); font-size: 10px; }

/* Analytics workspace — uses the same theme and Forest Green tokens as the
   rest of the journal, including every chart and performance surface. */
.tj-analytics-workspace { display: grid; gap: 14px; }
.tj-analytics-equity-hero { padding: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)), var(--tj-panel)); }
.tj-analytics-equity-head { display: flex; justify-content: space-between; gap: 18px; padding-bottom: 14px; }
.tj-analytics-equity-head h2 { max-width: 680px; margin: 4px 0 7px; font-size: clamp(22px, 2.05vw, 31px); line-height: 1.08; letter-spacing: -.65px; }
.tj-analytics-equity-head p { max-width: 700px; margin: 0; color: var(--tj-muted); font-size: 11px; line-height: 1.5; }
.tj-analytics-hero-return { min-width: 165px; align-self: start; display: grid; gap: 3px; padding: 13px; border: 1px solid color-mix(in srgb, var(--tj-green) 30%, var(--tj-border)); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-analytics-hero-return strong { font-size: 27px; font-variant-numeric: tabular-nums; }.tj-analytics-hero-return span { color: var(--tj-muted); font-size: 11px; }
.tj-analytics-equity-main { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(270px, .9fr); gap: 12px; }.tj-analytics-equity-chart { padding: 12px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-analytics-equity-milestones { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 7px; }.tj-analytics-equity-milestones > div, .tj-analytics-equity-side > div { min-width: 0; padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); display: grid; gap: 3px; }.tj-analytics-equity-milestones small, .tj-analytics-equity-side small, .tj-engine-metrics small, .tj-rhythm-top small, .tj-coach-note small, .tj-coach-risk small { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .55px; }.tj-analytics-equity-milestones strong { overflow: hidden; font-size: 12px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-analytics-equity-side { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }.tj-analytics-equity-side strong { font-size: 17px; font-variant-numeric: tabular-nums; }.tj-analytics-equity-side span { color: var(--tj-muted); font-size: 10px; line-height: 1.3; }
.tj-analytics-command-grid { display: grid; grid-template-columns: minmax(340px, 1.25fr) minmax(310px, 1fr) minmax(285px, .8fr); gap: 14px; }.tj-analytics-engine, .tj-analytics-rhythm, .tj-analytics-coach { padding: 14px; }.tj-analytics-engine .tj-panel-head, .tj-analytics-rhythm .tj-panel-head, .tj-analytics-coach .tj-panel-head { align-items: start; }.tj-analytics-engine .tj-panel-head > div, .tj-analytics-rhythm .tj-panel-head > div { display: grid; gap: 4px; }.tj-engine-value { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 12px; padding: 12px 0; }.tj-engine-value > div:first-child { display: grid; gap: 6px; }.tj-engine-value > div:first-child > span { color: var(--tj-muted); font-size: 11px; }.tj-engine-value > div:first-child > strong { font-size: 33px; line-height: 1; letter-spacing: -1.1px; }.tj-engine-pills { display: flex; flex-wrap: wrap; gap: 5px; }.tj-engine-pills i { padding: 4px 7px; border-radius: 999px; background: var(--tj-panel-alt); color: var(--tj-muted); font-size: 9px; font-style: normal; }.tj-engine-score { display: grid; align-content: center; justify-items: start; gap: 3px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-engine-score small { color: var(--tj-muted); font-size: 9px; letter-spacing: .5px; }.tj-engine-score strong { font-size: 30px; line-height: 1; }.tj-engine-score span { color: var(--tj-muted); font-size: 9px; }.tj-engine-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.tj-engine-metrics > div { display: grid; gap: 3px; min-width: 0; padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-engine-metrics strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }.tj-engine-metrics span { color: var(--tj-muted); font-size: 9px; line-height: 1.3; }.tj-engine-trade-mix { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; margin-top: 11px; color: var(--tj-muted); font-size: 9px; font-weight: 800; }.tj-engine-trade-mix > i { display: flex; height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-engine-trade-mix em { background: var(--tj-green); }.tj-engine-trade-mix b { background: var(--tj-red); }
.tj-rhythm-top { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 13px; }.tj-rhythm-top > div { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }.tj-rhythm-top strong { font-size: 16px; }.tj-rhythm-top span { color: var(--tj-muted); font-size: 10px; }.tj-rhythm-bars { display: grid; gap: 8px; }.tj-rhythm-bars > div { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 10px; }.tj-rhythm-bars > div > span { color: var(--tj-muted); }.tj-rhythm-bars i { height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-rhythm-bars em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-rhythm-bars .tj-rhythm-loss { background: var(--tj-red); }.tj-rhythm-bars .tj-rhythm-flat { background: var(--tj-blue); }.tj-rhythm-bars b { font-variant-numeric: tabular-nums; }.tj-coach { display: grid; align-content: start; gap: 9px; }.tj-coach .tj-panel-head { margin-bottom: 1px; }.tj-coach-note, .tj-coach-risk { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; }.tj-coach-note strong, .tj-coach-risk strong { font-size: 12px; line-height: 1.28; }.tj-coach-note span, .tj-coach-risk span { color: var(--tj-muted); font-size: 10px; line-height: 1.35; }.tj-coach-good { border-color: color-mix(in srgb, var(--tj-green) 33%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); }.tj-coach-warn { border-color: color-mix(in srgb, var(--tj-amber) 35%, var(--tj-border)); background: color-mix(in srgb, var(--tj-amber) 8%, var(--tj-panel-alt)); }.tj-coach-risk { background: color-mix(in srgb, var(--tj-purple) 8%, var(--tj-panel-alt)); }
.tj-analytics-confluence { padding: 14px; }.tj-analytics-confluence .tj-panel-head > div, .tj-analytics-entry-types .tj-panel-head > div, .tj-analytics-days .tj-panel-head > div { display: grid; gap: 4px; }.tj-confluence-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 10px; }.tj-confluence-card { display: grid; gap: 7px; min-width: 0; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-confluence-card > strong { overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }.tj-confluence-card > div:nth-child(3) { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; }.tj-confluence-card-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .55px; }.tj-confluence-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }.tj-confluence-metrics > span { display: grid; gap: 2px; min-width: 0; padding: 7px; border: 1px solid var(--tj-border); border-radius: 7px; background: var(--tj-panel); }.tj-confluence-metrics small { color: var(--tj-muted); font-size: 8px; font-weight: 800; }.tj-confluence-metrics b { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.tj-confluence-bars { display: grid; grid-template-columns: 43px minmax(0, 1fr) auto; align-items: center; gap: 5px 7px; color: var(--tj-muted); font-size: 8px; font-weight: 800; }.tj-confluence-bars i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-confluence-bars em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-confluence-bars b { color: var(--tj-text); font-size: 9px; }
.tj-analytics-performance-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr); gap: 14px; }.tj-analytics-entry-types, .tj-analytics-days { padding: 14px; }.tj-entry-type-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 11px 0; }.tj-entry-type-highlights > div { display: grid; gap: 3px; min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-entry-type-highlights small { color: var(--tj-muted); font-size: 8px; font-weight: 800; letter-spacing: .45px; }.tj-entry-type-highlights strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }.tj-entry-type-highlights span { color: var(--tj-muted); font-size: 10px; }.tj-analytics-entry-types .tj-setup-tags { grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); gap: 10px; }.tj-analytics-entry-types .tj-setup-card { padding: 11px; }
.tj-analytics-scatter { padding: 14px; }.tj-analytics-scatter .tj-scatter-box { min-height: 480px; height: clamp(480px, 49vw, 630px); }.tj-analytics-lower-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(340px, .95fr); gap: 14px; }.tj-analytics-instruments, .tj-analytics-lab, .tj-analytics-sessions { padding: 14px; }.tj-analytics-lab .tj-mlabel { margin: 12px 0 7px; }.tj-analytics-lab .tj-chip-row { gap: 6px; }.tj-analytics-sessions .tj-session-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }

/* Review Library — period cards intentionally act as clear launch points for
   a saved monthly, quarterly, or annual reflection. */
.tj-review-library { display: grid; gap: 14px; }
.tj-review-workspace { padding: 14px; }
.tj-review-library-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 13px; }
.tj-review-year-switch { display: flex; align-items: center; gap: 12px; }
.tj-review-year-switch strong { font-size: 16px; min-width: 48px; text-align: center; }
.tj-review-period-title { padding: 7px 11px; margin: 12px 0; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); font-size: 10px; font-weight: 800; letter-spacing: .65px; }
.tj-review-month-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-review-quarter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-review-annual-grid { display: grid; grid-template-columns: minmax(210px, .24fr) 1fr; gap: 10px; }
.tj-review-library-card { min-height: 134px; display: grid; align-content: start; gap: 7px; padding: 12px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); color: var(--tj-text); text-align: left; font: inherit; cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease; }
.tj-review-library-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--tj-green) 56%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel-alt)); }
.tj-review-library-card:focus-visible { outline: 2px solid var(--tj-green); outline-offset: 2px; }
.tj-review-library-card-live { border-color: color-mix(in srgb, var(--tj-green) 30%, var(--tj-border)); }
.tj-review-library-card-compact { min-height: 104px; }
.tj-review-card-top, .tj-review-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tj-review-card-top { color: var(--tj-muted); font-size: 10px; font-weight: 800; letter-spacing: .55px; }
.tj-review-card-top b { font-size: 12px; }
.tj-review-library-card > strong { font-size: 17px; line-height: 1.1; }
.tj-review-library-card > small { color: var(--tj-muted); min-height: 16px; font-size: 11px; }
.tj-review-card-foot { margin-top: auto; color: var(--tj-muted); font-size: 10px; }
.tj-review-library-card > i, .tj-period-meter-grid i { display: block; height: 5px; overflow: hidden; border-radius: 999px; background: var(--tj-border); }
.tj-review-library-card > i > em, .tj-period-meter-grid i > em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }
.tj-trades-to-review { padding: 14px; }
.tj-period-trades-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 11px; }
.tj-count-badge { display: inline-grid; place-items: center; min-width: 25px; height: 25px; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--tj-purple) 17%, var(--tj-panel-alt)); color: var(--tj-purple); font-size: 11px; font-weight: 800; }
.tj-review-pending-list { display: grid; gap: 7px; }
.tj-period-trade-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-period-trade-row > div:first-child { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px 7px; }
.tj-period-trade-row strong { font-size: 12px; }
.tj-period-trade-row small { width: 100%; color: var(--tj-muted); font-size: 10px; }
.tj-period-trade-row > div:last-child { display: flex; flex-shrink: 0; align-items: center; gap: 8px; }
.tj-review-status-done, .tj-review-status-pending { display: inline-flex; align-items: center; border-radius: 5px; padding: 3px 6px; font-size: 9px; font-weight: 800; white-space: nowrap; }
.tj-review-status-done { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-review-status-pending { background: color-mix(in srgb, var(--tj-red) 13%, transparent); color: var(--tj-red); }
.tj-review-trade-meta { display: grid; gap: 3px; padding: 11px; margin-bottom: 14px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-review-trade-meta span { color: var(--tj-muted); font-size: 11px; }
.tj-period-review-summary, .tj-period-at-glance { padding: 13px; margin-bottom: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-period-review-title { display: grid; gap: 5px; margin-bottom: 12px; }
.tj-period-review-title > span { color: var(--tj-muted); font-size: 11px; }
.tj-period-metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tj-period-metric-grid > div, .tj-period-meter-grid > div { display: grid; align-content: start; gap: 4px; min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); }
.tj-period-metric-grid small, .tj-period-meter-grid small { color: var(--tj-muted); font-size: 9px; font-weight: 800; letter-spacing: .5px; }
.tj-period-metric-grid strong { font-size: 16px; font-variant-numeric: tabular-nums; }
.tj-period-metric-grid span, .tj-period-meter-grid span { color: var(--tj-muted); font-size: 10px; line-height: 1.3; }
.tj-period-meter-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.tj-period-meter-grid b { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.tj-result-meter { display: flex !important; }
.tj-result-meter strong { display: block; height: 100%; background: var(--tj-red); }
.tj-period-at-glance { display: grid; gap: 9px; }
.tj-period-at-glance .tj-field { margin: 0; }
.tj-period-sections { display: grid; gap: 9px; }
.tj-period-section { overflow: hidden; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }
.tj-period-section-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px; border: none; background: none; color: var(--tj-text); text-align: left; font: inherit; cursor: pointer; }
.tj-period-section-head strong { font-size: 12px; text-transform: uppercase; }
.tj-period-section-head svg { color: var(--tj-muted); transition: transform .16s ease; }
.tj-period-section-body { display: grid; gap: 10px; padding: 0 11px 11px; border-top: 1px solid var(--tj-border); }
.tj-period-section-body .tj-field { margin: 0; padding-top: 10px; }
.tj-period-section-body .tj-textarea { min-height: 78px; }
.tj-period-trades { padding: 13px; margin-top: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-period-trades .tj-period-trade-row { margin-top: 7px; }

@media (max-width: 900px) {
  .tj-settings-hero-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-analytics-command-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tj-analytics-engine { grid-column: 1 / -1; }
  .tj-analytics-performance-grid, .tj-analytics-lower-grid { grid-template-columns: 1fr; }
  .tj-analytics-equity-main { grid-template-columns: 1fr; }
  .tj-review-month-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-review-quarter-grid, .tj-period-metric-grid, .tj-period-meter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-review-annual-grid { grid-template-columns: minmax(210px, .5fr) 1fr; }
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
  .tj-management-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-reference-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }.tj-guardrail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.tj-reference-calendar-layout, .tj-reference-hero-grid { grid-template-columns: 1fr; }.tj-dashboard-analytics-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }.tj-dashboard-core-score { grid-column: 1 / -1; }.tj-flow-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.tj-flow-last { grid-column: 1 / -1; }
  .tj-tradelog-reference-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }.tj-reference-tradelog-row .tj-tlog-row { flex-wrap: wrap; }.tj-reference-tradelog-row .tj-tlog-main { min-width: 180px; }.tj-reference-trade-meta { min-width: 180px; }.tj-reference-trade-detail-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-markup-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.tj-markup-detail-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .tj-toolbar { flex-direction: column; height: auto; align-items: stretch; padding: 12px; gap: 10px; overflow-x: visible; }
  .tj-toolbar-search { flex: none; width: 100%; height: 40px; }
  .tj-toolbar-right { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
  .tj-toolbar-dd, .tj-toolbar-pill { width: 100%; height: 38px; text-align: center; justify-content: center; }
}
@media (max-width: 520px) {
  .tj-management-grid { grid-template-columns: 1fr; }
  .tj-management-workspace .tj-page-intro { align-items: flex-start; flex-direction: column; }
  .tj-settings-account-hero { grid-template-columns: 58px minmax(0, 1fr); padding: 13px; }
  .tj-settings-hero-avatar { width: 58px; height: 58px; border-radius: 12px; font-size: 23px; }
  .tj-settings-hero-copy strong { font-size: 19px; }
  .tj-settings-hero-metrics { grid-template-columns: 1fr 1fr; gap: 7px; }
  .tj-settings-section-end em { max-width: 84px; }
  .tj-analytics-equity-head { align-items: stretch; flex-direction: column; }
  .tj-analytics-hero-return { min-width: 0; }
  .tj-analytics-equity-milestones, .tj-analytics-equity-side, .tj-analytics-command-grid, .tj-engine-metrics, .tj-rhythm-top, .tj-entry-type-highlights { grid-template-columns: 1fr 1fr; }
  .tj-engine-value { grid-template-columns: 1fr; }
  .tj-engine-score { grid-template-columns: auto 1fr; align-items: center; }
  .tj-analytics-scatter .tj-scatter-box { min-height: 360px; height: 360px; }
  .tj-review-library-head { align-items: flex-start; flex-direction: column; }
  .tj-review-month-grid, .tj-review-quarter-grid, .tj-review-annual-grid, .tj-period-metric-grid, .tj-period-meter-grid { grid-template-columns: 1fr; }
  .tj-review-annual-grid { display: block; }
  .tj-review-library-card { min-height: 112px; }
  .tj-period-trade-row { align-items: flex-start; flex-direction: column; }
  .tj-period-trade-row > div:last-child { width: 100%; justify-content: space-between; }
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
  .tj-settings-section-body { padding: 12px; }.tj-reference-kpis, .tj-guardrail-grid, .tj-flow-grid, .tj-dashboard-analytics-grid { grid-template-columns: 1fr 1fr; }.tj-reference-kpi { min-height: 118px; padding: 11px; }.tj-reference-kpi-value { font-size: 18px; }.tj-recent-head { display: none; }.tj-recent-row { grid-template-columns: 1fr auto; gap: 5px 10px; padding: 10px; }.tj-recent-row span:nth-child(3), .tj-recent-row span:nth-child(4) { font-size: 11px; }.tj-recent-row strong:nth-child(2) { grid-row: 1; grid-column: 1; }.tj-recent-row span:first-child { grid-row: 2; grid-column: 1; color: var(--tj-muted); font-size: 10px; }.tj-recent-row strong:last-child { grid-row: 1 / span 2; grid-column: 2; align-self: center; }.tj-flow-last { grid-column: 1 / -1; }.tj-reference-calendar, .tj-reference-weeks, .tj-reference-flow { padding: 12px; }.tj-reference-calendar .tj-cal-cell { min-height: 62px; }.tj-reference-month-head { align-items: flex-start; flex-direction: column; }.tj-reference-month-total { justify-content: flex-start; }.tj-reference-calendar-body { grid-template-columns: 1fr; }.tj-reference-week-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: auto; }.tj-reference-week { min-height: 62px; }.tj-reference-flow { min-height: auto; }.tj-reference-flow-head { flex-direction: column; }.tj-dashboard-core-score { grid-column: 1 / -1; }.tj-dashboard-analytics-grid > .tj-panel { min-height: 340px; }
  .tj-markup-overview-grid { grid-template-columns: 1fr; }.tj-markup-filter-controls { display: grid; grid-template-columns: 1fr 1fr; }.tj-markup-filter-controls .tj-toolbar-search { grid-column: 1 / -1; }.tj-reference-markup-card .tj-tlog-row { align-items: flex-start; flex-wrap: wrap; padding: 11px; }.tj-reference-markup-card .tj-tlog-main { min-width: calc(100% - 115px); }.tj-markup-pnl { margin-left: auto; }.tj-markup-detail-top { grid-template-columns: 1fr 1fr; }.tj-linked-markup-trade { align-items: flex-start; }.tj-linked-markup-trade > div:last-child { min-width: 85px; }
  .tj-tradelog-reference-summary { grid-template-columns: 1fr 1fr; }.tj-tradelog-reference-summary > div { padding: 10px; }.tj-tradelog-filter-controls { display: grid; grid-template-columns: 1fr 1fr; }.tj-tradelog-filter-controls .tj-toolbar-search { grid-column: 1 / -1; }.tj-tradelog-sort-controls { flex-wrap: wrap; }.tj-reference-tradelog-row .tj-tlog-row { align-items: flex-start; padding: 11px; }.tj-reference-tradelog-row .tj-tlog-main { min-width: calc(100% - 105px); }.tj-reference-trade-meta { order: 5; width: 100%; min-width: 100%; }.tj-reference-tradelog-row .tj-tlog-pnl-block { margin-left: auto; }.tj-reference-trade-detail-summary { grid-template-columns: 1fr 1fr; }.tj-reference-linked-markup { align-items: flex-start; }.tj-reference-linked-markup > span { text-align: right; }
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
