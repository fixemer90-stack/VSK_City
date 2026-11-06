import {Assets,Container,Matrix,Sprite,Texture} from 'pixi.js';
export const SPRITE_IDS=[
 'house-01','house-02','house-03','house-04','house-05','house-06','house-07','house-08',
 'parking-01','parking-02','parking-03','parking-04',
 'center-moscow','center-vladivostok','center-generic',
 'tree-broadleaf','tree-conifer','shrub','grass','vacant-lot','road-straight','road-crossing','sidewalk',
] as const;
export type SpriteId=typeof SPRITE_IDS[number];
export interface SpriteEntry {id:SpriteId;file:string;width:number;height:number;anchorX:number;anchorY:number;worldScale:number;pixelRatio:number;sha256:string}
export interface SpriteManifest {version:1;entries:SpriteEntry[]}
export async function loadSpritePack(transport:typeof fetch=fetch,decode:(url:string)=>Promise<Texture>=url=>Assets.load<Texture>(url)):Promise<SpritePack>{
 const response=await transport.call(globalThis,'/sprites/manifest.json',{cache:'no-store'});
 if(!response.ok)throw new Error(`Sprite manifest HTTP ${response.status}`);
 const manifest=parseSpriteManifest(await response.json());
 const pairs=await Promise.all(manifest.entries.map(async entry=>{
  const texture=await decode('/sprites/'+entry.file);
  if(texture.width!==entry.width||texture.height!==entry.height)throw new Error(`Sprite size mismatch: ${entry.id}`);
  return [entry.id,texture] as const;
 }));
 return new SpritePack(manifest,new Map(pairs));
}
export function parseSpriteManifest(value:unknown):SpriteManifest {
 const fail=()=>{throw new Error('Invalid sprite manifest');};
 if(!value||typeof value!=='object')return fail();
 const raw=value as {version?:unknown;entries?:unknown};
 if(raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length!==SPRITE_IDS.length)return fail();
 const seen=new Set<string>();
 const entries=raw.entries.map((item:unknown):SpriteEntry=>{
  if(!item||typeof item!=='object')return fail();
  const e=item as Record<string,unknown>;
  if(typeof e['id']!=='string'||!SPRITE_IDS.includes(e['id'] as SpriteId)||seen.has(e['id']))return fail();
  seen.add(e['id']);
  if(typeof e['sha256']!=='string'||! /^[a-f0-9]{64}$/.test(e['sha256'])||e['file']!==`${e['id']}.png?v=${e['sha256'].slice(0,12)}`)return fail();
  for(const key of ['width','height'])if(typeof e[key]!=='number'||!Number.isInteger(e[key])||e[key]<1||e[key]>4096)return fail();
  for(const key of ['anchorX','anchorY'])if(typeof e[key]!=='number'||!Number.isFinite(e[key])||e[key]<0||e[key]>1)return fail();
  for(const key of ['worldScale','pixelRatio'])if(typeof e[key]!=='number'||!Number.isFinite(e[key])||e[key]<=0||e[key]>4)return fail();
  return {id:e['id'] as SpriteId,file:e['file'] as string,width:e['width'] as number,height:e['height'] as number,anchorX:e['anchorX'] as number,anchorY:e['anchorY'] as number,worldScale:e['worldScale'] as number,pixelRatio:e['pixelRatio'] as number,sha256:e['sha256']};
 });
 return {version:1,entries};
}

export function houseSpriteId(tier:number):SpriteId {
 if(!Number.isInteger(tier)||tier<1||tier>8)throw new Error('Invalid house tier');
 return `house-${String(tier).padStart(2,'0')}` as SpriteId;
}
export function parkingSpriteId(spaces:number):SpriteId|undefined {
 if(!Number.isInteger(spaces)||spaces<0||spaces>10)throw new Error('Invalid parking occupancy');
 if(spaces===0)return undefined;
 return `parking-0${spaces<=3?1:spaces<=6?2:spaces<=9?3:4}` as SpriteId;
}

export class SpritePack {
 private entries:Map<SpriteId,SpriteEntry>;
 constructor(readonly manifest:SpriteManifest,private textures:Map<SpriteId,Texture>){this.entries=new Map(manifest.entries.map(e=>[e.id,e]));}
 create(id:SpriteId):Sprite {
  const entry=this.entries.get(id),texture=this.textures.get(id);
  if(!entry||!texture)throw new Error(`Missing sprite: ${id}`);
  const sprite=new Sprite({texture});sprite.label=id;sprite.anchor.set(entry.anchorX,entry.anchorY);sprite.scale.set(entry.worldScale);return sprite;
 }
 place(parent:Container,id:SpriteId,x:number,y:number,scale=1):Sprite {
  const sprite=this.create(id);sprite.position.set(x,y);sprite.scale.set(sprite.scale.x*scale);parent.addChild(sprite);return sprite;
 }
 ground(parent:Container,id:SpriteId,x:number,y:number,w:number,d:number):Sprite {
  const sprite=this.create(id),ratio=this.entries.get(id)!.pixelRatio;
  // Map source diamond axes (152,74),(-152,74) to the actual isometric world plane.
  sprite.setFromMatrix(new Matrix((w+d)/(304*ratio),.48*(w-d)/(304*ratio),(w-d)/(148*ratio),.48*(w+d)/(148*ratio),(x+w/2)-(y+d/2),((x+w/2)+(y+d/2))*.48));
  parent.addChild(sprite);return sprite;
 }
}
