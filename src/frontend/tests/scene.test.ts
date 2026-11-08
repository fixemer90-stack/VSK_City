import '@angular/compiler';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneComponent} from '../app/scene.ts';
import {Container,Graphics,Sprite,Texture,Polygon} from 'pixi.js';
import {SpritePack,SPRITE_IDS} from '../app/sprite-pack';
import {City,Street,cityBlockPosition,lotPosition} from '../app/model';

function fixture(){
 const scene=new SceneComponent();const internal=scene as any;
 const captures:number[]=[],releases:number[]=[];const held=new Set<number>();
 const host={setPointerCapture(id:number){captures.push(id);held.add(id);},hasPointerCapture(id:number){return held.has(id);},releasePointerCapture(id:number){releases.push(id);held.delete(id);}};
 scene.surface={nativeElement:host} as any;
 const event=(overrides:Record<string,unknown>={})=>({pointerId:7,isPrimary:true,button:0,buttons:1,clientX:10,clientY:20,currentTarget:host,...overrides});
 return {scene,internal,captures,releases,event};
}

test('SceneComponent captures the Pixi canvas, not its parent, so native pointertap keeps its target',()=>{
 const {internal,captures,event}=fixture();
 const canvasCaptures:number[]=[],canvasReleases:number[]=[];const held=new Set<number>();
 const canvas={setPointerCapture(id:number){canvasCaptures.push(id);held.add(id);},hasPointerCapture(id:number){return held.has(id);},releasePointerCapture(id:number){canvasReleases.push(id);held.delete(id);}};
 internal.app={canvas};
 internal.down(event({target:canvas}));
 assert.deepEqual(canvasCaptures,[7],'capture must not retarget Pixi pointerup to the parent');
 assert.deepEqual(captures,[]);
 internal.up(event({target:canvas}));
 assert.deepEqual(canvasReleases,[7]);
});

test('SceneComponent stops return movement with buttons=0 and releases captured pointer',()=>{
 const {internal,captures,releases,event}=fixture();
 internal.down(event());internal.move(event({clientX:30,clientY:40}));
 assert.equal(internal.root.x,20);assert.equal(internal.root.y,20);
 internal.move(event({buttons:0,clientX:100,clientY:100}));
 assert.equal(internal.root.x,20,'release outside must not pan on return');
 internal.move(event({clientX:120,clientY:120}));
 assert.equal(internal.root.x,20,'drag must stay stopped');
 assert.deepEqual(captures,[7]);assert.deepEqual(releases,[7]);
});

test('SceneComponent captures only primary left pointer and ignores other pointer movement/up',()=>{
 const {internal,captures,releases,event}=fixture();
 internal.down(event({button:2,buttons:2}));internal.move(event({clientX:30}));
 assert.equal(internal.root.x,0);assert.deepEqual(captures,[]);
 internal.down(event({isPrimary:false}));assert.deepEqual(captures,[]);
 internal.down(event());internal.down(event({pointerId:8}));
 internal.move(event({pointerId:8,clientX:70}));internal.up(event({pointerId:8}));
 internal.move(event({clientX:30}));assert.equal(internal.root.x,20);
 internal.up(event());internal.move(event({clientX:60}));assert.equal(internal.root.x,20);
 assert.deepEqual(captures,[7]);assert.deepEqual(releases,[7]);
});

test('SceneComponent pointercancel and lostpointercapture stop the active drag',()=>{
 for(const type of ['pointercancel','lostpointercapture']){
  const {internal,releases,event}=fixture();internal.down(event());internal.up(event({type}));
  internal.move(event({clientX:80}));assert.equal(internal.root.x,0);assert.deepEqual(releases,[7]);
 }
});

