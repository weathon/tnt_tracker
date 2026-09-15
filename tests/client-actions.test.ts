import test from "node:test";
import assert from "node:assert/strict";
import {latestLoader,runGuardedAction} from "../lib/client-actions.ts";
import DuplicateFoodButton from "../app/duplicate-food-button.tsx";

function deferred<T>(){
 let resolve!:(value:T|PromiseLike<T>)=>void,reject!:(reason:unknown)=>void;
 const promise=new Promise<T>((res,rej)=>{resolve=res;reject=rej});
 return {promise,resolve,reject};
}

test("repeated clicks run one mutation until its refresh finishes",async()=>{
 const pending=new Set<string>();
 const saved=deferred<void>(),refreshed=deferred<void>();
 let mutations=0;
 const action=async()=>{mutations++;await saved.promise;await refreshed.promise};
 const first=runGuardedAction(pending,"duplicate-food",action);
 await runGuardedAction(pending,"duplicate-food",action);
 saved.resolve();
 await runGuardedAction(pending,"duplicate-food",action);
 assert.equal(mutations,1);
 assert.ok(pending.has("duplicate-food"));
 refreshed.resolve();await first;
 await runGuardedAction(pending,"duplicate-food",action);
 assert.equal(mutations,2);
 assert.equal(pending.size,0);
});

test("unrelated actions remain available and a failed action can be retried",async()=>{
 const pending=new Set<string>();
 const waiting=deferred<void>();
 const first=runGuardedAction(pending,"food",()=>waiting.promise);
 let deleted=false;
 await runGuardedAction(pending,"delete",async()=>{deleted=true});
 assert.ok(deleted);
 waiting.reject(new Error("Save failed"));
 await assert.rejects(first,/Save failed/);
 let retried=false;
 await runGuardedAction(pending,"food",async()=>{retried=true});
 assert.ok(retried);
});

test("separate deletes and changed slider values are not discarded",async()=>{
 for(const name of ["delete","burn","rate-food"]){
  const pending=new Set<string>();
  const waiting=deferred<void>();
  let saves=0;
  const first=runGuardedAction(pending,name,async()=>{saves++;await waiting.promise});
  await runGuardedAction(pending,name,async()=>{saves++});
  waiting.resolve();await first;
  assert.equal(saves,2,name);
 }
});

test("a delayed refresh cannot restore an entry after a newer refresh removed it",async()=>{
 const old=deferred<string[]>(),latest=deferred<string[]>();
 let reads=0;
 const displayed:string[][]=[];
 const errors:unknown[]=[];
 const load=latestLoader(()=>++reads===1?old.promise:latest.promise,value=>displayed.push(value),error=>errors.push(error));
 const first=load(),second=load();
 latest.resolve(["original"]);await second;
 old.resolve(["original","deleted-copy"]);await first;
 assert.deepEqual(displayed,[["original"]]);
 assert.deepEqual(errors,[]);
});

test("refresh errors are shown only for the latest request",async()=>{
 const old=deferred<string>();
 let reads=0;
 const errors:unknown[]=[];
 const failure=new Error("Refresh failed");
 const load=latestLoader(()=>++reads===1?old.promise:Promise.reject(failure),()=>{},error=>errors.push(error));
 const first=load();await load();
 old.reject(new Error("Stale error"));await first;
 assert.deepEqual(errors,[failure]);
});

test("duplicate requires confirmation and cancellation sends no mutation",t=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,"window");
 t.after(()=>{if(originalWindow)Object.defineProperty(globalThis,"window",originalWindow);else Reflect.deleteProperty(globalThis,"window")});
 let confirmed=false,copies=0;
 const prompts:string[]=[];
 Object.defineProperty(globalThis,"window",{configurable:true,value:{confirm:(message:string)=>{prompts.push(message);return confirmed}}});
 const button=DuplicateFoodButton({name:"Toast",date:"2026-09-14",disabled:false,onDuplicate:()=>{copies++}});
 assert.equal(button.props.type,"button");
 button.props.onClick();
 assert.equal(copies,0);
 assert.match(prompts[0],/Toast.*2026-09-14/);
 confirmed=true;button.props.onClick();
 assert.equal(copies,1);
 const disabled=DuplicateFoodButton({name:"Toast",date:"2026-09-14",disabled:true,onDuplicate:()=>{copies++}});
 assert.equal(disabled.props.disabled,true);
 disabled.props.onClick();
 assert.equal(copies,1);
 assert.equal(prompts.length,2);
});
