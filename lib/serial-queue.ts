// Runs jobs one at a time in the order they were added. A failed job does not
// block the jobs queued after it.
export function createSerialQueue(){
 let tail:Promise<unknown>=Promise.resolve();
 return <T>(job:()=>Promise<T>):Promise<T>=>{
  const result=tail.then(job);
  tail=result.catch(()=>undefined);
  return result;
 };
}