test('actual house sprites keep identity across full and thumbnail scale and expose rendered identity mapping',async()=>{
 const {SpritePack,SPRITE_IDS,houseSpriteId}=await import('../app/sprite-pack');
 const {Texture,Graphics,Sprite}=await import('pixi.js');
 const entries=SPRITE_IDS.map(id=>({id,file:`${id}.png?v=${'0'.repeat(12)}`,width:1,height:1,anchorX:.5,anchorY:.8,worldScale:.22,pixelRatio:2,sha256:'0'.repeat(64)}));
 const {scene,internal}=fixture();const host=scene.surface.nativeElement as any;host.dataset={};
 internal.pack=new SpritePack({version:1,entries},new Map(SPRITE_IDS.map(id=>[id,Texture.WHITE])));
 const g=new Graphics();internal.root.addChild(g);
 internal.building(g,10,20,10,'persisted-house',false,.49);
 internal.building(g,30,40,10,'persisted-house',false,1);
 const sprites=internal.root.children.filter((item:unknown)=>item instanceof Sprite);
 assert.equal(sprites.length,2);assert.equal(sprites[0].label,houseSpriteId(10,'persisted-house'));
 assert.equal(sprites[0].label,sprites[1].label);
 internal.render();assert.equal(typeof host.dataset.houseSprites,'string');
 assert.deepEqual(JSON.parse(host.dataset.houseSprites),{'persisted-house':sprites[0].label});
 internal.root.destroy({children:true});
});

test('permanent vector furniture renders on empty streets at its own ground depth; approaches and parks are terrain',()=>{
 const {scene,internal}=depthFixture();const s={...street(0),houses:[],parking:[]};internal.streetScene(s);internal.render();
 for(const kind of ['lamp','bench','bin','flowerbed']){
  const props=internal.objects.children.filter((c:Container)=>c.label===`decor-${kind}`);assert.ok(props.length>0,kind);
  for(const p of props){assert.ok(p instanceof Graphics);assert.ok(p.context.instructions.length>=3);assert.equal(p.zIndex,p.y);assert.equal(internal.objectInfo.get(p).streetId,s.id);}
 }
 assert.ok(!internal.terrain.children.some((c:Container)=>c.label==='street-approach'));
 const large=depthFixture();const occupied={...street(0),houses:[{...street(0).houses[0],lotIndex:32}]};large.internal.streetScene(occupied);large.internal.render();
 assert.ok(large.internal.terrain.children.some((c:Container)=>c.label==='street-park'));
 assert.equal(large.internal.terrain.children.filter((c:Container)=>c.label==='street-approach').length,1);
 ordered(large.internal.objects.children);
 const base=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 const filled=depthFixture();filled.internal.streetScene(street(0));filled.internal.render();
 const decor=(data:DepthEntry[])=>data.filter(m=>m.sprite.startsWith('decor-')).map(m=>[m.sprite,m.x,m.y]);
 assert.deepEqual(decor(JSON.parse(filled.scene.surface.nativeElement.dataset['depthOrder']!)),decor(base),'occupancy does not unlock or relocate furniture');
});

