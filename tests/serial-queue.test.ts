import test from "node:test";
import assert from "node:assert/strict";
import {createSerialQueue} from "../lib/serial-queue.ts";

test("jobs run one at a time in order",async()=>{
 const queue=createSerialQueue();
 const events:string[]=[];
 let running=0,peak=0;
 const job=(name:string,ms:number)=>()=>new Promise<string>(resolve=>{running++;peak=Math.max(peak,running);events.push(`start ${name}`);setTimeout(()=>{running--;events.push(`end ${name}`);resolve(name)},ms)});
 const results=await Promise.all([queue(job("a",20)),queue(job("b",1)),queue(job("c",5))]);
 assert.deepEqual(results,["a","b","c"]);
 assert.equal(peak,1);
 assert.deepEqual(events,["start a","end a","start b","end b","start c","end c"]);
});

test("a failed job rejects its caller without blocking later jobs",async()=>{
 const queue=createSerialQueue();
 const failed=queue(async()=>{throw new Error("unreadable photo")});
 const next=queue(async()=>"ok");
 await assert.rejects(failed,/unreadable photo/);
 assert.equal(await next,"ok");
});
