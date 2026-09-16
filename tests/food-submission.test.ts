import test from "node:test";
import assert from "node:assert/strict";
import {createFoodSubmission} from "../lib/food-submission.ts";

const draft={date:"2026-09-15",time:"12:00",text:"Toast",price:"",images:[] as File[]};

test("retrying an unchanged draft reuses its submission ID until success",()=>{
 const submission=createFoodSubmission();
 const id=submission.idFor(draft);
 assert.equal(submission.idFor({...draft,images:[]}),id);
 submission.complete(id);
 assert.notEqual(submission.idFor(draft),id);
});

test("changed food inputs start a separate submission",()=>{
 for(const change of [{date:"2026-09-16"},{time:"13:00"},{text:"Rice"},{price:"5"},{images:[new File(["photo"],"meal.png",{type:"image/png"})]}]){
  const submission=createFoodSubmission();
  const id=submission.idFor(draft);
  assert.notEqual(submission.idFor({...draft,...change}),id);
 }
});

test("replacing a photo starts a new submission even when its metadata matches",()=>{
 const submission=createFoodSubmission();
 const photo=new File(["first"],"meal.png",{type:"image/png",lastModified:1});
 const other=new File(["other"],"meal.png",{type:"image/png",lastModified:1});
 const id=submission.idFor({...draft,images:[photo]});
 assert.equal(submission.idFor({...draft,images:[photo]}),id);
 assert.notEqual(submission.idFor({...draft,images:[other]}),id);
});

test("completion of an earlier draft does not clear a newer draft's retry ID",()=>{
 const submission=createFoodSubmission();
 const old=submission.idFor(draft);
 const nextDraft={...draft,text:"Rice"};
 const next=submission.idFor(nextDraft);
 submission.complete(old);
 assert.equal(submission.idFor(nextDraft),next);
});
