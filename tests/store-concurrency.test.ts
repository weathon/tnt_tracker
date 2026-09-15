import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import {blankDay,readState,updateState} from "../lib/store.ts";
import {DELETE,PATCH} from "../app/api/food/route.ts";
import type {State} from "../lib/types.ts";

// Replace the storage boundary so these tests never use real tracker data or credentials.
const blob:typeof import("@vercel/blob")=require("@vercel/blob");
const date="2026-09-14";
const food=(id:string)=>({id,name:"Toast",amount:"1 slice",energy:90,time:"08:00",createdAt:"2026-09-14T08:00:00.000Z"});
function storage(t:TestContext){
 const originalToken=process.env.BLOB_READ_WRITE_TOKEN;
 process.env.BLOB_READ_WRITE_TOKEN="test-only";
 t.after(()=>{if(originalToken===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=originalToken});
 const data={state:{profile:null,days:{[date]:{...blankDay(),foods:[food("original"),food("copy")]}},medicationList:[]} as State,version:1,exists:true,beforeRead:()=>{},beforeWrite:()=>{},reads:0,writes:0};
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
