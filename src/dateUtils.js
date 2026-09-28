// Calendar-facing fields in the journal are stored as local YYYY-MM-DD keys,
// not UTC timestamps. Keep the conversion in one place so a user near a UTC
// day boundary never sees a trade, reminder, or guardrail on the wrong date.
export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
