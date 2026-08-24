import test from "node:test";
import assert from "node:assert/strict";
import {createBackup,parseBackup} from "../lib/backup.ts";
import type {State} from "../lib/types.ts";

const state:State={
 profile:{sex:"female",age:34,heightCm:168},
 days:{"2026-08-23":{foods:[{id:"food-1",name:"Lunch",amount:"1 bowl",energy:600,time:"12:30",createdAt:"2026-08-23T19:30:00.000Z"}],activities:[],medications:[],weights:[{id:"weight-1",weightKg:65.2,time:"07:30",createdAt:"2026-08-23T14:30:00.000Z"}],trackerBurn:2100,correctionFactor:.9,rulerPosition:.5}},
 medicationList:[],
 forgottenMedicationIds:["history-old"],
};

test("backup round-trips all application state",()=>{
 const backup=createBackup(state,"2026-08-23T20:00:00.000Z");
 assert.equal(backup.app,"fuel-and-motion");
 assert.equal(backup.version,1);
 assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(backup))),state);
});

test("backup import fills arrays omitted by older day records",()=>{
 const backup=createBackup(state,"2026-08-23T20:00:00.000Z") as unknown as Record<string,unknown>;
 const data=(backup.data as State);
 delete data.days["2026-08-23"].medications;
 delete data.days["2026-08-23"].weights;
 const parsed=parseBackup(backup);
 assert.deepEqual(parsed.days["2026-08-23"].medications,[]);
 assert.deepEqual(parsed.days["2026-08-23"].weights,[]);
});

test("backup import rejects files from another format",()=>{
 assert.throws(()=>parseBackup({app:"something-else",version:1,exportedAt:"now",data:state}));
 assert.throws(()=>parseBackup({app:"fuel-and-motion",version:2,exportedAt:"now",data:state}));
});

test("legacy profile weight is preserved",()=>{
 const legacy={...state,profile:{...state.profile!,weightKg:66}};
 const parsed=parseBackup(createBackup(legacy,"2026-08-23T20:00:00.000Z"));
 assert.equal((parsed.profile as typeof parsed.profile&{weightKg:number})?.weightKg,66);
});
