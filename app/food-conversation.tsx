"use client";

import {useEffect,useRef,useState} from "react";
import {usePreparedPhotos} from "@/lib/food-photos";
import type {FoodEntry} from "@/lib/types";

function readableResponse(response:string){
 try{return JSON.stringify(JSON.parse(response),null,2)}catch{return response}
}

const sameFiles=(a:readonly File[],b:readonly File[])=>a.length===b.length&&a.every((file,index)=>file===b[index]);

export default function FoodConversation({entry,onSaved}:{entry:FoodEntry;onSaved:()=>void}){
 const [current,setCurrent]=useState(entry);
 const [question,setQuestion]=useState("");
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const {photos,setPhotos,preparing,photoError,add}=usePreparedPhotos();
 const inFlight=useRef(false);
 const retry=useRef<{id:string;message:string;files:File[]}|null>(null);
 const transcript=useRef<HTMLDivElement>(null);
 useEffect(()=>setCurrent(entry),[entry]);
 useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight},[current.conversation?.length,pending]);

 async function send(){
  const message=question.trim();
  const files=photos.map(photo=>photo.file);
  if((!message&&!files.length)||preparing>0||inFlight.current)return;
  inFlight.current=true;setPending(true);setError("");
  if(!retry.current||retry.current.message!==message||!sameFiles(retry.current.files,files))retry.current={id:crypto.randomUUID(),message,files};
  try{
   const form=new FormData();
   form.set("id",entry.id);form.set("submissionId",retry.current.id);form.set("message",message);
   files.forEach(file=>form.append("images",file));
   const response=await fetch("/api/food/follow-up",{method:"POST",body:form});
   const body=await response.json();
   if(!response.ok){
    if(response.status===409){retry.current=null;onSaved()}
    throw new Error(body.error||"Could not answer this question. Please try again.");
   }
   setCurrent(body.entry);setQuestion("");setPhotos([]);retry.current=null;onSaved();
  }catch(error){setError(error instanceof Error?error.message:"Could not answer this question. Please try again.")}
  finally{inFlight.current=false;setPending(false)}
 }

 return <details className="foodConversation">
  <summary>Analysis &amp; follow-up{current.conversation?.length?` · ${current.conversation.length/2} ${current.conversation.length===2?"reply":"replies"}`:""}</summary>
  <div className="foodConversationBody">
   {current.sourceText&&<div className="foodOriginal"><small>ORIGINAL DESCRIPTION</small><p>{current.sourceText}</p></div>}
   {!!current.images?.length&&<div className="savedFoodPhotos">{current.images.map((image,index)=><figure key={index}><a href={image.url} download={image.name||`food-photo-${index+1}`} title="Download saved photo"><img src={image.url} alt={`Saved food photo ${index+1} for ${current.name}`} loading="lazy"/></a><figcaption>{image.name||`Photo ${index+1}`}</figcaption></figure>)}</div>}
   {current.analysis?<div className="savedFoodAnalysis">
    <b>Original analysis</b>
    {current.analysis.explanation&&<p>{current.analysis.explanation}</p>}
    <details className="foodRawResponse"><summary>Full saved response</summary><pre>{readableResponse(current.analysis.response)}</pre></details>
   </div>:<p className="foodChatHint">The original response and photos were not saved for this older entry. You can still ask questions or correct its saved estimate.</p>}
   <div className="foodTranscript" ref={transcript} role="log" aria-label={`Conversation about ${current.name}`} aria-live="polite" aria-relevant="additions text">
    {current.conversation?.map(message=><div key={message.id} className={`foodChatMessage ${message.role}`}>
     <small>{message.role==="user"?"You":"Assistant"}</small>
     {!!message.images?.length&&<div className="foodChatPhotos">{message.images.map((image,index)=><a key={index} href={image.url} download={image.name||`follow-up-photo-${index+1}`} title="Download saved photo"><img src={image.url} alt={`Follow-up photo ${index+1} for ${current.name}`} loading="lazy"/></a>)}</div>}
     {message.content&&<p>{message.content}</p>}
     {message.updatedEntry&&<span className="foodUpdatedBadge">Entry updated</span>}
    </div>)}
    {pending&&<><div className="foodChatMessage user"><small>You</small>{!!photos.length&&<div className="foodChatPhotos">{photos.map(photo=><img key={photo.id} src={photo.url} alt="Follow-up photo being sent"/>)}</div>}{question.trim()&&<p>{question.trim()}</p>}</div><p className="foodChatHint" role="status">Reviewing your meal…</p></>}
   </div>
   <form onSubmit={event=>{event.preventDefault();void send()}}>
    <label htmlFor={`food-question-${entry.id}`}>Ask about this meal, correct the estimate, or add a photo of what is left</label>
    <textarea id={`food-question-${entry.id}`} value={question} onChange={event=>setQuestion(event.target.value)} onPaste={event=>add([...event.clipboardData.files])} maxLength={4000} disabled={pending} placeholder={'“Why is the estimate this high?” or “I only ate half the rice.”'}/>
    <label className="upload">＋ Add photos<input hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} onChange={event=>{add([...event.target.files??[]]);event.target.value=""}}/></label>
    {photos.length>0&&!pending&&<div className="previews">{photos.map(photo=><figure key={photo.id}><img src={photo.url} alt="Follow-up photo preview"/><button type="button" onClick={()=>setPhotos(current=>current.filter(other=>other.id!==photo.id))} aria-label="Remove photo">×</button></figure>)}</div>}
    {photoError&&<p className="foodChatError" role="alert">{photoError}</p>}
    <div className="foodChatActions"><p className="foodChatHint">Corrections update this entry and your daily totals. Your conversation is saved.</p><button className="primary" disabled={pending||preparing>0||(!question.trim()&&!photos.length)}>{pending?"Replying…":preparing>0?"Preparing photos…":"Send follow-up →"}</button></div>
    {error&&<p className="foodChatError" role="alert">{error}</p>}
   </form>
  </div>
 </details>;
}
