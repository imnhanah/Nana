import { supabase } from "./supabaseClient";
import { createAccount } from "./db";
import { buildDemoHistory } from "./demoData";

const pending = new Map();
async function stableId(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}
async function seed(user) {
  if (user.user_metadata?.demo_2025_version === 2) return;
  const id = await stableId(user.id + ":demo-2025-v1");
  const result = await createAccount(user.id, {id, name:"Demo", balance:1000, baseCurrency:"USD", positionSizeEnabled:true, defaultRiskPct:1});
  if (result.error) throw new Error(result.error);
  const history = buildDemoHistory();
  const rows = await Promise.all(history.trades.map(async (t, i) => ({
    id: await stableId(id + ":trade:" + i), user_id:user.id, account_id:id, trade_date:t.date, trade_time:t.time,
    asset:t.asset, direction:t.direction, pnl:t.pnl, gross_pnl:t.pnl, net_pnl:t.pnl, commission:0, swap:0,
    rr:t.rr, session:t.session, entry_session:t.session, entry_type:t.entryType, confluence_session:t.entryType,
    rating:4, types:t.types, mistakes:[], mood_before:"Neutral", mood_after:"Disciplined", context:t.context, screenshots:[], rule_evaluations:[]
  })));
  const reviews = await Promise.all(rows.map(async (t, i) => ({
    id:await stableId(id + ":review:" + i), user_id:user.id, account_id:id, trade_id:t.id, review_date:t.trade_date, review_time:"18:00",
    done_well:"Sized risk at 1% of running equity and respected the planned exit.",
    went_wrong:t.pnl < 0 ? "Price reached the planned stop; the loss remained within the risk budget." : "No execution error is modelled.",
    execution_review:`${t.asset} ${t.direction}: ${t.rr}R, $${t.pnl.toFixed(2)} net.`,
    rule_adherence:"1% risk; 3.2R profit target; zero commission and swap.",
    psychology:"Stayed neutral and accepted the planned outcome.", lessons:t.pnl > 0 ? "Let the planned target play out." : t.pnl === 0 ? "A breakeven exit preserved capital without a profit or loss." : "A controlled loss is part of the trading sample.",
    action_items:"Recalculate risk from updated equity before the next trade.", notes:"Automatically written synthetic demo review.", screenshots:[]
  })));
  // Version 2 intentionally replaces the requested generated demo history in place.
  // Stable IDs keep retries from duplicating trades or reviews; other accounts are untouched.
  const batches = [["trades", rows], ["trade_reviews", reviews], ["period_reviews", await Promise.all(history.periods.map(async p => ({
    id:await stableId(id + ":" + p.type + ":" + p.key), user_id:user.id, account_id:id, period_type:p.type, period_key:p.key, content:p.content, completed:true
  })))]];
  for (const [table, data] of batches) {
    const {error} = await supabase.from(table).upsert(data, {onConflict:"id"});
    if (error) throw new Error("Demo setup: " + error.message);
  }
  const {error} = await supabase.auth.updateUser({data:{demo_2025_seeded:true, demo_2025_version:2}});
  if (error) throw new Error(error.message);
}
export function ensureDemoAccount(user) {
  if (!pending.has(user.id)) pending.set(user.id, seed(user).catch(error => { pending.delete(user.id); throw error; }));
  return pending.get(user.id);
}
