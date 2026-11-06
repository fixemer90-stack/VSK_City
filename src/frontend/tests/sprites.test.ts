import {test} from 'node:test';
import assert from 'node:assert/strict';

test('sprite catalog contains exactly the approved 23 reusable assets with complete house and parking tiers',async()=>{
 const pack=await import('../app/sprite-pack.ts').catch(()=>undefined);
 assert.ok(pack,'The real sprite resource adapter must replace procedural house/parking figures');
 assert.equal(pack.SPRITE_IDS.length,23);
 assert.equal(new Set(pack.SPRITE_IDS).size,23);
 for(let tier=1;tier<=8;tier++)assert.equal(pack.houseSpriteId(tier),`house-${String(tier).padStart(2,'0')}`);
 for(const [spaces,expected] of [[1,1],[3,1],[4,2],[6,2],[7,3],[9,3],[10,4]])assert.equal(pack.parkingSpriteId(spaces),`parking-0${expected}`);
 assert.equal(pack.parkingSpriteId(0),undefined);
});

test('manifest rejects missing/duplicate sprites, remote URLs and invalid placement metadata',async()=>{
 const pack=await import('../app/sprite-pack.ts');
 const entries=pack.SPRITE_IDS.map(id=>({id,file:`${id}.png?v=${'0'.repeat(12)}`,width:64,height:96,anchorX:.5,anchorY:.8,worldScale:.22,pixelRatio:2,sha256:'0'.repeat(64)}));
 assert.equal(pack.parseSpriteManifest({version:1,entries}).entries.length,23);
 const invalid=[null,{version:1,entries:entries.slice(1)},{version:1,entries:[...entries.slice(1),entries[1]]}];
 for(const change of [{file:'https://example.org/asset.png'},{width:0},{anchorY:2},{worldScale:NaN},{pixelRatio:0},{sha256:'bad'}])invalid.push({version:1,entries:entries.map((e,i)=>i===0?{...e,...change}:e)});
 for(const value of invalid)assert.throws(()=>pack.parseSpriteManifest(value));
});

test('sprite placement uses the cropped ground anchor and ground tiles preserve the isometric plane',async()=>{
 const pack=await import('../app/sprite-pack.ts');
 const {Texture,Container}=await import('pixi.js');
 const entries=pack.SPRITE_IDS.map(id=>({id,file:`${id}.png?v=${'0'.repeat(12)}`,width:1,height:1,anchorX:.5,anchorY:.8,worldScale:.22,pixelRatio:2,sha256:'0'.repeat(64)}));
 const atlas=new pack.SpritePack({version:1,entries},new Map(pack.SPRITE_IDS.map(id=>[id,Texture.WHITE])));
 const parent=new Container();const house=atlas.place(parent,'house-01',100,200,.5);
 assert.equal(house.anchor.x,.5);assert.equal(house.anchor.y,.8);assert.equal(house.x,100);assert.equal(house.y,200);assert.equal(house.scale.x,.11);
 const road=atlas.ground(parent,'road-straight',10,20,88,32);
 const matrix=road.getGlobalTransform();const origin=matrix.apply({x:0,y:0});
 const p=matrix.apply({x:304,y:148}),q=matrix.apply({x:-304,y:148});
 const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
 near(p.x-origin.x,88);near(p.y-origin.y,88*.48);
 near(q.x-origin.x,-32);near(q.y-origin.y,32*.48);
 near(origin.x,(10+44)-(20+16));near(origin.y,((10+44)+(20+16))*.48);
 parent.destroy({children:true});
});

test('asset loading retries after HTTP failure and rejects mismatched decoded textures',async()=>{
 const pack=await import('../app/sprite-pack.ts');const {Texture}=await import('pixi.js');
 const entries=pack.SPRITE_IDS.map(id=>({id,file:`${id}.png?v=${'0'.repeat(12)}`,width:1,height:1,anchorX:.5,anchorY:.8,worldScale:.22,pixelRatio:2,sha256:'0'.repeat(64)}));
 let fail=true,calls=0;const urls:string[]=[];
 const transport=async function(this:unknown){assert.equal(this,globalThis);calls++;if(fail)return new Response('',{status:503});return new Response(JSON.stringify({version:1,entries}),{headers:{'Content-Type':'application/json'}});};
 const decode=async(url:string)=>{urls.push(url);return Texture.WHITE;};
 await assert.rejects(pack.loadSpritePack(transport as typeof fetch,decode));assert.equal(urls.length,0);
 fail=false;const atlas=await pack.loadSpritePack(transport as typeof fetch,decode);
 assert.equal(atlas.manifest.entries.length,23);assert.equal(urls.length,23);assert.equal(calls,2);
 assert.ok(urls.every(url=>url.startsWith('/sprites/')&&url.includes('?v=')));
 await assert.rejects(pack.loadSpritePack(transport as typeof fetch,async()=>({width:2,height:1}) as any));
});
