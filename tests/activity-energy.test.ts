import test from "node:test";
import assert from "node:assert/strict";
import {estimateActivityEnergy,heartRateMet,netActiveEnergyFromMet} from "../lib/activity-energy.ts";

const profile={sex:"female",age:30,heightCm:165};

test("uses an equal table and bounded heart-rate MET blend",()=>{
  const result=estimateActivityEnergy({profile,weightKg:65,durationMinutes:30,tableMet:10,averageHeartRateBpm:140,displayedActiveEnergyKcal:null});
  assert.equal(result.source,"met_hr_blend");
  assert.ok(result.heartRateMet!=null);
  assert.equal(result.finalMet,1+((10-1)+(result.heartRateMet-1))/2);
  assert.equal(result.activeEnergyKcal,netActiveEnergyFromMet(result.finalMet,65,30));
});

test("uses the table alone when heart rate is below the reliable range",()=>{
  const result=estimateActivityEnergy({profile,weightKg:65,durationMinutes:30,tableMet:6,averageHeartRateBpm:90,displayedActiveEnergyKcal:null});
  assert.equal(result.source,"met");
  assert.equal(result.heartRateMet,null);
  assert.equal(result.finalMet,6);
});

test("preserves energy displayed by a tracker",()=>{
  const result=estimateActivityEnergy({profile,weightKg:65,durationMinutes:30,tableMet:10,averageHeartRateBpm:140,displayedActiveEnergyKcal:321});
  assert.equal(result.source,"displayed");
  assert.equal(result.activeEnergyKcal,321);
  assert.equal(result.heartRateMet,null);
});

test("Keytel heart-rate conversion returns a plausible MET value",()=>{
  const met=heartRateMet(profile,65,140);
  assert.ok(met!=null&&met>1);
});
