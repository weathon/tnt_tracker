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
export type CorrelationResult = { r: number; n: number; pValue: number; significant: boolean };
export const calorieWeightCorrelation = (days: Record<string, Day>, profile: Profile | null): CorrelationResult | null => {
  const sorted = Object.keys(days).sort();
  const pairs: { balance: number; weightDelta: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevD = new Date(prev + "T12:00:00");
    const currD = new Date(curr + "T12:00:00");
    if (currD.getTime() - prevD.getTime() !== 86400000) continue;
    const w0 = dailyWeight(days[prev]);
    const w1 = dailyWeight(days[curr]);
    if (w0 == null || w1 == null) continue;
    const wPrev = emaWeightKg(days, prev);
    const m = dayMetrics(profile, wPrev, days[prev]);
    if (m.balance == null) continue;
    pairs.push({ balance: m.balance, weightDelta: w1 - w0 });
  }
  if (pairs.length < 7) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.balance, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.weightDelta, 0) / n;
  let ssX = 0, ssY = 0, ssXY = 0;
  for (const p of pairs) { const dx = p.balance - meanX; const dy = p.weightDelta - meanY; ssX += dx * dx; ssY += dy * dy; ssXY += dx * dy; }
  if (ssX === 0 || ssY === 0) return null;
  const r = ssXY / Math.sqrt(ssX * ssY);
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const df = n - 2;
  const x = df / (df + t * t);
  let beta = 1, aParam = df / 2, bParam = 0.5, coeff = 1;
  for (let k = 1; k <= 60; k++) { const num = (aParam + k - 1) * (aParam - df / 2 + k); const den = (bParam + 2 * k - 2) * (bParam + 2 * k - 1); coeff *= num / den * x; beta += coeff; if (Math.abs(coeff) < 1e-12) break; }
  const lnBeta = lgamma(aParam) + lgamma(bParam) - lgamma(aParam + bParam);
  const ibeta = (Math.pow(x, aParam) * Math.pow(1 - x, bParam) / aParam) * beta / Math.exp(lnBeta);
  const pValue = Math.min(1, Math.max(0, ibeta));
  return { r, n, pValue, significant: pValue < 0.05 };
};
const lgamma = (z: number): number => {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
};
