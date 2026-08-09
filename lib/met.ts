import table from "@/data/met-compendium.json";

export type MetRow = { category:string; code:string; met:number; description:string };
const rows = table.rows as MetRow[];
const stop = new Set(["with","from","that","this","about","around","average","minutes","minute","hours","hour","and","the","for","was","were"]);
const words = (value:string) => value.toLowerCase().match(/[a-z0-9]+/g)?.filter(x=>x.length>2&&!stop.has(x)) ?? [];

export function metCandidates(description:string, limit=100): MetRow[] {
  const terms=[...new Set(words(description))];
  const ranked=rows.map((row,index)=>{
    const hay=`${row.category} ${row.description}`.toLowerCase();
    const score=terms.reduce((sum,t)=>sum+(hay.includes(t)?1:0),0);
    return {row,index,score};
  }).filter(x=>x.score>0&&x.row.met>1).sort((a,b)=>b.score-a.score||a.index-b.index);
  const counts=new Map<string,number>();
  return ranked.filter(x=>{const n=counts.get(x.row.category)??0;if(n>=25)return false;counts.set(x.row.category,n+1);return true}).slice(0,limit).map(x=>x.row);
}