function depthFixture(){
 const f=fixture();(f.scene.surface.nativeElement as any).dataset={};const entries=SPRITE_IDS.map(id=>({id,file:`${id}.png?v=${'0'.repeat(12)}`,width:1,height:1,anchorX:.5,anchorY:.8,worldScale:.22,pixelRatio:2,sha256:'0'.repeat(64)}));
 f.internal.pack=new SpritePack({version:1,entries},new Map(SPRITE_IDS.map(id=>[id,Texture.WHITE])));return f;
}
function street(index:number):Street{return {id:`street-${index}`,agentId:`agent-${index}`,name:null,scenario:'mixed',houses:[{id:`house-${index}`,lotIndex:0,xp:100,tier:10,floors:25,status:'active',demolishAt:null}],parking:[{id:`parking-${index}`,lotIndex:1,spaces:10}]};}
function city():City{return {id:'city',name:'Москва',mapX:0,mapY:0,streets:Array.from({length:50},(_,i)=>street(i))};}
function sprites(container:Container):Sprite[]{return container.children.flatMap(c=>c instanceof Sprite?[c]:sprites(c));}
type DepthEntry={sprite:string;identity?:string;streetId?:string;depth:number;x:number;y:number;screenX:number;screenY:number;drawIndex:number};
function ordered(items:Container[]){assert.ok(items.every((s,i)=>i===0||items[i-1].y<=s.y),'every individual object must paint in projected ground-anchor order');}
for(const [name,centerId] of [['Москва','center-moscow'],['Владивосток','center-vladivostok'],['Тула','center-generic']])test(`city ${name} globally orders individual objects on both sides of the center, not street clusters`,()=>{
 const {scene,internal}=depthFixture();scene.kind='city';scene.city=city();scene.city.name=name;internal.cityScene(scene.city);internal.render();
 const items=sprites(internal.root).filter(s=>!['grass','road-straight'].includes(s.label));ordered(items);
 const center=items.findIndex(s=>s.label===centerId);assert.ok(center>0&&center<items.length-1,'center must not overpaint foreground');
 assert.ok(items.slice(0,center).some(s=>s.label.startsWith('house-')));assert.ok(items.slice(center+1).some(s=>s.label.startsWith('house-')));
});
test('city has continuous landscaped ground and connected vector asphalt instead of grass panels and isolated road sprites',()=>{
 const {internal}=depthFixture();const c=city();c.name='Тула';const before=JSON.stringify(c);internal.cityScene(c);internal.render();
 const grass=internal.terrain.children.find((item:Container)=>item.label==='city-grass');
 assert.ok(grass instanceof Graphics,'one continuous city meadow replaces beige gaps');
 assert.equal(grass.context.instructions.filter((i:any)=>i.action==='fill').length,1);
 assert.equal(sprites(internal.terrain).length,0,'no opaque per-street grass cards or road-straight strips');
 const roads=internal.terrain.children.filter((item:Container)=>item.label==='city-road');assert.equal(roads.length,1,'paint all sidewalks before any asphalt so segment caps cannot leave pale seams across junctions');
 const road=roads[0];assert.ok(road instanceof Graphics);const strokes=road.context.instructions.filter((i:any)=>i.action==='stroke');
 assert.equal(strokes.length,6,'three width groups: complete sidewalk pass, then complete asphalt/path pass');
 for(let i=0;i<3;i++)assert.deepEqual(strokes[i].data.path.instructions,strokes[i+3].data.path.instructions,'replay the entire connected graph for asphalt, not isolated endpoint caps');
 for(const [x,y] of [[0,0],[950,850],[450,375],[730,830]])assert.ok(grass.containsPoint({x:x-y,y:(x+y)*.48}));
 assert.equal(JSON.stringify(c),before);
});

test('permanent city pocket gardens never occupy a current or appended street thumbnail',()=>{
 const {internal}=depthFixture(),c=city();c.name='Тула';internal.cityScene(c);
 const park=internal.terrain.children.find((item:Container)=>item.label==='city-pocket-park') as Graphics;assert.ok(park);
 for(let i=0;i<64;i++){const p=cityBlockPosition(i);for(let dx=8;dx<=92;dx+=7)for(let dy=12;dy<=76;dy+=8)assert.equal(park.containsPoint({x:p.x+dx,y:p.y+dy}),false,`park cannot become a sales plot at street ${i}`);}
});

test('Vladivostok paints a continuous river with bank promenades and ground-sorted bridge rails around the existing landmark',()=>{
 const {internal}=depthFixture(),c=city();c.name='Владивосток';internal.cityScene(c);internal.render();
 const water=internal.terrain.children.find((item:Container)=>item.label==='city-river') as Graphics;assert.ok(water instanceof Graphics);
 for(const y of [0,412,505,598,1100])assert.ok(water.containsPoint({x:485,y}),'real Pixi geometry, not only river metadata');
 assert.ok(internal.terrain.children.some((item:Container)=>item.label==='city-river-promenades'));
 const rails=internal.objects.children.filter((item:Container)=>item.label==='city-bridge-rails');assert.equal(rails.length,2);
 for(const rail of rails){assert.ok(rail instanceof Graphics);assert.ok(rail.context.instructions.length>2);assert.equal(rail.zIndex,rail.y);}
 assert.equal(sprites(internal.root).filter(s=>s.label==='center-vladivostok').length,1);
});

test('Moscow actually paints its concentric road geometry under the miniature blocks',()=>{
 const {internal}=depthFixture();internal.cityScene(city());
 const road=internal.terrain.children.find((item:Container)=>item.label==='city-road') as Graphics;
 for(const radius of [180,360,540])for(let i=0;i<24;i++)assert.ok(road.containsPoint({x:485+radius*Math.cos(i*Math.PI/12),y:505+radius*Math.sin(i*Math.PI/12)}));
 assert.equal(road.containsPoint({x:485,y:505}),false,'civic footprint stays road-free');
 const grass=internal.terrain.children.find((item:Container)=>item.label==='city-grass') as Graphics;
 assert.ok(grass.containsPoint({x:485-505,y:(485+505)*.48}));
 assert.equal(grass.containsPoint({x:(485+700)-(505+700),y:(485+700+505+700)*.48}),false,'do not fit a huge empty square around the radial town');
});

