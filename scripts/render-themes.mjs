import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const target=process.argv[2]??"http://localhost:3000/";
const outputDirectory=process.argv[3]??path.join(os.tmpdir(),"cal-theme-renders");
const profile=await fs.mkdtemp(path.join(os.tmpdir(),"cal-theme-chrome-"));
await fs.mkdir(outputDirectory,{recursive:true});

const browser=spawn(chrome,["--headless=new","--disable-gpu","--hide-scrollbars","--no-first-run","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdio:"ignore"});
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

try{
 let port;
 for(let attempt=0;attempt<100;attempt++){
  try{port=Number((await fs.readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]);break}catch{await sleep(100)}
 }
 if(!port)throw new Error("Chrome did not expose a debugging port");
 let pages=[];
 for(let attempt=0;attempt<50;attempt++){
  pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());
  if(pages.some(page=>page.type==="page"&&page.webSocketDebuggerUrl))break;
  await sleep(100);
 }
 const page=pages.find(candidate=>candidate.type==="page"&&candidate.webSocketDebuggerUrl);
 if(!page)throw new Error("Chrome did not expose a page target");
 const socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
 let messageId=0;
 const pending=new Map();
 socket.addEventListener("message",event=>{const message=JSON.parse(event.data);if(!message.id)return;const request=pending.get(message.id);if(!request)return;pending.delete(message.id);if(message.error)request.reject(new Error(message.error.message));else request.resolve(message.result)});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++messageId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 await send("Page.enable");
 await send("Runtime.enable");
 const sizes=[{name:"desktop",width:1440,height:1100,scale:1,mobile:false},{name:"phone",width:390,height:844,scale:2,mobile:true}];
 const themes=["garden","paper","midnight","contrast"];
 for(const size of sizes){
  await send("Emulation.setDeviceMetricsOverride",{width:size.width,height:size.height,deviceScaleFactor:size.scale,mobile:size.mobile});
  await send("Page.navigate",{url:target});
  await sleep(1400);
  for(const theme of themes){
   const result=await send("Runtime.evaluate",{returnByValue:true,expression:`(()=>{const select=[...document.querySelectorAll("label")].find(label=>label.firstChild?.textContent?.trim()==="Style")?.querySelector("select");if(!select)return {error:"Style select not found"};select.value=${JSON.stringify(theme)};select.dispatchEvent(new Event("change",{bubbles:true}));const shell=document.querySelector(".appShell"),main=document.querySelector("main"),card=document.querySelector(".card"),metric=document.querySelector(".metric"),input=document.querySelector("input"),button=document.querySelector("button");const styles=element=>{const value=getComputedStyle(element);return {background:value.backgroundColor,color:value.color,border:value.borderColor,shadow:value.boxShadow}};return {className:shell.className,shell:styles(shell),main:styles(main),card:styles(card),metric:styles(metric),input:styles(input),button:styles(button),viewport:{width:innerWidth,scrollWidth:document.documentElement.scrollWidth}}})()`});
   await sleep(250);
   const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,fromSurface:true});
   const filename=path.join(outputDirectory,`${theme}-${size.name}.png`);
   await fs.writeFile(filename,Buffer.from(screenshot.data,"base64"));
   process.stdout.write(`${filename}\n${JSON.stringify(result.result.value)}\n`);
  }
 }
 await send("Browser.close");
}finally{
 if(browser.exitCode===null)browser.kill("SIGTERM");
}
