import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase function configuration is incomplete." }, 500);
  if (!openAiKey) return json({ error: "AI Coach is not connected yet. Add OPENAI_API_KEY to Supabase Edge Function secrets." }, 503);

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in to use AI Coach." }, 401);

  const body = await request.json().catch(() => ({}));
  const accountId = String(body.accountId || "");
  if (!accountId) return json({ error: "Choose an account before generating coaching." }, 400);

  const [{ data: account, error: accountError }, { data: trades, error: tradesError }, { data: markups }, { data: reviews }] = await Promise.all([
    supabase.from("accounts").select("id,name,balance,monthly_goal_pct,yearly_goal_pct,daily_loss_limit_pct,monthly_loss_limit_pct").eq("id", accountId).eq("user_id", user.id).single(),
    supabase.from("trades").select("trade_date,asset,direction,net_pnl,pnl,gross_pnl,commission,swap,rr,session,entry_session,entry_type,types,mistakes,rating").eq("account_id", accountId).eq("user_id", user.id).order("trade_date", { ascending: false }).limit(500),
    supabase.from("premarket_markups").select("markup_date,instrument,bias,status").eq("account_id", accountId).eq("user_id", user.id).limit(200),
    supabase.from("trade_reviews").select("trade_id,rule_adherence,psychology,lessons").eq("account_id", accountId).eq("user_id", user.id).limit(300),
  ]);
  if (accountError || tradesError || !account) return json({ error: "Could not load this account’s journal data." }, 500);

  const pnl = (trade: Record<string, unknown>) => Number(trade.net_pnl ?? trade.pnl ?? 0) || 0;
  const list = trades || [];
  const wins = list.filter((trade) => pnl(trade) > 0);
  const losses = list.filter((trade) => pnl(trade) < 0);
  const group = (items: Record<string, unknown>[], key: string) => Object.entries(items.reduce((all, item) => {
    const name = String(item[key] || "Unspecified");
    const entry = all[name] || { name, trades: 0, pnl: 0, wins: 0 };
    entry.trades += 1; entry.pnl += pnl(item); entry.wins += pnl(item) > 0 ? 1 : 0; all[name] = entry;
    return all;
  }, {} as Record<string, { name: string; trades: number; pnl: number; wins: number }>)).map(([, value]) => value);
  const countTags = (key: "mistakes" | "types") => Object.entries(list.flatMap((trade) => Array.isArray(trade[key]) ? trade[key] : []).reduce((all, tag) => ({ ...all, [String(tag)]: (all[String(tag)] || 0) + 1 }), {} as Record<string, number>)).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const summary = {
    account: { name: account.name, balance: Number(account.balance || 0), monthlyGoalPct: Number(account.monthly_goal_pct || 0), yearlyGoalPct: Number(account.yearly_goal_pct || 0), dailyLossLimitPct: Number(account.daily_loss_limit_pct || 0), monthlyLossLimitPct: Number(account.monthly_loss_limit_pct || 0) },
    trades: { total: list.length, netPnl: list.reduce((sum, trade) => sum + pnl(trade), 0), wins: wins.length, losses: losses.length, winRate: list.length ? wins.length / list.length * 100 : 0, averageR: list.length ? list.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / list.length : 0 },
    sessions: group(list, "entry_session").sort((a, b) => b.pnl - a.pnl),
    instruments: group(list, "asset").sort((a, b) => b.pnl - a.pnl),
    entryTypes: group(list, "entry_type").sort((a, b) => b.pnl - a.pnl),
    repeatedMistakes: countTags("mistakes"),
    confluences: countTags("types"),
    markups: markups?.length || 0,
    reviews: reviews?.length || 0,
  };

  const prompt = `You are an evidence-based trading journal coach. Analyze only the supplied journal summary. Do not predict markets, issue trade signals, or give financial advice. Write a concise coaching report with these headings: Strengths to repeat, Weaknesses to address, Risk and discipline, and Next three actions. Cite the actual numbers or patterns that support each point. If the sample is small or data is missing, say so plainly.\n\nJOURNAL SUMMARY:\n${JSON.stringify(summary)}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") || "gpt-5-mini", input: prompt }),
  });
  if (!response.ok) return json({ error: "AI Coach could not generate a report right now." }, 502);
  const result = await response.json();
  const report = result.output_text || result.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).map((item: { text?: string }) => item.text || "").join("\n");
  return report ? json({ report }) : json({ error: "AI Coach returned an empty report." }, 502);
});
