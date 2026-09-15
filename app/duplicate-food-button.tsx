"use client";

export default function DuplicateFoodButton({name,date,disabled,onDuplicate}:{name:string,date:string,disabled:boolean,onDuplicate:()=>void}){
 return <button type="button" className="duplicateFood" disabled={disabled} aria-label={`Duplicate ${name}`} onClick={()=>{
  if(disabled)return;
  if(window.confirm(`Duplicate ${name} on ${date}? This will add another full entry with the same food, calories, and price.`))onDuplicate();
 }}>Duplicate</button>;
}
