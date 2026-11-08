import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lotPosition} from '../app/model';

 test('lots flank both sides without crossing the road or its rounded bends',async()=>{
 const {streetLayout}=await import('../app/street-layout');
 const {road}=streetLayout(159);
 for(let i=0;i<160;i++){
  const p=lotPosition(i);
  for(const point of road){
   const dx=Math.max(p.x-5-point.x,0,point.x-(p.x+83));
   const dy=Math.max(p.y-5-point.y,0,point.y-(p.y+75));
   assert.ok(Math.hypot(dx,dy)>34,`lot ${i} must clear the full sidewalk and asphalt corridor`);
  }
 }
 const north=lotPosition(0),south=lotPosition(1);
 assert.equal(north.x,south.x,'paired lots face each other');
 assert.ok(south.y-north.y>150);
 const lots=Array.from({length:160},(_,i)=>lotPosition(i));
 for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++){
  const a=lots[i],b=lots[j];assert.ok(Math.abs(a.x-b.x)>=88||Math.abs(a.y-b.y)>=80,'lots cannot overlap');
 }
});

test('append only extends the path and never moves existing lot anchors',async()=>{
 const {streetLayout}=await import('../app/street-layout');
 const before=streetLayout(15),after=streetLayout(79);
 assert.deepEqual(after.road.slice(0,before.road.length),before.road);
 const positions=Array.from({length:16},(_,i)=>lotPosition(i));
 for(let i=16;i<800;i++)lotPosition(i);
 assert.deepEqual(Array.from({length:16},(_,i)=>lotPosition(i)),positions);
 assert.ok(lotPosition(8).x>lotPosition(14).x,'the next run follows the returning road');
});

test('one continuous street turns smoothly between runs instead of disconnected grid roads',async()=>{
 const layout=await import('../app/street-layout').catch(()=>undefined);
 assert.ok(layout,'a single ordered winding street layout must exist');
 const street=layout.streetLayout(31);
 assert.ok(street.road.length>100);
 for(let i=1;i<street.road.length;i++){
  const a=street.road[i-1],b=street.road[i];
  assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>0);
  assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=21,'one ordered path, no jumps between runs');
 }
 const directions=street.road.slice(1).map((p,i)=>Math.atan2(p.y-street.road[i].y,p.x-street.road[i].x));
 assert.ok(directions.some(a=>Math.abs(a)<.1));
 assert.ok(directions.some(a=>Math.abs(a)>3));
 assert.ok(directions.some(a=>a>.5&&a<1),'rounded bend, not a right-angle connector');
 for(let i=1;i<directions.length;i++){
  const turn=Math.atan2(Math.sin(directions[i]-directions[i-1]),Math.cos(directions[i]-directions[i-1]));
  assert.ok(Math.abs(turn)<.15,'gentle tangent transitions');
 }
});
