const entryActions=new Set(["food","duplicate-food","activity","weight","blood-pressure","medication-list","medication-once"]);

export async function runGuardedAction(pending:Set<string>,name:string,action:()=>Promise<void>):Promise<void>{
 // Only suppress repeated entry submissions. Distinct deletes and changed
 // slider/rating values must still save even when they share an action name.
 if(!entryActions.has(name)&&!name.startsWith("medication-")){await action();return}
 // Claim the action before awaiting anything, including React's next render.
 if(pending.has(name))return;
 pending.add(name);
 try{await action()}finally{pending.delete(name)}
}

// An older response must never restore entries removed by a newer refresh.
export function latestLoader<T>(read:()=>Promise<T>,apply:(value:T)=>void,onError:(error:unknown)=>void){
 let version=0;
 return async()=>{
  const current=++version;
  try{const value=await read();if(current===version)apply(value)}
  catch(error){if(current===version)onError(error)}
 };
}
