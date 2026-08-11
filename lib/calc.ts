import type { Day, Profile } from "./types";
export const rmr = (p: Profile | null) => p ? 10*p.weightKg + 6.25*p.heightCm - 5*p.age + (p.sex === "male" ? 5 : -161) : null;
export const dayMetrics = (p: Profile | null, d?: Day, activityOverride?: number) => {
  const intake = d?.foods.reduce((s,x)=>s+x.energy,0) ?? 0;
  const activity = activityOverride ?? d?.activities.reduce((s,x)=>s+x.activeEnergy,0) ?? 0;
  const rest = rmr(p);
  const baselineAllowance = rest == null ? null : rest * 0.1;
  const baselineBurn = rest == null ? null : rest + baselineAllowance!;
  const aiBurn = baselineBurn == null ? null : baselineBurn + activity;
  const tracker = d?.trackerBurn == null ? null : d.trackerBurn * d.correctionFactor;
  const blended = tracker == null || aiBurn == null || !d ? null : tracker*(1-d.rulerPosition)+aiBurn*d.rulerPosition;
  return { intake, activity, rmr: rest, baselineAllowance, baselineBurn, aiBurn, tracker, blended, balance: blended == null ? null : intake-blended };
};
