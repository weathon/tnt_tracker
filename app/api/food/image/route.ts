import {NextResponse} from "next/server";
import {z} from "zod";
import {findFood,FoodConversationError} from "@/lib/food-conversation";
import {readState} from "@/lib/store";

export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams;
  const id=z.string().min(1).parse(params.get("id"));
  const index=z.string().regex(/^\d+$/).transform(Number).parse(params.get("index"));
  const {entry}=findFood(await readState(),id);
  const image=entry.images?.[index];
  if(!image)throw new FoodConversationError("Photo not found.",404);
  const match=image.url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if(!match)throw new Error("Invalid saved photo");
  return new Response(Buffer.from(match[2],"base64"),{headers:{"Content-Type":match[1],"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not load photo"},{status:error instanceof FoodConversationError?error.status:400})}
}
