// The model estimates ingredients independently. All combined nutrition is
// calculated by foodEstimateFields, never requested from the model.
const quantity={type:"number",minimum:0};
export const foodEstimateJsonSchema={
 type:"object",additionalProperties:false,
 properties:{
  name:{type:"string",description:"Food name in the same language and script as the typed input"},
  amount:{type:"string",description:"Consumed amount in the same language and script as the typed input"},
  price:{type:["number","null"],minimum:0,description:"Actual price paid, only if explicitly provided or visible. Never estimate a price."},
  items:{
   type:"array",minItems:1,
   description:"Separate ingredients and consumed components, including oils and sauces. No whole-dish row alongside its ingredients.",
   items:{
    type:"object",additionalProperties:false,
    properties:{
     name:{type:"string",description:"The ingredient or labeled component, in the user's language"},
     price:{type:["number","null"],minimum:0,description:"Explicit price for this ingredient/component, or null. Never allocate a dish price among ingredients."},
     grams:quantity,kcal_per_100g:quantity,kcal:quantity,
     protein_g:{...quantity,description:"Protein in this ingredient's consumed portion"},
     carbs_g:{...quantity,description:"Carbohydrates in this ingredient's consumed portion"},
     fat_g:{...quantity,description:"Fat in this ingredient's consumed portion"},
     sodium_mg:{...quantity,description:"Elemental sodium in this ingredient's consumed portion"},
     confidence:{type:"string",enum:["high","medium","low"]},
    },
    required:["name","price","grams","kcal_per_100g","kcal","protein_g","carbs_g","fat_g","sodium_mg","confidence"],
   },
  },
 },
 required:["name","amount","price","items"],
};

export const foodAnalysisJsonSchema={
 ...foodEstimateJsonSchema,
 properties:{...foodEstimateJsonSchema.properties,explanation:{type:"string",description:"Explain ingredient assumptions and uncertainty naturally in the user's language. Do not calculate or report combined nutrition totals."}},
 required:[...foodEstimateJsonSchema.required,"explanation"],
};

export const foodFollowUpJsonSchema={
 type:"object",additionalProperties:false,
 properties:{
  reply:{type:"string",description:"A natural-language answer in the user's language. Explain ingredient changes without calculating new combined nutrition totals."},
  update:{anyOf:[foodEstimateJsonSchema,{type:"null"}],description:"Complete replacement ingredient estimates ONLY for an actual correction or requested change. Otherwise null."},
 },
 required:["reply","update"],
};
