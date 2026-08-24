export type ImageInput={mime:string;base64:string};

export function foodContent(text:string,images:ImageInput[]){
 return [
  {type:"text",text:`Analyze this meal. ${text?`User description: ${text}`:"There is no text description."}`},
  ...images.map(image=>({type:"image_url",image_url:{url:`data:${image.mime};base64,${image.base64}`}})),
 ];
}