test('city terrain and existing miniature anchors are invariant under occupancy, appending a street and camera transforms',()=>{
 const base=depthFixture(),filled=depthFixture(),c=city();base.internal.cityScene(c);base.internal.render();
 const changed=structuredClone(c);changed.streets[0].houses=[];changed.streets[1].parking=[];changed.streets[2].houses.push({...street(2).houses[0],id:'added-house',lotIndex:7});changed.streets.push(street(50));
 filled.internal.cityScene(changed);filled.internal.render();
 const ground=(f:ReturnType<typeof depthFixture>)=>f.internal.terrain.children.filter((item:Container)=>['city-grass','city-meadow-texture','city-road'].includes(item.label)).map((g:Graphics)=>g.context.instructions.map((i:any)=>({action:i.action,style:i.data.style,path:i.data.path.instructions})));
 assert.deepEqual(ground(filled),ground(base),'roads and continuous ground cannot depend on sales or reflow when a street is appended');
 const identity=(f:ReturnType<typeof depthFixture>)=>JSON.parse(f.scene.surface.nativeElement.dataset['depthOrder']!).filter((i:DepthEntry)=>i.identity) as DepthEntry[];
 for(const old of identity(base).filter(i=>!['house-0'].includes(i.identity!))){const next=identity(filled).find(i=>i.identity===old.identity)!;assert.ok(next);assert.deepEqual([next.sprite,next.x,next.y,next.streetId],[old.sprite,old.x,old.y,old.streetId]);}
 const before=ground(base);base.internal.root.scale.set(2);base.internal.root.position.set(123,45);base.internal.render();assert.deepEqual(ground(base),before);
});

test('city flat objects retain owner clicks and polygon-only ground navigation; annotations cannot intercept',()=>{
 const {scene,internal}=depthFixture();const c=city();c.streets[0].name='Private owner name';c.streets[0].houses[0].status='pending_demolition';internal.cityScene(c);internal.render();
 assert.deepEqual(internal.root.children.map((c:Container)=>c.label),['terrain','objects','annotations']);
 assert.equal(internal.annotations.eventMode,'none');assert.equal(internal.annotations.children.length,3);
 const selected:string[]=[];scene.streetSelect.subscribe(s=>selected.push(s.id));
 for(let i=0;i<c.streets.length;i++){
  const footprint=internal.terrain.children.find((item:Container)=>item.label===`city-street-${i}`) as Container;assert.ok(footprint.hitArea instanceof Polygon);const p=cityBlockPosition(i,'moscow');
  assert.ok(footprint.hitArea.contains((p.x+50)-(p.y+50),(p.x+p.y+100)*.48));
  assert.equal(footprint.hitArea.contains((p.x-p.y),(p.x+p.y)*.48-20),false,'no elevated rectangle over adjacent streets');
  footprint.emit('pointertap');assert.equal(selected.pop(),c.streets[i].id);
 }
 const metadata=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 metadata.forEach((entry,index)=>{if(entry.streetId){internal.objects.children[index].emit('pointertap');assert.equal(selected.pop(),entry.streetId);}});
 internal.moved=true;internal.objects.children[0].emit('pointertap');assert.deepEqual(selected,[]);
 assert.ok(!JSON.stringify(metadata).includes('Private owner name'));
});
test('street terrain stays below a single globally sorted layer of houses, parking and trees without a city center',()=>{
 const {scene,internal}=depthFixture();const s=street(0);s.houses.push({...s.houses[0],id:'front-house',lotIndex:23,status:'pending_demolition'});s.parking.push({id:'front-parking',spaces:2,lotIndex:22});internal.streetScene(s);internal.render();
 assert.deepEqual(internal.root.children.map((c:Container)=>c.label),['terrain','objects','annotations']);
 const items=internal.objects.children as Container[];assert.ok(items.every(s=>s instanceof Sprite||s.label.startsWith('decor-')));ordered(items);
 assert.ok(!items.some(s=>s.label.startsWith('center-')),'city center belongs only to city overview, never to a personal street');
 assert.equal(internal.annotations.children.length,2);assert.equal(internal.annotations.eventMode,'none');
 assert.ok(sprites(internal.terrain).every(s=>['grass','vacant-lot','road-crossing','road-straight','sidewalk'].includes(s.label)));
 const metadata=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];assert.ok(metadata.every(m=>m.streetId===s.id));
});
test('street renders a single isometric asphalt path, with occupied and vacant plots on its flanks',()=>{
 const {scene,internal}=depthFixture();const s=street(0),before=JSON.stringify(s);internal.streetScene(s);internal.render();
 const road=internal.terrain.children.find((c:Container)=>c.label==='street-road');
 assert.ok(road instanceof Graphics,'connected vector road, not independently tiled row roads');
 const strokes=road.context.instructions.filter((i:any)=>i.action==='stroke');
 assert.equal(strokes.length,2,'one continuous sidewalk and asphalt stroke');
 assert.ok(strokes[0].data.path.instructions.length>100);
 assert.deepEqual(strokes[1].data.path.instructions,strokes[0].data.path.instructions,'asphalt must cover the entire sidewalk path, not only its endpoint');
 const matrix=road.getGlobalTransform();const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9);near(matrix.a,1);near(matrix.b,.48);near(matrix.c,-1);near(matrix.d,.48);
 const ground=sprites(internal.terrain);assert.equal(ground.length,0,'continuous grass replaces panel sprites');
 assert.equal(internal.terrain.children.filter((c:Container)=>c.label==='street-vacant-plot').length,14);
 assert.ok(!ground.some(s=>s.label.startsWith('road-')),'old disconnected road tiles are gone');
 assert.equal(JSON.stringify(s),before,'layout cannot rewrite persisted lots, identities, XP or occupancy');
 const items=internal.objects.children as Sprite[];ordered(items);
 const p=lotPosition(0),house=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!).find((m:DepthEntry)=>m.identity===s.houses[0].id);
 assert.equal(house.x,p.x+34-(p.y+32));assert.equal(house.y,(p.x+34+p.y+32)*.48);
});

