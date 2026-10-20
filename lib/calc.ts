import type { Day } from "./types";
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
// Burned is the total-calories number the user copies from their tracker.
export const dayEnergy = (d?: Day) => {
  const intake = d?.foods.reduce((s,x)=>s+x.energy,0) ?? 0;
  const burned = d?.trackerBurn ?? null;
  return { intake, burned, remaining: burned == null ? null : burned-intake };
};
export type DeltaPeriod = "week" | "month" | "all";
export const DELTA_DAYS = { week: 7, month: 30 } as const;
// Daily food eaten minus tracker burn (positive is a surplus). Week and month
// windows end on `endKey`; "all" spans every day with a tracker burn.
export const calorieDeltas = (days: Record<string, Day>, endKey: string, period: DeltaPeriod) => {
  const fromKey = (key: string) => new Date(key+"T12:00:00");
  let start: Date, end: Date;
  if (period === "all") {
    const burned = Object.keys(days).filter(key=>days[key].trackerBurn!=null).sort();
    if (!burned.length) return [];
    start = fromKey(burned[0]); end = fromKey(burned.at(-1)!);
  } else {
    end = fromKey(endKey); start = new Date(end); start.setDate(start.getDate()-(DELTA_DAYS[period]-1));
  }
  const out: { date: string; delta: number | null }[] = [];
  for (const current = new Date(start); current <= end; current.setDate(current.getDate()+1)) {
    const key = dayKey(current); const { remaining } = dayEnergy(days[key]);
    out.push({ date: key, delta: remaining == null ? null : -remaining });
  }
  return out;
};
