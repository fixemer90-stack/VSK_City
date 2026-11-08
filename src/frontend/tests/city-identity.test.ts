import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cityBlockPosition} from '../app/model';
import {cityNetwork} from '../app/city-network';

for(const kind of ['moscow','vladivostok'] as const)test(`${kind} has one physically connected network and clear, deterministic miniature footprints through future expansion`,()=>{
 for(const count of [50,51,64]){
  const network=cityNetwork(count,kind),key=(p:{x:number;y:number})=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`,adjacency=new Map<string,Set<string>>();
  for(const road of network.roads)for(let i=1;i<road.points.length;i++){
   const a=key(road.points[i-1]),b=key(road.points[i]);if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a)!.add(b);adjacency.get(b)!.add(a);
  }
  const seen=new Set<string>(),queue=[key(network.access[0].point)];
  while(queue.length){const p=queue.pop()!;if(seen.has(p))continue;seen.add(p);queue.push(...adjacency.get(p)??[]);}
  assert.equal(seen.size,adjacency.size,'no detached road or unconnected bridge');
  for(const access of network.access)assert.ok(seen.has(key(access.point)));assert.ok(seen.has(key(network.civic)));
  for(const road of network.roads)for(let j=1;j<road.points.length;j++){
   const a=road.points[j-1],b=road.points[j],samples=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);
   for(let k=0;k<=samples;k++){
    const p={x:a.x+(b.x-a.x)*k/samples,y:a.y+(b.y-a.y)*k/samples},radius=road.width/2;
    if(network.river){
     const points=network.river.points,next=points.findIndex(q=>q.y>=p.y);
     if(next>0){const a=points[next-1],b=points[next],riverX=a.x+(b.x-a.x)*(p.y-a.y)/(b.y-a.y);if(Math.abs(p.x-riverX)<network.river.width/2+radius)assert.equal(road.role,'bridge','sample every road segment, not only its dry endpoints');}
    }
    if(kind==='moscow')assert.ok(!(p.x+radius>392&&p.x-radius<578&&p.y+radius>412&&p.y-radius<598),'rings and radials reserve the civic footprint');
    for(let i=0;i<count;i++){
     const lot=cityBlockPosition(i,kind);
     for(const box of [{x:lot.x+6,y:lot.y+10,w:82,d:66},{x:lot.x+65,y:lot.y+46,w:28,d:28},{x:lot.x+88,y:lot.y+12,w:8,d:8}])assert.ok(!(p.x+radius>box.x&&p.x-radius<box.x+box.w&&p.y+radius>box.y&&p.y-radius<box.y+box.d),`asphalt crosses miniature ${i}: ${JSON.stringify(p)}`);
    }
   }
  }
  const repeated=cityNetwork(count,kind);assert.deepEqual(network,repeated);
  for(let i=0;i<Math.min(count,50);i++)assert.deepEqual(network.access[i],cityNetwork(50,kind).access[i]);
 }
});

test('Moscow miniatures follow three genuinely concentric closed streets and four radial links, not the generic grid',()=>{
 const network=cityNetwork(50,'moscow');
 const rings=network.roads.filter(r=>r.role==='ring');assert.equal(rings.length,3);
 const radii=rings.map(r=>Math.hypot(r.points[0].x-485,r.points[0].y-505));
 assert.ok(radii[0]<radii[1]&&radii[1]<radii[2]);
 for(const [i,ring] of rings.entries()){
  assert.deepEqual(ring.points.at(-1),ring.points[0]);assert.ok(ring.points.length>100);
  for(const p of ring.points)assert.ok(Math.abs(Math.hypot(p.x-485,p.y-505)-radii[i])<1e-8);
 }
 assert.equal(network.roads.filter(r=>r.role==='radial').length,8);
 for(let i=0;i<50;i++){
  const p=cityBlockPosition(i,'moscow'),r=Math.hypot(p.x+54.5-485,p.y+52.5-505);
  assert.ok(radii.some(radius=>Math.abs(r-radius-95)<1e-8));
  assert.notDeepEqual(p,cityBlockPosition(i));
  assert.deepEqual(cityNetwork(51,'moscow').access[i],network.access[i]);
 }
});

test('Vladivostok river continues through the existing center inlet; every road crossing is an intentional bridge',()=>{
 const network=cityNetwork(50,'vladivostok');assert.ok(network.river,'a city river, not a standalone blue landmark tile');
 const river=network.river;assert.equal(river.width,68.2);
 assert.ok(river.points[0].y<0&&river.points.at(-1)!.y>1100);
 for(const y of [412,598])assert.ok(river.points.some(p=>p.x===485&&p.y===y),'river must meet the two existing SVG inlet openings exactly');
 assert.equal(network.roads.filter(r=>r.role==='bridge').length,3,'two neighborhood bridges plus the existing civic landmark');
 for(const road of network.roads)for(const p of road.points){
  const center=river.points.reduce((a,b)=>Math.abs(a.y-p.y)<Math.abs(b.y-p.y)?a:b);
  if(Math.abs(p.x-center.x)<river.width/2+road.width/2&&p.y>=river.points[0].y&&p.y<=river.points.at(-1)!.y)assert.equal(road.role,'bridge','no road may ford the river');
 }
 for(let i=0;i<50;i++){
  const p=cityBlockPosition(i,'vladivostok');assert.ok(p.x+109<410||p.x>570,'all thumbnails are on dry banks');
  assert.deepEqual(cityNetwork(51,'vladivostok').access[i],network.access[i]);
 }
});
