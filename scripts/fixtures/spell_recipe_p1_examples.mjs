// Synthetic Phase P1 schema examples ONLY: not approved gameplay recipes.
// They demonstrate mechanics shapes, not a verified interpretation of full
// XPHB text, source grants, reactions, damage modifiers or cast authority.
const qFixed=value=>({kind:"fixed",value});
const qCantrip=()=>({kind:"character-level-tiers",tiers:[
 {minLevel:1,value:1},{minLevel:5,value:2},
 {minLevel:11,value:3},{minLevel:17,value:4}
]});
const qSlot=(base,atSlotLevel,maximum)=>({kind:"slot-level",base,atSlotLevel,perSlotLevel:1,maximum});
const dice=(quantity,sides,rollScope)=>({quantity,sides,rollScope});
const target=(mode,origin,rangeFeet,geometry,maxTargets=1,repeats=false,cover="none")=>({
 mode,origin,rangeFeet,lineOfSight:"required",cover,geometry,maxTargets,allowRepeatedTargets:repeats
});
const single={shape:"single"};
const sphere=radiusFeet=>({shape:"sphere",radiusFeet});
const cone=lengthFeet=>({shape:"cone",lengthFeet});
const line=(lengthFeet,widthFeet)=>({shape:"line",lengthFeet,widthFeet});
const emanation=radiusFeet=>({shape:"emanation",radiusFeet});
const spell=(name,level,targeting,steps,costAction="action")=>({
 schemaVersion:1,recipeVersion:1,
 spell:{key:name+"|XPHB",ruleset:"2024",level},
 cost:{action:costAction,resource:level===0?{kind:"none"}:{kind:"spell-slot",minimumLevel:level}},
 targeting,entry:steps[0].id,steps
});
const bolt=spell("fire-bolt",0,target("creature","caster",120,{...single},1,false,"attack-ac"),[
 {id:"attack",op:"attack",attackType:"ranged-spell",target:"selected",onHit:"damage",onMiss:"$end"},
 {id:"damage",op:"damage",damageType:"fire",dice:dice(qCantrip(),10,"once-per-attack"),
  fraction:"full",rollGroup:"fire-bolt-roll",next:"$end"}
]);
const sacred=spell("sacred-flame",0,target("creature","caster",60,{...single}),[
 {id:"save",op:"save",ability:"dex",target:"selected",onSuccess:"$end",onFailure:"damage"},
 {id:"damage",op:"damage",damageType:"radiant",dice:dice(qCantrip(),8,"once-per-target"),
  fraction:"full",rollGroup:"sacred-flame-damage",next:"$end"}
]);
const eldritch=spell("eldritch-blast",0,target("creature","caster",120,{...single},4,true,"attack-ac"),[
 {id:"beam-loop",op:"repeat",count:qCantrip(),targetPolicy:"may-repeat",body:"attack",after:"$end"},
 {id:"attack",op:"attack",attackType:"ranged-spell",target:"selected",onHit:"damage",onMiss:"$end"},
 {id:"damage",op:"damage",damageType:"force",dice:dice(qFixed(1),10,"once-per-attack"),
  fraction:"full",rollGroup:"beam-force",next:"$end"}
]);
const scorching=spell("scorching-ray",2,target("creature","caster",120,{...single},10,true,"attack-ac"),[
 {id:"ray-loop",op:"repeat",count:qSlot(3,2,10),targetPolicy:"may-repeat",body:"attack",after:"$end"},
 {id:"attack",op:"attack",attackType:"ranged-spell",target:"selected",onHit:"damage",onMiss:"$end"},
 {id:"damage",op:"damage",damageType:"fire",dice:dice(qFixed(2),6,"once-per-attack"),
  fraction:"full",rollGroup:"ray-fire",next:"$end"}
]);
const missile=spell("magic-missile",1,target("creature","caster",120,{...single},11,true),[
 {id:"dart-loop",op:"repeat",count:qSlot(3,1,11),targetPolicy:"may-repeat",body:"auto-hit",after:"$end"},
 {id:"auto-hit",op:"auto-hit",target:"selected",next:"damage"},
 {id:"damage",op:"damage",damageType:"force",dice:dice(qFixed(1),4,"once-per-projectile"),
  flatBonus:1,fraction:"full",rollGroup:"missile-force",next:"$end"}
]);
const knife=spell("ice-knife",1,target("creature","caster",60,{...single},1,false,"attack-ac"),[
 {id:"knife-attack",op:"attack",attackType:"ranged-spell",target:"selected",onHit:"piercing",onMiss:"explosion"},
 {id:"piercing",op:"damage",damageType:"piercing",dice:dice(qFixed(1),10,"once-per-attack"),
  fraction:"full",rollGroup:"knife-piercing",next:"explosion"},
 {id:"explosion",op:"area",center:"impact-hex",geometry:sphere(5),next:"save"},
 {id:"save",op:"save",ability:"dex",target:"each-affected",onSuccess:"$end",onFailure:"cold"},
 {id:"cold",op:"damage",damageType:"cold",dice:dice(qFixed(2),6,"once-per-cast"),
  fraction:"full",rollGroup:"knife-explosion",next:"$end"}
]);
const fireball=spell("fireball",3,target("point","selected",150,sphere(20),20,false,"dex-save"),[
 {id:"area",op:"area",center:"selected-point",geometry:sphere(20),next:"save"},
 {id:"save",op:"save",ability:"dex",target:"each-affected",onSuccess:"half",onFailure:"full"},
 {id:"full",op:"damage",damageType:"fire",dice:dice(qFixed(8),6,"once-per-cast"),
  fraction:"full",rollGroup:"fireball-shared-dice",next:"$end"},
 {id:"half",op:"damage",damageType:"fire",dice:dice(qFixed(8),6,"once-per-cast"),
  fraction:"half",rollGroup:"fireball-shared-dice",next:"$end"}
]);
const radiance=spell("word-of-radiance",0,target("self","caster",0,emanation(5),20,false),[
 {id:"area",op:"area",center:"caster",geometry:emanation(5),next:"save"},
 {id:"save",op:"save",ability:"con",target:"each-affected",onSuccess:"$end",onFailure:"damage"},
 {id:"damage",op:"damage",damageType:"radiant",dice:dice(qCantrip(),6,"once-per-cast"),
  fraction:"full",rollGroup:"word-radiance-shared",next:"$end"}
]);
const burning=spell("burning-hands",1,target("self","caster",0,cone(15),20,false,"dex-save"),[
 {id:"area",op:"area",center:"caster",geometry:cone(15),next:"save"},
 {id:"save",op:"save",ability:"dex",target:"each-affected",onSuccess:"half",onFailure:"full"},
 {id:"full",op:"damage",damageType:"fire",dice:dice(qFixed(3),6,"once-per-cast"),
  fraction:"full",rollGroup:"burning-hands",next:"$end"},
 {id:"half",op:"damage",damageType:"fire",dice:dice(qFixed(3),6,"once-per-cast"),
  fraction:"half",rollGroup:"burning-hands",next:"$end"}
]);
const lightning=spell("lightning-bolt",3,target("self","caster",0,line(100,5),20,false,"dex-save"),[
 {id:"area",op:"area",center:"caster",geometry:line(100,5),next:"save"},
 {id:"save",op:"save",ability:"dex",target:"each-affected",onSuccess:"half",onFailure:"full"},
 {id:"full",op:"damage",damageType:"lightning",dice:dice(qFixed(8),6,"once-per-cast"),
  fraction:"full",rollGroup:"lightning-bolt",next:"$end"},
 {id:"half",op:"damage",damageType:"lightning",dice:dice(qFixed(8),6,"once-per-cast"),
  fraction:"half",rollGroup:"lightning-bolt",next:"$end"}
]);
const acid=spell("acid-splash",0,target("point","selected",60,sphere(5),20,false,"dex-save"),[
 {id:"area",op:"area",center:"selected-point",geometry:sphere(5),next:"save"},
 {id:"save",op:"save",ability:"dex",target:"each-affected",onSuccess:"$end",onFailure:"damage"},
 {id:"damage",op:"damage",damageType:"acid",dice:dice(qCantrip(),6,"once-per-cast"),
  fraction:"full",rollGroup:"acid-splash",next:"$end"}
]);
const word=spell("healing-word",1,target("creature","caster",60,{...single}),[
 {id:"heal",op:"heal",dice:dice(qFixed(2),4,"once-per-target"),
  rollGroup:"healing-word-dice",next:"$end"}
],"bonus-action");
export const P1_SYNTHETIC_RECIPES = Object.freeze([
 bolt,sacred,eldritch,scorching,missile,knife,fireball,radiance,burning,lightning,acid,word
]);
// CAUTION: These prototypes do not implement missing class modifiers,
// save bonuses, resource exceptions, concentration or lifecycle. E.g.
// Healing Word's spellcasting modifier is intentionally absent, so it
// cannot be promoted as gameplay-ready by a successful schema parse.
