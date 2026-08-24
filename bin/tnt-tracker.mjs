#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const base=(process.env.TNT_TRACKER_URL||"http://localhost:3000").replace(/\/$/,"");
const argv=process.argv.slice(2);
const command=argv.shift();
const action=argv[0]?.startsWith("--")?undefined:argv.shift();

function options(args){const out={};for(let i=0;i<args.length;i++){const key=args[i];if(!key.startsWith("--"))throw new Error(`Unexpected argument: ${key}`);const name=key.slice(2);const value=args[++i];if(value==null||value.startsWith("--"))throw new Error(`Missing value for --${name}`);out[name]??=[];out[name].push(value)}return out}
const opt=options(argv);
const one=(name,fallback)=>opt[name]?.at(-1)??fallback;
const required=name=>{const value=one(name);if(value==null)throw new Error(`Missing --${name}`);return value};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const now=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const jsonHeaders={"Content-Type":"application/json"};

async function call(route,init){const response=await fetch(base+route,init);const text=await response.text();let body;try{body=JSON.parse(text)}catch{body={error:text||`HTTP ${response.status}`}}if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);return body}
const send=(route,method,body)=>call(route,{method,headers:jsonHeaders,body:JSON.stringify(body)});
const mime=file=>({".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif"}[path.extname(file).toLowerCase()]);

function help(){console.log(`tnt-tracker — control a running Fuel & Motion server

Environment:
  TNT_TRACKER_URL=http://localhost:3000

Commands:
  state
  day show [--date YYYY-MM-DD]
  profile set --sex male|female --age N --height CM
  tracker set [--date DATE] --burn N|none [--factor N] [--position 0..1]
  food add [--date DATE] [--time HH:MM] [--text TEXT] [--image PATH ...]
  food delete [--date DATE] --id ID
  food move [--date DATE] --id ID --to-date DATE --time HH:MM
  activity add [--date DATE] [--text TEXT] [--image PATH ...]
  activity delete [--date DATE] --id ID
  activity move [--date DATE] --id ID --to-date DATE --time HH:MM
  medication add [--date DATE] [--time HH:MM] --name NAME --dose TEXT
  medication delete [--date DATE] --id ID
  weight add [--date DATE] [--time HH:MM] --kg NUMBER
  weight delete [--date DATE] --id ID

All successful commands print JSON. Dates and times default to local now.`)}

async function main(){
 if(!command||command==="help"||command==="--help"){help();return}
 const date=one("date",today());
 if(command==="state")return call("/api/state");
 if(command==="day"&&action==="show"){const state=await call("/api/state");return {date,profile:state.profile,day:state.days?.[date]??null}}
 if(command==="profile"&&action==="set")return send("/api/profile","PUT",{sex:required("sex"),age:Number(required("age")),heightCm:Number(required("height"))});
 if(command==="tracker"&&action==="set"){const burn=required("burn");return send("/api/day","PUT",{date,trackerBurn:burn==="none"?null:Number(burn),correctionFactor:Number(one("factor","1")),rulerPosition:Number(one("position","0.5"))})}
 if(command==="food"&&action==="add"){const form=new FormData();form.set("date",date);form.set("time",one("time",now()));form.set("text",one("text",""));for(const file of opt.image??[]){const type=mime(file);if(!type)throw new Error(`Unsupported image extension: ${file}`);form.append("images",new Blob([await readFile(file)],{type}),path.basename(file))}return call("/api/food",{method:"POST",body:form})}
 if(command==="food"&&action==="delete")return send("/api/food","DELETE",{date,id:required("id")});
 if(command==="food"&&action==="move")return send("/api/food","PATCH",{date,id:required("id"),newDate:required("to-date"),time:required("time")});
 if(command==="activity"&&action==="add"){const form=new FormData();form.set("date",date);form.set("text",one("text",""));for(const file of opt.image??[]){const type=mime(file);if(!type)throw new Error(`Unsupported image extension: ${file}`);form.append("images",new Blob([await readFile(file)],{type}),path.basename(file))}if(!one("text")&&!(opt.image?.length))throw new Error("Provide --text or --image");return call("/api/activity",{method:"POST",body:form})}
 if(command==="activity"&&action==="delete")return send("/api/activity","DELETE",{date,id:required("id")});
 if(command==="activity"&&action==="move")return send("/api/activity","PATCH",{date,id:required("id"),newDate:required("to-date"),time:required("time")});
 if(command==="medication"&&action==="add")return send("/api/medication","POST",{date,time:one("time",now()),name:required("name"),dose:required("dose")});
 if(command==="medication"&&action==="delete")return send("/api/medication","DELETE",{date,id:required("id")});
 if(command==="weight"&&action==="add")return send("/api/weight","POST",{date,time:one("time",now()),weightKg:Number(required("kg"))});
 if(command==="weight"&&action==="delete")return send("/api/weight","DELETE",{date,id:required("id")});
 throw new Error(`Unknown command: ${[command,action].filter(Boolean).join(" ")}. Run tnt-tracker help.`)
}

try{const result=await main();if(result!==undefined)console.log(JSON.stringify(result,null,2))}catch(error){console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)},null,2));process.exitCode=1}
