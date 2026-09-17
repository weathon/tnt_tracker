import {z} from "zod";
import type {FoodImage} from "./types";

const MAX_IMAGE_BYTES=3*1024*1024;
export const foodImagesSchema=z.array(z.object({
 name:z.string().max(255),
 url:z.string().max(MAX_IMAGE_BYTES*4/3+64).regex(/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/,"Invalid saved food image"),
}).strict()).max(6).refine(images=>images.reduce((size,image)=>size+image.url.length,0)<=MAX_IMAGE_BYTES*4/3+6*64,"Food photos must total 3 MB or less");

export async function readFoodImages(values:FormDataEntryValue[]):Promise<FoodImage[]>{
 if(values.length>6)throw new Error("Add up to 6 food photos at a time.");
 let total=0;
 const images:FoodImage[]=[];
 for(const value of values){
  if(typeof value==="string"||!value.size)throw new Error("Choose a valid food photo.");
  total+=value.size;
  if(total>MAX_IMAGE_BYTES)throw new Error("Food photos must total 3 MB or less. Use smaller images or fewer photos.");
  const bytes=new Uint8Array(await value.arrayBuffer());
  let mime:string|undefined;
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime="image/jpeg";
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)mime="image/png";
  if(String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/))mime="image/gif";
  if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")mime="image/webp";
  if(!mime)throw new Error("Food photos must be JPEG, PNG, WebP, or GIF images.");
  images.push({name:value.name.slice(0,255),url:`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`});
 }
 return foodImagesSchema.parse(images);
}
