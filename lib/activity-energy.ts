import type {Profile} from "./types";

const KJ_PER_KCAL=4.184;
const MINIMUM_RELIABLE_HEART_RATE_BPM=100;

export type ActivityEnergyEstimate={
  activeEnergyKcal:number;
  tableMet:number;
  heartRateMet:number|null;
  finalMet:number;
  source:"displayed"|"met"|"met_hr_blend";
};

export function netActiveEnergyFromMet(met:number,weightKg:number,durationMinutes:number){
  return Math.max(0,met-1)*3.5*weightKg/200*durationMinutes;
}

function restingEnergyPerMinute(profile:Profile,weightKg:number){
  const sexConstant=profile.sex.toLowerCase()==="male"?5:profile.sex.toLowerCase()==="female"?-161:null;
  if(sexConstant==null)return null;
  return (10*weightKg+6.25*profile.heightCm-5*profile.age+sexConstant)/1440;
}

// Keytel et al. (2005), model without VO2max. The equation estimates gross kJ/min,
// so resting energy is removed before converting it to a net MET estimate.
export function heartRateMet(profile:Profile,weightKg:number,bpm:number){
  const sex=profile.sex.toLowerCase();
  if(!Number.isFinite(bpm)||bpm<MINIMUM_RELIABLE_HEART_RATE_BPM||bpm>250||weightKg<=0)return null;
  const grossKjPerMinute=sex==="male"
    ? -55.0969+0.6309*bpm+0.1988*weightKg+0.2017*profile.age
    : sex==="female"
      ? -20.4022+0.4472*bpm-0.1263*weightKg+0.074*profile.age
      : null;
  const restPerMinute=restingEnergyPerMinute(profile,weightKg);
  if(grossKjPerMinute==null||restPerMinute==null)return null;
  const netKcalPerMinute=Math.max(0,grossKjPerMinute/KJ_PER_KCAL-restPerMinute);
  return 1+netKcalPerMinute/(3.5*weightKg/200);
}

export function estimateActivityEnergy({profile,weightKg,durationMinutes,tableMet,averageHeartRateBpm,displayedActiveEnergyKcal}:{
  profile:Profile;
  weightKg:number;
  durationMinutes:number;
  tableMet:number;
  averageHeartRateBpm:number|null;
  displayedActiveEnergyKcal:number|null;
}):ActivityEnergyEstimate{
  if(displayedActiveEnergyKcal!=null){
    return{activeEnergyKcal:displayedActiveEnergyKcal,tableMet,heartRateMet:null,finalMet:tableMet,source:"displayed"};
  }

  const rawHeartRateMet=averageHeartRateBpm==null?null:heartRateMet(profile,weightKg,averageHeartRateBpm);
  if(rawHeartRateMet==null){
    return{activeEnergyKcal:netActiveEnergyFromMet(tableMet,weightKg,durationMinutes),tableMet,heartRateMet:null,finalMet:tableMet,source:"met"};
  }

  // A population HR equation can be noisy for an individual. Keep its net MET
  // contribution within 0.5x-2x of the activity reference before blending.
  const tableNetMet=Math.max(0,tableMet-1);
  const boundedHeartRateNetMet=Math.min(tableNetMet*2,Math.max(tableNetMet*.5,rawHeartRateMet-1));
  const boundedHeartRateMet=1+boundedHeartRateNetMet;
  const finalMet=1+(tableNetMet+boundedHeartRateNetMet)/2;
  return{
    activeEnergyKcal:netActiveEnergyFromMet(finalMet,weightKg,durationMinutes),
    tableMet,
    heartRateMet:boundedHeartRateMet,
    finalMet,
    source:"met_hr_blend",
  };
}
