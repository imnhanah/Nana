import { supabase } from "./supabaseClient";
import { createAccount } from "./db";
import { buildDemoHistory } from "./demoData";

const pending = new Map();
async function stableId(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}

const DEMO_CHART = "/demo/demo-tradingview-chart.png";
const DEMO_MARKUP_TEMPLATES = [
  ["EUR/USD", "BUY", "Bullish", "London", "win", 146.4, 2.4],
  ["GBP/USD", "SELL", "Bearish", "NY AM", "loss", -62.8, -1],
  ["XAU/USD", "BUY", "Bullish", "London", "win", 181.2, 3],
  ["USD/JPY", "SELL", "Bearish", "NY AM", "be", 0, 0],
  ["EUR/USD", "SELL", "Bearish", "London", "loss", -58.1, -1],
  ["GBP/USD", "BUY", "Bullish", "NY AM", "win", 132.6, 2.2],
  ["XAU/USD", "SELL", "Bearish", "London", "be", 0, 0],
  ["USD/CHF", "BUY", "Bullish", "NY AM", "win", 168.9, 2.8],
  ["EUR/USD", "BUY", "Bullish", "London", "loss", -64.7, -1],
  ["GBP/USD", "SELL", "Bearish", "NY AM", "win", 154.5, 2.6],
];

function buildRecentDemoMarkups() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return DEMO_MARKUP_TEMPLATES.map(([instrument, direction, bias, market, outcome, pnl, rr], index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (DEMO_MARKUP_TEMPLATES.length - 1 - index));
    const isoDate = date.toISOString().slice(0, 10);
    const setup = bias === "Bullish" ? "higher-timeframe demand and a clean liquidity sweep" : "a lower-high rejection below the session range";
    return {
      date: isoDate, instrument, direction, bias, market, outcome, pnl, rr,
      structure: `Price respected ${setup}; wait for confirmation before entering.`,
      levels: bias === "Bullish" ? "Session low, demand zone, and London open" : "Session high, supply zone, and NY opening range",
      notes: `Narrative: ${instrument} is ${bias.toLowerCase()} while price remains inside the planned execution area.`,
      sessionReview: {
        marketOutcome: outcome === "win" ? "The directional idea played out into the planned target." : outcome === "be" ? "Price reached a safe point and the position was protected at break-even." : "The planned invalidation was reached without a recovery setup.",
        waitedForConditions: "Waited for the session confirmation and entered only after the marked level held.",
        outsidePlanReason: "No trade was taken outside the written plan."
      }
    };
  });
}

async function seed(user) {
  if (user.user_metadata?.demo_history_version === 4) return;
  const id = await stableId(user.id + ":demo-2025-v1");
  const result = await createAccount(user.id, {id, name:"Demo", balance:1000, baseCurrency:"USD", positionSizeEnabled:true, defaultRiskPct:1});
  if (result.error) throw new Error(result.error);
  const history = buildDemoHistory();
  const markupExamples = buildRecentDemoMarkups();
  const markupRows = await Promise.all(markupExamples.map(async (markup, index) => ({
    id: await stableId(id + ":markup:" + index), user_id: user.id, account_id: id,
    markup_date: markup.date, markup_time: markup.market === "London" ? "08:30" : "13:30",
    market: markup.market, instrument: markup.instrument, bias: markup.bias, status: "Executed",
    market_structure: markup.structure, levels: markup.levels, notes: markup.notes,
    screenshots: {
      preHTF: [DEMO_CHART], preH4: [DEMO_CHART], preM15: [DEMO_CHART],
      postH4: [DEMO_CHART], postM15: [DEMO_CHART], sessionReview: markup.sessionReview
    }
  })));
  const rows = await Promise.all(history.trades.map(async (t, i) => ({
    id: await stableId(id + ":trade:" + i), user_id:user.id, account_id:id, trade_date:t.date, trade_time:t.time,
    asset:t.asset, direction:t.direction, pnl:t.pnl, gross_pnl:t.pnl, net_pnl:t.pnl, commission:0, swap:0,
    rr:t.rr, session:t.session, entry_session:t.session, entry_type:t.entryType, confluence_session:t.entryType,
    rating:4, types:t.types, mistakes:[], mood_before:"Neutral", mood_after:"Disciplined", context:t.context, screenshots:[], rule_evaluations:[]
  })));
  const recentRows = await Promise.all(markupExamples.map(async (markup, index) => ({
    id: await stableId(id + ":recent-markup-trade:" + index), user_id: user.id, account_id: id,
    trade_date: markup.date, trade_time: markup.market === "London" ? "09:15" : "14:15",
    asset: markup.instrument, direction: markup.direction, pnl: markup.pnl, gross_pnl: markup.pnl,
    net_pnl: markup.pnl, commission: 0, swap: 0, rr: markup.rr, session: markup.market,
    entry_session: markup.market, entry_type: "Demo confirmation", confluence_session: "Demo confirmation",
    premarket_markup_id: markupRows[index].id, rating: 4, types: ["Structure", "Liquidity"], mistakes: [],
    mood_before: "Focused", mood_after: markup.outcome === "loss" ? "Calm" : "Disciplined",
    context: `Demonstration ${markup.outcome} linked to the ${markup.instrument} pre-session markup. The trade followed the written setup and the planned risk process.`,
    screenshots: [], rule_evaluations: []
  })));
  const allRows = [...rows, ...recentRows];
  const reviews = await Promise.all(allRows.map(async (t, i) => ({
    id:await stableId(id + ":review:" + i), user_id:user.id, account_id:id, trade_id:t.id, review_date:t.trade_date, review_time:"18:00",
    done_well:"Sized risk at 1% of running equity and respected the planned exit.",
    went_wrong:t.pnl < 0 ? "Price reached the planned stop; the loss remained within the risk budget." : "No execution error is modelled.",
    execution_review:`${t.asset} ${t.direction}: ${t.rr}R, $${t.pnl.toFixed(2)} net.`,
    rule_adherence:"1% risk; 3.2R profit target; zero commission and swap.",
    psychology:"Stayed neutral and accepted the planned outcome.", lessons:t.pnl > 0 ? "Let the planned target play out." : t.pnl === 0 ? "A breakeven exit preserved capital without a profit or loss." : "A controlled loss is part of the trading sample.",
    action_items:"Recalculate risk from updated equity before the next trade.", notes:"Automatically written synthetic demo review.", screenshots:[]
  })));
  // Version 3 keeps the prior synthetic history and appends the 70 requested
  // January–September 2026 trades. Stable IDs prevent duplicate records.
  // Stable IDs keep retries from duplicating trades or reviews; other accounts are untouched.
  const batches = [["premarket_markups", markupRows], ["trades", allRows], ["trade_reviews", reviews], ["period_reviews", await Promise.all(history.periods.map(async p => ({
    id:await stableId(id + ":" + p.type + ":" + p.key), user_id:user.id, account_id:id, period_type:p.type, period_key:p.key, content:p.content, completed:true
  })))]];
  for (const [table, data] of batches) {
    const {error} = await supabase.from(table).upsert(data, {onConflict:"id"});
    if (error) throw new Error("Demo setup: " + error.message);
  }
  const {error} = await supabase.auth.updateUser({data:{demo_2025_seeded:true, demo_2025_version:4, demo_history_version:4}});
  if (error) throw new Error(error.message);
}
export function ensureDemoAccount(user) {
  if (!pending.has(user.id)) pending.set(user.id, seed(user).catch(error => { pending.delete(user.id); throw error; }));
  return pending.get(user.id);
}
