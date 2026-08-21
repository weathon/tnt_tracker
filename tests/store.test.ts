import test from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../lib/store.ts";

test("past medication becomes a stable reusable list item",()=>{
 const day={foods:[],activities:[],medications:[{id:"entry",name:"Medicine Name",dose:"10 mg",time:"08:30",createdAt:"2026-08-01T08:30:00.000Z"}],trackerBurn:null,correctionFactor:1,rulerPosition:.5};
 const first=normalizeState({profile:null,days:{"2026-08-01":day}});
 const second=normalizeState({profile:null,days:{"2026-08-01":day}});
 assert.equal(first.medicationList.length,1);
 assert.equal(first.medicationList[0].name,"Medicine Name");
 assert.equal(first.medicationList[0].id,second.medicationList[0].id);
});

test("a forgotten history medicine stays forgotten",()=>{
 const day={foods:[],activities:[],medications:[{id:"entry",name:"Medicine Name",dose:"10 mg",time:"08:30",createdAt:"2026-08-01T08:30:00.000Z"}],trackerBurn:null,correctionFactor:1,rulerPosition:.5};
 const first=normalizeState({profile:null,days:{"2026-08-01":day}});
 const next=normalizeState({...first,medicationList:[],forgottenMedicationIds:[first.medicationList[0].id]});
 assert.deepEqual(next.medicationList,[]);
});

test("the same medication with different dosages creates separate checklist items",()=>{
 const day={foods:[],activities:[],medications:[
  {id:"morning",name:"Medicine Name",dose:"5 mg",time:"08:30",createdAt:"2026-08-01T08:30:00.000Z"},
  {id:"evening",name:"Medicine Name",dose:"10 mg",time:"20:30",createdAt:"2026-08-01T20:30:00.000Z"},
 ],trackerBurn:null,correctionFactor:1,rulerPosition:.5};
 const state=normalizeState({profile:null,days:{"2026-08-01":day}});
 assert.deepEqual(state.medicationList.map(medication=>medication.dose),["5 mg","10 mg"]);
 assert.notEqual(state.medicationList[0].id,state.medicationList[1].id);
});
