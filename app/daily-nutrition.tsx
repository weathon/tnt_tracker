import {dailyNutrition} from "@/lib/nutrition";
import type {FoodEntry} from "@/lib/types";

export default function DailyNutrition({date,foods}:{date:string,foods:readonly FoodEntry[]}){
 const totals=dailyNutrition(foods);
 const metrics=[
  {label:"Calories",unit:"kcal",digits:0,...totals.calories},
  {label:"Protein",unit:"g",digits:1,...totals.proteinG},
  {label:"Carbs",unit:"g",digits:1,...totals.carbsG},
  {label:"Fat",unit:"g",digits:1,...totals.fatG},
  {label:"Sodium",unit:"mg",digits:0,...totals.sodiumMg},
  {label:"Salt",unit:"g",digits:1,...totals.saltG},
 ];
 const incomplete=metrics.some(metric=>metric.count<totals.entries);
 return <section className="card dailyNutrition" aria-label="Daily nutrition">
  <div className="nutritionHeading"><h2>Daily nutrition</h2><span><time dateTime={date}>{date}</time> · {totals.entries} food {totals.entries===1?"entry":"entries"}</span></div>
  <dl className="nutritionTotals">{metrics.map(metric=><div key={metric.label}>
   <dt>{metric.label}</dt>
   <dd>{metric.value==null?"—":<>{metric.value.toLocaleString("en-CA",{maximumFractionDigits:metric.digits})} <small>{metric.unit}</small></>}</dd>
   {metric.count<totals.entries&&<small className="nutritionCoverage">{metric.count===0?"Not recorded":`${metric.count} of ${totals.entries} entries`}</small>}
  </div>)}</dl>
  <p className="nutritionNote">{totals.entries===0?"No food logged for this day.":incomplete?"Totals include recorded estimates only; some entries are missing nutrient details.":"Estimated totals from all food logged for this day."}</p>
 </section>;
}
