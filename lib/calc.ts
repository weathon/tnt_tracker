import type { Day, Profile } from "./types";
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const dailyWeight = (day?: Day) => { const entries = day?.weights ?? []; return entries.length ? entries.reduce((s,e)=>s+e.weightKg,0)/entries.length : null; };
export const emaEndingAt = (days: Record<string, Day>, end: Date) => {
  const window: number[] = [];
  for (let offset = 6; offset >= 0; offset--) { const d = new Date(end); d.setDate(d.getDate()-offset); const value = dailyWeight(days[dayKey(d)]); if (value != null) window.push(value); }
  return window.length ? window.slice(1).reduce((ema,value)=>value*.25+ema*.75,window[0]) : null;
};
// Weight used everywhere: EMA over the daily-average weigh-ins of the 7 days ending at `date`.
// If that window has no logs, it falls back to the EMA ending at the most recent logged day on or before `date`
// (and, failing that, the earliest logged day after it), so past days keep a value across gaps.
export const emaWeightKg = (days: Record<string, Day>, date: string) => {
  const direct = emaEndingAt(days, new Date(date+"T12:00:00"));
  if (direct != null) return direct;
  const logged = Object.keys(days).filter(key=>(days[key].weights?.length??0)>0).sort();
  const anchor = logged.filter(key=>key<=date).at(-1) ?? logged[0];
  return anchor ? emaEndingAt(days, new Date(anchor+"T12:00:00")) : null;
};
export const latestWeightKg = (days: Record<string, Day>) => {
  let best: { stamp: string; weightKg: number } | null = null;
  for (const [date, day] of Object.entries(days)) for (const entry of day.weights ?? []) { const stamp = `${date}T${entry.time}`; if (!best || stamp > best.stamp) best = { stamp, weightKg: entry.weightKg }; }
  return best?.weightKg ?? null;
};
export const rmr = (p: Profile | null, weightKg: number | null) => !p || weightKg == null ? null : p.sex === "male" ? 10*weightKg + 6.25*p.heightCm - 5*p.age + 5 : p.sex === "female" ? 10*weightKg + 6.25*p.heightCm - 5*p.age - 161 : null;
export const dayMetrics = (p: Profile | null, weightKg: number | null, d?: Day, activityOverride?: number) => {
  const intake = d?.foods.reduce((s,x)=>s+x.energy,0) ?? 0;
  const activity = activityOverride ?? d?.activities.reduce((s,x)=>s+x.activeEnergy,0) ?? 0;
  const rest = rmr(p, weightKg);
  const baselineAllowance = rest == null ? null : rest * 0.2;
  const baselineBurn = rest == null ? null : rest + baselineAllowance!;
  const aiBurn = baselineBurn == null ? null : baselineBurn + activity;
  const tracker = d?.trackerBurn == null ? null : d.trackerBurn * d.correctionFactor;
  const blended = tracker == null || aiBurn == null || !d ? null : tracker*(1-d.rulerPosition)+aiBurn*d.rulerPosition;
  return { intake, activity, rmr: rest, baselineAllowance, baselineBurn, aiBurn, tracker, blended, balance: blended == null ? null : intake-blended };
};
