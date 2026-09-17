import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import {blankDay,readState,updateState} from "../lib/store.ts";
import {DELETE,PATCH,POST} from "../app/api/food/route.ts";
import {GET as FOOD_IMAGE} from "../app/api/food/image/route.ts";
import {GET as GET_STATE} from "../app/api/state/route.ts";
import {POST as FOLLOW_UP} from "../app/api/food/follow-up/route.ts";
import type {State} from "../lib/types.ts";

// Replace the storage boundary so these tests never use real tracker data or credentials.
const blob:typeof import("@vercel/blob")=require("@vercel/blob");
const date="2026-09-14";
const food=(id:string)=>({id,name:"Toast",amount:"1 slice",energy:90,time:"08:00",createdAt:"2026-09-14T08:00:00.000Z"});
function storage(t:TestContext){
 t.mock.method(globalThis,"fetch",async()=>{throw new Error("Network access is disabled in storage tests")});
 const originalToken=process.env.BLOB_READ_WRITE_TOKEN;
 process.env.BLOB_READ_WRITE_TOKEN="test-only";
 t.after(()=>{if(originalToken===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=originalToken});
 const data={state:{profile:null,days:{[date]:{...blankDay(),foods:[food("original"),food("copy")]}},medicationList:[]} as State,version:1,exists:true,beforeRead:()=>{},beforeWrite:()=>{},afterWrite:()=>{},reads:0,writes:0};
 const metadata=()=>({url:"https://test.invalid/tracker.json",downloadUrl:"https://test.invalid/tracker.json",pathname:"fuel-and-motion/tracker.json",contentType:"application/json",contentDisposition:"attachment",cacheControl:"no-store",uploadedAt:new Date(),size:0,etag:`"stored-${data.version}"`});
 t.mock.method(blob,"head",async()=>{
  if(!data.exists)throw new blob.BlobNotFoundError();
  return metadata();
 });
 t.mock.method(blob,"get",async(...[_path,options]:Parameters<typeof blob.get>)=>{
  assert.equal(options.useCache,false);
  data.reads++;data.beforeRead();
  if(!data.exists)return null;
  // Delivery can use a weak/different ETag. Only the storage metadata's tag
  // is accepted by the write API, even when the underlying data is unchanged.
  return {statusCode:200,stream:new Response(JSON.stringify(data.state)).body!,headers:new Headers(),blob:{...metadata(),etag:`W/"download-${data.version}"`}} as Awaited<ReturnType<typeof blob.get>>;
 });
 t.mock.method(blob,"put",async(...[_path,body,options]:Parameters<typeof blob.put>)=>{
  data.writes++;
  data.beforeWrite();
  if(options.ifMatch!==undefined&&options.ifMatch!==metadata().etag)throw new blob.BlobPreconditionFailedError();
  if(data.exists&&!options.allowOverwrite)throw new blob.BlobError("This blob already exists");
  data.state=JSON.parse(String(body));data.version++;data.exists=true;
  data.afterWrite();
  return metadata();
 });
 return data;
}
const request=(method:string,body:object)=>new Request("http://test.invalid/api/food",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

test("an unchanged blob saves once even when its download ETag differs from storage metadata",async t=>{
 const data=storage(t);
 await updateState(state=>{state.days[date].trackerBurn=2000});
 assert.equal(data.state.days[date].trackerBurn,2000);
 assert.equal(data.writes,1);
});

test("a committed insert is not repeated after a lost acknowledgement and storage retry",async t=>{
 const data=storage(t);
 data.afterWrite=()=>{if(data.writes===1)throw new blob.BlobPreconditionFailedError()};
 await updateState(state=>{state.days[date].foods.push(food("new-meal"))});
 assert.deepEqual(data.state.days[date].foods.map(entry=>entry.id),["original","copy","new-meal"]);
 assert.equal(data.writes,1);
});

test("a committed duplicate is not repeated after a lost acknowledgement",async t=>{
 const data=storage(t);
 data.afterWrite=()=>{if(data.writes===1)throw new blob.BlobPreconditionFailedError()};
 const response=await PATCH(request("PATCH",{action:"duplicate",date,id:"original"}));
 assert.equal(response.status,200);
 assert.equal(data.state.days[date].foods.length,3);
 assert.equal(data.writes,1);
});

test("a committed split is not repeated after a lost acknowledgement",async t=>{
 const data=storage(t);
 const otherDate="2026-09-15";
 data.afterWrite=()=>{if(data.writes===1)throw new blob.BlobPreconditionFailedError()};
 const response=await PATCH(request("PATCH",{action:"split",date,id:"original",otherDate}));
 assert.equal(response.status,200);
 assert.equal(data.state.days[date].foods[0].energy,45);
 assert.equal(data.state.days[otherDate].foods.length,1);
 assert.equal(data.state.days[otherDate].foods[0].energy,45);
});

function foodAnalysis(t:TestContext){
 const originalKey=process.env.OPENROUTER_API_KEY;
 process.env.OPENROUTER_API_KEY="test-only";
 t.after(()=>{if(originalKey===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=originalKey});
 let calls=0;
 t.mock.method(globalThis,"fetch",async(url:string)=>{
  assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");calls++;
  return Response.json({choices:[{message:{content:JSON.stringify({name:"Toast",amount:"1 slice",items:[{name:"Toast",grams:30,kcal_per_100g:300,kcal:90,protein_g:3,carbs_g:15,fat_g:2,sodium_mg:20,confidence:"medium"}],explanation:"One slice of toast, with moderate confidence in the portion size."})}}]});
 });
 return ()=>calls;
}
function submission(submissionId:string,text="Toast"){
 const form=new FormData();
 for(const [key,value] of Object.entries({date,time:"08:00",text,submissionId}))form.set(key,value);
 return new Request("http://test.invalid/api/food",{method:"POST",body:form});
}

test("retrying the same food submission returns its saved entry without another analysis",async t=>{
 const data=storage(t),calls=foodAnalysis(t),id=crypto.randomUUID();
 const first=await POST(submission(id)),second=await POST(submission(id));
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.deepEqual(await second.json(),await first.json());
 assert.equal(data.state.days[date].foods.length,3);
 assert.equal(calls(),1);
});

test("overlapping food submissions with one ID save exactly one entry",async t=>{
 const data=storage(t);foodAnalysis(t);const id=crypto.randomUUID();
 const responses=await Promise.all([POST(submission(id)),POST(submission(id))]);
 assert.deepEqual(responses.map(response=>response.status),[200,200]);
 assert.deepEqual(await responses[0].json(),await responses[1].json());
 assert.equal(data.state.days[date].foods.length,3);
});

test("a food retry recovers a save whose response was lost",async t=>{
 const data=storage(t),calls=foodAnalysis(t),id=crypto.randomUUID();
 data.afterWrite=()=>{if(data.writes===1)throw new Error("Connection lost after saving")};
 assert.equal((await POST(submission(id))).status,400);
 const retry=await POST(submission(id));
 assert.equal(retry.status,200);
 assert.equal((await retry.json()).id,id);
 assert.equal(data.state.days[date].foods.length,3);
 assert.equal(data.writes,1);
 assert.equal(calls(),1);
});

test("a competing server committing the same food request is respected on conflict",async t=>{
 const data=storage(t);foodAnalysis(t);const id=crypto.randomUUID();
 data.beforeWrite=()=>{
  if(data.writes===1){
   data.state.days[date].foods.push({...food(id),energy:123});
   data.state.appliedMutationIds=[`food:${id}`];
   data.version++;
  }
 };
 const response=await POST(submission(id));
 assert.equal(response.status,200);
 assert.equal((await response.json()).energy,123);
 assert.equal(data.state.days[date].foods.length,3);
 assert.equal(data.writes,1);
});

test("retrying after a move returns the moved entry without recreating the original",async t=>{
 const data=storage(t),calls=foodAnalysis(t),id=crypto.randomUUID(),newDate="2026-09-15";
 await POST(submission(id));
 assert.equal((await PATCH(request("PATCH",{date,id,newDate,time:"09:00"}))).status,200);
 const retry=await POST(submission(id));
 assert.equal(retry.status,200);
 assert.equal((await retry.json()).time,"09:00");
 assert.equal(data.state.days[date].foods.length,2);
 assert.equal(data.state.days[newDate].foods.length,1);
 assert.equal(calls(),1);
});

test("a late retry does not restore a deleted food submission",async t=>{
 const data=storage(t),calls=foodAnalysis(t),id=crypto.randomUUID();
 await POST(submission(id));
 assert.equal((await DELETE(request("DELETE",{date,id}))).status,200);
 const writes=data.writes;
 assert.equal((await POST(submission(id))).status,409);
 assert.equal(data.state.days[date].foods.length,2);
 assert.equal(data.writes,writes);
 assert.equal(calls(),1);
});

test("separate submissions can intentionally log the same meal twice",async t=>{
 const data=storage(t);foodAnalysis(t);
 const first=await POST(submission(crypto.randomUUID())),second=await POST(submission(crypto.randomUUID()));
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.notEqual((await first.json()).id,(await second.json()).id);
 assert.equal(data.state.days[date].foods.length,4);
});

test("an empty food submission cannot create another entry",async t=>{
 const data=storage(t),calls=foodAnalysis(t);
 assert.equal((await POST(submission(crypto.randomUUID(),"  "))).status,400);
 assert.equal(data.state.days[date].foods.length,2);
 assert.equal(data.writes,0);assert.equal(calls(),0);
});

test("a change between metadata and content reads is retried against the latest version",async t=>{
 const data=storage(t);
 data.beforeRead=()=>{if(data.reads===1){data.state.days[date].foods.push(food("new-meal"));data.version++}};
 await updateState(state=>{state.days[date].trackerBurn=2000});
 assert.equal(data.writes,2);
 assert.deepEqual(data.state.days[date].foods.map(entry=>entry.id),["original","copy","new-meal"]);
 assert.equal(data.state.days[date].trackerBurn,2000);
});

test("an overlapping save cannot restore a copy deleted by another server",async t=>{
 const data=storage(t);
 data.beforeWrite=()=>{if(data.writes===1){data.state.days[date].foods=[food("original")];data.version++}};
 await updateState(state=>{state.days[date].trackerBurn=2000});
 assert.deepEqual(data.state.days[date].foods.map(entry=>entry.id),["original"]);
 assert.equal(data.state.days[date].trackerBurn,2000);
 assert.equal(data.writes,2);
});

test("deleting a food preserves a concurrent addition and only removes its target",async t=>{
 const data=storage(t);
 data.beforeWrite=()=>{if(data.writes===1){data.state.days[date].foods.push(food("new-meal"));data.version++}};
 const response=await DELETE(request("DELETE",{date,id:"copy"}));
 assert.equal(response.status,200);
 assert.deepEqual(data.state.days[date].foods.map(entry=>entry.id),["original","new-meal"]);
});

test("a duplicate retried after a storage conflict creates exactly one copy",async t=>{
 const data=storage(t);
 data.beforeWrite=()=>{if(data.writes===1){data.state.days[date].trackerBurn=2200;data.version++}};
 const response=await PATCH(request("PATCH",{action:"duplicate",date,id:"original"}));
 assert.equal(response.status,200);
 const entries=data.state.days[date].foods;
 assert.equal(entries.length,3);
 assert.equal(new Set(entries.map(entry=>entry.id)).size,3);
 assert.equal(entries[0].id,"original");
 assert.equal(entries[2].id,"copy");
 assert.equal(data.state.days[date].trackerBurn,2200);
});

test("persistent conflicts fail without overwriting data and do not block later saves",async t=>{
 const data=storage(t);
 data.beforeWrite=()=>{data.version++};
 await assert.rejects(updateState(state=>{state.days[date].foods=[]}),/changed while saving/);
 assert.equal(data.writes,5);
 assert.equal(data.state.days[date].foods.length,2);
 data.beforeWrite=()=>{};
 await updateState(state=>{state.days[date].trackerBurn=1800});
 assert.equal(data.state.days[date].trackerBurn,1800);
});

test("ordinary write failures are not blindly retried",async t=>{
 const data=storage(t);
 data.beforeWrite=()=>{throw new Error("Connection lost")};
 await assert.rejects(updateState(state=>{state.days[date].foods=[]}),/Connection lost/);
 assert.equal(data.writes,1);
 assert.equal(data.state.days[date].foods.length,2);
});

test("creating a new store never overwrites one created by another server",async t=>{
 const data=storage(t);data.exists=false;
 data.beforeWrite=()=>{data.exists=true;data.version++};
 await assert.rejects(updateState(state=>{state.days[date]=blankDay()}),/already exists/);
 assert.equal(data.state.days[date].foods.length,2);
});

test("same-process mutations are serialized and reads retain the public state shape",async t=>{
 const data=storage(t);
 await Promise.all([
  updateState(state=>{state.days[date].foods.push(food("new-meal"))}),
  updateState(state=>{state.days[date].foods=state.days[date].foods.filter(entry=>entry.id!=="copy")}),
 ]);
 assert.deepEqual(data.state.days[date].foods.map(entry=>entry.id),["original","new-meal"]);
 const state=await readState();
 assert.ok(state.days[date]);
 assert.equal("etag" in state,false);
});

const updatedEstimate={name:"Toast",amount:"Half a slice",price:2,items:[{name:"Toast",price:2,grams:15,kcal_per_100g:300,kcal:45,protein_g:1.5,carbs_g:7.5,fat_g:1,sodium_mg:10,confidence:"medium"}]};
const photo={name:"toast.png",url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="};
function followUpAnalysis(t:TestContext,result:unknown={reply:"Updated to half a slice, about 45 kcal.",update:updatedEstimate},onRequest:(body:any)=>void=()=>{}){
 foodAnalysis(t); // Supplies a test-only API key with cleanup.
 let calls=0;
 t.mock.method(globalThis,"fetch",async(url:string,init:RequestInit)=>{
  assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");calls++;onRequest(JSON.parse(String(init.body)));
  return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});
 });
 return ()=>calls;
}
function followUp(submissionId=crypto.randomUUID(),message="I only ate half the toast.",id="original"){
 return request("POST",{id,submissionId,message});
}

test("food analysis saves the exact response and uploaded photo",async t=>{
 const data=storage(t);foodAnalysis(t);
 const form=new FormData();
 form.set("date",date);form.set("time","08:00");form.set("text","Toast");
 form.append("images",new Blob([Buffer.from(photo.url.split(",")[1],"base64")],{type:"image/png"}),photo.name);
 const response=await POST(new Request("http://test.invalid/api/food",{method:"POST",body:form}));
 assert.equal(response.status,200);
 const entry=await response.json();
 assert.equal(entry.images[0].url,`/api/food/image?id=${entry.id}&index=0`);
 const image=await FOOD_IMAGE(new Request(`http://test.invalid${entry.images[0].url}`));
 assert.equal(image.status,200);assert.equal(image.headers.get("Content-Type"),"image/png");
 assert.equal(Buffer.from(await image.arrayBuffer()).toString("base64"),photo.url.split(",")[1]);
 const stateResponse=await GET_STATE();
 assert.ok(!(await stateResponse.text()).includes(photo.url));
 assert.equal(JSON.parse(entry.analysis.response).items[0].kcal,90);
 assert.equal("total_kcal" in JSON.parse(entry.analysis.response),false);
 assert.equal(entry.energy,90);assert.equal(entry.macros.proteinG,3);
 assert.equal(data.state.days[date].foods.at(-1)?.analysis?.response,entry.analysis.response);
 assert.deepEqual((await readState()).days[date].foods.at(-1)?.images,[photo]);
});

test("food uploads reject non-images before calling the model or saving",async t=>{
 const data=storage(t),calls=foodAnalysis(t);
 const form=new FormData();form.set("date",date);form.set("time","08:00");
 form.append("images",new Blob(["<script>alert(1)</script>"],{type:"image/png"}),"fake.png");
 assert.equal((await POST(new Request("http://test.invalid/api/food",{method:"POST",body:form}))).status,400);
 assert.equal(data.writes,0);assert.equal(calls(),0);
});

test("a follow-up sees saved photos and history, updates nutrition, and retains original evidence",async t=>{
 const data=storage(t);
 const entry=data.state.days[date].foods[0];
 entry.images=[photo];entry.sourceText="Toast for breakfast";
 entry.analysis={response:'{"original":true}',createdAt:entry.createdAt};
 entry.userTasteScore=8;entry.userTasteNote="Crispy";
 entry.conversation=[{id:"old-question",role:"user",content:"Is this toast?",createdAt:entry.createdAt},{id:"old-reply",role:"assistant",content:"Yes.",createdAt:entry.createdAt}];
 followUpAnalysis(t,undefined,body=>{
  assert.ok(body.messages.some((m:any)=>Array.isArray(m.content)&&m.content.some((c:any)=>c.image_url?.url===photo.url)));
  assert.ok(body.messages.some((m:any)=>m.content==="Yes."));
  assert.match(JSON.stringify(body.messages),/original/);
  assert.match(body.messages.at(-1).content,/Current saved entry/);
 });
 const response=await FOLLOW_UP(followUp());
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.reply.content,"Updated to half a slice, about 45 kcal.");
 assert.equal(body.reply.updatedEntry,true);
 const saved=data.state.days[date].foods[0];
 assert.equal(saved.energy,45);assert.equal(saved.macros?.proteinG,1.5);assert.equal(saved.sodiumMg,10);
 assert.equal(saved.price,2);assert.equal(saved.userTasteScore,8);assert.equal(saved.userTasteNote,"Crispy");
 assert.equal(saved.time,"08:00");assert.equal(saved.analysis?.response,entry.analysis.response);
 assert.deepEqual(saved.images,[photo]);assert.equal(saved.conversation?.length,4);
 assert.equal(data.state.days[date].foods[1].energy,90);
});

test("question-only follow-ups save a natural reply without changing the entry values",async t=>{
 const data=storage(t),before=structuredClone(data.state.days[date].foods[0]);
 followUpAnalysis(t,{reply:"This estimate assumes one 30 g slice of toast.",update:null});
 assert.equal((await FOLLOW_UP(followUp(crypto.randomUUID(),"Why 90 kcal?"))).status,200);
 const {conversation,...after}=data.state.days[date].foods[0];
 assert.deepEqual(after,before);assert.equal(conversation?.at(-1)?.updatedEntry,false);
});

test("follow-up retries and overlapping requests commit a correction only once",async t=>{
 const data=storage(t),calls=followUpAnalysis(t),id=crypto.randomUUID();
 const responses=await Promise.all([FOLLOW_UP(followUp(id)),FOLLOW_UP(followUp(id))]);
 assert.deepEqual(responses.map(response=>response.status),[200,200]);
 assert.deepEqual(await responses[0].json(),await responses[1].json());
 const callCount=calls();
 assert.equal((await FOLLOW_UP(followUp(id))).status,200);
 assert.equal(calls(),callCount);assert.equal(data.writes,1);
 assert.equal(data.state.days[date].foods[0].conversation?.length,2);
 assert.equal(data.state.days[date].foods[0].energy,45);
});

test("a follow-up retry recovers a lost acknowledgement without a second correction",async t=>{
 const data=storage(t),calls=followUpAnalysis(t),id=crypto.randomUUID();
 data.afterWrite=()=>{throw new Error("Connection lost after saving")};
 assert.equal((await FOLLOW_UP(followUp(id))).status,400);
 assert.equal((await FOLLOW_UP(followUp(id))).status,200);
 assert.equal(calls(),1);assert.equal(data.writes,1);
 assert.equal(data.state.days[date].foods[0].conversation?.length,2);
});

test("two different follow-ups cannot overwrite one another using a stale estimate",async t=>{
 const data=storage(t);followUpAnalysis(t);
 const responses=await Promise.all([FOLLOW_UP(followUp()),FOLLOW_UP(followUp())]);
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
 assert.equal(data.writes,1);assert.equal(data.state.days[date].foods[0].conversation?.length,2);
});

test("follow-ups preserve a concurrent rating and follow an entry moved to another date",async t=>{
 const data=storage(t),newDate="2026-09-15";
 followUpAnalysis(t,undefined,()=>{
  const [entry]=data.state.days[date].foods.splice(0,1);
  entry.time="10:00";entry.userTasteScore=9;entry.userTasteNote="New note";
  data.state.days[newDate]={...blankDay(),foods:[entry]};data.version++;
 });
 assert.equal((await FOLLOW_UP(followUp())).status,200);
 const entry=data.state.days[newDate].foods[0];
 assert.equal(entry.energy,45);assert.equal(entry.time,"10:00");assert.equal(entry.userTasteScore,9);assert.equal(entry.userTasteNote,"New note");
 assert.equal(data.state.days[date].foods.length,1);
});

test("a changed or deleted meal cannot be restored by a delayed follow-up",async t=>{
 const data=storage(t);
 followUpAnalysis(t,undefined,()=>{data.state.days[date].foods[0].energy=30;data.version++});
 assert.equal((await FOLLOW_UP(followUp())).status,409);
 assert.equal(data.state.days[date].foods[0].energy,30);assert.equal(data.writes,0);
 followUpAnalysis(t,undefined,()=>{data.state.days[date].foods=[];data.version++});
 assert.equal((await FOLLOW_UP(followUp())).status,404);
 assert.equal(data.state.days[date].foods.length,0);assert.equal(data.writes,0);
});

test("invalid ingredient nutrition cannot alter a meal or save a misleading success reply",async t=>{
 const data=storage(t),calls=followUpAnalysis(t,{reply:"Changed it.",update:{...updatedEstimate,items:[{...updatedEstimate.items[0],protein_g:-5}]}});
 assert.equal((await FOLLOW_UP(followUp())).status,400);
 assert.equal(calls(),2);assert.equal(data.writes,0);
 assert.equal(data.state.days[date].foods[0].energy,90);assert.equal(data.state.days[date].foods[0].conversation,undefined);
});

test("empty follow-ups and missing entries do not call the model",async t=>{
 const data=storage(t),calls=followUpAnalysis(t);
 assert.equal((await FOLLOW_UP(followUp(crypto.randomUUID()," "))).status,400);
 assert.equal((await FOLLOW_UP(followUp(crypto.randomUUID(),"Why?","missing"))).status,404);
 assert.equal(data.writes,0);assert.equal(calls(),0);
});
