import {useEffect,useRef,useState} from "react";
import {createSerialQueue} from "./serial-queue";

async function resizeImageForUpload(file:File,maxSide=1024):Promise<File>{const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});try{const longest=Math.max(bitmap.width,bitmap.height);if(longest<=maxSide)return file;const scale=maxSide/longest;const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext("2d");if(!context)throw new Error("Image resizing is not supported by this browser");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error(`Could not resize ${file.name}`)),"image/jpeg",.86));const stem=file.name.replace(/\.[^.]+$/,"")||"image";return new File([blob],`${stem}.jpg`,{type:"image/jpeg",lastModified:file.lastModified})}finally{bitmap.close()}}
export type PreparedPhoto={id:string;file:File;url:string};

// Photos are resized as soon as they are chosen, one at a time, so a full-size
// original is never decoded alongside another one or during submission.
export function usePreparedPhotos(){
 const [photos,setPhotos]=useState<PreparedPhoto[]>([]),[preparing,setPreparing]=useState(0),[photoError,setPhotoError]=useState("");
 const [preparePhoto]=useState(createSerialQueue);
 const shownUrls=useRef<string[]>([]);
 useEffect(()=>{for(const url of shownUrls.current)if(!photos.some(photo=>photo.url===url))URL.revokeObjectURL(url);shownUrls.current=photos.map(photo=>photo.url)},[photos]);
 useEffect(()=>()=>shownUrls.current.forEach(url=>URL.revokeObjectURL(url)),[]);
 const add=(files:File[])=>{for(const original of files.filter(file=>file.type.startsWith("image/"))){setPreparing(count=>count+1);setPhotoError("");void preparePhoto(()=>resizeImageForUpload(original)).then(file=>{const photo={id:crypto.randomUUID(),file,url:URL.createObjectURL(file)};setPhotos(current=>[...current,photo])},error=>setPhotoError(`Could not read ${original.name||"that photo"}: ${error instanceof Error?error.message:"unknown error"}. Try adding it again.`)).finally(()=>setPreparing(count=>count-1))}};
 return {photos,setPhotos,preparing,photoError,add};
}
