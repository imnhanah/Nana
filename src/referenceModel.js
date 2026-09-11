// Read-only presentation selectors. Stored trades remain the source of truth.
export const money = (value, compact = false) => {
  const n = Number(value) || 0;
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 0 : 2 })}`;
};
export const percent = (value) => `${value > 0 ? "+" : ""}${(Number(value) || 0).toFixed(2)}%`;
export const rate = (value, base) => base > 0 ? value / base * 100 : 0;
export const result = (pnl, cap = 0) => Math.abs(pnl) <= cap ? "be" : pnl > 0 ? "win" : "loss";
export const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shortDate = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
export const modelName = (trade) => trade.entryType || trade.confluenceSession || "";
export const confluences = (trade) => Array.from(new Set(trade.confluence || trade.types || []));
export const sortedTrades = (trades) => [...trades].sort((a,b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`));
export function aggregate(trades, cap = 0) {
  const values = trades.map(t => Number(t.pnl) || 0), total = values.reduce((a,b) => a+b,0);
  const wins = values.filter(v => result(v,cap) === "win").length;
  return { trades, count: trades.length, pnl: total, wins, losses: values.filter(v => result(v,cap) === "loss").length,
    wr: trades.length ? wins / trades.length * 100 : 0, avgRR: trades.length ? trades.reduce((a,t) => a + (Number(t.rr)||0),0) / trades.length : 0,
    avg: trades.length ? total / trades.length : 0, best: values.length ? Math.max(...values) : 0, worst: values.length ? Math.min(...values) : 0 };
}
export function groupPerformance(trades, keyForTrade, cap = 0) {
  const groups = new Map();
  trades.forEach(t => { const keys = keyForTrade(t); for (const key of new Set(Array.isArray(keys) ? keys : [keys])) { if(!key) continue; if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(t); } });
  return [...groups].map(([name, ts]) => ({name, ...aggregate(ts,cap)})).sort((a,b) => b.pnl-a.pnl);
}
export function equityPath(trades, balance, cap = 0) {
  const groups = groupPerformance(trades, t => t.date, cap).sort((a,b) => a.name.localeCompare(b.name));
  let running = Number(balance)||0, peak = running, maxDrawdown = 0, maxDrawdownPct = 0;
  const days = groups.map(day => {
    const opening = running; running += day.pnl; peak = Math.max(peak,running);
    maxDrawdown = Math.max(maxDrawdown,peak-running); maxDrawdownPct = Math.max(maxDrawdownPct,rate(peak-running,peak));
    return {...day,date:day.name,opening,closing:running,dayReturn:rate(day.pnl,opening),growth:rate(running-balance,balance),peak};
  });
  return { days, closing:running, peak, low:Math.min(Number(balance)||0,...days.map(d=>d.closing)), maxDrawdown,maxDrawdownPct };
}
export function monthCalendar(trades, balance, cap, cursor) {
  const year=cursor.getFullYear(),month=cursor.getMonth(), key=`${year}-${String(month+1).padStart(2,"0")}`;
  const monthTrades=trades.filter(t=>t.date?.startsWith(key)), grouped=new Map(groupPerformance(monthTrades,t=>t.date,cap).map(d=>[d.name,d]));
  const cells=Array.from({length:(new Date(year,month,1).getDay()+6)%7},()=>null);
  for(let day=1;day<=new Date(year,month+1,0).getDate();day++){const date=`${key}-${String(day).padStart(2,"0")}`,info=grouped.get(date)||aggregate([],cap);cells.push({day,date,...info,kind:info.count?result(info.pnl,cap):"none"});}
  while(cells.length%7)cells.push(null);
  let opening=(Number(balance)||0)+trades.filter(t=>t.date<`${key}-01`).reduce((s,t)=>s+(Number(t.pnl)||0),0);
  const weeks=[];
  for(let i=0;i<cells.length;i+=7){const days=cells.slice(i,i+7), active=days.filter(d=>d?.count),pnl=active.reduce((s,d)=>s+d.pnl,0);weeks.push({days,pnl,count:active.length,wr:active.length?active.filter(d=>d.kind==="win").length/active.length*100:0,returnPct:rate(pnl,opening)});opening+=pnl;}
  return {weeks,stats:aggregate(monthTrades,cap),activeDays:grouped.size};
}
export function monthlyPath(trades,balance,cap=0) {
  let running=Number(balance)||0;
  return groupPerformance(trades,t=>t.date?.slice(0,7),cap).sort((a,b)=>a.name.localeCompare(b.name)).map(m=>{const opening=running;running+=m.pnl;return {...m,opening,closing:running,growth:rate(m.pnl,opening)};});
}
export function mondayKey(iso) {const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()-(d.getDay()+6)%7);return dateKey(d);}
export function guardrailAudit(trades,account) {
  // Match the application's existing enforced cap basis; never invent historical settings.
  const base=Number(account.balance)||0, dailyCap=base*(Number(account.dailyLossLimitPct)||0)/100,monthlyCap=base*(Number(account.monthlyLossLimitPct)||0)/100;
  const audit=(name,items,cap)=>{let net=0,used=0,trigger=null; sortedTrades(items).forEach(t=>{net+=Number(t.pnl)||0;used=Math.max(used,Math.max(0,-net));if(!trigger&&cap>0&&net<=-cap)trigger=t;});return {name,cap,pnl:net,used,pct:rate(used,cap),trigger};};
  const days=groupPerformance(trades,t=>t.date).sort((a,b)=>a.name.localeCompare(b.name)).map(d=>audit(d.name,d.trades,dailyCap));
  const months=groupPerformance(trades,t=>t.date?.slice(0,7)).map(m=>audit(m.name,m.trades,monthlyCap));
  const breaches=[...days.map(d=>({...d,kind:"Daily cap"})),...months.map(m=>({...m,kind:"Monthly cap"}))].filter(d=>d.trigger).sort((a,b)=>b.name.localeCompare(a.name));
  const lastBreach=days.map(d=>!!d.trigger).lastIndexOf(true);
  return {days,months,breaches,preLimitDays:days.filter(d=>d.pct>=75&&d.pct<100).length,breachFree:lastBreach<0?days.length:days.length-lastBreach-1};
}
