import type { Day } from "./types";
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
// Burned is the total-calories number the user copies from their tracker.
export const dayEnergy = (d?: Day) => {
  const intake = d?.foods.reduce((s,x)=>s+x.energy,0) ?? 0;
  const burned = d?.trackerBurn ?? null;
  return { intake, burned, remaining: burned == null ? null : burned-intake };
};