test('street grass continuously covers gaps below road and lots without occupancy-dependent panels',()=>{
 const build=(s:Street)=>{const f=depthFixture();f.internal.streetScene(s);return f.internal;};
 const empty={...street(0),houses:[],parking:[]},view=build(empty);
 const grass=view.terrain.children[0] as Graphics;
 assert.equal(grass.label,'street-grass','one continuous grass plane must replace beige terrain');
 const fills=grass.context.instructions.filter((i:any)=>i.action==='fill');
 assert.equal(fills.length,1,'base must not be assembled from independent tiles');
 assert.equal(fills[0].data.style.color,0xa8b68d);
 for(const [x,y] of [[-139,-84],[849,-84],[849,644],[-139,644],[440,300],[690,350]])assert.ok(grass.containsPoint({x:x-y,y:(x+y)*.48}),'base covers outer corners and empty road/plot gaps');
 const texture=view.terrain.children.find((c:Container)=>c.label==='street-grass-texture') as Graphics;
 assert.ok(texture instanceof Graphics);assert.ok(texture.context.instructions.length>0);
 assert.ok(view.terrain.children.indexOf(texture)<view.terrain.children.findIndex((c:Container)=>c.label==='street-road'));
 assert.equal(sprites(view.terrain).length,0,'lot grass sprites would reintroduce square panels');
 const occupied=build(street(0));
 const geometry=(g:Graphics)=>g.context.instructions.map((i:any)=>({action:i.action,style:i.data.style,path:i.data.path.instructions}));
 assert.deepEqual(geometry(occupied.terrain.children[0]),geometry(grass));
 assert.deepEqual(geometry(occupied.terrain.children[1]),geometry(texture),'grass texture must not change when a plot is occupied');
 const before=structuredClone(geometry(texture)[0].path);view.root.scale.set(2);view.root.position.set(45,80);view.render();assert.deepEqual(geometry(texture)[0].path,before);
 const large=build({...empty,houses:[{...street(0).houses[0],lotIndex:63}]});
 const largeGrass=large.terrain.children[0] as Graphics;
 for(const [x,y] of [[-319,-84],[849,2804],[0,2000]])assert.ok(largeGrass.containsPoint({x:x-y,y:(x+y)*.48}));
});

