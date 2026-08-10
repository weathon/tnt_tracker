import table from "@/data/met-compendium.json";

export type MetRow = { category:string; code:string; met:number; description:string };
const rows = table.rows as MetRow[];
const stop = new Set(["with","from","that","this","about","around","average","minutes","minute","hours","hour","and","the","for","was","were"]);
const words = (value:string) => value.toLowerCase().match(/[a-z0-9]+/g)?.filter(x=>x.length>2&&!stop.has(x)) ?? [];

export function metCandidates(description:string, limit=160): MetRow[] {
  const terms=[...new Set(words(description))];
  const primaryCategories=new Set<string>();
  if(terms.some(x=>x.startsWith("walk")||x==="steps"))primaryCategories.add("Walking");
  if(terms.some(x=>x.startsWith("swim")))primaryCategories.add("Water Activities");
  if(terms.some(x=>x.startsWith("run")||x.startsWith("jog")))primaryCategories.add("Running");
  if(terms.some(x=>x.startsWith("cycl")||x.startsWith("bik")))primaryCategories.add("Bicycling");
  const ranked=rows.map((row,index)=>{
    const hay=`${row.category} ${row.description}`.toLowerCase();
    const score=terms.reduce((sum,t)=>sum+(hay.includes(t)?1:0),0);
    return {row,index,score};
  }).filter(x=>x.score>0&&x.row.met>1).sort((a,b)=>b.score-a.score||a.index-b.index);
  const counts=new Map<string,number>();
  const primary=rows.filter(x=>primaryCategories.has(x.category)&&x.met>1);
  const secondary=ranked.filter(x=>!primaryCategories.has(x.row.category)&&(()=>{const n=counts.get(x.row.category)??0;if(n>=20)return false;counts.set(x.row.category,n+1);return true})()).map(x=>x.row);
  return [...primary,...secondary].slice(0,limit);
}
