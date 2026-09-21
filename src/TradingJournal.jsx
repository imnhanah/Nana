import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from "recharts";
import {
  LayoutGrid, FileText, BarChart2, Calendar as CalendarIcon, Brain,
  Lightbulb, Newspaper, Settings, LogOut, Plus, X, Star,
  ChevronLeft, ChevronRight, Trash2, Pencil, PanelLeftClose, PanelLeftOpen, Search, ChevronDown,
  ChevronUp, Trophy, Key, DollarSign, ShieldCheck, Satellite, Snowflake,
  ImagePlus, ClipboardCheck, ScanLine, CheckCircle2, SlidersHorizontal, ArrowDownUp,
  AlertTriangle, Sun, Moon, Landmark, ArrowDownToLine, ArrowUpFromLine, Repeat2, WalletCards,
} from "lucide-react";
import PublicSite from "./PublicSite";
import { useSiteTheme } from './siteTheme';
import { readActiveAccount, rememberActiveAccount, readActivePage, rememberActivePage, resolveActiveAccount } from './activeAccount';
import JournalPreloader from './JournalPreloader';
import { ThemedFields, ThemeSelect, ThemeTime, ThemeDate, ConfirmDeleteButton, ThemeInstrument } from './JournalControls';
import JournalSignalHeader from './JournalSignalHeader';
import { tradeTimingError } from './tradeTiming';
import { getLoginQuote } from "./loginQuote";
import ChallengePage from "./ChallengePage";
import useChallenge from './useChallenge';
import ChallengeModeSettings from './ChallengeModeSettings';
import { isChallengeEnabled } from "./challengeModel";
import ResetPasswordForm from "./ResetPasswordForm";
import accountSettingsSymbol from "./assets/account-settings-symbol.png";
import profileSettingsSymbol from "./assets/profile-settings-symbol.png";
import managementSettingsSymbol from "./assets/management-settings-symbol.png";
import { supabase } from "./supabaseClient";
import { onAuthStateChange, getSession, signOut, updatePassword, updateProfile } from "./auth";
import { getCalendarWeek } from "./forexFactory";
import { ensureDemoAccount } from "./demoAccount";
import {
  fetchAllUserData, createAccount, updateAccount, deleteAccount, resetAccountData,
  createTrade, updateTrade, deleteTrade, createRule, updateRule, deleteRule, setCheckin,
  saveManagedLists, createMarkup, updateMarkup, deleteMarkup, saveTradeReview, savePeriodReview, hasMigratedLocalData, markLocalDataMigrated, importLegacyAccount, saveFinanceSettings, createSavingsAccount, updateSavingsAccount, deleteSavingsAccount, createFinanceMovement, updateFinanceMovement, deleteFinanceMovement,
} from "./db";

/* ----------------------------- constants ----------------------------- */

const SESSIONS = ["Asia", "London", "NYC AM", "NYC PM"];
const normalizeSession = (value) => ({ "NY AM": "NYC AM", "NY PM": "NYC PM" }[value] || value);
const MOODS = ["Confident", "Neutral", "Fear", "FOMO", "Revenge", "Disciplined", "Anxious", "Excited"];
const DEFAULT_MISTAKE_TAGS = [
  "Overtrading", "Early Exit", "No Stop Loss", "Revenge Trade", "FOMO Entry",
  "Sized Too Big", "Sized Too Low", "Missed Entry", "Moved Stop", "Chased Entry",
  "Ignored Rules", "Bad Timing",
];
const allMistakeTags = (customTags = []) => [
  ...DEFAULT_MISTAKE_TAGS,
  ...customTags.filter((tag) => !DEFAULT_MISTAKE_TAGS.some((preset) => preset.toLowerCase() === String(tag).toLowerCase())),
];
const DEFAULT_INSTRUMENTS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
  "XAU/USD", "XAG/USD", "US30", "US100", "US500", "BTC/USD", "ETH/USD",
];
const MARKUP_BIASES = ["Bullish", "Bearish", "Neutral"];
const ACCOUNT_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "GHS", label: "Ghana Cedi", symbol: "₵" },
];
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "markups", label: "Markups", icon: ScanLine },
  { id: "tradelog", label: "Trade Logs", icon: FileText },
  { id: "reviews", label: "Review", icon: ClipboardCheck },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "challenge", label: "Challenge", icon: Trophy },
  { id: "finance", label: "Finance", icon: Landmark },
  { id: "psychology", label: "Psychology", icon: Brain },
  { id: "insights", label: "Insights & AI Coach", icon: Lightbulb },
  { id: "news", label: "News", icon: Newspaper },
  { id: "management", label: "Management", symbol: managementSettingsSymbol },
];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const uid = () => Math.random().toString(36).slice(2, 10);
const cTraderOpeningIsUnknown = (trade) => /Imported cTrader position #.*\[close-only\]/i.test(trade?.context || "") && !trade?.time;
const cTraderOpeningWasEnteredManually = (trade) => /\[opening-time:manual\]/i.test(trade?.context || "");
const NavSymbol = ({ src, className = "" }) => <img className={`tj-nav-symbol ${className}`.trim()} src={src} alt="" aria-hidden="true" />;
const uuid = () => globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
  const value = Math.random() * 16 | 0;
  return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
});
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const formatTime = (time) => {
  if (!time) return "Time not set";
  const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "Time not set";
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
};
let activeMoneyCurrency = "USD";
const normalizeCurrency = (currency) => ACCOUNT_CURRENCIES.some((item) => item.code === currency) ? currency : "USD";
const setActiveMoneyCurrency = (currency) => { activeMoneyCurrency = normalizeCurrency(currency); };
const currencySymbol = (currency = activeMoneyCurrency) => ACCOUNT_CURRENCIES.find((item) => item.code === normalizeCurrency(currency))?.symbol || "$";
const accountInitial = (name) => String(name || "A").trim().charAt(0).toUpperCase() || "A";
const fmtMoney = (n, currency = activeMoneyCurrency) => {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${currencySymbol(currency)}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtMoneyShort = (n, currency = activeMoneyCurrency) => {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${currencySymbol(currency)}${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const importedAccountBaseNote = "[Imported account base]";
const financeTradingImpact = (movement) => movement.type === "deposit" ? (movement.note?.startsWith(importedAccountBaseNote) ? 0 : movement.amount) : movement.source === "trading" ? -movement.amount : 0;
const financeSavingsBalance = (account, savingsId) => (account.financeMovements || []).reduce((sum, movement) => {
  if (movement.savingsAccountId !== savingsId) return sum;
  if (movement.type === "transfer") return sum + movement.amount;
  if (movement.type === "withdrawal" && movement.source === "savings") return sum - movement.amount;
  return sum;
}, 0);
const financeTotals = (account) => {
  const movementTotal = (account.financeMovements || []).reduce((sum, movement) => sum + financeTradingImpact(movement), 0);
  const tradeTotal = (account.trades || []).reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const tradingBalance = Number(account.balance || 0) + tradeTotal + movementTotal;
  const savings = (account.savingsAccounts || []).reduce((sum, item) => sum + financeSavingsBalance(account, item.id), 0);
  const deposits = (account.financeMovements || []).filter((item) => item.type === "deposit").reduce((sum, item) => sum + item.amount, 0);
  const withdrawals = (account.financeMovements || []).filter((item) => item.type === "withdrawal").reduce((sum, item) => sum + item.amount, 0);
  return { tradingBalance, savings, totalCapital: tradingBalance + savings, deposits, withdrawals, movementTotal };
};
const financeProfitCycle = (account) => {
  let running = Number(account.balance || 0);
  let baseline = running;
  let profit = 0;
  const events = [...(account.trades || []).map((trade) => ({date:trade.date, kind:"trade", value:Number(trade.pnl || 0)})), ...(account.financeMovements || []).map((movement) => ({date:movement.date, kind:"cash", value:financeTradingImpact(movement), createdAt:movement.createdAt}))].sort((left, right) => String(left.date).localeCompare(String(right.date)) || ({trade:0,cash:1}[left.kind] - {trade:0,cash:1}[right.kind]) || String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  events.forEach((event) => { running += event.value; if (event.kind === "trade") profit += event.value; else { baseline = running; profit = 0; } });
  return { baseline, profit, availableCapital:running };
};
const reminderScheduleDue = (saving, movements, now = new Date()) => {
  const interval = saving.interval || "Manual";
  if (interval === "Manual" || now.getHours() < 12) return false;
  const today = now.toISOString().slice(0, 10);
  const transfers = (movements || []).filter((movement) => movement.type === "transfer" && movement.savingsAccountId === saving.id);
  const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const wasTransferredSince = (date) => transfers.some((movement) => String(movement.date) >= date);
  if (interval === "Weekly") return now.getDay() === 5 && !wasTransferredSince(startOfWeek.toISOString().slice(0, 10));
  if (interval === "Bi-weekly") return now.getDate() >= 15 && !wasTransferredSince(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  if (interval === "Monthly") { const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); return now.getDate() >= monthEnd && !wasTransferredSince(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`); }
  return false;
};
const norm = (v, max) => clamp((v / max) * 100, 0, 100);
const classify = (pnl, cap) => (Math.abs(pnl) <= cap ? "be" : pnl > 0 ? "win" : "loss");
const clsColor = (cls) => (cls === "win" ? "tj-green" : cls === "loss" ? "tj-red" : "tj-blue");
// Win-rate percentage system: >50% green, 30-50% muted theme amber, <30% red.
// Bars retain their existing colors so the percentage is the only changing part.
const wrColorClass = (wr) => (wr > 50 ? "tj-green" : wr >= 30 ? "tj-wr-yellow" : "tj-red");
const wrBarClass = (wr) => (wr > 50 ? "tj-bar-green" : wr >= 30 ? "tj-bar-yellow" : "tj-bar-red");
const UI_COLORS = { primary: "var(--tj-green)", danger: "var(--tj-red)", warning: "var(--tj-amber)", info: "var(--tj-blue)", purple: "var(--tj-purple)" };
const CHART_TICK = { fill: "var(--tj-chart-text)", fontSize: 13 };
const CHART_TOOLTIP_STYLE = { background: "var(--tj-tooltip-bg)", color: "var(--tj-text)", border: "1px solid var(--tj-border)", borderRadius: 8, fontSize: 14, boxShadow: "var(--tj-shadow)" };
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
  // Loss limits move with live trading balance: starting balance, realised
  // trade P&L, deposits, withdrawals, and transfers affecting trading capital.
  const guardrailBalance = Math.max(0, Number(financeTotals(account).tradingBalance) || 0);
  const monthlyGoalSource = account.monthlyGoalSource === "amount" ? "amount" : "percentage";
  const yearlyGoalSource = account.yearlyGoalSource === "amount" ? "amount" : "percentage";
  const monthlyGoalAmount = Math.max(0, Number(account.monthlyGoalAmount) || 0);
  const yearlyGoalAmount = Math.max(0, Number(account.yearlyGoalAmount) || 0);
  const monthlyGoal = monthlyGoalSource === "amount" && monthlyGoalAmount > 0 ? monthlyGoalAmount : balance * Math.max(0, Number(account.monthlyGoalPct) || 0) / 100;
  const yearlyGoal = yearlyGoalSource === "amount" && yearlyGoalAmount > 0 ? yearlyGoalAmount : balance * Math.max(0, Number(account.yearlyGoalPct) || 0) / 100;
  const monthlyGoalPct = balance > 0 ? monthlyGoal / balance * 100 : Math.max(0, Number(account.monthlyGoalPct) || 0);
  const yearlyGoalPct = balance > 0 ? yearlyGoal / balance * 100 : Math.max(0, Number(account.yearlyGoalPct) || 0);
  const dailyLossLimitPct = Math.max(0, Number(account.dailyLossLimitPct) || 0);
  const monthlyLossLimitPct = Math.max(0, Number(account.monthlyLossLimitPct) || 0);
  const dailyLossCap = guardrailBalance * dailyLossLimitPct / 100;
  const monthlyLossCap = guardrailBalance * monthlyLossLimitPct / 100;
  const dailyLossHit = dailyLossCap > 0 && dailyPnl <= -dailyLossCap;
  const monthlyLossHit = monthlyLossCap > 0 && monthlyPnl <= -monthlyLossCap;
  return {
    enabled: [monthlyGoalPct, yearlyGoalPct, dailyLossLimitPct, monthlyLossLimitPct].some((value) => value > 0),
    monthlyPnl, yearlyPnl, dailyPnl, monthlyGoal, yearlyGoal, dailyLossCap, monthlyLossCap, guardrailBalance,
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
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const info = byDay[iso];
    cells.push({ day: d, iso, pnl: info?.pnl || 0, count: info?.count || 0, cls: info?.cls, cash:info?.cash || 0, cashCount:info?.cashCount || 0, cashType:info?.cashType || "transfer" });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function computeWeeklyBreakdown(trades, year, month, cap) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTrades = trades.filter((t) => t.date?.slice(0, 7) === monthKey);
  const byDay = groupByDay(monthTrades, cap);
  const weeks = buildMonthGrid(year, month, byDay);
  return weeks.map((cells, index) => {
    const activeDays = cells.filter((cell) => cell?.count);
    const pnl = activeDays.reduce((sum, cell) => sum + cell.pnl, 0);
    const wins = activeDays.filter((cell) => cell.cls === "win").length;
    const winRate = activeDays.length ? (wins / activeDays.length) * 100 : 0;
    const datedCells = cells.filter(Boolean);
    return {
      label: `Week ${index + 1}`,
      range: datedCells.length ? `${datedCells[0].day}–${datedCells[datedCells.length - 1].day} ${MONTH_ABBR[month]}` : "",
      pnl,
      winRate,
      count: activeDays.length,
      tradeCount: activeDays.reduce((sum, cell) => sum + cell.count, 0),
    };
  });
}

/* ============================= UI PRIMITIVES =========================== */

function Card({ children, style, className = "", ...props }) {
  return <div className={`tj-card ${className}`} style={style} {...props}>{children}</div>;
}

function AttachedPnlCalendar({ account, monthCursor, setMonthCursor, onDayClick, className = "" }) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const byDay = groupByDay(account.trades, account.breakevenCap);
  (account.financeMovements || []).forEach((movement) => {
    if (!movement.date) return;
    const item = byDay[movement.date] || {pnl:0,count:0,cls:"be"};
    item.cash = (item.cash || 0) + financeTradingImpact(movement);
    item.cashCount = (item.cashCount || 0) + 1;
    item.cashType = movement.type;
    byDay[movement.date] = item;
  });
  const weeks = buildMonthGrid(year, month, byDay);
  const monthTrades = account.trades.filter((trade) => trade.date?.slice(0, 7) === monthKey);
  const monthStats = computeStats(monthTrades, account.breakevenCap);
  const snapshots = computeWeeklyBreakdown(account.trades, year, month, account.breakevenCap);
  return <Card className={`tj-attached-calendar ${className}`}>
    <div className="tj-attached-calendar-head">
      <div className="tj-attached-month-nav">
        <button aria-label="Previous month" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16}/></button>
        <strong>{MONTH_NAMES[month]} {year}</strong>
        <button aria-label="Next month" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}><ChevronRight size={16}/></button>
        <button className="tj-attached-this-month" onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>This month</button>
      </div>
      <div className="tj-attached-month-result">
        <strong className={monthStats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoneyShort(monthStats.netPnl)}</strong>
        <span className="tj-month-count">{monthStats.dayClasses.length} day{monthStats.dayClasses.length === 1 ? "" : "s"}</span>
        <span className="tj-month-win">{monthStats.wins}W</span>
        <span className="tj-month-loss">{monthStats.losses}L</span>
        <span className="tj-month-be">{monthStats.be} B/E</span>
      </div>
    </div>
    <div className="tj-attached-calendar-scroll">
      <div className="tj-attached-calendar-grid">
        {DOW.map((day) => <div className="tj-attached-dow" key={day}>{day}</div>)}
        <div className="tj-attached-dow tj-attached-week-heading">Week</div>
        {weeks.map((week, weekIndex) => <React.Fragment key={`week-${weekIndex}`}>
          {week.map((cell, dayIndex) => cell ? <button type="button" key={cell.iso} className={`tj-attached-day ${cell.cashCount ? "tj-attached-day-finance" : cell.count ? `tj-attached-day-${cell.cls || "be"}` : "tj-attached-day-quiet"} ${cell.iso === todayISO() ? "tj-attached-day-today" : ""}`} onClick={() => (cell.count || cell.cashCount) && onDayClick(cell.iso)} aria-label={`${cell.iso}${cell.count ? `, ${cell.count} trade${cell.count === 1 ? "" : "s"}, ${fmtMoney(cell.pnl)}` : ", no trades"}${cell.cashCount ? `, ${cell.cashCount} cash movement${cell.cashCount === 1 ? "" : "s"}, ${fmtMoney(cell.cash)}` : ""}`}>
            <span className="tj-attached-day-number">{cell.day}</span>
            {cell.cashCount ? <span className={`tj-attached-day-pill tj-attached-day-cash tj-attached-day-cash-${cell.cashType}`}><b>{fmtMoneyShort(cell.cash)}</b><i>$</i></span> : cell.count ? <span className="tj-attached-day-pill"><b>{fmtMoneyShort(cell.pnl)}</b><i>{cell.count}</i></span> : <span className="tj-attached-day-placeholder"/>}
          </button> : <div className="tj-attached-day-empty" key={`empty-${weekIndex}-${dayIndex}`}/>) }
          {(() => { const snapshot = snapshots[weekIndex]; const percent = account.balance ? snapshot.pnl / account.balance * 100 : 0; return <div key={`snapshot-${weekIndex}`} className={`tj-attached-week ${snapshot.count ? `tj-attached-week-active ${snapshot.pnl >= 0 ? "tj-attached-week-win" : "tj-attached-week-loss"}` : ""}`}>
            <small>WEEK {weekIndex + 1}</small>
            <strong className={!snapshot.count ? "tj-muted-txt" : snapshot.pnl >= 0 ? "tj-green" : "tj-red"}>{snapshot.count ? `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%` : "0.00%"}</strong>
            <i className="tj-attached-week-bar"><b style={{ width: `${snapshot.count ? snapshot.winRate : 0}%` }}/></i>
            <span>{snapshot.count ? `${snapshot.count} day${snapshot.count === 1 ? "" : "s"} · ${snapshot.winRate.toFixed(0)}% win` : "Quiet week"}</span>
          </div>; })()}
        </React.Fragment>)}
      </div>
    </div>
  </Card>;
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

function Modal({ title, onClose, children, wide, onConfirm, confirmDisabled = false, className = "", centered = false }) {
  return (
    <div className={`tj-modal-overlay ${centered ? "tj-modal-overlay-centered" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`tj-modal ${wide ? "tj-modal-wide" : ""} ${className}`}>
        <div className="tj-modal-head">
          <div className="tj-modal-title">{title}</div>
          <div className="tj-modal-head-actions">{onConfirm && <button className="tj-icon-btn tj-modal-confirm" title="Save" disabled={confirmDisabled} onClick={onConfirm}><CheckCircle2 size={18} /></button>}<button className="tj-icon-btn" title="Close" onClick={onClose}><X size={18} /></button></div>
        </div>
        <ThemedFields.Provider value={true}><div className="tj-modal-body">{children}</div></ThemedFields.Provider>
      </div>
    </div>
  );
}

function InstrumentPicker({value, onChange}) { return <ThemeInstrument value={value} onChange={onChange} options={DEFAULT_INSTRUMENTS}/>; }

function Field({ label, children }) {
  const themed = React.useContext(ThemedFields);
  const content = React.Children.map(children, child => {
    if (!themed || !React.isValidElement(child)) return child;
    if (child.type === 'select') return <ThemeSelect {...child.props} label={label}/>;
    if (child.type === 'input' && child.props.type === 'time') return <ThemeTime {...child.props} label={label}/>;
    if (child.type === 'input' && child.props.type === 'date') return <ThemeDate {...child.props} label={label}/>;
    return child;
  });
  return <div className="tj-field"><div className="tj-field-label">{label}</div>{content}</div>;
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

function ImagePreview({ src, alt = "Uploaded image", className = "", selected = false, onSelect }) {
  const openImage = React.useContext(ImageViewerContext);
  return <button type="button" className={`tj-image-preview ${selected ? "tj-image-preview-selected" : ""} ${className}`} onClick={(event) => { event.stopPropagation(); onSelect?.(src); openImage(src); }} aria-label={`View ${alt}`}><img src={src} alt={alt} /></button>;
}

const screenshotSource = (screenshot) => typeof screenshot === "string" ? screenshot : screenshot?.src || "";
const screenshotCaption = (screenshot) => typeof screenshot === "object" && screenshot ? screenshot.caption || "" : "";

/* ============================ SCREENSHOT UPLOADER ======================= */

function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 320;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ScreenshotUploader({ screenshots, onChange, max = 2, captions = false }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const addFiles = useCallback(async (files) => {
    const room = max - screenshots.length;
    const list = Array.from(files).slice(0, Math.max(0, room)).filter((f) => f.type.startsWith("image/"));
    for (const f of list) {
      try {
        const dataUrl = await downscaleImage(f);
        onChange((prev) => (prev.length >= max ? prev : [...prev, captions ? { src: dataUrl, caption: "" } : dataUrl]));
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
      <div
        className={`tj-dropzone ${dragOver ? "tj-dropzone-active" : ""}`}
        onClick={() => screenshots.length < max && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        {screenshots.length === 0 ? (
          <ImagePlus size={20} color="var(--tj-muted)" aria-label="Add screenshots" />
        ) : (
          <div className="tj-shot-grid">
            {screenshots.map((screenshot, i) => (
              <div key={i} className="tj-shot-thumb">
                <ImagePreview src={screenshotSource(screenshot)} alt={`Screenshot ${i + 1}`} />
                <ConfirmDeleteButton type="button" className="tj-shot-remove"
                  aria-label="Remove screenshot" onClick={async (e) => { e.stopPropagation(); onChange((prev) => prev.filter((_, idx) => idx !== i)); }}>
                  <X size={12} />
                </ConfirmDeleteButton>
                {captions && <input className="tj-shot-caption" value={screenshotCaption(screenshot)} placeholder="Caption" aria-label={`Caption for screenshot ${i + 1}`} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange((prev) => prev.map((item, index) => index === i ? { src: screenshotSource(item), caption: event.target.value } : item))} />}
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
    </div>
  );
}

const tradeImageSessions = (screenshots) => {
  const images = Array.isArray(screenshots) ? screenshots : [];
  return { entry: images.slice(0, 2), exit: images.slice(2, 4) };
};

/* ============================== NEW TRADE MODAL ========================= */

function NewTradeModal({ onClose, onSave, editing, draft, typeTags, mistakeTags, confluenceSessions, markups, rules, instruments = [], defaultCommission, account }) {
  const [form, setForm] = useState(() => {
    const base = { id: uid(), date: todayISO(), time: nowTime(), closeDate: todayISO(), closeTime: nowTime(), asset: "", direction: "BUY", riskPct: account?.defaultRiskPct || 1, stopLossPips: account?.defaultStopLossPips || "", entryPrice: "", stopLossPrice: "", grossPnl: "", commission: defaultCommission || 0, swap: 0, pnl: "", rr: "", entryType: "", entrySession: SESSIONS[2], session: SESSIONS[2], confluence: [], types: [], mistakes: [], moodBefore: "Neutral", moodAfter: "Neutral", context: "", screenshots: [], premarketMarkupId: null, ruleEvaluations: [] };
    if (!editing && !draft) return base;
    const source = editing || draft;
    return { ...base, ...source, time: editing ? (source.time || "") : (source.time || nowTime()), entryType: source.entryType || source.confluenceSession || "", entrySession: normalizeSession(source.entrySession || source.session || SESSIONS[2]), confluence: source.confluence || source.types || [], ruleEvaluations: source.ruleEvaluations || [] };
  });
  const activeRules = rules.filter((rule) => rule.active);
  const recentMarkups = useMemo(() => [...markups].sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`)).slice(0, 3), [markups]);
  const positionSuggestion = useMemo(() => {
    if (!account?.positionSizeEnabled) return null;
    const symbol = String(form.asset || "").toUpperCase().replace(/[^A-Z]/g, "");
    const fxCurrencies = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "GHS"]);
    const baseCurrency = symbol.length === 6 ? symbol.slice(0, 3) : "";
    const quoteCurrency = symbol.length === 6 ? symbol.slice(3) : "";
    const pipSize = quoteCurrency === "JPY" ? 0.01 : 0.0001;
    const explicitPips = Number(form.stopLossPips);
    const derivedPips = Number(form.entryPrice) > 0 && Number(form.stopLossPrice) > 0
      ? Math.abs(Number(form.entryPrice) - Number(form.stopLossPrice)) / pipSize
      : 0;
    const pips = explicitPips > 0 ? explicitPips : derivedPips;
    const currency = normalizeCurrency(account.baseCurrency);
    const equity = Number(account.balance || 0) + (account.trades || []).reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const riskPct = Number(form.riskPct);
    const riskAmount = equity * riskPct / 100;
    const quotePipValue = 100000 * pipSize;
    const hasDirectQuote = quoteCurrency === currency;
    const hasBaseConversion = baseCurrency === currency && Number(form.entryPrice) > 0;
    const exactPipValue = hasDirectQuote || hasBaseConversion;
    const pipValue = hasDirectQuote ? quotePipValue : hasBaseConversion ? quotePipValue / Number(form.entryPrice) : 10;
    const lots = pips > 0 && riskAmount > 0 && pipValue > 0 ? riskAmount / (pips * pipValue) : 0;
    return { currency, baseCurrency, quoteCurrency, pips, pipValue, riskPct, riskAmount, lots, exactPipValue, supported: symbol.length === 6 && fxCurrencies.has(baseCurrency) && fxCurrencies.has(quoteCurrency) };
  }, [account, form.asset, form.entryPrice, form.riskPct, form.stopLossPips, form.stopLossPrice]);
  const completedRules = activeRules.filter((rule) => form.ruleEvaluations.some((entry) => entry.ruleId === rule.id && entry.checked)).length;
  const ruleRating = activeRules.length ? (completedRules / activeRules.length) * 2 : 0;
  const liveNetPnl = (Number(form.grossPnl) || 0) - (Number(form.commission) || 0) - (Number(form.swap) || 0);
  const resultRating = liveNetPnl > 0 ? 1 : liveNetPnl < 0 ? -1 : 0;
  const markupRating = form.premarketMarkupId ? 2 : 0;
  const mistakePenalty = form.mistakes.length;
  const calculatedRating = clamp(ruleRating + resultRating + markupRating - mistakePenalty, 0, 5);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleArr = (key, value) => setForm((current) => ({
    ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
  }));
  const setScreenshots = (session) => (updater) => setForm((current) => {
    const sessions = tradeImageSessions(current.screenshots);
    sessions[session] = updater(sessions[session]);
    return { ...current, screenshots: [...sessions.entry, ...sessions.exit] };
  });
  const toggleRule = (rule, checked) => setForm((current) => ({
    ...current,
    ruleEvaluations: [...current.ruleEvaluations.filter((entry) => entry.ruleId !== rule.id), { ruleId: rule.id, name: rule.text, checked }],
  }));
  const save = () => {
    if (!form.asset.trim() || form.grossPnl === "" || !form.time || timingError) return;
    const grossPnl = Number(form.grossPnl), commission = Number(form.commission) || 0, swap = Number(form.swap) || 0;
    if (!Number.isFinite(grossPnl)) return;
    const manualCTraderOpening = /Imported cTrader position #.*\[close-only\]/i.test(form.context || "") && !cTraderOpeningWasEnteredManually(form) && form.date && form.time;
    const context = manualCTraderOpening ? `${form.context} [opening-time:manual]` : form.context;
    onSave({ ...form, context, session: form.entrySession, types: form.confluence, confluenceSession: form.entryType, grossPnl, commission, swap, pnl: grossPnl - commission - swap, rr: parseFloat(form.rr) || 0, rating: calculatedRating });
  };
  const timingError = tradeTimingError(form);
  return <Modal title={editing ? "Edit Trade" : "Log Trade"} onClose={onClose} onConfirm={save} confirmDisabled={!form.asset.trim() || form.grossPnl === "" || !form.time || !!timingError} wide>
    {account?.positionSizeEnabled && <div className="tj-position-suggestion">
      <span>SUGGESTED POSITION SIZE</span>
      {positionSuggestion?.supported && positionSuggestion.lots > 0 ? <>
        <strong>{positionSuggestion.lots.toFixed(2)} <small>Lots</small></strong>
        <b>Risk: {fmtMoney(positionSuggestion.riskAmount, positionSuggestion.currency)} / {positionSuggestion.riskPct.toFixed(2)}% · {positionSuggestion.pips.toFixed(1)} pips</b>
        <em>Pip value: {fmtMoney(positionSuggestion.pipValue, positionSuggestion.currency)} / standard lot · {positionSuggestion.exactPipValue ? "Converted to your account currency" : "Standard FX estimate; add entry price for exact conversion"}</em>
      </> : <em>{!form.asset ? "Select a currency pair to calculate position size." : !positionSuggestion?.supported ? "Select a valid six-letter currency pair to calculate position size." : "Enter a stop loss in pips, or provide entry and stop prices."}</em>}
    </div>}
    <div className="tj-section-label">Trade Details</div>
    <div className="tj-grid2">
      <Field label="Instrument *"><InstrumentPicker value={form.asset} onChange={(value) => set("asset", value)} /></Field>
      <Field label="Direction"><select className="tj-input" value={form.direction} onChange={(event) => set("direction", event.target.value)}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></Field>
    </div>
    {account?.positionSizeEnabled && <>
      <div className="tj-grid2"><Field label="Risk %"><input type="number" min="0" step="0.1" className="tj-input" value={form.riskPct} onChange={(event) => set("riskPct", event.target.value)} /></Field><Field label="Stop Loss (Pips)"><input type="number" min="0" step="0.1" className="tj-input" placeholder="e.g. 12" value={form.stopLossPips} onChange={(event) => set("stopLossPips", event.target.value)} /></Field></div>
      <div className="tj-grid2"><Field label="Entry Price (optional)"><input type="number" min="0" step="any" className="tj-input" placeholder="For price conversion" value={form.entryPrice} onChange={(event) => set("entryPrice", event.target.value)} /></Field><Field label="Stop Loss Price (optional)"><input type="number" min="0" step="any" className="tj-input" placeholder="Derives pips if needed" value={form.stopLossPrice} onChange={(event) => set("stopLossPrice", event.target.value)} /></Field></div>
    </>}
    <div className="tj-trade-timing-row">
      <Field label="Open date *"><input type="date" value={form.date} onChange={event=>set('date',event.target.value)}/></Field>
      <Field label="Open time *"><input type="time" value={form.time} onChange={event=>set('time',event.target.value)}/></Field>
      <Field label="Close date *"><input type="date" required value={form.closeDate || ''} onChange={event=>set('closeDate',event.target.value)}/></Field>
      <Field label="Close time *"><input type="time" required value={form.closeTime || ''} onChange={event=>set('closeTime',event.target.value)}/></Field>
    </div>
    {timingError && <p role="alert" className="tj-trade-timing-error">{timingError}</p>}
    <div className="tj-grid2">
      <Field label={`Gross P&L (${activeMoneyCurrency}) *`}><input type="number" className="tj-input" placeholder="-50" value={form.grossPnl} onChange={(event) => set("grossPnl", event.target.value)} /></Field>
      <Field label={`Commission (${activeMoneyCurrency})`}><input type="number" className="tj-input" value={form.commission} onChange={(event) => set("commission", event.target.value)} /></Field>
    </div>
    <div className="tj-grid2">
      <Field label={`Swap (${activeMoneyCurrency})`}><input type="number" className="tj-input" value={form.swap} onChange={(event) => set("swap", event.target.value)} /></Field>
      <Field label="Entry Session"><select className="tj-input" value={form.entrySession} onChange={(event) => set("entrySession", event.target.value)}>{SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}</select></Field>
    </div>
    <div className="tj-grid2">
      <Field label={`Net P&L (${activeMoneyCurrency})`}><input className="tj-input" readOnly value={fmtMoney((Number(form.grossPnl) || 0) - (Number(form.commission) || 0) - (Number(form.swap) || 0))} /></Field>
      <Field label="RR"><input type="number" step="0.1" className="tj-input" placeholder="2.5" value={form.rr} onChange={(event) => set("rr", event.target.value)} /></Field>
    </div>
    <div className="tj-section-label">Entry Type &amp; Markup</div>
    <div className="tj-grid2">
      <Field label="Entry Type"><select className="tj-input" value={form.entryType} onChange={(event) => set("entryType", event.target.value)}><option value="">None</option>{confluenceSessions.map((entryType) => <option key={entryType} value={entryType}>{entryType}</option>)}</select></Field>
      <Field label="Markup"><select className="tj-input" value={form.premarketMarkupId || ""} onChange={(event) => set("premarketMarkupId", event.target.value || null)}><option value="">None</option>{recentMarkups.map((markup) => <option key={markup.id} value={markup.id}>{markup.date} · {markup.instrument || markup.market || "Untitled"} · {markup.bias || "No bias"}</option>)}</select></Field>
    </div>
    <div className="tj-section-label">Confluence</div>
    <TagPicker options={typeTags} selected={form.confluence} onToggle={(value) => toggleArr("confluence", value)} color="purple" />
    <div className="tj-section-label">Mistakes</div>
    <TagPicker options={mistakeTags} selected={form.mistakes} onToggle={(value) => toggleArr("mistakes", value)} color="red" />
    <div className="tj-section-label">Rule Evaluation</div>
    <div className="tj-rating-summary"><div><div className="tj-field-label">Trade Rating</div><RatingDisplay value={calculatedRating} showValue /></div><div className="tj-rating-completion">Rules {ruleRating.toFixed(2)}/2 · Result {resultRating > 0 ? "+1" : resultRating < 0 ? "−1" : "0"} · Markup {markupRating ? "+2" : "0"} · Mistakes −{mistakePenalty}</div></div>
    {activeRules.length ? <>
      <div className="tj-rule-list">{activeRules.map((rule) => { const current = form.ruleEvaluations.find((entry) => entry.ruleId === rule.id); return <label key={rule.id} className="tj-rule-row"><span>{rule.text}</span><input type="checkbox" checked={!!current?.checked} onChange={(event) => toggleRule(rule, event.target.checked)} /></label>; })}</div>
    </> : <div className="tj-empty">No rules configured. Rule contribution is 0/2 stars.</div>}
    <div className="tj-section-label">Psychology</div>
    <div className="tj-grid2"><Field label="Before"><select className="tj-input" value={form.moodBefore} onChange={(event) => set("moodBefore", event.target.value)}>{MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}</select></Field><Field label="After"><select className="tj-input" value={form.moodAfter} onChange={(event) => set("moodAfter", event.target.value)}>{MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}</select></Field></div>
    <div className="tj-grid2 tj-trade-image-sessions">
      <div><div className="tj-field-label">Entry</div><ScreenshotUploader screenshots={tradeImageSessions(form.screenshots).entry} onChange={setScreenshots("entry")} /></div>
      <div><div className="tj-field-label">Exit</div><ScreenshotUploader screenshots={tradeImageSessions(form.screenshots).exit} onChange={setScreenshots("exit")} /></div>
    </div>
    <Field label="Notes"><textarea className="tj-input tj-textarea" placeholder="Context..." value={form.context} onChange={(event) => set("context", event.target.value)} /></Field>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>Save</button></div>
  </Modal>;
}

/* ============================ ACCOUNT MODALS =========================== */

function AccountSettingsNumberField({ label, value, onChange, placeholder, hint, step = "0.1" }) {
  return <Field label={label}>
    <input type="number" min="0" step={step} className="tj-input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    {hint && <div className="tj-muted-txt tj-settings-hint">{hint}</div>}
  </Field>;
}

function LinkedPercentageAmountCards({ label, currency, percentage, amount, onPercentageChange, onAmountChange }) {
  return <>
    <AccountSettingsNumberField label={`${label} (%)`} value={percentage} onChange={onPercentageChange} />
    <AccountSettingsNumberField label={`${label} (${currency || "Currency"})`} value={amount} onChange={onAmountChange} step="0.01" />
  </>;
}

function AccountSettingsSection({ title, children, note, status, icon, danger = false, isOpen, onToggle }) {
  return <section className={`tj-settings-section ${danger ? "tj-settings-section-danger" : ""}`}>
    <button type="button" className="tj-settings-section-head" onClick={onToggle} aria-expanded={isOpen}>
      <span className="tj-settings-section-title">{icon && <i>{icon}</i>}<span><strong>{title}</strong>{note && <small>{note}</small>}</span></span><span className="tj-settings-section-end">{status && <em>{status}</em>}<ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none" }} /></span>
    </button>
    {isOpen && <div className="tj-settings-section-body">{children}</div>}
  </section>;
}

function AccountSettingsModal({ account, onClose, onSave, onDelete, onImport, challenge }) {
  const [name, setName] = useState(account.name);
  const [challengeDraft, setChallengeDraft] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const draftChallenge = {
    ...challenge, saving: savingSettings,
    state: challengeDraft ? {...challenge.state, activeLevel: challengeDraft.level, automation: {...challenge.state.automation, mode: challengeDraft.mode}} : challenge.state,
    setMode: mode => setChallengeDraft(current => ({mode, level: current?.level ?? challenge.state.activeLevel})),
    setLevel: level => setChallengeDraft(current => ({level, mode: current ? current.mode : challenge.state.automation?.mode ?? null}))
  };
  const [balance, setBalance] = useState(account.balance);
  const [platform, setPlatform] = useState(account.platform || "Manual");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState("");
  const [importingTrades, setImportingTrades] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [beCap, setBeCap] = useState(account.breakevenCap);
  const [defaultCommission, setDefaultCommission] = useState(account.defaultCommission || 0);
  const [monthlyGoalPct, setMonthlyGoalPct] = useState(account.monthlyGoalPct || 0);
  const [yearlyGoalPct, setYearlyGoalPct] = useState(account.yearlyGoalPct || 0);
  const [monthlyGoalAmount, setMonthlyGoalAmount] = useState(account.monthlyGoalSource === "amount" ? (account.monthlyGoalAmount || "") : (Number(account.balance || 0) * Number(account.monthlyGoalPct || 0) / 100 || ""));
  const [yearlyGoalAmount, setYearlyGoalAmount] = useState(account.yearlyGoalSource === "amount" ? (account.yearlyGoalAmount || "") : (Number(account.balance || 0) * Number(account.yearlyGoalPct || 0) / 100 || ""));
  const [monthlyGoalSource, setMonthlyGoalSource] = useState(account.monthlyGoalSource === "amount" ? "amount" : "percentage");
  const [yearlyGoalSource, setYearlyGoalSource] = useState(account.yearlyGoalSource === "amount" ? "amount" : "percentage");
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState(account.dailyLossLimitPct || 0);
  const [monthlyLossLimitPct, setMonthlyLossLimitPct] = useState(account.monthlyLossLimitPct || 0);
  const [positionSizeEnabled, setPositionSizeEnabled] = useState(!!account.positionSizeEnabled);
  const [challengeEnabled, setChallengeEnabled] = useState(isChallengeEnabled(account));
  const [challengeStartingBalance, setChallengeStartingBalance] = useState(account.challengeStartingBalance || "");
  const [baseCurrency, setBaseCurrency] = useState(account.baseCurrency || "");
  const [defaultRiskPct, setDefaultRiskPct] = useState(account.defaultRiskPct || 1);
  const [defaultStopLossPips, setDefaultStopLossPips] = useState(account.defaultStopLossPips || "");
  const [financeEnabled, setFinanceEnabled] = useState(!!account.finance?.enabled);
  const [savingsDraft, setSavingsDraft] = useState(account.savingsAccounts || []);
  const [open, setOpen] = useState({ identity: false, defaults: false, goals: false, guardrails: false, challenge: false, finance: false, position: false, danger: false });
  const toggle = (section) => setOpen((current) => ({ ...current, [section]: !current[section] }));
  const goalsEnabled = Number(monthlyGoalPct) > 0 || Number(yearlyGoalPct) > 0;
  const guardrailsEnabled = Number(dailyLossLimitPct) > 0 || Number(monthlyLossLimitPct) > 0;
  const accountBase = Number(balance) || 0;
  const moneyFromPercentage = (percentage, base) => Number(percentage) > 0 && base > 0 ? Number((Number(percentage) * base / 100).toFixed(2)) : "";
  const percentageFromMoney = (amount, base) => Number(amount) > 0 && base > 0 ? Number((Number(amount) / base * 100).toFixed(4)) : "";
  const monthlyTarget = monthlyGoalSource === "amount" ? Number(monthlyGoalAmount) || 0 : accountBase * (Number(monthlyGoalPct) || 0) / 100;
  const yearlyTarget = yearlyGoalSource === "amount" ? Number(yearlyGoalAmount) || 0 : accountBase * (Number(yearlyGoalPct) || 0) / 100;
  const guardrailBase = Math.max(0, Number(financeTotals({ ...account, balance: accountBase }).tradingBalance) || accountBase);
  const dailyLimit = guardrailBase * (Number(dailyLossLimitPct) || 0) / 100;
  const monthlyLimit = guardrailBase * (Number(monthlyLossLimitPct) || 0) / 100;
  const setMonthlyGoalPercentage = (value) => { setMonthlyGoalPct(value); setMonthlyGoalAmount(moneyFromPercentage(value, accountBase)); setMonthlyGoalSource("percentage"); };
  const setYearlyGoalPercentage = (value) => { setYearlyGoalPct(value); setYearlyGoalAmount(moneyFromPercentage(value, accountBase)); setYearlyGoalSource("percentage"); };
  const setMonthlyGoalMoney = (value) => { setMonthlyGoalAmount(value); setMonthlyGoalPct(percentageFromMoney(value, accountBase)); setMonthlyGoalSource("amount"); };
  const setYearlyGoalMoney = (value) => { setYearlyGoalAmount(value); setYearlyGoalPct(percentageFromMoney(value, accountBase)); setYearlyGoalSource("amount"); };
  const setDailyLossMoney = (value) => setDailyLossLimitPct(percentageFromMoney(value, guardrailBase));
  const setMonthlyLossMoney = (value) => setMonthlyLossLimitPct(percentageFromMoney(value, guardrailBase));
  const setStartingBalance = (value) => {
    const nextBase = Number(value) || 0;
    setBalance(value);
    if (monthlyGoalSource === "amount") setMonthlyGoalPct(percentageFromMoney(monthlyGoalAmount, nextBase)); else setMonthlyGoalAmount(moneyFromPercentage(monthlyGoalPct, nextBase));
    if (yearlyGoalSource === "amount") setYearlyGoalPct(percentageFromMoney(yearlyGoalAmount, nextBase)); else setYearlyGoalAmount(moneyFromPercentage(yearlyGoalPct, nextBase));
  };
  const saveSettings = async () => {
    if (!name.trim() || !baseCurrency || savingSettings) return;
    setSavingSettings(true);
    try {
    await onSave({ ...account, challengeEnabled: isChallengeEnabled({ challengeEnabled, challengeStartingBalance }), challengeStartingBalance: Number(challengeStartingBalance) > 0 ? Number(challengeStartingBalance) : 0, financeEnabled, platform, name: name.trim() || "Main Account", icon: baseCurrency, balance: parseFloat(balance) || 0, breakevenCap: parseFloat(beCap) || 0, defaultCommission: parseFloat(defaultCommission) || 0, monthlyGoalPct: parseFloat(monthlyGoalPct) || 0, yearlyGoalPct: parseFloat(yearlyGoalPct) || 0, monthlyGoalAmount: parseFloat(monthlyGoalAmount) || 0, yearlyGoalAmount: parseFloat(yearlyGoalAmount) || 0, monthlyGoalSource, yearlyGoalSource, dailyLossLimitPct: parseFloat(dailyLossLimitPct) || 0, monthlyLossLimitPct: parseFloat(monthlyLossLimitPct) || 0, positionSizeEnabled, baseCurrency, defaultRiskPct: parseFloat(defaultRiskPct) || 0, defaultStopLossPips: parseFloat(defaultStopLossPips) || 0 }, challengeDraft, { enabled: financeEnabled, savingsAccounts: savingsDraft });
    } finally { setSavingSettings(false); }
  };
  return (
    <Modal title={<span className="tj-symbol-title"><NavSymbol src={accountSettingsSymbol} />Account Settings</span>} onClose={() => { if (!savingSettings) onClose(); }} onConfirm={saveSettings} confirmDisabled={!name.trim() || !baseCurrency || savingSettings || (challengeEnabled && challenge.loading && !challenge.error)} wide>
      <div className="tj-settings-account-hero tj-settings-account-hero-no-avatar">
        <div className="tj-settings-hero-copy"><span>ACCOUNT CONTROL CENTER</span><strong>{name.trim() || "Main Account"}</strong><p>Build the account once, then let goals and guardrails carry through the dashboard, analytics, and daily workflow.</p></div>
        <div className="tj-settings-hero-metrics"><div className="tj-settings-balance-tile"><small>STARTING BALANCE</small><b>{fmtMoneyShort(accountBase, baseCurrency)}</b><span>Account base</span></div><div className={`tj-settings-month-goal ${goalsEnabled ? "tj-settings-goal-on" : ""}`}><small>MONTHLY GOAL</small><b>{monthlyGoalPct ? fmtMoneyShort(monthlyTarget, baseCurrency) : "Optional"}</b><span>{monthlyGoalPct ? `+${Number(monthlyGoalPct).toFixed(2)}% target` : "Not set"}</span></div><div className={`tj-settings-year-goal ${goalsEnabled ? "tj-settings-goal-on" : ""}`}><small>YEARLY GOAL</small><b>{yearlyGoalPct ? fmtMoneyShort(yearlyTarget, baseCurrency) : "Optional"}</b><span>{yearlyGoalPct ? `+${Number(yearlyGoalPct).toFixed(2)}% target` : "Not set"}</span></div><div className={`tj-settings-daily-loss ${guardrailsEnabled ? "tj-settings-risk-on" : ""}`}><small>DAILY LOSS</small><b>{dailyLossLimitPct ? fmtMoneyShort(-dailyLimit, baseCurrency) : "Optional"}</b><span>{dailyLossLimitPct ? `${Number(dailyLossLimitPct).toFixed(2)}% cap` : "Not set"}</span></div><div className={`tj-settings-month-loss ${guardrailsEnabled ? "tj-settings-risk-on" : ""}`}><small>MONTHLY LOSS</small><b>{monthlyLossLimitPct ? fmtMoneyShort(-monthlyLimit, baseCurrency) : "Optional"}</b><span>{monthlyLossLimitPct ? `${Number(monthlyLossLimitPct).toFixed(2)}% cap` : "Not set"}</span></div></div>
      </div>
      <AccountSettingsSection title="Identity & Account Currency" icon={<ImagePlus size={15}/>} note="Set the account name, starting balance, and currency used across every page." isOpen={open.identity} onToggle={() => toggle("identity")}>
        <div className="tj-grid2"><Field label="Display Name"><input className="tj-input" value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Trading platform"><select className="tj-input" value={platform} onChange={(event) => setPlatform(event.target.value)}><option>Manual</option><option>MetaTrader 4/5</option><option>cTrader</option></select></Field></div><Field label={`Starting Balance (${baseCurrency || "Currency"})`}><input type="number" min="0" className="tj-input" value={balance} onChange={(e) => setStartingBalance(e.target.value)} /></Field>
        <Field label="Import trade history"><input className="tj-input" type="file" accept=".html,.htm,.csv,.txt,.tsv" onChange={async (event) => { const file = event.target.files?.[0] || null; setImportFile(file); setImportError(""); setImportPreview([]); setImportProgress(0); if (!file) return; const parsed = await parseBrokerFile(file); if (!parsed.trades.length) setImportError("No completed BUY or SELL trades were found in this file."); else setImportPreview(parsed); }} />{importFile && <div className="tj-settings-hint">{importFile.name}{importPreview.trades?.length ? ` · ${importPreview.trades.length} trades ready${importPreview.cashMovements?.length ? ` · ${importPreview.cashMovements.length} cash movement${importPreview.cashMovements.length === 1 ? "" : "s"}` : ""}` : ""}</div>}{importError && <div className="tj-import-error">{importError}</div>}{importPreview.trades?.length > 0 && <button type="button" className="tj-btn-primary tj-btn-small tj-import-button" disabled={importingTrades} onClick={async () => { setImportingTrades(true); setImportProgress(0); const ok = await onImport(importPreview, setImportProgress); if (ok) { setImportFile(null); setImportPreview([]); } setImportingTrades(false); }}>{importingTrades ? <><i className="tj-import-progress" style={{ "--progress": `${importProgress}%` }}>{importProgress}%</i>Importing trades</> : `Import ${importPreview.trades.length} trades now`}</button>}</Field>
        <Field label="Account Base Currency *"><select required className="tj-input" value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}><option value="" disabled>Select a currency</option>{ACCOUNT_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.label} ({currency.symbol})</option>)}</select></Field>
      </AccountSettingsSection>
      <AccountSettingsSection title="Journal Defaults" icon={<DollarSign size={15}/>} note="Tune how new trades are graded and pre-filled across the journal." status={`B/E ${fmtMoneyShort(Number(beCap) || 0, baseCurrency)} · Fee ${fmtMoneyShort(Number(defaultCommission) || 0, baseCurrency)}`} isOpen={open.defaults} onToggle={() => toggle("defaults")}>
        <div className="tj-grid2"><Field label={`Breakeven Cap (${baseCurrency || "Currency"})`}><input type="number" min="0" className="tj-input" value={beCap} onChange={(e) => setBeCap(e.target.value)} /><div className="tj-chip-row">{[0, 10, 20, 35, 50].map((v) => <button type="button" key={v} className={`tj-chip ${Number(beCap) === v ? "tj-chip-active" : ""}`} onClick={() => setBeCap(v)}>{fmtMoneyShort(v, baseCurrency)}</button>)}</div></Field><Field label={`Default Commission (${baseCurrency || "Currency"} per trade)`}><input type="number" min="0" className="tj-input" value={defaultCommission} onChange={(e) => setDefaultCommission(e.target.value)} /></Field></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Goals" icon={<Trophy size={15}/>} note="Optional monthly and yearly targets that appear in analytics and review summaries." status={goalsEnabled ? "Active" : "Optional"} isOpen={open.goals} onToggle={() => toggle("goals")}>
        <div className="tj-grid4 tj-settings-linked-grid"><LinkedPercentageAmountCards label="Monthly Growth Goal" currency={baseCurrency} percentage={monthlyGoalPct} amount={monthlyGoalAmount} onPercentageChange={setMonthlyGoalPercentage} onAmountChange={setMonthlyGoalMoney} /><LinkedPercentageAmountCards label="Yearly Growth Goal" currency={baseCurrency} percentage={yearlyGoalPct} amount={yearlyGoalAmount} onPercentageChange={setYearlyGoalPercentage} onAmountChange={setYearlyGoalMoney} /></div><div className="tj-settings-info-grid"><div><small>WHAT THIS POWERS</small><span>Monthly pacing and yearly runway appear throughout analytics.</span></div><div><small>LINKED VALUES</small><span>Type either percentage or amount; the matching value updates immediately.</span></div></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Risk Guardrails" icon={<ShieldCheck size={15}/>} note="Optional loss caps that pause trade execution once the limit is hit." status={guardrailsEnabled ? "Active" : "Off"} isOpen={open.guardrails} onToggle={() => toggle("guardrails")}>
        <div className="tj-grid4 tj-settings-linked-grid"><LinkedPercentageAmountCards label="Daily Loss Limit" currency={baseCurrency} percentage={dailyLossLimitPct} amount={dailyLimit ? Number(dailyLimit.toFixed(2)) : ""} onPercentageChange={setDailyLossLimitPct} onAmountChange={setDailyLossMoney} /><LinkedPercentageAmountCards label="Monthly Loss Limit" currency={baseCurrency} percentage={monthlyLossLimitPct} amount={monthlyLimit ? Number(monthlyLimit.toFixed(2)) : ""} onPercentageChange={setMonthlyLossLimitPct} onAmountChange={setMonthlyLossMoney} /></div><div className="tj-settings-reset-grid"><div><small>DAILY RESET</small><strong>Next day</strong><span>Stops revenge-trading after a bad session.</span></div><div><small>MONTHLY RESET</small><strong>Next month</strong><span>Caps deeper drawdowns before they compound.</span></div></div><div className="tj-settings-info-block"><small>WHAT THIS LOCKS</small><span>Loss limits recalculate from current trading balance. Once reached, calendar drill-down and new trade logging pause until the reset window opens. Markups remain available.</span></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Challenge" icon={<Trophy size={15}/>} note="Build a compounding plan from your own starting amount." status={challengeEnabled && Number(challengeStartingBalance) > 0 ? "On" : "Off"} isOpen={open.challenge} onToggle={() => toggle("challenge")}>
        <Field label={`Challenge starting balance (${baseCurrency || "USD"})`}><input className="tj-input" type="number" min="0.01" step="any" placeholder="Enter a starting amount" value={challengeStartingBalance} onChange={event => { setChallengeStartingBalance(event.target.value); if (!(Number(event.target.value) > 0)) setChallengeEnabled(false); }}/></Field>
        <label className="tj-settings-switch-row"><button type="button" role="switch" aria-label="Enable Challenge" aria-checked={challengeEnabled && Number(challengeStartingBalance) > 0} disabled={!(Number(challengeStartingBalance) > 0)} className={`tj-settings-switch ${challengeEnabled && Number(challengeStartingBalance) > 0 ? "tj-settings-switch-on" : ""}`} onClick={() => setChallengeEnabled(value => !value)}><i/></button><span><strong>Enable Challenge</strong><small>Enter a positive balance, then switch on. Leaving the balance blank keeps Challenge off.</small></span></label>
        <ChallengeModeSettings challenge={draftChallenge} enabled={challengeEnabled && Number(challengeStartingBalance) > 0}/>
      </AccountSettingsSection>
      <AccountSettingsSection title="Finance" icon={<Landmark size={15}/>} note="Track account cash movement and savings without mixing it into trade statistics." status={financeEnabled ? `${savingsDraft.length} savings account${savingsDraft.length === 1 ? "" : "s"}` : "Off"} isOpen={open.finance} onToggle={() => toggle("finance")}>
        <label className="tj-settings-switch-row"><button type="button" role="switch" aria-label="Enable Finance" aria-checked={financeEnabled} className={`tj-settings-switch ${financeEnabled ? "tj-settings-switch-on" : ""}`} onClick={() => setFinanceEnabled((enabled) => !enabled)}><i /></button><span><strong>Enable Finance</strong><small>Show Finance for this trading account. Turning it off keeps your settings and history saved.</small></span></label>
        {financeEnabled && <><div className="tj-finance-settings-list">{savingsDraft.map((saving, index) => <section key={saving.id} className="tj-finance-settings-account"><div className="tj-finance-settings-account-head"><strong>Savings account {index + 1}</strong><ConfirmDeleteButton type="button" className="tj-btn-danger-outline tj-btn-small" onClick={() => setSavingsDraft((items) => items.filter((item) => item.id !== saving.id))}><Trash2 size={13}/> Delete</ConfirmDeleteButton></div><div className="tj-grid2"><Field label="Savings account name"><input className="tj-input" value={saving.name} onChange={(event) => setSavingsDraft((items) => items.map((item) => item.id === saving.id ? {...item, name:event.target.value} : item))}/></Field><Field label={`Savings target (${baseCurrency || "Currency"})`}><input type="number" min="0" className="tj-input" value={saving.target} onChange={(event) => setSavingsDraft((items) => items.map((item) => item.id === saving.id ? {...item, target:event.target.value} : item))}/></Field></div><div className="tj-grid2"><Field label="Profit allocation (%)"><input type="number" min="0" max="100" className="tj-input" value={saving.allocationPct} onChange={(event) => setSavingsDraft((items) => items.map((item) => item.id === saving.id ? {...item, allocationPct:event.target.value} : item))}/></Field><Field label="Transfer interval"><select className="tj-input" value={saving.interval} onChange={(event) => setSavingsDraft((items) => items.map((item) => item.id === saving.id ? {...item, interval:event.target.value} : item))}><option>Manual</option><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option></select></Field></div></section>)}</div>
        <button type="button" className="tj-btn-outline tj-btn-small" onClick={() => setSavingsDraft((items) => [...items, {id:`draft-${uid()}`,name:"Savings",target:0,allocationPct:0,interval:"Manual"}])}><Plus size={14}/> Add savings account</button></>}
      </AccountSettingsSection>
      <AccountSettingsSection title="Position Size Calculator" icon={<DollarSign size={15}/>} note="Optional risk-based lot sizing for new trades." status={positionSizeEnabled ? "Enabled" : "Off"} isOpen={open.position} onToggle={() => toggle("position")}>
        <label className="tj-settings-switch-row"><button type="button" role="switch" aria-checked={positionSizeEnabled} className={`tj-settings-switch ${positionSizeEnabled ? "tj-settings-switch-on" : ""}`} onClick={() => setPositionSizeEnabled((enabled) => !enabled)}><i /></button><span><strong>Enable Position Size Calculator</strong><small>Show live risk-based lot suggestions in Log Trade.</small></span></label><div className="tj-grid2"><Field label="Default Risk % Per Trade"><input type="number" min="0" step="0.1" className="tj-input" disabled={!positionSizeEnabled} value={defaultRiskPct} onChange={(event) => setDefaultRiskPct(event.target.value)} /></Field><Field label="Default Stop Loss (Pips)"><input type="number" min="0" className="tj-input" disabled={!positionSizeEnabled} value={defaultStopLossPips} placeholder="Optional" onChange={(event) => setDefaultStopLossPips(event.target.value)} /></Field></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Danger Zone" icon={<Trash2 size={15}/>} danger isOpen={open.danger} onToggle={() => toggle("danger")}>
        <div className="tj-settings-danger-action"><span><strong>Delete Account</strong><small>This permanently deletes this account and all of its trades, markups, reviews, and history.</small></span><ConfirmDeleteButton type="button" className="tj-btn-danger-outline" onClick={() => onDelete(account)}><Trash2 size={14}/> Delete Account</ConfirmDeleteButton></div>
      </AccountSettingsSection>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" onClick={onClose}>Cancel</button>
        <button className="tj-btn-primary" disabled={!name.trim() || !baseCurrency || savingSettings || (challengeEnabled && challenge.loading && !challenge.error)} title={!baseCurrency ? "Choose an account base currency before saving" : ""} onClick={saveSettings}>{savingSettings ? "Saving…" : "Save Settings"}</button>
      </div>
    </Modal>
  );
}

function ProfileSettingsModal({ user, account, themeValue, onClose, onSave }) {
  const fallbackName = user.user_metadata?.display_name || user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Trader");
  const existingPhoto = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const [fullName, setFullName] = useState(fallbackName);
  const [profileImage, setProfileImage] = useState(existingPhoto);
  const [theme, setTheme] = useState(themeValue || user.user_metadata?.theme || account.theme || "dark");
  const savedTimeout = Number(user.user_metadata?.session_timeout_minutes);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(Number.isFinite(savedTimeout) ? savedTimeout : 90);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const photoRef = useRef(null);
  const initials = fullName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
  const uploadProfile = async (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try { setProfileImage(await resizeProfileImage(file)); } catch (error) { /* keep the current photo */ }
  };
  const save = async () => {
    if (!fullName.trim() || saving) return;
    setSaving(true);
    const saved = await onSave({ displayName: fullName.trim(), avatarUrl: profileImage, theme, sessionTimeoutMinutes });
    if (!saved) setSaving(false);
  };
  const changePassword = async () => {
    if (newPassword.length < 6) return setPasswordStatus({ type: "error", text: "Password must be at least 6 characters." });
    if (newPassword !== confirmPassword) return setPasswordStatus({ type: "error", text: "Passwords do not match." });
    setChangingPassword(true);
    setPasswordStatus(null);
    const result = await updatePassword(newPassword);
    setChangingPassword(false);
    if (result.error) return setPasswordStatus({ type: "error", text: result.error });
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatus({ type: "success", text: "Password changed successfully." });
  };
  return (
    <Modal title={<span className="tj-symbol-title"><NavSymbol src={profileSettingsSymbol} />Profile</span>} onClose={onClose} onConfirm={save} confirmDisabled={saving || !fullName.trim()} wide>
      <div className="tj-personal-profile-card">
        <div className="tj-personal-profile-heading"><div><span>PERSONAL INFORMATION</span><strong>Profile settings</strong><p>Your name, photo, and display preference follow your signed-in profile.</p></div></div>
        <div className="tj-personal-profile-photo-row">
          <button type="button" className="tj-personal-profile-avatar" onClick={() => photoRef.current?.click()} aria-label="Change profile photo">{profileImage ? <img src={profileImage} alt="Profile" /> : <span>{initials}</span>}<i><ImagePlus size={14} /></i></button>
          <div><strong>{fullName.trim() || "Your name"}</strong><div className="tj-chip-row"><button type="button" className="tj-btn-outline tj-btn-small" onClick={() => photoRef.current?.click()}>Change photo</button>{profileImage && <ConfirmDeleteButton type="button" className="tj-btn-outline tj-btn-small" onClick={async () => { setProfileImage(""); }}>Remove photo</ConfirmDeleteButton>}</div></div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { uploadProfile(event.target.files); event.target.value = ""; }} />
        </div>
        <div className="tj-personal-profile-fields">
          <Field label="Full Name"><input className="tj-input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" /></Field>
          <Field label="Email Address"><input className="tj-input" value={user.email || ""} readOnly /><button type="button" className="tj-password-link" aria-expanded={passwordOpen} onClick={() => { setPasswordOpen((open) => !open); setPasswordStatus(null); }}>Change password</button>{passwordOpen && <div className="tj-password-editor"><input type="password" className="tj-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" autoComplete="new-password" /><input type="password" className="tj-input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" autoComplete="new-password" onKeyDown={(event) => event.key === "Enter" && changePassword()} /><button type="button" className="tj-btn-primary tj-btn-small" disabled={changingPassword} onClick={changePassword}>{changingPassword ? "Changing…" : "Update password"}</button>{passwordStatus && <span className={passwordStatus.type === "error" ? "tj-red" : "tj-green"}>{passwordStatus.text}</span>}</div>}</Field>
        </div>
      </div>
      <section className="tj-personal-appearance-card">
        <div className="tj-personal-section-title"><div><strong>Appearance</strong><span>Choose the surface that is most comfortable for you.</span></div><em>{theme === "light" ? "Light" : "Dark"}</em></div>
        <div className="tj-theme-choice-row"><button type="button" aria-pressed={theme === "dark"} className={`tj-theme-choice ${theme === "dark" ? "tj-chip-active" : ""}`} onClick={() => setTheme("dark")}><span>Dark</span><small>Low-light focus</small></button><button type="button" aria-pressed={theme === "light"} className={`tj-theme-choice ${theme === "light" ? "tj-chip-active" : ""}`} onClick={() => setTheme("light")}><span>Light</span><small>Bright daytime workspace</small></button></div>
      </section>
      <section className="tj-personal-appearance-card tj-personal-security-card">
        <div className="tj-personal-section-title"><div><strong>Session &amp; Security</strong></div><em>{sessionTimeoutMinutes === 90 ? "1h 30m" : "No timeout"}</em></div>
        <div className="tj-theme-choice-row"><button type="button" aria-pressed={sessionTimeoutMinutes === 90} className={`tj-theme-choice ${sessionTimeoutMinutes === 90 ? "tj-chip-active" : ""}`} onClick={() => setSessionTimeoutMinutes(90)}><span>1h 30m</span><small>Automatic sign-out</small></button><button type="button" aria-pressed={sessionTimeoutMinutes === 0} className={`tj-theme-choice ${sessionTimeoutMinutes === 0 ? "tj-chip-active" : ""}`} onClick={() => setSessionTimeoutMinutes(0)}><span>Stay signed in</span><small>No inactivity timeout</small></button></div>
      </section>
      <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" disabled={saving || !fullName.trim()} onClick={save}>{saving ? "Saving…" : "Save Profile"}</button></div>
    </Modal>
  );
}

function ListManager({ title, items, onSave, note }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);
  const add = () => { const v=value.trim(); if(v && !items.some((x)=>x.toLowerCase()===v.toLowerCase())) { onSave([...items,v]); setValue(""); } };
  const remove = async (v) => { onSave(items.filter((x) => x !== v)); };
  const rename = (old) => { const next=(editing || "").trim(); if(next && !items.some(x=>x !== old && x.toLowerCase()===next.toLowerCase())) onSave(items.map(x=>x===old?next:x)); setEditing(null); };
  return <Card className="tj-panel"><div className="tj-bold" style={{fontSize: 17.28}}>{title}</div><div className="tj-muted-txt" style={{fontSize: 14,margin:"5px 0 12px"}}>{note}</div><div className="tj-inline-add"><input className="tj-input" value={value} placeholder={`Add ${title.toLowerCase()}...`} onChange={(e)=>setValue(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} /><button className="tj-btn-primary" onClick={add}>Add</button></div><div className="tj-rule-list" style={{marginTop:12}}>{items.length?items.map((x)=><div className="tj-rule-row" key={x}>{editing !== null && editing.old === x ? <input autoFocus className="tj-input" value={editing.value} onChange={(e)=>setEditing({...editing,value:e.target.value})} onKeyDown={(e)=>e.key==="Enter"&&rename(x)} /> : <span>{x}</span>}<span><button className="tj-icon-btn" title="Edit" onClick={()=>editing?.old===x?rename(x):setEditing({old:x,value:x})}><Pencil size={14}/></button><ConfirmDeleteButton className="tj-icon-btn" title="Remove" onClick={()=>remove(x)}><Trash2 size={14}/></ConfirmDeleteButton></span></div>):<div className="tj-empty">Nothing added yet.</div>}</div></Card>;
}

function InstrumentManager({ instruments, onSave }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);
  const isDefault = (instrument) => DEFAULT_INSTRUMENTS.some((item) => item.toLowerCase() === instrument.toLowerCase());
  const add = () => { const next = value.trim(); if (!next || isDefault(next) || instruments.some((item) => item.toLowerCase() === next.toLowerCase())) return; onSave([...instruments, next]); setValue(""); };
  const rename = (old) => { const next = editing?.value?.trim(); if (!next || isDefault(next) || instruments.some((item) => item !== old && item.toLowerCase() === next.toLowerCase())) return setEditing(null); onSave(instruments.map((item) => item === old ? next : item)); setEditing(null); };
  const available = [...DEFAULT_INSTRUMENTS, ...instruments.filter((instrument) => !isDefault(instrument))];
  return <Card className="tj-panel tj-instrument-manager"><div className="tj-bold" style={{fontSize: 17.28}}>Instrument Management</div><div className="tj-muted-txt" style={{fontSize: 14,margin:"5px 0 12px"}}>Controls the instrument list in Trade Logs and Premarket Markups.</div><div className="tj-inline-add"><input className="tj-input" value={value} placeholder="Add an instrument..." onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} /><button className="tj-btn-primary" onClick={add}>Add</button></div><div className="tj-management-list">{available.map((instrument) => { const fixed = isDefault(instrument); return <div className="tj-rule-row" key={instrument}>{editing?.old === instrument ? <input autoFocus className="tj-input" value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onKeyDown={(event) => event.key === "Enter" && rename(instrument)} /> : <span>{instrument}</span>}<span className="tj-management-row-actions">{fixed ? <em className="tj-management-default">Default</em> : <><button className="tj-icon-btn" title="Edit custom instrument" onClick={() => editing?.old === instrument ? rename(instrument) : setEditing({ old: instrument, value: instrument })}><Pencil size={14}/></button><ConfirmDeleteButton className="tj-icon-btn" title="Remove custom instrument" onClick={async () => { onSave(instruments.filter((item) => item !== instrument)); }}><Trash2 size={14}/></ConfirmDeleteButton></>}</span></div>; })}</div></Card>;
}

function MistakeManager({ mistakes, onSave }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(null);
  const isDefault = (mistake) => DEFAULT_MISTAKE_TAGS.some((item) => item.toLowerCase() === mistake.toLowerCase());
  const customMistakes = mistakes.filter((mistake) => !isDefault(mistake));
  const add = () => {
    const next = value.trim();
    if (!next || isDefault(next) || customMistakes.some((item) => item.toLowerCase() === next.toLowerCase())) return;
    onSave([...customMistakes, next]);
    setValue("");
  };
  const rename = (old) => {
    const next = editing?.value?.trim();
    if (!next || isDefault(next) || customMistakes.some((item) => item !== old && item.toLowerCase() === next.toLowerCase())) return setEditing(null);
    onSave(customMistakes.map((item) => item === old ? next : item));
    setEditing(null);
  };
  const available = allMistakeTags(customMistakes);
  return <Card className="tj-panel"><div className="tj-bold" style={{fontSize: 17.28}}>Mistake Management</div><div className="tj-muted-txt" style={{fontSize: 14,margin:"5px 0 12px"}}>Preset mistakes are available when logging a trade. Add your own below.</div><div className="tj-inline-add"><input className="tj-input" value={value} placeholder="Add a mistake..." onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} /><button className="tj-btn-primary" onClick={add}>Add</button></div><div className="tj-management-list">{available.map((mistake) => { const fixed = isDefault(mistake); return <div className="tj-rule-row" key={mistake}>{editing?.old === mistake ? <input autoFocus className="tj-input" value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} onKeyDown={(event) => event.key === "Enter" && rename(mistake)} /> : <span>{mistake}</span>}<span className="tj-management-row-actions">{fixed ? <em className="tj-management-default">Preset</em> : <><button className="tj-icon-btn" title="Edit custom mistake" onClick={() => editing?.old === mistake ? rename(mistake) : setEditing({ old: mistake, value: mistake })}><Pencil size={14}/></button><ConfirmDeleteButton className="tj-icon-btn" title="Remove custom mistake" onClick={() => onSave(customMistakes.filter((item) => item !== mistake))}><Trash2 size={14}/></ConfirmDeleteButton></>}</span></div>; })}</div></Card>;
}

function ManagementPage({ account, typeTags, mistakeTags, confluenceSessions, instruments, onTypeTags, onMistakes, onConfluence, onInstruments, onAddRule, onUpdateRule, onRemoveRule }) {
  return <div className="tj-management-workspace"><div className="tj-page-intro"><div><div className="tj-bold tj-management-title" style={{fontSize: 19.44}}><NavSymbol src={managementSettingsSymbol} />Management</div><div className="tj-muted-txt" style={{fontSize: 14}}>Manage the options available on future trades and markups. Historical records remain unchanged.</div></div></div><div className="tj-management-grid">
    <RulesPage account={account} onAddRule={onAddRule} onUpdateRule={onUpdateRule} onRemoveRule={onRemoveRule} />
    <InstrumentManager instruments={instruments} onSave={onInstruments} />
    <ListManager title="Confluence" items={typeTags} onSave={onTypeTags} note="Former tag records. Select one or more confluences while logging a trade." />
    <ListManager title="Entry Type" items={confluenceSessions} onSave={onConfluence} note="Former Confluence Session records. Drives Entry Type analytics and setup cards." />
    <MistakeManager mistakes={mistakeTags} onSave={onMistakes} />
  </div></div>;
}

function MarkupModal({ onClose, onSave, editing, instruments = [] }) {
  const [f,setF]=useState(() => {
    const base = { id: uid(), date:todayISO(), time:nowTime(), market:"", instrument:"", bias:"", status:"Planned", levels:"", structure:"", notes:"", sessionReview:{marketOutcome:"",waitedForConditions:"",outsidePlanReason:""}, screenshots:{preHTF:[],preH4:[],preM15:[],postH4:[],postM15:[]} };
    if (!editing) return base;
    return { ...base, ...editing, market: normalizeSession(editing.market || ""), time: editing.time || nowTime(), sessionReview:{...base.sessionReview,...(editing.sessionReview||{})}, screenshots: { ...base.screenshots, ...(editing.screenshots && !Array.isArray(editing.screenshots) ? editing.screenshots : {}) } };
  });
  const [sessionReviewOpen,setSessionReviewOpen]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setReview=(k,v)=>setF(x=>({...x,sessionReview:{...(x.sessionReview||{}),[k]:v}}));
  const setShots=(slot)=>(updater)=>setF(x=>({...x,screenshots:{...x.screenshots,[slot]:updater(x.screenshots[slot])}}));
  const save = () => { if (f.time) onSave(f); };
  return <Modal title={editing ? "Edit Premarket Markup" : "New Premarket Markup"} onClose={onClose} onConfirm={save} confirmDisabled={!f.time} wide>
    <div className="tj-markup-meta-row"><Field label="Date"><input type="date" className="tj-input" value={f.date} onChange={e=>set("date",e.target.value)}/></Field><Field label="Time *"><input type="time" required className="tj-input" value={f.time} onChange={e=>set("time",e.target.value)}/></Field><Field label="Session"><select className="tj-input" value={f.market} onChange={e=>set("market",e.target.value)}><option value="">Select session</option>{SESSIONS.map((session)=><option key={session} value={session}>{session}</option>)}</select></Field></div>
    <div className="tj-markup-pair-row"><Field label="Status"><select className="tj-input" value={f.status} onChange={e=>set("status",e.target.value)}>{["Planned","Watching","Executed","Passed"].map((status)=><option key={status} value={status}>{status}</option>)}</select></Field><Field label="Instrument"><InstrumentPicker value={f.instrument} onChange={(value) => set("instrument", value)} /></Field></div>
    <div className="tj-markup-section"><div className="tj-section-label">Pre-Session Analysis</div><div className="tj-markup-pair-row"><Field label="Bias"><select className="tj-input" value={f.bias} onChange={e=>set("bias",e.target.value)}><option value="">Select bias</option>{MARKUP_BIASES.map((bias)=><option key={bias} value={bias}>{bias}</option>)}</select></Field><Field label="Key levels, liquidity & zones"><input className="tj-input" value={f.levels} onChange={e=>set("levels",e.target.value)}/></Field></div><Field label="Market structure / narrative"><textarea className="tj-input tj-textarea" placeholder="HTF context, structure and key areas..." value={f.structure} onChange={e=>set("structure",e.target.value)}/></Field><div className="tj-grid3"><div><div className="tj-field-label">HTF chart</div><ScreenshotUploader max={2} captions screenshots={f.screenshots.preHTF} onChange={setShots("preHTF")}/></div><div><div className="tj-field-label">MTF chart</div><ScreenshotUploader max={2} captions screenshots={f.screenshots.preH4} onChange={setShots("preH4")}/></div><div><div className="tj-field-label">LTF chart</div><ScreenshotUploader max={2} captions screenshots={f.screenshots.preM15} onChange={setShots("preM15")}/></div></div></div>
    <div className="tj-markup-section"><div className="tj-section-label">Expectations</div><Field label="Core narrative / what am I expecting?"><textarea className="tj-input tj-textarea" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="What needs to happen for the idea to be valid? Include entry conditions and invalidation."/></Field></div>
    <div className="tj-markup-section"><div className="tj-section-label">Post-Session Markup</div><div className="tj-grid2"><div><div className="tj-field-label">MTF chart</div><ScreenshotUploader max={2} captions screenshots={f.screenshots.postH4} onChange={setShots("postH4")}/></div><div><div className="tj-field-label">LTF chart</div><ScreenshotUploader max={2} captions screenshots={f.screenshots.postM15} onChange={setShots("postM15")}/></div></div></div>
    <div className="tj-markup-session-review"><button type="button" className="tj-markup-session-review-toggle" aria-expanded={sessionReviewOpen} onClick={()=>setSessionReviewOpen(open=>!open)}><span><ChevronDown size={15} style={{transform:sessionReviewOpen?"rotate(0deg)":"rotate(-90deg)"}}/> Session Review</span></button>{sessionReviewOpen&&<div className="tj-markup-session-review-body"><Field label="Did the market play out as expected? If not, how did it differ?"><textarea className="tj-input tj-textarea" value={f.sessionReview?.marketOutcome||""} onChange={e=>setReview("marketOutcome",e.target.value)}/></Field><Field label="Did I wait for my key conditions before entering?"><textarea className="tj-input tj-textarea" value={f.sessionReview?.waitedForConditions||""} onChange={e=>setReview("waitedForConditions",e.target.value)}/></Field><Field label="If I took trades outside the plan, what drove that decision?"><textarea className="tj-input tj-textarea" value={f.sessionReview?.outsidePlanReason||""} onChange={e=>setReview("outsidePlanReason",e.target.value)}/></Field></div>}</div>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>{editing ? "Save Changes" : "Save Markup"}</button></div>
  </Modal>;
}
function MarkupsPage({ markups, trades, onNew, onEdit, onDelete }) {
  const [open,setOpen]=useState({});
  const slots = [["preHTF", "HTF"], ["preH4", "MTF"], ["preM15", "LTF"], ["postH4", "Post Market MTF"], ["postM15", "Post Market LTF"]];
  return <><div className="tj-rules-head"><div><div className="tj-bold" style={{fontSize: 17.28}}>Premarket Markups</div><div className="tj-muted-txt" style={{fontSize: 14}}>Prepare context before execution, then attach the resulting trades.</div></div><button className="tj-btn-primary" onClick={onNew}><Plus size={15}/> New Markup</button></div><div className="tj-tlog-list">{markups.length ? markups.map((markup) => {
    const linked=trades.filter((trade)=>trade.premarketMarkupId===markup.id), pnl=linked.reduce((sum,trade)=>sum+trade.pnl,0), expanded=!!open[markup.id];
    return <Card key={markup.id} className="tj-tlog-card"><div className="tj-tlog-row" onClick={()=>setOpen((state)=>({...state,[markup.id]:!state[markup.id]}))}><div className="tj-tlog-main"><div className="tj-tlog-asset">{markup.instrument||markup.market||"Untitled markup"} <span className="tj-sesspill">{markup.bias||"No bias"}</span> <span className={`tj-markup-status tj-markup-status-${String(markup.status||"Planned").toLowerCase()}`}>{markup.status||"Planned"}</span></div><div className="tj-muted-txt" style={{fontSize: 14}}>{markup.date} · {formatTime(markup.time)} · {markup.market||"No session"} · {linked.length} linked trade{linked.length===1?"":"s"}</div></div><div className={`tj-tlog-pnl ${pnl>=0?"tj-green":"tj-red"}`}>{fmtMoney(pnl)}</div><button className="tj-btn-edit" onClick={(event)=>{event.stopPropagation();onEdit(markup)}}>Edit</button><ConfirmDeleteButton className="tj-icon-btn" title="Delete markup" onClick={(event)=>{event.stopPropagation();onDelete(markup.id)}}><Trash2 size={14}/></ConfirmDeleteButton><ChevronDown size={16} style={{transform:expanded?"rotate(180deg)":"none"}}/></div>{expanded&&<div className="tj-tlog-detail"><div className="tj-tlog-detail-grid"><div><div className="tj-mlabel">STATUS</div><div>{markup.status||"Planned"}</div></div><div><div className="tj-mlabel">LEVELS / ZONES</div><div>{markup.levels||"—"}</div></div><div><div className="tj-mlabel">STRUCTURE</div><div>{markup.structure||"—"}</div></div><div><div className="tj-mlabel">EXPECTATIONS</div><div>{markup.notes||"—"}</div></div></div><div className="tj-section-label">Markup Images</div><div className="tj-markup-images">{slots.map(([slot,label])=>{const images=markup.screenshots?.[slot]||[];return images.length?<div key={slot} className="tj-markup-image-section"><div className="tj-mlabel">{label}</div><div className="tj-tlog-shots">{images.map((src,index)=><ImagePreview key={index} src={src} alt={`${label} chart`}/>)}</div></div>:null;})}</div><div className="tj-section-label">Linked Trades</div>{linked.length?linked.map((trade)=><div key={trade.id} className="tj-rule-row"><span>{trade.date} · {formatTime(trade.time)} · {trade.asset} · {trade.direction} <span className="tj-muted-txt">· {trade.entryType||trade.confluenceSession||"No entry type"}</span></span><span className="tj-linked-trade-metrics"><RatingDisplay value={trade.rating} noRules={!trade.ruleEvaluations?.length&&!trade.rating}/><strong className={trade.pnl>=0?"tj-green":"tj-red"}>{fmtMoney(trade.pnl)}</strong></span></div>):<div className="tj-empty">No trades linked yet.</div>}</div>}</Card>;
  }):<div className="tj-empty-block"><ScanLine size={32}/><div className="tj-empty-title">No premarket markups</div><button className="tj-btn-primary" onClick={onNew}>Create your first markup</button></div>}</div></>;
}
function useCloseOnOutside(isOpen, onClose) {
  const surfaceRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeWhenOutside = (event) => {
      if (!surfaceRef.current?.contains(event.target)) onClose();
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", closeWhenOutside, true);
    document.addEventListener("touchstart", closeWhenOutside, true);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside, true);
      document.removeEventListener("touchstart", closeWhenOutside, true);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isOpen, onClose]);

  return surfaceRef;
}

function ListPagination({ total, page, showAll, onPageChange, onShowAll, label }) {
  const pageCount = Math.max(1, Math.ceil(total / 10));
  const currentPage = Math.min(page, pageCount);
  const first = total ? showAll ? 1 : (currentPage - 1) * 10 + 1 : 0;
  const last = showAll ? total : Math.min(currentPage * 10, total);
  if (total <= 10) return null;
  return <nav className="tj-list-pagination" aria-label={`${label} pagination`}>
    <span>{showAll ? `All ${total}` : `${first}–${last} of ${total}`}</span>
    <button type="button" className="tj-btn-outline tj-btn-small" onClick={() => onShowAll(!showAll)}>{showAll ? "Show 10 per page" : "Show all"}</button>
    {!showAll && <div className="tj-pagination-arrows"><button type="button" className="tj-icon-btn" aria-label={`Previous ${label} page`} title="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={16}/></button><span>{currentPage} / {pageCount}</span><button type="button" className="tj-icon-btn" aria-label={`Next ${label} page`} title="Next page" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={16}/></button></div>}
  </nav>;
}

function ReferenceMarkupsPage({ markups, trades, onNew, onEdit, onDelete, onTrade }) {
  const openImage = React.useContext(ImageViewerContext);
  const [instrumentFilter, setInstrumentFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [weekFilter, setWeekFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState("");
  const [listPage, setListPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const toolbarRef = useCloseOnOutside(filtersOpen || sortOpen, () => { setFiltersOpen(false); setSortOpen(false); });
  const slots = [["preHTF", "HTF"], ["preH4", "MTF"], ["preM15", "LTF"], ["postH4", "MTF"], ["postM15", "LTF"]];
  const preSlots = slots.slice(0, 3);
  const postSlots = slots.slice(3);
  const linkedTrades = (markup) => trades.filter((trade) => trade.premarketMarkupId === markup.id);
  const totalLinkedPnl = (markup) => linkedTrades(markup).reduce((sum, trade) => sum + trade.pnl, 0);
  const effectiveStatus = (markup) => linkedTrades(markup).length ? "Executed" : (markup.status || "Planned");
  const top = (items, key) => Object.entries(items.reduce((all, item) => ({ ...all, [item[key] || "Unspecified"]: (all[item[key] || "Unspecified"] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const linked = markups.filter((markup) => linkedTrades(markup).length > 0);
  const allLinkedTrades = linked.flatMap(linkedTrades);
  const allPnl = linked.reduce((sum, markup) => sum + totalLinkedPnl(markup), 0);
  const coverage = (predicate) => markups.length ? Math.round(markups.filter(predicate).length / markups.length * 100) : 0;
  const countWith = (keys) => (markup) => keys.some((key) => markup.screenshots?.[key]?.length);
  const planCoverage = coverage((markup) => markup.levels || markup.structure || markup.notes || markup.bias);
  const preCoverage = coverage(countWith(["preHTF", "preH4", "preM15"]));
  const postCoverage = coverage(countWith(["postH4", "postM15"]));
  const instruments = ["All", ...Array.from(new Set(markups.map((markup) => markup.instrument).filter(Boolean))).sort()];
  const months = ["All", ...Array.from(new Set(markups.map((markup) => markup.date?.slice(0, 7)).filter(Boolean))).sort().reverse()];
  const weekOfMonth = (date) => {
    if (!date) return 0;
    const parsed = new Date(`${date}T00:00:00`);
    const firstDay = new Date(parsed.getFullYear(), parsed.getMonth(), 1).getDay();
    return Math.ceil((parsed.getDate() + firstDay) / 7);
  };
  const shown = markups.filter((markup) => {
    const pnl = totalLinkedPnl(markup);
    const resultMatches = resultFilter === "All" || (resultFilter === "Profit" && pnl > 0) || (resultFilter === "Loss" && pnl < 0) || (resultFilter === "Break-even" && pnl === 0 && linkedTrades(markup).length > 0) || (resultFilter === "No linked trades" && !linkedTrades(markup).length);
    return (instrumentFilter === "All" || markup.instrument === instrumentFilter)
      && (monthFilter === "All" || markup.date?.slice(0, 7) === monthFilter)
      && (weekFilter === "All" || weekOfMonth(markup.date) === Number(weekFilter))
      && (statusFilter === "All" || effectiveStatus(markup) === statusFilter)
      && resultMatches;
  }).sort((a, b) => {
    if (sort === "oldest") return `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`);
    if (sort === "pnl") return totalLinkedPnl(b) - totalLinkedPnl(a);
    if (sort === "links") return linkedTrades(b).length - linkedTrades(a).length;
    return `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`);
  });
  const executed = markups.filter((markup) => effectiveStatus(markup) === "Executed").length;
  const planned = markups.filter((markup) => effectiveStatus(markup) === "Planned").length;
  const executionMatch = markups.length ? Math.round(linked.length / markups.length * 100) : 0;
  const best = linked.length ? Math.max(...linked.map(totalLinkedPnl)) : 0;
  const worst = linked.length ? Math.min(...linked.map(totalLinkedPnl)) : 0;
  const profitableLinked = allLinkedTrades.filter((trade) => trade.pnl > 0).length;
  const losingLinked = allLinkedTrades.filter((trade) => trade.pnl < 0).length;
  const markupPageCount = Math.max(1, Math.ceil(shown.length / 10));
  const activeMarkupPage = Math.min(listPage, markupPageCount);
  const visibleMarkups = showAll ? shown : shown.slice((activeMarkupPage - 1) * 10, activeMarkupPage * 10);
  useEffect(() => { setListPage(1); }, [instrumentFilter, monthFilter, weekFilter, statusFilter, resultFilter, sort]);

  return <div className="tj-reference-markups">
    <div className="tj-rules-head"><div><div className="tj-bold" style={{ fontSize: 19.44 }}>Markups</div><div className="tj-muted-txt" style={{ fontSize: 14 }}>Prepare context before execution, then attach the final trade to its plan.</div></div><button className="tj-btn-primary" onClick={onNew}><Plus size={15}/> New Markup</button></div>
    <div className="tj-markup-overview-grid">
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">MARKUPS IN VIEW</div><strong>{markups.length}</strong><span>{top(markups, "instrument")} is showing up most</span><div className="tj-markup-progress"><i style={{width: markups.length ? "100%" : "0%"}}/></div><small>Top session: {top(markups, "market")} · {executed} executed · {planned} planned</small></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">EXECUTION MATCH</div><strong className={executionMatch >= 70 ? "tj-green" : "tj-amber-txt"}>{executionMatch}%</strong><span>{linked.length} of {markups.length} markups were linked to execution</span><div className="tj-markup-split"><i style={{width: `${executionMatch}%`}}/><b style={{width: `${100 - executionMatch}%`}}/></div><small>{allLinkedTrades.length} linked trades · {profitableLinked} profitable · {losingLinked} losing</small></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">LINKED P&amp;L</div><strong className={allPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(allPnl)}</strong><span>Average {linked.length ? fmtMoney(allPnl / linked.length) : fmtMoney(0)} per linked markup</span><div className="tj-markup-bestworst"><div><small>Best linked</small><b className={best >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(best)}</b></div><div><small>Worst linked</small><b className={worst >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(worst)}</b></div></div></Card>
      <Card className="tj-markup-overview-card"><div className="tj-stat-label">CAPTURE COVERAGE</div><strong>{Math.round((planCoverage + preCoverage + postCoverage) / 3)}%</strong><span>How complete the markup journal is across plan, pre-session, and review assets.</span><div className="tj-markup-coverage"><div><small>Plan</small><i><b style={{width: `${planCoverage}%`}}/></i><em>{planCoverage}%</em></div><div><small>Pre</small><i><b style={{width: `${preCoverage}%`}}/></i><em>{preCoverage}%</em></div><div><small>Post</small><i><b style={{width: `${postCoverage}%`}}/></i><em>{postCoverage}%</em></div></div></Card>
    </div>
    <div className="tj-markup-toolbar" ref={toolbarRef}>
      <div className="tj-markup-toolbar-actions"><button className={`tj-icon-btn tj-markup-toolbar-button ${filtersOpen ? "tj-icon-btn-active" : ""}`} title="Filter markups" onClick={() => { setFiltersOpen((value) => !value); setSortOpen(false); }}><SlidersHorizontal size={16}/></button><button className={`tj-icon-btn tj-markup-toolbar-button ${sortOpen ? "tj-icon-btn-active" : ""}`} title="Sort markups" onClick={() => { setSortOpen((value) => !value); setFiltersOpen(false); }}><ArrowDownUp size={16}/></button></div>
      <div className="tj-markup-toolbar-status"><span>{shown.length} shown</span><b>{showAll ? "All visible" : `Page ${activeMarkupPage} of ${markupPageCount}`}</b></div>
      {filtersOpen && <div className="tj-markup-filter-popover">
        <div className="tj-markup-filter-head"><div><strong>Filter markups</strong><span>Keep the markup board clean while focusing on the exact setup window you want.</span></div><button className="tj-icon-btn" title="Close filters" onClick={() => setFiltersOpen(false)}><X size={14}/></button></div>
        <div className="tj-markup-filter-grid">
          <Field label="Instrument"><select className="tj-toolbar-dd" value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)}>{instruments.map((item) => <option key={item} value={item}>{item === "All" ? "All Instruments" : item}</option>)}</select></Field>
          <Field label="Month"><select className="tj-toolbar-dd" value={monthFilter} onChange={(event) => { setMonthFilter(event.target.value); setWeekFilter("All"); }}><option value="All">All Months</option>{months.slice(1).map((item) => <option key={item} value={item}>{new Date(`${item}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</option>)}</select></Field>
          <Field label="Week"><select className="tj-toolbar-dd" disabled={monthFilter === "All"} value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="All">{monthFilter === "All" ? "Select a month first" : "All Weeks"}</option>{[1,2,3,4,5,6].map((week) => <option key={week} value={week}>Week {week}</option>)}</select></Field>
          <Field label="Status"><select className="tj-toolbar-dd" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All">All Statuses</option>{["Planned", "Watching", "Executed", "Passed"].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Result"><select className="tj-toolbar-dd" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="All">All Results</option>{["Profit", "Loss", "Break-even", "No linked trades"].map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="tj-markup-filter-summary">{[instrumentFilter, monthFilter, weekFilter, statusFilter, resultFilter].every((value) => value === "All") ? "No filters applied." : `${shown.length} markup${shown.length === 1 ? "" : "s"} match the selected filters.`}</div>
      </div>}
      {sortOpen && <div className="tj-markup-sort-controls"><span>Sort markups by</span><select className="tj-toolbar-dd" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="pnl">Linked P&amp;L</option><option value="links">Most linked trades</option></select></div>}
    </div>
    <div className="tj-tlog-list">{shown.length ? visibleMarkups.map((markup) => {
      const related = linkedTrades(markup), pnl = totalLinkedPnl(markup), expanded = !!open[markup.id];
      const status = effectiveStatus(markup);
      const chartCount = slots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0);
      const planFields = [markup.structure, markup.levels, markup.notes];
      const planFilled = Math.round(planFields.filter((value) => String(value || "").trim()).length / planFields.length * 100);
      const renderChartGroup = (groupSlots, emptyText) => {
        const chartItems = groupSlots.flatMap(([key, label]) => (markup.screenshots?.[key] || []).map((screenshot, index) => ({ key: `${markup.id}:${key}:${index}`, label, source: screenshotSource(screenshot), caption: screenshotCaption(screenshot) })));
        return <div className="tj-markup-chart-group">{chartItems.length ? chartItems.map((chart) => <button type="button" key={chart.key} className={`tj-markup-chart-card ${selectedChart === chart.key ? "tj-markup-chart-card-selected" : ""}`} onClick={() => { setSelectedChart(chart.key); openImage(chart.source); }}><img src={chart.source} alt={chart.caption || chart.label}/><strong>{chart.caption || chart.label}</strong>{chart.caption && <small>{chart.label}</small>}</button>) : <div className="tj-markup-chart-empty">{emptyText}</div>}</div>;
      };
      return <Card key={markup.id} className={`tj-tlog-card tj-reference-markup-card ${expanded ? "tj-reference-markup-expanded" : ""}`}>
        <div className="tj-reference-markup-row" onClick={() => setOpen((current) => ({ ...current, [markup.id]: !current[markup.id] }))}>
          <div className="tj-reference-markup-identity"><div><strong>{markup.instrument || "Untitled markup"}</strong><span>{markup.bias || "No bias"}</span><span className={`tj-markup-status tj-markup-status-${status.toLowerCase()}`}>{status}</span></div><small>{markup.date} · {formatTime(markup.time)} · {markup.market || "No session"} · {related.length} linked trade{related.length === 1 ? "" : "s"}</small></div>
          <div className="tj-reference-markup-actions"><div className="tj-markup-pnl"><strong className={pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(pnl)}</strong><span>{related.length ? "linked P&L" : "No linked P&L"}</span></div><button className="tj-markup-trade-button" onClick={(event) => { event.stopPropagation(); onTrade(markup); }}><Plus size={14}/> Trade</button><button className="tj-markup-round-button" title="Edit markup" onClick={(event) => { event.stopPropagation(); onEdit(markup); }}><Pencil size={14}/></button><ConfirmDeleteButton className="tj-markup-round-button tj-markup-delete-button" title="Delete markup" onClick={(event) => { event.stopPropagation(); onDelete(markup.id); }}><Trash2 size={14}/></ConfirmDeleteButton><button className="tj-markup-round-button" title={expanded ? "Collapse markup" : "Expand markup"} onClick={(event) => { event.stopPropagation(); setOpen((current) => ({ ...current, [markup.id]: !current[markup.id] })); }}>{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button></div>
        </div>
        {expanded && <div className="tj-reference-markup-detail">
          <div className="tj-markup-detail-top"><div><div className="tj-mlabel">SESSION</div><strong>{markup.market || "—"}</strong></div><div><div className="tj-mlabel">PLAN FILLED</div><strong>{planFilled}%</strong></div><div><div className="tj-mlabel">LINKED TRADES</div><strong>{related.length}</strong></div><div><div className="tj-mlabel">CHARTS SAVED</div><strong>{chartCount}</strong></div></div>
          <div className="tj-markup-expanded-grid">
            <section className="tj-markup-plan-card"><div className="tj-markup-detail-heading"><span>Pre-session Plan</span><div><em>{markup.market || "—"}</em><em>{markup.bias || "—"}</em><em className={`tj-markup-status tj-markup-status-${status.toLowerCase()}`}>{status}</em><em className={pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(pnl)}</em></div></div>{planFields.some(Boolean) ? <div className="tj-markup-plan-rows"><div><span>STRUCTURE</span><strong>{markup.structure || "—"}</strong></div><div><span>LEVELS / ZONES</span><strong>{markup.levels || "—"}</strong></div><div><span>EXPECTATIONS</span><strong>{markup.notes || "—"}</strong></div></div> : <div className="tj-markup-panel-empty">No extra notes added yet.</div>}</section>
            <section className="tj-markup-linked-card"><div className="tj-markup-detail-heading"><span>Linked Trades</span><small>{related.length} linked</small></div>{related.length ? <div className={`tj-linked-markup-trades ${related.length > 4 ? "tj-linked-markup-trades-scroll" : ""}`}>{related.map((trade) => <div className="tj-linked-markup-trade" key={trade.id}><div><strong>{trade.asset} · {trade.direction}</strong><span>{trade.date} · {formatTime(trade.time)} · R:R {trade.rr ? `${Number(trade.rr).toFixed(2)}R` : "—"}</span></div><div><strong className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</strong></div></div>)}</div> : <div className="tj-markup-panel-empty">No trade linked</div>}</section>
          </div>
          <section className="tj-markup-charts-card"><div className="tj-markup-charts-head"><span>Pre-session Charts <small>{preSlots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0)} chart{preSlots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0) === 1 ? "" : "s"}</small></span><span>Post-session Charts <small>{postSlots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0)} chart{postSlots.reduce((count, [key]) => count + (markup.screenshots?.[key]?.length || 0), 0) === 1 ? "" : "s"}</small></span></div><div className="tj-markup-chart-columns"><div>{renderChartGroup(preSlots, "No pre-session charts yet.")}</div><div>{renderChartGroup(postSlots, "No post-session charts yet.")}</div></div></section>
        </div>}
      </Card>;
    }) : <div className="tj-empty-block"><ScanLine size={32} color="var(--tj-muted)"/><div className="tj-empty-title">No markups match these filters</div><button className="tj-btn-primary" onClick={onNew}>Create a markup</button></div>}</div>
    <ListPagination total={shown.length} page={activeMarkupPage} showAll={showAll} onPageChange={setListPage} onShowAll={(next) => { setShowAll(next); if (!next) setListPage(1); }} label="markups"/>
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
    const item = all[name] || { name, pnl: 0, trades: 0, wins: 0 };
    item.pnl += trade.pnl; item.trades += 1; item.wins += classify(trade.pnl, account.breakevenCap) === "win" ? 1 : 0; all[name] = item;
    return all;
  }, {});
  const bestSession = Object.values(sessions).sort((a, b) => b.pnl - a.pnl)[0];
  const strongestEdge = Object.values(entryTypes).sort((a, b) => b.pnl - a.pnl)[0];
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
    bestSession: bestSession?.name || "—",
    bestSessionPnl: bestSession?.pnl || 0,
    strongestEdge: strongestEdge?.name || "—",
    strongestEdgeWinRate: strongestEdge?.trades ? strongestEdge.wins / strongestEdge.trades * 100 : 0,
    strongestEdgeShare: periodTrades.length && strongestEdge ? strongestEdge.trades / periodTrades.length * 100 : 0,
  };
}

function TradeReviewEditorModal({ trade, trades = [], existing, reviews = [], markups = [], account, onClose, onSave }) {
  const allTrades = trades.length ? trades : [trade];
  const createForm = (selectedTrade, saved) => ({ id: saved?.id, tradeId: selectedTrade.id, date: saved?.date || todayISO(), time: saved?.time || nowTime(), doneWell: saved?.doneWell || "", wentWrong: saved?.wentWrong || "", execution: saved?.execution || "", adherence: saved?.adherence || "", psychology: saved?.psychology || "", lessons: saved?.lessons || "", actions: saved?.actions || "", notes: saved?.notes || "", screenshots: saved?.screenshots || [] });
  const [selectedTradeId, setSelectedTradeId] = useState(trade.id);
  const [form, setForm] = useState(() => createForm(trade, existing));
  const activeTrade = allTrades.find((item) => item.id === selectedTradeId) || trade;
  const linkedMarkup = markups.find((markup) => markup.id === activeTrade.premarketMarkupId);
  const markupScreenshots = linkedMarkup ? [
    ["preHTF", "Pre-session HTF"], ["preH4", "Pre-session MTF"], ["preM15", "Pre-session LTF"], ["postH4", "Post-session MTF"], ["postM15", "Post-session LTF"],
  ].flatMap(([key, label]) => (linkedMarkup.screenshots?.[key] || []).map((screenshot, index) => ({ key: `${key}-${index}`, label, src: screenshotSource(screenshot), caption: screenshotCaption(screenshot) }))) : [];
  const resultClass = classify(activeTrade.pnl, account?.breakevenCap || 0);
  const resultLabel = resultClass === "win" ? "Win" : resultClass === "loss" ? "Loss" : "Break-even";
  const accountBase = Number(account?.balance) || 0;
  const netReturn = accountBase ? Number(activeTrade.pnl || 0) / accountBase * 100 : 0;
  const grossPnl = Number(activeTrade.grossPnl ?? activeTrade.pnl) || 0;
  const grossReturn = accountBase ? grossPnl / accountBase * 100 : 0;
  const costs = Number(activeTrade.commission || 0) + Number(activeTrade.swap || 0);
  const costReturn = accountBase ? -costs / accountBase * 100 : 0;
  const checkedRules = (activeTrade.ruleEvaluations || []).filter((item) => item.checked).length;
  const totalRules = account?.rules?.filter((rule) => rule.active).length || 0;
  const tradeDate = new Date(`${activeTrade.date}T00:00:00`);
  const compactDate = tradeDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const dayDate = tradeDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectTrade = (id) => {
    const selected = allTrades.find((item) => item.id === id) || trade;
    const saved = reviews.find((review) => review.tradeId === id);
    setSelectedTradeId(id);
    setForm(createForm(selected, saved));
  };
  const save = async () => { const didSave = await onSave({ ...form, tradeId: activeTrade.id }); if (didSave !== false) onClose(); };
  const pct = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  return <Modal title="Write Trade Review" onClose={onClose} onConfirm={save} className="tj-review-editor-modal" wide>
    <div className="tj-review-editor-intro"><span>Keep it light: capture the lesson, save it, move on.</span><b className={`tj-pill ${resultClass === "win" ? "tj-pill-green" : resultClass === "loss" ? "tj-pill-red" : "tj-pill-blue"}`}>{resultLabel}</b></div>
    <div className="tj-review-trade-banner"><div><strong>{activeTrade.asset || "Trade"}</strong><span><b className={activeTrade.direction === "BUY" ? "tj-green" : "tj-red"}>{activeTrade.direction}</b><em>{activeTrade.entrySession || activeTrade.session || "—"}</em><em>{compactDate}</em><em>{Number(activeTrade.rr || 0).toFixed(2)}R</em></span></div><strong className={activeTrade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(activeTrade.pnl)}</strong></div>
    <div className="tj-review-reference-stack">
      <section className="tj-review-reference-card"><header><span>Trade Brief</span><div><em className={activeTrade.direction === "BUY" ? "tj-green" : "tj-red"}>{activeTrade.direction}</em><em>{activeTrade.entrySession || activeTrade.session || "—"}</em><em>{activeTrade.entryType || activeTrade.confluenceSession || "No model"}</em><em className={netReturn >= 0 ? "tj-green" : "tj-red"}>{pct(netReturn)}</em></div></header><div className="tj-review-brief-rows"><div><span>RESULT</span><strong>{resultLabel} · {fmtMoney(activeTrade.pnl)} · {Number(activeTrade.rr || 0).toFixed(2)}R</strong></div><div><span>ENTRY MODEL</span><strong>{activeTrade.entryType || activeTrade.confluenceSession || "Not logged"}</strong></div><div><span>MOOD SHIFT</span><strong>{activeTrade.moodBefore || "Not logged"} → {activeTrade.moodAfter || "Not logged"}</strong></div><div><span>RATING</span><RatingDisplay value={activeTrade.rating || 0} /></div></div><p>{activeTrade.context || "No trade note added."}</p></section>
      <section className="tj-review-reference-card"><header><span>Linked Markup</span><small>{linkedMarkup?.status || (linkedMarkup ? "Planned" : "Not linked")}</small></header>{linkedMarkup ? <><strong className="tj-review-markup-title">{linkedMarkup.date} · {linkedMarkup.instrument || linkedMarkup.market || "Untitled"}</strong><div className="tj-review-markup-meta"><span>{linkedMarkup.market || "—"}</span><span>{linkedMarkup.bias || "—"}</span><span>{linkedMarkup.status || "Planned"}</span></div><div className="tj-review-markup-shots-head"><span>MARKUP SCREENSHOTS</span><small>{markupScreenshots.length} shot{markupScreenshots.length === 1 ? "" : "s"}</small></div>{markupScreenshots.length ? <div className="tj-review-markup-shots">{markupScreenshots.map((shot) => <div key={shot.key}><ImagePreview src={shot.src} alt={`${shot.label} markup screenshot`} /><strong>{shot.label}</strong><small>{shot.label.startsWith("Pre") ? "Pre-session Charts" : "Post-session Charts"}</small></div>)}</div> : <p>No markup screenshots added.</p>}</> : <p>No markup was linked to this trade.</p>}</section>
      <section className="tj-review-reference-card"><header><span>Execution Snapshot</span><small>{checkedRules}/{totalRules} rules checked</small></header><div className="tj-review-execution-grid"><div><span>NET RETURN</span><strong className={netReturn >= 0 ? "tj-green" : "tj-red"}>{pct(netReturn)}</strong><small>{fmtMoney(activeTrade.pnl)}</small></div><div><span>GROSS RETURN</span><strong className={grossReturn >= 0 ? "tj-green" : "tj-red"}>{pct(grossReturn)}</strong><small>{fmtMoney(grossPnl)}</small></div><div><span>COSTS</span><strong className="tj-red">{pct(costReturn)}</strong><small>{fmtMoney(-costs)}</small></div><div><span>R:R</span><strong>{Number(activeTrade.rr || 0).toFixed(2)}R</strong><small>{dayDate}</small></div></div></section>
      <section className="tj-review-reference-card"><header><span>Journal Detail</span><small>{(activeTrade.confluence || activeTrade.types || []).length} confluence{(activeTrade.confluence || activeTrade.types || []).length === 1 ? "" : "s"}</small></header><div className="tj-review-journal-block"><span>CONFLUENCES</span>{(activeTrade.confluence || activeTrade.types || []).length ? <div className="tj-tagwrap">{(activeTrade.confluence || activeTrade.types || []).map((item) => <em key={item} className="tj-tag tj-tag-purple tj-tag-active">{item}</em>)}</div> : <p>No confluences logged.</p>}</div><div className="tj-review-journal-block"><span>MISTAKES</span>{activeTrade.mistakes?.length ? <div className="tj-tagwrap">{activeTrade.mistakes.map((item) => <em key={item} className="tj-tag tj-tag-red tj-tag-active">{item}</em>)}</div> : <p>No mistakes logged.</p>}</div><div className="tj-review-journal-block"><span>SCREENSHOTS</span>{activeTrade.screenshots?.length ? <div className="tj-review-trade-shots">{activeTrade.screenshots.map((src, index) => <ImagePreview key={index} src={src} alt={`Trade screenshot ${index + 1}`} />)}</div> : <p>No screenshots added.</p>}</div></section>
    </div>
    <div className="tj-grid2"><Field label="Trade reference"><select className="tj-input" value={selectedTradeId} onChange={(event) => selectTrade(event.target.value)}>{allTrades.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.asset || "Trade"} · {fmtMoney(item.pnl)}</option>)}</select></Field><Field label="Review date"><input type="date" className="tj-input" value={form.date} onChange={(event) => set("date", event.target.value)} /></Field></div>
    <div className="tj-grid2"><Field label="What went well"><textarea className="tj-input tj-textarea" value={form.doneWell} onChange={(event) => set("doneWell", event.target.value)} /></Field><Field label="What went wrong"><textarea className="tj-input tj-textarea" value={form.wentWrong} onChange={(event) => set("wentWrong", event.target.value)} /></Field></div>
    <div className="tj-grid3"><Field label="Execution"><textarea className="tj-input tj-textarea" value={form.execution} onChange={(event) => set("execution", event.target.value)} /></Field><Field label="Rule adherence"><textarea className="tj-input tj-textarea" value={form.adherence} onChange={(event) => set("adherence", event.target.value)} /></Field><Field label="Psychology"><textarea className="tj-input tj-textarea" value={form.psychology} onChange={(event) => set("psychology", event.target.value)} /></Field></div>
    <div className="tj-grid2"><Field label="Lessons learned"><textarea className="tj-input tj-textarea" value={form.lessons} onChange={(event) => set("lessons", event.target.value)} /></Field><Field label="Next adjustment"><textarea className="tj-input tj-textarea" value={form.actions} onChange={(event) => set("actions", event.target.value)} /></Field></div>
    <Field label="Notes"><textarea className="tj-input tj-textarea" value={form.notes} onChange={(event) => set("notes", event.target.value)} /></Field>
    <ScreenshotUploader max={2} screenshots={form.screenshots} onChange={(update) => setForm((current) => ({ ...current, screenshots: update(current.screenshots) }))} />
    <div className="tj-modal-actions"><button className="tj-btn-primary" onClick={save}>Save Review</button></div>
  </Modal>;
}

const PERIOD_REVIEW_FIELDS = {
  technical: [
    ["technicalWins", "What commonalities were present in my winning trades?"],
    ["technicalLosses", "What commonalities were present in my losing trades?"],
    ["technicalRules", "Are there any strategy rules I need to tweak, add, or remove?"],
  ],
  mistakes: [
    ["mistakes", "What mistakes did I make this period and what caused them?"],
    ["mistakePatterns", "Did any emotional or behavioural pattern show up again?"],
    ["mistakeInterrupt", "What rule, habit, or reminder can interrupt this pattern next period?"],
  ],
  habits: [
    ["habits", "How consistently did I follow my trading routine this period?"],
    ["habitDrift", "Where did I drift from routine, and why?"],
    ["habitChange", "What specific change will I implement to improve consistency next period?"],
  ],
  markups: [
    ["markups", "How accurate was my overall directional bias?"],
    ["markupMisalignment", "Where did my bias misalign with structure or context, and why?"],
    ["markupExecution", "Did executed trades align with my pre-session plans, or did they drift?"],
  ],
  goals: [
    ["goals", "Did I complete the goals I set for this period? Why or why not?"],
    ["goalImpact", "Which goal had the biggest impact on my process or results?"],
    ["goalNext", "What process-based goals am I setting for the next period?"],
  ],
  overall: [
    ["overallWell", "What did I do well this period?"],
    ["overallLessons", "What are my top lessons from this period?"],
    ["overallAdjustment", "What is the single most important adjustment for next period?"],
  ],
};

function PeriodReviewModal({ period, saved, reviews, onClose, onSave, onStartTradeReview }) {
  const initialContent = { overview: "", invalid: "", missedTrades: "", strategyPerformance: "", ...(saved?.content || {}) };
  const [content, setContent] = useState(initialContent);
  const [openSections, setOpenSections] = useState({ technical: false, mistakes: false, habits: false, markups: false, goals: false, overall: false });
  const set = (key, value) => setContent((current) => ({ ...current, [key]: value }));
  const reviewByTrade = new Map(reviews.map((review) => [review.tradeId, review]));
  const stat = period.stats;
  const completed = stat.total > 0 && stat.reviewed === stat.total;
  const save = async () => { const didSave = await onSave({ type: period.type, key: period.key, content, completed }); if (didSave !== false) onClose(); };
  const periodName = period.type === "monthly" ? "Month" : period.type === "quarterly" ? "Quarter" : "Year";
  const activeDays = new Set(stat.trades.map((trade) => trade.date)).size;
  const section = (id, title) => <section className="tj-period-section" key={id}><button type="button" className="tj-period-section-head" onClick={() => setOpenSections((current) => ({ ...current, [id]: !current[id] }))}><strong>{title}</strong><ChevronDown size={17} style={{ transform: openSections[id] ? "rotate(180deg)" : "none" }} /></button>{openSections[id] && <div className="tj-period-section-body">{PERIOD_REVIEW_FIELDS[id].map(([key, label]) => <Field key={key} label={label}><textarea className="tj-input tj-textarea" placeholder="Write your review…" value={content[key] || ""} onChange={(event) => set(key, event.target.value)} /></Field>)}</div>}</section>;
  return <Modal title={`${period.label} Review`} onClose={onClose} onConfirm={save} className="tj-period-review-modal" wide>
    <div className="tj-period-review-summary">
      <div className="tj-period-review-title"><div className="tj-section-label">{period.label.toUpperCase()} REVIEW</div><span>{period.year} · {stat.total} trade{stat.total === 1 ? "" : "s"} closed · {stat.reviewed} reviewed</span></div>
      <div className="tj-period-metric-grid tj-period-metric-grid-reference"><div className={completed ? "tj-period-complete-yes" : "tj-period-complete-no"}><small>COMPLETED</small><strong className={completed ? "tj-green" : "tj-red"}>{completed ? "Yes" : "No"}</strong><span>{completed ? `Every ${periodName.toLowerCase()} trade has a saved review.` : `${stat.total - stat.reviewed} trade${stat.total - stat.reviewed === 1 ? "" : "s"} still need a review.`}</span></div><div><small>{periodName.toUpperCase()} P&amp;L (%)</small><strong className={stat.netPnl >= 0 ? "tj-green" : "tj-red"}>{stat.returnPct >= 0 ? "+" : ""}{stat.returnPct.toFixed(2)}%</strong><span>{fmtMoney(stat.netPnl)} net across the {periodName.toLowerCase()}.</span></div><div><small>WIN RATE</small><strong className={wrColorClass(stat.winRate)}>{stat.winRate.toFixed(1)}%</strong><span>{stat.wins} wins · {stat.losses} losses · {stat.breakeven} B/E</span></div><div><small>PERFORMANCE (0–5)</small><div className="tj-period-performance"><strong>{Math.round(stat.performance)}/5</strong><span>{[1,2,3,4,5].map((dot) => <i key={dot} className={dot <= Math.round(stat.performance) ? "tj-score-dot-on" : ""} />)}</span></div><em>Auto score {Math.round(stat.performance)}/5 before any manual override.</em></div><div><small>TRADES</small><strong>{stat.total}</strong><span>{activeDays} active day{activeDays === 1 ? "" : "s"} on the tape.</span></div><div><small>REVIEWED</small><strong>{stat.reviewed}/{stat.total || 0}</strong><span>{(stat.coverage * 100).toFixed(0)}% review coverage.</span></div><div><small>AVG RR</small><strong>{stat.avgRR.toFixed(2)}</strong><span>Risk quality across the {periodName.toLowerCase()}.</span></div><div><small>BEST SESSION</small><strong>{stat.bestSession}</strong><span>{fmtMoney(stat.bestSessionPnl)} strongest return.</span></div></div>
      <div className="tj-period-meter-grid"><div><small>REVIEW COVERAGE</small><b>{stat.reviewed}/{stat.total || 0}</b><i><em style={{ width: `${stat.coverage * 100}%` }} /></i><span>{(stat.coverage * 100).toFixed(0)}% of the {periodName.toLowerCase()} has a saved write-up.</span></div><div><small>RESULT MIX</small><b>{stat.wins}W · {stat.losses}L · {stat.breakeven} B/E</b><i className="tj-result-meter"><em style={{ width: `${stat.total ? stat.wins / stat.total * 100 : 0}%` }} /><strong style={{ width: `${stat.total ? stat.losses / stat.total * 100 : 0}%` }} /></i><span>{stat.wins} green · {stat.losses} red · {stat.breakeven} flat</span></div><div><small>STRONGEST EDGE</small><b>{stat.strongestEdge}</b><i><em style={{ width: `${stat.strongestEdgeShare}%` }} /></i><span>{stat.strongestEdgeWinRate.toFixed(0)}% WR · {stat.strongestEdgeShare.toFixed(0)}% share</span></div></div>
    </div>
    <section className="tj-period-at-glance"><div className="tj-bold">{periodName} At A Glance</div><div className="tj-muted-txt">Quick reads for what mattered this {periodName.toLowerCase()}.</div><Field label="My performance"><input className="tj-input" placeholder="Add a short read…" value={content.overview || ""} onChange={(event) => set("overview", event.target.value)} /></Field><Field label="Invalid"><input className="tj-input" placeholder="Add a short read…" value={content.invalid || ""} onChange={(event) => set("invalid", event.target.value)} /></Field><Field label="Missed trades"><input className="tj-input" placeholder="Add a short read…" value={content.missedTrades || ""} onChange={(event) => set("missedTrades", event.target.value)} /></Field><Field label="Strategy performance"><input className="tj-input" placeholder="Add a short read…" value={content.strategyPerformance || ""} onChange={(event) => set("strategyPerformance", event.target.value)} /></Field></section>
    <section className="tj-period-trades"><div className="tj-period-trades-head"><div><div className="tj-bold">Trades Taken</div><div className="tj-muted-txt">The full {periodName.toLowerCase()} tape. Five rows stay in view; the rest scroll below.</div></div><span className="tj-count-badge">{stat.total}</span></div>{stat.trades.length ? <div className={`tj-period-trades-scroll ${stat.trades.length > 5 ? "tj-period-trades-scrollable" : ""}`}>{stat.trades.slice().sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)).map((trade) => { const review = reviewByTrade.get(trade.id); const confluences = trade.confluence || trade.types || []; const tradeResult = classify(trade.pnl, 0); return <button type="button" className="tj-period-trade-reference-row" key={trade.id} onClick={() => onStartTradeReview(trade, review)}><div><span><strong>{trade.asset || "No instrument"}</strong><em className={trade.direction === "BUY" ? "tj-green" : "tj-red"}>{trade.direction}</em><small>{trade.entrySession || trade.session || "—"}</small><small>{trade.entryType || trade.confluenceSession || "—"}</small><b className={review ? "tj-review-status-done" : "tj-review-status-pending"}>{review ? "Reviewed" : "Review"}</b></span><span><small>{new Date(`${trade.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small><small>{Number(trade.rr || 0).toFixed(2)}R</small><small>{trade.mistakes?.length || 0} mistake{trade.mistakes?.length === 1 ? "" : "s"}</small>{confluences.slice(0, 3).map((item) => <em key={item}>{item}</em>)}{confluences.length > 3 && <em>+{confluences.length - 3}</em>}</span></div><strong className={tradeResult === "win" ? "tj-period-result-win" : tradeResult === "loss" ? "tj-period-result-loss" : "tj-period-result-flat"}>{tradeResult === "win" ? "WIN" : tradeResult === "loss" ? "LOSS" : "B/E"}</strong></button>; })}</div> : <div className="tj-empty">No trades were logged for this period.</div>}</section>
    <section className="tj-period-review-longform"><div className="tj-bold">Review</div><div className="tj-muted-txt">Long-form {periodName.toLowerCase()} reflection.</div><div className="tj-period-sections">{section("technical", "Technical")}{section("mistakes", "Mistakes")}{section("habits", "Habits")}{section("markups", "Markups")}{section("goals", "Goals")}{section("overall", "Overall Performance")}</div></section>
    <div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" onClick={save}>Save Review</button></div>
  </Modal>;
}

function ReviewLibraryPage({ account, trades, reviews, periodReviews, markups = [], onSavePeriod, onSaveTrade }) {
  const currentYear = new Date().getFullYear();
  const [reviewYear, setReviewYear] = useState(() => account.trades.some(t => t.context?.startsWith("Synthetic demo trade.")) ? 2025 : currentYear);
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
  const activePeriodLive = activePeriod ? [...months, ...quarters, annual].find((period) => period.type === activePeriod.type && period.key === activePeriod.key) || activePeriod : null;
  const reviewedIds = new Set(reviews.map((review) => review.tradeId));
  const pending = trades.filter((trade) => trade.date?.slice(0, 4) === String(reviewYear) && !reviewedIds.has(trade.id)).sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`));
  const openPeriod = (period) => setActivePeriod(period);
  const renderPeriodCard = (period, compact = false) => {
    const saved = savedByPeriod.get(`${period.type}:${period.key}`);
    const stat = period.stats;
    return <button type="button" key={period.key} className={`tj-review-library-card ${compact ? "tj-review-library-card-compact" : ""} ${stat.total ? "tj-review-library-card-live" : ""}`} onClick={() => openPeriod(period)}><div className="tj-review-card-top"><span>{period.label.toUpperCase()}</span>{stat.total ? <b className={stat.netPnl >= 0 ? "tj-green" : "tj-red"}>{stat.returnPct >= 0 ? "+" : ""}{stat.returnPct.toFixed(2)}%</b> : <b>—</b>}</div>{stat.total ? <><strong>{stat.reviewed}/{stat.total}</strong><small>{stat.reviewed} reviewed · {stat.performance.toFixed(1)}/5</small><div className="tj-review-card-foot"><span>{stat.total} trades</span><span>{stat.winRate.toFixed(0)}% WR</span></div><i><em style={{ width: `${stat.coverage * 100}%` }} /></i></> : <><strong>No trades</strong><small>{saved?.completed ? "Reflection saved" : "Empty period"}</small><div className="tj-review-card-foot"><span>0 trades</span><span>0% WR</span></div></>}</button>;
  };
  return <div className="tj-review-library">
    <Card className="tj-review-workspace"><div className="tj-review-library-head"><div><div className="tj-section-label">REVIEW WORKSPACE</div><div className="tj-bold" style={{ fontSize: 23.76 }}>Review Library</div><div className="tj-muted-txt" style={{ fontSize: 14 }}>Monthly, quarterly, and annual reflection in one clear workspace.</div></div><div className="tj-review-year-switch"><button className="tj-icon-btn" onClick={() => setReviewYear((year) => year - 1)}><ChevronLeft size={17}/></button><strong>{reviewYear}</strong><button className="tj-icon-btn" onClick={() => setReviewYear((year) => year + 1)}><ChevronRight size={17}/></button></div></div><div className="tj-review-period-title">MONTHLY REVIEW</div><div className="tj-review-month-grid">{months.map((period) => renderPeriodCard(period))}</div><div className="tj-review-period-title">QUARTERLY REVIEW</div><div className="tj-review-quarter-grid">{quarters.map((period) => renderPeriodCard(period, true))}</div><div className="tj-review-period-title">ANNUAL REVIEW</div><div className="tj-review-annual-grid">{renderPeriodCard(annual, true)}</div></Card>
    <Card className="tj-trades-to-review"><div className="tj-period-trades-head"><div><div className="tj-bold">Trades to Review</div><div className="tj-muted-txt" style={{ fontSize: 14 }}>Closed trades still waiting for a write-up.</div></div><span className="tj-count-badge">{pending.length}</span></div>{pending.length ? <div className="tj-review-table-wrap"><div className="tj-review-table tj-review-table-head"><span>TRADE</span><span>DATE</span><span>SESSION</span><span>ENTRY MODEL</span><span>MARKUP</span><span>CONFLUENCES</span><span>MISTAKES</span><span>RESULT</span><span>RR</span></div>{pending.map((trade) => <button type="button" className="tj-review-table tj-review-table-row" key={trade.id} onClick={() => setTradeEditor({ trade })}><span><strong>{trade.asset || "No instrument"}</strong><em className={trade.direction === "BUY" ? "tj-green" : "tj-red"}>{trade.direction}</em></span><span>{new Date(`${trade.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span><em className="tj-sesspill">{trade.entrySession || trade.session || "—"}</em></span><span>{trade.entryType || trade.confluenceSession || "—"}</span><span><em className="tj-sesspill">{trade.premarketMarkupId ? "Linked" : "—"}</em></span><span>{(trade.confluence || trade.types || []).length ? <span className="tj-review-table-tags">{(trade.confluence || trade.types || []).map((item) => <em key={item}>{item}</em>)}</span> : "—"}</span><span>{trade.mistakes?.length || 0}</span><span className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</span><span><strong>{Number(trade.rr || 0).toFixed(2)}R</strong></span></button>)}</div> : <div className="tj-empty">Every closed trade already has a saved review.</div>}</Card>
    {activePeriodLive && <PeriodReviewModal period={activePeriodLive} saved={savedByPeriod.get(`${activePeriodLive.type}:${activePeriodLive.key}`)} reviews={reviews} onClose={() => setActivePeriod(null)} onSave={onSavePeriod} onStartTradeReview={(trade, existing) => setTradeEditor({ trade, existing })} />}
    {tradeEditor && <TradeReviewEditorModal trade={tradeEditor.trade} trades={[tradeEditor.trade, ...pending.filter((item) => item.id !== tradeEditor.trade.id)]} existing={tradeEditor.existing || reviews.find((review) => review.tradeId === tradeEditor.trade.id)} reviews={reviews} markups={markups} account={account} onClose={() => setTradeEditor(null)} onSave={onSaveTrade} />}
  </div>;
}

function AddAccountModal({ onClose, onCreate }) {
  const [challengeEnabled, setChallengeEnabled] = useState(false);
  const [challengeStartingBalance, setChallengeStartingBalance] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(10000);
  const [platform, setPlatform] = useState("Manual");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState("");
  const [importingTrades, setImportingTrades] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("");
  const [breakevenCap, setBreakevenCap] = useState(0);
  const [defaultCommission, setDefaultCommission] = useState(0);
  const [monthlyGoalPct, setMonthlyGoalPct] = useState("");
  const [yearlyGoalPct, setYearlyGoalPct] = useState("");
  const [monthlyGoalAmount, setMonthlyGoalAmount] = useState("");
  const [yearlyGoalAmount, setYearlyGoalAmount] = useState("");
  const [monthlyGoalSource, setMonthlyGoalSource] = useState("percentage");
  const [yearlyGoalSource, setYearlyGoalSource] = useState("percentage");
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState("");
  const [monthlyLossLimitPct, setMonthlyLossLimitPct] = useState("");
  const [positionSizeEnabled, setPositionSizeEnabled] = useState(false);
  const [defaultRiskPct, setDefaultRiskPct] = useState(1);
  const [defaultStopLossPips, setDefaultStopLossPips] = useState("");
  const [open, setOpen] = useState({ identity: false, defaults: false, goals: false, guardrails: false, position: false });
  const [creating, setCreating] = useState(false);
  const accountId = useRef(uuid()).current;
  const toggle = (section) => setOpen((current) => ({ ...current, [section]: !current[section] }));
  const accountBase = Number(balance) || 0;
  const moneyFromPercentage = (percentage, base) => Number(percentage) > 0 && base > 0 ? Number((Number(percentage) * base / 100).toFixed(2)) : "";
  const percentageFromMoney = (amount, base) => Number(amount) > 0 && base > 0 ? Number((Number(amount) / base * 100).toFixed(4)) : "";
  const monthlyTarget = monthlyGoalSource === "amount" ? Number(monthlyGoalAmount) || 0 : accountBase * (Number(monthlyGoalPct) || 0) / 100;
  const yearlyTarget = yearlyGoalSource === "amount" ? Number(yearlyGoalAmount) || 0 : accountBase * (Number(yearlyGoalPct) || 0) / 100;
  const dailyLimit = accountBase * (Number(dailyLossLimitPct) || 0) / 100;
  const monthlyLimit = accountBase * (Number(monthlyLossLimitPct) || 0) / 100;
  const setMonthlyGoalPercentage = (value) => { setMonthlyGoalPct(value); setMonthlyGoalAmount(moneyFromPercentage(value, accountBase)); setMonthlyGoalSource("percentage"); };
  const setYearlyGoalPercentage = (value) => { setYearlyGoalPct(value); setYearlyGoalAmount(moneyFromPercentage(value, accountBase)); setYearlyGoalSource("percentage"); };
  const setMonthlyGoalMoney = (value) => { setMonthlyGoalAmount(value); setMonthlyGoalPct(percentageFromMoney(value, accountBase)); setMonthlyGoalSource("amount"); };
  const setYearlyGoalMoney = (value) => { setYearlyGoalAmount(value); setYearlyGoalPct(percentageFromMoney(value, accountBase)); setYearlyGoalSource("amount"); };
  const setDailyLossMoney = (value) => setDailyLossLimitPct(percentageFromMoney(value, accountBase));
  const setMonthlyLossMoney = (value) => setMonthlyLossLimitPct(percentageFromMoney(value, accountBase));
  const setStartingBalance = (value) => {
    const nextBase = Number(value) || 0;
    setBalance(value);
    if (monthlyGoalSource === "amount") setMonthlyGoalPct(percentageFromMoney(monthlyGoalAmount, nextBase)); else setMonthlyGoalAmount(moneyFromPercentage(monthlyGoalPct, nextBase));
    if (yearlyGoalSource === "amount") setYearlyGoalPct(percentageFromMoney(yearlyGoalAmount, nextBase)); else setYearlyGoalAmount(moneyFromPercentage(yearlyGoalPct, nextBase));
  };
  const create = async () => {
    if (!name.trim() || !baseCurrency || (platform === "Manual" && !(Number(balance) > 0)) || creating) return;
    setCreating(true);
    setImportProgress(0); setImportingTrades(!!importPreview.trades?.length);
    const created = await onCreate({ challengeEnabled: isChallengeEnabled({challengeEnabled, challengeStartingBalance}), challengeStartingBalance: Number(challengeStartingBalance) || 0, id: accountId, name: name.trim(), icon: baseCurrency, profileImage: "", platform, balance: accountBase, breakevenCap: parseFloat(breakevenCap) || 0, ratingStyle: "stars", theme: "dark", defaultCommission: parseFloat(defaultCommission) || 0, monthlyGoalPct: parseFloat(monthlyGoalPct) || 0, yearlyGoalPct: parseFloat(yearlyGoalPct) || 0, monthlyGoalAmount: parseFloat(monthlyGoalAmount) || 0, yearlyGoalAmount: parseFloat(yearlyGoalAmount) || 0, monthlyGoalSource, yearlyGoalSource, dailyLossLimitPct: parseFloat(dailyLossLimitPct) || 0, monthlyLossLimitPct: parseFloat(monthlyLossLimitPct) || 0, positionSizeEnabled, baseCurrency, defaultRiskPct: parseFloat(defaultRiskPct) || 0, defaultStopLossPips: parseFloat(defaultStopLossPips) || 0, trades: [], rules: [], checkins: {} }, importPreview, setImportProgress);
    if (!created) { setCreating(false); setImportingTrades(false); }
  };
  return (
    <Modal title="New Account Workspace" onClose={onClose} onConfirm={create} confirmDisabled={!name.trim() || !baseCurrency || creating} className="tj-new-account-modal" wide>
      <div className="tj-settings-account-hero tj-new-account-hero tj-settings-account-hero-no-avatar">
        <div className="tj-settings-hero-copy"><span>NEW ACCOUNT BLUEPRINT</span><strong>{name.trim() || "Untitled Account"}</strong><p>Set up the account once, then let goals and guardrails carry through the dashboard, analytics, and daily workflow.</p></div>
        <div className="tj-settings-hero-metrics"><div><small>STARTING BALANCE</small><b>{fmtMoneyShort(accountBase, baseCurrency)}</b><span>Funding base</span></div><div className={monthlyGoalPct ? "tj-settings-goal-on" : ""}><small>MONTHLY GOAL</small><b>{monthlyGoalPct ? fmtMoneyShort(monthlyTarget, baseCurrency) : "Optional"}</b><span>{monthlyGoalPct ? `+${Number(monthlyGoalPct).toFixed(2)}% target` : "Set a monthly target"}</span></div><div className={yearlyGoalPct ? "tj-settings-goal-on" : ""}><small>YEARLY GOAL</small><b>{yearlyGoalPct ? fmtMoneyShort(yearlyTarget, baseCurrency) : "Optional"}</b><span>{yearlyGoalPct ? `+${Number(yearlyGoalPct).toFixed(2)}% target` : "Keep the long runway open"}</span></div><div className={dailyLossLimitPct ? "tj-settings-risk-on" : ""}><small>DAILY LOSS</small><b>{dailyLossLimitPct ? fmtMoneyShort(-dailyLimit, baseCurrency) : "Optional"}</b><span>{dailyLossLimitPct ? `${Number(dailyLossLimitPct).toFixed(2)}% cap` : "No daily lock"}</span></div><div className={monthlyLossLimitPct ? "tj-settings-risk-on" : ""}><small>MONTHLY LOSS</small><b>{monthlyLossLimitPct ? fmtMoneyShort(-monthlyLimit, baseCurrency) : "Optional"}</b><span>{monthlyLossLimitPct ? `${Number(monthlyLossLimitPct).toFixed(2)}% cap` : "No monthly lock"}</span></div></div>
      </div>
      <AccountSettingsSection title="Identity & Account Currency" note="Choose how this account is normally logged. Imports never remove manual trade entry." status={baseCurrency || "Currency required"} isOpen={open.identity} onToggle={() => toggle("identity")}>
        <div className="tj-grid2"><Field label="Display Name"><input className="tj-input" placeholder="e.g. Photon Prop Eval" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Trading platform"><select className="tj-input" value={platform} onChange={(event) => setPlatform(event.target.value)}><option>Manual</option><option>MetaTrader 4/5</option><option>cTrader</option></select></Field></div>
        <Field label={`Starting Balance (${baseCurrency || "Currency"}) ${platform === "Manual" ? "*" : "(optional for import accounts)"}`}><input type="number" min="0" className="tj-input" value={balance} onChange={(event) => setStartingBalance(event.target.value)} /></Field>
        <Field label="Import trade history (optional)"><input className="tj-input" type="file" accept=".html,.htm,.csv,.txt,.tsv" disabled={creating} onChange={async (event) => { const file = event.target.files?.[0] || null; setImportFile(file); setImportPreview([]); setImportError(""); setImportProgress(0); if (!file) return; const parsed = await parseBrokerFile(file); if (!parsed.trades.length) setImportError("No completed BUY or SELL trades were found in this file."); else setImportPreview(parsed); }} />{importFile && <div className="tj-settings-hint">{importFile.name}{importPreview.trades?.length ? ` · ${importPreview.trades.length} trades${importPreview.cashMovements?.length ? ` and ${importPreview.cashMovements.length} cash movement${importPreview.cashMovements.length === 1 ? "" : "s"}` : ""} will import when you create this account` : ""}</div>}{importingTrades && <div className="tj-settings-hint tj-import-live"><i className="tj-import-progress" style={{ "--progress": `${importProgress}%` }}>{importProgress}%</i>Importing {platform} trades…</div>}{importError && <div className="tj-import-error">{importError}</div>}</Field>
        <Field label="Account Base Currency *"><select required className="tj-input" value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}><option value="" disabled>Select a currency</option>{ACCOUNT_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.label} ({currency.symbol})</option>)}</select></Field>
      </AccountSettingsSection>
      <AccountSettingsSection title="Journal Defaults" note="Tune how new trades are graded and pre-filled across the journal." status={`B/E ${fmtMoneyShort(Number(breakevenCap) || 0, baseCurrency)} · Fee ${fmtMoneyShort(Number(defaultCommission) || 0, baseCurrency)}`} isOpen={open.defaults} onToggle={() => toggle("defaults")}>
        <div className="tj-grid2"><Field label={`Breakeven Cap (${baseCurrency || "Currency"})`}><input type="number" min="0" className="tj-input" value={breakevenCap} onChange={(event) => setBreakevenCap(event.target.value)} /><div className="tj-chip-row">{[0, 10, 20, 35, 50].map((value) => <button type="button" key={value} className={`tj-chip ${Number(breakevenCap) === value ? "tj-chip-active" : ""}`} onClick={() => setBreakevenCap(value)}>{fmtMoneyShort(value, baseCurrency)}</button>)}</div></Field><Field label={`Default Commission (${baseCurrency || "Currency"} per trade)`}><input type="number" min="0" className="tj-input" value={defaultCommission} onChange={(event) => setDefaultCommission(event.target.value)} /></Field></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Goals" note="Optional monthly and yearly targets that appear in analytics and review summaries." status={monthlyGoalPct || yearlyGoalPct ? "Active" : "Optional"} isOpen={open.goals} onToggle={() => toggle("goals")}>
        <div className="tj-grid4 tj-settings-linked-grid"><LinkedPercentageAmountCards label="Monthly Growth Goal" currency={baseCurrency} percentage={monthlyGoalPct} amount={monthlyGoalAmount} onPercentageChange={setMonthlyGoalPercentage} onAmountChange={setMonthlyGoalMoney} /><LinkedPercentageAmountCards label="Yearly Growth Goal" currency={baseCurrency} percentage={yearlyGoalPct} amount={yearlyGoalAmount} onPercentageChange={setYearlyGoalPercentage} onAmountChange={setYearlyGoalMoney} /></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Risk Guardrails" note="Optional loss caps that pause trade execution when a limit is reached." status={dailyLossLimitPct || monthlyLossLimitPct ? "Active" : "Optional"} isOpen={open.guardrails} onToggle={() => toggle("guardrails")}>
        <div className="tj-grid4 tj-settings-linked-grid"><LinkedPercentageAmountCards label="Daily Loss Limit" currency={baseCurrency} percentage={dailyLossLimitPct} amount={dailyLimit ? Number(dailyLimit.toFixed(2)) : ""} onPercentageChange={setDailyLossLimitPct} onAmountChange={setDailyLossMoney} /><LinkedPercentageAmountCards label="Monthly Loss Limit" currency={baseCurrency} percentage={monthlyLossLimitPct} amount={monthlyLimit ? Number(monthlyLimit.toFixed(2)) : ""} onPercentageChange={setMonthlyLossLimitPct} onAmountChange={setMonthlyLossMoney} /></div>
      </AccountSettingsSection>
      <AccountSettingsSection title="Challenge" note="Enable the 30 Level Challenge for this account." status={challengeEnabled ? "On" : "Off"} isOpen={open.challenge} onToggle={() => toggle("challenge")}>
        <Field label={`Challenge starting balance (${baseCurrency || "USD"})`}><input className="tj-input" type="number" min="0.01" step="any" value={challengeStartingBalance} placeholder="Enter a starting amount" onChange={event => {setChallengeStartingBalance(event.target.value); if (!(Number(event.target.value) > 0)) setChallengeEnabled(false);}}/></Field>
        <label className="tj-settings-switch-row"><button type="button" role="switch" aria-label="Enable Challenge" aria-checked={challengeEnabled} disabled={!(Number(challengeStartingBalance) > 0)} className={`tj-settings-switch ${challengeEnabled ? "tj-settings-switch-on" : ""}`} onClick={() => setChallengeEnabled(value => !value)}><i/></button><span><strong>Enable Challenge</strong><small>Starts at Level 1 in manual mode. Choose an automation mode in Account Settings after creation.</small></span></label>
      </AccountSettingsSection>
      <AccountSettingsSection title="Position Size Calculator" note="Optional risk-based lot sizing for new trades." status={positionSizeEnabled ? "On" : "Off"} isOpen={open.position} onToggle={() => toggle("position")}>
        <label className="tj-settings-switch-row"><button type="button" role="switch" aria-checked={positionSizeEnabled} className={`tj-settings-switch ${positionSizeEnabled ? "tj-settings-switch-on" : ""}`} onClick={() => setPositionSizeEnabled((enabled) => !enabled)}><i /></button><span><strong>Enable Position Size Calculator</strong><small>Show live risk-based lot suggestions in Log Trade.</small></span></label><div className="tj-grid2"><Field label="Default Risk % Per Trade"><input type="number" min="0" step="0.1" className="tj-input" disabled={!positionSizeEnabled} value={defaultRiskPct} onChange={(event) => setDefaultRiskPct(event.target.value)} /></Field><Field label="Default Stop Loss (Pips)"><input type="number" min="0" className="tj-input" disabled={!positionSizeEnabled} value={defaultStopLossPips} placeholder="Optional" onChange={(event) => setDefaultStopLossPips(event.target.value)} /></Field></div>
      </AccountSettingsSection>
      <div className="tj-modal-actions">
        <button className="tj-btn-outline" onClick={onClose}>Cancel</button>
        <button className="tj-btn-primary" disabled={!name.trim() || !baseCurrency || (platform === "Manual" && !(Number(balance) > 0)) || creating || !!importError} onClick={create}>{creating ? (importingTrades ? <><i className="tj-import-progress" style={{ "--progress": `${importProgress}%` }}>{importProgress}%</i>Importing trades</> : "Creating…") : importPreview.trades?.length ? `Create Account & Import ${importPreview.trades.length} Trades` : "Create Account"}</button>
      </div>
    </Modal>
  );
}

/* ============================ DAY TRADES MODAL =========================== */

function DayTradesModal({ date, trades, reviews = [], movements = [], account, onClose, onEdit, onDelete, locked = false }) {
  const d = new Date(date + "T00:00:00");
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const datedRecords = reviews.map((review) => ({ id: review.id, time: review.time }))
    .sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
  return (
    <Modal title={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClose={onClose} className="tj-calendar-day-modal" centered>
      <div className="tj-daymodal-summary">
        <span className={dayPnl >= 0 ? "tj-green" : "tj-red"} style={{ fontWeight: 700, fontSize: 19.44 }}>{fmtMoney(dayPnl)}</span>
        <span className="tj-muted-txt"> · {trades.length} trade{trades.length !== 1 ? "s" : ""}{movements.length ? ` · ${movements.length} cash movement${movements.length === 1 ? "" : "s"}` : ""}</span>
      </div>
      {movements.length > 0 && <section className="tj-day-cash-list"><strong>CASH MOVEMENTS</strong>{movements.map((movement) => { const label = movement.type === "deposit" ? "Deposit" : movement.type === "transfer" ? "Transfer to savings" : `Withdrawal from ${movement.source === "savings" ? "savings" : "trading"}`; const tone = movement.type === "deposit" ? "tj-green" : movement.type === "withdrawal" ? "tj-red" : "tj-purple-txt"; return <div key={movement.id} className="tj-day-cash-item"><span>{label}{movement.note ? ` · ${movement.note}` : ""}</span><b className={tone}>{movement.type === "deposit" ? "+" : "-"}{fmtMoney(Math.abs(movement.amount)).replace(/^\+/, "")}</b></div>; })}</section>}
      {datedRecords.length > 0 && <div className="tj-day-record-list">{datedRecords.map((record) => <div className="tj-day-record" key={record.id}><span>{formatTime(record.time)}</span><span>Trade Review</span></div>)}</div>}
      <div className="tj-day-trade-list">
        {trades.map((t) => {
          const cls = classify(t.pnl, account.breakevenCap);
          const tags = t.confluence || t.types || [];
          return <div key={t.id} className={`tj-day-trade tj-day-trade-${cls}`}>
            <div className="tj-day-trade-head">
              <div className="tj-day-trade-identity">
                <strong>{t.asset}</strong>
                <div><span className={t.direction === "BUY" ? "tj-green" : "tj-red"}>{t.direction}</span><span>{t.entrySession || t.session}</span></div>
              </div>
              <div className="tj-day-trade-result">
                <strong className={cls === "be" ? "tj-blue" : t.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(t.pnl)}</strong>
                {Number(t.rr) !== 0 && Number.isFinite(Number(t.rr)) && <small>{Number(t.rr).toFixed(2)}R</small>}
              </div>
            </div>
            {tags.length > 0 && <div className="tj-day-trade-tags" title={tags.join(" · ")}>{tags.slice(0, 2).join(" · ")}{tags.length > 2 ? ` +${tags.length - 2}` : ""}</div>}
            <div className="tj-day-trade-footer">
              <div className="tj-day-trade-shots">{(t.screenshots || []).map((src, i) => <ImagePreview key={i} src={src} alt={`Trade Screenshot ${i + 1}`} />)}</div>
              <div className="tj-day-trade-actions">
                <button type="button" className="tj-icon-btn" disabled={locked} title={locked ? "Trade changes are locked by the account loss limit" : "Edit trade"} aria-label="Edit trade" onClick={() => onEdit(t)}><Pencil size={14}/></button>
                <ConfirmDeleteButton type="button" className="tj-icon-btn tj-day-trade-delete" disabled={locked} title={locked ? "Trade changes are locked by the account loss limit" : "Delete trade"} aria-label="Delete trade" onClick={() => onDelete(t.id)}><Trash2 size={14}/></ConfirmDeleteButton>
              </div>
            </div>
          </div>;
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
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 12 }} />
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
              <XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), "Cumulative"]} />
              <Area type="monotone" dataKey="cum" stroke={UI_COLORS.primary} fill="url(#cumGrad)" strokeWidth={2.5} dot={{ r: 3, fill: UI_COLORS.primary, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="tj-panel">
          <div className="tj-panel-head"><span>Daily P&L</span><span className="tj-pill tj-pill-neutral">{stats.wins}/{stats.total}</span></div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyData}>
              <CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [fmtMoney(v), "P&L"]} />
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

function GuardrailMetric({ label, value, target, meterLabel, status, note, footerLeft, footerRight, loss = false, hit = false, tone = "green" }) {
  const rawPercent = target ? (Math.max(0, value) / target) * 100 : 0;
  const percent = clamp(rawPercent, 0, 100);
  const shownPercent = `${rawPercent > 0 && !loss ? "+" : ""}${rawPercent.toFixed(rawPercent >= 100 ? 1 : 1)}%`;
  return <div className={`tj-guardrail-metric tj-guardrail-${tone} ${loss && hit ? "tj-guardrail-hit" : ""}`}>
    <div className="tj-guardrail-card-main">
      <div className="tj-guardrail-copy"><div className="tj-mlabel">{label}</div><div className={loss && hit ? "tj-red tj-guardrail-value" : "tj-guardrail-value"}>{fmtMoney(value)} <span>/ {loss ? fmtMoney(-target) : fmtMoney(target)}</span></div><b className={`tj-guardrail-status ${loss && hit ? "tj-guardrail-status-hit" : ""}`}>{status}</b></div>
      <div className="tj-guardrail-meter"><strong>{shownPercent}</strong><span>{meterLabel}</span><i><b style={{ width: `${percent}%` }}/></i></div>
    </div>
    <p>{hit ? "Limit reached — trade entry paused" : note}</p>
    <footer><span>{footerLeft}</span><strong>{footerRight}</strong></footer>
  </div>;
}

function AccountGuardrailsPanel({ account, guardrails, stats, periodDate = new Date() }) {
  if (!guardrails?.enabled) return null;
  const year = periodDate.getFullYear();
  const month = periodDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStats = computeStats(account.trades.filter((trade) => trade.date?.slice(0, 7) === monthKey), account.breakevenCap);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTrades = account.trades.filter((trade) => trade.date === todayKey).length;
  const monthGoalProgress = guardrails.monthlyGoal ? Math.max(0, guardrails.monthlyPnl) / guardrails.monthlyGoal * 100 : 0;
  const yearGoalProgress = guardrails.yearlyGoal ? Math.max(0, guardrails.yearlyPnl) / guardrails.yearlyGoal * 100 : 0;
  return <Card className="tj-panel tj-guardrails">
    <div className="tj-guardrails-head"><div><span>ACCOUNT GUARDRAILS</span><strong>Targets and limits are active</strong><p>Loss caps use the live trading balance of {fmtMoney(guardrails.guardrailBalance)}, rather than the original starting balance.</p></div><span className={`tj-pill ${guardrails.tradeEntryLocked ? "tj-pill-red" : "tj-pill-green"}`}>{guardrails.tradeEntryLocked ? "Paused" : "Live"}</span></div>
    <div className="tj-guardrail-grid">
      {guardrails.monthlyGoalPct > 0 && <GuardrailMetric label={`${MONTH_NAMES[month].toUpperCase()} ${year} GOAL`} value={guardrails.monthlyPnl} target={guardrails.monthlyGoal} meterLabel="OF TARGET" status={monthGoalProgress >= 100 ? "CLEARED" : "BUILDING"} note={`${fmtMoney(Math.max(0, guardrails.monthlyGoal - guardrails.monthlyPnl))} left this month`} footerLeft={`${monthStats.total} trade${monthStats.total === 1 ? "" : "s"} this month`} footerRight="Month pace" />}
      {guardrails.yearlyGoalPct > 0 && <GuardrailMetric tone="blue" label={`${year} GOAL`} value={guardrails.yearlyPnl} target={guardrails.yearlyGoal} meterLabel="YEAR PACE" status={yearGoalProgress >= 100 ? "CLEARED" : "BUILDING"} note={yearGoalProgress >= 100 ? `${fmtMoney(guardrails.yearlyPnl - guardrails.yearlyGoal)} above target` : `${fmtMoney(guardrails.yearlyGoal - guardrails.yearlyPnl)} left this year`} footerLeft={`${stats.total} trade${stats.total === 1 ? "" : "s"} this year`} footerRight={yearGoalProgress >= 100 ? "Year cleared" : "Year pace"} />}
      {guardrails.dailyLossLimitPct > 0 && <GuardrailMetric loss label="DAILY LOSS CAP" value={Math.max(0, -guardrails.dailyPnl)} target={guardrails.dailyLossCap} meterLabel="USED TODAY" status={guardrails.dailyLossHit ? "PAUSED" : "OPEN"} note={`${fmtMoney(Math.max(0, guardrails.dailyLossCap + Math.min(0, guardrails.dailyPnl)))} buffer left today`} footerLeft={`${todayTrades} trade${todayTrades === 1 ? "" : "s"} today`} footerRight="Live-balance cap" hit={guardrails.dailyLossHit} />}
      {guardrails.monthlyLossLimitPct > 0 && <GuardrailMetric loss label="MONTHLY LOSS CAP" value={Math.max(0, -guardrails.monthlyPnl)} target={guardrails.monthlyLossCap} meterLabel="USED THIS MONTH" status={guardrails.monthlyLossHit ? "PAUSED" : "OPEN"} note={`${fmtMoney(Math.max(0, guardrails.monthlyLossCap + Math.min(0, guardrails.monthlyPnl)))} buffer left this month`} footerLeft={`${monthStats.total} trade${monthStats.total === 1 ? "" : "s"} this month`} footerRight="Live-balance cap" hit={guardrails.monthlyLossHit} />}
    </div>
    <div className="tj-guardrails-footer">When a loss limit is hit, trade logging pauses until the next reset period while markups stay open for preparation and review.</div>
  </Card>;
}

function ChallengeDashboardProgress({ account, challenge }) {
  if (!isChallengeEnabled(account) || challenge.loading || challenge.error) return null;
  const passed = Object.values(challenge.state.statuses || {}).filter((status) => status === "Pass").length;
  const currentLevel = clamp(Number(challenge.state.activeLevel) || 1, 1, 30);
  const tier = currentLevel <= 10 ? "start" : currentLevel <= 20 ? "middle" : "finish";
  return <div className={`tj-challenge-dashboard-progress tj-challenge-dashboard-${tier}`}>
    <div><span>LEVELS PASSED</span><strong>{passed} / 30</strong></div>
    <i aria-label={`Challenge progress: ${passed} of 30 levels passed`}><b style={{ width: `${passed / 30 * 100}%` }} /></i>
  </div>;
}

function ReferenceDashboardPage({ account, stats, monthCursor, setMonthCursor, onDayClick, guardrails, displayName, loginQuote, challenge }) {
  const [view, setView] = useState("flow");
  const year = monthCursor.getFullYear(), month = monthCursor.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTrades = account.trades.filter((trade) => trade.date?.slice(0, 7) === monthKey);
  const monthStats = computeStats(monthTrades, account.breakevenCap);
  const recentTrades = [...account.trades].sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)).slice(0, 8);
  const monthRecentTrades = [...monthTrades].sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)).slice(0, 8);
  const lastSix = monthRecentTrades.slice(0, 6).reverse();
  // Dashboard headline metrics are all-time. The month-specific cards below
  // remain scoped to the selected calendar month.
  const thisYearStats = stats;
  const liveAccountBalance = financeTotals(account).tradingBalance;
  const bestSession = SESSIONS.map((session) => ({ session, pnl: monthTrades.filter((trade) => normalizeSession(trade.entrySession || trade.session) === session).reduce((sum, trade) => sum + trade.pnl, 0) })).sort((a, b) => b.pnl - a.pnl)[0];
  const hotPair = Object.entries(monthTrades.reduce((all, trade) => ({ ...all, [trade.asset]: (all[trade.asset] || 0) + trade.pnl }), {})).sort((a, b) => b[1] - a[1])[0];
  const lastSixPnl = lastSix.reduce((sum, trade) => sum + trade.pnl, 0);
  const equityBeforeLastSix = account.balance + stats.netPnl - lastSixPnl;
  const flowPct = equityBeforeLastSix ? (lastSixPnl / equityBeforeLastSix) * 100 : 0;
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
    <AccountGuardrailsPanel account={account} guardrails={guardrails} stats={thisYearStats} periodDate={monthCursor}/>

    <div className="tj-reference-kpis">
      <Card className="tj-reference-kpi tj-kpi-equity"><div className="tj-kpi-top"><div className="tj-stat-label">ALL-TIME NET P&amp;L</div><span>{allTimeReturn >= 0 ? "+" : ""}{allTimeReturn.toFixed(2)}%</span></div><div className={`tj-reference-kpi-value ${thisYearStats.netPnl >= 0 ? "tj-green" : "tj-red"}`}>{fmtMoney(thisYearStats.netPnl)}</div><div className="tj-stat-sub">Starting balance {fmtMoney(account.balance)}</div><div className="tj-kpi-spark"><ResponsiveContainer width="100%" height={26}><AreaChart data={cumulative}><Area type="monotone" dataKey="cumulative" stroke={UI_COLORS.primary} fill="none" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></div><small>Live balance {fmtMoney(liveAccountBalance)} · Streak {thisYearStats.streak ? `${thisYearStats.streakType === "loss" ? "-" : "+"}${thisYearStats.streak}` : "—"}</small></Card>
      <Card className="tj-reference-kpi tj-kpi-profit"><div className="tj-kpi-top"><div className="tj-stat-label">PROFIT FACTOR</div><span className={thisYearStats.profitFactor >= 1.5 ? "tj-green" : "tj-red"}>{thisYearStats.profitFactor >= 1.5 ? "healthy" : "needs work"}</span></div><div className="tj-reference-kpi-value">{thisYearStats.profitFactor.toFixed(2)}</div><div className="tj-kpi-line"><i style={{width: `${clamp(norm(thisYearStats.profitFactor, 5), 0, 100)}%`}}/></div><div className="tj-stat-sub">Risk-adjusted payoff quality.</div><small>Recovery {thisYearStats.recovery.toFixed(0)}% <em>Core Score {thisYearStats.thunderScore}</em></small></Card>
      <Card className="tj-reference-kpi tj-kpi-days"><div className="tj-kpi-top"><div className="tj-stat-label">DAY WIN %</div></div><div className={`tj-reference-kpi-value ${wrColorClass(thisYearStats.dayWinRate)}`}>{thisYearStats.dayWinRate.toFixed(2)}%</div><div className="tj-day-bar-strip">{dayWinBars.length ? dayWinBars.map((day) => <i key={day.date} className={day.cls === "win" ? "tj-day-bar-win" : day.cls === "loss" ? "tj-day-bar-loss" : "tj-day-bar-be"}/>) : <span>No completed days</span>}</div><div className="tj-stat-sub">{monthStats.dayClasses.length} trading day{monthStats.dayClasses.length === 1 ? "" : "s"} this month</div></Card>
      <Card className="tj-reference-kpi tj-kpi-winrate"><div className="tj-kpi-top"><div className="tj-stat-label">WIN RATE %</div><span>{thisYearStats.total} total</span></div><div className={`tj-reference-kpi-value ${wrColorClass(thisYearStats.winRate)}`}>{thisYearStats.winRate.toFixed(2)}%</div><div className="tj-kpi-split"><i style={{width: `${thisYearStats.winRate}%`}}/><b style={{width: `${100 - thisYearStats.winRate}%`}}/></div><div className="tj-stat-sub"><strong className="tj-green">{thisYearStats.wins} wins</strong><strong className="tj-red">{thisYearStats.losses} losses</strong></div><ChallengeDashboardProgress account={account} challenge={challenge}/></Card>
      <Card className="tj-reference-kpi tj-kpi-payoff"><div className="tj-kpi-top"><div className="tj-stat-label">AVG WIN/LOSS TRADE</div><span>{thisYearStats.avgWinLoss >= 1.5 ? "strong" : "building"}</span></div><div className="tj-reference-kpi-value">{thisYearStats.avgLoss ? thisYearStats.avgWinLoss.toFixed(2) : "—"}</div><div className="tj-kpi-split"><i style={{width: `${payoffSegment}%`}}/><b style={{width: `${100 - payoffSegment}%`}}/></div><div className="tj-stat-sub">Winner vs loser edge.</div><small>Best run {thisYearStats.bestWinStreak}W <em>Max loss run {thisYearStats.bestLossStreak}L</em></small></Card>
    </div>

    <div className="tj-reference-hero-grid">
      <AttachedPnlCalendar account={account} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={onDayClick}/>
      <Card className="tj-panel tj-reference-flow">
        <div className="tj-reference-flow-head"><div><strong>Performance Flow</strong><span>Current month pulse across {MONTH_NAMES[month]} closes, strongest context and how the latest outcomes are landing.</span></div><div className="tj-tabs"><button className={`tj-tab ${view === "recent" ? "tj-tab-active" : ""}`} onClick={() => setView("recent")}>Recent Trades</button><button className={`tj-tab ${view === "flow" ? "tj-tab-active" : ""}`} onClick={() => setView("flow")}>Performance Flow</button></div></div>
        <div className="tj-view-transition" key={view}>{view === "recent" ? <div className="tj-recent-table"><div className="tj-recent-head"><span>Close Date</span><span>Instrument</span><span>Side</span><span>Session</span><span>Net P&amp;L</span></div>{recentTrades.length ? recentTrades.map((trade) => <div className="tj-recent-row" key={trade.id}><span>{trade.date} · {formatTime(trade.time)}</span><strong>{trade.asset}</strong><span className={trade.direction === "BUY" ? "tj-green" : "tj-red"}>{trade.direction}</span><span>{trade.entrySession || trade.session || "—"}</span><strong className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</strong></div>) : <div className="tj-empty">No trades yet. Your newest completed trade will appear here.</div>}</div> : <><div className="tj-reference-flow-metrics"><div><span>LAST 6 CLOSES</span><strong className={flowPct >= 0 ? "tj-green" : "tj-red"}>{flowPct >= 0 ? "+" : ""}{flowPct.toFixed(2)}%</strong><small>{fmtMoney(lastSixPnl)}</small></div><div><span>BEST SESSION</span><strong>{monthTrades.length ? bestSession?.session || "—" : "—"}</strong><small className={bestSession?.pnl >= 0 ? "tj-green" : "tj-red"}>{monthTrades.length && bestSession ? fmtMoney(bestSession.pnl) : fmtMoney(0)}</small></div><div><span>HOT PAIR</span><strong>{hotPair?.[0] || "—"}</strong><small className={hotPair?.[1] >= 0 ? "tj-green" : "tj-red"}>{hotPair ? fmtMoney(hotPair[1]) : fmtMoney(0)}</small></div><div><span>CURRENT STREAK</span><strong className={stats.streakType === "loss" ? "tj-red" : "tj-green"}>{stats.streak ? `${stats.streakType === "loss" ? "-" : "+"}${stats.streak}` : "—"}</strong><small>{lastSixPositive}/{lastSix.length || 0} recent closes green</small></div></div><div className="tj-reference-flow-chart"><ResponsiveContainer width="100%" height={170}><AreaChart data={monthFlow} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}><defs><linearGradient id="dashboardFlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.26}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Month flow"]}/><Area type="monotone" dataKey="pnl" stroke={UI_COLORS.primary} fill="url(#dashboardFlow)" strokeWidth={2.25} dot={false}/></AreaChart></ResponsiveContainer></div><div className="tj-reference-flow-trades">{monthRecentTrades.slice(0, 3).map((trade) => <div key={trade.id} className={trade.pnl >= 0 ? "tj-flow-trade-win" : "tj-flow-trade-loss"}><span className="tj-flow-trade-copy"><strong>{trade.asset}</strong><small><em className={trade.direction === "BUY" ? "tj-green" : "tj-red"}>{trade.direction}</em> · {trade.entrySession || trade.session || "—"} · {new Date(`${trade.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></span><span className="tj-flow-trade-result"><small>{Number(trade.rr) ? `${Number(trade.rr).toFixed(2)}R` : "—"}</small><b className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</b></span></div>)}</div></>}</div>
      </Card>
    </div>

    <div className="tj-dashboard-analytics-grid">
      <Card className="tj-panel tj-dashboard-core-score"><div className="tj-panel-head"><div><span>Core Score</span><div className="tj-muted-txt">Consistency, recovery and payoff quality.</div></div><strong>{thisYearStats.thunderScore}</strong></div><ResponsiveContainer width="100%" height={220}><RadarChart data={radarData} outerRadius={72}><PolarGrid stroke="var(--tj-chart-grid)"/><PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 12 }}/><Radar dataKey="value" stroke={UI_COLORS.primary} fill={UI_COLORS.primary} fillOpacity={.24}/></RadarChart></ResponsiveContainer><div className="tj-core-score-metrics">{radarData.map((item) => <span key={item.metric}>{item.metric} <b>{item.metric === "PF" ? thisYearStats.profitFactor.toFixed(2) : item.metric === "Avg RR" ? thisYearStats.avgWinLoss.toFixed(2) : `${item.value.toFixed(0)}${item.metric === "Win rate" || item.metric === "Recovery" ? "%" : ""}`}</b></span>)}</div></Card>
      <Card className="tj-panel tj-dashboard-equity"><div className="tj-panel-head"><div><span>Daily Net Cumulative P&amp;L</span><div className="tj-muted-txt">Track how equity has built over time.</div></div><span className={`tj-pill ${allTimeReturn >= 0 ? "tj-pill-green" : "tj-pill-red"}`}>{allTimeReturn >= 0 ? "+" : ""}{allTimeReturn.toFixed(2)}%</span></div><ResponsiveContainer width="100%" height={280}><AreaChart data={cumulative}><defs><linearGradient id="dashboardEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.32}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Cumulative"]}/><Area type="monotone" dataKey="cumulative" stroke={UI_COLORS.primary} fill="url(#dashboardEquity)" strokeWidth={2.5} dot={false}/></AreaChart></ResponsiveContainer></Card>
      <Card className="tj-panel tj-dashboard-daily"><div className="tj-panel-head"><div><span>Net Daily P&amp;L</span><div className="tj-muted-txt">Green and red daily closes, day by day.</div></div><span className="tj-muted-txt">{dailyData.length} days</span></div><ResponsiveContainer width="100%" height={280}><BarChart data={dailyData}><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Net P&L"]}/><Bar dataKey="pnl" radius={[4, 4, 4, 4]}>{dailyData.map((day, index) => <Cell key={index} fill={day.cls === "loss" ? UI_COLORS.danger : day.cls === "be" ? UI_COLORS.info : UI_COLORS.primary}/>)}</Bar></BarChart></ResponsiveContainer></Card>
    </div>
  </div>;
}

/* ================================ TRADE LOG ============================= */

const importNumber = value => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
const importDate = value => { const raw=String(value||"").trim(); if (!raw) return ""; const match=raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if(!match)return ""; const [,y,m,d,a,b,c]=match; return y ? `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}` : `${c}-${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`; };
const importTime = value => { const match=String(value||"").match(/(\d{1,2}):(\d{2})/); if (!match) return ""; let hours=Number(match[1]); const suffix=String(value||"").match(/\b(am|pm)\b/i)?.[1]?.toLowerCase(); if (suffix === "pm" && hours < 12) hours += 12; if (suffix === "am" && hours === 12) hours = 0; return `${String(hours).padStart(2,"0")}:${match[2]}`; };
const splitImportLine = (line, delimiter) => { const cells = []; let value = ""; let quoted = false; for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (character === delimiter && !quoted) { cells.push(value.trim()); value = ""; } else value += character; } cells.push(value.trim()); return cells; };
const parseBrokerTrades = (text) => {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const rows = lines.map((line) => splitImportLine(line, delimiter));
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ""));
    return labels.some((label) => /(symbol|instrument|asset|market)/.test(label)) && labels.some((label) => /(type|side|direction)/.test(label));
  });
  if (headerIndex < 0) return [];
  const rawHeaders = rows.splice(0, headerIndex + 1).at(-1).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  let timeColumns = 0;
  const headers = rawHeaders.map((header) => {
    if (header === "time") { timeColumns += 1; return timeColumns === 1 ? "opentime" : "closetime"; }
    return header;
  });
  const valueAt = (row, ...keys) => { const index = headers.findIndex((header) => keys.some((key) => header === key || header.includes(key))); return index < 0 ? "" : row[index]; };
  const hasOpeningTimestamp = headers.some((header) => ["opentime", "openingtime", "entrytime", "opendate", "openingdate", "entrydate", "openingtimeutc", "opentimeutc"].some((key) => header === key || header.includes(key)));
  const isCTraderHistory = headers.some((header) => header === "openingdirection") && headers.some((header) => header === "closingtime" || header.includes("closingtime"));
  return rows.map((row) => {
    const side = String(valueAt(row, "type", "side", "tradetype", "direction")).toUpperCase();
    const entryMarker = String(valueAt(row, "entry", "direction")).trim().toUpperCase();
    if (!/(BUY|SELL)/.test(side)) return null; // skips broker balance, credit, and fee rows
    if (["IN", "OPEN"].includes(entryMarker)) return null; // MT5 deal reports list opening and closing legs separately
    // cTrader uses “Opening Time” and “Closing Time”, while exports from
    // other brokers commonly use “Open Time” and “Close Time”.
    // Some cTrader exports provide one timestamp column; others split the
    // date and time into two columns. Join either version before normalising.
    const timestampAt = (dateKeys, timeKeys) => {
      const date = valueAt(row, ...dateKeys);
      const time = valueAt(row, ...timeKeys);
      if (importDate(time)) return time;
      return [date, time].filter(Boolean).join(" ");
    };
    const opened = hasOpeningTimestamp ? timestampAt(["opendate", "openingdate", "entrydate", "openingdatetime"], ["opentime", "openingtime", "entrytime", "openingtimeutc", "opentimeutc", "time"]) : "";
    const closed = timestampAt(["closedate", "closingdate", "exitdate", "closingdatetime", "closedatetime"], ["closetime", "closingtime", "closedtime", "exittime", "closingtimeutc", "closetimeutc", "closetimestamp"]);
    const rawCommission = importNumber(valueAt(row, "commission"));
    const rawSwap = importNumber(valueAt(row, "swap"));
    // cTrader's closed-position CSV names this column "Net $" (normalised to
    // "net"), while other brokers tend to use Net P&L/Net profit.
    const netColumn = valueAt(row, "netprofit", "netpnl", "netpl", "net");
    const rawProfit = importNumber(netColumn || valueAt(row, "grossprofit", "profit", "pnl", "pl"));
    const hasNetColumn = String(netColumn).trim() !== "";
    const pnl = hasNetColumn ? rawProfit : rawProfit + rawCommission + rawSwap;
    const asset = valueAt(row, "symbol", "instrument", "asset", "market").replace(/\s+/g, "");
    const direction = side.includes("SELL") ? "SELL" : "BUY";
    // cTrader's standard CSV has no ticket field. Its symbol, direction,
    // closing timestamp and net result together identify a closed position well
    // enough to keep repeated uploads from creating duplicates.
    const importKey = `ctrader:${asset}:${direction}:${closed || opened}:${pnl}`;
    const legacyImportKey = `ctrader:${asset}:${direction}:${opened || closed}:${pnl}`;
    // This cTrader statement has Closing Time but no Opening Time column.
    // Use the closing day for journal grouping, but never pretend it was the
    // trade's entry time.
    const openingTimestampMissing = isCTraderHistory && !opened && !!closed;
    return { id: `import-${uid()}`, importKey, legacyImportKey, date: importDate(opened || closed), time: importTime(opened), closeDate: importDate(closed), closeTime: importTime(closed), openingTimestampMissing, asset, direction, grossPnl: hasNetColumn ? pnl + Math.abs(rawCommission) + Math.abs(rawSwap) : rawProfit, commission: Math.abs(rawCommission), swap: Math.abs(rawSwap), pnl, rr: 0, session: "", entrySession: "", rating: 0, types: [], confluence: [], mistakes: [], screenshots: [], context: `Imported cTrader position #${importKey}${openingTimestampMissing ? " [close-only]" : ""}` };
  }).filter((trade) => trade?.date && trade.asset && trade.asset.length <= 32 && /[a-z]/i.test(trade.asset));
};

const normaliseImportHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const importedValue = (headers, row, ...keys) => {
  const index = headers.findIndex((header) => keys.some((key) => header === key || header.includes(key)));
  return index < 0 ? "" : row[index] || "";
};
const parseMt5PositionRows = (rows) => {
  const positionHeading = rows.findIndex((row) => row.length && row.every((cell) => /^positions$/i.test(cell)));
  if (positionHeading < 0) return [];
  const headerIndex = rows.findIndex((row, index) => index > positionHeading && row.some((cell) => /symbol/i.test(cell)) && row.some((cell) => /^type$/i.test(cell.trim())));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(normaliseImportHeader);
  const end = rows.findIndex((row, index) => index > headerIndex && row.length && row.every((cell) => /^(orders|deals|summary)$/i.test(cell)));
  return rows.slice(headerIndex + 1, end < 0 ? undefined : end).map((row) => {
    const direction = String(importedValue(headers, row, "type")).toUpperCase();
    const ticket = String(importedValue(headers, row, "position")).trim();
    const asset = importedValue(headers, row, "symbol").replace(/\s+/g, "");
    const opened = importedValue(headers, row, "opentime", "time");
    const timeIndexes = headers.map((header, index) => header === "time" ? index : -1).filter((index) => index >= 0);
    const closed = timeIndexes[1] === undefined ? "" : row[timeIndexes[1]] || "";
    const rawCommission = importNumber(importedValue(headers, row, "commission"));
    const rawSwap = importNumber(importedValue(headers, row, "swap"));
    const grossPnl = importNumber(importedValue(headers, row, "profit"));
    const commission = Math.abs(rawCommission);
    const swap = Math.abs(rawSwap);
    // A journal trade's date/time are the opening timestamp. Keeping the close
    // timestamp separate is required for positions that span midnight.
    return /^(BUY|SELL)$/.test(direction) && ticket && asset && importDate(opened || closed) ? {
      id: `import-${uid()}`, importKey: `mt5-position:${ticket}`, date: importDate(opened || closed), time: importTime(opened || closed), closeDate: importDate(closed), closeTime: importTime(closed), asset, direction, grossPnl, commission, swap, pnl: grossPnl + rawCommission + rawSwap, rr: 0, session: "", entrySession: "", rating: 0, types: [], confluence: [], mistakes: [], screenshots: [], context: `Imported MetaTrader position #${ticket}`
    } : null;
  }).filter(Boolean);
};
const parseMt5CashMovements = (rows) => {
  const dealsHeading = rows.findIndex((row) => row.length && row.every((cell) => /^deals$/i.test(cell)));
  if (dealsHeading < 0) return [];
  const headerIndex = rows.findIndex((row, index) => index > dealsHeading && row.some((cell) => /^time$/i.test(cell.trim())) && row.some((cell) => /^balance$/i.test(cell.trim())));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(normaliseImportHeader);
  return rows.slice(headerIndex + 1).map((row) => {
    const type = String(importedValue(headers, row, "type")).toLowerCase();
    if (!/^(balance|credit)$/.test(type)) return null;
    const signedAmount = importNumber(importedValue(headers, row, "profit"));
    const date = importDate(importedValue(headers, row, "time"));
    if (!date || !signedAmount) return null;
    const note = importedValue(headers, row, "comment") || "Imported MetaTrader cash movement";
    return { type: signedAmount > 0 ? "deposit" : "withdrawal", amount: Math.abs(signedAmount), date, note: signedAmount > 0 ? `${importedAccountBaseNote} ${note}` : note, source: "trading" };
  }).filter(Boolean);
};
const parseCTraderHtmlReport = (rows) => {
  // cTrader's statement has a closed-position History table and a separate
  // Transactions table. Unlike MT5, the History rows already provide Net USD.
  const historyHeader = rows.findIndex((row) => {
    const labels = row.map(normaliseImportHeader);
    return labels.includes("symbol") && labels.includes("openingdirection") && labels.some((label) => label === "netusd" || label === "net");
  });
  const trades = historyHeader < 0 ? [] : parseBrokerTrades(rows.slice(historyHeader).map((row) => row.join("\t")).join("\n"));
  const transactionHeader = rows.findIndex((row) => {
    const labels = row.map(normaliseImportHeader);
    return labels.includes("type") && labels.some((label) => label.startsWith("amount")) && labels.some((label) => label.startsWith("time"));
  });
  if (transactionHeader < 0) return { trades, cashMovements: [] };
  const headers = rows[transactionHeader].map(normaliseImportHeader);
  const cashMovements = rows.slice(transactionHeader + 1).map((row) => {
    const kind = String(importedValue(headers, row, "type")).toLowerCase();
    if (!/^(deposit|withdrawal)$/.test(kind)) return null;
    const amount = importNumber(importedValue(headers, row, "amount"));
    const date = importDate(importedValue(headers, row, "time"));
    if (!amount || !date) return null;
    const note = importedValue(headers, row, "note") || "Imported cTrader cash movement";
    return { type: kind === "deposit" ? "deposit" : "withdrawal", amount: Math.abs(amount), date, note: kind === "deposit" ? `${importedAccountBaseNote} ${note}` : note, source: "trading" };
  }).filter(Boolean);
  return { trades, cashMovements };
};
const parseBrokerFile = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[1] === 0 && bytes[3] === 0);
  const text = new TextDecoder(isUtf16 ? "utf-16le" : "utf-8").decode(bytes);
  const isHtml = /\.html?$/i.test(file.name) || /^\s*<!doctype html|^\s*<html/i.test(text);
  if (!isHtml) return { trades: parseBrokerTrades(text), cashMovements: [] };
  const document = new DOMParser().parseFromString(text, "text/html");
  // MT5 writes responsive spacer cells (`class="hidden"`) into position rows.
  // They do not represent report columns, so retaining them shifts profit into the
  // wrong column and creates incorrect P&L.
  const directCells = (row) => [...row.children].filter((cell) => /^(TD|TH)$/.test(cell.tagName) && !cell.classList.contains("hidden")).flatMap((cell) => Array.from({ length: cell.colSpan || 1 }, () => cell.textContent.replace(/\s+/g, " ").trim()));
  const allRows = [...document.querySelectorAll("tr")].map(directCells).filter((row) => row.length);
  const cTraderReport = parseCTraderHtmlReport(allRows);
  if (cTraderReport.trades.length) return cTraderReport;
  const table = [...document.querySelectorAll("table")].find((candidate) => [...candidate.querySelectorAll("tr")].some((row) => {
    const labels = directCells(row).map((cell) => cell.toLowerCase());
    return labels.some((label) => /(symbol|instrument)/.test(label)) && labels.some((label) => /(type|side|direction)/.test(label));
  }));
  if (!table) return { trades: [], cashMovements: [] };
  const rows = [...table.querySelectorAll("tr")].map(directCells).filter((row) => row.length);
  const mt5Trades = parseMt5PositionRows(rows);
  if (mt5Trades.length) return { trades: mt5Trades, cashMovements: parseMt5CashMovements(rows) };
  const tsv = rows.map((row) => row.join("\t")).join("\n");
  return { trades: parseBrokerTrades(tsv), cashMovements: [] };
};
function ImportTradesModal({ account, onClose, onImport }) {
  const [platform, setPlatform] = useState(account.platform || "Manual"); const [trades, setTrades] = useState([]); const [busy, setBusy] = useState(false); const [fileError, setFileError] = useState("");
  const load = async (file) => { if (!file) return; const imported = await parseBrokerFile(file); setTrades(imported.trades); setFileError(imported.trades.length ? "" : "No closed BUY or SELL trades were found. Export the account history as HTML, CSV, or a tab-separated file."); };
  const submit = async () => { if (!trades.length || busy) return; setBusy(true); const ok = await onImport(trades); if (!ok) setBusy(false); };
  return <Modal title="Import trades" onClose={onClose} className="tj-import-modal" centered><p className="tj-muted-txt">Import a MetaTrader or cTrader HTML, CSV, or tab-separated history. Every imported trade uses the same journal record as a manual trade.</p><div className="tj-grid2"><Field label="Source platform"><select className="tj-input" value={platform} onChange={event => setPlatform(event.target.value)}><option>MetaTrader 4/5</option><option>cTrader</option><option>Manual</option></select></Field><Field label="Trade history file"><input className="tj-input" type="file" accept=".html,.htm,.csv,.txt,.tsv" onChange={event => load(event.target.files?.[0])}/></Field></div>{fileError && <div className="tj-import-error">{fileError}</div>}{trades.length > 0 ? <div className="tj-import-preview"><strong>{trades.length} trades ready to import</strong>{trades.slice(0, 5).map(trade => <div key={trade.id}><span>{trade.date} · {trade.asset} · {trade.direction}</span><b className={trade.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(trade.pnl)}</b></div>)}{trades.length > 5 && <small>Plus {trades.length - 5} more trades.</small>}</div> : !fileError && <div className="tj-finance-empty">Choose an exported history file to preview its trades.</div>}<div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Cancel</button><button className="tj-btn-primary" disabled={!trades.length || busy} onClick={submit}>{busy ? "Importing…" : `Import ${trades.length || ""} trades`}</button></div></Modal>;
}

function TradeLogPage({ account, reviews = [], markups = [], onEdit, onDelete, onNewTrade, onLinkMarkup, locked = false }) {
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [linkDrafts, setLinkDrafts] = useState({});
  const [selectedImage, setSelectedImage] = useState("");
  const [listPage, setListPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const toolbarRef = useCloseOnOutside(filtersOpen || sortOpen, () => { setFiltersOpen(false); setSortOpen(false); });

  const cap = account.breakevenCap;
  const reviewedTradeIds = useMemo(() => new Set(reviews.map((review) => review.tradeId || review.trade_id).filter(Boolean)), [reviews]);
  const assets = useMemo(() => ["All", ...Array.from(new Set(account.trades.map((t) => t.asset)))], [account.trades]);
  const sessionsUsed = useMemo(() => ["All", ...Array.from(new Set(account.trades.map((t) => t.session)))], [account.trades]);
  const recentMarkups = useMemo(() => [...markups].sort((a, b) => `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`)).slice(0, 3), [markups]);

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
  const tradePageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const activeTradePage = Math.min(listPage, tradePageCount);
  const visibleTrades = showAll ? filtered : filtered.slice((activeTradePage - 1) * 10, activeTradePage * 10);

  useEffect(() => { setListPage(1); }, [search, assetFilter, sessionFilter, resultFilter, sortKey, sortDir]);

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

      <div className="tj-tradelog-compact-toolbar" ref={toolbarRef}>
        <div className="tj-markup-toolbar-actions"><button className={`tj-icon-btn tj-markup-toolbar-button ${filtersOpen ? "tj-icon-btn-active" : ""}`} title="Filter trade log" onClick={() => { setFiltersOpen((value) => !value); setSortOpen(false); }}><SlidersHorizontal size={16}/></button><button className={`tj-icon-btn tj-markup-toolbar-button ${sortOpen ? "tj-icon-btn-active" : ""}`} title="Sort trade log" onClick={() => { setSortOpen((value) => !value); setFiltersOpen(false); }}><ArrowDownUp size={16}/></button></div>
        <div className="tj-markup-toolbar-status"><span>{filtered.length} shown</span><b>{showAll ? "All visible" : `Page ${activeTradePage} of ${tradePageCount}`}</b></div>
        {filtersOpen && <div className="tj-markup-filter-popover tj-tradelog-filter-popover">
          <div className="tj-markup-filter-head"><div><strong>Filter trades</strong><span>Focus the trade log on the exact instrument, session, or result you want to review.</span></div><button className="tj-icon-btn" title="Close filters" onClick={() => setFiltersOpen(false)}><X size={14}/></button></div>
          <div className="tj-markup-filter-grid tj-tradelog-filter-grid">
            <Field label="Search"><div className="tj-toolbar-search"><Search size={15} className="tj-toolbar-search-icon"/><input className="tj-toolbar-search-input" placeholder="Search trades..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></Field>
            <Field label="Instrument"><select className="tj-toolbar-dd" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}>{assets.map((asset) => <option key={asset} value={asset}>{asset === "All" ? "All Instruments" : asset}</option>)}</select></Field>
            <Field label="Session"><select className="tj-toolbar-dd" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>{sessionsUsed.map((item) => <option key={item} value={item}>{item === "All" ? "All Sessions" : item}</option>)}</select></Field>
            <Field label="Result"><select className="tj-toolbar-dd" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="All">All Results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="be">Break-even</option></select></Field>
          </div>
          <div className="tj-markup-filter-summary">{!search && [assetFilter, sessionFilter, resultFilter].every((value) => value === "All") ? "No filters applied." : `${filtered.length} trade${filtered.length === 1 ? "" : "s"} match the selected filters.`}</div>
        </div>}
        {sortOpen && <div className="tj-tradelog-sort-controls"><span>Sort trades by</span><button className={`tj-toolbar-pill ${sortKey === "date" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("date")}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button><button className={`tj-toolbar-pill ${sortKey === "pnl" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("pnl")}>P&amp;L</button><button className={`tj-toolbar-pill ${sortKey === "asset" ? "tj-toolbar-btn-active" : ""}`} onClick={() => toggleSort("asset")}>Instrument</button></div>}
      </div>

      {filtered.length === 0 ? (
        <Card className="tj-panel"><div className="tj-empty">No trades match these filters.</div></Card>
      ) : (
        <div className="tj-tlog-list">
          {visibleTrades.map((t) => {
            const cls = classify(t.pnl, cap);
            const isOpen = !!expanded[t.id];
            const isReviewed = reviewedTradeIds.has(t.id);
            const linkedMarkup = markups.find((markup) => markup.id === t.premarketMarkupId);
            const tradeReturn = account.balance ? (t.pnl / account.balance) * 100 : 0;
            const grossTradeReturn = account.balance ? (Number(t.grossPnl ?? t.pnl) / account.balance) * 100 : 0;
            const confluenceCount = (t.confluence || t.types || []).length;
            const screenshotCount = t.screenshots?.length || 0;
            const linkedMarkupScreenshots = linkedMarkup ? Object.entries(linkedMarkup.screenshots || {}).filter(([, images]) => Array.isArray(images)).flatMap(([slot, images]) => images.map((screenshot, index) => ({ source: screenshotSource(screenshot), key: `${slot}-${index}` }))) : [];
            const linkDraft = linkDrafts[t.id] ?? t.premarketMarkupId ?? "";
            return (
              <Card key={t.id} className={`tj-tlog-card tj-reference-tradelog-row tj-tlog-${cls}`}>
                <div className="tj-tlog-row" onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>
                  <div className="tj-reference-trade-left">
                    <div className="tj-tlog-main">
                      <div className="tj-tlog-asset">{t.asset || "No instrument"}</div>
                    </div>
                    <span className={`tj-dirpill-sm tj-reference-trade-direction ${t.direction === "BUY" ? "tj-green" : "tj-red"}`}>{t.direction}</span>
                    <div className="tj-reference-trade-meta"><span>Opened: {cTraderOpeningIsUnknown(t) ? "Not included in cTrader report" : `${new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })} · ${formatTime(t.time)}`}</span><span>Closed: {t.closeDate ? `${new Date(t.closeDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })} · ${t.closeTime ? formatTime(t.closeTime) : "Time not logged"}` : "Not logged"}</span></div>
                    <span className="tj-reference-trade-session">{t.entrySession || t.session || "No session"}</span>
                  </div>
                  <div className="tj-reference-trade-right" onClick={(e) => e.stopPropagation()}>
                    <span className={`tj-review-status ${isReviewed ? "tj-review-reviewed" : "tj-review-pending"}`} title={isReviewed ? "This trade has a linked review" : "No trade review has been added yet"}>{isReviewed ? <><CheckCircle2 size={12} /> Reviewed</> : "Review Pending"}</span>
                    <div className="tj-tlog-pnl-block">
                      <div className={cls === "be" ? "tj-blue tj-tlog-pnl" : (t.pnl >= 0 ? "tj-green tj-tlog-pnl" : "tj-red tj-tlog-pnl")}>{cls === "be" ? "B/E" : fmtMoney(t.pnl)}</div>
                      <div className="tj-reference-trade-return">{tradeReturn >= 0 ? "+" : ""}{tradeReturn.toFixed(2)}% {t.rr ? `· ${t.rr.toFixed(2)}R` : ""}</div>
                    </div>
                    <button className="tj-markup-round-button" disabled={locked} title={locked ? "Trade changes are locked by the account loss limit" : "Edit trade"} onClick={() => onEdit(t)}><Pencil size={15}/></button>
                    <ConfirmDeleteButton className="tj-markup-round-button tj-markup-delete-button" disabled={locked} title={locked ? "Trade changes are locked by the account loss limit" : "Delete trade"} onClick={() => onDelete(t.id)}><Trash2 size={14}/></ConfirmDeleteButton>
                    <button className="tj-markup-round-button" title={isOpen ? "Collapse trade" : "Expand trade"} onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  </div>
                </div>
                {isOpen && (
                  <div className="tj-tlog-expand tj-reference-trade-expand">
                    <div className="tj-reference-trade-detail-summary"><div><span>NET RETURN</span><strong className={t.pnl >= 0 ? "tj-green" : "tj-red"}>{tradeReturn >= 0 ? "+" : ""}{tradeReturn.toFixed(2)}% · {fmtMoney(t.pnl)}</strong></div><div><span>GROSS RETURN</span><strong>{account.balance ? `${grossTradeReturn >= 0 ? "+" : ""}${grossTradeReturn.toFixed(2)}%` : "—"} · {fmtMoney(Number(t.grossPnl ?? t.pnl))}</strong></div><div><span>COSTS</span><strong className="tj-red">{fmtMoney(-((Number(t.commission) || 0) + (Number(t.swap) || 0)))}</strong></div><div><span>R:R</span><strong>{t.rr ? `${t.rr.toFixed(2)}R` : "—"}</strong></div><div><span>RULES CHECKED</span><strong>{t.ruleEvaluations?.filter((entry) => entry.checked).length || 0}/{t.ruleEvaluations?.length || 0}</strong></div></div>
                    <div className="tj-reference-trade-main-grid">
                      <section className="tj-reference-trade-brief"><div className="tj-reference-trade-section-head"><span>Trade Brief</span><div><em className={t.direction === "BUY" ? "tj-green" : "tj-red"}>{t.direction}</em><em>{t.entrySession || t.session || "—"}</em>{(t.entryType || t.confluenceSession) && <em>{t.entryType || t.confluenceSession}</em>}<em className={tradeReturn >= 0 ? "tj-green" : "tj-red"}>{tradeReturn >= 0 ? "+" : ""}{tradeReturn.toFixed(2)}%</em></div></div><div className="tj-reference-trade-brief-rows"><div><span>RESULT</span><strong>{cls === "win" ? "Win" : cls === "loss" ? "Loss" : "B/E"} · {fmtMoney(t.pnl)} · {t.rr ? `${t.rr.toFixed(2)}R` : "—"}</strong></div><div><span>ENTRY MODEL</span><strong>{t.entryType || t.confluenceSession || "—"}</strong></div><div><span>MOOD SHIFT</span><strong>{t.moodBefore || "—"} → {t.moodAfter || "—"}</strong></div><div><span>RATING</span><strong><RatingDisplay value={t.rating} noRules={!t.ruleEvaluations?.length&&!t.rating}/></strong></div></div><div className="tj-reference-trade-note">{t.context || "No trade note added."}</div></section>
                      <section className="tj-reference-trade-markup"><div className="tj-reference-trade-section-head"><span>Linked Markup</span><small>{linkedMarkup ? "Executed" : "Not linked"}</small></div><strong className="tj-reference-linked-title">{linkedMarkup ? `${linkedMarkup.date} · ${linkedMarkup.instrument || "Untitled markup"}` : "No linked markup"}</strong><div className="tj-reference-linked-meta">{linkedMarkup ? `${linkedMarkup.market || "No session"} · ${linkedMarkup.bias || "No bias"} · Executed` : "Choose one of your three most recent markups."}</div><div className="tj-reference-link-controls"><select className="tj-input" value={linkDraft} onChange={(event) => setLinkDrafts((current) => ({ ...current, [t.id]: event.target.value }))}><option value="">No linked markup</option>{recentMarkups.map((markup) => <option key={markup.id} value={markup.id}>{markup.date} · {markup.instrument || "Untitled"} · {markup.bias || "No bias"}</option>)}</select><button className="tj-btn-outline tj-btn-small" disabled={String(linkDraft || "") === String(t.premarketMarkupId || "")} onClick={() => onLinkMarkup(t, linkDraft || null)}>Save Link</button></div><div className="tj-reference-markup-shots-head"><span>MARKUP SCREENSHOTS</span><small>{linkedMarkupScreenshots.length} shot{linkedMarkupScreenshots.length === 1 ? "" : "s"}</small></div>{linkedMarkupScreenshots.length ? <div className="tj-reference-markup-shots">{linkedMarkupScreenshots.slice(0, 3).map((image) => <ImagePreview key={image.key} src={image.source} alt="Linked markup screenshot" selected={selectedImage === image.source} onSelect={setSelectedImage}/>)}</div> : <div className="tj-reference-trade-empty">No markup screenshots.</div>}</section>
                    </div>
                    <section className="tj-reference-journal-detail"><div className="tj-reference-trade-section-head"><span>Journal Detail</span><small>{confluenceCount} confluence{confluenceCount === 1 ? "" : "s"}</small></div><div className="tj-reference-journal-grid"><div><div className="tj-mlabel">CONFLUENCES</div><div className="tj-tlog-types">{confluenceCount ? (t.confluence || t.types || []).map((item) => <span key={item} className="tj-tag tj-tag-purple tj-tag-active tj-tag-xs">{item}</span>) : <span className="tj-muted-txt">No confluences logged.</span>}</div></div><div><div className="tj-mlabel">MISTAKES</div><div className="tj-tlog-mistakes">{t.mistakes?.length ? t.mistakes.map((m) => <span key={m} className="tj-tag tj-tag-red tj-tag-active tj-tag-xs">{m}</span>) : <span className="tj-muted-txt">No mistakes logged.</span>}</div></div></div>{screenshotCount > 0 && <div className="tj-reference-trade-screens"><div className="tj-mlabel">SCREENSHOTS</div><div className="tj-tlog-shots">{t.screenshots.map((src, i) => <ImagePreview key={i} src={src} alt="Trade screenshot" selected={selectedImage === src} onSelect={setSelectedImage}/>)}</div></div>}</section>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <ListPagination total={filtered.length} page={activeTradePage} showAll={showAll} onPageChange={setListPage} onShowAll={(next) => { setShowAll(next); if (!next) setListPage(1); }} label="trade logs"/>
      <button className="tj-fab" disabled={locked} title={locked ? "Trade entry is paused by the account loss limit" : "New trade"} onClick={onNewTrade}><Plus size={16} /> {locked ? "Trade Locked" : "New Trade"}</button>
    </>
  );
}

/* ================================ ANALYTICS ============================= */

function PerformanceMetricsView({ account, trades, cap, stats, tagStats, confluenceStats, pairingStats, instrumentStats }) {
  const [view, setView] = useState("models");
  const views = [["models", "Entry Models"], ["confluences", "Confluences"], ["pairings", "Pairings"], ["daily", "Daily Growth"], ["monthly", "Monthly P&L"], ["instruments", "Instruments"]];
  const descriptions = {
    models: "Keep the base entry idea separate so you can see whether the model itself is carrying the edge.",
    confluences: "Measure the added confirmation around the trade without blending it into the entry model.",
    pairings: "Study the entry model plus confluence stack together so you know which combinations deserve more size.",
    daily: "Expand the daily P&L pulse into compounded progress, consistency, and a date-by-date performance read.",
    monthly: "Compare each month’s result, win quality, and contribution to the account’s compounded progress.",
    instruments: "See which markets are paying you best, where the volume is landing, and what needs review.",
  };
  const dayRows = stats.dayClasses.map((day) => {
    const dayTrades = trades.filter((trade) => trade.date === day.date);
    const wins = dayTrades.filter((trade) => classify(trade.pnl, cap) === "win").length;
    return { ...day, count: dayTrades.length, winRate: dayTrades.length ? wins / dayTrades.length * 100 : 0 };
  });
  let dailyRunning = account.balance;
  const dailyCurve = [{ date: "Start", pct: 0, equity: account.balance }];
  dayRows.forEach((day) => { dailyRunning += day.pnl; dailyCurve.push({ ...day, rawDate: day.date, date: day.date.slice(5), pct: account.balance ? (dailyRunning - account.balance) / account.balance * 100 : 0, equity: dailyRunning }); });
  const monthlyRows = Object.values(trades.reduce((map, trade) => {
    const key = trade.date?.slice(0, 7) || "Unknown";
    if (!map[key]) map[key] = { key, pnl: 0, count: 0, wins: 0 };
    map[key].pnl += trade.pnl; map[key].count += 1;
    if (classify(trade.pnl, cap) === "win") map[key].wins += 1;
    return map;
  }, {})).map((month) => ({ ...month, label: month.key === "Unknown" ? month.key : new Date(`${month.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }), winRate: month.count ? month.wins / month.count * 100 : 0 })).sort((a, b) => a.key.localeCompare(b.key));
  const bestMonth = monthlyRows.length ? monthlyRows.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
  const worstMonth = monthlyRows.length ? monthlyRows.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;
  const bestDay = dayRows.length ? dayRows.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
  const worstDay = dayRows.length ? dayRows.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;
  const maxMonthPnl = Math.max(1, ...monthlyRows.map((month) => Math.abs(month.pnl)));
  const maxInstrumentPnl = Math.max(1, ...instrumentStats.map((item) => Math.abs(item.netPnl)));
  const bestEntry = tagStats[0];
  const bestConfluence = confluenceStats[0];
  const bestPairing = pairingStats[0];
  const trimEntry = tagStats.slice().sort((a, b) => a.netPnl - b.netPnl)[0];
  const trimConfluence = confluenceStats.slice().sort((a, b) => a.netPnl - b.netPnl)[0];
  const trimPairing = pairingStats.slice().sort((a, b) => a.netPnl - b.netPnl)[0];
  const taggedConfluenceTrades = trades.filter((trade) => (trade.confluence || trade.types || []).length).length;

  const PerformanceCard = ({ item, kind, maxImpact }) => <div className="tj-performance-stat-card"><div className="tj-performance-stat-head"><span>{kind}</span><b className={`tj-grade-badge ${item.grade === "D" || item.grade === "C" ? "tj-grade-bad" : ""}`}>{item.grade}</b></div><strong>{item.tag || item.name}</strong><em className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</em><div className="tj-performance-mini-metrics"><span><small>WIN RATE</small><b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}%</b></span><span><small>TRADES</small><b>{item.count}</b></span><span><small>AVG RR</small><b className="tj-purple-txt">{item.avgRR.toFixed(2)}</b></span></div><div className="tj-performance-bars"><span>IMPACT</span><i><b style={{ width: `${Math.abs(item.netPnl) / Math.max(1, maxImpact) * 100}%` }}/></i><strong>{fmtMoneyShort(item.netPnl)}</strong><span>FREQUENCY</span><i><b className="tj-performance-purple" style={{ width: `${item.count / Math.max(1, stats.total) * 100}%` }}/></i><strong>{item.count} trade{item.count === 1 ? "" : "s"}</strong><span>QUALITY</span><i><b className={wrBarClass(item.winRate)} style={{ width: `${item.winRate}%` }}/></i><strong>{item.winRate.toFixed(0)}%</strong></div><footer><span>BEST {fmtMoneyShort(item.best)}</span><span>WORST {fmtMoneyShort(item.worst)}</span></footer></div>;
  const EntryCard = ({ item }) => { const grade = getGrade(item.winRate, item.netPnl, item.count); const wins = Math.round(item.winRate / 100 * item.count); return <div className="tj-performance-entry-card"><div><strong>{item.tag}</strong><b className={`tj-grade-badge ${grade === "D" || grade === "C" ? "tj-grade-bad" : ""}`}>{grade}</b></div><section><span><small>NET P&amp;L</small><b className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</b></span><span><small>WIN RATE</small><b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}%</b></span><span><small>TRADES</small><b>{item.count} <i>({wins}W/{item.count - wins}L)</i></b></span><span><small>AVG RR</small><b className="tj-purple-txt">{item.avgRR.toFixed(2)}</b></span></section><div className="tj-performance-best-worst"><span><small>Best</small><b className="tj-green">{fmtMoneyShort(item.best)}</b></span><span><small>Worst</small><b className="tj-red">{fmtMoneyShort(item.worst)}</b></span></div><i><b className={wrBarClass(item.winRate)} style={{ width: `${item.winRate}%` }}/></i></div>; };

  return <div className="tj-performance-workspace">
    <Card className="tj-performance-views"><div><strong>Performance Views</strong><span>{descriptions[view]}</span></div><small>{views.find(([id]) => id === view)?.[1]}</small><nav>{views.map(([id, label]) => <button type="button" key={id} className={view === id ? "tj-performance-view-active" : ""} onClick={() => setView(id)}>{label}</button>)}</nav></Card>
    <div className="tj-view-transition" key={view}>

    {view === "models" && <Card className="tj-performance-surface"><div className="tj-performance-title"><div><strong>Entry Model Performance</strong><span>Separate the base entry idea from the added confluence stack, then compare it against the confluence and pairing reads beside it.</span></div><small>{bestEntry ? `${bestEntry.tag} leads` : "No entry models"}</small></div><div className="tj-performance-highlights"><div><small>BEST MODEL</small><strong>{bestEntry?.tag || "—"}</strong><span>{bestEntry ? `${fmtMoney(bestEntry.netPnl)} · ${bestEntry.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>TRIM FIRST</small><strong>{trimEntry?.tag || "—"}</strong><span>{trimEntry ? `${fmtMoney(trimEntry.netPnl)} · ${trimEntry.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>BEST PAIRING</small><strong>{bestPairing?.name || "—"}</strong><span>{bestPairing ? `${fmtMoney(bestPairing.netPnl)} · ${bestPairing.count} trades` : "No pairings"}</span></div></div><div className="tj-performance-entry-grid">{tagStats.map((item) => <EntryCard key={item.tag} item={item}/>)}</div></Card>}

    {view === "confluences" && <Card className="tj-performance-surface"><div className="tj-performance-title"><div><strong>Confluence Performance</strong><span>Conditions stacked around the trade, separated from the entry model. This is where you see whether the extra confirmation is actually helping.</span></div><small>{confluenceStats.length} confluence{confluenceStats.length === 1 ? "" : "s"}</small></div><div className="tj-performance-highlights"><div><small>BEST CONFLUENCE</small><strong>{bestConfluence?.name || "—"}</strong><span>{bestConfluence ? `${fmtMoney(bestConfluence.netPnl)} · ${bestConfluence.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>TRIM FIRST</small><strong>{trimConfluence?.name || "—"}</strong><span>{trimConfluence ? `${fmtMoney(trimConfluence.netPnl)} · ${trimConfluence.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>COVERAGE</small><strong>{taggedConfluenceTrades}/{stats.total}</strong><span>{(trades.reduce((sum, trade) => sum + (trade.confluence || trade.types || []).length, 0) / Math.max(1, taggedConfluenceTrades)).toFixed(1)} confluences per tagged trade</span></div></div><div className="tj-performance-stat-grid">{confluenceStats.map((item) => <PerformanceCard key={item.name} item={item} kind="CONFLUENCE" maxImpact={Math.abs(bestConfluence?.netPnl || 1)}/>)}</div></Card>}

    {view === "pairings" && <Card className="tj-performance-surface"><div className="tj-performance-title"><div><strong>Pairing Performance</strong><span>This view blends the entry model and confluence together so you can see which combinations are actually repeatable when the idea and confirmation align.</span></div><small>{bestPairing ? `${bestPairing.name} leads` : "No pairings"}</small></div><div className="tj-performance-highlights"><div><small>BEST PAIRING</small><strong>{bestPairing?.name || "—"}</strong><span>{bestPairing ? `${fmtMoney(bestPairing.netPnl)} · ${bestPairing.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>TRIM FIRST</small><strong>{trimPairing?.name || "—"}</strong><span>{trimPairing ? `${fmtMoney(trimPairing.netPnl)} · ${trimPairing.winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>COVERAGE</small><strong>{taggedConfluenceTrades}/{stats.total}</strong><span>{pairingStats.length} pairing reads across the journal</span></div></div><div className="tj-performance-stat-grid">{pairingStats.map((item) => <PerformanceCard key={item.name} item={item} kind="PAIRING" maxImpact={Math.abs(bestPairing?.netPnl || 1)}/>)}</div></Card>}

    {view === "daily" && <Card className="tj-performance-surface"><div className="tj-performance-title"><div><strong>Daily P&amp;L Growth</strong><span>Read how each trading day changed the account, then compare the daily result with the compounded equity curve it created.</span></div><small>{dayRows.length} trading days</small></div><div className="tj-performance-four"><div><small>COMPOUNDED RETURN</small><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{account.balance ? (stats.netPnl / account.balance * 100).toFixed(2) : "0.00"}%</strong><span>{fmtMoney(stats.netPnl)} across the selected range</span></div><div><small>BEST DAY</small><strong className="tj-green">{bestDay ? fmtMoney(bestDay.pnl) : "—"}</strong><span>{bestDay?.date || "No data"}</span></div><div><small>WORST DAY</small><strong className="tj-red">{worstDay ? fmtMoney(worstDay.pnl) : "—"}</strong><span>{worstDay?.date || "No data"}</span></div><div><small>GREEN DAYS</small><strong className="tj-green">{stats.dayWinRate.toFixed(0)}%</strong><span>{dayRows.filter((day) => day.cls === "win").length} positive · {dayRows.filter((day) => day.cls === "loss").length} negative · {dayRows.filter((day) => day.cls === "be").length} flat</span></div></div><div className="tj-performance-chart"><div><small>COMPOUNDED EQUITY PATH</small><strong>{fmtMoney(account.balance + stats.netPnl)}</strong></div><ResponsiveContainer width="100%" height={250}><AreaChart data={dailyCurve}><defs><linearGradient id="performanceDaily" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.28}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={CHART_TICK} minTickGap={32} interval="preserveStartEnd" axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value, _name, item) => [`${Number(value).toFixed(2)}% · ${fmtMoney(item.payload.equity)}`, "Compounded"]}/><Area type="monotone" dataKey="pct" stroke={UI_COLORS.primary} fill="url(#performanceDaily)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div><div className="tj-performance-recent"><header><strong>RECENT 3 TRADING DAYS</strong><span>{fmtMoney(dayRows.filter((d) => d.cls === "win").reduce((s, d) => s + d.pnl, 0) / Math.max(1, dayRows.filter((d) => d.cls === "win").length))} average green day · {fmtMoney(dayRows.filter((d) => d.cls === "loss").reduce((s, d) => s + d.pnl, 0) / Math.max(1, dayRows.filter((d) => d.cls === "loss").length))} average red day</span></header>{dayRows.slice(-3).reverse().map((day) => { const close = dailyCurve.find((point) => point.date === day.date.slice(5))?.equity; return <div key={day.date}><span><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small>{day.count} trade{day.count === 1 ? "" : "s"} · {day.winRate.toFixed(0)}% WR</small></span><i><b className={day.pnl >= 0 ? "tj-bar-green" : "tj-bar-red"} style={{ width: `${Math.max(8, Math.abs(day.pnl) / Math.max(1, Math.abs(bestDay?.pnl || 1), Math.abs(worstDay?.pnl || 1)) * 100)}%` }}/></i><em className={day.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(day.pnl)}<small>{account.balance ? `${day.pnl / account.balance * 100 >= 0 ? "+" : ""}${(day.pnl / account.balance * 100).toFixed(2)}% day` : ""}</small></em><span><small>Close</small><strong>{fmtMoney(close)}</strong></span></div>; })}</div></Card>}

    {view === "monthly" && <Card className="tj-performance-surface"><div className="tj-performance-title"><div><strong>Monthly P&amp;L Evolution</strong><span>A month-by-month view of realised P&amp;L, so the account’s larger rhythm is visible alongside its daily pulse.</span></div><small>{monthlyRows.length} months</small></div><div className="tj-performance-four"><div><small>BEST MONTH</small><strong className="tj-green">{bestMonth ? fmtMoney(bestMonth.pnl) : "—"}</strong><span>{bestMonth?.label || "No data"}</span></div><div><small>WORST MONTH</small><strong className={worstMonth?.pnl >= 0 ? "tj-green" : "tj-red"}>{worstMonth ? fmtMoney(worstMonth.pnl) : "—"}</strong><span>{worstMonth?.label || "No data"}</span></div><div><small>AVERAGE MONTH</small><strong className="tj-green">{fmtMoney(monthlyRows.reduce((sum, month) => sum + month.pnl, 0) / Math.max(1, monthlyRows.length))}</strong><span>Across the active range</span></div><div><small>POSITIVE MONTHS</small><strong className="tj-green">{monthlyRows.filter((month) => month.pnl > 0).length}/{monthlyRows.length}</strong><span>{monthlyRows.filter((month) => month.pnl < 0).length} negative months</span></div></div><div className="tj-performance-chart"><ResponsiveContainer width="100%" height={250}><BarChart data={monthlyRows}><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoneyShort(value)}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Monthly P&L"]}/><Bar dataKey="pnl" radius={[6, 6, 2, 2]}>{monthlyRows.map((month) => <Cell key={month.key} fill={month.pnl >= 0 ? UI_COLORS.primary : UI_COLORS.danger}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="tj-performance-month-list">{monthlyRows.slice().reverse().map((month) => <div key={month.key}><strong>{month.label}</strong><i><b className={month.pnl >= 0 ? "tj-bar-green" : "tj-bar-red"} style={{ width: `${Math.abs(month.pnl) / maxMonthPnl * 100}%` }}/></i><span>{month.count} trades · {month.winRate.toFixed(0)}% WR</span><em className={month.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(month.pnl)}</em></div>)}</div></Card>}

    {view === "instruments" && <Card className="tj-performance-surface tj-performance-instruments"><div className="tj-performance-title"><div><small>MARKET PERFORMANCE</small><strong>Instrument Performance</strong><span>See which markets are actually paying you, where volume is concentrating, and which instrument needs the next review pass.</span></div><small>{instrumentStats.length} instruments</small></div><div className="tj-performance-highlights"><div><small>LEADER</small><strong>{instrumentStats[0]?.asset || "—"}</strong><span>{instrumentStats[0] ? `${fmtMoney(instrumentStats[0].netPnl)} · ${instrumentStats[0].winRate.toFixed(0)}% WR` : "No data"}</span></div><div><small>MOST ACTIVE</small><strong>{instrumentStats.slice().sort((a, b) => b.count - a.count)[0]?.asset || "—"}</strong><span>{instrumentStats.length ? `${instrumentStats.slice().sort((a, b) => b.count - a.count)[0].count} trades` : "No data"}</span></div><div><small>NEEDS REVIEW</small><strong>{instrumentStats[instrumentStats.length - 1]?.asset || "—"}</strong><span>{instrumentStats.length ? `${fmtMoney(instrumentStats[instrumentStats.length - 1].netPnl)} · ${instrumentStats[instrumentStats.length - 1].winRate.toFixed(0)}% WR` : "No data"}</span></div></div><div className="tj-performance-instrument-grid">{instrumentStats.map((item) => <div className="tj-performance-instrument-card" key={item.asset}><div><span>INSTRUMENT</span><b className="tj-grade-badge">{item.grade}</b></div><strong>{item.asset}</strong><em className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</em><section><span><small>WIN RATE</small><b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}%</b></span><span><small>TRADES</small><b>{item.count}</b></span><span><small>AVG RR</small><b className="tj-purple-txt">{item.avgRR.toFixed(2)}</b></span><span><small>AVG / TRADE</small><b className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl / item.count)}</b></span></section><div className="tj-performance-bars"><span>IMPACT</span><i><b style={{ width: `${Math.abs(item.netPnl) / maxInstrumentPnl * 100}%` }}/></i><strong>{fmtMoneyShort(item.netPnl)}</strong><span>FLOW</span><i><b className="tj-performance-purple" style={{ width: `${item.winRate}%` }}/></i><strong>{item.winRate.toFixed(0)}%</strong><span>VOLUME</span><i><b className="tj-bar-yellow" style={{ width: `${item.count / Math.max(...instrumentStats.map((row) => row.count)) * 100}%` }}/></i><strong>{item.count} trades</strong></div><footer><span>BEST {fmtMoneyShort(item.best)}</span><span>WORST {fmtMoneyShort(item.worst)}</span></footer></div>)}</div></Card>}
    </div>
  </div>;
}

function ExecutionRhythmView({ account, trades, cap, stats }) {
  const weekdayRows = Object.values(trades.reduce((map, trade) => {
    const day = new Date(`${trade.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
    if (!map[day]) map[day] = { label: day, pnl: 0, count: 0, wins: 0 };
    map[day].pnl += trade.pnl; map[day].count += 1;
    if (classify(trade.pnl, cap) === "win") map[day].wins += 1;
    return map;
  }, {})).map((row) => ({ ...row, winRate: row.count ? row.wins / row.count * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
  const sessionRows = Object.values(trades.reduce((map, trade) => {
    const session = trade.entrySession || trade.session || "Unspecified";
    if (!map[session]) map[session] = { label: session, pnl: 0, count: 0, wins: 0 };
    map[session].pnl += trade.pnl; map[session].count += 1;
    if (classify(trade.pnl, cap) === "win") map[session].wins += 1;
    return map;
  }, {})).map((row) => ({ ...row, winRate: row.count ? row.wins / row.count * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
  const weekRows = Object.values(trades.reduce((map, trade) => {
    const date = new Date(`${trade.date}T00:00:00`);
    const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const key = monday.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { key, start: monday, end: sunday, pnl: 0, count: 0, wins: 0 };
    map[key].pnl += trade.pnl; map[key].count += 1;
    if (classify(trade.pnl, cap) === "win") map[key].wins += 1;
    return map;
  }, {})).map((row) => ({ ...row, winRate: row.count ? row.wins / row.count * 100 : 0 })).sort((a, b) => a.key.localeCompare(b.key));
  const monthRows = Object.values(trades.reduce((map, trade) => {
    const key = trade.date.slice(0, 7);
    if (!map[key]) map[key] = { key, pnl: 0, count: 0 };
    map[key].pnl += trade.pnl; map[key].count += 1;
    return map;
  }, {})).sort((a, b) => a.key.localeCompare(b.key));
  const dayRows = stats.dayClasses;
  const bestDay = dayRows.length ? dayRows.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
  const worstDay = dayRows.length ? dayRows.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;
  const maxWeekdayPnl = Math.max(1, ...weekdayRows.map((row) => Math.abs(row.pnl)));
  const latestMonth = monthRows[monthRows.length - 1];
  const bestWeekday = weekdayRows[0];
  const bestSession = sessionRows[0];
  const linkedPct = stats.total ? trades.filter((trade) => trade.premarketMarkupId).length / stats.total * 100 : 0;
  const allRuleEntries = trades.flatMap((trade) => trade.ruleEvaluations || []);
  const rulePct = allRuleEntries.length ? allRuleEntries.filter((entry) => entry.checked).length / allRuleEntries.length * 100 : 0;
  const discipline = Math.round(clamp(linkedPct * .45 + rulePct * .55, 0, 100));
  const avgRR = stats.total ? trades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / stats.total : 0;
  const scoreFactors = [{ metric: "Win rate", value: stats.winRate }, { metric: "Profit factor", value: norm(stats.profitFactor, 5) }, { metric: "Average RR", value: norm(avgRR, 3) }, { metric: "Consistency", value: stats.consistency }, { metric: "Recovery", value: stats.recovery }, { metric: "Discipline", value: discipline }];
  const dayScore = Math.round(clamp(stats.dayWinRate * .6 + norm(dayRows.length ? stats.netPnl / dayRows.length : 0, 200) * .4, 0, 100));
  const recentSix = dayRows.slice(-6);
  let currentRun = 0; let currentType = null;
  [...dayRows].reverse().some((day) => { if (!currentType) currentType = day.cls; if (day.cls !== currentType) return true; currentRun += 1; return false; });
  const runs = dayRows.reduce((all, day) => { const last = all[all.length - 1]; if (last?.cls === day.cls) last.count += 1; else all.push({ cls: day.cls, count: 1 }); return all; }, []);
  const maxDayPnl = Math.max(1, ...dayRows.map((day) => Math.abs(day.pnl)));
  const fmtRangeDay = (date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();

  return <div className="tj-execution-workspace">
    <Card className="tj-execution-rhythm-card"><div className="tj-execution-title"><strong>Execution Rhythm</strong><small>{dayRows.length} trading days</small></div><div className="tj-execution-four"><div><small>BEST WEEKDAY</small><strong className="tj-green">{bestWeekday?.label || "—"}</strong><span>{bestWeekday ? `${fmtMoney(bestWeekday.pnl)} · ${bestWeekday.winRate.toFixed(0)}% win rate` : "No data"}</span></div><div><small>BEST SESSION</small><strong className="tj-green">{bestSession?.label || "—"}</strong><span>{bestSession ? `${fmtMoney(bestSession.pnl)} · ${bestSession.count} trades` : "No data"}</span></div><div><small>LATEST MONTH</small><strong className={latestMonth?.pnl >= 0 ? "tj-green" : "tj-red"}>{latestMonth ? fmtMoney(latestMonth.pnl) : "—"}</strong><span>{latestMonth ? new Date(`${latestMonth.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "No data"}</span></div><div><small>CURRENT STREAK</small><strong>{currentRun}{currentType === "loss" ? "L" : currentType === "win" ? "W" : " B/E"}</strong><span>{recentSix.length ? `${recentSix[0].date.slice(5)} – ${recentSix[recentSix.length - 1].date.slice(5)}` : "No recent days"}</span></div></div><div className="tj-execution-section-label">WEEKDAY P&amp;L</div><div className="tj-execution-bars">{weekdayRows.map((row) => <div key={row.label}><strong>{row.label}</strong><i><b className={row.pnl >= 0 ? "tj-bar-green" : "tj-bar-red"} style={{ width: `${Math.max(4, Math.abs(row.pnl) / maxWeekdayPnl * 100)}%` }}/></i><em className={row.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoneyShort(row.pnl)}</em><span className={wrColorClass(row.winRate)}>{row.winRate.toFixed(0)}%</span></div>)}</div><div className="tj-execution-section-label">RECENT WEEKS</div><div className="tj-execution-week-grid">{weekRows.slice(-3).map((week) => <div key={week.key}><small>{fmtRangeDay(week.start)} – {fmtRangeDay(week.end)}</small><strong className={week.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(week.pnl)}</strong><span>{week.count} trades · {week.winRate.toFixed(0)}% WR</span></div>)}</div><div className="tj-execution-section-label">MONTHLY PULSE</div><div className="tj-execution-month-grid">{monthRows.slice(-3).map((month) => <div key={month.key}><small>{new Date(`${month.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase()}</small><strong className={month.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(month.pnl)}</strong><span>{month.count} trades · {account.balance ? `${month.pnl / account.balance * 100 >= 0 ? "+" : ""}${(month.pnl / account.balance * 100).toFixed(2)}%` : ""}</span></div>)}</div></Card>

    <Card className="tj-core-breakdown"><div className="tj-execution-title"><strong>Core Score Breakdown</strong><small>6 contributing factors</small></div><div className="tj-core-breakdown-grid"><section><div><span><small>EXECUTION SCORE</small><strong className="tj-purple-txt">{stats.thunderScore}<i>/100</i></strong></span><p>Results, repeatability, recovery, and discipline are balanced into one practical execution read.</p></div><ResponsiveContainer width="100%" height={225}><RadarChart data={scoreFactors} outerRadius={72}><PolarGrid stroke="var(--tj-chart-grid)"/><PolarAngleAxis dataKey="metric" tick={{ fill: "var(--tj-muted)", fontSize: 12 }}/><Radar dataKey="value" stroke={UI_COLORS.purple} fill={UI_COLORS.purple} fillOpacity={.26}/></RadarChart></ResponsiveContainer><i><b style={{ width: `${stats.thunderScore}%` }}/></i></section><section><div className="tj-discipline-head"><span><small>WHAT DRIVES DISCIPLINE</small><strong className="tj-purple-txt">{discipline}<i>/100</i></strong></span><p>Markup coverage and checked active rules measure preparation; the guardrail signal reflects whether the selected range is currently within its loss limits.</p></div><div className="tj-discipline-grid">{[["WIN RATE", `${stats.winRate.toFixed(0)}%`, stats.winRate, `${stats.wins} wins from ${stats.total} trades`], ["PROFIT FACTOR", stats.profitFactor.toFixed(2), norm(stats.profitFactor, 5), "Gross profits compared with gross losses"], ["AVERAGE RR", avgRR.toFixed(2), norm(avgRR, 3), "Winner-to-loser payoff edge"], ["CONSISTENCY", stats.consistency.toFixed(0), stats.consistency, `${stats.bestWinStreak}W best run · ${stats.bestLossStreak}L loss run`], ["RECOVERY", `${stats.recovery.toFixed(0)}%`, stats.recovery, "How well the account has recovered after a loss"], ["DISCIPLINE", `${discipline}%`, discipline, `${linkedPct.toFixed(0)}% markup coverage · ${rulePct.toFixed(0)}% rules followed`]].map(([label, value, pct, note]) => <div key={label}><span><small>{label}</small><strong>{value}</strong></span><i><b style={{ width: `${pct}%` }}/></i><p>{note}</p></div>)}</div><footer><span>{linkedPct.toFixed(0)}% trades linked to markups</span><span>{rulePct.toFixed(0)}% rule checks passed</span><span>{account.dailyLossLimitPct || account.monthlyLossLimitPct ? "Guardrails configured" : "Guardrails currently open"}</span></footer></section></div></Card>

    <div className="tj-execution-bottom"><Card className="tj-session-time"><div className="tj-execution-title"><div><strong>Session &amp; Time Performance</strong><span>Compare session windows and entry time separately so you know where the cleanest flow is coming from before you add more size.</span></div><small>{bestSession ? `${bestSession.label} leads` : "No lead"}</small></div><div className="tj-session-time-grid">{sessionRows.map((row) => <div key={row.label}><header><strong>{row.label}</strong><span>{row.count} TRADES</span></header><em className={row.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(row.pnl)}</em><section><span className={wrColorClass(row.winRate)}>{row.winRate.toFixed(0)}% WR</span><span>{row.wins}W/{row.count - row.wins}L</span></section><small>{fmtMoney(row.pnl / row.count)} avg</small><i><b className={wrBarClass(row.winRate)} style={{ width: `${row.winRate}%` }}/></i></div>)}</div><div className="tj-entry-time-empty"><span>ENTRY TIME</span><small>{trades.some((trade) => trade.openTime) ? "Entry-time data is available on logged trades." : "Log an open time to unlock this read"}</small><p>{trades.some((trade) => trade.openTime) ? "Entry-time analysis will expand as more open times are recorded." : "Entry-time analysis will begin as soon as you add an open time to new or existing trades."}</p></div></Card>
    <Card className="tj-execution-days"><div className="tj-execution-title"><strong>Day Distribution</strong><small>{dayScore < 50 ? "Needs attention" : dayScore < 75 ? "Building" : "Solid"}</small></div><div className="tj-execution-day-head"><div><strong>{dayScore}</strong><span>/100</span></div><section><strong>{dayScore < 50 ? "Developing" : dayScore < 75 ? "Building" : "Solid"}</strong><span>{dayRows.length} trading days · avg {fmtMoney(dayRows.length ? stats.netPnl / dayRows.length : 0)}/day</span><small><i className="tj-dot-green"/> {dayRows.filter((d) => d.cls === "win").length} green&nbsp;&nbsp; <i className="tj-dot-red"/> {dayRows.filter((d) => d.cls === "loss").length} red&nbsp;&nbsp; <i className="tj-dot-blue"/> {dayRows.filter((d) => d.cls === "be").length} flat</small></section></div><div className="tj-execution-day-dist"><i style={{ width: `${dayRows.length ? dayRows.filter((d) => d.cls === "win").length / dayRows.length * 100 : 0}%` }}/><b style={{ width: `${dayRows.length ? dayRows.filter((d) => d.cls === "loss").length / dayRows.length * 100 : 0}%` }}/></div><div className="tj-execution-day-metrics"><div><small>CURRENT</small><strong>{currentRun}{currentType === "loss" ? "L" : "W"}</strong></div><div><small>BEST RUN</small><strong>{Math.max(0, ...runs.filter((run) => run.cls === "win").map((run) => run.count))}d</strong></div><div><small>WORST RUN</small><strong>{Math.max(0, ...runs.filter((run) => run.cls === "loss").map((run) => run.count))}d</strong></div><div><small>AVG/DAY</small><strong>{fmtMoney(dayRows.length ? stats.netPnl / dayRows.length : 0)}</strong></div></div><div className="tj-execution-best-worst"><div><small>BEST DAY</small><strong className="tj-green">{bestDay ? fmtMoney(bestDay.pnl) : "—"}</strong><span>{bestDay?.date || "No data"}</span></div><div><small>WORST DAY</small><strong className="tj-red">{worstDay ? fmtMoney(worstDay.pnl) : "—"}</strong><span>{worstDay?.date || "No data"}</span></div></div><div className="tj-execution-section-label">LAST {recentSix.length} TRADING DAYS</div><div className="tj-execution-last-days">{recentSix.map((day) => <i key={day.date} className={day.cls === "win" ? "tj-day-win" : day.cls === "loss" ? "tj-day-loss" : "tj-day-flat"} style={{ flex: Math.max(.35, Math.abs(day.pnl) / maxDayPnl) }} title={`${day.date}: ${fmtMoney(day.pnl)}`}/>)}</div></Card></div>
  </div>;
}

function RiskGuardrailsView({ account, trades, cap, stats, confluenceStats, instrumentStats }) {
  const dailyCapPct = Number(account.dailyLossLimitPct) || 0;
  const monthlyCapPct = Number(account.monthlyLossLimitPct) || 0;
  const sortedTrades = [...trades].sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));
  const byDay = sortedTrades.reduce((map, trade) => { if (!map[trade.date]) map[trade.date] = { date: trade.date, pnl: 0, trades: [] }; map[trade.date].pnl += trade.pnl; map[trade.date].trades.push(trade); return map; }, {});
  let rollingBalance = account.balance;
  const dayAudit = Object.values(byDay).map((day) => {
    const start = rollingBalance;
    const limit = dailyCapPct ? start * dailyCapPct / 100 : 0;
    const used = limit && day.pnl < 0 ? Math.abs(day.pnl) / limit * 100 : 0;
    rollingBalance += day.pnl;
    const trigger = day.trades.slice().sort((a, b) => a.pnl - b.pnl)[0];
    return { ...day, start, limit, used, breach: Boolean(limit && used >= 100), trigger, close: rollingBalance };
  });
  const byMonth = sortedTrades.reduce((map, trade) => { const key = trade.date.slice(0, 7); if (!map[key]) map[key] = { key, pnl: 0, trades: [] }; map[key].pnl += trade.pnl; map[key].trades.push(trade); return map; }, {});
  let monthBalance = account.balance;
  const monthAudit = Object.values(byMonth).map((month) => {
    const start = monthBalance;
    const limit = monthlyCapPct ? start * monthlyCapPct / 100 : 0;
    const used = limit && month.pnl < 0 ? Math.abs(month.pnl) / limit * 100 : 0;
    monthBalance += month.pnl;
    return { ...month, start, limit, used, breach: Boolean(limit && used >= 100), close: monthBalance };
  });
  const breaches = [...dayAudit.filter((day) => day.breach).map((day) => ({ type: "DAILY CAP", label: new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), ...day })), ...monthAudit.filter((month) => month.breach).map((month) => ({ type: "MONTHLY CAP", label: new Date(`${month.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }), ...month }))].sort((a, b) => String(b.date || b.key).localeCompare(String(a.date || a.key)));
  const lastBreachIndex = dayAudit.map((day) => day.breach).lastIndexOf(true);
  const breachFreeDays = lastBreachIndex < 0 ? dayAudit.length : dayAudit.length - lastBreachIndex - 1;
  const latestDay = dayAudit[dayAudit.length - 1];
  const latestMonth = monthAudit[monthAudit.length - 1];
  const currentEquity = account.balance + stats.netPnl;
  const dailyCapacity = dailyCapPct ? currentEquity * dailyCapPct / 100 : 0;
  const monthlyLimit = monthlyCapPct ? currentEquity * monthlyCapPct / 100 : 0;
  const monthlyUsed = latestMonth?.pnl < 0 ? Math.abs(latestMonth.pnl) : 0;
  const monthlyCapacity = Math.max(0, monthlyLimit - monthlyUsed);
  const monthlyTarget = Number(account.monthlyGoalPct) ? currentEquity * Number(account.monthlyGoalPct) / 100 : monthlyLimit;
  let peak = account.balance; let peakDrawdown = 0;
  sortedTrades.reduce((balance, trade) => { const next = balance + trade.pnl; peak = Math.max(peak, next); peakDrawdown = Math.max(peakDrawdown, peak - next); return next; }, account.balance);
  const drawdownPct = peak ? peakDrawdown / peak * 100 : 0;
  const bestConfluence = confluenceStats[0];
  const trimConfluence = confluenceStats.slice().sort((a, b) => a.netPnl - b.netPnl)[0];
  const bestInstrument = instrumentStats[0];
  const dragInstrument = instrumentStats[instrumentStats.length - 1];
  const costPct = stats.grossProfit ? (stats.totalCommission + stats.totalSwap) / stats.grossProfit * 100 : 0;
  const withinLimits = !latestDay?.breach && !latestMonth?.breach;

  return <div className="tj-risk-workspace">
    <Card className="tj-risk-audit"><div className="tj-risk-title"><div><strong>Guardrail Audit</strong><span>Historical checks use each period’s live starting balance, then trace the losses that consumed or crossed the configured daily and monthly caps.</span></div><small className={breaches.length ? "tj-pill tj-pill-red" : "tj-pill tj-pill-green"}>{breaches.length} breach{breaches.length === 1 ? "" : "es"}</small></div><div className="tj-risk-four"><div><small>DAILY CAP</small><strong>{dailyCapPct ? `${dailyCapPct.toFixed(2)}%` : "Not set"}</strong><span>{dayAudit.length} checked trading days</span></div><div><small>MONTHLY CAP</small><strong>{monthlyCapPct ? `${monthlyCapPct.toFixed(2)}%` : "Not set"}</strong><span>{monthAudit.length} checked months</span></div><div><small>PRE-LIMIT DAYS</small><strong className="tj-green">{dayAudit.filter((day) => day.used >= 75 && day.used < 100).length}</strong><span>Reached 75% of a daily cap</span></div><div><small>BREACH-FREE</small><strong>{breachFreeDays}</strong><span>Trading days since last breach</span></div></div><div className="tj-risk-audit-grid"><section><header><strong>DAILY CAP UTILISATION</strong><span>Recent trading days</span></header><div className="tj-risk-utilisation">{dayAudit.slice(-8).reverse().map((day) => <div key={day.date}><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong><i><b className={day.used >= 100 ? "tj-bar-red" : day.used >= 75 ? "tj-bar-yellow" : "tj-bar-green"} style={{ width: `${Math.min(100, day.used)}%` }}/></i><span className={day.used >= 100 ? "tj-red" : day.used >= 75 ? "tj-wr-yellow" : "tj-green"}>{day.used.toFixed(0)}%</span></div>)}</div><footer><span><i className="tj-dot-green"/> Under 75%</span><span><i className="tj-dot-amber"/> 75% warning</span><span><i className="tj-dot-red"/> 100% breach</span></footer></section><section><header><strong>BREACH CONTRIBUTIONS</strong><span>Most recent first</span></header><div className="tj-risk-breaches">{breaches.length ? breaches.map((breach, index) => <div key={`${breach.type}-${breach.label}-${index}`}><header><span><small>{breach.type}</small><strong>{breach.label}</strong></span><b>{breach.used.toFixed(0)}% used</b></header><p>{fmtMoney(breach.pnl)} against a {fmtMoney(-breach.limit)} cap.{breach.trigger ? ` ${breach.trigger.asset} was the trade that crossed the threshold.` : ""}</p>{breach.trigger && <em>Trigger · {breach.trigger.asset} · {fmtMoney(breach.trigger.pnl)}</em>}</div>) : <div className="tj-risk-empty">No configured guardrail was breached in this trading history.</div>}</div></section></div></Card>

    <div className="tj-risk-bottom"><Card className="tj-risk-control"><div className="tj-risk-title"><strong>Risk Control Surface</strong><small className={`tj-pill ${withinLimits ? "tj-pill-green" : "tj-pill-red"}`}>{withinLimits ? "Within limits" : "Limit reached"}</small></div><div className="tj-risk-control-grid"><section><small>LIVE RISK POSTURE</small><strong className={withinLimits ? "tj-green" : "tj-red"}>{withinLimits ? "Room to operate" : "Pause and review"}</strong><p>Loss caps are monitoring each new result against the current compounded balance.</p><hr/><small>LIVE BALANCE</small><strong className="tj-green">{fmtMoney(currentEquity)}</strong><span>{account.balance ? `${stats.netPnl / account.balance * 100 >= 0 ? "+" : ""}${(stats.netPnl / account.balance * 100).toFixed(2)}% from the journal base` : ""}</span></section><section><div><header><span>Daily loss capacity</span><strong className="tj-green">{dailyCapPct ? fmtMoney(dailyCapacity) : "Not set"}</strong></header><i><b style={{ width: `${Math.min(100, latestDay?.used || 0)}%` }}/></i><small>{latestDay?.used.toFixed(0) || 0}% of {dailyCapPct ? fmtMoney(-dailyCapacity) : fmtMoneyShort(0)} cap used on latest day</small></div><div><header><span>Monthly loss capacity</span><strong className="tj-green">{monthlyCapPct ? fmtMoney(monthlyCapacity) : "Not set"}</strong></header><i><b style={{ width: `${Math.min(100, latestMonth?.used || 0)}%` }}/></i><small>{latestMonth?.used.toFixed(0) || 0}% of {monthlyCapPct ? fmtMoney(-monthlyLimit) : fmtMoneyShort(0)} cap used in latest month</small></div><div className="tj-risk-target"><small>MONTHLY TARGET</small><strong className="tj-purple-txt">{monthlyTarget ? fmtMoney(monthlyTarget) : "Optional"}</strong><span>{monthlyTarget ? `${fmtMoney(Math.max(0, monthlyTarget - Math.max(0, latestMonth?.pnl || 0)))} left to target` : "Set a target in Account Settings"}</span></div></section><section className="tj-risk-bases"><div><small>JOURNAL BASE</small><strong>{fmtMoney(account.balance)}</strong><span>Original balance</span></div><div><small>MONTH BASE</small><strong>{fmtMoney(latestMonth?.start || account.balance)}</strong><span>{latestMonth?.pnl >= 0 ? "+" : ""}{latestMonth?.start ? (latestMonth.pnl / latestMonth.start * 100).toFixed(2) : "0.00"}% this month</span></div><div><small>YEAR BASE</small><strong>{fmtMoney(account.balance)}</strong><span>{account.balance ? `${stats.netPnl / account.balance * 100 >= 0 ? "+" : ""}${(stats.netPnl / account.balance * 100).toFixed(2)}% this year` : ""}</span></div><div><small>PEAK DRAWDOWN</small><strong className="tj-red">-{drawdownPct.toFixed(2)}%</strong><span>{fmtMoney(-peakDrawdown)} peak-to-floor</span></div></section></div></Card>
    <Card className="tj-risk-coach"><div className="tj-risk-title"><strong>Coach Notes</strong><small className="tj-pill tj-pill-green">Live</small></div><div className="tj-risk-note tj-risk-note-good"><small>LEAN IN</small><strong>{bestConfluence ? `${bestConfluence.name} is the cleanest added edge right now` : "Build a confluence sample"}</strong><span>{bestConfluence ? `${fmtMoney(bestConfluence.netPnl)} across ${bestConfluence.count} trades with ${bestConfluence.winRate.toFixed(0)}% win rate.` : "Add confluences to unlock this note."}</span></div><div className="tj-risk-note tj-risk-note-good"><small>BEST WINDOW</small><strong>{bestInstrument ? `${bestInstrument.asset} is producing the cleanest flow` : "No leading market yet"}</strong><span>{bestInstrument ? `${fmtMoney(bestInstrument.netPnl)} over ${bestInstrument.count} trades with ${bestInstrument.wins} wins.` : "Log more trades to establish a lead."}</span></div><div className="tj-risk-note tj-risk-note-warn"><small>TRIM FIRST</small><strong>{trimConfluence ? `${trimConfluence.name} needs the next review pass` : "No weak confluence identified"}</strong><span>{trimConfluence ? `${fmtMoney(trimConfluence.netPnl)} with ${trimConfluence.winRate.toFixed(0)}% win rate. Check whether the condition is genuinely helping.` : "Keep reviewing the setup sample."}</span></div><div className="tj-risk-note tj-risk-note-context"><small>RISK CONTEXT</small><strong>{monthlyCapPct ? `${fmtMoney(monthlyCapacity)} monthly buffer still available` : "Set a monthly guardrail"}</strong><span>Trade logging stays live while configured limits remain intact.</span></div><div className="tj-risk-coach-metrics"><div><small>BEST INSTRUMENT P&amp;L</small><strong className="tj-green">{bestInstrument ? fmtMoney(bestInstrument.netPnl) : "—"}</strong><span>{bestInstrument ? `${bestInstrument.asset} · ${bestInstrument.count} trades` : "No data"}</span></div><div><small>COMMISSION + SWAP</small><strong className="tj-red">{fmtMoney(-(stats.totalCommission + stats.totalSwap))}</strong><span>{costPct.toFixed(1)}% of gross profit</span></div><div><small>BEST INSTRUMENT</small><strong className="tj-green">{bestInstrument?.asset || "—"}</strong><span>{bestInstrument ? `${bestInstrument.winRate.toFixed(0)}% WR · ${bestInstrument.avgRR.toFixed(2)} RR` : "No data"}</span></div></div><footer>{bestInstrument?.asset || "The leader"} is leading with {bestInstrument ? fmtMoney(bestInstrument.netPnl) : fmtMoneyShort(0)}. {dragInstrument?.asset || "No instrument"} is the current drag at {dragInstrument ? fmtMoney(dragInstrument.netPnl) : fmtMoneyShort(0)}.</footer></Card></div>
  </div>;
}

function RiskManagementInsightsView({ account, trades, stats }) {
  const averageRR = stats.total ? trades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / stats.total : 0;
  const monthlyCapPct = Number(account.monthlyLossLimitPct) || 0;
  const monthlyGoalPct = Number(account.monthlyGoalPct) || 0;
  const sortedTrades = [...trades].sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));
  let peak = account.balance; let maxDrawdown = 0;
  sortedTrades.reduce((balance, trade) => { const next = balance + trade.pnl; peak = Math.max(peak, next); maxDrawdown = Math.max(maxDrawdown, peak - next); return next; }, account.balance);
  const drawdownPct = peak ? maxDrawdown / peak * 100 : 0;
  const months = Object.values(sortedTrades.reduce((map, trade) => { const key = trade.date.slice(0, 7); if (!map[key]) map[key] = { key, pnl: 0 }; map[key].pnl += trade.pnl; return map; }, {})).sort((a, b) => a.key.localeCompare(b.key));
  let actual = account.balance; let target = account.balance;
  const growthData = months.map((month) => { actual += month.pnl; if (monthlyGoalPct) target *= 1 + monthlyGoalPct / 100; return { label: new Date(`${month.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }), actual, target }; });
  const winningHolds = trades.filter((trade) => trade.pnl > 0 && trade.time && trade.closeTime && trade.closeDate);
  const losingHolds = trades.filter((trade) => trade.pnl < 0 && trade.time && trade.closeTime && trade.closeDate);
  const averageHold = (rows) => rows.length ? rows.reduce((sum, trade) => {
    const start = new Date(`${trade.date}T${trade.time}`);
    const end = new Date(`${trade.closeDate}T${trade.closeTime}`);
    return sum + Math.max(0, (end - start) / 60000);
  }, 0) / rows.length : null;
  const winHold = averageHold(winningHolds);
  const lossHold = averageHold(losingHolds);
  const formatHold = (minutes) => minutes == null ? "Not logged" : minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes.toFixed(0)}m`;
  const recommendations = [];
  if (monthlyCapPct && drawdownPct >= monthlyCapPct * .75) recommendations.push({ tone: "danger", label: "DRAWDOWN CHECK", title: "Observed drawdown is close to the configured monthly risk cap", body: `${drawdownPct.toFixed(2)}% observed against a ${monthlyCapPct.toFixed(2)}% cap. Tighten selection until the account recovers its buffer.` });
  if (averageRR < 1) recommendations.push({ tone: "warning", label: "REWARD QUALITY", title: "Average risk-to-reward needs attention", body: `${averageRR.toFixed(2)}R average reward is below 1R. Review exits and invalidation placement before increasing size.` });
  if (winHold == null || lossHold == null) recommendations.push({ tone: "neutral", label: "HOLDING TIME", title: "Add entry and exit times to unlock holding-time analysis", body: "Timing data will show whether winning trades are being held differently from losing trades." });
  if (!recommendations.length) recommendations.push({ tone: "good", label: "RISK POSTURE", title: "Risk and reward remain inside the configured range", body: "No urgent risk-management signal was found in the current journal sample." });

  return <div className="tj-risk-insights-workspace">
    <Card className="tj-risk-insights-summary"><div className="tj-risk-title"><div><strong>Risk Management Insights</strong><span>A compact read on reward quality, account protection, and whether profitable and losing trades are being managed differently.</span></div><small className="tj-pill">Live journal data</small></div><div className="tj-risk-insight-five"><div><small>AVERAGE RISK-TO-REWARD</small><strong className="tj-purple-txt">{averageRR.toFixed(2)}R</strong><span>Across {stats.total} trades</span></div><div><small>MAX OBSERVED DRAWDOWN</small><strong className="tj-red">-{drawdownPct.toFixed(2)}%</strong><span>{fmtMoney(-maxDrawdown)} peak-to-floor</span></div><div><small>MAX ALLOWED DRAWDOWN</small><strong>{monthlyCapPct ? `${monthlyCapPct.toFixed(2)}%` : "Not set"}</strong><span>{monthlyCapPct ? "Using the monthly risk cap" : "Configure in Account Settings"}</span></div><div><small>WINNING TRADE HOLD</small><strong className="tj-green">{formatHold(winHold)}</strong><span>{winHold == null ? "Add entry and exit times" : `${winningHolds.length} timed winning trades`}</span></div><div><small>LOSING TRADE HOLD</small><strong className="tj-red">{formatHold(lossHold)}</strong><span>{lossHold == null ? "Add entry and exit times" : `${losingHolds.length} timed losing trades`}</span></div></div></Card>

    <Card className="tj-risk-growth"><div className="tj-risk-title"><div><strong>Monthly Growth Evolution</strong><span>Actual compounded equity against the monthly target baseline. The baseline begins at the journal balance and compounds only when a monthly goal is configured.</span></div><small className="tj-pill">{monthlyGoalPct ? `${monthlyGoalPct.toFixed(2)}% target / month` : "No monthly target"}</small></div><div className="tj-risk-growth-chart"><ResponsiveContainer width="100%" height={260}><AreaChart data={growthData}><defs><linearGradient id="riskGrowthActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.25}/><stop offset="100%" stopColor={UI_COLORS.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false}/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoneyShort(value)}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value, name) => [fmtMoney(value), name === "actual" ? "Real equity" : "Target baseline"]}/><Area type="monotone" dataKey="actual" stroke={UI_COLORS.primary} fill="url(#riskGrowthActual)" strokeWidth={2.5}/><Area type="monotone" dataKey="target" stroke={UI_COLORS.purple} fill="transparent" strokeWidth={2} strokeDasharray="6 5"/></AreaChart></ResponsiveContainer></div><footer><span><i/> Real equity</span><span><i/> Projected target baseline</span></footer></Card>

    <Card className="tj-risk-recommendations"><div className="tj-risk-title"><strong>Actionable Recommendations</strong><small className="tj-pill">{recommendations.length} signal{recommendations.length === 1 ? "" : "s"}</small></div><div>{recommendations.map((item) => <section className={`tj-risk-recommendation tj-risk-recommendation-${item.tone}`} key={item.label}><small>{item.label}</small><strong>{item.title}</strong><span>{item.body}</span></section>)}</div></Card>
  </div>;
}

const FINANCE_QUOTES = [
  "Capital protected today is opportunity preserved tomorrow.",
  "Give every dollar a job before you ask it to grow.",
  "A clean ledger makes disciplined trading easier to repeat.",
  "Savings is profit with a purpose, not capital that disappeared.",
  "Move money deliberately; let your journal show the full picture.",
];

function FinancePage({ account, onRecord, onDelete }) {
  const [type, setType] = useState("deposit");
  const [source, setSource] = useState("trading");
  const [savingsAccountId, setSavingsAccountId] = useState(account.savingsAccounts?.[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const quote = useState(() => FINANCE_QUOTES[Math.floor(Math.random() * FINANCE_QUOTES.length)])[0];
  const totals = financeTotals(account);
  const profitCycle = financeProfitCycle(account);
  const savingsAccounts = account.savingsAccounts || [];
  const cashMovements = [...(account.financeMovements || [])].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const requiresSavings = type === "transfer" || (type === "withdrawal" && source === "savings");
  const record = async () => {
    if (!(Number(amount) > 0) || (requiresSavings && !savingsAccountId)) return;
    const ok = await onRecord({type, source:type === "deposit" ? "trading" : source, savingsAccountId:requiresSavings ? savingsAccountId : null, amount:Number(amount), date, note});
    if (ok) { setAmount(""); setNote(""); }
  };
  const recordPlannedTransfer = async (saving) => {
    const profitSinceCashMovement = Math.max(0, financeProfitCycle(account).profit);
    const amountToTransfer = profitSinceCashMovement * (Number(saving.allocationPct) || 0) / 100;
    if (!(amountToTransfer > 0)) return;
    await onRecord({type:"transfer", source:"trading", savingsAccountId:saving.id, amount:Number(amountToTransfer.toFixed(2)), date:todayISO(), note:`${Number(saving.allocationPct) || 0}% of profit since last cash movement`});
  };
  const movementLabel = (movement) => movement.type === "deposit" ? "Funds added" : movement.type === "transfer" ? `Transfer to ${savingsAccounts.find((item) => item.id === movement.savingsAccountId)?.name || "savings"}` : `Funds withdrawn from ${movement.source === "savings" ? (savingsAccounts.find((item) => item.id === movement.savingsAccountId)?.name || "savings") : "trading"}`;
  return <div className="tj-finance-page">
    <section className="tj-finance-hero"><div><span>CAPITAL OVERVIEW</span><h1>Finance</h1><p>Track cash movements and savings without mixing them into your trading statistics.</p><small>Profit since last cash movement: <b>{fmtMoney(profitCycle.profit)}</b> · baseline {fmtMoney(profitCycle.baseline)}</small></div><aside><Lightbulb size={18}/><strong>Trading quote</strong><em>“{quote}”</em></aside></section>
    <div className="tj-finance-layout"><Card className="tj-finance-ledger"><div className="tj-finance-card-title"><div><small>CAPITAL LEDGER</small><strong>Cash movements</strong></div><span>ACCOUNT ONLY</span></div><div className="tj-finance-form"><Field label="Movement"><select className="tj-input" value={type} onChange={(event) => { setType(event.target.value); if (event.target.value === "deposit") setSource("trading"); }}><option value="deposit">Add funds</option><option value="withdrawal">Withdraw funds</option><option value="transfer">Transfer to savings</option></select></Field>{type === "withdrawal" && <Field label="Withdraw from"><select className="tj-input" value={source} onChange={(event) => setSource(event.target.value)}><option value="trading">Trading account</option><option value="savings">Savings account</option></select></Field>}{requiresSavings && <Field label={type === "transfer" ? "Transfer target" : "Withdrawal account"}><select className="tj-input" value={savingsAccountId} onChange={(event) => setSavingsAccountId(event.target.value)}><option value="" disabled>Select savings account</option>{savingsAccounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>}<Field label={`Amount (${account.baseCurrency})`}><input className="tj-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)}/></Field><Field label="Date"><input className="tj-input" type="date" value={date} onChange={(event) => setDate(event.target.value)}/></Field><Field label="Note"><input className="tj-input" value={note} placeholder="Optional reference" onChange={(event) => setNote(event.target.value)}/></Field></div><button type="button" className="tj-btn-primary tj-finance-record" onClick={record} disabled={!(Number(amount) > 0) || (requiresSavings && !savingsAccountId)}><ArrowDownToLine size={15}/> Record movement</button><div className="tj-finance-movement-list">{cashMovements.length ? cashMovements.map((movement) => <div key={movement.id} className="tj-finance-movement"><i className={movement.type === "deposit" ? "tj-finance-movement-in" : "tj-finance-movement-out"}>{movement.type === "deposit" ? <ArrowDownToLine size={15}/> : movement.type === "transfer" ? <Repeat2 size={15}/> : <ArrowUpFromLine size={15}/>}</i><div><strong>{movementLabel(movement)}</strong><span>{movement.date}{movement.note ? ` · ${movement.note}` : ""}</span></div><b className={movement.type === "deposit" ? "tj-green" : "tj-red"}>{movement.type === "deposit" ? "+" : "-"}{fmtMoney(Math.abs(movement.amount)).replace(/^\+/, "")}</b><ConfirmDeleteButton type="button" className="tj-finance-delete" title="Delete movement" onClick={() => onDelete(movement.id)}><Trash2 size={14}/></ConfirmDeleteButton></div>) : <div className="tj-finance-empty">No cash movements yet. Add a deposit, withdrawal, or transfer when it happens.</div>}</div></Card>
      <aside className="tj-finance-summary"><Card className="tj-finance-card-capital"><small>AVAILABLE CAPITAL</small><strong>{fmtMoney(totals.tradingBalance)}</strong><span>Trading account balance</span></Card><Card className="tj-finance-card-savings"><small>TOTAL SAVINGS</small><strong>{fmtMoney(totals.savings)}</strong><span>{savingsAccounts.length} savings account{savingsAccounts.length === 1 ? "" : "s"} · {fmtMoney(totals.totalCapital)} combined</span></Card><Card className="tj-finance-card-deposit"><small>DEPOSITS</small><strong>{fmtMoney(totals.deposits)}</strong><span>Funds added to trading</span></Card><Card className="tj-finance-card-withdrawal"><small>WITHDRAWALS</small><strong>{fmtMoney(-totals.withdrawals)}</strong><span>Funds removed from accounts</span></Card></aside>
    </div>
    <section className="tj-finance-savings"><div className="tj-finance-card-title"><div><small>SAVINGS ACCOUNTS</small><strong>Targets and balances</strong></div><WalletCards size={18}/></div>{savingsAccounts.length ? savingsAccounts.map((saving) => { const saved = financeSavingsBalance(account, saving.id); const pct = saving.target ? clamp(saved / saving.target * 100, 0, 100) : 0; const ready = Math.max(0, profitCycle.profit * (Number(saving.allocationPct) || 0) / 100); return <div className="tj-finance-saving" key={saving.id}><div><small>SAVINGS PLAN</small><strong>{saving.name}</strong><span>{saving.interval} · {saving.allocationPct || 0}% allocation</span></div><div><small>SAVED</small><strong>{fmtMoney(saved)}</strong><span>of {fmtMoney(saving.target)} target</span></div><div className="tj-finance-saving-progress"><small>{pct.toFixed(0)}% GOAL PROGRESS</small><i><b style={{width:`${pct}%`}} /></i><span>{fmtMoney(Math.max(0, saving.target - saved))} remaining</span></div><div className="tj-finance-saving-transfer"><strong>{saving.allocationPct || 0}% <small>OF PROFIT</small></strong><span>{profitCycle.profit > 0 ? `${fmtMoney(ready)} from ${fmtMoney(profitCycle.profit)} profit` : "No profit since the last cash movement"}</span><button type="button" className="tj-btn-outline tj-btn-small" disabled={!(ready > 0)} onClick={() => recordPlannedTransfer(saving)}><Repeat2 size={14}/> Record transfer</button></div></div>; }) : <div className="tj-finance-empty">Add a savings account in Account Settings to use transfers.</div>}</section>
  </div>;
}

function FinanceReminderModal({ account, savingsPlans, onClose, onOpenFinance }) {
  const cycle = financeProfitCycle(account);
  return <Modal title="Savings transfer reminder" onClose={onClose} centered className="tj-finance-reminder"><div className="tj-finance-reminder-copy"><Landmark size={22}/><strong>Your profit target has been reached.</strong><p>Profit since the last cash movement is <b>{fmtMoney(cycle.profit)}</b> on a {fmtMoney(cycle.baseline)} baseline.</p></div><div className="tj-finance-reminder-list">{savingsPlans.map((saving) => { const amount = Math.max(0, cycle.profit * (Number(saving.allocationPct) || 0) / 100); return <div key={saving.id}><span>{saving.name}</span><strong>{saving.allocationPct}% = {fmtMoney(amount)}</strong></div>; })}</div><div className="tj-modal-actions"><button className="tj-btn-outline" onClick={onClose}>Later</button><button className="tj-btn-primary" onClick={() => { onOpenFinance(); onClose(); }}>Open Finance</button></div></Modal>;
}

function AnalyticsPage({ account }) {
  const allTrades = account.trades;
  const analyticsYear = allTrades.length
    ? Math.max(...allTrades.map((trade) => Number(trade.date?.slice(0, 4)) || new Date().getFullYear()))
    : new Date().getFullYear();
  const monthOptions = MONTH_NAMES.map((name, index) => {
    const key = `${analyticsYear}-${String(index + 1).padStart(2, "0")}`;
    return { key, name, short: name.slice(0, 3).toUpperCase(), count: allTrades.filter((trade) => trade.date?.startsWith(key)).length };
  });
  const [selectedAnalyticsMonths, setSelectedAnalyticsMonths] = useState([]);
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef(null);
  const trades = selectedAnalyticsMonths.length
    ? allTrades.filter((trade) => selectedAnalyticsMonths.includes(trade.date?.slice(0, 7)))
    : allTrades;
  const cap = account.breakevenCap;
  const stats = computeStats(trades, cap);
  const liveGuardrails = accountGuardrails(account, allTrades);
  const liveGuardrailStats = computeStats(allTrades, cap);
  const [analyticsTab, setAnalyticsTab] = useState("overview");
  const [engineTab, setEngineTab] = useState("overview");

  useEffect(() => {
    setSelectedAnalyticsMonths([]);
    setPeriodOpen(false);
  }, [account.id]);

  useEffect(() => {
    if (!periodOpen) return undefined;
    const closePicker = (event) => {
      if (event.type === "keydown" && event.key === "Escape") setPeriodOpen(false);
      if (event.type === "mousedown" && periodRef.current && !periodRef.current.contains(event.target)) setPeriodOpen(false);
    };
    document.addEventListener("mousedown", closePicker);
    document.addEventListener("keydown", closePicker);
    return () => {
      document.removeEventListener("mousedown", closePicker);
      document.removeEventListener("keydown", closePicker);
    };
  }, [periodOpen]);

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
    const ts = trades.filter((t) => normalizeSession(t.entrySession || t.session) === s);
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
      if (!map[t.asset]) map[t.asset] = { asset: t.asset, count: 0, netPnl: 0, wins: 0, rrSum: 0, best: -Infinity, worst: Infinity };
      map[t.asset].count++; map[t.asset].netPnl += t.pnl; map[t.asset].rrSum += t.rr || 0;
      if (classify(t.pnl, cap) === "win") map[t.asset].wins++;
      map[t.asset].best = Math.max(map[t.asset].best, t.pnl); map[t.asset].worst = Math.min(map[t.asset].worst, t.pnl);
    });
    return Object.values(map).map((m) => {
      const winRate = m.count ? (m.wins / m.count) * 100 : 0;
      return { ...m, winRate, avgRR: m.count ? m.rrSum / m.count : 0, grade: getGrade(winRate, m.netPnl, m.count) };
    }).sort((a, b) => b.netPnl - a.netPnl);
  }, [trades, cap]);

  const pairingStats = useMemo(() => {
    const map = {};
    trades.forEach((trade) => {
      const entry = trade.entryType || trade.confluenceSession;
      if (!entry) return;
      (trade.confluence || trade.types || []).forEach((confluence) => {
        if (!confluence) return;
        const key = `${entry} + ${confluence}`;
        if (!map[key]) map[key] = { name: key, count: 0, netPnl: 0, wins: 0, rrSum: 0, best: -Infinity, worst: Infinity };
        map[key].count += 1;
        map[key].netPnl += trade.pnl;
        map[key].rrSum += Number(trade.rr) || 0;
        if (classify(trade.pnl, cap) === "win") map[key].wins += 1;
        map[key].best = Math.max(map[key].best, trade.pnl); map[key].worst = Math.min(map[key].worst, trade.pnl);
      });
    });
    return Object.values(map).map((item) => {
      const winRate = item.count ? item.wins / item.count * 100 : 0;
      return { ...item, winRate, avgRR: item.count ? item.rrSum / item.count : 0, grade: getGrade(winRate, item.netPnl, item.count) };
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
    let running = Number(account.balance) || 0;
    const events = [...stats.sorted.map((trade) => ({ date:trade.date, kind:"trade", value:Number(trade.pnl || 0), label:trade.asset || "Trade" })), ...(account.financeMovements || []).map((movement) => ({ date:movement.date, kind:"cash", value:financeTradingImpact(movement), label:movement.type === "deposit" ? "Deposit" : movement.type === "transfer" ? "Transfer to savings" : "Withdrawal" }))].sort((a,b) => String(a.date).localeCompare(String(b.date)) || (a.kind === "cash" ? -1 : 1));
    const arr = [{ label: "Start", equity: running, event:"Starting balance" }];
    events.forEach((event, i) => { running += event.value; arr.push({ label:event.date || `Event ${i + 1}`, equity:+running.toFixed(2), event:`${event.label} ${event.value >= 0 ? "+" : ""}${fmtMoney(event.value)}` }); });
    return arr;
  }, [stats.sorted, account.balance, account.financeMovements]);
  const currentEquity = equityData[equityData.length - 1]?.equity ?? Number(account.balance || 0);
  const equityChangePct = account.balance ? ((currentEquity - account.balance) / account.balance) * 100 : 0;
  const highestEquity = equityData.reduce((best, point) => Math.max(best, point.equity), account.balance);
  const lowestEquity = equityData.reduce((lowest, point) => Math.min(lowest, point.equity), account.balance);
  const currentMonthKey = todayISO().slice(0, 7);
  const currentMonthPnl = trades.filter((trade) => trade.date?.slice(0, 7) === currentMonthKey).reduce((sum, trade) => sum + trade.pnl, 0) + (account.financeMovements || []).filter((movement) => movement.date?.slice(0, 7) === currentMonthKey).reduce((sum, movement) => sum + financeTradingImpact(movement), 0);
  const monthBase = currentEquity - currentMonthPnl;
  const currentMonthPct = monthBase ? currentMonthPnl / monthBase * 100 : 0;
  const maxDrawdown = equityData.reduce((state, point) => {
    const peak = Math.max(state.peak, point.equity);
    const drawdown = peak - point.equity;
    return drawdown > state.amount ? { peak, amount: drawdown, pct: peak ? drawdown / peak * 100 : 0 } : { ...state, peak };
  }, { peak: account.balance, amount: 0, pct: 0 });
  const bestConfluence = confluenceStats[0];
  const bestEntryType = tagStats[0];
  const bestPairing = pairingStats[0];
  const bestInstrument = instrumentStats[0];
  const costPct = stats.grossProfit > 0 ? ((stats.totalCommission + stats.totalSwap) / stats.grossProfit) * 100 : 0;
  const activeDates = new Set(trades.map((trade) => trade.date)).size;
  const averageRR = stats.total ? trades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / stats.total : 0;
  const taggedTrades = trades.filter((trade) => trade.entryType || trade.confluenceSession).length;
  const executionLabel = stats.thunderScore >= 80 ? "High conviction" : stats.thunderScore >= 60 ? "Solid execution" : stats.thunderScore >= 40 ? "Developing" : "Needs attention";
  const liveInstrumentStats = instrumentStats.slice(0, 5);
  const liveChartColors = [UI_COLORS.primary, UI_COLORS.purple, UI_COLORS.info, UI_COLORS.warning, UI_COLORS.danger];
  let allocationCursor = 0;
  const allocationStops = instrumentStats.map((item, index) => {
    const start = allocationCursor;
    const end = stats.total ? start + item.count / stats.total * 100 : start;
    allocationCursor = end;
    return `${liveChartColors[index % liveChartColors.length]} ${start}% ${end}%`;
  }).join(", ");
  const allocationBackground = allocationStops ? `conic-gradient(${allocationStops})` : "conic-gradient(var(--tj-border) 0 100%)";
  const dailyGrowthData = tradingDays.map((day) => ({
    date: day.date.slice(5),
    pnl: day.pnl,
    count: trades.filter((trade) => trade.date === day.date).length,
    pct: account.balance ? +(day.pnl / account.balance * 100).toFixed(2) : 0,
  }));
  const bestDailyPct = dailyGrowthData.length ? Math.max(...dailyGrowthData.map((day) => day.pct)) : 0;
  const worstDailyPct = dailyGrowthData.length ? Math.min(...dailyGrowthData.map((day) => day.pct)) : 0;

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
      <AccountGuardrailsPanel account={account} guardrails={liveGuardrails} stats={liveGuardrailStats}/>
      <Card className="tj-analytics-deck" id="analytics-overview">
        <div className="tj-analytics-deck-copy"><span>ANALYTICS DECK</span><strong>{analyticsTab === "performance" ? "Performance Metrics" : analyticsTab === "rhythm" ? "Execution Rhythm" : analyticsTab === "guardrails" ? "Risk Guardrails" : analyticsTab === "insights" ? "Risk Management Insights" : "Overview"}</strong><small>{analyticsTab === "performance" ? "Entry models, confluences, and instruments separated so the real edge is easier to see." : analyticsTab === "rhythm" ? "When you perform best, how the weeks are pacing, and where the session flow is strongest." : analyticsTab === "guardrails" ? "Dynamic baselines, live buffers, and the drawdown context steering the account." : analyticsTab === "insights" ? "Risk-to-reward, drawdown discipline, holding time, and the next actions suggested by your real trade history." : "All-time balance, trade engine quality, and the live compounded account read."}</small></div>
        <div className="tj-analytics-deck-tabs" role="tablist" aria-label="Analytics sections">{[["overview", "Overview", "analytics-overview"], ["performance", "Performance Metrics", "analytics-performance"], ["rhythm", "Execution Rhythm", "analytics-rhythm"], ["guardrails", "Risk Guardrails", "analytics-guardrails"], ["insights", "Risk Management Insights", "analytics-insights"]].map(([id, label, target]) => <button key={id} type="button" role="tab" aria-selected={analyticsTab === id} className={analyticsTab === id ? "tj-analytics-deck-tab-active" : ""} onClick={() => { setAnalyticsTab(id); if (id !== "performance" && id !== "overview") setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>{label}</button>)}</div>
        <div className="tj-analytics-period-wrap" ref={periodRef}>
          <button type="button" className={`tj-analytics-period ${periodOpen ? "tj-analytics-period-open" : ""}`} title="Choose analytics months" aria-haspopup="dialog" aria-expanded={periodOpen} onClick={() => setPeriodOpen((open) => !open)}>
            <CalendarIcon size={14}/><span>{selectedAnalyticsMonths.length === 0 ? "All time" : selectedAnalyticsMonths.length === 1 ? monthOptions.find((month) => month.key === selectedAnalyticsMonths[0])?.name : `${selectedAnalyticsMonths.length} months`}</span>{periodOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
          </button>
          {periodOpen && <div className="tj-analytics-period-popover" role="dialog" aria-label="Filter analytics by month">
            <header><strong>MONTHS</strong><button type="button" onClick={() => { setSelectedAnalyticsMonths([]); setPeriodOpen(false); }}>All time</button></header>
            <p>Pick one or stack several months like Feb and Sep.</p>
            <div>{monthOptions.map((month) => {
              const selected = selectedAnalyticsMonths.includes(month.key);
              return <button type="button" key={month.key} disabled={!month.count} className={selected ? "tj-analytics-month-active" : ""} aria-pressed={selected} onClick={() => setSelectedAnalyticsMonths((current) => current.includes(month.key) ? current.filter((key) => key !== month.key) : [...current, month.key])}>{month.short} <span>{month.count}</span></button>;
            })}</div>
          </div>}
        </div>
      </Card>

      <div className="tj-view-transition" key={analyticsTab}>
      {analyticsTab === "performance" ? <PerformanceMetricsView account={account} trades={trades} cap={cap} stats={stats} tagStats={tagStats} confluenceStats={confluenceStats} pairingStats={pairingStats} instrumentStats={instrumentStats}/> : analyticsTab === "rhythm" ? <ExecutionRhythmView account={account} trades={trades} cap={cap} stats={stats}/> : analyticsTab === "guardrails" ? <RiskGuardrailsView account={account} trades={trades} cap={cap} stats={stats} confluenceStats={confluenceStats} instrumentStats={instrumentStats}/> : analyticsTab === "insights" ? <RiskManagementInsightsView account={account} trades={trades} stats={stats}/> : <>

      <Card className="tj-analytics-equity-hero">
        <div className="tj-analytics-equity-head"><div><div className="tj-section-label">ALL-TIME EQUITY</div><h2>{fmtMoney(currentEquity)} live balance</h2><p>Starts at {fmtMoney(account.balance)}. Trade results and dated account cash movements roll into this balance line; trade metrics below remain trade-only.</p></div><div className="tj-analytics-hero-return"><strong className={equityChangePct >= 0 ? "tj-green" : "tj-red"}>{equityChangePct >= 0 ? "+" : ""}{equityChangePct.toFixed(2)}%</strong><span>{stats.total} trades tracked</span><small>{fmtMoney(currentMonthPnl)} this month · {currentMonthPct >= 0 ? "+" : ""}{currentMonthPct.toFixed(2)}%</small></div></div>
        <div className="tj-analytics-equity-chart"><ResponsiveContainer width="100%" height={180}><AreaChart data={equityData}><defs><linearGradient id="analyticsEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.purple} stopOpacity={.32}/><stop offset="100%" stopColor={UI_COLORS.purple} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" hide/><YAxis hide domain={["dataMin - 100", "dataMax + 100"]}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => [fmtMoney(value), "Equity"]}/><Area type="monotone" dataKey="equity" stroke={UI_COLORS.purple} fill="url(#analyticsEquity)" strokeWidth={2.5} dot={false}/></AreaChart></ResponsiveContainer><div className="tj-analytics-equity-milestones"><div><small>BASE</small><strong>{fmtMoney(account.balance)}</strong><span>Original starting balance</span></div><div><small>LOW PRINT</small><strong>{fmtMoney(lowestEquity)}</strong><span>Lowest balance print so far</span></div><div><small>MONTH BASE</small><strong>{fmtMoney(monthBase)}</strong><span>Current compounding reset point</span></div><div><small>HIGH-WATER</small><strong>{fmtMoney(highestEquity)}</strong><span>Best balance print so far</span></div><div><small>PEAK TO LOW</small><strong className="tj-red">-{maxDrawdown.pct.toFixed(2)}%</strong><span>{fmtMoney(-maxDrawdown.amount)} drawdown</span></div><div><small>NOW</small><strong>{fmtMoney(currentEquity)}</strong><span>Live balance right now</span></div></div></div>
      </Card>

      <Card key={engineTab} className={`tj-analytics-engine tj-analytics-engine-wide tj-engine-view-${engineTab} tj-subview-transition`}>
        <div className="tj-engine-wide-head"><div><span>TRADING ENGINE</span><small>{engineTab === "overview" ? "Read the journal at engine level before drilling into single trades." : engineTab === "models" ? "Separate the entry model from the confluence stack and see what carries the edge." : engineTab === "confluences" ? "Measure the added edge from conditions around the trade, not just the idea itself." : "Stack the model and confluence together to see what is worth repeating with size."}</small></div><div className="tj-engine-tabs" role="tablist" aria-label="Trading engine sections">{[["overview", "Overview"], ["models", "Entry Models"], ["confluences", "Confluences"], ["pairings", "Pairings"]].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={engineTab === id} className={engineTab === id ? "tj-engine-tab-active" : ""} onClick={() => setEngineTab(id)}>{label}</button>)}</div></div>

        {engineTab === "overview" && <>
          <div className="tj-engine-wide-value"><div><span>Your trade engine is the first thing to read<br/>before drilling into setups.</span><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(stats.netPnl)}</strong><div className="tj-engine-pills"><i>{equityChangePct >= 0 ? "+" : ""}{equityChangePct.toFixed(2)}% on compounded journal base</i><i>{fmtMoney(stats.total ? stats.netPnl / stats.total : 0)} expectancy per trade</i><i>{averageRR.toFixed(2)} avg RR</i><i>{taggedTrades === stats.total ? "Entry model tagged on every trade" : `${taggedTrades}/${stats.total} trades use an Entry Model`}</i></div></div><div className="tj-engine-score"><small>EXECUTION<br/>QUALITY</small><strong>{stats.thunderScore}</strong><span>{executionLabel}</span></div></div>
          <div className="tj-engine-metrics"><div><small>WIN RATE</small><strong className={wrColorClass(stats.winRate)}>{stats.winRate.toFixed(0)}%</strong><span>{stats.wins} wins from {stats.total} total trades</span></div><div><small>PROFIT FACTOR</small><strong>{stats.profitFactor.toFixed(2)}</strong><span>{stats.avgWinLoss.toFixed(2)} avg win/loss edge</span></div><div><small>CONSISTENCY</small><strong>{stats.consistency.toFixed(0)}</strong><span>{stats.bestWinStreak}W best run · {stats.bestLossStreak}L max loss run</span></div><div><small>RECOVERY</small><strong>{stats.recovery.toFixed(0)}%</strong><span>How often the next trade recovers after a loss</span></div><div><small>LARGEST WIN</small><strong className="tj-green">{fmtMoney(Math.max(...trades.map((trade) => trade.pnl)))}</strong><span>{trades.slice().sort((a, b) => b.pnl - a.pnl)[0]?.asset || "Best closed trade"} · {trades.slice().sort((a, b) => b.pnl - a.pnl)[0]?.date || ""}</span></div><div><small>LARGEST LOSS</small><strong className="tj-red">{fmtMoney(Math.min(...trades.map((trade) => trade.pnl)))}</strong><span>{trades.slice().sort((a, b) => a.pnl - b.pnl)[0]?.asset || "Largest closed loss"} · {trades.slice().sort((a, b) => a.pnl - b.pnl)[0]?.date || ""}</span></div></div>
          <div className="tj-engine-trade-mix"><span>TRADE MIX</span><small>{stats.wins}W / {stats.losses}L / {stats.be} B/E</small><i><em style={{ width: `${stats.total ? stats.wins / stats.total * 100 : 0}%` }}/><b style={{ width: `${stats.total ? stats.losses / stats.total * 100 : 0}%` }}/></i></div>
        </>}

        {engineTab === "models" && <div className="tj-engine-drilldown"><div className="tj-engine-drilldown-hero"><div><p>This view isolates the entry model first, so you can see whether the idea itself is working before the rest of the confluence stack gets credit.</p><h3>{bestEntryType?.tag || "No model yet"}</h3><strong className={bestEntryType?.netPnl >= 0 ? "tj-green" : "tj-red"}>{bestEntryType ? fmtMoney(bestEntryType.netPnl) : fmtMoney(0)}</strong><div className="tj-engine-pills"><i>{bestEntryType ? `${bestEntryType.winRate.toFixed(0)}% WR` : "0% WR"}</i><i>{bestEntryType ? `${bestEntryType.avgRR.toFixed(2)} avg RR` : "0.00 avg RR"}</i><i>{taggedTrades === stats.total ? "Entry model tagged on every trade" : `${taggedTrades}/${stats.total} trades tagged`}</i></div></div><div className="tj-engine-score"><small>BEST MODEL</small><strong>{bestEntryType ? `${bestEntryType.winRate.toFixed(0)}%` : "—"}</strong><span>{bestEntryType ? `${bestEntryType.count} trades · ${bestEntryType.avgRR.toFixed(2)} avg RR` : "Build a tagged sample"}</span></div></div><div className="tj-engine-drilldown-cards tj-engine-model-cards">{tagStats.map((item) => { const grade = getGrade(item.winRate, item.netPnl, item.count); return <div key={item.tag} className="tj-engine-drill-card"><div><strong>{item.tag}</strong><b className={`tj-grade-badge ${grade === "D" || grade === "C" ? "tj-grade-bad" : ""}`}>{grade}</b></div><em className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</em><span>{item.count} trades&nbsp; <b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}% WR</b>&nbsp; {item.avgRR.toFixed(2)} RR</span><i><small className={wrBarClass(item.winRate)} style={{ width: `${item.winRate}%` }}/></i></div>; })}</div></div>}

        {engineTab === "confluences" && <div className="tj-engine-drilldown"><div className="tj-engine-drilldown-hero"><div><p>This separates the supporting confluences from the base entry model, so you can see which conditions are actually adding edge.</p><h3>{bestConfluence?.name || "No confluence yet"}</h3><strong className={bestConfluence?.netPnl >= 0 ? "tj-green" : "tj-red"}>{bestConfluence ? fmtMoney(bestConfluence.netPnl) : fmtMoney(0)}</strong><div className="tj-engine-pills"><i>{bestConfluence ? `${bestConfluence.winRate.toFixed(0)}% WR` : "0% WR"}</i><i>{bestConfluence ? `${bestConfluence.avgRR.toFixed(2)} avg RR` : "0.00 avg RR"}</i><i>{trades.filter((trade) => (trade.confluence || trade.types || []).length).length}/{stats.total} trades tagged with confluence</i></div></div><div className="tj-engine-score"><small>BEST<br/>CONFLUENCE</small><strong>{bestConfluence?.grade || "—"}</strong><span>{bestConfluence ? `${bestConfluence.count} trades · ${bestConfluence.winRate.toFixed(0)}% win rate` : "Build a tagged sample"}</span></div></div><div className="tj-engine-drilldown-cards">{confluenceStats.map((item) => <div key={item.name} className="tj-engine-drill-card"><div><strong>{item.name}</strong><b className={`tj-grade-badge ${item.grade === "D" || item.grade === "C" ? "tj-grade-bad" : ""}`}>{item.grade}</b></div><em className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</em><span>{item.count} trades&nbsp; <b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}% WR</b>&nbsp; {item.avgRR.toFixed(2)} RR</span><i><small className={wrBarClass(item.winRate)} style={{ width: `${item.winRate}%` }}/></i></div>)}</div></div>}

        {engineTab === "pairings" && <div className="tj-engine-drilldown"><div className="tj-engine-drilldown-hero"><div><p>These pairings show which entry model and confluence stacks are producing the cleanest repeatable outcomes, not just which single tag looks good in isolation.</p><h3>{bestPairing?.name || "No pairing yet"}</h3><strong className={bestPairing?.netPnl >= 0 ? "tj-green" : "tj-red"}>{bestPairing ? fmtMoney(bestPairing.netPnl) : fmtMoney(0)}</strong><div className="tj-engine-pills"><i>{bestPairing ? `${bestPairing.winRate.toFixed(0)}% WR` : "0% WR"}</i><i>{bestPairing ? `${bestPairing.avgRR.toFixed(2)} avg RR` : "0.00 avg RR"}</i><i>{pairingStats.length} pairings read</i></div></div><div className="tj-engine-score"><small>BEST PAIRING</small><strong>{bestPairing?.grade || "—"}</strong><span>{bestPairing ? `${bestPairing.count} trades · ${bestPairing.winRate.toFixed(0)}% win rate` : "Build a paired sample"}</span></div></div><div className="tj-engine-drilldown-cards">{pairingStats.slice(0, 6).map((item) => <div key={item.name} className="tj-engine-drill-card"><div><strong>{item.name}</strong><b className={`tj-grade-badge ${item.grade === "D" || item.grade === "C" ? "tj-grade-bad" : ""}`}>{item.grade}</b></div><em className={item.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(item.netPnl)}</em><span>{item.count} trades&nbsp; <b className={wrColorClass(item.winRate)}>{item.winRate.toFixed(0)}% WR</b>&nbsp; {item.avgRR.toFixed(2)} RR</span><i><small className={wrBarClass(item.winRate)} style={{ width: `${item.winRate}%` }}/></i></div>)}</div></div>}
      </Card>

      <Card className="tj-live-analytics" id="analytics-live">
        <div className="tj-live-analytics-head"><div><strong>Live Analytics View</strong><span>Hover any chart to inspect trade count, total P&amp;L, and win percentage without removing the overview blocks you already have.</span></div><span className="tj-pill tj-pill-green">Live</span></div>
        <div className="tj-live-analytics-grid">
          <section className="tj-live-panel">
            <div className="tj-live-panel-head"><div><small>WIN RATE BY INSTRUMENT</small><strong>Where the cleanest wins are landing</strong></div><span>{instrumentStats.length} instrument{instrumentStats.length === 1 ? "" : "s"}</span></div>
            <div className="tj-live-instrument-chart">
              {liveInstrumentStats.map((item, index) => <div className="tj-live-instrument-row" key={item.asset} title={`${item.asset}: ${item.count} trades, ${fmtMoney(item.netPnl)}, ${item.winRate.toFixed(0)}% win rate`}><strong>{item.asset}</strong><i><em style={{ width: `${item.winRate}%`, background: liveChartColors[index % liveChartColors.length] }}/></i><span>{item.winRate.toFixed(0)}%</span></div>)}
            </div>
            <div className="tj-live-chips">{liveInstrumentStats.map((item, index) => <span key={item.asset}><i style={{ background: liveChartColors[index % liveChartColors.length] }}/>{item.asset} {item.winRate.toFixed(0)}% WR</span>)}</div>
          </section>

          <section className="tj-live-panel">
            <div className="tj-live-panel-head"><div><small>ASSET ALLOCATION &amp; EXPOSURE</small><strong>How the journal is distributed</strong></div><span>{stats.total} trades</span></div>
            <div className="tj-live-donut-wrap"><div className="tj-live-donut" style={{ background: allocationBackground }} title={`${stats.total} trades across ${instrumentStats.length} instruments`}><div><strong>{stats.total}</strong><span>LIVE SPLIT</span><small>{instrumentStats.length} instrument{instrumentStats.length === 1 ? "" : "s"} in rotation</small></div></div></div>
            <div className="tj-live-chips">{liveInstrumentStats.map((item, index) => <span key={item.asset}><i style={{ background: liveChartColors[index % liveChartColors.length] }}/>{item.asset} {fmtMoney(item.netPnl)}</span>)}</div>
          </section>

          <section className="tj-live-panel">
            <div className="tj-live-panel-head"><div><small>DAILY P&amp;L GROWTH</small><strong>The day-by-day pulse of the account</strong></div><span>{tradingDays.length} days</span></div>
            <div className="tj-live-daily-chart"><ResponsiveContainer width="100%" height={185}><AreaChart data={dailyGrowthData}><defs><linearGradient id="liveDailyGrowth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UI_COLORS.primary} stopOpacity={.24}/><stop offset="100%" stopColor={UI_COLORS.purple} stopOpacity={0}/></linearGradient><linearGradient id="liveDailyStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={UI_COLORS.primary}/><stop offset="100%" stopColor={UI_COLORS.purple}/></linearGradient></defs><CartesianGrid stroke="var(--tj-chart-grid)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" hide/><YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`} width={45}/><Tooltip itemStyle={{color:"var(--tj-text)"}} labelStyle={{color:"var(--tj-text)"}} contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(label) => `Date ${label}`} formatter={(value, _name, item) => [`${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}% · ${fmtMoney(item.payload.pnl)} · ${item.payload.count} trade${item.payload.count === 1 ? "" : "s"}`, "Daily result"]}/><Area type="monotone" dataKey="pct" stroke="url(#liveDailyStroke)" fill="url(#liveDailyGrowth)" strokeWidth={2.25} dot={false}/></AreaChart></ResponsiveContainer></div>
            <div className="tj-live-chips"><span>BEST DAY <b className="tj-green">{bestDailyPct >= 0 ? "+" : ""}{bestDailyPct.toFixed(2)}%</b></span><span>WORST DAY <b className={worstDailyPct >= 0 ? "tj-green" : "tj-red"}>{worstDailyPct >= 0 ? "+" : ""}{worstDailyPct.toFixed(2)}%</b></span></div>
          </section>
        </div>
      </Card>

      </>}
      </div>
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
        <div className="tj-panel-head"><span>{title}</span><span className="tj-muted-txt" style={{ fontSize: 13 }}>{rows.length} {unitLabel}{rows.length !== 1 ? "s" : ""}</span></div>
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
          <div className="tj-green tj-bold" style={{ fontSize: 21.6 }}>{fmtMoney(best.pnl)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 13 }}>{best.label}</div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">WORST {unitLabel.toUpperCase()}</div>
          <div className="tj-red tj-bold" style={{ fontSize: 21.6 }}>{fmtMoney(worst.pnl)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 13 }}>{worst.label}</div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">AVG {unitLabel.toUpperCase()}LY</div>
          <div className={`tj-bold ${avg >= 0 ? "tj-green" : "tj-red"}`} style={{ fontSize: 21.6 }}>{fmtMoney(avg)}</div>
          <div className="tj-muted-txt" style={{ fontSize: 13 }}>Average</div>
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
          <div className="tj-green tj-bold" style={{ fontSize: 21.6 }}>{DOW_FULL[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(most.label)]}</div>
          <div className="tj-muted-txt" style={{ fontSize: 13 }}>{fmtMoney(most.pnl)} · <span className={wrColorClass(most.winRate)}>{most.winRate.toFixed(0)}% WR</span></div>
        </Card>
        <Card className="tj-panel tj-perf-summary-card">
          <div className="tj-mlabel">LEAST PROFITABLE DAY</div>
          <div className={`tj-bold ${least.pnl >= 0 ? "tj-green" : "tj-red"}`} style={{ fontSize: 21.6 }}>{DOW_FULL[["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(least.label)]}</div>
          <div className="tj-muted-txt" style={{ fontSize: 13 }}>{fmtMoney(least.pnl)} · <span className={wrColorClass(least.winRate)}>{least.winRate.toFixed(0)}% WR</span></div>
        </Card>
      </div>
    </>
  );
}

function CalendarPage({ account, monthCursor, setMonthCursor, onDayClick }) {
  const [calTab, setCalTab] = useState("calendar");

  return (
    <div>
      <div className="tj-cal-tabs">
        <button className={`tj-newstab ${calTab === "calendar" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("calendar")}>📅 Calendar</button>
        <button className={`tj-newstab ${calTab === "monthly" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("monthly")}>Monthly</button>
        <button className={`tj-newstab ${calTab === "weekly" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("weekly")}>Weekly</button>
        <button className={`tj-newstab ${calTab === "daily" ? "tj-newstab-active" : ""}`} onClick={() => setCalTab("daily")}>Daily</button>
      </div>

      <div className="tj-view-transition" key={calTab}>
      {calTab === "calendar" && <AttachedPnlCalendar account={account} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={onDayClick} className="tj-main-attached-calendar"/>}

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
    </div>
  );
}

/* =============================== PSYCHOLOGY ============================= */

function PsychologyPage({ account }) {
  const trades = account.trades || [];
  const cap = account.breakevenCap;
  const moodMap = {};
  trades.forEach((t) => {
    if (!t.moodBefore) return;
    if (!moodMap[t.moodBefore]) moodMap[t.moodBefore] = { count: 0, wins: 0, pnl: 0 };
    moodMap[t.moodBefore].count++;
    moodMap[t.moodBefore].pnl += Number(t.pnl) || 0;
    if (classify(t.pnl, cap) === "win") moodMap[t.moodBefore].wins++;
  });
  const moodData = Object.entries(moodMap).map(([mood, v]) => ({ mood, count: v.count, pnl: v.pnl, winRate: (v.wins / v.count) * 100 }))
    .sort((a, b) => b.count - a.count);

  const mistakeMap = {};
  trades.forEach((t) => (t.mistakes || []).forEach((m) => { mistakeMap[m] = (mistakeMap[m] || 0) + 1; }));
  const mistakeList = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]);
  const moodTagged = trades.filter((trade) => trade.moodBefore).length;
  const mistakeTrades = trades.filter((trade) => (trade.mistakes || []).length > 0).length;
  const cleanTrades = Math.max(0, moodTagged - mistakeTrades);
  const moodCoverage = trades.length ? moodTagged / trades.length * 100 : 0;
  const mistakeRate = trades.length ? mistakeTrades / trades.length * 100 : 0;
  const executionClarity = moodTagged ? cleanTrades / moodTagged * 100 : 0;
  const bestMood = moodData.slice().sort((a, b) => b.winRate - a.winRate || b.count - a.count || b.pnl - a.pnl)[0];
  const topMistake = mistakeList[0];
  const psychologyTitle = executionClarity >= 75 ? "Protect the clean process" : executionClarity >= 50 ? "Review before sizing up" : "Slow down and reset";
  const psychologyNote = executionClarity >= 75
    ? "Your clean, tagged trades are forming a reliable baseline. Keep recording the emotional state before entry."
    : executionClarity >= 50
      ? "The process is developing, but mistakes are still affecting execution. Review the repeated behavior before adding size."
      : "Mistake tags are clustering across the journal. Reduce size and restore a repeatable process before pressing the edge.";

  return (
    <div className="tj-psychology-workspace">
      <Card className="tj-psychology-hero">
        <div><span>BEHAVIORAL JOURNAL</span><h2>Psychology Lab</h2><p>See which emotional states support clean execution, where mistakes cluster, and what deserves a closer review.</p></div>
        <div className="tj-psychology-score"><small>EXECUTION CLARITY</small><strong>{executionClarity.toFixed(0)}%</strong><span>{cleanTrades} clean tagged trade{cleanTrades === 1 ? "" : "s"}</span></div>
      </Card>

      <div className="tj-psychology-summary">
        <Card><small>MOOD COVERAGE</small><strong>{moodCoverage.toFixed(0)}%</strong><span>{moodTagged} of {trades.length} trades tagged</span></Card>
        <Card><small>MISTAKE RATE</small><strong>{mistakeRate.toFixed(0)}%</strong><span>{mistakeTrades} trade{mistakeTrades === 1 ? "" : "s"} with a mistake tag</span></Card>
        <Card><small>BEST EMOTIONAL STATE</small><strong>{bestMood?.mood || "Not enough data"}</strong><span>{bestMood ? `${bestMood.winRate.toFixed(0)}% win rate` : "Tag moods to unlock"}</span></Card>
        <Card><small>TOP MISTAKE</small><strong>{topMistake?.[0] || "None recorded"}</strong><span>{topMistake ? `${topMistake[1]} tagged trade${topMistake[1] === 1 ? "" : "s"}` : "Clean execution so far"}</span></Card>
      </div>

      <div className="tj-psychology-main">
        <Card className="tj-psychology-emotions">
          <div className="tj-panel-head"><div><span>Win Rate by Emotion</span><small>How your pre-entry state is showing up in outcomes.</small></div><small>{moodData.length} state{moodData.length === 1 ? "" : "s"}</small></div>
          {moodData.length === 0 ? <div className="tj-empty">Log trades with a mood to see this.</div> : <div className="tj-mood-list">{moodData.map((m) => <div key={m.mood} className="tj-psychology-mood-row"><div className="tj-mood-header"><span className="tj-bold">{m.mood}</span><span className={`tj-bold ${wrColorClass(m.winRate)}`}>{m.winRate.toFixed(0)}%</span></div><div className="tj-bar-track"><div className={`tj-bar-fill ${wrBarClass(m.winRate)}`} style={{ width: `${m.winRate}%` }} /></div><div className="tj-psychology-mood-meta"><span>{m.count} trade{m.count === 1 ? "" : "s"}</span><strong className={m.pnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoney(m.pnl)}</strong></div></div>)}</div>}
        </Card>

        <Card className="tj-psychology-read">
          <div className="tj-panel-head"><div><span>Psychology Read</span><small>A simple signal from your current journal sample.</small></div><Brain size={16} className="tj-purple-txt" /></div>
          <div className="tj-psychology-callout"><strong>{psychologyTitle}</strong><span>{psychologyNote}</span></div>
          <ol><li><i>1</i><div><strong>Record the state</strong><span>Capture mood before the entry, not after the result.</span></div></li><li><i>2</i><div><strong>Tag the behavior</strong><span>Use mistake tags when execution breaks the plan.</span></div></li><li><i>3</i><div><strong>Review the pattern</strong><span>Compare emotional states across enough trades.</span></div></li></ol>
        </Card>
      </div>

      <Card className="tj-psychology-mistakes">
        <div className="tj-panel-head"><div><span>Mistake patterns</span><small>Where execution is drifting from the plan.</small></div><small>{mistakeList.length} pattern{mistakeList.length === 1 ? "" : "s"}</small></div>
        {mistakeList.length === 0 ? <div className="tj-empty">No mistakes recorded. Keep tagging trades to protect the clean baseline.</div> : <div className="tj-psychology-mistake-grid">{mistakeList.map(([mistake, count]) => { const share = trades.length ? count / trades.length * 100 : 0; return <div key={mistake}><header><strong>{mistake}</strong><span>{count}</span></header><i><b style={{ width: `${Math.max(4, share)}%` }} /></i><small>{share.toFixed(0)}% of all trades</small></div>; })}</div>}
      </Card>
    </div>
  );
}

/* ================================ INSIGHTS =============================== */

function AICoachPanel({ account, stats }) {
  const [status, setStatus] = useState("idle");
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const generate = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", { body: { accountId: account.id } });
      if (error || !data?.report) throw error || new Error(data?.error || "AI Coach is not connected yet.");
      setReport(data.report);
      setStatus("ready");
    } catch (error) {
      setStatus("unavailable");
      setMessage("AI Coach is ready in the journal, but it needs your OpenAI API key in the secure Supabase function before it can generate an analysis.");
    }
  };
  return <Card className="tj-ai-coach-card">
    <div className="tj-ai-coach-head"><div><span>AI COACH</span><strong>Your evidence-based trading review</strong><p>Generate a private coaching report from this account’s trades, markups, reviews, risk settings, and recurring mistakes. It looks for patterns; it does not provide trade signals or financial advice.</p></div><i className={status === "ready" ? "tj-ai-coach-ready" : ""}>{status === "ready" ? "Report ready" : "Secure connection"}</i></div>
    {report ? <div className="tj-ai-coach-report"><div className="tj-ai-coach-report-head"><strong>Latest AI coaching report</strong><button type="button" className="tj-btn-outline tj-btn-small" onClick={generate}>Refresh analysis</button></div><p>{report}</p></div> : <div className="tj-ai-coach-empty"><div><strong>What it will examine</strong><span>{stats.total} trades · setup and session results · risk consistency · loss streaks · mistakes · plan adherence</span></div><button type="button" className="tj-btn-primary" disabled={status === "loading"} onClick={generate}>{status === "loading" ? "Analyzing journal…" : "Generate AI analysis"}</button></div>}
    {message && <div className="tj-ai-coach-message">{message}</div>}
  </Card>;
}

function InsightsPage({ account }) {
  const trades = account.trades || [];
  const cap = account.breakevenCap;
  const stats = computeStats(trades, cap);
  const tagMap = {};
  trades.forEach((t) => {
    const tag = t.entryType || t.confluenceSession;
    if (!tag) return;
    if (!tagMap[tag]) tagMap[tag] = { tag, count: 0, netPnl: 0, wins: 0 };
    tagMap[tag].count++; tagMap[tag].netPnl += Number(t.pnl) || 0;
    if (classify(t.pnl, cap) === "win") tagMap[tag].wins++;
  });
  const tagStats = Object.values(tagMap).map((t) => ({ ...t, winRate: (t.wins / t.count) * 100 }));
  const bestTag = tagStats.slice().sort((a, b) => b.netPnl - a.netPnl)[0];

  const sessionMap = {};
  trades.forEach((t) => {
    const session = t.entrySession || t.session;
    if (!session) return;
    if (!sessionMap[session]) sessionMap[session] = { session, count: 0, netPnl: 0, wins: 0 };
    sessionMap[session].count++; sessionMap[session].netPnl += Number(t.pnl) || 0;
    if (classify(t.pnl, cap) === "win") sessionMap[session].wins++;
  });
  const sessionStats = Object.values(sessionMap).map((s) => ({ ...s, winRate: (s.wins / s.count) * 100 }));
  const bestSession = sessionStats.slice().sort((a, b) => b.netPnl - a.netPnl)[0];

  const expectancy = trades.length ? trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0) / trades.length : 0;
  const currentEquity = Number(account.balance || 0) + stats.netPnl;
  const compoundedReturn = account.balance ? stats.netPnl / account.balance * 100 : 0;

  return (
    <div className="tj-insights-workspace">
      <Card className="tj-insights-hero">
        <div className="tj-insights-hero-copy"><span>INSIGHTS &amp; AI COACH</span><h2>Edge Optimization</h2><p>Turn real execution history into clearer decisions on risk, growth, and where discipline needs tightening.</p><div className="tj-insights-pills"><i>{bestSession ? `${bestSession.session} is the strongest session` : "Build a session sample"}</i><i>{bestTag ? `${bestTag.tag} is the strongest tagged setup` : "Tag entry models to find the edge"}</i><i>{fmtMoney(expectancy)} expectancy per trade</i></div></div>
        <div className="tj-insights-return"><small>COMPOUNDED RETURN</small><strong className={compoundedReturn >= 0 ? "tj-green" : "tj-red"}>{compoundedReturn >= 0 ? "+" : ""}{compoundedReturn.toFixed(2)}%</strong><span>{fmtMoney(currentEquity)} live balance</span></div>
      </Card>
      <AICoachPanel account={account} stats={stats} />
      <RiskManagementInsightsView account={account} trades={trades} stats={stats} />
    </div>
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
        <div><span className="tj-bold">📅 Economic Calendar</span><div className="tj-muted-txt" style={{ fontSize: 13 }}>ForexFactory events · times shown in your timezone</div></div>
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
          <span className="tj-muted-txt" style={{ fontSize: 14 }}>{fmtShortDate(rangeStart)} – {fmtShortDate(rangeEnd)}</span>
        </div>
      </div>

      <div className="tj-view-transition" key={tab}>
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
              <div style={{ fontSize: 34.56 }}>📅</div>
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
          <div className="tj-muted-txt" style={{ fontSize: 13, marginTop: 8 }}>Sample list — the live feed above (Calendar tab) already includes real bank holidays inline with the day they fall on.</div>
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
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, marginBottom: 4 }}>
                  <span>{lvl[0].toUpperCase() + lvl.slice(1)} impact</span><span className="tj-bold">{count}</span>
                </div>
                <div className="tj-bar-track"><div className="tj-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </Card>
  );
}

/* ================================== RULES ================================ */

function RulesPage({ account, onAddRule, onUpdateRule, onRemoveRule }) {
  const [newRule, setNewRule] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const addRule = () => { if (!newRule.trim()) return; onAddRule(newRule.trim()); setNewRule(""); };
  const saveRuleEdit = () => {
    const text = editingRule?.text?.trim();
    if (!text || !editingRule) return;
    onUpdateRule(editingRule.id, text);
    setEditingRule(null);
  };
  const rules = account.rules || [];

  return (
    <Card className="tj-panel">
      <div className="tj-bold" style={{ fontSize: 17.28 }}>Trading Rules</div>
      <div className="tj-muted-txt" style={{ fontSize: 14, margin: "5px 0 12px" }}>Rules shown when logging and evaluating a trade.</div>
      <div className="tj-inline-add"><input className="tj-input" placeholder="Add a trading rule..." value={newRule} onChange={(event) => setNewRule(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addRule()} /><button className="tj-btn-primary" onClick={addRule}>Add</button></div>
      <div className="tj-rule-list" style={{ marginTop: 12 }}>{rules.length ? rules.map((rule) => { const editing = editingRule?.id === rule.id; return <div key={rule.id} className="tj-rule-row">{editing ? <input autoFocus className="tj-input" value={editingRule.text} onChange={(event) => setEditingRule({ ...editingRule, text: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveRuleEdit(); if (event.key === "Escape") setEditingRule(null); }} /> : <span>{rule.text}</span>}<span className="tj-rule-actions">{editing ? <><button className="tj-icon-btn" title="Save rule" onClick={saveRuleEdit}><CheckCircle2 size={15} /></button><button className="tj-icon-btn" title="Cancel edit" onClick={() => setEditingRule(null)}><X size={15} /></button></> : <button className="tj-icon-btn" title="Edit rule" onClick={() => setEditingRule({ id: rule.id, text: rule.text })}><Pencil size={14} /></button>}<ConfirmDeleteButton className="tj-icon-btn" title="Delete rule" onClick={() => onRemoveRule(rule.id)}><Trash2 size={14} /></ConfirmDeleteButton></span></div>; }) : <div className="tj-empty">Nothing added yet.</div>}</div>
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
      <p style={{ fontSize: 15.5, lineHeight: 1.5, marginBottom: 16 }}>
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
  const [introFinished, setIntroFinished] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIntroFinished(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let active = null, frame = 0;
    const clear = () => {
      cancelAnimationFrame(frame);
      if (active) {
        active.classList.remove('tj-pointer-lit');
        active.style.removeProperty('--pointer-x');
        active.style.removeProperty('--pointer-y');
      }
      active = null;
    };
    const move = event => {
      if (!enabled.matches || event.pointerType === 'touch') return clear();
      let target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.tj-theme-nav')) return clear();
      // Keep a single stable hover target across the row and its nested controls.
      const journalRow = target?.closest('.tj-tlog-row, .tj-reference-markup-row');
      if (journalRow) target = journalRow;
      while (target && !target.classList.contains('tj-root')) {
        if (target === journalRow) break;
        if (getComputedStyle(target).cursor === 'pointer' &&
            (target.matches('button, a, [role="button"], [role="tab"], tr, [tabindex]') || target.onclick)) break;
        target = target.parentElement;
      }
      if (!target || target.classList.contains('tj-root') || !target.closest('.tj-root') || target.closest(':disabled, [aria-disabled="true"]')) return clear();
      if (target !== active) { clear(); active = target; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active?.isConnected) return clear();
        const rect = active.getBoundingClientRect();
        active.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
        active.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
        active.classList.add('tj-pointer-lit');
      });
    };
    document.addEventListener('pointermove', move, {passive:true});
    document.addEventListener('pointerleave', clear);
    window.addEventListener('blur', clear);
    enabled.addEventListener('change', clear);
    return () => {
      clear(); document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', clear);
      window.removeEventListener('blur', clear); enabled.removeEventListener('change', clear);
    };
  }, []);
  const displayName = user.user_metadata?.display_name || (user.email ? user.email.split("@")[0] : "Trader");
  const loginQuote = useMemo(() => getLoginQuote(user), [user.id, user.last_sign_in_at]);
  const personalProfileImage = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const personalInitials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
  const [profileTheme, setProfileTheme] = useSiteTheme(user.user_metadata?.theme);
  const [accounts, setAccounts] = useState(null);
  const [activeId, setActiveId] = useState(() => readActiveAccount(user.id));
  const [page, setPage] = useState(() => {
    const savedPage = readActivePage(user.id);
    return NAV.some((item) => item.id === savedPage) ? savedPage : "dashboard";
  });
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);
  const sessionTimeoutValue = Number(user.user_metadata?.session_timeout_minutes);
  const sessionTimeoutMinutes = Number.isFinite(sessionTimeoutValue) ? sessionTimeoutValue : 90;
  useEffect(() => {
    if (sessionTimeoutMinutes <= 0) return undefined;
    let timerId;
    const resetTimer = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => onLogout(), sessionTimeoutMinutes * 60 * 1000);
    };
    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      window.clearTimeout(timerId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [onLogout, sessionTimeoutMinutes]);
  useEffect(() => {
    if (!showAccountMenu) return;
    const onDocClick = (e) => { if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setShowAccountMenu(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAccountMenu]);
  const [modal, setModalState] = useState(null);
  const modalCloseTimer = useRef(null);
  const setModal = useCallback((nextModal) => {
    window.clearTimeout(modalCloseTimer.current);
    if (nextModal === null) {
      const overlay = document.querySelector(".tj-modal-overlay:not(.tj-modal-closing)");
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (overlay && !reduceMotion) {
        overlay.classList.add("tj-modal-closing");
        modalCloseTimer.current = window.setTimeout(() => setModalState(null), 230);
        return;
      }
    }
    setModalState(nextModal);
  }, []);
  useEffect(() => () => window.clearTimeout(modalCloseTimer.current), []);
  const [dayModalDate, setDayModalDate] = useState(null);
  const [financeReminder, setFinanceReminder] = useState([]);
  const [editingTrade, setEditingTrade] = useState(null);
  const [newTradeDraft, setNewTradeDraft] = useState(null);
  const [editingMarkup, setEditingMarkup] = useState(null);
  const [imageViewerSrc, setImageViewerSrc] = useState(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [typeTags, setTypeTags] = useState([]);
  const [mistakeTags, setMistakeTags] = useState([]);
  const [confluenceSessions, setConfluenceSessions] = useState([]);
  const [customInstruments, setCustomInstruments] = useState([]);
  const [markups, setMarkups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [periodReviews, setPeriodReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
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
    setLoadError("");
    setLoaded(false);
    // Existing accounts should render immediately. Demo setup is only needed once
    // and used to block Safari behind several extra network requests on every load.
    if (user.user_metadata?.demo_history_version !== 3) {
      try { await ensureDemoAccount(user); }
      catch (error) { setLoadError(error.message || "Journal setup could not finish. Please retry."); setLoaded(true); return false; }
    }
    const isSessionFailure = error => /jwt|token|session|unauthori[sz]ed|401|403/i.test(String(error?.message || error || ""));
    const pause = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));
    // Safari can resume a stored session after the first data request starts.
    // Do not race that request against a short timer: retry transient failures
    // in the background and keep the normal preloader on screen instead.
    const loadJournal = async () => {
      let lastFailure;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          let result = await fetchAllUserData(user.id);
          if (!result.error) return result;
          lastFailure = result.error;
          if (isSessionFailure(result.error)) {
            const refreshed = await supabase.auth.refreshSession();
            if (!refreshed?.data?.session) throw new Error("Your saved session could not be refreshed. Please sign in again.");
            result = await fetchAllUserData(user.id);
            if (!result.error) return result;
            lastFailure = result.error;
          }
        } catch (error) {
          lastFailure = error;
          if (isSessionFailure(error)) {
            const refreshed = await supabase.auth.refreshSession();
            if (!refreshed?.data?.session) throw new Error("Your saved session could not be refreshed. Please sign in again.");
          }
        }
        await pause(Math.min(1000 * 2 ** attempt, 12000));
      }
      throw new Error(lastFailure?.message || lastFailure || "The journal could not be loaded. Check your connection and try again.");
    };
    let result;
    try {
      result = await loadJournal();
    } catch (error) {
      const message = error?.message || "The journal could not be loaded.";
      setLoadError(message);
      setLoaded(true);
      return false;
    }
    if (result.error) {
      setLoadError(result.error);
      setLoaded(true);
      return false;
    }
    setAccounts(result.data.accounts);
    setTypeTags([]);
    setMistakeTags([]);
    setConfluenceSessions([]);
    setCustomInstruments(result.data.customInstruments || []);
    setMarkups(result.data.markups || []);
    setReviews(result.data.reviews || []);
    setPeriodReviews(result.data.periodReviews || []);
    const savedAccountId = readActiveAccount(user.id);
    setActiveId(currentId => resolveActiveAccount(result.data.accounts, currentId, savedAccountId));
    setLoaded(true);
    return true;
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

  // Imported MT5/cTrader accounts may already contain deposits saved by an
  // earlier import. Treat their sum as the journal base automatically, rather
  // than making the trader enter the same funding amount again by hand.
  useEffect(() => {
    if (!loaded || !accounts?.length) return;
    const importedAccounts = accounts.filter((item) => item.platform !== "Manual" && !(Number(item.balance) > 0) && (item.financeMovements || []).some((movement) => movement.type === "deposit"));
    if (!importedAccounts.length) return;
    (async () => {
      const updates = [];
      for (const item of importedAccounts) {
        const deposits = (item.financeMovements || []).filter((movement) => movement.type === "deposit");
        const base = deposits.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
        if (!(base > 0)) continue;
        const relabelled = [];
        for (const movement of deposits) {
          if (movement.note?.startsWith(importedAccountBaseNote)) { relabelled.push(movement); continue; }
          const result = await updateFinanceMovement(movement.id, { note: `${importedAccountBaseNote} ${movement.note || "Imported broker deposit"}` });
          if (result.error) { showError(result.error); continue; }
          relabelled.push(result.data);
        }
        const next = { ...item, balance: base, financeMovements: [...relabelled, ...(item.financeMovements || []).filter((movement) => movement.type !== "deposit")] };
        const saved = await updateAccount(item.id, next);
        if (saved.error) { showError(saved.error); continue; }
        updates.push(next);
      }
      if (updates.length) setAccounts((current) => current.map((item) => updates.find((update) => update.id === item.id) || item));
    })();
  }, [loaded, accounts, showError]);

  // If a signed-up user genuinely has zero accounts (new user, and nothing
  // to migrate), give them one empty starter account instead of a dead end.
  useEffect(() => {
    if (!loaded || !migration.checked || migration.pending) return;
    if (accounts && accounts.length === 0) {
      (async () => {
        const res = await createAccount(user.id, { name: "Main Account", icon: "USD", balance: 10000, breakevenCap: 0, ratingStyle: "stars", theme: "dark", defaultCommission: 0, monthlyGoalPct: 0, yearlyGoalPct: 0, dailyLossLimitPct: 0, monthlyLossLimitPct: 0, positionSizeEnabled: false, baseCurrency: "USD", defaultRiskPct: 1, defaultStopLossPips: 0 });
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
  useEffect(() => {
    setTypeTags(account?.typeTags || []);
    setMistakeTags(account?.mistakeTags || []);
    setConfluenceSessions(account?.confluenceSessions || []);
  }, [account?.id, account?.typeTags, account?.mistakeTags, account?.confluenceSessions]);
  useEffect(() => {
    if (account && account.id === activeId) rememberActiveAccount(user.id, account.id);
  }, [user.id, account?.id, activeId]);
  useEffect(() => { rememberActivePage(user.id, page); }, [user.id, page]);
  useEffect(() => { if (page === 'challenge' && !isChallengeEnabled(account)) setPage('dashboard'); }, [page, account]);
  useEffect(() => { if (page === 'finance' && !account?.finance?.enabled) setPage('dashboard'); }, [page, account]);
  const stats = useMemo(() => (account ? computeStats(account.trades, account.breakevenCap) : null), [account]);
  const challenge = useChallenge(account, user.id);
  const guardrails = useMemo(() => (account ? accountGuardrails(account, account.trades) : null), [account]);
  useEffect(() => {
    if (!account?.finance?.enabled) { setFinanceReminder([]); return; }
    const cycle = financeProfitCycle(account);
    const ready = (account.savingsAccounts || []).filter((saving) => {
      const percentage = Number(saving.allocationPct) || 0;
      return percentage > 0 && cycle.baseline > 0 && cycle.profit >= cycle.baseline * percentage / 100 && reminderScheduleDue(saving, account.financeMovements);
    });
    setFinanceReminder(ready);
  }, [account, page]);

  if (loaded && loadError) {
    return (
      <div className={`tj-root tj-loading ${profileTheme === "light" ? "tj-theme-light" : "tj-theme-dark"}`}>
        <style>{CSS}</style>
        <div className="tj-load-error-card" role="alert">
          <AlertTriangle size={24} />
          <strong>Your journal did not finish loading</strong>
          <span>{loadError}</span>
          <button className="tj-btn-primary" type="button" onClick={loadFromServer}>Try again</button>
        </div>
      </div>
    );
  }

  if (!introFinished || !loaded || !account || !stats) {
    return (
      <JournalPreloader theme={profileTheme} waiting={introFinished} />
    );
  }

  setActiveMoneyCurrency(account.baseCurrency);

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
    if (guardrails.tradeEntryLocked) {
      showInfo("This account is locked by its loss limit. Trade changes resume after the applicable reset period.");
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

  const importTradesToAccount = async (targetAccount, plan, onProgress) => {
    const trades = Array.isArray(plan) ? plan : plan?.trades || [];
    const cashMovements = Array.isArray(plan) ? [] : plan?.cashMovements || [];
    const tradeKey = (trade) => {
      if (trade.importKey) return trade.importKey;
      const ticket = trade.context?.match(/Imported MetaTrader position #(\S+)/)?.[1];
      if (ticket) return `mt5-position:${ticket}`;
      const cTraderKey = trade.context?.match(/Imported cTrader position #(ctrader:\S+)/)?.[1];
      return cTraderKey || [trade.date, trade.time || "", trade.closeDate || "", trade.closeTime || "", trade.asset, trade.direction, Number(trade.pnl || 0).toFixed(2)].join("|");
    };
    const existingByKey = new Map((targetAccount.trades || []).map((trade) => [tradeKey(trade), trade]));
    const seen = new Set(existingByKey.keys());
    const closeTimingUpdates = [];
    const unique = trades.filter((trade) => {
      const key = tradeKey(trade);
      // Older cTrader imports used their opening timestamp in the import key.
      // Fall back to the immutable position details so re-uploading repairs
      // their close timing instead of adding another trade.
      const cTraderMatch = trade.importKey?.startsWith("ctrader:")
        ? (targetAccount.trades || []).find((item) => /Imported cTrader position #/i.test(item.context || "")
          && item.asset === trade.asset && item.direction === trade.direction
          && item.date === trade.date && (trade.openingTimestampMissing
            ? (item.closeDate === trade.closeDate && ((item.closeTime || "") === (trade.closeTime || "") || (item.time || "") === (trade.closeTime || "")))
            : (item.time || "") === (trade.time || ""))
          && Number(item.pnl || 0).toFixed(2) === Number(trade.pnl || 0).toFixed(2))
        : null;
      const existing = existingByKey.get(key) || (trade.legacyImportKey ? existingByKey.get(trade.legacyImportKey) : null) || cTraderMatch;
      if (existing) {
        // Re-uploading a broker report also repairs old imports made before
        // close timestamps were mapped correctly. It never creates a duplicate.
        const needsCloseTiming = trade.closeDate && (existing.closeDate !== trade.closeDate || existing.closeTime !== trade.closeTime);
        const needsOpeningRepair = trade.openingTimestampMissing && !cTraderOpeningWasEnteredManually(existing) && !/\[close-only\]/i.test(existing.context || "") && !!existing.time;
        if (needsCloseTiming || needsOpeningRepair) {
          closeTimingUpdates.push({ ...existing, time: needsOpeningRepair ? "" : existing.time, closeDate: trade.closeDate, closeTime: trade.closeTime || "", context: needsOpeningRepair ? trade.context : existing.context });
        }
        return false;
      }
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    if (!unique.length && !cashMovements.length && !closeTimingUpdates.length) { showInfo("Those trades are already in this account."); return false; }
    const imported = [];
    const total = unique.length + cashMovements.length + closeTimingUpdates.length;
    let completed = 0;
    for (const trade of closeTimingUpdates) {
      const result = await updateTrade(trade.id, { ...trade, userId: user.id, accountId: targetAccount.id });
      if (result.error) { showError(result.error); return false; }
      completed += 1; onProgress?.(Math.round(completed / total * 100));
    }
    for (const trade of unique) {
      const result = await createTrade(user.id, targetAccount.id, trade);
      if (result.error) { showError(result.error); return false; }
      imported.push(result.data);
      completed += 1; onProgress?.(Math.round(completed / total * 100));
    }
    const existingCash = targetAccount.financeMovements || [];
    const movementKey = (movement) => [movement.type, Number(movement.amount).toFixed(2), movement.date, movement.source || "trading"].join("|");
    const knownCash = new Map(existingCash.map((movement) => [movementKey(movement), movement]));
    const importedCash = [];
    const relabelledCash = [];
    let importedDepositBase = 0;
    for (const movement of cashMovements) {
      const key = movementKey(movement);
      const existing = knownCash.get(key);
      if (existing) {
        // Upgrade deposits made by the earlier importer so they become account base
        // rather than being counted a second time as a new cash event.
        const originalNote = movement.note?.replace(importedAccountBaseNote, "").trim();
        if (movement.type === "deposit" && !existing.note?.startsWith(importedAccountBaseNote) && existing.note === originalNote) {
          const result = await updateFinanceMovement(existing.id, { note: movement.note });
          if (result.error) { showError(result.error); return false; }
          relabelledCash.push(result.data); importedDepositBase += movement.amount;
        }
        completed += 1; onProgress?.(Math.round(completed / total * 100)); continue;
      }
      const result = await createFinanceMovement(user.id, targetAccount.id, movement);
      if (result.error) { showError(`${result.error} Apply supabase/finance_migration.sql if this is a new database.`); return false; }
      knownCash.set(key, result.data); importedCash.push(result.data);
      if (movement.type === "deposit") importedDepositBase += movement.amount;
      completed += 1; onProgress?.(Math.round(completed / total * 100));
    }
    const nextAccount = { ...targetAccount, balance: Number(targetAccount.balance || 0) + importedDepositBase };
    if (importedDepositBase > 0) {
      const result = await updateAccount(targetAccount.id, nextAccount);
      if (result.error) { showError(result.error); return false; }
    }
    setAccounts((items) => items.map((item) => item.id === targetAccount.id ? { ...nextAccount, trades: [...(item.trades || []).map((trade) => closeTimingUpdates.find((updated) => updated.id === trade.id) || trade), ...imported], financeMovements: [...importedCash, ...relabelledCash, ...(item.financeMovements || []).filter((movement) => !relabelledCash.some((updated) => updated.id === movement.id))] } : item));
    for (const instrument of [...new Set(imported.map((trade) => trade.asset))]) await persistCustomInstrument(instrument);
    showInfo(`${imported.length} trade${imported.length === 1 ? "" : "s"}${importedCash.length ? ` and ${importedCash.length} cash movement${importedCash.length === 1 ? "" : "s"}` : ""}${closeTimingUpdates.length ? `; close date/time repaired on ${closeTimingUpdates.length} existing trade${closeTimingUpdates.length === 1 ? "" : "s"}` : ""}${importedDepositBase ? `; ${fmtMoney(importedDepositBase)} added to the account base` : ""}${unique.length !== trades.length ? `; ${trades.length - unique.length} duplicate${trades.length - unique.length === 1 ? " was" : "s were"} skipped` : ""}.`);
    return true;
  };

  const handleDeleteTrade = async (id) => {
    if (guardrails.tradeEntryLocked) { showInfo("This account is locked by its loss limit. Trade changes resume after the applicable reset period."); return; }
    const res = await deleteTrade(id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id !== account.id ? a : { ...a, trades: a.trades.filter((t) => t.id !== id) })));
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
    if (kind === "instruments") {
      const res = await saveManagedLists(user.id, { instruments: next });
      if (res.error) return showError(res.error);
      setCustomInstruments(next);
      return;
    }
    const field = kind === "types" ? "typeTags" : kind === "mistakes" ? "mistakeTags" : "confluenceSessions";
    const updated = { ...account, [field]: next };
    const res = await updateAccount(account.id, updated);
    if (res.error) return showError(res.error);
    setAccounts((items) => items.map((item) => item.id === account.id ? updated : item));
  };
  const handleSaveMarkup = async (markup) => {
    const exists = markups.some((item) => item.id === markup.id);
    const res = exists ? await updateMarkup(markup.id, markup) : await createMarkup(user.id, account.id, markup);
    if (res.error) return showError(res.error);
    setMarkups((items) => exists ? items.map((item) => item.id === markup.id ? res.data : item) : [res.data, ...items]);
    await persistCustomInstrument(markup.instrument);
    setModal(null); setEditingMarkup(null);
  };
  const handleDeleteMarkup = async (id) => {  const res=await deleteMarkup(id); if(res.error)return showError(res.error); setMarkups(x=>x.filter(m=>m.id!==id)); };
  const handleSaveReview = async (r) => { const res=await saveTradeReview(user.id,account.id,r); if(res.error){showError(res.error);return false;}setReviews(x=>{const i=x.findIndex(v=>v.id===res.data.id);return i<0?[res.data,...x]:x.map(v=>v.id===res.data.id?res.data:v);}); return true; };
  const handleSavePeriodReview = async (review) => { const res = await savePeriodReview(user.id, account.id, review); if (res.error) { showError(res.error); return false; } setPeriodReviews((items) => { const index = items.findIndex((item) => item.id === res.data.id || (item.accountId === account.id && item.type === res.data.type && item.key === res.data.key)); return index < 0 ? [res.data, ...items] : items.map((item, itemIndex) => itemIndex === index ? res.data : item); }); return true; };
  const handleRecordFinanceMovement = async (movement) => { if (guardrails.tradeEntryLocked) return showInfo("This account is locked by its loss limit. Cash movements resume after the applicable reset period."); const result = await createFinanceMovement(user.id, account.id, movement); if (result.error) { showError(`${result.error} Apply supabase/finance_migration.sql if this is a new database.`); return false; } setAccounts((items) => items.map((item) => item.id === account.id ? {...item, financeMovements:[result.data, ...(item.financeMovements || [])]} : item)); return true; };
  const handleDeleteFinanceMovement = async (id) => { if (guardrails.tradeEntryLocked) return showInfo("This account is locked by its loss limit. Cash movements resume after the applicable reset period."); const result = await deleteFinanceMovement(id); if (result.error) return showError(result.error); setAccounts((items) => items.map((item) => item.id === account.id ? {...item, financeMovements:(item.financeMovements || []).filter((movement) => movement.id !== id)} : item)); };

  const handleResetData = async () => {
    if (guardrails.tradeEntryLocked) { showInfo("Reset Data is locked while this account is paused by its loss limit."); return; }
    const res = await resetAccountData(account.id);
    if (res.error) { showError(res.error); return; }
    setAccounts((accs) => accs.map((a) => (a.id === account.id ? { ...a, trades: [], checkins: {} } : a)));
  };

  const handleDeleteAccount = async (a) => {
    if (a.id === account.id && guardrails.tradeEntryLocked) { showInfo("Account settings are locked while this account is paused by its loss limit."); return false; }
    const res = await deleteAccount(a.id);
    if (res.error) { showError(res.error); return false; }
    setAccounts((accs) => {
      const remaining = accs.filter((acc) => acc.id !== a.id);
      if (a.id === activeId) setActiveId(remaining[0]?.id || null);
      return remaining;
    });
    setModal(null);
    return true;
  };

  const handleCreateAccount = async (fields, importedPlan = { trades: [], cashMovements: [] }, onProgress) => {
    const res = await createAccount(user.id, fields);
    if (res.error) { showError(res.error); return false; }
    setAccounts((accs) => accs.some((item) => item.id === res.data.id) ? accs.map((item) => item.id === res.data.id ? res.data : item) : [...accs, res.data]);
    setActiveId(res.data.id);
    if ((importedPlan.trades || importedPlan).length || importedPlan.cashMovements?.length) await importTradesToAccount(res.data, importedPlan, onProgress);
    setModal(null);
    return true;
  };

  const handleSaveAccountSettings = async (updated, draft, financeDraft, importedTrades = []) => {
    if (guardrails.tradeEntryLocked) { showInfo("Account settings are locked while this account is paused by its loss limit."); return false; }
    const enabled = isChallengeEnabled(updated);
    const nextMode = enabled ? (draft ? draft.mode : challenge.state.automation?.mode ?? null) : null;
    const nextLevel = draft?.level ?? challenge.state.activeLevel;
    const changed = nextMode !== (challenge.state.automation?.mode ?? null) || nextLevel !== challenge.state.activeLevel;
    if (changed && (challenge.loading || (nextMode && !challenge.modesReady))) {
      showError("Challenge settings are not ready. Check the Challenge SQL migrations and retry.");
      return false;
    }
    const res = await updateAccount(updated.id, updated);
    if (res.error) { showError(res.error); return false; }
    const financeResult = await saveFinanceSettings(user.id, updated.id, financeDraft || updated.finance || { enabled:false, tradingTarget:0 });
    if (financeResult.error) { showError(`${financeResult.error} Apply supabase/finance_migration.sql, then try again.`); return false; }
    const existingSavings = account.savingsAccounts || [];
    const desiredSavings = financeDraft?.savingsAccounts || existingSavings;
    const desiredIds = new Set(desiredSavings.filter((item) => !String(item.id).startsWith("draft-")).map((item) => item.id));
    for (const item of existingSavings.filter((item) => !desiredIds.has(item.id))) { const result = await deleteSavingsAccount(item.id); if (result.error) { showError(result.error); return false; } }
    const savedSavings = [];
    for (const item of desiredSavings) { const result = String(item.id).startsWith("draft-") ? await createSavingsAccount(user.id, updated.id, item) : await updateSavingsAccount(item.id, item); if (result.error) { showError(result.error); return false; } savedSavings.push(result.data); }
    const nextAccount = { ...updated, finance:{enabled:!!financeDraft?.enabled}, savingsAccounts:savedSavings, financeMovements:account.financeMovements || [] };
    setAccounts((accs) => accs.map((a) => (a.id === updated.id ? nextAccount : a)));
    if (changed && !(await challenge.configure(nextMode, nextLevel))) return false;
    if (importedTrades.length && !(await importTradesToAccount(nextAccount, importedTrades))) return false;
    setModal(null);
    return true;
  };

  const handleSaveProfileSettings = async ({ displayName: nextName, avatarUrl, theme, sessionTimeoutMinutes: nextTimeout }) => {
    const profileResult = await updateProfile({ displayName: nextName, avatarUrl, sessionTimeoutMinutes: nextTimeout, theme });
    if (profileResult.error) { showError(profileResult.error); return false; }
    setProfileTheme(theme);
    window.localStorage.setItem(`tj:profile-theme:${user.id}`, theme);
    setModal(null);
    return true;
  };
  const handleQuickThemeToggle = async () => {
    const previous = profileTheme;
    const next = previous === "dark" ? "light" : "dark";
    setProfileTheme(next);
    window.localStorage.setItem(`tj:profile-theme:${user.id}`, next);
    const result = await updateProfile({ displayName, avatarUrl: personalProfileImage, sessionTimeoutMinutes, theme: next });
    if (result.error) {
      setProfileTheme(previous);
      window.localStorage.setItem(`tj:profile-theme:${user.id}`, previous);
      showError(result.error);
    }
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

  const netTotal = financeTotals(account).tradingBalance;
  const netPct = account.balance ? (stats.netPnl / account.balance) * 100 : 0;
  const accountCenterSummary = (candidate) => {
    const accountTrades = candidate.trades || [];
    const pnl = accountTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    const wins = accountTrades.filter((trade) => classify(Number(trade.pnl) || 0, candidate.breakevenCap || 0) === "win").length;
    const losses = accountTrades.filter((trade) => classify(Number(trade.pnl) || 0, candidate.breakevenCap || 0) === "loss").length;
    return { pnl, total: accountTrades.length, wins, losses, breakeven: accountTrades.length - wins - losses, pct: candidate.balance ? pnl / candidate.balance * 100 : 0 };
  };
  const activeAccountSummary = accountCenterSummary(account);
  const openNewTrade = (draft = null) => {
    if (guardrails.tradeEntryLocked) return showInfo("Trade entry is paused by your account loss cap. Adjust the guardrail or wait for its reset period.");
    setEditingTrade(null); setNewTradeDraft(draft); setModal("newtrade");
  };
  const openDayDetails = (date) => {
    setDayModalDate(date);
  };

  return (
    <ImageViewerContext.Provider value={setImageViewerSrc}>
    <div className={`tj-root journal-dashboard-arrive ${profileTheme === "light" ? "tj-theme-light" : "tj-theme-dark"}`}>
      <style>{CSS}</style>
      
      {toast && <div className={`tj-toast tj-toast-${toast.type}`}>{toast.text}</div>}
      <div className={`tj-sidebar ${sidebarOpen ? "tj-sidebar-shown" : "tj-sidebar-collapsed"}`}>
        <div className="tj-sidebar-scroll">
          <button type="button" className="tj-sidebar-profile" aria-label="Open profile settings" title="Profile settings" onClick={() => setModal("profile")}>
            <span className="tj-sidebar-profile-avatar">{personalProfileImage ? <img src={personalProfileImage} alt={`${displayName} profile`} /> : personalInitials}</span>
          </button>
          <div className="tj-nav-label">NAVIGATION</div>
          <div className="tj-nav">{NAV.filter(n => (n.id !== 'challenge' || isChallengeEnabled(account)) && (n.id !== 'finance' || account.finance?.enabled)).map((n) => <button key={n.id} className={`tj-nav-item ${page === n.id ? "tj-nav-active" : ""}`} onClick={() => { setPage(n.id); setShowAccountMenu(false); if (window.innerWidth <= 900) setSidebarOpen(false); }}>{n.symbol ? <NavSymbol src={n.symbol} /> : <n.icon size={16} />} <span>{n.label}</span></button>)}</div>
          <div className="tj-nav-label">SETTINGS</div>
          <div className="tj-nav">
            <button className="tj-nav-item" disabled={guardrails.tradeEntryLocked} title={guardrails.tradeEntryLocked ? "Account settings are locked by the account loss limit" : "Account settings"} onClick={() => setModal("account")}><NavSymbol src={accountSettingsSymbol} /> <span>{guardrails.tradeEntryLocked ? "Account Locked" : "Account"}</span></button>
            <button className="tj-nav-item" onClick={() => setModal("profile")}><NavSymbol src={profileSettingsSymbol} /> <span>Profile</span></button>
            <ConfirmDeleteButton className="tj-nav-item" disabled={guardrails.tradeEntryLocked} title={guardrails.tradeEntryLocked ? "Reset Data is locked by the account loss limit" : "Reset Data"} onClick={handleResetData}><Trash2 size={16} /> <span>Reset Data</span></ConfirmDeleteButton>
            <button className="tj-nav-item tj-nav-danger" onClick={onLogout}><LogOut size={16} /> <span>Log Out</span></button>
            <button className="tj-nav-item tj-theme-nav" onClick={handleQuickThemeToggle} aria-label={profileTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={profileTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{profileTheme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button>
          </div>
        </div>
        <div className="tj-sidebar-footer" ref={accountMenuRef}>
          {showAccountMenu && (
            <div className="tj-account-menu">
              <div className="tj-account-center-head">
                <div><span>ACCOUNT CENTER</span><strong>Switch journal</strong></div>
                <button type="button" className="tj-icon-btn" aria-label="Close account center" onClick={() => setShowAccountMenu(false)}><X size={16} /></button>
              </div>
              <div className="tj-account-center-active">
                <div className="tj-account-center-active-head"><span className="tj-account-initial tj-account-initial-lg" aria-hidden="true">{accountInitial(account.name)}</span><div><strong>{account.name}</strong><small>Current journal</small></div><em>Active</em></div>
                <div className="tj-account-center-metrics"><div><small>STARTED</small><strong>{fmtMoneyShort(account.balance, account.baseCurrency)}</strong></div><div><small>BALANCE</small><strong>{fmtMoneyShort(netTotal, account.baseCurrency)}</strong></div><div><small>NET P&amp;L</small><strong className={stats.netPnl >= 0 ? "tj-green" : "tj-red"}>{fmtMoneyShort(stats.netPnl, account.baseCurrency)}</strong></div><div><small>TRADES</small><strong>{stats.total}</strong></div></div>
                <div className="tj-account-center-result"><strong className={netPct >= 0 ? "tj-green" : "tj-red"}>{netPct >= 0 ? "+" : ""}{netPct.toFixed(2)}%</strong><span>{activeAccountSummary.wins}W · {activeAccountSummary.losses}L · {activeAccountSummary.breakeven} B/E</span></div>
              </div>
              <div className="tj-account-center-section-head"><div><span>ACCOUNTS</span><small>{accounts.length} journal{accounts.length === 1 ? "" : "s"} available</small></div><button type="button" className="tj-btn-outline tj-btn-small" disabled={guardrails.tradeEntryLocked} title={guardrails.tradeEntryLocked ? "Account settings are locked by the account loss limit" : "Manage account"} onClick={() => { setModal("account"); setShowAccountMenu(false); }}><Settings size={13} /> Manage</button></div>
              <div className="tj-account-center-list">{accounts.map((a) => (
                <div key={a.id} className={`tj-account-row-wrap ${a.id === activeId ? "tj-account-row-active" : ""}`}>
                  <button className="tj-account-row" aria-current={a.id === activeId ? "true" : undefined} onClick={() => { setActiveId(a.id); setShowAccountMenu(false); }}>
                    <span className="tj-account-row-name"><strong>{a.name}</strong></span>
                  </button>
                  {accounts.length > 1 && <ConfirmDeleteButton className="tj-account-delete" title="Delete account" onClick={(e) => { e.stopPropagation(); handleDeleteAccount(a); }}><Trash2 size={13} /></ConfirmDeleteButton>}
                </div>
              ))}</div>
              <button className="tj-add-account" onClick={() => { setModal("addaccount"); setShowAccountMenu(false); }}><Plus size={14} /> Add account</button>
            </div>
          )}
          <button className="tj-sidebar-user" onClick={() => setShowAccountMenu((v) => !v)}>
            <div className="tj-account-initial" aria-hidden="true">{accountInitial(account.name)}</div>
            <div style={{ textAlign: "left", minWidth: 0 }}><div className="tj-account-name">{account.name.length > 16 ? account.name.slice(0, 16) + "…" : account.name}</div><div className="tj-account-sub">Active account</div></div>
            <ChevronDown size={14} className="tj-sidebar-user-chevron" />
          </button>
        </div>
      </div>
      {sidebarOpen && <div className="tj-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className="tj-main">
        <div className="tj-topbar">
          <div className="tj-topbar-left">
            <button className="tj-icon-btn tj-sidebar-toggle" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}>{sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</button>
            <div><div className="tj-page-title">{NAV.find((n) => n.id === page)?.label || "Settings"}</div><div className="tj-page-sub">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div></div>
          </div>
          {page === "dashboard" ? <button className="tj-btn-primary" onClick={() => { setEditingMarkup(null); setModal("markup"); }}><Plus size={16} /> Start Day</button> : <button className={`tj-btn-primary ${guardrails.tradeEntryLocked ? "tj-btn-disabled" : ""}`} disabled={guardrails.tradeEntryLocked} title={guardrails.tradeEntryLocked ? "Trade entry is paused by your account loss cap" : "Log a new trade"} onClick={() => openNewTrade()}><Plus size={16} /> {guardrails.tradeEntryLocked ? "Trade Locked" : "Log Trade"}</button>}
        </div>
        <div className="tj-content">
          <div className="tj-content-inner">
          <div className="tj-page-transition" key={`${page}-${account.id}`}>
          {["dashboard", "tradelog", "markups", "reviews", "calendar"].includes(page) && <JournalSignalHeader page={page} trades={account.trades} markups={markups.filter(m=>m.accountId===account.id)} reviews={reviews.filter(r=>r.accountId===account.id)} guardrails={guardrails} monthCursor={monthCursor} loginQuote={loginQuote}/>}
          {page === "dashboard" && <ReferenceDashboardPage account={account} stats={stats} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={openDayDetails} guardrails={guardrails} displayName={displayName} loginQuote={loginQuote} challenge={challenge} />}
          {page === "tradelog" && <TradeLogPage account={account} reviews={reviews.filter((review) => review.accountId === account.id)} markups={markups.filter((markup) => markup.accountId === account.id)} onNewTrade={() => openNewTrade()} onEdit={(t) => { if (guardrails.tradeEntryLocked) return showInfo("This account is locked by its loss limit. Trade changes resume after the applicable reset period."); setNewTradeDraft(null); setEditingTrade(t); setModal("newtrade"); }} onDelete={handleDeleteTrade} onLinkMarkup={(trade, markupId) => saveTrade({ ...trade, premarketMarkupId: markupId })} locked={guardrails.tradeEntryLocked} />}
          {page === "analytics" && <AnalyticsPage account={account} />}
          {page === "finance" && account.finance?.enabled && <FinancePage account={account} onRecord={handleRecordFinanceMovement} onDelete={handleDeleteFinanceMovement} />}
          {page === "challenge" && isChallengeEnabled(account) && <ChallengePage key={account.id} account={account} challenge={challenge} loginQuote={loginQuote}/>}
          {page === "calendar" && <CalendarPage account={account} markups={markups.filter((markup)=>markup.accountId===account.id)} reviews={reviews.filter((review)=>review.accountId===account.id)} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onDayClick={openDayDetails} />}
          {page === "psychology" && <PsychologyPage account={account} />}
          {page === "insights" && <InsightsPage account={account} />}
          {page === "news" && <NewsPage />}
          {page === "management" && <ManagementPage account={account} typeTags={typeTags} mistakeTags={mistakeTags} confluenceSessions={confluenceSessions} instruments={customInstruments} onTypeTags={(x)=>saveList("types",x)} onMistakes={(x)=>saveList("mistakes",x)} onConfluence={(x)=>saveList("confluence",x)} onInstruments={(x)=>saveList("instruments",x)} onAddRule={handleAddRule} onUpdateRule={handleUpdateRule} onRemoveRule={handleRemoveRule} />}
          {page === "markups" && <ReferenceMarkupsPage markups={markups.filter((markup)=>markup.accountId===account.id)} trades={account.trades} onNew={()=>{setEditingMarkup(null);setModal("markup");}} onEdit={(markup)=>{setEditingMarkup(markup);setModal("markup");}} onDelete={handleDeleteMarkup} onTrade={(markup)=>openNewTrade({ premarketMarkupId: markup.id, asset: markup.instrument || "", entrySession: markup.market || SESSIONS[2], session: markup.market || SESSIONS[2] })} />}
          {page === "reviews" && <ReviewLibraryPage account={account} reviews={reviews.filter(r=>r.accountId===account.id)} trades={account.trades} markups={markups.filter((markup)=>markup.accountId===account.id)} periodReviews={periodReviews.filter(r=>r.accountId===account.id)} onSavePeriod={handleSavePeriodReview} onSaveTrade={handleSaveReview} />}
          </div>
          </div>
        </div>
      </div>
      {modal === "newtrade" && <NewTradeModal editing={editingTrade} draft={newTradeDraft} typeTags={typeTags} mistakeTags={allMistakeTags(mistakeTags)} confluenceSessions={confluenceSessions} instruments={knownInstruments} markups={markups.filter((markup)=>markup.accountId===account.id)} rules={account.rules} defaultCommission={account.defaultCommission} account={account} onClose={() => { setModal(null); setEditingTrade(null); setNewTradeDraft(null); }} onSave={saveTrade} />}
      {modal === "account" && !guardrails.tradeEntryLocked && <AccountSettingsModal key={account.id} account={account} challenge={challenge} onClose={() => setModal(null)} onSave={handleSaveAccountSettings} onImport={(trades, onProgress) => importTradesToAccount(account, trades, onProgress)} onDelete={handleDeleteAccount} />}
      {modal === "profile" && <ProfileSettingsModal user={user} account={account} themeValue={profileTheme} onClose={() => setModal(null)} onSave={handleSaveProfileSettings} />}
      {modal === "markup" && <MarkupModal editing={editingMarkup} instruments={knownInstruments} onClose={()=>{setModal(null);setEditingMarkup(null);}} onSave={handleSaveMarkup} />}
      {modal === "addaccount" && <AddAccountModal onClose={() => setModal(null)} onCreate={handleCreateAccount} />}
      {dayModalDate && (
        <DayTradesModal
          date={dayModalDate}
          trades={account.trades.filter((t) => t.date === dayModalDate)}
          markups={markups.filter((markup) => markup.accountId === account.id && markup.date === dayModalDate)}
          reviews={reviews.filter((review) => review.accountId === account.id && review.date === dayModalDate)}
          movements={(account.financeMovements || []).filter((movement) => movement.date === dayModalDate)}
          account={account}
          onClose={() => setDayModalDate(null)}
          onEdit={(t) => { if (guardrails.tradeEntryLocked) return showInfo("This account is locked by its loss limit. Trade changes resume after the applicable reset period."); setDayModalDate(null); setNewTradeDraft(null); setEditingTrade(t); setModal("newtrade"); }}
          onDelete={(id) => handleDeleteTrade(id)}
          locked={guardrails.tradeEntryLocked}
        />
      )}
      {financeReminder.length > 0 && <FinanceReminderModal account={account} savingsPlans={financeReminder} onClose={() => setFinanceReminder([])} onOpenFinance={() => setPage("finance")} />}
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
/* A small journal-only reduction; landing/auth typography is unchanged. */
html:has(.tj-root) { font-size: 93.75%; }
.tj-toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 200000; padding: 12px 20px; border-radius: 10px; font-size: 0.96875rem; font-weight: 600; box-shadow: 0 12px 30px rgba(0,0,0,0.5); max-width: 90vw; text-align: center; }
.tj-toast-error { background: #2A1B21; border: 1px solid #BC5967; color: #BC5967; }
.tj-toast-info { background: #162D2A; border: 1px solid var(--tj-green); color: var(--tj-green); }
:root {
  --tj-bg: #0B1016; --tj-panel: rgba(23,32,43,.94); --tj-panel-alt: rgba(28,35,43,.96); --tj-chrome: #131B23; --tj-border: #4A525C;
  --tj-text: #F4F7FA; --tj-muted: #95A1B1; --tj-green: #50C6A0; --tj-red: #BC5967;
  --tj-purple: #8B7CF6; --tj-blue: #60A5FA; --tj-amber: #FBBF24; --tj-winrate-amber: #D9A441;
  --tj-input-bg: #141B26; --tj-chart-bg: #141B26; --tj-chart-grid: #27313D; --tj-chart-text: #95A1B1;
  --tj-tooltip-bg: #1C232B; --tj-primary-hover: #44A188; --tj-primary-muted: rgba(80,198,160,0.18);
  --tj-shadow: 0 16px 36px rgba(0,0,0,0.32); --tj-primary-contrast: #0B241E; --tj-grid-line: rgba(149,161,177,0.045);
  --tj-bg-glow-left: rgba(18,96,72,.17); --tj-bg-glow-right: rgba(62,78,124,.15);
  --tj-scroll-track: #111A23; --tj-scroll-thumb: #2E7669; --tj-scroll-thumb-hover: #50C6A0;
}
.tj-theme-light {
  --tj-bg: #EEF3F7; --tj-panel: rgba(255,255,255,.76); --tj-panel-alt: rgba(245,248,251,.86); --tj-chrome: #FFFFFF; --tj-border: #D3DEE8;
  --tj-text: #17221A; --tj-muted: #65746A; --tj-green: #44A188; --tj-red: #B95664;
  --tj-purple: #6D5FD8; --tj-blue: #2563EB; --tj-amber: #B45309; --tj-winrate-amber: #9A6700;
  --tj-input-bg: #FFFFFF; --tj-chart-bg: #FFFFFF; --tj-chart-grid: #D7E1D9; --tj-chart-text: #536258;
  --tj-tooltip-bg: #FFFFFF; --tj-primary-hover: #357F6D; --tj-primary-muted: rgba(80,198,160,0.14);
  --tj-shadow: 0 14px 30px rgba(19,35,26,0.10); --tj-primary-contrast: #FFFFFF; --tj-grid-line: rgba(52, 86, 113, .075);
  --tj-bg-glow-left: rgba(58, 170, 132, .11); --tj-bg-glow-right: rgba(86, 125, 188, .13);
  --tj-scroll-track: #E7EEF2; --tj-scroll-thumb: #83B7A9; --tj-scroll-thumb-hover: #44A188;
}
.tj-theme-light .tj-modal-overlay { background: rgba(0,0,0,0.35); }
.tj-theme-light .tj-backdrop { background: rgba(0,0,0,0.35); }
.tj-theme-light ::placeholder { color: #9CA3AF; }
.tj-theme-light .tj-btn-primary, .tj-theme-light .auth-submit { color: #FFFFFF; }
.tj-theme-light .tj-panel, .tj-theme-light .tj-modal { box-shadow: 0 5px 18px rgba(15,23,42,0.07); }
.tj-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: var(--tj-bg); background-image: radial-gradient(circle at 7% 8%, var(--tj-bg-glow-left), transparent 32%), radial-gradient(circle at 94% 7%, var(--tj-bg-glow-right), transparent 40%); background-size: auto, auto; background-attachment: fixed; color: var(--tj-text); color-scheme: dark; display: flex; height: 100vh; width: 100%; font-size: 1rem; overflow: hidden; }
.tj-root.tj-theme-light { color-scheme: light; }
.tj-root, .tj-root *, .tj-root *::before, .tj-root *::after { box-sizing: border-box; }
.tj-root, .tj-root * { scrollbar-width: thin; scrollbar-color: var(--tj-scroll-thumb) var(--tj-scroll-track); }
.tj-root::-webkit-scrollbar, .tj-root *::-webkit-scrollbar { width: 9px; height: 9px; }
.tj-root::-webkit-scrollbar-track, .tj-root *::-webkit-scrollbar-track { background: var(--tj-scroll-track); border-radius: 999px; }
.tj-root::-webkit-scrollbar-thumb, .tj-root *::-webkit-scrollbar-thumb { min-height: 44px; border: 2px solid var(--tj-scroll-track); border-radius: 999px; background: var(--tj-scroll-thumb); }
.tj-root::-webkit-scrollbar-thumb:hover, .tj-root *::-webkit-scrollbar-thumb:hover { background: var(--tj-scroll-thumb-hover); }
.tj-root::-webkit-scrollbar-corner, .tj-root *::-webkit-scrollbar-corner { background: var(--tj-scroll-track); }
.tj-loading { align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--tj-muted); }
.tj-spinner { width: 28px; height: 28px; border: 3px solid var(--tj-border); border-top-color: var(--tj-purple); border-radius: 50%; animation: tj-spin 0.8s linear infinite; }
.tj-load-error-card { display: flex; width: min(460px, calc(100vw - 32px)); padding: 28px; align-items: center; flex-direction: column; gap: 10px; border: 1px solid color-mix(in srgb, var(--tj-red) 45%, var(--tj-border)); border-radius: 16px; background: var(--tj-panel); text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.28); }
.tj-load-error-card svg { color: var(--tj-red); }
.tj-load-error-card strong { color: var(--tj-text); font-size: 1.1475rem; }
.tj-load-error-card span { max-width: 360px; font-size: 0.9375rem; line-height: 1.5; }
.tj-load-error-card .tj-btn-primary { margin-top: 4px; }
@keyframes tj-spin { to { transform: rotate(360deg); } }
@keyframes tj-modal-backdrop-in { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(2px); } }
@keyframes tj-modal-panel-in { 0% { opacity: 0; transform: translateY(-44px) scale(.965); } 68% { opacity: 1; transform: translateY(3px) scale(1.002); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes tj-modal-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes tj-modal-panel-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-28px) scale(.98); } }
/* TM-inspired masked reveal: the navigation stays anchored while content settles. */
@keyframes tj-page-enter {
  from { opacity: 0; transform: translate3d(0, 42px, 0) scale(.985); clip-path: inset(0 0 12% 0); }
  35% { opacity: 1; }
  to { opacity: 1; transform: none; clip-path: inset(0); }
}
@keyframes tj-view-enter {
  from { opacity: 0; transform: translate3d(0, 28px, 0); clip-path: inset(0 0 8% 0); }
  40% { opacity: 1; }
  to { opacity: 1; transform: none; clip-path: inset(0); }
}
@keyframes tj-content-settle {
  from { opacity: 0; transform: translate3d(0, 18px, 0); }
  to { opacity: 1; transform: none; }
}
.tj-page-transition { width: 100%; animation: tj-page-enter .68s cubic-bezier(.22,1,.36,1) backwards; transform-origin: 50% 0; }
.tj-view-transition, .tj-subview-transition { animation: tj-view-enter .56s cubic-bezier(.22,1,.36,1) backwards; transform-origin: 50% 0; }
.tj-page-transition > div > :is(.tj-card, .tj-row2, .tj-row3),
.tj-view-transition > .tj-card { animation: tj-content-settle .6s cubic-bezier(.22,1,.36,1) backwards; }
.tj-page-transition > div > :nth-child(2), .tj-view-transition > .tj-card:nth-child(2) { animation-delay: 45ms; }
.tj-page-transition > div > :nth-child(3), .tj-view-transition > .tj-card:nth-child(3) { animation-delay: 85ms; }
.tj-page-transition > div > :nth-child(n+4), .tj-view-transition > .tj-card:nth-child(n+4) { animation-delay: 120ms; }
.tj-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.tj-bold { font-weight: 700; }
.tj-green { color: var(--tj-green); } .tj-red { color: var(--tj-red); } .tj-blue { color: var(--tj-blue); }
.tj-muted-txt { color: var(--tj-muted); } .tj-purple-txt { color: var(--tj-purple); }

.tj-sidebar { width: 220px; min-width: 220px; height: 100vh; background: var(--tj-chrome); border-right: 1px solid var(--tj-border); display: flex; flex-direction: column; padding: 18px 14px; position: relative; flex-shrink: 0; transition: transform .6s cubic-bezier(.22,1,.36,1), width .6s cubic-bezier(.22,1,.36,1), min-width .6s cubic-bezier(.22,1,.36,1), padding .6s cubic-bezier(.22,1,.36,1); box-shadow: 12px 0 28px rgba(0,0,0,0.08); }
.tj-sidebar-toggle { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 9px; width: 32px; height: 32px; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .tj-root :is(button, a, [role="button"], [role="tab"], tr) { transition: background-color .25s ease, box-shadow .3s ease, border-color .25s ease, translate .3s cubic-bezier(.22,1,.36,1); }
  .tj-root .tj-pointer-lit {
    background-image: radial-gradient(180px circle at var(--pointer-x, 50%) var(--pointer-y, 50%), color-mix(in srgb, var(--tj-green) 22%, transparent), transparent 80%) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tj-green) 45%, transparent), 0 5px 15px color-mix(in srgb, var(--tj-green) 10%, transparent);
  }
  .tj-root .tj-pointer-lit:not(tr):not(td) { translate: 0 -1px; }
}
.tj-root :is(button, a, [role="button"], [role="tab"]):focus-visible { outline: 2px solid var(--tj-green); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .tj-sidebar { transition: none; } }
.tj-sidebar-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.tj-sidebar-collapsed { width: 64px; min-width: 64px; padding: 14px 8px; }
.tj-backdrop { display: none; }
.tj-sidebar-profile { width: 100%; min-height: 80px; display: grid; place-items: center; margin: 0 0 18px; padding: 4px; border: 0; background: transparent; color: var(--tj-text); cursor: pointer; }
.tj-sidebar-profile:hover .tj-sidebar-profile-avatar { border-color: var(--tj-green); box-shadow: 0 8px 24px color-mix(in srgb, var(--tj-green) 24%, transparent); }
.tj-sidebar-profile-avatar { width: 64px; height: 64px; display: grid; place-items: center; overflow: hidden; border: 2px solid color-mix(in srgb, var(--tj-green) 40%, var(--tj-border)); border-radius: 50%; background: var(--tj-panel-alt); color: var(--tj-green); font-size: 1.485rem; font-weight: 900; box-shadow: 0 8px 20px rgba(0,0,0,.2); }
.tj-sidebar-profile-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }
.tj-nav-label { font-size: 0.75rem; letter-spacing: 1.2px; color: var(--tj-muted); margin: 14px 4px 8px; font-weight: 600; }
.tj-nav { display: flex; flex-direction: column; gap: 2px; }
.tj-nav-item { display: flex; align-items: center; gap: 10px; background: none; border: 1px solid transparent; color: var(--tj-muted); padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 0.96875rem; text-align: left; font-family: inherit; transition: background .16s ease, color .16s ease, border-color .16s ease; }
.tj-nav-symbol { width: 16px; height: 16px; display: inline-block; flex: 0 0 16px; object-fit: contain; opacity: .82; filter: brightness(0) saturate(100%) invert(73%) sepia(11%) saturate(504%) hue-rotate(174deg) brightness(91%) contrast(86%); transition: filter .16s ease, opacity .16s ease; }
.tj-theme-light .tj-nav-symbol { opacity: .76; filter: brightness(0) saturate(100%) invert(22%) sepia(14%) saturate(731%) hue-rotate(169deg) brightness(88%) contrast(89%); }
.tj-nav-item:hover .tj-nav-symbol { opacity: 1; filter: brightness(0) saturate(100%) invert(98%) sepia(3%) saturate(587%) hue-rotate(173deg) brightness(95%) contrast(91%); }
.tj-theme-light .tj-nav-item:hover .tj-nav-symbol { filter: brightness(0) saturate(100%) invert(12%) sepia(12%) saturate(912%) hue-rotate(169deg) brightness(91%) contrast(91%); }
.tj-nav-active .tj-nav-symbol, .tj-symbol-title .tj-nav-symbol, .tj-management-title .tj-nav-symbol { opacity: 1; filter: brightness(0) saturate(100%) invert(70%) sepia(58%) saturate(478%) hue-rotate(107deg) brightness(90%) contrast(89%); }
.tj-symbol-title, .tj-management-title { display: inline-flex; align-items: center; gap: 8px; }
.tj-symbol-title .tj-nav-symbol, .tj-management-title .tj-nav-symbol { width: 18px; height: 18px; flex-basis: 18px; }
.tj-nav-item:hover { background: var(--tj-panel-alt); color: var(--tj-text); }
.tj-nav-active { background: var(--tj-primary-muted); border-color: rgba(80,198,160,0.34); color: var(--tj-green) !important; font-weight: 700; box-shadow: inset 3px 0 0 var(--tj-green); }
.tj-nav-danger:hover { color: var(--tj-red) !important; }
.tj-sidebar-footer { position: relative; flex-shrink: 0; padding-top: 10px; }
.tj-sidebar-user { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 8px 10px; cursor: pointer; font-family: inherit; color: var(--tj-text); }
.tj-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--tj-panel); display: flex; align-items: center; justify-content: center; font-size: 1.08rem; flex-shrink: 0; }
.tj-avatar-sm { width: 22px; height: 22px; border-radius: 50%; background: var(--tj-panel); display: flex; align-items: center; justify-content: center; font-size: 0.875rem; flex-shrink: 0; }
.tj-account-name { font-size: 0.9375rem; font-weight: 600; } .tj-account-sub { font-size: 0.8125rem; color: var(--tj-muted); }
.tj-account-menu { position: absolute; bottom: 58px; left: 0; width: 320px; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 16px; padding: 14px; box-shadow: 0 18px 42px rgba(0,0,0,0.5); z-index: 30; }
.tj-account-menu { transform-origin: bottom left; animation: tj-modal-panel-in .42s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .tj-account-menu { animation: none; } }
.tj-account-center-head, .tj-account-center-section-head, .tj-account-center-active-head, .tj-account-center-result { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tj-account-center-head { margin-bottom: 12px; }
.tj-account-center-head > div, .tj-account-center-section-head > div { display: grid; gap: 2px; }
.tj-account-center-head span, .tj-account-center-section-head span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.15px; }
.tj-account-center-head strong { font-size: 1.08rem; }
.tj-account-center-active { padding: 12px; border: 1px solid color-mix(in srgb, var(--tj-green) 28%, var(--tj-border)); border-radius: 12px; background-color: color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel)); background-image: linear-gradient(color-mix(in srgb, var(--tj-green) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--tj-green) 6%, transparent) 1px, transparent 1px), linear-gradient(164deg, transparent 0 72%, color-mix(in srgb, var(--tj-green) 15%, transparent) 72% 100%); background-size: 24px 24px, 24px 24px, 100% 100%; overflow: hidden; }
.tj-account-center-active-head { justify-content: flex-start; }
.tj-account-center-active-head > div { min-width: 0; display: grid; gap: 1px; }
.tj-account-center-active-head > div strong { overflow: hidden; font-size: 0.9375rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-account-center-active-head small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-account-center-active-head > em { margin-left: auto; padding: 4px 8px; border-radius: 999px; background: var(--tj-primary-muted); color: var(--tj-green); font-size: 0.75rem; font-style: normal; font-weight: 800; }
.tj-account-initial { width: 30px; height: 30px; display: inline-grid; place-items: center; flex: 0 0 auto; border: 1px solid color-mix(in srgb, var(--tj-green) 35%, var(--tj-border)); border-radius: 9px; background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 15%, var(--tj-panel-alt)), var(--tj-panel)); color: var(--tj-green); font-size: 0.875rem; font-weight: 900; }
.tj-account-initial-lg { width: 38px; height: 38px; border-radius: 11px; font-size: 1.0125rem; }
.tj-account-center-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.tj-account-center-metrics > div { display: grid; gap: 3px; padding: 9px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }
.tj-account-center-metrics small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .7px; }
.tj-account-center-metrics strong { overflow: hidden; font-size: 1rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.tj-account-center-result { margin-top: 10px; font-size: 0.75rem; }
.tj-account-center-result span { color: var(--tj-muted); }
.tj-account-center-section-head { margin: 12px 0 8px; }
.tj-account-center-section-head small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-account-center-section-head .tj-btn-outline { border-radius: 999px; }
.tj-account-center-list { max-height: 220px; display: grid; gap: 7px; overflow-y: auto; padding-right: 4px; scrollbar-gutter: stable; }
.tj-account-row { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; background: none; border: none; color: var(--tj-text); padding: 9px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 0.9375rem; text-align: left; }
.tj-account-row-wrap { display: flex; align-items: center; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); }
.tj-account-row-wrap:hover { border-color: color-mix(in srgb, var(--tj-green) 36%, var(--tj-border)); }
.tj-account-row-active { border-color: color-mix(in srgb, var(--tj-green) 48%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)); }
.tj-account-row-name { min-width: 0; display: grid; grid-template-columns: minmax(0, auto) auto; align-items: center; justify-content: start; gap: 2px 6px; }
.tj-account-row-name > strong { overflow: hidden; font-size: 0.875rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-account-row-name > em { padding: 2px 6px; border-radius: 999px; background: var(--tj-primary-muted); color: var(--tj-green); font-size: 0.75rem; font-style: normal; font-weight: 800; }
.tj-account-row-name > small { grid-column: 1 / -1; color: var(--tj-muted); font-size: 0.75rem; }
.tj-account-row-value { min-width: 60px; display: grid; justify-items: end; gap: 1px; margin-left: auto; font-variant-numeric: tabular-nums; }
.tj-account-row-value strong { font-size: 0.875rem; }
.tj-account-row-value small { font-size: 0.75rem; }
.tj-account-delete { margin-right: 7px; background: color-mix(in srgb, var(--tj-red) 9%, transparent); border: 1px solid color-mix(in srgb, var(--tj-red) 20%, var(--tj-border)); color: var(--tj-red); cursor: pointer; padding: 6px; border-radius: 7px; flex-shrink: 0; }
.tj-account-delete:hover { color: var(--tj-red); background: rgba(188,89,103,0.12); }
.tj-add-account { width: 100%; min-height: 35px; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; border: 1px dashed color-mix(in srgb, var(--tj-green) 48%, var(--tj-border)); border-radius: 9px; background: color-mix(in srgb, var(--tj-green) 5%, transparent); color: var(--tj-green); font: inherit; font-size: 0.8125rem; font-weight: 800; cursor: pointer; }
.tj-add-account:hover { background: color-mix(in srgb, var(--tj-green) 11%, transparent); }
.tj-sidebar-user-chevron { margin-left: auto; color: var(--tj-muted); transition: transform .16s ease; }
.tj-sidebar-collapsed .tj-sidebar-scroll { overflow: hidden; }
.tj-sidebar-collapsed .tj-sidebar-profile { min-height: 52px; margin-bottom: 10px; padding: 5px 0 12px; border-width: 0 0 1px; border-radius: 0; background: transparent; box-shadow: none; }
.tj-sidebar-collapsed .tj-sidebar-profile-avatar { width: 40px; height: 40px; font-size: 1rem; }
.tj-sidebar-collapsed .tj-nav-label, .tj-sidebar-collapsed .tj-nav-item > span, .tj-sidebar-collapsed .tj-sidebar-user > div:nth-child(2), .tj-sidebar-collapsed .tj-sidebar-user-chevron { display: none; }
.tj-sidebar-collapsed .tj-nav-item { width: 46px; min-height: 42px; justify-content: center; gap: 0; padding: 9px; }
.tj-sidebar-collapsed .tj-nav-item svg, .tj-sidebar-collapsed .tj-nav-symbol { flex: 0 0 auto; }
.tj-sidebar-collapsed .tj-nav-active { box-shadow: none; }
.tj-sidebar-collapsed .tj-nav + .tj-nav-label + .tj-nav { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--tj-border); }
.tj-sidebar-collapsed .tj-sidebar-user { min-height: 44px; justify-content: center; padding: 6px; }
.tj-sidebar-collapsed .tj-sidebar-user .tj-account-initial { width: 28px; height: 28px; }
.tj-sidebar-collapsed .tj-account-menu { left: calc(100% + 10px); bottom: 0; }

.tj-main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100vh; overflow: hidden; }
.tj-topbar { display: flex; align-items: center; justify-content: space-between; padding: 15px 24px; border-bottom: 1px solid var(--tj-border); background: color-mix(in srgb, var(--tj-chrome) 92%, transparent); backdrop-filter: blur(14px); gap: 12px; }
.tj-topbar-left { display: flex; align-items: center; gap: 10px; }
.tj-page-title { font-weight: 700; font-size: 1.08rem; } .tj-page-sub { font-size: 0.8125rem; color: var(--tj-muted); }
.tj-topbar-account { color: var(--tj-green); font-weight: 700; flex: 1; text-align: center; font-size: 0.875rem; letter-spacing: .02em; }
.tj-content { padding: 24px 32px 36px; overflow-y: auto; flex: 1; min-height: 0; }
.tj-content-inner { width: calc(100% - clamp(0px, 10vw, 192px)); max-width: none; min-height: 100%; margin: 0 auto; }
.tj-topbar { flex-shrink: 0; }

.tj-btn-primary { background: var(--tj-green); color: var(--tj-primary-contrast); border: 1px solid var(--tj-green); border-radius: 8px; padding: 9px 16px; font-weight: 700; font-size: 0.9375rem; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; white-space: nowrap; box-shadow: 0 7px 16px rgba(80,198,160,0.22); transition: transform .16s ease, background .16s ease, box-shadow .16s ease; }
.tj-btn-primary:hover { background: var(--tj-primary-hover); transform: translateY(-1px); box-shadow: 0 9px 20px rgba(80,198,160,0.28); }
.tj-btn-outline { background: none; border: 1px solid var(--tj-border); color: var(--tj-text); border-radius: 8px; padding: 8px 14px; font-size: 0.9375rem; cursor: pointer; font-family: inherit; }
.tj-btn-outline:hover { background: var(--tj-panel-alt); }
.tj-icon-btn { background: none; border: none; color: var(--tj-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: inline-flex; }
.tj-icon-btn:hover { background: var(--tj-panel-alt); color: var(--tj-text); }
.tj-fab { position: sticky; bottom: 16px; margin: 16px auto 0; display: flex; background: var(--tj-green); color: var(--tj-primary-contrast); border: none; border-radius: 24px; padding: 10px 18px; font-weight: 700; cursor: pointer; align-items: center; gap: 6px; box-shadow: var(--tj-shadow); }

.tj-card { background: color-mix(in srgb, var(--tj-panel) 96%, transparent); border: 1px solid var(--tj-border); border-radius: 12px; box-shadow: 0 8px 22px rgba(0,0,0,0.05); }
.tj-stats-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.tj-command-panel { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 20px 22px; margin-bottom: 16px; background: linear-gradient(112deg, color-mix(in srgb, var(--tj-panel) 98%, transparent), color-mix(in srgb, var(--tj-panel-alt) 86%, var(--tj-green) 14%)); }
.tj-command-panel::after { content: ""; position: absolute; inset: auto -46px -72px auto; width: 240px; height: 240px; border-radius: 50%; border: 1px solid rgba(80,198,160,.20); box-shadow: 0 0 0 32px rgba(80,198,160,.035), 0 0 0 64px rgba(80,198,160,.025); pointer-events: none; }
.tj-command-copy { min-width: 0; position: relative; z-index: 1; }
.tj-command-eyebrow { display: flex; align-items: center; gap: 7px; color: var(--tj-green); font-size: 0.75rem; font-weight: 800; letter-spacing: .13em; }
.tj-command-live { width: 7px; height: 7px; border-radius: 999px; background: var(--tj-green); box-shadow: 0 0 0 4px var(--tj-primary-muted); }
.tj-command-title { max-width: 560px; margin-top: 8px; font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: clamp(19px, 2vw, 27px); font-weight: 750; letter-spacing: -.035em; line-height: 1.12; }
.tj-command-sub { color: var(--tj-muted); font-size: 0.90625rem; margin-top: 7px; }
.tj-command-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(100px, 1fr)); gap: 8px; min-width: min(100%, 530px); }
.tj-command-metric { min-width: 0; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--tj-border) 88%, var(--tj-green) 12%); background: color-mix(in srgb, var(--tj-panel) 78%, transparent); border-radius: 9px; }
.tj-command-metric span { display: block; color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .08em; font-weight: 700; white-space: nowrap; }
.tj-command-metric strong { display: block; margin-top: 5px; font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: 1.0125rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tj-stat { padding: 14px 16px; }
.tj-stat-label { font-size: 0.78125rem; letter-spacing: 0.5px; color: var(--tj-muted); font-weight: 600; margin-bottom: 6px; }
.tj-stat-row { display: flex; align-items: center; justify-content: space-between; }
.tj-stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.485rem; font-weight: 700; }
.tj-stat-sub { font-size: 0.8125rem; color: var(--tj-muted); margin-top: 4px; }
.tj-stat-sub-row { display: flex; justify-content: space-between; font-size: 0.8125rem; margin-top: 4px; }
.tj-badge-dot { display: flex; gap: 6px; margin-top: 6px; }
.tj-dot { font-size: 0.75rem; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
.tj-dot-green { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-dot-red { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-dot-blue { background: rgba(96,165,250,0.15); color: var(--tj-blue); }
i.tj-dot-green, i.tj-dot-red, i.tj-dot-blue, i.tj-dot-amber { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
i.tj-dot-green { background: var(--tj-green); } i.tj-dot-red { background: var(--tj-red); } i.tj-dot-blue { background: var(--tj-blue); } i.tj-dot-amber { background: var(--tj-amber); }
.tj-winloss-bar { height: 6px; border-radius: 6px; overflow: hidden; background: var(--tj-red); margin-top: 8px; }
.tj-winloss-fill { height: 100%; background: var(--tj-green); }

.tj-row3 { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: 14px; margin-bottom: 16px; }
.tj-row2 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.tj-panel { padding: 16px; }
.tj-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-weight: 600; font-size: 0.9375rem; }
.tj-thunder { color: var(--tj-purple); font-size: 0.875rem; letter-spacing: 0.5px; }
.tj-pill { font-size: 0.8125rem; padding: 3px 8px; border-radius: 20px; font-weight: 700; }
.tj-pill-green { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-pill-red { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-pill-blue { background: color-mix(in srgb, var(--tj-blue) 15%, transparent); color: var(--tj-blue); }
.tj-pill-neutral { background: var(--tj-panel-alt); color: var(--tj-muted); }

.tj-avgrr-label { text-align: center; font-size: 0.75rem; color: var(--tj-muted); margin-top: 4px; }
.tj-gauge-track { height: 8px; border-radius: 6px; background: linear-gradient(90deg, var(--tj-red), var(--tj-amber), var(--tj-green)); position: relative; margin-top: 4px; }
.tj-gauge-knob { position: absolute; top: -3px; width: 14px; height: 14px; border-radius: 50%; background: var(--tj-panel); border: 2px solid var(--tj-bg); transform: translateX(-50%); }
.tj-gauge-scale { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--tj-muted); margin-top: 3px; }
.tj-edge-num { font-family: 'Space Grotesk', sans-serif; font-size: 2.025rem; font-weight: 800; text-align: center; margin-top: 8px; color: var(--tj-purple); }
.tj-edge-label { text-align: center; font-size: 0.75rem; letter-spacing: 1px; color: var(--tj-muted); margin-top: -4px; }

.tj-bar-track { height: 6px; border-radius: 6px; background: var(--tj-border); overflow: hidden; }
.tj-bar-fill { height: 100%; } .tj-bar-green { background: var(--tj-green); } .tj-bar-red { background: var(--tj-red); } .tj-bar-yellow { background: var(--tj-amber); }
.tj-wr-yellow { color: var(--tj-winrate-amber); }

.tj-month-nav { display: flex; gap: 2px; }
.tj-month-summary { display: flex; justify-content: space-around; text-align: center; padding: 10px 0 16px; border-bottom: 1px solid var(--tj-border); margin-bottom: 10px; }
.tj-mnum { font-family: 'Space Grotesk', sans-serif; font-size: 1.35rem; font-weight: 700; }
.tj-mlabel { font-size: 0.75rem; color: var(--tj-muted); letter-spacing: 0.5px; }
.tj-cal-dow { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.8125rem; color: var(--tj-muted); margin-bottom: 4px; }
.tj-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; min-width: 0; width: 100%; }
.tj-cal-cell { aspect-ratio: 1.1; background: var(--tj-panel-alt); border-radius: 8px; padding: 6px; border: 1px solid transparent; overflow: hidden; min-width: 0; }
.tj-cal-empty { background: none; }
.tj-cal-win { background: rgba(80,198,160,0.10); border-color: rgba(80,198,160,0.4); }
.tj-cal-loss { background: rgba(188,89,103,0.10); border-color: rgba(188,89,103,0.4); }
.tj-cal-be { background: rgba(96,165,250,0.10); border-color: rgba(96,165,250,0.4); }
.tj-cal-today { box-shadow: 0 0 0 1px var(--tj-purple) inset; }
.tj-cal-day { font-size: 0.8125rem; color: var(--tj-muted); margin-bottom: 2px; }
.tj-cal-pnl { font-size: 0.875rem; font-weight: 600; }
.tj-cal-tcount { font-size: 0.75rem; color: var(--tj-muted); margin-top: 1px; }
.tj-dock-cell { transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s; transform-origin: center bottom; will-change: transform; position: relative; }
.tj-dock-cell:hover { transform: scale(1.16) translateY(-4px); z-index: 5; }
.tj-cal-clickable { cursor: pointer; }
.tj-cal-dots { display: flex; gap: 2px; margin-top: 3px; }
.tj-mini-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
.tj-mini-dot.tj-dot-win { background: var(--tj-green); } .tj-mini-dot.tj-dot-loss { background: var(--tj-red); } .tj-mini-dot.tj-dot-be { background: var(--tj-blue); }

.tj-weekly-list { display: flex; flex-direction: column; gap: 14px; }
.tj-weekly-item-label { font-size: 0.78125rem; color: var(--tj-muted); letter-spacing: 0.5px; }
.tj-weekly-item-num { font-family: 'Space Grotesk', sans-serif; font-size: 1.215rem; font-weight: 700; margin-top: 2px; }
.tj-weekly-item-sub { font-size: 0.8125rem; color: var(--tj-muted); margin-bottom: 4px; }
.tj-cal-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.tj-perf-table th, .tj-perf-table td { white-space: nowrap; }
.tj-perf-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
.tj-perf-summary-card { text-align: center; }
.tj-dow-list { display: flex; flex-direction: column; gap: 14px; }
.tj-dow-row { display: flex; align-items: center; gap: 10px; }
.tj-dow-label { width: 40px; color: var(--tj-muted); font-size: 0.90625rem; flex-shrink: 0; }
.tj-dow-pnl { font-weight: 700; font-size: 0.9375rem; width: 60px; flex-shrink: 0; }
.tj-dow-bar { flex: 1; height: 8px; }
.tj-dow-wr { font-size: 0.8125rem; flex-shrink: 0; width: 60px; }
.tj-dow-count { font-size: 0.8125rem; flex-shrink: 0; width: 26px; text-align: right; }

.tj-empty { color: var(--tj-muted); font-size: 0.9375rem; padding: 30px 0; text-align: center; }
.tj-empty-block { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.tj-empty-title { font-weight: 700; font-size: 1.0125rem; }
.tj-empty-sub { font-size: 0.875rem; color: var(--tj-muted); text-align: center; max-width: 320px; margin-bottom: 6px; }

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
.tj-toolbar-search:focus-within { border-color: var(--tj-green); box-shadow: 0 0 0 3px rgba(80,198,160,0.16), 0 0 14px rgba(80,198,160,0.18); }
.tj-toolbar-search-icon { color: var(--tj-muted); flex-shrink: 0; }
.tj-toolbar-search-input { background: none; border: none; outline: none; color: var(--tj-text); font-size: 0.96875rem; font-weight: 500; width: 100%; font-family: inherit; }
.tj-toolbar-search-input::placeholder { color: var(--tj-muted); }
.tj-toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tj-toolbar-dd, .tj-toolbar-pill {
  height: 34px; background: var(--tj-input-bg); border: 1px solid var(--tj-border); border-radius: 9px;
  color: var(--tj-text); font-size: 0.9375rem; font-weight: 500; font-family: 'Inter', system-ui, sans-serif;
  padding: 0 12px; cursor: pointer; white-space: nowrap;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.tj-toolbar-dd:hover, .tj-toolbar-pill:hover { transform: translateY(-2px); border-color: var(--tj-muted); }
.tj-toolbar-pill { display: inline-flex; align-items: center; justify-content: center; }
.tj-toolbar-btn-active { background: var(--tj-primary-muted) !important; border-color: var(--tj-green) !important; color: var(--tj-green) !important; }
.tj-tradelog-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.tj-mini-stat { padding: 12px 14px; }
.tj-mnum-sm { font-family: 'Space Grotesk', sans-serif; font-size: 1.215rem; font-weight: 700; margin-top: 2px; }
.tj-tlog-list { display: flex; flex-direction: column; gap: 10px; }
.tj-tlog-card { padding: 0; overflow: hidden; border-left-width: 3px; }
.tj-tlog-win { border-left: 3px solid var(--tj-green); } .tj-tlog-loss { border-left: 3px solid var(--tj-red); } .tj-tlog-be { border-left: 3px solid var(--tj-blue); }
.tj-tlog-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; flex-wrap: wrap; }
.tj-tlog-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.tj-tlog-main { min-width: 90px; } .tj-tlog-asset { font-weight: 700; font-size: 1rem; }
.tj-tlog-pills { display: flex; gap: 4px; margin-top: 3px; }
.tj-dirpill-sm { font-size: 0.75rem; font-weight: 700; }
.tj-sesspill { font-size: 0.75rem; color: var(--tj-muted); background: var(--tj-panel-alt); border-radius: 4px; padding: 1px 5px; }
.tj-tlog-date { font-size: 0.875rem; color: var(--tj-muted); min-width: 70px; }
.tj-tlog-pnl-block { min-width: 80px; }
.tj-tlog-pnl { font-weight: 700; font-size: 1rem; }
.tj-tlog-rr { font-size: 0.75rem; color: var(--tj-muted); }
.tj-tlog-types, .tj-tlog-stars { min-width: 60px; }
.tj-statuspill { font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 10px; }
.tj-statuspill-win { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-statuspill-loss { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-statuspill-be { background: rgba(96,165,250,0.15); color: var(--tj-blue); }
.tj-review-status { display: inline-flex; align-items: center; gap: 4px; min-width: 104px; justify-content: center; font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border: 1px solid transparent; border-radius: 10px; white-space: nowrap; }
.tj-review-reviewed { background: var(--tj-primary-muted); color: var(--tj-green); border-color: rgba(80,198,160,0.36); }
.tj-review-pending { background: rgba(188,89,103,0.14); color: var(--tj-red); border-color: rgba(188,89,103,0.32); }
.tj-tlog-actions { display: flex; gap: 6px; }
.tj-btn-edit, .tj-btn-del { border: none; border-radius: 6px; padding: 5px 10px; font-size: 0.8125rem; font-weight: 700; cursor: pointer; }
.tj-btn-edit { background: var(--tj-panel-alt); color: var(--tj-text); border: 1px solid var(--tj-border); }
.tj-btn-del { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-tlog-expand { padding: 14px; border-top: 1px solid var(--tj-border); background: var(--tj-panel-alt); }
.tj-tlog-detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.tj-tlog-mistakes, .tj-tlog-shots { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.tj-tlog-shots img { width: 90px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--tj-border); }
.tj-tlog-context { margin-top: 10px; font-style: italic; color: var(--tj-muted); font-size: 0.90625rem; }
.tj-daymodal-summary { margin-bottom: 14px; font-size: 0.9375rem; }
.tj-day-record-list { display: flex; flex-direction: column; gap: 6px; margin: 0 0 14px; }
.tj-day-record { display: flex; gap: 10px; padding: 8px 10px; border-radius: 7px; background: var(--tj-panel-alt); font-size: 0.875rem; }
.tj-day-record > span:first-child { color: var(--tj-green); font-weight: 700; min-width: 74px; }

/* modals & forms */
.tj-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; animation: tj-modal-backdrop-in .26s ease-out both; }
.tj-modal { background: var(--tj-panel); border: 1px solid var(--tj-border); border-radius: 14px; width: 560px; max-width: 100%; max-height: 92vh; overflow-x: hidden; overflow-y: auto; font-size: 1rem; transform-origin: 50% 0; animation: tj-modal-panel-in .42s cubic-bezier(.22,1,.36,1) both; will-change: transform, opacity; }
.tj-modal-closing { pointer-events: none; animation: tj-modal-backdrop-out .23s ease-in both; }
.tj-modal-closing .tj-modal { animation: tj-modal-panel-out .23s cubic-bezier(.55,0,1,.45) both; }
.tj-modal-wide { width: min(900px, 96vw); }
.tj-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 17px 20px; border-bottom: 1px solid var(--tj-border); position: sticky; top: 0; background: var(--tj-panel); z-index: 2;}
.tj-modal-title { font-weight: 700; font-size: 1.08rem; }
.tj-modal-body { min-width: 0; padding: 18px 20px; }
.tj-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
@media (prefers-reduced-motion: reduce) {
  .tj-modal-overlay, .tj-modal, .tj-modal-closing, .tj-modal-closing .tj-modal, .tj-page-transition, .tj-view-transition, .tj-subview-transition { animation: none !important; }
  .tj-page-transition, .tj-view-transition, .tj-subview-transition { transform: none !important; clip-path: none !important; }
  .tj-page-transition *, .tj-view-transition *, .tj-subview-transition * { animation: none !important; }
}
.tj-field { margin-bottom: 12px; }
.tj-field-label { font-size: 0.8125rem; letter-spacing: 0.5px; color: var(--tj-muted); font-weight: 700; margin-bottom: 6px; }
.tj-section-label { font-size: 0.8125rem; letter-spacing: 0.5px; color: var(--tj-green); font-weight: 700; margin: 16px 0 8px; text-transform: uppercase; }
.tj-input { width: 100%; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-text); border-radius: 8px; padding: 10px 11px; font-size: 1rem; font-family: inherit; box-sizing: border-box; }
.tj-textarea { min-height: 70px; resize: vertical; }
.tj-instrument-picker { min-width: 0; }
.tj-instrument-control { position: relative; }
.tj-instrument-control .tj-input { padding-right: 32px; }
.tj-instrument-control > svg { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--tj-muted); }
.tj-instrument-options { margin-top: 5px; max-height: 160px; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-instrument-options > button { display: block; width: 100%; height: 40px; padding: 0 11px; border: 0; background: transparent; color: var(--tj-text); font: inherit; text-align: left; cursor: pointer; }
.tj-instrument-options > button:hover, .tj-instrument-options > .tj-instrument-option-focused { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-instrument-empty { padding: 10px; color: var(--tj-muted); }
.tj-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.tj-grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tj-trade-identity-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.tj-trade-identity-grid .tj-field { min-width: 0; }
.tj-trade-identity-grid .tj-input { height: 40px; min-height: 40px; padding-block: 7px; line-height: 24px; }
.tj-position-suggestion { display: grid; gap: 5px; padding: 14px 15px; margin-bottom: 14px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--tj-green) 42%, var(--tj-border)); border-radius: 12px; background: linear-gradient(120deg, color-mix(in srgb, var(--tj-green) 13%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-purple) 10%, var(--tj-panel-alt))); }
.tj-position-suggestion > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.25px; }
.tj-position-suggestion > strong { color: var(--tj-green); font-size: 1.9575rem; line-height: 1.05; font-variant-numeric: tabular-nums; }
.tj-position-suggestion > strong small { color: var(--tj-text); font-size: 1rem; }
.tj-position-suggestion > b { font-size: 0.8125rem; }
.tj-position-suggestion > em { color: var(--tj-muted); font-size: 0.75rem; font-style: normal; line-height: 1.4; }
.tj-markup-meta-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.tj-markup-pair-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tj-markup-meta-row .tj-field, .tj-markup-pair-row .tj-field { min-width: 0; }
.tj-markup-meta-row .tj-input, .tj-markup-pair-row .tj-input { height: 40px; min-height: 40px; padding-block: 7px; line-height: 24px; }
.tj-markup-session-review { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tj-border); }
.tj-markup-session-review-toggle { width: 100%; padding: 0 0 10px; border: 0; background: transparent; color: var(--tj-text); font: inherit; font-size: 0.875rem; font-weight: 700; text-align: left; cursor: pointer; }
.tj-markup-session-review-toggle span { display: inline-flex; align-items: center; gap: 5px; }
.tj-markup-session-review-toggle svg { transition: transform 0.18s ease; }
.tj-markup-session-review-body { display: grid; gap: 2px; }
.tj-markup-session-review-body .tj-field-label { font-style: italic; font-weight: 600; letter-spacing: 0; }
.tj-markup-session-review-body .tj-textarea { min-height: 66px; }
.tj-inline-add { display: flex; gap: 8px; margin-top: 8px; }
.tj-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.tj-chip { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 6px; padding: 5px 10px; font-size: 0.875rem; cursor: pointer; }
.tj-chip-active { border-color: var(--tj-green); color: var(--tj-green); background: var(--tj-primary-muted); box-shadow: 0 0 0 1px rgba(80,198,160,0.16); }
.tj-chip-big { flex: 1; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 8px; padding: 10px; font-size: 0.90625rem; font-weight: 700; cursor: pointer; }
.tj-theme-choice-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tj-theme-choice { transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
.tj-theme-choice.tj-chip-active { background: var(--tj-primary-muted); color: var(--tj-green); border-color: var(--tj-green); box-shadow: inset 3px 0 0 var(--tj-green), 0 0 0 1px rgba(80,198,160,0.22); }
.tj-theme-choice:hover { border-color: var(--tj-green); color: var(--tj-text); }
.tj-tagwrap { display: flex; flex-wrap: wrap; gap: 6px; }
.tj-tag { border-radius: 6px; padding: 5px 10px; font-size: 0.875rem; cursor: pointer; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); color: var(--tj-muted); }
.tj-tag-purple.tj-tag-active { background: rgba(139,124,246,0.18); border-color: var(--tj-purple); color: var(--tj-purple); }
.tj-tag-red.tj-tag-active { background: rgba(188,89,103,0.15); border-color: var(--tj-red); color: var(--tj-red); }
.tj-tag-xs { font-size: 0.75rem !important; padding: 2px 6px !important; margin: 1px; }
.tj-stars { display: flex; align-items: center; gap: 4px; } .tj-stars-label { color: var(--tj-muted); font-size: 0.875rem; margin-left: 8px; }
.tj-rating-readout { display: inline-flex; align-items: center; gap: 1px; letter-spacing: 1px; font-size: 1.0125rem; }
.tj-star-full, .tj-star-half { color: var(--tj-amber); } .tj-star-empty { color: var(--tj-muted); }
.tj-rating-summary { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); margin-bottom: 8px; }
.tj-rating-completion { max-width: 72%; color: var(--tj-green); font-weight: 700; font-size: 0.8125rem; line-height: 1.35; text-align: right; }
.tj-grades { display: flex; gap: 5px; align-items: center; }
.tj-grade-pip { border: 1px solid var(--tj-border); color: var(--tj-muted); background: none; border-radius: 6px; padding: 3px 8px; font-size: 0.8125rem; font-weight: 700; cursor: pointer; }
.tj-grades-sm .tj-grade-pip { padding: 1px 6px; font-size: 0.75rem; cursor: default; }

.tj-dropzone { border: 1.5px dashed var(--tj-border); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--tj-panel-alt); }
.tj-dropzone-active { border-color: var(--tj-purple); background: rgba(139,124,246,0.08); }
.tj-dropzone-text { font-size: 0.875rem; color: var(--tj-muted); }
.tj-shot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.tj-shot-thumb { position: relative; width: 100%; height: auto; aspect-ratio: 3 / 2; border-radius: 8px; overflow: hidden; border: 1px solid var(--tj-border); }
.tj-image-preview { display: block; appearance: none; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); padding: 0; border-radius: 8px; overflow: hidden; cursor: zoom-in; line-height: 0; }
.tj-image-preview-selected { border-color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 15%, var(--tj-panel-alt)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tj-green) 35%, transparent); }
.tj-image-preview img { display: block; width: 100%; height: 100%; object-fit: contain; background: var(--tj-panel-alt); }
.tj-shot-thumb .tj-image-preview { width: 100%; height: 100%; border: none; border-radius: 0; }
.tj-shot-remove { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); border: none; color: #fff; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.tj-shot-caption { position: absolute; z-index: 1; left: 5px; right: 5px; bottom: 5px; width: calc(100% - 10px); min-width: 0; border: 1px solid color-mix(in srgb, var(--tj-text) 35%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--tj-panel) 88%, transparent); color: var(--tj-text); padding: 4px 6px; font: inherit; font-size: 0.7rem; line-height: 1.2; }
.tj-shot-caption::placeholder { color: var(--tj-muted); }
.tj-shot-add { width: 100%; height: auto; aspect-ratio: 3 / 2; border-radius: 8px; border: 1px dashed var(--tj-border); display: flex; align-items: center; justify-content: center; }
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
.tj-heat-sub { font-size: 0.8125rem; color: var(--tj-muted); margin-bottom: 6px; }
.tj-heat-months { display: flex; gap: 3px; margin-bottom: 2px; }
.tj-heat-month-label { width: 11px; font-size: 0.75rem; color: var(--tj-muted); }
.tj-heat-legend { display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; color: var(--tj-muted); margin-top: 8px; flex-wrap: wrap; }
.tj-cal-record { display: flex; gap: 3px; font-size: 0.75rem; line-height: 1.25; color: var(--tj-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tj-cal-record span:first-child { color: var(--tj-green); font-weight: 700; flex-shrink: 0; }
.tj-cal-record span:last-child { overflow: hidden; text-overflow: ellipsis; }
.tj-cal-more { color: var(--tj-muted); font-size: 0.75rem; margin-top: 2px; }

/* psychology */
.tj-psychology-workspace { display: grid; gap: 14px; }
.tj-psychology-hero { min-height: 122px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px; border-radius: 17px; background: linear-gradient(110deg, color-mix(in srgb, var(--tj-purple) 10%, var(--tj-panel)), var(--tj-panel) 42%, color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel))); }
.tj-psychology-hero > div:first-child { display: grid; gap: 5px; }
.tj-psychology-hero > div:first-child > span { color: var(--tj-purple); font-size: 0.75rem; font-weight: 850; letter-spacing: 1.25px; }
.tj-psychology-hero h2 { margin: 0; font-size: 1.62rem; line-height: 1.05; letter-spacing: -.45px; }
.tj-psychology-hero p { max-width: 610px; margin: 0; color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.45; }
.tj-psychology-score { min-width: 142px; display: grid; justify-items: end; gap: 4px; padding: 14px; border: 1px solid color-mix(in srgb, var(--tj-purple) 48%, var(--tj-border)); border-radius: 14px; background: color-mix(in srgb, var(--tj-purple) 7%, var(--tj-panel-alt)); }
.tj-psychology-score small, .tj-psychology-summary small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 850; letter-spacing: .95px; }
.tj-psychology-score strong { color: var(--tj-purple); font-size: 1.8225rem; line-height: 1; }
.tj-psychology-score span, .tj-psychology-summary span { color: var(--tj-muted); font-size: 0.75rem; }
.tj-psychology-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-psychology-summary > .tj-card { min-width: 0; min-height: 79px; display: grid; align-content: center; gap: 5px; padding: 13px; border-radius: 14px; }
.tj-psychology-summary strong { overflow: hidden; font-size: 1.2825rem; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.tj-psychology-main { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .85fr); gap: 12px; }
.tj-psychology-emotions, .tj-psychology-read, .tj-psychology-mistakes { padding: 14px; border-radius: 16px; }
.tj-psychology-emotions .tj-panel-head > div, .tj-psychology-read .tj-panel-head > div, .tj-psychology-mistakes .tj-panel-head > div { display: grid; gap: 4px; }
.tj-psychology-emotions .tj-panel-head small, .tj-psychology-read .tj-panel-head small, .tj-psychology-mistakes .tj-panel-head small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 500; }
.tj-mood-list { display: flex; flex-direction: column; gap: 0; }
.tj-psychology-mood-row { padding: 10px 0; border-top: 1px solid var(--tj-border); }
.tj-psychology-mood-row:first-child { border-top: 0; }
.tj-mood-header { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.875rem; }
.tj-psychology-mood-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 5px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-psychology-mood-meta strong { font-size: 0.75rem; }
.tj-psychology-read { align-content: start; }
.tj-psychology-callout { display: grid; gap: 7px; margin: 10px 0 11px; padding: 14px; border: 1px solid color-mix(in srgb, var(--tj-purple) 34%, var(--tj-border)); border-radius: 12px; background: color-mix(in srgb, var(--tj-purple) 9%, var(--tj-panel-alt)); }
.tj-psychology-callout strong { font-size: 0.9375rem; }
.tj-psychology-callout span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }
.tj-psychology-read ol { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.tj-psychology-read li { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: start; gap: 8px; }
.tj-psychology-read li > i { width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--tj-green) 56%, var(--tj-border)); border-radius: 50%; color: var(--tj-green); font-size: 0.75rem; font-style: normal; font-weight: 800; }
.tj-psychology-read li > div { display: grid; gap: 3px; }
.tj-psychology-read li strong { font-size: 0.75rem; }
.tj-psychology-read li span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.35; }
.tj-psychology-mistake-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 9px; margin-top: 10px; }
.tj-psychology-mistake-grid > div { min-width: 0; display: grid; gap: 8px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }
.tj-psychology-mistake-grid header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tj-psychology-mistake-grid header strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-psychology-mistake-grid header span { min-width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--tj-red) 17%, var(--tj-panel-alt)); color: var(--tj-red); font-size: 0.75rem; font-weight: 800; }
.tj-psychology-mistake-grid > div > i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }
.tj-psychology-mistake-grid > div > i > b { display: block; height: 100%; min-width: 4px; border-radius: inherit; background: var(--tj-red); }
.tj-psychology-mistake-grid > div > small { color: var(--tj-muted); font-size: 0.75rem; }

/* insights */
.tj-insights-workspace { display: grid; gap: 14px; }
.tj-insights-hero { min-height: 148px; display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 20px; border-radius: 17px; background: linear-gradient(108deg, color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)), var(--tj-panel) 46%, color-mix(in srgb, var(--tj-purple) 7%, var(--tj-panel))); }
.tj-insights-hero-copy { min-width: 0; display: grid; justify-items: start; gap: 6px; }
.tj-insights-hero-copy > span { color: var(--tj-green); font-size: 0.75rem; font-weight: 850; letter-spacing: 1.25px; }
.tj-insights-hero-copy h2 { margin: 0; font-size: 2.025rem; line-height: 1; letter-spacing: -.85px; }
.tj-insights-hero-copy p { margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }
.tj-insights-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
.tj-insights-pills i { padding: 6px 9px; border: 1px solid var(--tj-border); border-radius: 999px; background: color-mix(in srgb, var(--tj-panel-alt) 82%, transparent); color: var(--tj-muted); font-size: 0.75rem; font-style: normal; font-weight: 700; }
.tj-insights-return { min-width: 150px; display: grid; justify-items: start; gap: 4px; padding: 14px; border: 1px solid color-mix(in srgb, var(--tj-green) 42%, var(--tj-border)); border-radius: 14px; background: color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel-alt)); }
.tj-insights-return small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 850; letter-spacing: .95px; }
.tj-insights-return strong { font-size: 1.755rem; line-height: 1; }
.tj-insights-return span { color: var(--tj-muted); font-size: 0.75rem; }
.tj-insights-workspace .tj-risk-insights-workspace { gap: 12px; }
.tj-insights-workspace .tj-risk-insights-summary, .tj-insights-workspace .tj-risk-growth, .tj-insights-workspace .tj-risk-recommendations { border-radius: 16px; }
.tj-ai-coach-card { display: grid; gap: 14px; padding: 17px; border-color: color-mix(in srgb, var(--tj-purple) 42%, var(--tj-border)); background: linear-gradient(112deg, color-mix(in srgb, var(--tj-purple) 9%, var(--tj-panel)), var(--tj-panel) 58%, color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel))); }
.tj-ai-coach-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }.tj-ai-coach-head > div { display: grid; gap: 5px; }.tj-ai-coach-head span { color: var(--tj-purple); font-size: .75rem; font-weight: 850; letter-spacing: 1.2px; }.tj-ai-coach-head strong { font-size: 1.125rem; }.tj-ai-coach-head p { max-width: 750px; margin: 0; color: var(--tj-muted); font-size: .8125rem; line-height: 1.5; }.tj-ai-coach-head > i { flex: 0 0 auto; padding: 5px 8px; border: 1px solid var(--tj-border); border-radius: 99px; color: var(--tj-muted); font-size: .7rem; font-style: normal; font-weight: 800; }.tj-ai-coach-head > i.tj-ai-coach-ready { border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); color: var(--tj-green); }
.tj-ai-coach-empty { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-ai-coach-empty > div { display: grid; gap: 4px; }.tj-ai-coach-empty strong { font-size: .8125rem; }.tj-ai-coach-empty span, .tj-ai-coach-message { color: var(--tj-muted); font-size: .75rem; line-height: 1.45; }.tj-ai-coach-empty .tj-btn-primary { flex: 0 0 auto; }.tj-ai-coach-message { padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--tj-amber) 38%, var(--tj-border)); border-radius: 9px; background: color-mix(in srgb, var(--tj-amber) 7%, var(--tj-panel-alt)); }.tj-ai-coach-report { display: grid; gap: 9px; padding: 13px; border: 1px solid color-mix(in srgb, var(--tj-green) 35%, var(--tj-border)); border-radius: 11px; background: var(--tj-panel-alt); }.tj-ai-coach-report-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }.tj-ai-coach-report p { margin: 0; white-space: pre-wrap; color: var(--tj-text); font-size: .8125rem; line-height: 1.55; }

/* analytics */
.tj-perf-list { display: flex; flex-direction: column; gap: 10px; }
.tj-perf-list > div { display: flex; justify-content: space-between; font-size: 0.9375rem; padding-bottom: 8px; border-bottom: 1px solid var(--tj-border); }
.tj-simple-table { width: 100%; border-collapse: collapse; font-size: 0.90625rem; }
.tj-table-wrap { overflow-x: auto; }
.tj-simple-table th { text-align: left; color: var(--tj-muted); font-weight: 600; padding: 6px 8px; font-size: 0.78125rem; letter-spacing: 0.3px; border-bottom: 1px solid var(--tj-border); }
.tj-simple-table td { padding: 7px 8px; border-bottom: 1px solid var(--tj-border); }
.tj-scatter-legend { font-size: 0.8125rem; color: var(--tj-muted); display: flex; align-items: center; gap: 4px; }
.tj-scatter-box { position: relative; height: clamp(400px, 46vw, 540px); max-width: none; margin: 8px 0 24px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-chart-bg); overflow: hidden; }
.tj-scatter-bg { position: absolute; width: 50%; height: 50%; }
.tj-scatter-bg-tl { top: 0; left: 0; background: rgba(80,198,160,0.04); border-top-left-radius: 10px; }
.tj-scatter-bg-tr { top: 0; right: 0; background: rgba(80,198,160,0.14); border-top-right-radius: 10px; }
.tj-scatter-bg-bl { bottom: 0; left: 0; background: rgba(188,89,103,0.12); border-bottom-left-radius: 10px; }
.tj-scatter-bg-br { bottom: 0; right: 0; background: rgba(188,89,103,0.03); border-bottom-right-radius: 10px; }
.tj-scatter-midline { position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed var(--tj-border); }
.tj-scatter-quad { position: absolute; font-size: 0.75rem; color: var(--tj-muted); padding: 12px; letter-spacing: 0.45px; font-weight: 700; z-index: 1; }
.tj-scatter-good { color: var(--tj-green); } .tj-scatter-bad { color: var(--tj-red); }
.tj-scatter-tl { top: 0; left: 0; } .tj-scatter-tr { top: 0; right: 0; text-align: right; }
.tj-scatter-bl { bottom: 0; left: 0; } .tj-scatter-br { bottom: 0; right: 0; text-align: right; }
.tj-scatter-axis-y-top { position: absolute; top: 46%; left: 4px; font-size: 0.75rem; color: var(--tj-muted); }
.tj-scatter-axis-y-bot { position: absolute; bottom: 4px; left: 4px; font-size: 0.75rem; color: var(--tj-muted); }
.tj-scatter-axis-x-left { position: absolute; bottom: -18px; left: 4px; font-size: 0.75rem; color: var(--tj-muted); }
.tj-scatter-axis-x-mid { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: var(--tj-muted); }
.tj-scatter-axis-x-right { position: absolute; bottom: -18px; right: 4px; font-size: 0.75rem; color: var(--tj-muted); }
.tj-scatter-dot-wrap { position: absolute; transform: translate(-50%, -50%); z-index: 2; }
.tj-scatter-dot { border: 2px solid; border-radius: 999px; display: flex; align-items: center; justify-content: center; min-width: 36px; max-width: 116px; font-size: 0.75rem; font-weight: 700; background: var(--tj-panel); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 3px 8px; cursor: pointer; transition: transform 0.15s ease; box-shadow: 0 3px 9px rgba(0,0,0,0.16); }
.tj-scatter-dot-wrap:hover .tj-scatter-dot { transform: scale(1.1); }
.tj-scatter-tooltip { position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%); background: var(--tj-tooltip-bg); border: 1px solid var(--tj-border); border-radius: 10px; padding: 10px 12px; width: 164px; box-shadow: var(--tj-shadow); opacity: 0; pointer-events: none; transition: opacity 0.15s ease; z-index: 10; }
.tj-scatter-dot-wrap:hover .tj-scatter-tooltip { opacity: 1; }
.tj-scatter-tooltip-below { bottom: auto; top: calc(100% + 10px); }
.tj-scatter-tooltip-title { font-weight: 800; font-size: 0.875rem; margin-bottom: 6px; }
.tj-scatter-tooltip-row { display: flex; justify-content: space-between; font-size: 0.78125rem; color: var(--tj-muted); margin-bottom: 3px; }
.tj-setup-tags { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.tj-setup-card { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 12px; }
.tj-setup-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tj-grade-badge { background: rgba(139,124,246,0.18); color: var(--tj-purple); font-size: 0.8125rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.tj-grade-bad { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-setup-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px; }
.tj-setup-bw { display: flex; gap: 8px; margin-bottom: 6px; }
.tj-setup-bw-box { flex: 1; border-radius: 8px; padding: 6px 8px; }
.tj-setup-bw-best { background: rgba(80,198,160,0.1); } .tj-setup-bw-worst { background: rgba(188,89,103,0.1); }
.tj-session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.tj-session-card { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 10px; padding: 12px; text-align: center; }
.tj-session-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.8125rem; }
.tj-sesspill-lg { background: rgba(139,124,246,0.15); color: var(--tj-purple); padding: 2px 8px; border-radius: 6px; font-size: 0.8125rem; font-weight: 700; }
.tj-session-pnl { font-size: 1.215rem; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
.tj-session-wl { display: flex; justify-content: center; gap: 10px; font-size: 0.8125rem; margin: 4px 0; font-weight: 700; }
.tj-day-score-row { display: flex; align-items: center; gap: 18px; }
.tj-day-score-circle { width: 84px; height: 84px; border-radius: 50%; border: 4px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
.tj-day-score-num { font-size: 1.755rem; font-weight: 800; font-family: 'Space Grotesk', sans-serif; line-height: 1; }
.tj-day-score-max { font-size: 0.75rem; color: var(--tj-muted); }
.tj-day-score-label { font-size: 1.08rem; font-weight: 700; }
.tj-day-legend { display: flex; gap: 12px; font-size: 0.8125rem; color: var(--tj-muted); margin-top: 6px; }
.tj-day-dist { display: flex; height: 8px; border-radius: 6px; overflow: hidden; margin-top: 6px; }
.tj-day-quad-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
.tj-day-quad-stats > div { background: var(--tj-panel-alt); border-radius: 8px; padding: 10px; text-align: center; }
.tj-day-bestworst { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.tj-day-bw-box { border-radius: 8px; padding: 12px; }
.tj-day-bw-best { background: rgba(80,198,160,0.1); } .tj-day-bw-worst { background: rgba(188,89,103,0.1); }
.tj-last6-track { display: flex; gap: 3px; height: 34px; margin-top: 8px; align-items: stretch; }
.tj-last6-bar { border-radius: 4px; }
.tj-last6-dates { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--tj-muted); margin-top: 4px; }
.tj-last6-legend { display: flex; gap: 14px; font-size: 0.8125rem; color: var(--tj-muted); margin-top: 8px; }
.tj-instrument-table td { vertical-align: middle; }
.tj-inline-bar { display: flex; align-items: center; gap: 8px; }
.tj-combo-result { margin-top: 12px; font-size: 0.9375rem; background: var(--tj-panel-alt); border-radius: 8px; padding: 10px; }

/* news */
.tj-news-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.tj-news-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tj-tz-pill { font-size: 0.8125rem; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-purple); padding: 3px 10px; border-radius: 20px; }
.tj-news-tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; border-bottom: 1px solid var(--tj-border); padding-bottom: 12px; }
.tj-newstab { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); color: var(--tj-muted); border-radius: 8px; padding: 6px 12px; font-size: 0.875rem; cursor: pointer; font-family: inherit; font-weight: 600; }
.tj-newstab-active { background: rgba(188,89,103,0.12); color: var(--tj-red); border-color: rgba(188,89,103,0.4); }
.tj-news-weeknav { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.tj-news-infobar { display: flex; justify-content: space-between; align-items: center; background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 8px; padding: 8px 12px; font-size: 0.875rem; margin-bottom: 12px; flex-wrap: wrap; gap: 6px; }
.tj-openff { color: var(--tj-green); text-decoration: none; font-weight: 700; font-size: 0.875rem; }
.tj-openff:hover { text-decoration: underline; }
.tj-news-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.tj-news-stats > div { background: var(--tj-panel-alt); border: 1px solid var(--tj-border); border-radius: 8px; padding: 10px; text-align: center; }
.tj-holiday-list { display: flex; flex-direction: column; gap: 10px; }
.tj-holiday-row { display: flex; align-items: center; gap: 10px; font-size: 0.9375rem; padding: 8px 0; border-bottom: 1px solid var(--tj-border); }
.tj-news-filters { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.tj-news-day-block { margin-bottom: 16px; }
.tj-news-day-label { font-weight: 700; font-size: 0.90625rem; color: var(--tj-purple); margin-bottom: 6px; }
.tj-impact-chip { border: 1px solid var(--tj-border); background: var(--tj-panel-alt); color: var(--tj-muted); border-radius: 6px; padding: 4px 10px; font-size: 0.8125rem; cursor: pointer; }
.tj-impact-high.tj-impact-on { background: rgba(188,89,103,0.15); color: var(--tj-red); border-color: var(--tj-red); }
.tj-impact-medium.tj-impact-on { background: rgba(251,191,36,0.15); color: var(--tj-amber); border-color: var(--tj-amber); }
.tj-impact-low.tj-impact-on { background: var(--tj-primary-muted); color: var(--tj-green); border-color: var(--tj-green); }
.tj-impact-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tj-impact-dot-high { background: var(--tj-red); } .tj-impact-dot-medium { background: var(--tj-amber); } .tj-impact-dot-low { background: var(--tj-green); } .tj-impact-dot-holiday { background: var(--tj-blue); }
.tj-news-day-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.tj-news-day-title { font-weight: 700; font-size: 0.90625rem; color: var(--tj-text); letter-spacing: 0.3px; }
.tj-daytag { font-size: 0.75rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; }
.tj-daytag-today { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-daytag-past { background: var(--tj-panel-alt); color: var(--tj-muted); }
.tj-news-day-count { margin-left: auto; font-size: 0.8125rem; color: var(--tj-muted); }
.tj-event-list { display: flex; flex-direction: column; }
.tj-event-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--tj-border); }
.tj-event-time { width: 66px; flex-shrink: 0; font-size: 0.875rem; color: var(--tj-muted); }
.tj-event-main { flex: 1; min-width: 0; }
.tj-event-title { font-size: 0.9375rem; font-weight: 500; }
.tj-event-sub { font-size: 0.8125rem; color: var(--tj-muted); margin-top: 2px; }
.tj-impactpill { font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; flex-shrink: 0; }
.tj-impactpill-high { background: rgba(188,89,103,0.15); color: var(--tj-red); }
.tj-impactpill-medium { background: rgba(251,191,36,0.15); color: var(--tj-amber); }
.tj-impactpill-low { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-impactpill-holiday { background: rgba(96,165,250,0.15); color: var(--tj-blue); }

/* rules */
.tj-rules-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.tj-tabs { display: flex; gap: 4px; background: var(--tj-panel-alt); border-radius: 8px; padding: 3px; }
.tj-tab { background: none; border: none; color: var(--tj-muted); padding: 6px 12px; border-radius: 6px; font-size: 0.875rem; cursor: pointer; font-family: inherit; }
.tj-tab-active { background: var(--tj-panel); color: var(--tj-text); }
.tj-rule-list { display: flex; flex-direction: column; gap: 8px; }
.tj-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--tj-panel-alt); border-radius: 8px; font-size: 0.9375rem; justify-content: space-between; }
.tj-rule-actions { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.tj-rule-done { text-decoration: line-through; color: var(--tj-muted); }
.tj-history-list { display: flex; flex-direction: column; gap: 8px; }
.tj-history-row { display: flex; align-items: center; font-size: 0.90625rem; }

/* AAICOREFX workspace surfaces use the shared tokens above, so the same
   hierarchy carries cleanly through Light and Dark mode. */
.tj-panel, .tj-tlog-card, .tj-management-grid > .tj-panel { box-shadow: 0 10px 24px rgba(1,10,20,.07); }
.tj-panel { background: linear-gradient(150deg, color-mix(in srgb, var(--tj-panel) 98%, transparent), color-mix(in srgb, var(--tj-panel-alt) 46%, var(--tj-panel) 54%)); }
.tj-page-intro { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 4px 2px 15px; margin-bottom: 2px; border-bottom: 1px solid var(--tj-border); }
.tj-management-workspace { display: grid; gap: 14px; }.tj-management-workspace .tj-page-intro { margin: 0; padding: 1px 0 14px; }.tj-management-rules-note { padding: 4px 8px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.tj-management-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 14px; }
.tj-management-grid > .tj-panel { min-width: 0; min-height: 410px; position: relative; overflow: hidden; }
.tj-management-grid > .tj-panel::before { content: ""; display: block; width: 30px; height: 3px; border-radius: 99px; background: var(--tj-green); margin-bottom: 12px; }
.tj-management-grid .tj-inline-add { margin-top: 0; }.tj-management-grid .tj-inline-add .tj-btn-primary { padding-inline: 13px; }.tj-management-grid .tj-rule-list, .tj-management-list { display: grid; gap: 7px; max-height: 430px; margin-top: 12px; overflow-x: hidden; overflow-y: auto; padding-right: 3px; }.tj-management-grid .tj-rule-row { min-height: 42px; align-items: flex-start; padding: 10px 11px; font-size: 0.875rem; }.tj-management-grid .tj-rule-row > span:first-child { min-width: 0; overflow: visible; line-height: 1.38; overflow-wrap: anywhere; text-overflow: clip; white-space: normal; }.tj-management-grid .tj-rule-row > span:last-child { align-self: center; }.tj-management-row-actions { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }.tj-management-default { padding: 3px 6px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 0.75rem; font-style: normal; font-weight: 800; letter-spacing: .35px; }
.tj-toolbar { background: color-mix(in srgb, var(--tj-panel) 94%, transparent); box-shadow: 0 8px 20px rgba(1,10,20,.05); }
.tj-toolbar-search, .tj-toolbar-dd, .tj-toolbar-pill { background: color-mix(in srgb, var(--tj-input-bg) 94%, transparent); }
.tj-tlog-card { border-radius: 10px; background: var(--tj-panel); }
/* Keep clipped journal surfaces opaque and their borders unanimated. Chrome can
   leave broad border-colored paint bands when these rounded layers transition. */
.tj-root .tj-tlog-card, .tj-root .tj-tlog-card:hover {
  background: var(--tj-panel) !important;
  background-image: none !important;
  transition: none !important;
  box-shadow: none !important;
  animation: none !important;
  isolation: isolate;
}
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row) {
  background: var(--tj-panel) !important;
  background-image: none !important;
  transition: none !important;
  translate: none !important;
}
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row):hover { background: var(--tj-panel-alt) !important; }
/* A non-interactive overlay restores mouse lighting without repainting borders
   or changing hit areas. It follows the whole row, including nested buttons. */
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row) { position: relative; isolation: isolate; }
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row).tj-pointer-lit { box-shadow: none; }
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row)::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; z-index: 0; opacity: 0;
  background: radial-gradient(240px circle at var(--pointer-x, 50%) var(--pointer-y, 50%), color-mix(in srgb, var(--tj-green) 18%, transparent), transparent 78%);
  transition: opacity .18s ease;
}
.tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row) > * { position: relative; z-index: 1; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .tj-root .tj-tlog-card :is(.tj-tlog-row, .tj-reference-markup-row).tj-pointer-lit::after { opacity: 1; }
}
.tj-root :is(.tj-tlog-card, .tj-reference-markup-card, .tj-reference-tradelog-row),
.tj-root :is(.tj-tlog-card, .tj-reference-markup-card, .tj-reference-tradelog-row):hover { transform: none; translate: none; }
.tj-root :is(.tj-tlog-card, .tj-reference-markup-card, .tj-reference-tradelog-row) .tj-tlog-row:hover { background: transparent; }
.tj-tlog-row { min-height: 58px; }
.tj-tlog-date { font-variant-numeric: tabular-nums; }
.tj-tradelog-stats > .tj-card, .tj-stat { position: relative; overflow: hidden; }
.tj-tradelog-stats > .tj-card::before, .tj-stat::before { content: ""; position: absolute; top: 0; left: 0; width: 26px; height: 2px; border-radius: 0 0 99px 0; background: var(--tj-green); opacity: .8; }
.tj-tlog-expand { background: color-mix(in srgb, var(--tj-panel-alt) 78%, transparent); }
.tj-markup-image-section, .tj-setup-card, .tj-session-card { background: color-mix(in srgb, var(--tj-panel-alt) 72%, var(--tj-panel) 28%); }
.tj-cal-cell { transition: border-color .16s ease, background .16s ease, transform .16s cubic-bezier(.2,.8,.2,1); }
.tj-cal-cell:hover { border-color: color-mix(in srgb, var(--tj-border) 55%, var(--tj-green) 45%); }
.tj-markup-status { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 7px; border: 1px solid var(--tj-border); font-size: 0.75rem; font-weight: 800; letter-spacing: .35px; text-transform: uppercase; vertical-align: 1px; }.tj-markup-status-planned { color: var(--tj-blue); background: color-mix(in srgb, var(--tj-blue) 12%, transparent); border-color: color-mix(in srgb, var(--tj-blue) 42%, var(--tj-border)); }.tj-markup-status-watching { color: var(--tj-amber); background: color-mix(in srgb, var(--tj-amber) 12%, transparent); border-color: color-mix(in srgb, var(--tj-amber) 42%, var(--tj-border)); }.tj-markup-status-executed { color: var(--tj-green); background: var(--tj-primary-muted); border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); }.tj-markup-status-passed { color: var(--tj-muted); background: var(--tj-panel-alt); }
.tj-reference-markups { display: grid; gap: 14px; }.tj-markup-overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }.tj-markup-overview-card { min-height: 136px; padding: 14px; display: grid; align-content: start; gap: 5px; }.tj-markup-overview-card strong { font-size: 1.485rem; font-variant-numeric: tabular-nums; }.tj-markup-overview-card span { color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.35; }.tj-markup-overview-card > small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: .45px; text-transform: uppercase; }.tj-markup-progress, .tj-markup-split { height: 6px; overflow: hidden; display: flex; border-radius: 99px; background: var(--tj-panel-alt); margin-top: 4px; }.tj-markup-progress i, .tj-markup-split i, .tj-markup-split b { display: block; height: 100%; transition: width .2s ease; }.tj-markup-progress i, .tj-markup-split i { background: var(--tj-green); }.tj-markup-split b { background: var(--tj-red); opacity: .82; }.tj-markup-bestworst { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 2px; }.tj-markup-bestworst > div { min-width: 0; padding: 7px 8px; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); border-radius: 7px; display: grid; gap: 2px; }.tj-markup-bestworst small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }.tj-markup-bestworst b { font-size: 0.875rem; font-variant-numeric: tabular-nums; white-space: nowrap; }.tj-markup-coverage { display: grid; gap: 5px; margin-top: 3px; }.tj-markup-coverage > div { display: grid; grid-template-columns: 30px minmax(0, 1fr) 27px; gap: 6px; align-items: center; }.tj-markup-coverage small, .tj-markup-coverage em { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; font-style: normal; text-transform: uppercase; }.tj-markup-coverage em { text-align: right; font-variant-numeric: tabular-nums; }.tj-markup-coverage i { display: block; height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-markup-coverage b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-markup-coverage > div:nth-child(2) b { opacity: .78; }.tj-markup-coverage > div:nth-child(3) b { opacity: .58; }.tj-markup-toolbar { display: grid; grid-template-columns: 1fr auto; gap: 9px; align-items: center; min-height: 32px; }.tj-markup-toolbar-actions { display: flex; gap: 8px; }.tj-markup-toolbar-button { width: 32px; height: 32px; border-radius: 50%; }.tj-icon-btn-active { color: var(--tj-green); border-color: color-mix(in srgb, var(--tj-green) 55%, var(--tj-border)); background: var(--tj-primary-muted); }.tj-markup-toolbar-status { display: flex; gap: 10px; align-items: center; color: var(--tj-muted); font-size: 0.75rem; }.tj-markup-toolbar-status b { color: var(--tj-green); font-size: 0.75rem; }.tj-markup-filter-controls, .tj-markup-sort-controls { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: color-mix(in srgb, var(--tj-panel-alt) 84%, transparent); }.tj-markup-filter-controls .tj-toolbar-search { flex: 1; }.tj-markup-sort-controls { justify-content: flex-start; }.tj-markup-sort-controls > span { color: var(--tj-muted); font-size: 0.8125rem; }.tj-reference-markup-card .tj-tlog-row { min-height: 62px; cursor: pointer; }.tj-reference-markup-card .tj-tlog-main { min-width: 270px; }.tj-markup-pnl { display: grid; gap: 2px; min-width: 105px; text-align: right; }.tj-markup-pnl strong { font-variant-numeric: tabular-nums; }.tj-markup-pnl span { color: var(--tj-muted); font-size: 0.75rem; }.tj-markup-detail-top { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-bottom: 16px; }.tj-markup-detail-top > div { padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); display: grid; gap: 4px; }.tj-linked-markup-trades { display: grid; gap: 7px; }.tj-linked-markup-trade { display: flex; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-linked-markup-trade > div { display: grid; gap: 3px; }.tj-linked-markup-trade span { font-size: 0.8125rem; color: var(--tj-muted); }.tj-linked-markup-trade > div:last-child { text-align: right; justify-items: end; }

/* Reference Markups list and expanded workspace. */
.tj-markup-toolbar { position: relative; z-index: 8; }
.tj-markup-filter-popover { position: absolute; top: 42px; left: 0; z-index: 20; width: min(390px, calc(100vw - 32px)); padding: 13px; border: 1px solid var(--tj-border); border-radius: 12px; background: color-mix(in srgb, var(--tj-panel) 96%, transparent); box-shadow: 0 18px 44px rgba(0,0,0,.32); }
.tj-markup-filter-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.tj-markup-filter-head > div { display: grid; gap: 3px; }
.tj-markup-filter-head strong { font-size: 0.9375rem; }
.tj-markup-filter-head span, .tj-markup-filter-summary { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }
.tj-markup-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 9px; }
.tj-markup-filter-grid .tj-field { margin-bottom: 8px; }
.tj-markup-filter-grid .tj-field:last-child { grid-column: 1 / -1; }
.tj-markup-filter-grid .tj-toolbar-dd { width: 100%; min-width: 0; height: 30px; }
.tj-markup-filter-grid select:disabled { opacity: .6; cursor: not-allowed; }
.tj-markup-filter-summary { padding-top: 9px; border-top: 1px solid var(--tj-border); }
.tj-reference-markup-card { overflow: hidden; border-radius: 14px; }
.tj-reference-markup-expanded { border-color: color-mix(in srgb, var(--tj-green) 67%, var(--tj-border)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tj-green) 13%, transparent); }
.tj-reference-markup-row { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 13px; cursor: pointer; }
.tj-reference-markup-identity { min-width: 0; display: grid; gap: 4px; }
.tj-reference-markup-identity > div { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tj-reference-markup-identity > div > strong { font-size: 0.9375rem; }
.tj-reference-markup-identity > div > span:not(.tj-markup-status) { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; }
.tj-reference-markup-identity small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-markup-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; }
.tj-markup-trade-button, .tj-markup-round-button { min-height: 30px; border: 1px solid var(--tj-border); background: color-mix(in srgb, var(--tj-panel-alt) 88%, transparent); color: var(--tj-muted); cursor: pointer; }
.tj-markup-trade-button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 12px; border-radius: 999px; border-color: color-mix(in srgb, var(--tj-green) 55%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel-alt)); color: var(--tj-green); font: inherit; font-size: 0.8125rem; font-weight: 800; }
.tj-markup-round-button { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 999px; }
.tj-markup-round-button:hover { border-color: var(--tj-green); color: var(--tj-text); }
.tj-markup-delete-button, .tj-icon-btn[title^="Delete"], .tj-icon-btn[title^="Remove"] { border: 1px solid color-mix(in srgb, var(--tj-red) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 10%, var(--tj-panel-alt)); color: var(--tj-red); }
.tj-markup-delete-button:hover, .tj-icon-btn[title^="Delete"]:hover, .tj-icon-btn[title^="Remove"]:hover { border-color: var(--tj-red); background: color-mix(in srgb, var(--tj-red) 17%, var(--tj-panel-alt)); color: var(--tj-red); }
.tj-reference-markup-detail { padding: 12px; border-top: 1px solid var(--tj-border); background: color-mix(in srgb, var(--tj-panel-alt) 48%, var(--tj-panel)); }
.tj-markup-detail-top { margin-bottom: 10px; }
.tj-markup-detail-top > div { min-height: 58px; align-content: center; border-radius: 10px; }
.tj-markup-detail-top strong { font-size: 1.08rem; }
.tj-markup-expanded-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tj-markup-plan-card, .tj-markup-linked-card, .tj-markup-charts-card { min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); }
.tj-markup-plan-card, .tj-markup-linked-card { min-height: 190px; }
.tj-markup-detail-heading { min-height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-markup-detail-heading > div { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.tj-markup-detail-heading em { padding: 2px 5px; border-radius: 4px; background: var(--tj-panel-alt); color: var(--tj-muted); font-size: 0.75rem; font-style: normal; }
.tj-markup-detail-heading small { font-size: 0.75rem; }
.tj-markup-plan-rows { display: grid; margin-top: 5px; }
.tj-markup-plan-rows > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid var(--tj-border); }
.tj-markup-plan-rows span { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .55px; }
.tj-markup-plan-rows strong { font-size: 0.8125rem; line-height: 1.35; }
.tj-markup-panel-empty, .tj-markup-chart-empty { color: var(--tj-muted); font-size: 0.8125rem; }
.tj-markup-panel-empty { display: grid; place-items: center; min-height: 130px; }
.tj-linked-markup-trades { margin-top: 5px; padding-right: 2px; }
.tj-linked-markup-trades-scroll { max-height: 236px; overflow-y: auto; scrollbar-gutter: stable; }
.tj-linked-markup-trade { min-height: 50px; padding: 8px; }
.tj-linked-markup-trade strong { font-size: 0.8125rem; }
.tj-linked-markup-trade span { font-size: 0.75rem; }
.tj-markup-charts-card { margin-top: 10px; }
.tj-markup-charts-head, .tj-markup-chart-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tj-markup-charts-head { margin-bottom: 7px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-markup-charts-head span { display: flex; justify-content: space-between; gap: 8px; }
.tj-markup-charts-head small { font-size: 0.75rem; }
.tj-markup-chart-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 7px; }
.tj-markup-chart-card { min-height: 54px; display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); color: var(--tj-text); text-align: left; cursor: zoom-in; }
.tj-markup-chart-card img { width: 52px; height: 38px; flex: 0 0 52px; object-fit: contain; border-radius: 6px; background: var(--tj-panel); }
.tj-markup-chart-card strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-markup-chart-card small { color: var(--tj-muted); font-size: 0.65rem; white-space: nowrap; }
.tj-markup-chart-card:hover, .tj-markup-chart-card-selected { border-color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 15%, var(--tj-panel-alt)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tj-green) 20%, transparent); }
.tj-markup-chart-empty { min-height: 54px; display: flex; align-items: center; padding: 8px 0; }

/* Account control center */
.tj-settings-summary { display: grid; gap: 5px; padding: 12px 14px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-primary-muted); color: var(--tj-muted); font-size: 0.875rem; line-height: 1.45; margin-bottom: 12px; }
.tj-settings-summary-kicker { color: var(--tj-green); font-weight: 800; font-size: 0.75rem; letter-spacing: .9px; }
.tj-settings-account-hero { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 15px; padding: 17px; margin-bottom: 15px; border: 1px solid color-mix(in srgb, var(--tj-green) 28%, var(--tj-border)); border-radius: 22px; background: linear-gradient(130deg, color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-blue) 5%, var(--tj-panel-alt)) 78%); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--tj-text) 3%, transparent); }
.tj-settings-account-hero.tj-settings-account-hero-no-avatar { grid-template-columns: minmax(0, 1fr); gap: 12px; }
.tj-settings-account-hero-no-avatar .tj-settings-hero-copy { padding: 2px 1px 4px; }
.tj-settings-hero-avatar { grid-row: span 2; width: 74px; height: 74px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--tj-green) 24%, var(--tj-border)); border-radius: 22px; background: color-mix(in srgb, var(--tj-input-bg) 90%, transparent); color: var(--tj-text); font-size: 1.89rem; cursor: pointer; }.tj-settings-hero-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }.tj-settings-hero-copy { display: grid; align-content: center; gap: 5px; }.tj-settings-hero-copy > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.1px; }.tj-settings-hero-copy strong { font-size: 1.5525rem; letter-spacing: -.4px; }.tj-settings-hero-copy p { max-width: 560px; margin: 0; color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.42; }
.tj-settings-hero-metrics { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }.tj-settings-hero-metrics > div { display: grid; align-content: center; gap: 4px; min-width: 0; min-height: 82px; padding: 11px 12px; border: 1px solid var(--tj-border); border-radius: 15px; background: color-mix(in srgb, var(--tj-panel) 87%, transparent); }.tj-settings-hero-metrics small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .7px; }.tj-settings-hero-metrics b { overflow: hidden; font-size: 1.1475rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-settings-hero-metrics span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.25; }.tj-settings-hero-metrics .tj-settings-balance-tile { border-color: color-mix(in srgb, var(--tj-blue) 24%, var(--tj-border)); background: color-mix(in srgb, var(--tj-blue) 4%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-month-goal { border-color: color-mix(in srgb, var(--tj-green) 31%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-year-goal { border-color: color-mix(in srgb, var(--tj-purple) 34%, var(--tj-border)); background: color-mix(in srgb, var(--tj-purple) 6%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-daily-loss, .tj-settings-hero-metrics .tj-settings-month-loss { border-color: color-mix(in srgb, var(--tj-red) 31%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 6%, var(--tj-panel)); }.tj-settings-hero-metrics .tj-settings-goal-on b { color: var(--tj-text); }.tj-settings-hero-metrics .tj-settings-risk-on b { color: var(--tj-text); }
.tj-settings-section { border: 1px solid color-mix(in srgb, var(--tj-border) 78%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--tj-panel-alt) 88%, transparent); margin: 12px 0; overflow: hidden; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--tj-text) 2%, transparent); }
.tj-settings-section-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: none; background: none; color: var(--tj-text); padding: 15px 16px; text-align: left; cursor: pointer; font: inherit; }.tj-settings-section-head:hover { background: color-mix(in srgb, var(--tj-panel) 42%, transparent); }
.tj-settings-section-title { min-width: 0; display: flex; align-items: center; gap: 11px; }.tj-settings-section-title > i { width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--tj-border) 78%, transparent); border-radius: 11px; color: var(--tj-muted); font-style: normal; }.tj-settings-section-title > span { min-width: 0; display: grid; gap: 3px; }.tj-settings-section-head small { color: var(--tj-muted); font-size: 0.8125rem; font-weight: 400; }.tj-settings-section-head svg { transition: transform .16s ease; color: var(--tj-muted); }.tj-settings-section-end { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; }.tj-settings-section-end em { max-width: 140px; overflow: hidden; padding: 4px 9px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 0.75rem; font-style: normal; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.tj-settings-section-body { border-top: 1px solid color-mix(in srgb, var(--tj-border) 72%, transparent); padding: 16px; }.tj-settings-section-body .tj-field:last-child { margin-bottom: 0; }.tj-settings-hint { font-size: 0.8125rem; line-height: 1.4; margin-top: 5px; }.tj-settings-off-note { margin-top: 4px; color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.4; }
.tj-settings-info-grid, .tj-settings-reset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 10px; }
.tj-settings-info-grid > div, .tj-settings-reset-grid > div, .tj-settings-info-block { min-width: 0; display: grid; gap: 5px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: color-mix(in srgb, var(--tj-purple) 7%, var(--tj-panel)); }
.tj-settings-reset-grid > div { background: var(--tj-panel); }.tj-settings-info-grid small, .tj-settings-reset-grid small, .tj-settings-info-block small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .85px; }.tj-settings-info-grid span, .tj-settings-reset-grid span, .tj-settings-info-block span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-settings-reset-grid strong { font-size: 0.875rem; }.tj-settings-info-block { margin-top: 10px; }
.tj-settings-switch-row { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; cursor: pointer; }.tj-settings-switch-row > span { display: grid; gap: 3px; }.tj-settings-switch-row strong { font-size: 0.8125rem; }.tj-settings-switch-row small { color: var(--tj-muted); font-size: 0.75rem; }.tj-settings-switch { position: relative; width: 38px; height: 22px; flex: 0 0 38px; padding: 0; border: 1px solid var(--tj-border); border-radius: 99px; background: var(--tj-panel); cursor: pointer; }.tj-settings-switch i { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--tj-muted); transition: transform .16s ease, background .16s ease; }.tj-settings-switch-on { border-color: color-mix(in srgb, var(--tj-green) 55%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 17%, var(--tj-panel)); }.tj-settings-switch-on i { background: var(--tj-green); transform: translateX(16px); }.tj-settings-section-body input:disabled, .tj-settings-section-body select:disabled { opacity: .46; cursor: not-allowed; }
.tj-settings-section-danger { border-color: color-mix(in srgb, var(--tj-red) 48%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 5%, var(--tj-panel-alt)); }.tj-settings-section-danger .tj-settings-section-head strong, .tj-settings-section-danger .tj-settings-section-title > i { color: var(--tj-red); }.tj-settings-section-danger .tj-settings-section-title > i { border-color: color-mix(in srgb, var(--tj-red) 36%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, transparent); }.tj-settings-danger-action { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 14px; border: 1px solid color-mix(in srgb, var(--tj-red) 46%, var(--tj-border)); border-radius: 15px; background: color-mix(in srgb, var(--tj-red) 8%, var(--tj-panel)); }.tj-settings-danger-action > span { display: grid; gap: 4px; }.tj-settings-danger-action strong { color: var(--tj-red); font-size: 0.875rem; }.tj-settings-danger-action small { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-btn-danger-outline { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; padding: 9px 13px; border: 1px solid color-mix(in srgb, var(--tj-red) 58%, var(--tj-border)); border-radius: 99px; background: color-mix(in srgb, var(--tj-red) 4%, transparent); color: var(--tj-red); font: inherit; font-size: 0.8125rem; font-weight: 750; cursor: pointer; }.tj-btn-danger-outline:hover { background: color-mix(in srgb, var(--tj-red) 13%, transparent); }

/* Shared card and overflow guardrails. */
.tj-content > *, .tj-modal-body > *, .tj-card, .tj-panel, .tj-topbar-left, .tj-page-intro > *, .tj-settings-section-title > span { min-width: 0; }
.tj-page-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tj-stats-grid > *, .tj-tradelog-stats > *, .tj-markup-overview-grid > *, .tj-review-month-grid > *, .tj-review-quarter-grid > *, .tj-period-metric-grid > *, .tj-period-meter-grid > *, .tj-performance-stat-grid > *, .tj-live-analytics-grid > *, .tj-management-grid > * { min-width: 0; align-self: stretch; }
.tj-settings-hero-metrics > div, .tj-markup-overview-grid > *, .tj-review-library-card, .tj-performance-stat-card { height: 100%; }
.tj-theme-nav { width: 38px; min-height: 38px; justify-content: center; margin: 7px 0 0 4px; padding: 0; border: none; border-radius: 10px; background: transparent; box-shadow: none; }.tj-theme-nav svg { flex: 0 0 auto; color: var(--tj-green); }.tj-theme-nav:hover { background: transparent; color: var(--tj-green); box-shadow: none; }.tj-theme-nav:hover svg { filter: brightness(1.15); }
.tj-profile-row { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--tj-border); }.tj-profile-preview { width: 58px; height: 58px; padding: 0; flex: 0 0 58px; overflow: hidden; border: 1px solid var(--tj-border); border-radius: 50%; background: var(--tj-panel); color: var(--tj-text); font-size: 1.5525rem; cursor: pointer; }.tj-profile-preview img { width: 100%; height: 100%; display: block; object-fit: cover; }.tj-profile-actions { display: grid; gap: 8px; }.tj-btn-small { font-size: 0.8125rem; min-height: 28px; padding: 5px 9px; }
.tj-theme-choice { min-height: 62px; display: grid; align-content: center; gap: 3px; text-align: left; }.tj-theme-choice span { font-size: 0.9375rem; }.tj-theme-choice small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 500; }.tj-theme-choice.tj-chip-active small { color: color-mix(in srgb, var(--tj-green) 76%, var(--tj-muted)); }
.tj-personal-profile-card, .tj-personal-appearance-card { overflow: hidden; margin-bottom: 12px; padding: 16px; border: 1px solid var(--tj-border); border-radius: 14px; background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel-alt)), var(--tj-panel-alt) 72%); }
.tj-personal-profile-heading, .tj-personal-section-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }.tj-personal-profile-heading > div, .tj-personal-section-title > div { display: grid; gap: 4px; }.tj-personal-profile-heading > div > span { color: var(--tj-green); font-size: 0.75rem; font-weight: 850; letter-spacing: 1px; }.tj-personal-profile-heading strong { font-size: 1.35rem; }.tj-personal-profile-heading p, .tj-personal-section-title span { margin: 0; color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.4; }.tj-personal-profile-heading > em, .tj-personal-section-title > em { max-width: 250px; overflow: hidden; padding: 4px 9px; border: 1px solid var(--tj-border); border-radius: 999px; color: var(--tj-muted); font-size: 0.75rem; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.tj-personal-profile-photo-row { display: flex; align-items: center; gap: 14px; margin: 18px 0; padding: 15px; border: 1px dashed color-mix(in srgb, var(--tj-green) 38%, var(--tj-border)); border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel)); }.tj-personal-profile-avatar { position: relative; width: 78px; height: 78px; flex: 0 0 78px; padding: 0; border: 1px solid color-mix(in srgb, var(--tj-green) 50%, var(--tj-border)); border-radius: 50%; background: var(--tj-green); color: white; font: inherit; font-size: 1.5525rem; font-weight: 800; cursor: pointer; }.tj-personal-profile-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: inherit; }.tj-personal-profile-avatar i { position: absolute; right: -2px; bottom: 0; display: grid; place-items: center; width: 25px; height: 25px; border: 2px solid var(--tj-panel-alt); border-radius: 50%; background: var(--tj-green); color: white; }.tj-personal-profile-photo-row > div { display: grid; gap: 4px; min-width: 0; }.tj-personal-profile-photo-row > div > strong { font-size: 1.08rem; }.tj-personal-profile-photo-row > div > span { overflow: hidden; color: var(--tj-muted); font-size: 0.8125rem; text-overflow: ellipsis; }.tj-personal-profile-photo-row .tj-chip-row { margin-top: 5px; }
.tj-personal-profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.tj-personal-profile-fields .tj-field { margin-bottom: 0; }.tj-personal-profile-fields input:read-only { color: var(--tj-muted); background: color-mix(in srgb, var(--tj-input-bg) 72%, var(--tj-panel)); cursor: not-allowed; }
.tj-password-link { width: fit-content; margin-top: 7px; padding: 0; border: 0; background: transparent; color: var(--tj-green); font: inherit; font-size: 0.75rem; font-weight: 750; cursor: pointer; }.tj-password-link:hover { text-decoration: underline; }.tj-password-editor { display: grid; gap: 7px; margin-top: 8px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel); }.tj-password-editor > span { font-size: 0.75rem; line-height: 1.35; }.tj-password-editor .tj-btn-small { justify-self: start; }
.tj-personal-section-title { margin-bottom: 13px; }.tj-personal-section-title strong { font-size: 1.0125rem; }.tj-personal-appearance-card .tj-theme-choice { padding: 12px 14px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); color: var(--tj-text); font-family: inherit; cursor: pointer; }
.tj-avatar { overflow: hidden; }.tj-avatar img, .tj-avatar-sm img { width: 100%; height: 100%; object-fit: cover; display: block; }.tj-avatar-sm { overflow: hidden; }
.tj-btn-disabled { opacity: .58; cursor: not-allowed; filter: saturate(.35); }

/* Dashboard inspired by the referenced workflow, with AAICOREFX data. */
.tj-reference-dashboard { display: grid; gap: 14px; }.tj-guardrails { position: relative; overflow: hidden; padding: 16px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel)), var(--tj-panel) 56%, color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel))); }.tj-guardrails::after { content: ""; position: absolute; right: -8%; bottom: -80px; width: 46%; height: 105px; background: color-mix(in srgb, var(--tj-green) 10%, transparent); transform: rotate(-8deg); pointer-events: none; }.tj-guardrails-head { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }.tj-guardrails-head > div { display: grid; gap: 4px; }.tj-guardrails-head > div > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.15px; }.tj-guardrails-head strong { font-size: 1.08rem; }.tj-guardrails-head p { max-width: 620px; margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }.tj-guardrail-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }.tj-guardrail-metric { position: relative; min-width: 0; min-height: 184px; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; padding: 13px; border: 1px solid color-mix(in srgb, var(--tj-green) 30%, var(--tj-border)); border-radius: 18px; background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel-alt)), var(--tj-panel-alt) 64%); }.tj-guardrail-metric::before { content: ""; position: absolute; top: -24px; right: 18%; width: 46%; height: 95px; background: color-mix(in srgb, var(--tj-green) 15%, transparent); transform: rotate(-7deg); pointer-events: none; }.tj-guardrail-blue { border-color: color-mix(in srgb, var(--tj-blue) 34%, var(--tj-border)); background: linear-gradient(145deg, color-mix(in srgb, var(--tj-blue) 9%, var(--tj-panel-alt)), var(--tj-panel-alt) 64%); }.tj-guardrail-blue::before { background: color-mix(in srgb, var(--tj-blue) 17%, transparent); }.tj-guardrail-hit { border-color: color-mix(in srgb, var(--tj-red) 72%, var(--tj-border)); background: linear-gradient(145deg, color-mix(in srgb, var(--tj-red) 12%, var(--tj-panel-alt)), var(--tj-panel-alt) 64%); }.tj-guardrail-card-main { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 88px; align-items: start; gap: 8px; }.tj-guardrail-copy { min-width: 0; }.tj-guardrail-value { margin: 5px 0 7px; overflow: hidden; font-size: 1.215rem; font-weight: 850; font-variant-numeric: tabular-nums; letter-spacing: -.45px; text-overflow: ellipsis; white-space: nowrap; }.tj-guardrail-value span { color: var(--tj-text); font-weight: 800; white-space: nowrap; }.tj-guardrail-status { display: inline-flex; width: fit-content; padding: 4px 8px; border: 1px solid color-mix(in srgb, var(--tj-green) 34%, var(--tj-border)); border-radius: 99px; background: color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel)); color: var(--tj-green); font-size: 0.75rem; letter-spacing: .5px; }.tj-guardrail-blue .tj-guardrail-status { border-color: color-mix(in srgb, var(--tj-blue) 40%, var(--tj-border)); background: color-mix(in srgb, var(--tj-blue) 10%, var(--tj-panel)); color: var(--tj-blue); }.tj-guardrail-status-hit { color: var(--tj-red); border-color: color-mix(in srgb, var(--tj-red) 46%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 11%, var(--tj-panel)); }.tj-guardrail-meter { min-height: 68px; display: grid; align-content: center; gap: 3px; padding: 9px; border: 1px solid color-mix(in srgb, var(--tj-green) 25%, var(--tj-border)); border-radius: 16px; background: color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel-alt)); box-shadow: inset 0 1px 0 rgba(255,255,255,.04); }.tj-guardrail-blue .tj-guardrail-meter { border-color: color-mix(in srgb, var(--tj-blue) 34%, var(--tj-border)); background: color-mix(in srgb, var(--tj-blue) 11%, var(--tj-panel-alt)); }.tj-guardrail-meter strong { font-size: 1.1475rem; line-height: 1; }.tj-guardrail-meter span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .85px; }.tj-guardrail-meter i { height: 5px; overflow: hidden; border-radius: 99px; background: color-mix(in srgb, var(--tj-green) 12%, var(--tj-border)); }.tj-guardrail-meter i b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-guardrail-blue .tj-guardrail-meter i b { background: var(--tj-blue); }.tj-guardrail-hit .tj-guardrail-meter i b { background: var(--tj-red); }.tj-guardrail-metric > p { position: relative; z-index: 1; align-self: start; margin: 10px 0; color: var(--tj-muted); font-size: 0.75rem; }.tj-guardrail-metric > footer { position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 8px; padding-top: 9px; border-top: 1px solid var(--tj-border); color: var(--tj-muted); font-size: 0.75rem; }.tj-guardrail-metric > footer strong { color: var(--tj-green); }.tj-guardrail-blue > footer strong { color: var(--tj-blue); }.tj-guardrail-hit > footer strong { color: var(--tj-red); }.tj-guardrails-footer { position: relative; z-index: 1; margin-top: 12px; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }
.tj-reference-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; padding: 1px; overflow: hidden; border: 1px solid var(--tj-border); border-radius: 14px; background: var(--tj-border); }.tj-reference-kpi { min-height: 124px; padding: 13px 14px; border: 0; border-radius: 0; box-shadow: none; background: color-mix(in srgb, var(--tj-panel) 94%, var(--tj-panel-alt)); display: grid; align-content: start; gap: 5px; }.tj-reference-kpi-value { font-size: 1.4175rem; font-weight: 800; margin: 1px 0 0; font-variant-numeric: tabular-nums; letter-spacing: -.35px; }.tj-kpi-top, .tj-reference-month-head, .tj-reference-flow-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.tj-kpi-top > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .35px; text-transform: uppercase; }.tj-kpi-top > span.tj-green, .tj-kpi-top > span.tj-red { color: inherit; }.tj-reference-kpi .tj-stat-sub { min-height: 14px; overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.35; }.tj-reference-kpi small { display: flex; justify-content: space-between; gap: 6px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: .2px; }.tj-reference-kpi small em { font-style: normal; }.tj-kpi-spark { height: 26px; margin-top: -1px; }.tj-kpi-line, .tj-kpi-split { display: flex; height: 5px; overflow: hidden; margin-top: 3px; border-radius: 99px; background: var(--tj-panel-alt); }.tj-kpi-line i, .tj-kpi-split i, .tj-kpi-split b { display: block; height: 100%; }.tj-kpi-line i, .tj-kpi-split i { background: var(--tj-green); }.tj-kpi-split b { background: var(--tj-red); opacity: .8; }.tj-day-bar-strip { height: 14px; display: flex; align-items: center; gap: 3px; overflow: hidden; margin: 1px 0; }.tj-day-bar-strip i { display: block; flex: 1; min-width: 7px; height: 5px; border-radius: 99px; }.tj-day-bar-win { background: var(--tj-green); }.tj-day-bar-loss { background: var(--tj-red); }.tj-day-bar-be { background: var(--tj-blue); }.tj-day-bar-strip span { color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-hero-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(350px, 1fr); gap: 14px; }.tj-reference-calendar-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(250px, .75fr); gap: 14px; }.tj-reference-calendar, .tj-reference-weeks, .tj-reference-flow { padding: 16px; }.tj-reference-month-head { align-items: center; min-height: 30px; margin-bottom: 13px; }.tj-reference-month-head .tj-month-nav { display: flex; align-items: center; gap: 8px; }.tj-reference-month-head .tj-month-nav strong { white-space: nowrap; font-size: 1.1475rem; }.tj-reference-month-total { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-reference-month-total strong { font-size: 1.08rem; margin-right: 3px; }.tj-reference-month-total span { padding: 3px 7px; border-radius: 99px; background: var(--tj-panel-alt); }.tj-reference-calendar-body { display: grid; grid-template-columns: minmax(0, 1fr) 126px; gap: 13px; }.tj-reference-calendar .tj-month-summary { margin-bottom: 14px; }.tj-reference-calendar .tj-cal-cell { min-height: 72px; padding: 8px; border-radius: 14px; background: color-mix(in srgb, var(--tj-panel-alt) 82%, transparent); }.tj-reference-calendar .tj-cal-cell.tj-cal-win { border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 11%, var(--tj-panel-alt)); }.tj-reference-calendar .tj-cal-cell.tj-cal-loss { border-color: color-mix(in srgb, var(--tj-red) 42%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, var(--tj-panel-alt)); }.tj-reference-calendar .tj-cal-tcount { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; min-height: 17px; padding: 0 4px; margin-top: 5px; border: 1px solid var(--tj-border); border-radius: 99px; color: var(--tj-muted); font-size: 0.75rem; line-height: 1; }.tj-reference-week-rail { display: grid; grid-auto-rows: 1fr; gap: 8px; }.tj-reference-week { padding: 9px; min-height: 57px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); display: grid; align-content: center; gap: 5px; }.tj-reference-week-active { background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); border-color: color-mix(in srgb, var(--tj-green) 28%, var(--tj-border)); }.tj-reference-week > div { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }.tj-reference-week span, .tj-reference-week small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: .45px; }.tj-reference-week strong { font-size: 1rem; font-variant-numeric: tabular-nums; }.tj-reference-week i { display: block; overflow: hidden; height: 4px; border-radius: 99px; background: var(--tj-border); }.tj-reference-week b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-reference-weeks .tj-weekly-list { max-height: 385px; overflow: auto; padding-right: 2px; }.tj-standalone-calendar .tj-month-summary { margin-top: 4px; }
.tj-reference-flow { display: grid; align-content: start; gap: 12px; min-height: 620px; padding: 16px; border-radius: 24px; }.tj-reference-flow-head { align-items: start; border-bottom: 1px solid color-mix(in srgb, var(--tj-border) 72%, transparent); padding-bottom: 13px; }.tj-reference-flow-head > div:first-child { display: grid; gap: 4px; }.tj-reference-flow-head > div:first-child > strong { font-size: 1.08rem; }.tj-reference-flow-head > div:first-child > span { max-width: 305px; color: var(--tj-muted); font-size: 0.8125rem; line-height: 1.35; }.tj-reference-flow .tj-tabs { flex-shrink: 0; gap: 12px; padding: 0; border-radius: 0; background: transparent; }.tj-reference-flow .tj-tab { padding: 3px 0 8px; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; font-size: 0.75rem; font-weight: 750; }.tj-reference-flow .tj-tab-active { border-bottom-color: var(--tj-purple); color: var(--tj-text); }.tj-reference-flow-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.tj-reference-flow-metrics > div { min-width: 0; min-height: 69px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--tj-border) 82%, transparent); border-radius: 17px; background: color-mix(in srgb, var(--tj-panel-alt) 74%, transparent); display: grid; align-content: center; gap: 3px; }.tj-reference-flow-metrics span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .55px; }.tj-reference-flow-metrics strong { overflow: hidden; font-size: 1.215rem; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-metrics small { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-chart { min-height: 176px; padding: 4px 0 0; border-bottom: 1px solid color-mix(in srgb, var(--tj-border) 34%, transparent); }.tj-reference-flow-chart .recharts-cartesian-grid-horizontal line { stroke-opacity: .42; stroke-dasharray: 0; }.tj-reference-flow-trades { display: grid; gap: 8px; }.tj-reference-flow-trades > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 50px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--tj-border) 86%, transparent); border-radius: 15px; background: color-mix(in srgb, var(--tj-panel-alt) 62%, transparent); font-size: 0.8125rem; }.tj-reference-flow-trades .tj-flow-trade-copy, .tj-reference-flow-trades .tj-flow-trade-result { min-width: 0; display: grid; gap: 3px; }.tj-reference-flow-trades .tj-flow-trade-copy strong { overflow: hidden; color: var(--tj-text); font-size: 0.875rem; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-trades .tj-flow-trade-copy small { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-flow-trades .tj-flow-trade-copy em { font-style: normal; }.tj-reference-flow-trades .tj-flow-trade-result { flex-shrink: 0; justify-items: end; }.tj-reference-flow-trades .tj-flow-trade-result small { color: var(--tj-muted); font-size: 0.75rem; }.tj-reference-flow-trades .tj-flow-trade-result b { font-size: 0.9375rem; font-variant-numeric: tabular-nums; }.tj-recent-table { display: grid; gap: 2px; }.tj-recent-head, .tj-recent-row { display: grid; grid-template-columns: 1.35fr 1fr .65fr .85fr .8fr; align-items: center; gap: 12px; }.tj-recent-head { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .55px; font-weight: 700; text-transform: uppercase; padding: 0 11px 8px; }.tj-recent-row { min-height: 44px; padding: 8px 11px; border: 1px solid var(--tj-border); background: var(--tj-panel-alt); border-radius: 8px; font-size: 0.875rem; }.tj-recent-row strong:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.tj-dashboard-analytics-grid { display: grid; grid-template-columns: minmax(250px, .9fr) minmax(380px, 1.35fr) minmax(290px, 1fr); gap: 14px; }.tj-dashboard-analytics-grid > .tj-panel { min-height: 385px; padding: 16px; }.tj-dashboard-core-score .tj-panel-head > strong { display: grid; place-items: center; min-width: 48px; min-height: 48px; border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 14%, var(--tj-panel-alt)); color: var(--tj-green); font-size: 1.35rem; }.tj-core-score-metrics { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px 11px; color: var(--tj-muted); font-size: 0.75rem; }.tj-core-score-metrics b { color: var(--tj-text); margin-left: 3px; }.tj-dashboard-analytics-grid .tj-panel-head .tj-muted-txt { margin-top: 3px; font-size: 0.8125rem; }

/* Dashboard card accents mirror the colored depth used by the guardrail deck. */
.tj-reference-kpi { position: relative; overflow: hidden; }.tj-reference-kpi::after { content: ""; position: absolute; top: -34px; right: -26px; width: 100px; height: 76px; border-radius: 50%; background: color-mix(in srgb, var(--tj-green) 7%, transparent); pointer-events: none; }.tj-kpi-equity { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel)), var(--tj-panel) 72%); }.tj-kpi-profit { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-blue) 9%, var(--tj-panel)), var(--tj-panel) 72%); }.tj-kpi-profit::after { background: color-mix(in srgb, var(--tj-blue) 10%, transparent); }.tj-kpi-days { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-purple) 9%, var(--tj-panel)), var(--tj-panel) 72%); }.tj-kpi-days::after { background: color-mix(in srgb, var(--tj-purple) 11%, transparent); }.tj-kpi-winrate { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)), color-mix(in srgb, var(--tj-red) 4%, var(--tj-panel)) 82%); }.tj-kpi-payoff { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-amber) 7%, var(--tj-panel)), color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel)) 82%); }.tj-kpi-payoff::after { background: color-mix(in srgb, var(--tj-amber) 9%, transparent); }
.tj-challenge-dashboard-progress { display:grid; gap:6px; margin-top:4px; padding-top:7px; border-top:1px solid var(--tj-border); }.tj-challenge-dashboard-progress > div { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }.tj-challenge-dashboard-progress span { color:var(--tj-muted); font-size:.66rem; font-weight:800; letter-spacing:.65px; }.tj-challenge-dashboard-progress strong { font-size:.9rem; font-variant-numeric:tabular-nums; }.tj-challenge-dashboard-progress > i { display:block; height:5px; overflow:hidden; border-radius:99px; background:var(--tj-panel-alt); }.tj-challenge-dashboard-progress > i > b { display:block; height:100%; border-radius:inherit; background:var(--tj-red); }.tj-challenge-dashboard-middle > i > b { background:var(--tj-blue); }.tj-challenge-dashboard-finish > i > b { background:#82D9C2; }
.tj-reference-calendar { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-blue) 5%, var(--tj-panel)), color-mix(in srgb, var(--tj-purple) 4%, var(--tj-panel)) 82%); }.tj-reference-flow { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)), color-mix(in srgb, var(--tj-blue) 3%, var(--tj-panel)) 74%); }.tj-dashboard-core-score { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-purple) 8%, var(--tj-panel)), var(--tj-panel) 72%); }.tj-dashboard-equity { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel)), var(--tj-panel) 74%); }.tj-dashboard-daily { background: linear-gradient(145deg, color-mix(in srgb, var(--tj-blue) 6%, var(--tj-panel)), color-mix(in srgb, var(--tj-red) 3%, var(--tj-panel)) 86%); }
.tj-reference-flow-metrics > div:nth-child(1) { background: linear-gradient(135deg, color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-blue) 2%, var(--tj-panel-alt))); }
.tj-reference-flow-metrics > div:nth-child(2) { background: linear-gradient(135deg, color-mix(in srgb, var(--tj-blue) 7%, var(--tj-panel-alt)), var(--tj-panel-alt)); }
.tj-reference-flow-metrics > div:nth-child(3) { background: linear-gradient(135deg, color-mix(in srgb, var(--tj-purple) 6%, var(--tj-panel-alt)), var(--tj-panel-alt)); }
.tj-reference-flow-metrics > div:nth-child(4) { background: linear-gradient(135deg, color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel-alt)), var(--tj-panel-alt)); }
.tj-reference-flow-trades > .tj-flow-trade-win { border-color: color-mix(in srgb, var(--tj-green) 20%, var(--tj-border)); background: linear-gradient(100deg, color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-blue) 2%, var(--tj-panel-alt))); }
.tj-reference-flow-trades > .tj-flow-trade-loss { border-color: color-mix(in srgb, var(--tj-red) 20%, var(--tj-border)); background: linear-gradient(100deg, color-mix(in srgb, var(--tj-red) 5%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-purple) 2%, var(--tj-panel-alt))); }

/* Dense Trade Log layout follows the same reference hierarchy while retaining
   AAICOREFX review status, automatic rating and linked-markup data. */
.tj-tradelog-reference-summary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-bottom: 14px; padding: 1px; border: 1px solid var(--tj-border); border-radius: 14px; background: var(--tj-border); }.tj-tradelog-reference-summary > div { min-width: 0; padding: 12px 14px; background: var(--tj-panel); display: grid; gap: 3px; }.tj-tradelog-reference-summary span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }.tj-tradelog-reference-summary strong { overflow: hidden; font-size: 1.08rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-tradelog-reference-summary small { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }.tj-tradelog-compact-toolbar { display: grid; grid-template-columns: 1fr auto; gap: 9px; align-items: center; min-height: 32px; margin-bottom: 14px; }.tj-tradelog-filter-controls, .tj-tradelog-sort-controls { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: color-mix(in srgb, var(--tj-panel-alt) 84%, transparent); }.tj-tradelog-filter-controls .tj-toolbar-search { flex: 1; }.tj-tradelog-sort-controls > span { color: var(--tj-muted); font-size: 0.8125rem; }.tj-reference-tradelog-row .tj-tlog-row { min-height: 62px; flex-wrap: nowrap; justify-content: space-between; gap: 14px; }.tj-reference-trade-left { min-width: 0; flex: 1; display: flex; align-items: center; gap: 18px; }.tj-reference-trade-left .tj-reference-trade-meta { flex: 0 0 182px; min-width: 182px; }.tj-reference-trade-left .tj-tlog-main { flex: 0 0 108px; min-width: 108px; }.tj-reference-trade-direction { flex: 0 0 auto; font-size: 0.75rem; font-weight: 800; }.tj-reference-trade-session { min-width: 70px; color: var(--tj-text); font-size: 0.8125rem; font-weight: 700; white-space: nowrap; }.tj-reference-tradelog-row .tj-tlog-pills { flex-wrap: wrap; align-items: center; }.tj-reference-tradelog-row .tj-review-status { min-width: auto; flex-shrink: 0; padding: 2px 6px; border-radius: 5px; font-size: 0.75rem; }.tj-reference-trade-meta { flex: 1; min-width: 170px; display: grid; gap: 3px; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.2; }.tj-reference-trade-meta span:first-child { color: var(--tj-text); }.tj-reference-trade-right { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; }.tj-reference-tradelog-row .tj-tlog-pnl-block { min-width: 112px; text-align: right; }.tj-reference-trade-return { color: var(--tj-muted); font-size: 0.75rem; }.tj-reference-delete { color: var(--tj-red); border-color: color-mix(in srgb, var(--tj-red) 40%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 9%, transparent); }.tj-reference-trade-detail-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 13px; }.tj-reference-trade-detail-summary > div { padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); display: grid; gap: 4px; }.tj-reference-trade-detail-summary span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .5px; }.tj-reference-trade-detail-summary strong { overflow: hidden; font-size: 0.875rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-reference-linked-markup { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; margin-top: 12px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); }.tj-reference-linked-markup > div { display: grid; gap: 3px; }.tj-reference-linked-markup span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .45px; text-transform: uppercase; }.tj-reference-linked-markup strong { font-size: 0.875rem; }.tj-reference-linked-markup small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-trade-expand { display: grid; gap: 10px; padding: 12px; }
.tj-reference-trade-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tj-reference-trade-brief, .tj-reference-trade-markup, .tj-reference-journal-detail { min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); }
.tj-reference-trade-section-head { min-height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-trade-section-head > div { display: flex; justify-content: flex-end; gap: 4px; flex-wrap: wrap; }
.tj-reference-trade-section-head em { padding: 2px 5px; border-radius: 4px; background: var(--tj-panel-alt); color: var(--tj-muted); font-size: 0.75rem; font-style: normal; font-weight: 700; }
.tj-reference-trade-section-head small { font-size: 0.75rem; }
.tj-reference-trade-brief-rows { display: grid; margin-top: 4px; }
.tj-reference-trade-brief-rows > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; align-items: center; padding: 7px 0; border-top: 1px solid var(--tj-border); }
.tj-reference-trade-brief-rows span, .tj-reference-markup-shots-head span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; letter-spacing: .55px; }
.tj-reference-trade-brief-rows strong { font-size: 0.8125rem; line-height: 1.3; }
.tj-reference-trade-note { min-height: 28px; padding-top: 9px; margin-top: 2px; border-top: 1px solid var(--tj-border); color: var(--tj-muted); font-size: 0.8125rem; }
.tj-reference-linked-title { display: block; margin-top: 2px; font-size: 1rem; }
.tj-reference-linked-meta { margin-top: 5px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-link-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; margin-top: 10px; }
.tj-reference-link-controls .tj-input { height: 32px; padding-block: 5px; }
.tj-reference-link-controls button:disabled { opacity: .5; cursor: not-allowed; }
.tj-reference-markup-shots-head { display: flex; justify-content: space-between; gap: 8px; padding-top: 10px; margin-top: 10px; border-top: 1px solid var(--tj-border); }
.tj-reference-markup-shots-head small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-markup-shots { display: flex; gap: 8px; margin-top: 7px; overflow-x: auto; padding-bottom: 2px; }
.tj-reference-markup-shots .tj-image-preview { width: 92px; height: 66px; flex: 0 0 92px; border-color: color-mix(in srgb, var(--tj-green) 35%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); }
.tj-reference-trade-empty { min-height: 54px; display: flex; align-items: center; color: var(--tj-muted); font-size: 0.75rem; }
.tj-reference-journal-detail { display: grid; gap: 9px; }
.tj-reference-journal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tj-reference-journal-grid > div { min-width: 0; }
.tj-reference-journal-grid .tj-tlog-types, .tj-reference-journal-grid .tj-tlog-mistakes { min-height: 32px; padding-top: 6px; }
.tj-reference-trade-screens { padding-top: 10px; border-top: 1px solid var(--tj-border); }
.tj-reference-trade-screens .tj-tlog-shots { margin-top: 7px; }
.tj-tradelog-compact-toolbar { position: relative; z-index: 8; }
.tj-reference-trade-left { display:grid; grid-template-columns:minmax(108px,1.1fr) minmax(48px,.7fr) minmax(182px,2fr) minmax(82px,1fr); column-gap:24px; }
.tj-reference-trade-left .tj-reference-trade-meta, .tj-reference-trade-left .tj-tlog-main, .tj-reference-trade-direction, .tj-reference-trade-session { min-width:0; }
.tj-markup-toolbar-button { display:inline-flex; align-items:center; justify-content:center; min-width:32px; padding:0; box-sizing:border-box; }
.tj-tradelog-filter-grid .tj-field:first-child { grid-column: 1 / -1; }
.tj-tradelog-filter-grid .tj-toolbar-search { width: 100%; height: 30px; }
.tj-tradelog-filter-grid .tj-toolbar-search-input { height: 100%; }
.tj-reference-markup-shots .tj-image-preview-selected, .tj-reference-trade-screens .tj-image-preview-selected { border-color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 15%, var(--tj-panel-alt)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tj-green) 35%, transparent); }

/* Analytics workspace — uses the same theme and Forest Green tokens as the
   rest of the journal, including every chart and performance surface. */
.tj-analytics-workspace { display: grid; gap: 14px; }
.tj-analytics-deck { min-height: 90px; display: grid; grid-template-columns: minmax(260px, 1fr) auto minmax(140px, 1fr); align-items: center; gap: 18px; padding: 14px 16px; border-radius: 16px; background: linear-gradient(100deg, color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel)), var(--tj-panel) 54%, color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel))); scroll-margin-top: 78px; }
.tj-analytics-deck-copy { display: grid; gap: 3px; }.tj-analytics-deck-copy > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.2px; }.tj-analytics-deck-copy > strong { font-size: 1.755rem; line-height: 1; letter-spacing: -.55px; }.tj-analytics-deck-copy > small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-analytics-deck-tabs { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-analytics-deck-tabs button { min-height: 32px; padding: 0 13px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--tj-muted); font: inherit; font-size: 0.75rem; font-weight: 700; white-space: nowrap; cursor: pointer; }.tj-analytics-deck-tabs button:hover { color: var(--tj-text); }.tj-analytics-deck-tabs .tj-analytics-deck-tab-active { border-color: color-mix(in srgb, var(--tj-green) 36%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel)); color: var(--tj-text); box-shadow: 0 0 0 2px color-mix(in srgb, var(--tj-green) 8%, transparent); }
.tj-analytics-period-wrap { position: relative; z-index: 25; justify-self: end; }
.tj-analytics-period { min-width: 132px; height: 34px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); color: var(--tj-text); font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; }.tj-analytics-period:hover, .tj-analytics-period-open { border-color: color-mix(in srgb, var(--tj-green) 60%, var(--tj-border)); }.tj-analytics-period svg:first-child { color: var(--tj-green); }.tj-analytics-period svg:last-child { color: var(--tj-muted); }
.tj-analytics-period-popover { position: absolute; z-index: 60; top: calc(100% + 8px); right: 0; width: 255px; padding: 13px; border: 1px solid color-mix(in srgb, var(--tj-purple) 35%, var(--tj-border)); border-radius: 14px; background: color-mix(in srgb, var(--tj-panel) 96%, transparent); box-shadow: 0 20px 48px rgba(0,0,0,.42); backdrop-filter: blur(14px); }
.tj-analytics-period-popover header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.tj-analytics-period-popover header strong { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: 1.15px; }.tj-analytics-period-popover header button { padding: 0; border: 0; background: transparent; color: var(--tj-green); font: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer; }
.tj-analytics-period-popover p { margin: 5px 0 12px; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-analytics-period-popover > div { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }.tj-analytics-period-popover > div button { min-width: 0; height: 38px; padding: 0 5px; border: 1px solid transparent; border-radius: 999px; background: var(--tj-panel-alt); color: var(--tj-muted); font: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer; }.tj-analytics-period-popover > div button span { opacity: .78; }.tj-analytics-period-popover > div button:hover:not(:disabled), .tj-analytics-period-popover > div .tj-analytics-month-active { border-color: color-mix(in srgb, var(--tj-green) 58%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 13%, var(--tj-panel-alt)); color: var(--tj-text); }.tj-analytics-period-popover > div button:disabled { opacity: .4; cursor: not-allowed; }
.tj-analytics-equity-hero { padding: 14px; border-radius: 16px; background: linear-gradient(100deg, color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel)), color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel)) 55%, var(--tj-panel)); }
.tj-analytics-equity-head { display: flex; justify-content: space-between; gap: 18px; padding-bottom: 12px; }
.tj-analytics-equity-head .tj-section-label { margin: 0 0 5px; }.tj-analytics-equity-head h2 { max-width: 760px; margin: 0 0 7px; font-size: clamp(23px, 2.1vw, 31px); line-height: 1.05; letter-spacing: -.72px; }
.tj-analytics-equity-head p { max-width: 900px; margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }
.tj-analytics-hero-return { min-width: 138px; align-self: start; display: grid; gap: 2px; padding: 10px 11px; border: 1px solid color-mix(in srgb, var(--tj-purple) 32%, var(--tj-border)); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-analytics-hero-return strong { font-size: 1.5525rem; font-variant-numeric: tabular-nums; }.tj-analytics-hero-return span, .tj-analytics-hero-return small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-analytics-equity-chart { padding: 10px 12px 11px; border: 1px solid var(--tj-border); border-radius: 14px; background: color-mix(in srgb, var(--tj-panel-alt) 90%, transparent); }.tj-analytics-equity-milestones { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }.tj-analytics-equity-milestones > div { min-width: 0; min-height: 52px; padding: 8px 9px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel); display: grid; align-content: center; gap: 2px; }.tj-analytics-equity-milestones small, .tj-engine-metrics small, .tj-rhythm-top small, .tj-coach-note small, .tj-coach-risk small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .7px; }.tj-analytics-equity-milestones strong { overflow: hidden; font-size: 0.875rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-analytics-equity-milestones span { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-analytics-workspace [id^="analytics-"] { scroll-margin-top: 78px; }
.tj-performance-workspace { display: grid; gap: 14px; }.tj-performance-views, .tj-performance-surface { padding: 14px; border-radius: 16px; }.tj-performance-views { display: grid; grid-template-columns: 1fr auto; gap: 11px; }.tj-performance-views > div { display: grid; gap: 5px; }.tj-performance-views > div > strong { font-size: 0.875rem; }.tj-performance-views > div > span, .tj-performance-title span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-performance-views > small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-performance-views nav { grid-column: 1 / -1; display: flex; align-items: center; gap: 2px; padding: 4px; overflow-x: auto; border-radius: 9px; background: var(--tj-panel-alt); }.tj-performance-views button { min-height: 29px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--tj-muted); font: inherit; font-size: 0.75rem; font-weight: 700; white-space: nowrap; cursor: pointer; }.tj-performance-views button:hover { color: var(--tj-text); }.tj-performance-views .tj-performance-view-active { background: var(--tj-panel); color: var(--tj-text); box-shadow: var(--tj-shadow); }
.tj-performance-surface { display: grid; gap: 12px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel)), var(--tj-panel) 58%, color-mix(in srgb, var(--tj-purple) 3%, var(--tj-panel))); }.tj-performance-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }.tj-performance-title > div { min-width: 0; display: grid; gap: 5px; }.tj-performance-title strong { font-size: 0.9375rem; }.tj-performance-title > div > small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; }.tj-performance-title > small { flex-shrink: 0; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }
.tj-performance-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.tj-performance-highlights > div, .tj-performance-four > div { min-width: 0; display: grid; align-content: center; gap: 3px; min-height: 64px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }.tj-performance-highlights small, .tj-performance-four small, .tj-performance-entry-card small, .tj-performance-instrument-card small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .8px; }.tj-performance-highlights strong { overflow: hidden; color: var(--tj-green); font-size: 1.08rem; text-overflow: ellipsis; white-space: nowrap; }.tj-performance-highlights span, .tj-performance-four span { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-performance-entry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 245px)); gap: 10px; }.tj-performance-entry-card { min-width: 0; display: grid; gap: 9px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-performance-entry-card > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.tj-performance-entry-card > div:first-child > strong { font-size: 1rem; }.tj-performance-entry-card > section { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.tj-performance-entry-card > section > span { display: grid; gap: 3px; }.tj-performance-entry-card > section b { font-size: 0.875rem; }.tj-performance-entry-card > section i { color: var(--tj-muted); font-size: 0.75rem; font-style: normal; }.tj-performance-best-worst { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }.tj-performance-best-worst > span { display: grid; gap: 2px; padding: 7px; border-radius: 7px; background: color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel)); }.tj-performance-best-worst > span:last-child { background: color-mix(in srgb, var(--tj-red) 10%, var(--tj-panel)); }.tj-performance-entry-card > i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-performance-entry-card > i > b { display: block; height: 100%; }
.tj-performance-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }.tj-performance-stat-card, .tj-performance-instrument-card { min-width: 0; display: grid; align-content: start; gap: 6px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-performance-stat-head, .tj-performance-instrument-card > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.tj-performance-stat-head > span, .tj-performance-instrument-card > div:first-child > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; }.tj-performance-stat-card > strong { overflow: hidden; font-size: 1.1475rem; text-overflow: ellipsis; white-space: nowrap; }.tj-performance-stat-card > em, .tj-performance-instrument-card > em { font-size: 1.35rem; font-style: normal; font-weight: 800; }.tj-performance-mini-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }.tj-performance-mini-metrics > span, .tj-performance-instrument-card > section > span { display: grid; gap: 3px; padding: 7px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); }.tj-performance-mini-metrics small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .65px; }.tj-performance-mini-metrics b { font-size: 0.8125rem; }
.tj-performance-bars { display: grid; grid-template-columns: 45px minmax(0, 1fr) auto; align-items: center; gap: 5px 7px; }.tj-performance-bars > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .65px; }.tj-performance-bars > i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-performance-bars > i > b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-performance-bars > i > .tj-performance-purple { background: var(--tj-purple); }.tj-performance-bars > strong { font-size: 0.75rem; text-align: right; }.tj-performance-stat-card footer, .tj-performance-instrument-card footer { display: flex; justify-content: space-between; gap: 8px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .55px; }
.tj-performance-four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }.tj-performance-four strong { overflow: hidden; font-size: 1.1475rem; text-overflow: ellipsis; white-space: nowrap; }.tj-performance-chart { padding: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel-alt)); }.tj-performance-chart > div:first-child { display: grid; gap: 4px; }.tj-performance-chart > div:first-child small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .9px; }.tj-performance-chart > div:first-child strong { font-size: 1.485rem; }
.tj-performance-recent { display: grid; }.tj-performance-recent > header { display: flex; justify-content: space-between; gap: 10px; padding: 0 0 8px; color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .8px; }.tj-performance-recent > header > span { letter-spacing: 0; }.tj-performance-recent > div { display: grid; grid-template-columns: minmax(100px, .7fr) minmax(180px, 1fr) minmax(110px, .45fr) minmax(110px, .45fr); align-items: center; gap: 12px; min-height: 49px; padding: 7px 10px; border-top: 1px solid var(--tj-border); }.tj-performance-recent > div > span { display: grid; gap: 2px; }.tj-performance-recent > div > span:last-child { text-align: right; }.tj-performance-recent small { color: var(--tj-muted); font-size: 0.75rem; }.tj-performance-recent i, .tj-performance-month-list i { height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-panel); }.tj-performance-recent i > b, .tj-performance-month-list i > b { display: block; height: 100%; border-radius: inherit; }.tj-performance-recent em { display: grid; gap: 2px; font-size: 0.8125rem; font-style: normal; font-weight: 800; }.tj-performance-recent em small { font-weight: 500; }
.tj-performance-month-list { display: grid; }.tj-performance-month-list > div { display: grid; grid-template-columns: minmax(85px, .45fr) minmax(180px, 1fr) minmax(110px, .55fr) minmax(90px, .35fr); align-items: center; gap: 12px; min-height: 42px; padding: 7px 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-performance-month-list > div + div { margin-top: 7px; }.tj-performance-month-list span { color: var(--tj-muted); font-size: 0.75rem; text-align: right; }.tj-performance-month-list em { font-size: 0.75rem; font-style: normal; font-weight: 800; text-align: right; }
.tj-performance-instrument-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.tj-performance-instrument-card { padding: 12px; }.tj-performance-instrument-card > strong { font-size: 1.4175rem; }.tj-performance-instrument-card > em { font-size: 1.8225rem; }.tj-performance-instrument-card > section { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }.tj-performance-instrument-card > section b { font-size: 0.875rem; }
.tj-execution-workspace { display: grid; gap: 14px; }.tj-execution-rhythm-card, .tj-core-breakdown, .tj-session-time, .tj-execution-days { padding: 14px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel)), var(--tj-panel) 56%, color-mix(in srgb, var(--tj-purple) 3%, var(--tj-panel))); }.tj-execution-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.tj-execution-title > div { display: grid; gap: 5px; }.tj-execution-title > strong, .tj-execution-title > div > strong { font-size: 0.9375rem; }.tj-execution-title > small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-execution-title > div > span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }
.tj-execution-four { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 10px; }.tj-execution-four > div, .tj-execution-week-grid > div, .tj-execution-month-grid > div { min-width: 0; display: grid; gap: 4px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-execution-four small, .tj-execution-week-grid small, .tj-execution-month-grid small, .tj-core-breakdown small, .tj-execution-day-metrics small, .tj-execution-best-worst small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .9px; }.tj-execution-four strong { font-size: 1.1475rem; }.tj-execution-four span, .tj-execution-week-grid span, .tj-execution-month-grid span { color: var(--tj-muted); font-size: 0.75rem; }
.tj-execution-section-label { margin: 13px 0 7px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.1px; }.tj-execution-bars { display: grid; gap: 7px; }.tj-execution-bars > div { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto 32px; align-items: center; gap: 8px; }.tj-execution-bars strong { font-size: 0.75rem; }.tj-execution-bars i { height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-execution-bars i > b { display: block; height: 100%; border-radius: inherit; }.tj-execution-bars em { min-width: 64px; font-size: 0.75rem; font-style: normal; font-weight: 800; text-align: right; }.tj-execution-bars span { font-size: 0.75rem; font-weight: 800; text-align: right; }.tj-execution-week-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.tj-execution-week-grid strong, .tj-execution-month-grid strong { font-size: 1.08rem; }.tj-execution-month-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
.tj-core-breakdown-grid { display: grid; grid-template-columns: minmax(300px, .8fr) minmax(0, 1.2fr); gap: 10px; margin-top: 10px; }.tj-core-breakdown-grid > section { min-width: 0; padding: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel-alt)); }.tj-core-breakdown-grid > section:first-child > div:first-child, .tj-discipline-head { display: grid; grid-template-columns: minmax(150px, .8fr) minmax(180px, 1.2fr); gap: 14px; align-items: center; }.tj-core-breakdown-grid span { display: grid; gap: 4px; }.tj-core-breakdown-grid span > strong { font-size: 1.8225rem; line-height: 1; }.tj-core-breakdown-grid span > strong > i { color: var(--tj-muted); font-size: 0.75rem; font-style: normal; }.tj-core-breakdown-grid p { margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }.tj-core-breakdown-grid > section:first-child > i { display: block; height: 7px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-core-breakdown-grid > section:first-child > i > b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tj-amber), var(--tj-green)); }
.tj-discipline-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 11px; }.tj-discipline-grid > div { display: grid; gap: 6px; padding: 9px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel); }.tj-discipline-grid > div > span { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.tj-discipline-grid > div > span strong { font-size: 0.875rem; }.tj-discipline-grid > div > i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-discipline-grid > div > i > b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tj-purple), var(--tj-green)); }.tj-core-breakdown-grid section:last-child > footer { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }.tj-core-breakdown-grid section:last-child > footer > span { padding: 5px 8px; border-radius: 99px; background: var(--tj-panel); color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; }
.tj-execution-bottom { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1fr); gap: 14px; }.tj-session-time-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 190px)); gap: 9px; margin-top: 11px; }.tj-session-time-grid > div { display: grid; gap: 8px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-session-time-grid header { display: flex; justify-content: space-between; gap: 8px; }.tj-session-time-grid header strong { font-size: 0.8125rem; }.tj-session-time-grid header span { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .8px; }.tj-session-time-grid em { font-size: 1rem; font-style: normal; font-weight: 800; }.tj-session-time-grid section { display: flex; gap: 6px; }.tj-session-time-grid section span, .tj-session-time-grid > div > small { padding: 4px 7px; border-radius: 99px; background: var(--tj-panel); color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; }.tj-session-time-grid > div > i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-session-time-grid > div > i > b { display: block; height: 100%; }.tj-entry-time-empty { display: grid; grid-template-columns: auto 1fr; gap: 7px 12px; margin-top: 14px; padding-top: 11px; border-top: 1px solid var(--tj-border); }.tj-entry-time-empty > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; }.tj-entry-time-empty > small { color: var(--tj-muted); font-size: 0.75rem; text-align: right; }.tj-entry-time-empty > p { grid-column: 1 / -1; margin: 0; padding: 9px; border: 1px dashed var(--tj-border); border-radius: 8px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-execution-day-head { display: flex; align-items: center; gap: 14px; margin: 10px 0; }.tj-execution-day-head > div { width: 72px; height: 72px; flex: 0 0 72px; display: grid; place-content: center; justify-items: center; border: 3px solid var(--tj-green); border-radius: 50%; }.tj-execution-day-head > div strong { color: var(--tj-green); font-size: 1.5525rem; line-height: 1; }.tj-execution-day-head > div span { color: var(--tj-muted); font-size: 0.75rem; }.tj-execution-day-head section { display: grid; gap: 4px; }.tj-execution-day-head section > strong { color: var(--tj-green); font-size: 1.0125rem; }.tj-execution-day-head section > span, .tj-execution-day-head section > small { color: var(--tj-muted); font-size: 0.75rem; }.tj-execution-day-head section i { display: inline-block; }
.tj-execution-day-dist { display: flex; height: 7px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-execution-day-dist > i { background: var(--tj-green); }.tj-execution-day-dist > b { background: var(--tj-red); }.tj-execution-day-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 11px; }.tj-execution-day-metrics > div { display: grid; justify-items: center; gap: 4px; padding: 8px; border-radius: 8px; background: var(--tj-panel-alt); }.tj-execution-best-worst { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }.tj-execution-best-worst > div { display: grid; gap: 3px; padding: 9px; border-radius: 8px; background: color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel-alt)); }.tj-execution-best-worst > div:last-child { background: color-mix(in srgb, var(--tj-red) 10%, var(--tj-panel-alt)); }.tj-execution-best-worst span { color: var(--tj-muted); font-size: 0.75rem; }.tj-execution-last-days { display: flex; gap: 3px; min-height: 31px; }.tj-execution-last-days > i { min-width: 24px; border-radius: 5px; }.tj-execution-last-days > .tj-day-win { background: var(--tj-green); }.tj-execution-last-days > .tj-day-loss { background: var(--tj-red); }.tj-execution-last-days > .tj-day-flat { background: var(--tj-blue); }
.tj-risk-workspace { display: grid; gap: 14px; }.tj-risk-audit, .tj-risk-control, .tj-risk-coach { padding: 14px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-red) 3%, var(--tj-panel)), var(--tj-panel) 55%, color-mix(in srgb, var(--tj-green) 3%, var(--tj-panel))); }.tj-risk-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.tj-risk-title > div { display: grid; gap: 6px; }.tj-risk-title strong { font-size: 0.9375rem; }.tj-risk-title > div > span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }
.tj-risk-four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 11px; }.tj-risk-four > div { min-width: 0; display: grid; gap: 4px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-risk-four small, .tj-risk-control-grid small, .tj-risk-note small, .tj-risk-coach-metrics small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .9px; }.tj-risk-four strong { font-size: 1.08rem; }.tj-risk-four span { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-risk-audit-grid { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.1fr); gap: 10px; margin-top: 11px; }.tj-risk-audit-grid > section { min-width: 0; min-height: 205px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-risk-audit-grid > section > header { display: flex; justify-content: space-between; gap: 8px; color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .9px; }.tj-risk-utilisation { display: grid; gap: 8px; margin-top: 12px; }.tj-risk-utilisation > div { display: grid; grid-template-columns: 72px minmax(0, 1fr) 34px; align-items: center; gap: 8px; }.tj-risk-utilisation strong, .tj-risk-utilisation span { font-size: 0.75rem; }.tj-risk-utilisation i { height: 7px; overflow: hidden; border-radius: 99px; background: var(--tj-panel); }.tj-risk-utilisation i > b { display: block; height: 100%; border-radius: inherit; }.tj-risk-audit-grid > section > footer { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 11px; color: var(--tj-muted); font-size: 0.75rem; }.tj-risk-audit-grid > section > footer i { display: inline-block; }
.tj-risk-breaches { display: grid; gap: 8px; margin-top: 11px; }.tj-risk-breaches > div { display: grid; gap: 7px; padding: 10px; border: 1px solid color-mix(in srgb, var(--tj-red) 45%, var(--tj-border)); border-radius: 10px; background: color-mix(in srgb, var(--tj-red) 7%, var(--tj-panel)); }.tj-risk-breaches header { display: flex; justify-content: space-between; gap: 8px; }.tj-risk-breaches header > span { display: grid; gap: 3px; }.tj-risk-breaches header small { color: var(--tj-red); font-size: 0.75rem; font-weight: 800; letter-spacing: .75px; }.tj-risk-breaches header strong { font-size: 0.8125rem; }.tj-risk-breaches header > b, .tj-risk-breaches em { justify-self: start; padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--tj-red) 45%, var(--tj-border)); border-radius: 99px; color: var(--tj-text); font-size: 0.75rem; font-style: normal; }.tj-risk-breaches p { margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-risk-empty { min-height: 140px; display: grid; place-items: center; color: var(--tj-muted); font-size: 0.75rem; text-align: center; }
.tj-risk-bottom { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(310px, .95fr); gap: 14px; align-items: start; }.tj-risk-control-grid { display: grid; grid-template-columns: minmax(190px, .75fr) minmax(250px, 1fr) minmax(180px, .75fr); gap: 10px; margin-top: 11px; }.tj-risk-control-grid > section { min-width: 0; padding: 11px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel-alt); }.tj-risk-control-grid > section:first-child { display: grid; align-content: start; gap: 5px; }.tj-risk-control-grid > section:first-child > strong { font-size: 1.2825rem; }.tj-risk-control-grid p, .tj-risk-control-grid span { margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-risk-control-grid hr { width: 100%; margin: 10px 0; border: 0; border-top: 1px solid var(--tj-border); }.tj-risk-control-grid > section:nth-child(2) { display: grid; gap: 9px; }.tj-risk-control-grid > section:nth-child(2) > div { display: grid; gap: 7px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel); }.tj-risk-control-grid header { display: flex; justify-content: space-between; gap: 8px; font-size: 0.75rem; }.tj-risk-control-grid header strong { font-size: 0.8125rem; }.tj-risk-control-grid section:nth-child(2) i { height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-risk-control-grid section:nth-child(2) i > b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-risk-control-grid .tj-risk-target { border-color: color-mix(in srgb, var(--tj-purple) 35%, var(--tj-border)); }.tj-risk-target strong { font-size: 1.08rem; }.tj-risk-bases { display: grid; align-content: start; gap: 0; }.tj-risk-bases > div { display: grid; gap: 3px; padding: 8px 0; border-bottom: 1px solid var(--tj-border); }.tj-risk-bases > div:last-child { border-bottom: 0; }.tj-risk-bases strong { font-size: 0.875rem; }
.tj-risk-coach { display: grid; gap: 9px; }.tj-risk-note { display: grid; gap: 5px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-risk-note strong { font-size: 0.875rem; }.tj-risk-note span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.35; }.tj-risk-note-good { border-color: color-mix(in srgb, var(--tj-green) 35%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); }.tj-risk-note-warn { border-color: color-mix(in srgb, var(--tj-amber) 35%, var(--tj-border)); background: color-mix(in srgb, var(--tj-amber) 8%, var(--tj-panel-alt)); }.tj-risk-note-context { background: color-mix(in srgb, var(--tj-purple) 9%, var(--tj-panel-alt)); }.tj-risk-coach-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.tj-risk-coach-metrics > div { min-width: 0; display: grid; gap: 3px; padding: 9px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }.tj-risk-coach-metrics strong, .tj-risk-coach-metrics span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.tj-risk-coach-metrics strong { font-size: 0.875rem; }.tj-risk-coach-metrics span, .tj-risk-coach > footer { color: var(--tj-muted); font-size: 0.75rem; }.tj-risk-coach > footer { line-height: 1.4; }
.tj-risk-insights-workspace { display: grid; gap: 14px; }.tj-risk-insights-summary, .tj-risk-growth, .tj-risk-recommendations { padding: 14px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel)), var(--tj-panel) 58%, color-mix(in srgb, var(--tj-purple) 4%, var(--tj-panel))); }.tj-risk-insight-five { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 11px; }.tj-risk-insight-five > div { min-width: 0; min-height: 88px; display: grid; align-content: space-between; gap: 5px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-risk-insight-five small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .8px; }.tj-risk-insight-five strong { overflow: hidden; font-size: 1.35rem; text-overflow: ellipsis; white-space: nowrap; }.tj-risk-insight-five span { color: var(--tj-muted); font-size: 0.75rem; }
.tj-risk-growth-chart { min-height: 280px; margin-top: 11px; padding: 8px 8px 0 0; border: 1px solid var(--tj-border); border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel-alt)); }.tj-risk-growth > footer { display: flex; gap: 15px; margin-top: 9px; color: var(--tj-muted); font-size: 0.75rem; }.tj-risk-growth > footer span { display: flex; align-items: center; gap: 5px; }.tj-risk-growth > footer i { width: 14px; height: 2px; background: var(--tj-green); }.tj-risk-growth > footer span:last-child i { background: repeating-linear-gradient(90deg, var(--tj-purple) 0 4px, transparent 4px 7px); }
.tj-risk-recommendations > div:last-child { display: grid; gap: 8px; margin-top: 10px; }.tj-risk-recommendation { display: grid; gap: 5px; padding: 11px; border: 1px solid var(--tj-border); border-left-width: 3px; border-radius: 9px; background: var(--tj-panel-alt); }.tj-risk-recommendation small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .9px; }.tj-risk-recommendation strong { font-size: 0.875rem; }.tj-risk-recommendation span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }.tj-risk-recommendation-danger { border-left-color: var(--tj-red); }.tj-risk-recommendation-warning { border-left-color: var(--tj-amber); }.tj-risk-recommendation-good { border-left-color: var(--tj-green); }.tj-risk-recommendation-neutral { border-left-color: var(--tj-purple); }
.tj-analytics-command-grid { display: grid; grid-template-columns: minmax(340px, 1.25fr) minmax(310px, 1fr) minmax(285px, .8fr); gap: 14px; }.tj-analytics-engine, .tj-analytics-rhythm, .tj-analytics-coach { padding: 14px; }.tj-analytics-engine .tj-panel-head, .tj-analytics-rhythm .tj-panel-head, .tj-analytics-coach .tj-panel-head { align-items: start; }.tj-analytics-engine .tj-panel-head > div, .tj-analytics-rhythm .tj-panel-head > div { display: grid; gap: 4px; }.tj-engine-value { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 12px; padding: 12px 0; }.tj-engine-value > div:first-child { display: grid; gap: 6px; }.tj-engine-value > div:first-child > span { color: var(--tj-muted); font-size: 0.8125rem; }.tj-engine-value > div:first-child > strong { font-size: 2.2275rem; line-height: 1; letter-spacing: -1.1px; }.tj-engine-pills { display: flex; flex-wrap: wrap; gap: 5px; }.tj-engine-pills i { padding: 4px 7px; border-radius: 999px; background: var(--tj-panel-alt); color: var(--tj-muted); font-size: 0.75rem; font-style: normal; }.tj-engine-score { display: grid; align-content: center; justify-items: start; gap: 3px; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-engine-score small { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .5px; }.tj-engine-score strong { font-size: 2.025rem; line-height: 1; }.tj-engine-score span { color: var(--tj-muted); font-size: 0.75rem; }.tj-engine-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.tj-engine-metrics > div { display: grid; gap: 3px; min-width: 0; padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-engine-metrics strong { overflow: hidden; font-size: 1.0125rem; text-overflow: ellipsis; white-space: nowrap; }.tj-engine-metrics span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.3; }.tj-engine-trade-mix { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; margin-top: 11px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-engine-trade-mix > i { display: flex; height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-engine-trade-mix em { background: var(--tj-green); }.tj-engine-trade-mix b { background: var(--tj-red); }
.tj-rhythm-top { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 13px; }.tj-rhythm-top > div { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }.tj-rhythm-top strong { font-size: 1.08rem; }.tj-rhythm-top span { color: var(--tj-muted); font-size: 0.75rem; }.tj-rhythm-bars { display: grid; gap: 8px; }.tj-rhythm-bars > div { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 0.75rem; }.tj-rhythm-bars > div > span { color: var(--tj-muted); }.tj-rhythm-bars i { height: 6px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-rhythm-bars em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-rhythm-bars .tj-rhythm-loss { background: var(--tj-red); }.tj-rhythm-bars .tj-rhythm-flat { background: var(--tj-blue); }.tj-rhythm-bars b { font-variant-numeric: tabular-nums; }.tj-coach { display: grid; align-content: start; gap: 9px; }.tj-coach .tj-panel-head { margin-bottom: 1px; }.tj-coach-note, .tj-coach-risk { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 9px; }.tj-coach-note strong, .tj-coach-risk strong { font-size: 0.875rem; line-height: 1.28; }.tj-coach-note span, .tj-coach-risk span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.35; }.tj-coach-good { border-color: color-mix(in srgb, var(--tj-green) 33%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); }.tj-coach-warn { border-color: color-mix(in srgb, var(--tj-amber) 35%, var(--tj-border)); background: color-mix(in srgb, var(--tj-amber) 8%, var(--tj-panel-alt)); }.tj-coach-risk { background: color-mix(in srgb, var(--tj-purple) 8%, var(--tj-panel-alt)); }
.tj-analytics-engine-wide { min-height: 375px; display: grid; align-content: start; gap: 12px; padding: 14px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel)), var(--tj-panel) 52%, color-mix(in srgb, var(--tj-purple) 4%, var(--tj-panel))); }
.tj-engine-wide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }.tj-engine-wide-head > div:first-child { display: grid; gap: 4px; max-width: 290px; }.tj-engine-wide-head > div:first-child > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.15px; }.tj-engine-wide-head > div:first-child > small { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.35; }
.tj-engine-tabs { display: flex; align-items: center; gap: 2px; }.tj-engine-tabs button { min-height: 28px; padding: 0 11px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--tj-muted); font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; }.tj-engine-tabs button:hover { color: var(--tj-text); }.tj-engine-tabs .tj-engine-tab-active { border-color: var(--tj-border); background: var(--tj-panel-alt); color: var(--tj-text); }
.tj-engine-wide-value { display: grid; grid-template-columns: minmax(0, 1fr) 96px; align-items: end; gap: 16px; }.tj-engine-wide-value > div:first-child { display: grid; gap: 8px; }.tj-engine-wide-value > div:first-child > span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }.tj-engine-wide-value > div:first-child > strong { font-size: clamp(34px, 3.3vw, 48px); line-height: .95; letter-spacing: -1.5px; }.tj-engine-wide-value .tj-engine-score { min-height: 76px; padding: 9px; }.tj-engine-wide-value .tj-engine-score strong { font-size: 1.6875rem; }.tj-engine-wide-value .tj-engine-score span { font-size: 0.75rem; }
.tj-analytics-engine-wide .tj-engine-pills { gap: 6px; }.tj-analytics-engine-wide .tj-engine-pills i { border: 1px solid var(--tj-border); background: color-mix(in srgb, var(--tj-panel-alt) 86%, transparent); }
.tj-analytics-engine-wide .tj-engine-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.tj-analytics-engine-wide .tj-engine-metrics > div { min-height: 59px; padding: 9px 10px; }.tj-analytics-engine-wide .tj-engine-metrics strong { font-size: 1.0125rem; }.tj-analytics-engine-wide .tj-engine-metrics span { font-size: 0.75rem; }
.tj-analytics-engine-wide .tj-engine-trade-mix { grid-template-columns: 1fr auto; gap: 6px 10px; margin-top: 0; }.tj-analytics-engine-wide .tj-engine-trade-mix > small { text-align: right; }.tj-analytics-engine-wide .tj-engine-trade-mix > i { grid-column: 1 / -1; height: 7px; }
.tj-engine-drilldown { display: grid; align-content: start; gap: 12px; }.tj-engine-drilldown-hero { display: grid; grid-template-columns: minmax(0, 1fr) 96px; align-items: start; gap: 16px; }.tj-engine-drilldown-hero > div:first-child { display: grid; justify-items: start; gap: 7px; }.tj-engine-drilldown-hero p { max-width: 340px; margin: 0; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.45; }.tj-engine-drilldown-hero h3 { margin: 0; font-size: 1.755rem; line-height: 1; letter-spacing: -.65px; }.tj-engine-drilldown-hero > div:first-child > strong { font-size: clamp(34px, 3vw, 46px); line-height: .95; letter-spacing: -1.35px; }.tj-engine-drilldown-hero .tj-engine-score { min-height: 76px; }.tj-engine-drilldown-hero .tj-engine-score strong { font-size: 1.6875rem; }
.tj-engine-drilldown-cards { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 7px; }.tj-engine-model-cards { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }.tj-engine-drill-card { min-width: 0; display: grid; align-content: start; gap: 4px; padding: 9px; border: 1px solid var(--tj-border); border-radius: 9px; background: var(--tj-panel-alt); }.tj-engine-drill-card > div { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 7px; }.tj-engine-drill-card > div > strong { overflow: hidden; font-size: 0.875rem; text-overflow: ellipsis; white-space: nowrap; }.tj-engine-drill-card > em { overflow: hidden; font-size: 1.08rem; font-style: normal; font-weight: 800; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-engine-drill-card > span { overflow: hidden; color: var(--tj-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }.tj-engine-drill-card > i { height: 6px; overflow: hidden; margin-top: 3px; border-radius: 999px; background: var(--tj-border); }.tj-engine-drill-card > i > small { display: block; height: 100%; border-radius: inherit; }
.tj-analytics-confluence, .tj-analytics-entry-types { display: none; }.tj-analytics-performance-grid { grid-template-columns: 1fr !important; }
.tj-live-analytics { padding: 14px; border-radius: 16px; background: linear-gradient(105deg, color-mix(in srgb, var(--tj-green) 6%, var(--tj-panel)), var(--tj-panel) 52%, color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel))); }
.tj-live-analytics-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }.tj-live-analytics-head > div { display: grid; gap: 5px; }.tj-live-analytics-head > div > strong { font-size: 0.9375rem; }.tj-live-analytics-head > div > span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.4; }
.tj-live-analytics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.tj-live-panel { min-width: 0; min-height: 302px; display: grid; grid-template-rows: auto 1fr auto; gap: 10px; padding: 12px; border: 1px solid var(--tj-border); border-radius: 14px; background: color-mix(in srgb, var(--tj-panel-alt) 94%, transparent); }
.tj-live-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.tj-live-panel-head > div { min-width: 0; display: grid; gap: 4px; }.tj-live-panel-head small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.05px; }.tj-live-panel-head strong { overflow: hidden; font-size: 1.215rem; line-height: 1.05; letter-spacing: -.35px; text-overflow: ellipsis; white-space: nowrap; }.tj-live-panel-head > span { flex-shrink: 0; padding: 5px 8px; border-radius: 999px; background: var(--tj-panel); color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; }
.tj-live-instrument-chart { align-self: stretch; display: grid; align-content: center; gap: 20px; padding: 17px 12px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); }
.tj-live-instrument-row { display: grid; grid-template-columns: minmax(62px, 78px) minmax(0, 1fr) 34px; align-items: center; gap: 9px; }.tj-live-instrument-row > strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }.tj-live-instrument-row > i { height: 19px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--tj-border) 78%, transparent); }.tj-live-instrument-row > i > em { display: block; height: 100%; min-width: 3px; border-radius: inherit; }.tj-live-instrument-row > span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }
.tj-live-donut-wrap { display: grid; place-items: center; padding: 12px; border: 1px solid var(--tj-border); border-radius: 11px; background: var(--tj-panel); }.tj-live-donut { position: relative; width: 145px; max-width: 72%; aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; box-shadow: inset 0 0 24px color-mix(in srgb, var(--tj-purple) 20%, transparent); }.tj-live-donut::before { content: ""; position: absolute; inset: 18px; border: 1px solid var(--tj-border); border-radius: 50%; background: var(--tj-panel); }.tj-live-donut > div { position: relative; z-index: 1; display: grid; justify-items: center; gap: 2px; text-align: center; }.tj-live-donut strong { font-size: 1.9575rem; line-height: 1; }.tj-live-donut span { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; }.tj-live-donut small { max-width: 100px; color: var(--tj-muted); font-size: 0.75rem; line-height: 1.25; }
.tj-live-daily-chart { min-height: 210px; display: grid; align-items: center; padding: 8px 5px 4px 0; border: 1px solid var(--tj-border); border-radius: 11px; background: linear-gradient(180deg, color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel)), var(--tj-panel)); }
.tj-live-chips { display: flex; flex-wrap: wrap; gap: 6px; }.tj-live-chips > span { min-width: 0; display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border: 1px solid var(--tj-border); border-radius: 999px; background: var(--tj-panel); color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }.tj-live-chips > span > i { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 50%; }.tj-live-chips b { font-size: inherit; }
.tj-analytics-support-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.tj-analytics-confluence { padding: 14px; }.tj-analytics-confluence .tj-panel-head > div, .tj-analytics-entry-types .tj-panel-head > div, .tj-analytics-days .tj-panel-head > div { display: grid; gap: 4px; }.tj-confluence-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 10px; }.tj-confluence-card { display: grid; gap: 7px; min-width: 0; padding: 11px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }.tj-confluence-card > strong { overflow: hidden; font-size: 1.1475rem; text-overflow: ellipsis; white-space: nowrap; }.tj-confluence-card > div:nth-child(3) { font-size: 1.2825rem; font-weight: 800; font-variant-numeric: tabular-nums; }.tj-confluence-card-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .55px; }.tj-confluence-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }.tj-confluence-metrics > span { display: grid; gap: 2px; min-width: 0; padding: 7px; border: 1px solid var(--tj-border); border-radius: 7px; background: var(--tj-panel); }.tj-confluence-metrics small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-confluence-metrics b { overflow: hidden; font-size: 0.8125rem; text-overflow: ellipsis; white-space: nowrap; }.tj-confluence-bars { display: grid; grid-template-columns: 43px minmax(0, 1fr) auto; align-items: center; gap: 5px 7px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; }.tj-confluence-bars i { height: 5px; overflow: hidden; border-radius: 99px; background: var(--tj-border); }.tj-confluence-bars em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-confluence-bars b { color: var(--tj-text); font-size: 0.75rem; }
.tj-analytics-performance-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr); gap: 14px; }.tj-analytics-entry-types, .tj-analytics-days { padding: 14px; }.tj-entry-type-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 11px 0; }.tj-entry-type-highlights > div { display: grid; gap: 3px; min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }.tj-entry-type-highlights small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .45px; }.tj-entry-type-highlights strong { overflow: hidden; font-size: 1.0125rem; text-overflow: ellipsis; white-space: nowrap; }.tj-entry-type-highlights span { color: var(--tj-muted); font-size: 0.75rem; }.tj-analytics-entry-types .tj-setup-tags { grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); gap: 10px; }.tj-analytics-entry-types .tj-setup-card { padding: 11px; }
.tj-analytics-scatter { padding: 14px; }.tj-analytics-scatter .tj-scatter-box { min-height: 480px; height: clamp(480px, 49vw, 630px); }.tj-analytics-lower-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(340px, .95fr); gap: 14px; }.tj-analytics-instruments, .tj-analytics-lab, .tj-analytics-sessions { padding: 14px; }.tj-analytics-lab .tj-mlabel { margin: 12px 0 7px; }.tj-analytics-lab .tj-chip-row { gap: 6px; }.tj-analytics-sessions .tj-session-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
/* These legacy drill-downs have dedicated homes in Performance Metrics and
   Execution Rhythm, so the Overview remains focused and compact. */
.tj-analytics-workspace > .tj-analytics-performance-grid,
.tj-analytics-workspace > .tj-analytics-scatter,
.tj-analytics-workspace > .tj-analytics-lower-grid,
.tj-analytics-workspace > .tj-analytics-sessions { display: none; }

/* Review Library — period cards intentionally act as clear launch points for
   a saved monthly, quarterly, or annual reflection. */
.tj-review-library { display: grid; gap: 14px; }
.tj-review-workspace { padding: 14px; }
.tj-review-library-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 13px; }
.tj-review-year-switch { display: flex; align-items: center; gap: 12px; }
.tj-review-year-switch strong { font-size: 1.08rem; min-width: 48px; text-align: center; }
.tj-review-period-title { padding: 7px 11px; margin: 12px 0; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); font-size: 0.75rem; font-weight: 800; letter-spacing: .65px; }
.tj-review-month-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-review-quarter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.tj-review-annual-grid { display: grid; grid-template-columns: minmax(210px, .24fr) 1fr; gap: 10px; }
.tj-review-library-card { min-height: 134px; display: grid; align-content: start; gap: 7px; padding: 12px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); color: var(--tj-text); text-align: left; font: inherit; cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease; }
.tj-review-library-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--tj-green) 56%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel-alt)); }
.tj-review-library-card:focus-visible { outline: 2px solid var(--tj-green); outline-offset: 2px; }
.tj-review-library-card-live { border-color: color-mix(in srgb, var(--tj-green) 30%, var(--tj-border)); }
.tj-review-library-card-compact { min-height: 104px; }
.tj-review-card-top, .tj-review-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tj-review-card-top { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .55px; }
.tj-review-card-top b { font-size: 0.875rem; }
.tj-review-library-card > strong { font-size: 1.1475rem; line-height: 1.1; }
.tj-review-library-card > small { color: var(--tj-muted); min-height: 16px; font-size: 0.8125rem; }
.tj-review-card-foot { margin-top: auto; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-library-card > i, .tj-period-meter-grid i { display: block; height: 5px; overflow: hidden; border-radius: 999px; background: var(--tj-border); }
.tj-review-library-card > i > em, .tj-period-meter-grid i > em { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }
.tj-trades-to-review { padding: 14px; }
.tj-period-trades-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 11px; }
.tj-count-badge { display: inline-grid; place-items: center; min-width: 25px; height: 25px; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--tj-purple) 17%, var(--tj-panel-alt)); color: var(--tj-purple); font-size: 0.8125rem; font-weight: 800; }
.tj-review-pending-list { display: grid; gap: 7px; }
.tj-period-trade-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-period-trade-row > div:first-child { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px 7px; }
.tj-period-trade-row strong { font-size: 0.875rem; }
.tj-period-trade-row small { width: 100%; color: var(--tj-muted); font-size: 0.75rem; }
.tj-period-trade-row > div:last-child { display: flex; flex-shrink: 0; align-items: center; gap: 8px; }
.tj-review-status-done, .tj-review-status-pending { display: inline-flex; align-items: center; border-radius: 5px; padding: 3px 6px; font-size: 0.75rem; font-weight: 800; white-space: nowrap; }
.tj-review-status-done { background: var(--tj-primary-muted); color: var(--tj-green); }
.tj-review-status-pending { background: color-mix(in srgb, var(--tj-red) 13%, transparent); color: var(--tj-red); }
.tj-review-trade-meta { display: grid; gap: 3px; padding: 11px; margin-bottom: 14px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-review-trade-meta span { color: var(--tj-muted); font-size: 0.8125rem; }
.tj-period-review-summary, .tj-period-at-glance { padding: 13px; margin-bottom: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-period-review-title { display: grid; gap: 5px; margin-bottom: 12px; }
.tj-period-review-title > span { color: var(--tj-muted); font-size: 0.8125rem; }
.tj-period-metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tj-period-metric-grid-reference { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.tj-period-metric-grid > div, .tj-period-meter-grid > div { display: grid; align-content: start; gap: 4px; min-width: 0; padding: 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); }
.tj-period-metric-grid small, .tj-period-meter-grid small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .5px; }
.tj-period-metric-grid strong { font-size: 1.08rem; font-variant-numeric: tabular-nums; }
.tj-period-metric-grid span, .tj-period-meter-grid span { color: var(--tj-muted); font-size: 0.75rem; line-height: 1.3; }
.tj-period-metric-grid em { color: var(--tj-muted); font-size: 0.75rem; font-style: normal; line-height: 1.3; }
.tj-period-complete-yes { border-color: color-mix(in srgb, var(--tj-green) 38%, var(--tj-border)) !important; background: color-mix(in srgb, var(--tj-green) 9%, var(--tj-panel)) !important; }
.tj-period-complete-no { border-color: color-mix(in srgb, var(--tj-red) 38%, var(--tj-border)) !important; background: color-mix(in srgb, var(--tj-red) 8%, var(--tj-panel)) !important; }
.tj-period-performance { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tj-period-performance > span { display: inline-flex; align-items: center; gap: 5px; }
.tj-period-performance i { width: 11px; height: 11px; border-radius: 50%; background: color-mix(in srgb, var(--tj-purple) 24%, var(--tj-border)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tj-purple) 32%, transparent); }
.tj-period-performance i.tj-score-dot-on { background: var(--tj-purple); box-shadow: 0 0 10px color-mix(in srgb, var(--tj-purple) 45%, transparent); }
.tj-period-meter-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.tj-period-meter-grid b { overflow: hidden; font-size: 0.875rem; text-overflow: ellipsis; white-space: nowrap; }
.tj-result-meter { display: flex !important; }
.tj-result-meter strong { display: block; height: 100%; background: var(--tj-red); }
.tj-period-at-glance { display: grid; gap: 9px; }
.tj-period-at-glance .tj-field { margin: 0; }
.tj-period-sections { display: grid; gap: 9px; }
.tj-period-section { overflow: hidden; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }
.tj-period-section-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px; border: none; background: none; color: var(--tj-text); text-align: left; font: inherit; cursor: pointer; }
.tj-period-section-head strong { font-size: 0.875rem; text-transform: uppercase; }
.tj-period-section-head svg { color: var(--tj-muted); transition: transform .16s ease; }
.tj-period-section-body { display: grid; gap: 10px; padding: 0 11px 11px; border-top: 1px solid var(--tj-border); }
.tj-period-section-body .tj-field { margin: 0; padding-top: 10px; }
.tj-period-section-body .tj-textarea { min-height: 78px; }
.tj-period-trades { padding: 13px; margin-top: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-period-trades .tj-period-trade-row { margin-top: 7px; }
.tj-period-trades-scroll { display: grid; gap: 7px; }
.tj-period-trades-scrollable { max-height: 272px; overflow-y: auto; padding-right: 5px; scrollbar-gutter: stable; }
.tj-period-trade-reference-row { width: 100%; min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 10px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel); color: var(--tj-text); text-align: left; font: inherit; cursor: pointer; }
.tj-period-trade-reference-row:hover { border-color: color-mix(in srgb, var(--tj-green) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 5%, var(--tj-panel)); }
.tj-period-trade-reference-row > div { min-width: 0; display: grid; gap: 5px; }
.tj-period-trade-reference-row > div > span { min-width: 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.tj-period-trade-reference-row strong { font-size: 0.875rem; }
.tj-period-trade-reference-row em { padding: 2px 5px; border: 1px solid color-mix(in srgb, var(--tj-purple) 70%, var(--tj-border)); border-radius: 4px; background: color-mix(in srgb, var(--tj-purple) 12%, transparent); color: var(--tj-purple); font-size: 0.75rem; font-style: normal; }
.tj-period-trade-reference-row > div > span:first-child > em { padding: 0; border: 0; background: none; font-weight: 800; }
.tj-period-trade-reference-row small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-period-result-win, .tj-period-result-loss, .tj-period-result-flat { flex: 0 0 auto; padding: 6px 10px; border-radius: 999px; font-size: 0.75rem !important; letter-spacing: .4px; }
.tj-period-result-win { background: color-mix(in srgb, var(--tj-green) 16%, transparent); color: var(--tj-green); }
.tj-period-result-loss { background: color-mix(in srgb, var(--tj-red) 16%, transparent); color: var(--tj-red); }
.tj-period-result-flat { background: var(--tj-panel-alt); color: var(--tj-muted); }
.tj-period-review-longform { display: grid; gap: 5px; padding: 13px; margin-top: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }
.tj-period-review-longform .tj-period-sections { margin-top: 7px; }
.tj-modal-head-actions { display: flex; align-items: center; gap: 7px; }
.tj-modal-confirm { color: var(--tj-green); border-color: color-mix(in srgb, var(--tj-green) 48%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 12%, var(--tj-panel-alt)); }
.tj-modal-confirm:disabled { opacity: .38; cursor: not-allowed; }
.tj-review-table-wrap { overflow-x: auto; }
.tj-review-table { min-width: 1160px; display: grid; grid-template-columns: 1.25fr .58fr .72fr 1.05fr .78fr 2.35fr .78fr .9fr .38fr; align-items: center; gap: 12px; }
.tj-review-table-head { padding: 8px 10px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .65px; }
.tj-review-table-row { width: 100%; padding: 12px 10px; border: 0; border-top: 1px solid var(--tj-border); background: transparent; color: var(--tj-text); text-align: left; font: inherit; font-size: 0.8125rem; cursor: pointer; transition: background .15s ease; }
.tj-review-table-row:hover { background: color-mix(in srgb, var(--tj-green) 5%, transparent); }
.tj-review-table-row:focus-visible { outline: 2px solid var(--tj-green); outline-offset: -2px; }
.tj-review-table-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tj-review-table-row > span:first-child { display: flex; align-items: center; gap: 9px; }
.tj-review-table-row > span:first-child em { font-size: 0.75rem; font-style: normal; font-weight: 800; }
.tj-review-table-row > span:nth-last-child(-n+2) { font-variant-numeric: tabular-nums; }
.tj-review-table-tags { display: flex; gap: 4px; overflow: hidden; }
.tj-review-table-tags em { padding: 2px 5px; border: 1px solid var(--tj-purple); border-radius: 4px; background: color-mix(in srgb, var(--tj-purple) 13%, transparent); color: var(--tj-purple); font-size: 0.75rem; font-style: normal; }
.tj-review-editor-modal, .tj-period-review-modal { width: min(920px, 96vw); }
.tj-review-editor-intro { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-trade-banner { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 12px; margin-bottom: 10px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); }
.tj-review-trade-banner > div { display: grid; gap: 5px; }
.tj-review-trade-banner > div > strong { font-size: 1.0125rem; }
.tj-review-trade-banner > div > span { display: flex; align-items: center; gap: 10px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-trade-banner em { font-style: normal; }
.tj-review-trade-banner > strong { font-size: 1.08rem; font-variant-numeric: tabular-nums; }
.tj-review-reference-stack { display: grid; gap: 9px; padding: 12px; margin-bottom: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: color-mix(in srgb, var(--tj-panel-alt) 80%, transparent); }
.tj-review-reference-card { padding: 10px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel); }
.tj-review-reference-card > header, .tj-review-markup-shots-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-reference-card > header > div { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.tj-review-reference-card > header em { padding: 2px 5px; border-radius: 4px; background: var(--tj-panel-alt); font-style: normal; font-weight: 800; }
.tj-review-reference-card > header small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-reference-card > p, .tj-review-journal-block > p { margin: 9px 0 0; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-brief-rows { display: grid; margin-top: 7px; }
.tj-review-brief-rows > div { min-height: 27px; display: grid; grid-template-columns: 100px minmax(0, 1fr); align-items: center; gap: 8px; border-top: 1px solid var(--tj-border); }
.tj-review-brief-rows span, .tj-review-journal-block > span, .tj-review-markup-shots-head > span, .tj-review-execution-grid span { color: var(--tj-muted); font-size: 0.75rem; letter-spacing: .5px; }
.tj-review-brief-rows strong { font-size: 0.75rem; }
.tj-review-markup-title { display: block; margin-top: 7px; font-size: 0.9375rem; }
.tj-review-markup-meta { display: flex; gap: 10px; padding: 7px 0; color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-markup-shots-head { padding-top: 8px; border-top: 1px solid var(--tj-border); }
.tj-review-markup-shots { display: flex; gap: 8px; margin-top: 7px; overflow-x: auto; }
.tj-review-markup-shots > div { min-width: 166px; display: grid; grid-template-columns: 64px 1fr; grid-template-rows: auto auto; align-items: center; gap: 2px 8px; padding: 6px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-review-markup-shots .tj-image-preview { grid-row: 1 / 3; width: 64px; height: 42px; }
.tj-review-markup-shots strong { font-size: 0.75rem; }
.tj-review-markup-shots small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-execution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 7px; }
.tj-review-execution-grid > div { display: grid; gap: 4px; padding: 9px; border: 1px solid var(--tj-border); border-radius: 8px; background: var(--tj-panel-alt); }
.tj-review-execution-grid strong { font-size: 1.0125rem; }
.tj-review-execution-grid small { color: var(--tj-muted); font-size: 0.75rem; }
.tj-review-journal-block { display: grid; gap: 7px; margin-top: 9px; }
.tj-review-journal-block .tj-tag { cursor: default; font-size: 0.75rem; font-style: normal; padding: 2px 6px; }
.tj-review-trade-shots { display: flex; gap: 7px; overflow-x: auto; }
.tj-review-trade-shots .tj-image-preview { width: 90px; height: 58px; flex: 0 0 90px; }
.tj-review-editor-modal .tj-textarea { min-height: 62px; }

@media (max-width: 1200px) {
  .tj-psychology-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-analytics-deck { grid-template-columns: minmax(0, 1fr) auto; }
  .tj-analytics-deck-tabs { grid-column: 1 / -1; grid-row: 2; justify-self: stretch; overflow-x: auto; }
  .tj-analytics-period-wrap { grid-column: 2; grid-row: 1; }
  .tj-live-analytics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-live-panel:last-child { grid-column: 1 / -1; }
  .tj-engine-drilldown-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-performance-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-risk-bottom, .tj-risk-control-grid { grid-template-columns: 1fr; }
  .tj-risk-insight-five { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .tj-psychology-main { grid-template-columns: 1fr; }
  .tj-settings-hero-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-analytics-command-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .tj-analytics-engine { grid-column: 1 / -1; }
  .tj-analytics-performance-grid, .tj-analytics-lower-grid { grid-template-columns: 1fr; }
  .tj-analytics-equity-main { grid-template-columns: 1fr; }
  .tj-analytics-equity-milestones { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-live-analytics-grid { grid-template-columns: 1fr; }
  .tj-live-panel:last-child { grid-column: auto; }
  .tj-engine-drilldown-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-performance-stat-grid, .tj-performance-instrument-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-performance-four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-core-breakdown-grid, .tj-execution-bottom { grid-template-columns: 1fr; }
  .tj-risk-audit-grid { grid-template-columns: 1fr; }
  .tj-risk-four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
  .tj-content-inner { width: 100%; }
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
  .tj-tradelog-reference-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }.tj-reference-tradelog-row .tj-tlog-row { flex-wrap: wrap; }.tj-reference-trade-left { flex-wrap: wrap; }.tj-reference-trade-left .tj-tlog-main { min-width: 150px; }.tj-reference-trade-meta { min-width: 180px; }.tj-reference-trade-detail-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tj-reference-trade-left { width:100%; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 16px; }.tj-reference-trade-left .tj-tlog-main { min-width:0; }.tj-reference-trade-left .tj-reference-trade-meta { grid-column:1 / -1; grid-row:2; min-width:0; }.tj-reference-trade-direction, .tj-reference-trade-session { min-width:0; }
  .tj-markup-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.tj-markup-detail-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .tj-insights-hero { align-items: flex-start; flex-direction: column; }
  .tj-insights-return { width: 100%; }
  .tj-analytics-deck { grid-template-columns: 1fr; align-items: stretch; }
  .tj-analytics-period-wrap { grid-column: 1; grid-row: 2; justify-self: start; }
  .tj-analytics-period-popover { right: auto; left: 0; }
  .tj-analytics-deck-tabs { grid-column: 1; grid-row: 3; }
  .tj-engine-wide-head { flex-direction: column; }
  .tj-engine-tabs { width: 100%; overflow-x: auto; }
  .tj-engine-drilldown-hero { grid-template-columns: 1fr; }
  .tj-engine-drilldown-hero .tj-engine-score { max-width: 150px; }
  .tj-engine-drilldown-cards { grid-template-columns: 1fr; }
  .tj-performance-highlights, .tj-performance-stat-grid, .tj-performance-instrument-grid { grid-template-columns: 1fr; }
  .tj-performance-instrument-card > section { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-performance-recent > div, .tj-performance-month-list > div { grid-template-columns: 1fr; gap: 6px; }
  .tj-performance-recent > div > span:last-child, .tj-performance-month-list span, .tj-performance-month-list em { text-align: left; }
  .tj-execution-four, .tj-execution-week-grid, .tj-execution-day-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-core-breakdown-grid > section:first-child > div:first-child, .tj-discipline-head { grid-template-columns: 1fr; }
  .tj-discipline-grid { grid-template-columns: 1fr; }
  .tj-risk-four, .tj-risk-coach-metrics { grid-template-columns: 1fr; }
  .tj-risk-insight-five { grid-template-columns: 1fr; }
  .tj-analytics-support-grid { grid-template-columns: 1fr; }
  .tj-toolbar { flex-direction: column; height: auto; align-items: stretch; padding: 12px; gap: 10px; overflow-x: visible; }
  .tj-toolbar-search { flex: none; width: 100%; height: 40px; }
  .tj-toolbar-right { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
  .tj-toolbar-dd, .tj-toolbar-pill { width: 100%; height: 38px; text-align: center; justify-content: center; }
  .tj-reference-markup-row { align-items: flex-start; flex-direction: column; }
  .tj-reference-markup-actions { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
  .tj-reference-markup-actions .tj-markup-pnl { margin-right: auto; text-align: left; }
  .tj-markup-expanded-grid, .tj-markup-charts-head, .tj-markup-chart-columns { grid-template-columns: 1fr; }
  .tj-markup-charts-head span:nth-child(2) { margin-top: 8px; }
  .tj-reference-trade-main-grid, .tj-reference-journal-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .tj-insights-hero-copy h2 { font-size: 1.6875rem; }
  .tj-insights-pills { align-items: stretch; flex-direction: column; }
  .tj-psychology-hero { align-items: flex-start; flex-direction: column; }
  .tj-psychology-score { width: 100%; justify-items: start; }
  .tj-psychology-summary { grid-template-columns: 1fr; }
  .tj-management-grid { grid-template-columns: 1fr; }
  .tj-management-workspace .tj-page-intro { align-items: flex-start; flex-direction: column; }
  .tj-settings-account-hero { grid-template-columns: 58px minmax(0, 1fr); padding: 13px; }
  .tj-settings-hero-avatar { width: 58px; height: 58px; border-radius: 12px; font-size: 1.5525rem; }
  .tj-settings-hero-copy strong { font-size: 1.2825rem; }
  .tj-settings-hero-metrics { grid-template-columns: 1fr 1fr; gap: 7px; }
  .tj-personal-profile-fields, .tj-settings-info-grid, .tj-settings-reset-grid { grid-template-columns: 1fr; }
  .tj-settings-section-end em { max-width: 84px; }
  .tj-analytics-equity-head { align-items: stretch; flex-direction: column; }
  .tj-analytics-hero-return { min-width: 0; }
  .tj-analytics-equity-milestones, .tj-analytics-equity-side, .tj-analytics-command-grid, .tj-engine-metrics, .tj-rhythm-top, .tj-entry-type-highlights { grid-template-columns: 1fr 1fr; }
  .tj-engine-value { grid-template-columns: 1fr; }
  .tj-engine-wide-value { grid-template-columns: 1fr; }
  .tj-engine-wide-value .tj-engine-score { max-width: 150px; }
  .tj-engine-score { grid-template-columns: auto 1fr; align-items: center; }
  .tj-analytics-scatter .tj-scatter-box { min-height: 360px; height: 360px; }
  .tj-review-library-head { align-items: flex-start; flex-direction: column; }
  .tj-review-month-grid, .tj-review-quarter-grid, .tj-review-annual-grid, .tj-period-metric-grid, .tj-period-meter-grid { grid-template-columns: 1fr; }
  .tj-review-annual-grid { display: block; }
  .tj-review-library-card { min-height: 112px; }
  .tj-period-trade-row { align-items: flex-start; flex-direction: column; }
  .tj-period-trade-row > div:last-child { width: 100%; justify-content: space-between; }
  .tj-command-panel { padding: 16px; }
  .tj-command-title { font-size: 1.35rem; }
  .tj-command-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-stats-grid { grid-template-columns: 1fr 1fr; }
  .tj-tradelog-stats { grid-template-columns: 1fr 1fr; }
  .tj-tlog-row { gap: 8px; }
  .tj-modal-wide { width: 100%; }
  .tj-grid3, .tj-grid2, .tj-grid4 { grid-template-columns: 1fr; }
  .tj-scatter-box { height: 330px; }
  .tj-markup-images { grid-template-columns: 1fr; }
  .tj-markup-filter-grid { grid-template-columns: 1fr; }
  .tj-markup-filter-grid .tj-field:last-child { grid-column: auto; }
  .tj-markup-detail-top { grid-template-columns: 1fr 1fr; }
  .tj-markup-plan-rows > div { grid-template-columns: 1fr; gap: 4px; }
  .tj-reference-trade-brief-rows > div { grid-template-columns: 1fr; gap: 4px; }
  .tj-reference-link-controls { grid-template-columns: 1fr; }
  .tj-markup-image-section .tj-image-preview { height: 190px; }
  .tj-tlog-shots .tj-image-preview { width: min(100%, 280px); height: 180px; }
  .tj-cal-cell { aspect-ratio: 0.85; padding: 3px; border-radius: 6px; }
  .tj-cal-day { font-size: 0.75rem; margin-bottom: 0; }
  .tj-cal-pnl { font-size: 0.75rem; line-height: 1.1; }
  .tj-cal-tcount { font-size: 0.75rem; margin-top: 0; }
  .tj-cal-grid { gap: 2px; }
  .tj-cal-dow { font-size: 0.75rem; }
  .tj-settings-section-body { padding: 12px; }.tj-reference-kpis, .tj-guardrail-grid, .tj-flow-grid, .tj-dashboard-analytics-grid { grid-template-columns: 1fr 1fr; }.tj-reference-kpi { min-height: 118px; padding: 11px; }.tj-reference-kpi-value { font-size: 1.215rem; }.tj-recent-head { display: none; }.tj-recent-row { grid-template-columns: 1fr auto; gap: 5px 10px; padding: 10px; }.tj-recent-row span:nth-child(3), .tj-recent-row span:nth-child(4) { font-size: 0.8125rem; }.tj-recent-row strong:nth-child(2) { grid-row: 1; grid-column: 1; }.tj-recent-row span:first-child { grid-row: 2; grid-column: 1; color: var(--tj-muted); font-size: 0.75rem; }.tj-recent-row strong:last-child { grid-row: 1 / span 2; grid-column: 2; align-self: center; }.tj-flow-last { grid-column: 1 / -1; }.tj-reference-calendar, .tj-reference-weeks, .tj-reference-flow { padding: 12px; }.tj-reference-calendar .tj-cal-cell { min-height: 62px; }.tj-reference-month-head { align-items: flex-start; flex-direction: column; }.tj-reference-month-total { justify-content: flex-start; }.tj-reference-calendar-body { grid-template-columns: 1fr; }.tj-reference-week-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: auto; }.tj-reference-week { min-height: 62px; }.tj-reference-flow { min-height: auto; }.tj-reference-flow-head { flex-direction: column; }.tj-dashboard-core-score { grid-column: 1 / -1; }.tj-dashboard-analytics-grid > .tj-panel { min-height: 340px; }
  .tj-markup-overview-grid { grid-template-columns: 1fr; }.tj-markup-filter-controls { display: grid; grid-template-columns: 1fr 1fr; }.tj-markup-filter-controls .tj-toolbar-search { grid-column: 1 / -1; }.tj-reference-markup-card .tj-tlog-row { align-items: flex-start; flex-wrap: wrap; padding: 11px; }.tj-reference-markup-card .tj-tlog-main { min-width: calc(100% - 115px); }.tj-markup-pnl { margin-left: auto; }.tj-markup-detail-top { grid-template-columns: 1fr 1fr; }.tj-linked-markup-trade { align-items: flex-start; }.tj-linked-markup-trade > div:last-child { min-width: 85px; }
  .tj-tradelog-reference-summary { grid-template-columns: 1fr 1fr; }.tj-tradelog-reference-summary > div { padding: 10px; }.tj-tradelog-filter-controls { display: grid; grid-template-columns: 1fr 1fr; }.tj-tradelog-filter-controls .tj-toolbar-search { grid-column: 1 / -1; }.tj-tradelog-sort-controls { flex-wrap: wrap; }.tj-reference-tradelog-row .tj-tlog-row { align-items: stretch; flex-direction: column; padding: 11px; }.tj-reference-trade-left { width: 100%; flex-wrap: wrap; }.tj-reference-trade-left .tj-tlog-main { flex: 1 1 120px; min-width: 120px; }.tj-reference-trade-meta { flex: 1 1 170px; min-width: 170px; }.tj-reference-trade-right { width: 100%; }.tj-reference-tradelog-row .tj-tlog-pnl-block { margin-right: auto; text-align: left; }.tj-reference-trade-detail-summary { grid-template-columns: 1fr 1fr; }.tj-reference-linked-markup { align-items: flex-start; }.tj-reference-linked-markup > span { text-align: right; }
}
@media (max-width: 560px) {
  .tj-image-viewer { padding: 14px; }
  .tj-image-viewer img { max-width: 96vw; max-height: 84vh; }
  .tj-image-viewer-close { top: 10px; right: 10px; }
  .tj-shot-thumb, .tj-shot-add { width: 100%; height: auto; }
  .tj-tlog-shots .tj-image-preview { width: 100%; height: 185px; }
  .tj-scatter-quad { font-size: 0.75rem; padding: 7px; }
  .tj-scatter-dot { max-width: 80px; font-size: 0.75rem; padding: 2px 5px; }
}

/* Compact day details shared by every calendar. */
.tj-calendar-day-modal { width: 560px; }
.tj-calendar-day-modal .tj-modal-head { padding: 16px; }
.tj-calendar-day-modal .tj-modal-title { font-size: 1rem; }
.tj-calendar-day-modal .tj-modal-body { padding: 16px; }
.tj-calendar-day-modal .tj-daymodal-summary { margin-bottom: 10px; font-size: 0.875rem; }
.tj-day-trade-list { display: grid; gap: 10px; }
.tj-day-trade { min-width: 0; padding: 11px 12px 8px; border: 1px solid var(--tj-border); border-left: 2px solid var(--tj-green); border-radius: 16px; background: color-mix(in srgb, var(--tj-input-bg) 58%, transparent); }
.tj-day-trade-loss { border-left-color: var(--tj-red); }
.tj-day-trade-be { border-left-color: var(--tj-blue); }
.tj-day-trade-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 0 8px 18px; }
.tj-day-trade-identity { min-width: 0; }
.tj-day-trade-identity > strong { font-size: 0.9375rem; overflow-wrap: anywhere; }
.tj-day-trade-identity > div { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 3px; font-size: 0.75rem; font-weight: 700; color: var(--tj-muted); }
.tj-day-trade-result { display: flex; align-items: baseline; justify-content: flex-end; flex-wrap: wrap; gap: 6px; font-variant-numeric: tabular-nums; }
.tj-day-trade-result strong { font-size: 1.0125rem; }
.tj-day-trade-result small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 700; }
.tj-day-trade-tags { padding: 6px 0; border-top: 1px solid color-mix(in srgb, var(--tj-border) 38%, transparent); color: var(--tj-muted); font-size: 0.75rem; font-weight: 650; overflow-wrap: anywhere; }
.tj-day-trade-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 7px; border-top: 1px solid color-mix(in srgb, var(--tj-border) 38%, transparent); }
.tj-day-trade-shots { min-width: 0; display: flex; flex-wrap: wrap; gap: 7px; }
.tj-calendar-day-modal .tj-day-trade-shots .tj-image-preview { flex: 0 0 96px; width: 96px; height: 66px; padding: 4px; border-radius: 8px; }
.tj-calendar-day-modal .tj-day-trade-shots .tj-image-preview img { display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 3px; }
.tj-day-trade-actions { flex-shrink: 0; display: flex; gap: 6px; margin-left: auto; }
.tj-day-trade-actions .tj-icon-btn { width: 35px; height: 27px; border-radius: 99px; background: var(--tj-panel-alt); }
.tj-day-trade-actions .tj-day-trade-delete { color: var(--tj-red); border-color: color-mix(in srgb, var(--tj-red) 40%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 15%, var(--tj-panel-alt)); }
@media (max-width: 420px) { .tj-day-trade-head { padding-left: 0; } .tj-day-trade-footer { flex-wrap: wrap; } }

/* Attached P&L calendar — shared by Dashboard and Calendar. */
.tj-attached-calendar { padding: 18px; border-radius: 22px; background: linear-gradient(145deg, color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel-alt)), color-mix(in srgb, var(--tj-blue) 5%, var(--tj-panel)) 72%); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--tj-text) 4%, transparent), 0 12px 30px rgba(0,0,0,.16); }
.tj-attached-calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.tj-attached-month-nav { display: flex; align-items: center; gap: 8px; }
.tj-attached-month-nav strong { font-size: 1.08rem; font-weight: 600; white-space: nowrap; }
.tj-attached-month-nav button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 1px solid var(--tj-border); border-radius: 10px; background: color-mix(in srgb, var(--tj-input-bg) 78%, transparent); color: var(--tj-muted); cursor: pointer; }
.tj-attached-month-nav button:hover, .tj-attached-month-nav button:focus-visible { color: var(--tj-text); background: var(--tj-panel-alt); outline: none; }
.tj-attached-month-nav .tj-attached-this-month { width: auto; min-width: 78px; margin-left: 2px; padding: 0 12px; border-radius: 99px; color: var(--tj-text); font-size: 0.8125rem; font-weight: 750; }
.tj-attached-month-result { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; color: var(--tj-muted); font-size: 0.8125rem; white-space: nowrap; }
.tj-attached-month-result strong { margin-right: 2px; font-size: 1.08rem; font-weight: 750; }
.tj-attached-month-result > span { display: inline-flex; align-items: center; min-height: 24px; padding: 0 9px; border: 1px solid transparent; border-radius: 99px; background: color-mix(in srgb, var(--tj-panel-alt) 84%, transparent); font-size: 0.75rem; font-weight: 800; }
.tj-attached-month-result .tj-month-win { color: var(--tj-green); border-color: color-mix(in srgb, var(--tj-green) 30%, transparent); background: color-mix(in srgb, var(--tj-green) 11%, var(--tj-panel-alt)); }
.tj-attached-month-result .tj-month-loss { color: var(--tj-red); border-color: color-mix(in srgb, var(--tj-red) 30%, transparent); background: color-mix(in srgb, var(--tj-red) 11%, var(--tj-panel-alt)); }
.tj-attached-month-result .tj-month-be { color: var(--tj-blue); border-color: color-mix(in srgb, var(--tj-blue) 30%, transparent); background: color-mix(in srgb, var(--tj-blue) 10%, var(--tj-panel-alt)); }
.tj-attached-calendar-scroll { max-width: 100%; overflow-x: auto; padding: 14px; border: 1px solid color-mix(in srgb, var(--tj-border) 54%, transparent); border-radius: 20px; background-image: linear-gradient(color-mix(in srgb, var(--tj-muted) 4%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--tj-muted) 4%, transparent) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--tj-input-bg) 88%, transparent), color-mix(in srgb, var(--tj-input-bg) 88%, transparent)); background-size: 28px 28px, 28px 28px, auto; box-shadow: inset 0 1px 18px rgba(0,0,0,.08); scrollbar-width: thin; }
.tj-attached-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(72px, 1fr)) 152px; gap: 8px; min-width: 720px; }
.tj-attached-dow { padding: 3px 8px 7px; color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: 1.05px; text-transform: uppercase; }
.tj-attached-day, .tj-attached-day-empty, .tj-attached-week { min-height: 72px; }
.tj-attached-day { display: flex; flex-direction: column; min-width: 0; padding: 8px; border: 1px solid color-mix(in srgb, var(--tj-border) 38%, transparent); border-radius: 15px; background: color-mix(in srgb, var(--tj-panel-alt) 46%, transparent); color: var(--tj-text); font: inherit; text-align: left; transition: transform .16s ease, border-color .16s ease, background .16s ease; }
.tj-attached-day-quiet { border-style: solid; }
.tj-attached-day-win { border-style: dashed; border-color: color-mix(in srgb, var(--tj-green) 36%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 4%, var(--tj-panel-alt)); cursor: pointer; }
.tj-attached-day-loss { border-style: dashed; border-color: color-mix(in srgb, var(--tj-red) 36%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 4%, var(--tj-panel-alt)); cursor: pointer; }
.tj-attached-day-be { border-style: dashed; border-color: color-mix(in srgb, var(--tj-blue) 36%, var(--tj-border)); background: color-mix(in srgb, var(--tj-blue) 4%, var(--tj-panel-alt)); cursor: pointer; }
.tj-attached-day-win:hover, .tj-attached-day-loss:hover, .tj-attached-day-be:hover { transform: translateY(-1px); }
.tj-attached-day-today { box-shadow: inset 0 0 0 1px var(--tj-purple); }
.tj-attached-day-number { margin-bottom: 4px; color: var(--tj-muted); font-size: 0.8125rem; }
.tj-attached-day-placeholder { flex: 1; margin-top: 4px; border: 1px dashed color-mix(in srgb, var(--tj-border) 24%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--tj-bg) 8%, transparent); }
.tj-attached-day-pill { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 4px; width: 100%; margin-top: 4px; padding: 4px 6px; border: 1px solid currentColor; border-radius: 10px; font-size: 0.8125rem; box-shadow: 0 3px 10px rgba(0,0,0,.12); }
.tj-attached-day-pill b { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.tj-attached-day-pill i { font-style: normal; font-size: 0.8125rem; }
.tj-attached-day-win .tj-attached-day-pill { color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 17%, var(--tj-panel-alt)); border-color: color-mix(in srgb, var(--tj-green) 58%, var(--tj-border)); }
.tj-attached-day-loss .tj-attached-day-pill { color: var(--tj-red); background: color-mix(in srgb, var(--tj-red) 17%, var(--tj-panel-alt)); border-color: color-mix(in srgb, var(--tj-red) 58%, var(--tj-border)); }
.tj-attached-day-be .tj-attached-day-pill { color: var(--tj-blue); background: color-mix(in srgb, var(--tj-blue) 16%, var(--tj-panel-alt)); border-color: color-mix(in srgb, var(--tj-blue) 58%, var(--tj-border)); }
.tj-attached-week { display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--tj-border) 62%, transparent); border-radius: 15px; background: color-mix(in srgb, var(--tj-panel-alt) 88%, var(--tj-input-bg)); }
.tj-attached-week-active { border-color: color-mix(in srgb, var(--tj-green) 30%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel-alt)); }
.tj-attached-week-loss { border-color: color-mix(in srgb, var(--tj-red) 30%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 7%, var(--tj-panel-alt)); }
.tj-attached-week small { color: var(--tj-muted); font-size: 0.75rem; font-weight: 800; letter-spacing: .8px; }
.tj-attached-week strong { font-size: 1.08rem; font-weight: 750; }
.tj-attached-week-bar { display: block; overflow: hidden; width: 100%; height: 5px; border-radius: 99px; background: color-mix(in srgb, var(--tj-border) 70%, transparent); }
.tj-attached-week-bar b { display: block; min-width: 0; height: 100%; border-radius: inherit; background: var(--tj-green); }
.tj-attached-week-loss .tj-attached-week-bar b { background: var(--tj-red); }
.tj-attached-week span { color: var(--tj-muted); font-size: 0.8125rem; white-space: nowrap; }
.tj-dashboard-welcome { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 360px); align-items: center; gap: 32px; padding: 26px 0 30px; margin-bottom: 22px; border-bottom: 1px solid var(--tj-border); }
.tj-dashboard-welcome-copy { min-width: 0; }
.tj-dashboard-welcome-copy > span { color: var(--tj-green); font-size: .65rem; letter-spacing: 1.7px; font-weight: 650; }
.tj-dashboard-welcome h1 { font-size: clamp(1.6rem, 2.8vw, 2.6rem); line-height: 1.15; letter-spacing: -1.2px; margin: 12px 0 14px; overflow-wrap: anywhere; }
.tj-dashboard-welcome h1 { width: fit-content; max-width: 100%; color: var(--tj-green); }
@supports ((background-clip: text) or (-webkit-background-clip: text)) {
  .tj-dashboard-welcome h1 { background: linear-gradient(105deg, var(--tj-green) 0%, color-mix(in srgb, var(--tj-green) 40%, var(--tj-text)) 32%, var(--tj-text) 52%, color-mix(in srgb, var(--tj-green) 75%, var(--tj-text)) 76%, var(--tj-green) 100%); background-clip: text; -webkit-background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
}
@media (forced-colors: active) { .tj-dashboard-welcome h1 { background: none; color: CanvasText; -webkit-text-fill-color: CanvasText; } }
.tj-dashboard-welcome p { color: var(--tj-muted); font-size: .875rem; line-height: 1.6; margin: 0; }
.tj-dashboard-quote { display: flex; align-items: flex-start; gap: 13px; padding: 18px; border-radius: 13px; border: 1px solid color-mix(in srgb, var(--tj-green) 38%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 13%, var(--tj-panel)); }
.tj-dashboard-quote-icon { display: grid; place-items: center; flex: 0 0 36px; height: 36px; border-radius: 50%; color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 17%, transparent); }
.tj-dashboard-quote strong { display: block; color: var(--tj-green); font-size: .875rem; margin-bottom: 6px; }
.tj-dashboard-quote blockquote { font-size: .875rem; line-height: 1.6; font-style: italic; color: var(--tj-text); margin: 0; }
@media (max-width: 760px) { .tj-dashboard-welcome { grid-template-columns: minmax(0, 1fr); gap: 18px; padding-top: 12px; } .tj-dashboard-welcome h1 { letter-spacing: -.7px; } }
.tj-main-attached-calendar { margin-top: 12px; }
@media (max-width: 760px) {
  .tj-attached-calendar { padding: 14px; }
  .tj-attached-calendar-head { align-items: flex-start; flex-direction: column; gap: 8px; }
  .tj-markup-meta-row, .tj-markup-pair-row { grid-template-columns: 1fr; }
}
/* Responsive surfaces: allow content to reflow instead of widening the page. */
.tj-root, .tj-main, .tj-sidebar { height: 100dvh; }
.tj-content, .tj-modal { overscroll-behavior-y: contain; }
.tj-content-inner, .tj-page-transition, .tj-view-transition, .tj-subview-transition { min-width: 0; max-width: 100%; }
.tj-root :is(.tj-card, .tj-panel, .tj-field, .tj-grid2, .tj-grid3, .tj-grid4) > * { min-width: 0; }
.tj-root :is(.tj-card, .tj-panel, .tj-modal) { overflow-wrap: anywhere; }
.tj-root img { max-width: 100%; }
.tj-account-menu { max-height: calc(100dvh - 90px); overflow-y: auto; overscroll-behavior: contain; }
@media (max-width: 1100px) {
  .tj-reference-hero-grid, .tj-reference-calendar-layout { grid-template-columns: minmax(0, 1fr); }
  .tj-dashboard-analytics-grid { grid-template-columns: minmax(0, 1fr); }
  .tj-dashboard-core-score { grid-column: auto; }
}
@media (max-width: 900px) {
  .tj-sidebar { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
  .tj-account-menu, .tj-sidebar-collapsed .tj-account-menu { position: fixed; left: 10px; bottom: 76px; width: min(320px, calc(100vw - 20px)); }
  .tj-modal-overlay { z-index: 80; padding: 12px; }
  .tj-modal { max-height: calc(100dvh - 24px); }
  .tj-attached-calendar-grid { min-width: 0; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .tj-attached-week-heading { display: none; }
  .tj-attached-week { grid-column: 1 / -1; min-height: 52px; display: grid; grid-template-columns: auto auto minmax(24px, 1fr) auto; align-items: center; gap: 10px; }
  .tj-attached-week span { white-space: normal; }
  .tj-attached-month-nav { flex-wrap: wrap; }
  .tj-page-intro { flex-wrap: wrap; gap: 12px; }
}
@media (max-width: 600px) {
  .tj-root { background-attachment: scroll; }
  .tj-content { padding: 12px 10px max(18px, env(safe-area-inset-bottom)); }
  .tj-topbar { padding: 10px; backdrop-filter: none; }
  .tj-topbar-left { flex: 1; }
  .tj-topbar-title { overflow-wrap: anywhere; }
  .tj-modal-overlay { padding: 8px; padding-top: max(8px, env(safe-area-inset-top)); padding-bottom: max(8px, env(safe-area-inset-bottom)); }
  .tj-modal { width: 100%; max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); border-radius: 14px; }
  .tj-modal-head { padding: 12px; gap: 8px; }
  .tj-modal-head-actions { flex-shrink: 0; }
  .tj-modal-body { padding: 12px; }
  .tj-modal-actions { flex-wrap: wrap; }
  .tj-input { font-size: 16px; min-height: 44px; }
  .tj-markup-meta-row .tj-input, .tj-markup-pair-row .tj-input, .tj-trade-identity-grid .tj-input { height: 44px; min-height: 44px; }
  .tj-root :is(.tj-btn-primary, .tj-btn-outline, .tj-nav-item, .tj-account-row, .tj-icon-btn) { min-height: 40px; }
  .tj-icon-btn { min-width: 40px; }
  .tj-grid2, .tj-grid3, .tj-grid4, .tj-guardrail-grid, .tj-dashboard-analytics-grid, .tj-management-grid { grid-template-columns: minmax(0, 1fr); }
  .tj-analytics-deck-tabs, .tj-engine-tabs { flex-wrap: wrap; overflow: visible; }
  .tj-analytics-deck-tabs > *, .tj-engine-tabs > * { flex: 1 1 auto; white-space: normal; }
  .tj-reference-trade-right, .tj-reference-trade-left, .tj-reference-linked-markup, .tj-linked-markup-trade { flex-wrap: wrap; gap: 8px; }
  .tj-reference-trade-meta, .tj-reference-trade-left .tj-tlog-main { min-width: 0; }
  .tj-settings-account-hero { grid-template-columns: minmax(0, 1fr); }
  .tj-settings-hero-metrics { grid-column: 1 / -1; }
  .tj-reference-flow-metrics, .tj-tradelog-reference-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tj-markup-filter-popover, .tj-tradelog-filter-popover, .tj-analytics-period-popover { max-width: calc(100vw - 48px); }
  .tj-attached-calendar { padding: 10px; border-radius: 16px; }
  .tj-attached-calendar-scroll { padding: 5px; border-radius: 12px; }
  .tj-attached-calendar-grid { gap: 3px; }
  .tj-attached-dow { padding: 4px 0; font-size: 10px; letter-spacing: 0; text-align: center; }
  .tj-attached-day { padding: 3px; min-height: 70px; border-radius: 8px; }
  .tj-attached-day-empty { min-height: 70px; }
  .tj-attached-day-pill { flex-direction: column; justify-content: center; padding: 2px 0; gap: 2px; border-radius: 6px; font-size: 10px; }
  .tj-attached-day-pill b { max-width: 100%; }
  .tj-attached-day-pill i { font-size: 10px; }
  .tj-attached-week { grid-template-columns: auto 1fr; padding: 8px; gap: 5px 10px; margin-bottom: 5px; }
  .tj-attached-week strong { text-align: right; }
  .tj-attached-week-bar { grid-column: 1 / -1; }
  .tj-attached-week span { grid-column: 1 / -1; }
  .tj-attached-month-nav { gap: 6px; }
  .tj-attached-month-nav strong { font-size: 1rem; }
  .tj-attached-month-result { justify-content: flex-start; white-space: normal; }
  .tj-reference-trade-left { width:100%; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 16px; align-items:center; }
  .tj-reference-trade-left .tj-reference-trade-meta { grid-column:1 / -1; grid-row:2; min-width:0; }
  .tj-reference-trade-left .tj-tlog-main { min-width:0; }
  .tj-reference-trade-direction, .tj-reference-trade-session { min-width:0; }
  .tj-markup-toolbar-button { width:36px; height:36px; min-width:36px; min-height:36px; }
}
@media (max-width: 360px) {
  .tj-reference-kpis, .tj-stats-grid, .tj-reference-flow-metrics, .tj-settings-hero-metrics { grid-template-columns: minmax(0, 1fr); }
  .tj-attached-month-nav .tj-attached-this-month { margin-left: 0; }
}
/* Compact phone layout; desktop sizing and editable input text stay unchanged. */
@media (max-width: 600px) {
  html:has(.tj-root) { font-size: 14px; }
  .tj-root :is(.tj-pill, .tj-grade-badge) { flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
  .tj-reference-dashboard, .tj-performance-workspace { gap: 10px; }
  .tj-guardrails, .tj-performance-surface, .tj-performance-views { padding: 10px; border-radius: 12px; }
  .tj-guardrails-head { gap: 8px; }
  .tj-guardrails-head > div { min-width: 0; }
  .tj-guardrails-head strong { font-size: 1rem; }
  .tj-guardrails-head p { margin: 0; }
  .tj-guardrail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: 10px; }
  .tj-guardrail-metric { min-height: 0; padding: 9px; border-radius: 12px; }
  .tj-guardrail-card-main { grid-template-columns: minmax(0, 1fr); gap: 7px; }
  .tj-guardrail-value { white-space: normal; overflow: visible; font-size: 1rem; line-height: 1.3; }
  .tj-guardrail-value > span { display: block; font-size: .85rem; }
  .tj-guardrail-status { padding: 2px 5px; font-size: .72rem; }
  .tj-guardrail-meter { min-height: 0; padding: 5px 7px; border-radius: 8px; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 3px 6px; }
  .tj-guardrail-meter strong { font-size: 1rem; }
  .tj-guardrail-meter > span { font-size: .65rem; letter-spacing: 0; text-align: right; }
  .tj-guardrail-meter > i { grid-column: 1 / -1; }
  .tj-guardrail-note { margin: 6px 0; line-height: 1.3; }
  .tj-guardrail-foot { padding-top: 6px; flex-wrap: wrap; gap: 3px; }
  .tj-guardrails-footer { margin-top: 8px; line-height: 1.35; }
  .tj-reference-kpi { min-height: 100px; padding: 9px; }
  .tj-performance-highlights, .tj-performance-four { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .tj-performance-highlights > div, .tj-performance-four > div { min-height: 54px; padding: 8px; }
  .tj-performance-highlights > div:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .tj-performance-entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .tj-performance-entry-card { padding: 8px; gap: 7px; }
  .tj-performance-entry-card small { font-size: .7rem; letter-spacing: .2px; }
  .tj-performance-entry-card > section { gap: 7px 4px; }
  .tj-performance-entry-card > section b { font-size: .85rem; }
  .tj-performance-best-worst { gap: 4px; }
  .tj-performance-best-worst > span { padding: 5px; }
  .tj-performance-title { gap: 8px; flex-wrap: wrap; }
  .tj-attached-calendar-head { gap: 6px; margin-bottom: 8px; }
  .tj-attached-month-nav strong { font-size: 1rem; }
  .tj-attached-month-result { gap: 5px; font-size: .8rem; }
  .tj-attached-day, .tj-attached-day-empty { min-height: 52px; }
  .tj-attached-day-number { margin-bottom: 2px; font-size: .78rem; }
  .tj-attached-day-placeholder { border: 0; margin-top: 0; background: none; }
  .tj-attached-day-pill { min-height: 26px; }
  .tj-attached-week { min-height: 28px; grid-template-columns: auto auto minmax(0, 1fr); gap: 3px 7px; padding: 4px 6px; margin-bottom: 2px; border-radius: 6px; }
  .tj-attached-week small { font-size: .65rem; letter-spacing: .2px; }
  .tj-attached-week strong { font-size: .8rem; }
  .tj-attached-week span { grid-column: auto; text-align: right; font-size: .68rem; white-space: nowrap; }
  .tj-attached-week-bar { display: none; }
}
@media (max-width: 359px) {
  .tj-performance-entry-grid { grid-template-columns: minmax(0, 1fr); }
}
/* Calendar details are intentionally a compact, centered dialogue—not a drawer. */
.tj-modal-overlay.tj-modal-overlay-centered { align-items: center; justify-content: center; padding: 20px; }
.tj-modal-overlay.tj-modal-overlay-centered .tj-calendar-day-modal { width: min(560px, calc(100vw - 40px)); height: auto; max-height: calc(100dvh - 40px); border-radius: 14px; animation: none; }
.tj-modal-overlay.tj-modal-overlay-centered .tj-finance-reminder { width: min(430px, calc(100vw - 40px)); height: auto; max-height: calc(100dvh - 40px); border-radius: 14px; animation: none; }.tj-finance-reminder .tj-modal-head { padding: 13px 15px; }.tj-finance-reminder .tj-modal-body { padding: 15px; }
.tj-attached-day-finance { border-color: var(--tj-purple); }.tj-attached-day-cash-deposit { color: var(--tj-green) !important; background: color-mix(in srgb, var(--tj-green) 15%, var(--tj-panel-alt)) !important; border-color: color-mix(in srgb, var(--tj-green) 60%, var(--tj-border)) !important; }.tj-attached-day-cash-withdrawal { color: var(--tj-red) !important; background: color-mix(in srgb, var(--tj-red) 15%, var(--tj-panel-alt)) !important; border-color: color-mix(in srgb, var(--tj-red) 60%, var(--tj-border)) !important; }.tj-attached-day-cash-transfer { color: var(--tj-purple) !important; background: color-mix(in srgb, var(--tj-purple) 15%, var(--tj-panel-alt)) !important; border-color: color-mix(in srgb, var(--tj-purple) 60%, var(--tj-border)) !important; }.tj-finance-hero > div > small { color: var(--tj-muted); font-size: .76rem; }.tj-finance-hero > div > small b { color: var(--tj-green); }.tj-day-cash-list { display: grid; gap: 6px; margin: 12px 0; padding: 11px; border: 1px solid color-mix(in srgb, var(--tj-purple) 36%, var(--tj-border)); border-radius: 11px; background: color-mix(in srgb, var(--tj-purple) 5%, var(--tj-panel)); }.tj-day-cash-list > strong { color: var(--tj-muted); font-size: .68rem; letter-spacing: .8px; }.tj-day-cash-item { display: flex; justify-content: space-between; gap: 10px; font-size: .78rem; }.tj-day-cash-item span { color: var(--tj-muted); }.tj-finance-reminder-copy { display: grid; justify-items: center; gap: 8px; text-align: center; }.tj-finance-reminder-copy svg { color: var(--tj-purple); }.tj-finance-reminder-copy p { margin: 0; color: var(--tj-muted); font-size: .83rem; }.tj-finance-reminder-list { display: grid; gap: 7px; margin-top: 14px; }.tj-finance-reminder-list > div { display:flex; justify-content:space-between; gap:10px; padding:9px; border:1px solid var(--tj-border); border-radius:9px; font-size:.8rem; }.tj-finance-reminder-list strong { color:var(--tj-purple); }

/* Finance — account-scoped cash ledger and savings plans. */
.tj-attached-day-finance { border-color: color-mix(in srgb, var(--tj-purple) 50%, var(--tj-border)); background: color-mix(in srgb, var(--tj-purple) 9%, var(--tj-panel)); }.tj-attached-day-cash b { color: var(--tj-purple); }
.tj-finance-page { display: grid; gap: 14px; }.tj-finance-hero { display: flex; align-items: stretch; justify-content: space-between; gap: 18px; padding: 19px 20px; border: 1px solid color-mix(in srgb, var(--tj-green) 32%, var(--tj-border)); border-radius: 16px; background: linear-gradient(120deg, color-mix(in srgb, var(--tj-green) 10%, var(--tj-panel)), var(--tj-panel) 60%); }.tj-finance-hero > div { display: grid; gap: 5px; }.tj-finance-hero span, .tj-finance-card-title small, .tj-finance-summary small, .tj-finance-saving small { color: var(--tj-muted); font-size: .69rem; font-weight: 800; letter-spacing: 1px; }.tj-finance-hero h1 { margin: 0; font-size: clamp(26px, 3vw, 38px); letter-spacing: -.9px; }.tj-finance-hero p { margin: 0; color: var(--tj-muted); font-size: .83rem; }.tj-finance-hero aside { width: min(360px, 36%); padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--tj-green) 35%, var(--tj-border)); border-radius: 12px; background: color-mix(in srgb, var(--tj-green) 8%, var(--tj-panel)); display: grid; grid-template-columns: auto 1fr; align-content: center; gap: 4px 9px; }.tj-finance-hero aside svg { grid-row: span 2; color: var(--tj-green); }.tj-finance-hero aside strong { color: var(--tj-green); font-size: .75rem; }.tj-finance-hero aside em { font-size: .78rem; line-height: 1.45; }.tj-finance-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(230px, 28%); align-items: start; gap: 14px; }.tj-finance-ledger { padding: 14px; }.tj-finance-card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 13px; }.tj-finance-card-title > div { display: grid; gap: 3px; }.tj-finance-card-title strong { font-size: .95rem; }.tj-finance-card-title > span { padding: 4px 7px; border: 1px solid var(--tj-border); font-size: .63rem; letter-spacing: .7px; color: var(--tj-muted); }.tj-finance-form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }.tj-finance-form .tj-field { min-width: 0; }.tj-finance-record { margin-top: 10px; }.tj-finance-movement-list { max-height: 390px; overflow: auto; margin-top: 14px; border-top: 1px solid var(--tj-border); }.tj-finance-movement { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--tj-border); }.tj-finance-movement > i { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; font-style: normal; }.tj-finance-movement-in { color: var(--tj-green); background: color-mix(in srgb, var(--tj-green) 13%, transparent); }.tj-finance-movement-out { color: var(--tj-red); background: color-mix(in srgb, var(--tj-red) 12%, transparent); }.tj-finance-movement > div { min-width: 0; display: grid; gap: 2px; }.tj-finance-movement strong { font-size: .8rem; }.tj-finance-movement span { overflow: hidden; color: var(--tj-muted); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }.tj-finance-movement > b { font-size: .85rem; font-variant-numeric: tabular-nums; white-space: nowrap; }.tj-finance-delete { width: 29px; height: 29px; padding: 0; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--tj-red) 50%, var(--tj-border)); border-radius: 50%; color: var(--tj-red); background: transparent; }.tj-finance-summary { display: grid; gap: 10px; }.tj-finance-summary .tj-card { min-height: 93px; padding: 14px; display: grid; align-content: center; gap: 5px; }.tj-finance-summary strong { overflow: hidden; font-size: clamp(1.05rem, 2vw, 1.4rem); font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }.tj-finance-summary span, .tj-finance-saving span { color: var(--tj-muted); font-size: .72rem; }.tj-finance-total-card { border-color: color-mix(in srgb, var(--tj-green) 42%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel)); }.tj-finance-savings { padding: 14px; border: 1px solid var(--tj-border); border-radius: 15px; background: var(--tj-panel); }.tj-finance-saving { display: grid; grid-template-columns: minmax(150px, .9fr) minmax(140px, .7fr) minmax(230px, 1.3fr); align-items: center; gap: 18px; padding: 13px 0; border-top: 1px solid var(--tj-border); }.tj-finance-saving > div { display: grid; gap: 3px; min-width: 0; }.tj-finance-saving strong { font-size: .92rem; }.tj-finance-saving-progress > i { display: block; height: 7px; overflow: hidden; border-radius: 99px; background: var(--tj-panel-alt); }.tj-finance-saving-progress > i b { display: block; height: 100%; border-radius: inherit; background: var(--tj-green); }.tj-finance-empty { padding: 22px 8px; color: var(--tj-muted); font-size: .82rem; text-align: center; }.tj-finance-settings-list { display: grid; gap: 10px; margin: 12px 0; }.tj-finance-settings-account { padding: 12px; border: 1px solid var(--tj-border); border-radius: 12px; background: var(--tj-panel-alt); }.tj-finance-settings-account-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }.tj-finance-settings-account-head strong { font-size: .82rem; }
.tj-finance-card-capital { border-color: color-mix(in srgb, var(--tj-green) 42%, var(--tj-border)); background: color-mix(in srgb, var(--tj-green) 7%, var(--tj-panel)); }.tj-finance-card-capital strong { color: var(--tj-green); }.tj-finance-card-savings { border-color: color-mix(in srgb, var(--tj-purple) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-purple) 7%, var(--tj-panel)); }.tj-finance-card-savings strong { color: var(--tj-purple); }.tj-finance-card-deposit { border-color: color-mix(in srgb, var(--tj-green) 32%, var(--tj-border)); }.tj-finance-card-deposit strong { color: var(--tj-green); }.tj-finance-card-withdrawal { border-color: color-mix(in srgb, var(--tj-red) 45%, var(--tj-border)); background: color-mix(in srgb, var(--tj-red) 5%, var(--tj-panel)); }.tj-finance-card-withdrawal strong { color: var(--tj-red); }.tj-finance-movement:has(.tj-finance-movement-out) > b { color: var(--tj-red); }.tj-finance-movement:has(.tj-finance-movement-in) > b { color: var(--tj-green); }.tj-finance-movement:has(.tj-finance-movement-out) > i { color: var(--tj-red); }.tj-finance-movement-list { max-height: 365px; }.tj-finance-saving { grid-template-columns: minmax(145px, .8fr) minmax(140px, .65fr) minmax(190px, 1.1fr) minmax(155px, .75fr); }.tj-finance-saving-transfer { justify-self: end; text-align: right; }.tj-finance-saving-transfer strong { font-size: 1rem; }.tj-finance-saving-transfer strong small { font-size: .58rem; }.tj-finance-saving-transfer span { font-size: .67rem; }.tj-finance-saving-transfer button { margin-top: 4px; white-space: nowrap; }
.tj-finance-form { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.tj-tradelog-actions { position: fixed; right: 22px; bottom: 22px; z-index: 8; display: flex; align-items: center; gap: 8px; }.tj-tradelog-actions .tj-fab { position: static; }.tj-import-modal { width: min(620px, calc(100vw - 40px)); height: auto; max-height: calc(100dvh - 40px); border-radius: 14px; }.tj-import-preview { display: grid; gap: 7px; max-height: 245px; overflow: auto; margin-top: 14px; padding: 12px; border: 1px solid var(--tj-border); border-radius: 10px; background: var(--tj-panel-alt); font-size: .8rem; }.tj-import-preview > div { display: flex; justify-content: space-between; gap: 12px; padding-top: 7px; border-top: 1px solid var(--tj-border); }.tj-import-preview span { overflow: hidden; color: var(--tj-muted); text-overflow: ellipsis; white-space: nowrap; }.tj-import-preview small { color: var(--tj-muted); }.tj-import-error { margin-top: 12px; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--tj-red) 55%, var(--tj-border)); border-radius: 9px; color: var(--tj-red); background: color-mix(in srgb, var(--tj-red) 8%, var(--tj-panel)); font-size: .8rem; line-height: 1.4; }
.tj-import-button { display: inline-flex; align-items: center; gap: 7px; margin-top: 9px; }.tj-import-progress { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--tj-panel) var(--progress), color-mix(in srgb, var(--tj-panel) 34%, transparent) 0); color: var(--tj-panel); font-size: .52rem; font-style: normal; font-weight: 900; line-height: 1; }
.tj-list-pagination { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 9px; padding-top: 4px; color: var(--tj-muted); font-size: .8125rem; }.tj-list-pagination > span, .tj-pagination-arrows > span { font-variant-numeric: tabular-nums; }.tj-pagination-arrows { display: inline-flex; align-items: center; gap: 7px; }.tj-pagination-arrows > span { min-width: 42px; text-align: center; }
@media (max-width: 900px) { .tj-finance-layout { grid-template-columns: 1fr; }.tj-finance-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }.tj-finance-hero aside { width: 43%; }.tj-finance-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }.tj-finance-saving { grid-template-columns: 1fr 1fr; }.tj-finance-saving-transfer { justify-self: start; text-align: left; } }
@media (max-width: 580px) { .tj-finance-hero { display: grid; padding: 15px; }.tj-finance-hero aside { width: auto; }.tj-finance-summary { grid-template-columns: 1fr; }.tj-finance-form { grid-template-columns: 1fr; }.tj-finance-saving { grid-template-columns: 1fr; gap: 10px; }.tj-finance-movement { grid-template-columns: auto minmax(0, 1fr) auto; }.tj-finance-delete { grid-column: 3; }.tj-finance-movement > b { grid-column: 2; }.tj-finance-movement > div { grid-column: 2; }.tj-finance-movement > i { grid-row: span 2; }.tj-tradelog-actions { right: 14px; bottom: 14px; }.tj-import-modal { width: min(100%, calc(100vw - 24px)); }.tj-import-preview > div { font-size: .74rem; } }
.tj-reference-trade-meta, .tj-reference-trade-meta span:first-child { color: var(--tj-text); }
.tj-settings-linked-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 480px) { .tj-settings-linked-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

/* =============================== AUTH ROOT =============================== */
/* Gates the app behind real Supabase authentication. Session state is
   restored from Supabase's own persisted session (localStorage-backed by
   the SDK itself, refreshed automatically) — not a custom scheme.        */

export default function AppRoot() {
  const [sessionTheme] = useSiteTheme();
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
    return <JournalPreloader theme={sessionTheme} />;
  }

  if (passwordRecovery) {
    return <ResetPasswordForm onDone={() => setPasswordRecovery(false)} />;
  }

  if (!user || window.location.pathname === '/landing') {
    return <PublicSite user={user} onAuthed={(u) => { window.history.replaceState({}, '', '/'); setUser(u); }} />;
  }

  return (
    <TradingJournalApp key={user.id}
      user={user}
      onLogout={async () => { await signOut(); setUser(null); }}
    />
  );
}