test('ground depth drives Pixi render ordering independently of height/scale, with stable ties and post-transform metadata',()=>{
 const {scene,internal}=depthFixture();internal.layers();const g=new Graphics();internal.terrain.addChild(g);
 internal.building(g,100,100,10,'tall',false);internal.building(g,100,100,1,'short',false);internal.building(g,300,300,1,'foreground',false,.49);
 const insertion=[...internal.objects.children] as Sprite[];insertion[0].height=10000;insertion[1].scale.set(9);
 internal.root.position.set(31,47);internal.root.scale.set(2);internal.render();
 assert.equal(internal.objects.sortableChildren,true,'use Pixi sorting so renderer structure is invalidated');
 const sorted=internal.objects.children as Sprite[];assert.deepEqual(sorted.slice(0,2),insertion.slice(0,2));ordered(sorted);
 for(const item of sorted)assert.equal(item.zIndex,item.y,'render depth must use ground anchor, never height');
 const metadata=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 assert.deepEqual(JSON.parse(scene.surface.nativeElement.dataset['sceneLayers']!),['terrain','objects','annotations']);
 metadata.forEach((m,i)=>{assert.equal(m.drawIndex,i);assert.equal(m.depth,sorted[i].y);assert.equal(m.x,sorted[i].x);assert.equal(m.y,sorted[i].y);assert.equal(m.screenX,31+2*m.x);assert.equal(m.screenY,47+2*m.y);});
 assert.deepEqual(metadata.map(m=>m.identity),['tall','short','foreground']);
 internal.app={screen:{width:800,height:600},render(){}};scene.zoom(1.2);const zoomed=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 zoomed.forEach(m=>{assert.equal(m.screenX,internal.root.x+internal.root.scale.x*m.x);assert.equal(m.screenY,internal.root.y+internal.root.scale.y*m.y);});
 scene.keyboard({key:'ArrowLeft',preventDefault(){}} as KeyboardEvent);const panned=JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];panned.forEach((m,i)=>assert.equal(m.screenX,zoomed[i].screenX+45));
 internal.render();assert.deepEqual(internal.objects.children,sorted);
});
test('returning to country clears destroyed depth layers and their metadata',()=>{
 const {scene,internal}=depthFixture();internal.cityScene(city());internal.render();scene.kind='country';internal.key='countryundefinedundefined';internal.app={render(){}};
 internal.draw();assert.deepEqual(JSON.parse(scene.surface.nativeElement.dataset['depthOrder']!),[]);assert.deepEqual(JSON.parse(scene.surface.nativeElement.dataset['sceneLayers']!),[]);assert.equal(scene.ready(),true);
});
test('flattening preserves city-specific overview anchors, personal lot anchors and A/B identities',()=>{
 const cityView=depthFixture(),streetView=depthFixture(),c=city();cityView.internal.cityScene(c);cityView.internal.render();
 const cityData=JSON.parse(cityView.scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 const center=cityData.find(m=>m.sprite==='center-moscow')!;assert.equal(center.x,485-505);assert.equal(center.y,(485+505)*.48);
 for(let i=0;i<c.streets.length;i++){
  const h=cityData.find(m=>m.identity===`house-${i}`)!;const p=cityBlockPosition(i,'moscow');assert.equal(h.x,p.x+8+22*.49-(p.y+12+22*.49));assert.equal(h.y,((p.x+8+22*.49)+(p.y+12+22*.49))*.48);
  assert.equal(h.streetId,c.streets[i].id);
 }
 streetView.internal.streetScene(c.streets[0]);streetView.internal.render();const streetData=JSON.parse(streetView.scene.surface.nativeElement.dataset['depthOrder']!) as DepthEntry[];
 const p=lotPosition(0),h=streetData.find(m=>m.identity==='house-0')!;assert.equal(h.x,p.x+12+22-(p.y+10+22));assert.equal(h.y,(p.x+12+22+p.y+10+22)*.48);assert.equal(h.sprite,cityData.find(m=>m.identity==='house-0')!.sprite);
});
