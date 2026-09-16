type FoodDraft={date:string;time:string;text:string;price:string;images:readonly File[]};

// A failed response does not tell us whether the server saved the meal. Reuse
// the ID while retrying that draft; a new draft or a confirmed save starts anew.
export function createFoodSubmission(){
 let pending:{id:string;draft:FoodDraft}|undefined;
 return {
  idFor(draft:FoodDraft){
   const previous=pending?.draft;
   if(!previous||previous.date!==draft.date||previous.time!==draft.time||previous.text!==draft.text||previous.price!==draft.price||previous.images.length!==draft.images.length||previous.images.some((file,index)=>file!==draft.images[index])){
    pending={id:crypto.randomUUID(),draft:{...draft,images:[...draft.images]}};
   }
   return pending!.id;
  },
  complete(id:string){if(pending?.id===id)pending=undefined},
 };
}
