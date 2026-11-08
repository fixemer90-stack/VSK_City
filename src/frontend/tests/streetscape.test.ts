import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streetLotPosition,streetLayout} from '../app/street-layout';
import {streetScape} from '../app/streetscape';

test('permanent street furniture is deterministic, present without sales and append-only',()=>{
 const base=streetScape(15),large=streetScape(63);
 for(const kind of ['lamp','bench','bin','flowerbed'])assert.ok(base.props.some(p=>p.kind===kind),kind);
 assert.deepEqual(streetScape(15),base);
 for(const p of base.props)assert.deepEqual(large.props.find(q=>q.id===p.id),p);
 assert.ok(large.parks.length>base.parks.length);
 for(const p of base.parks)assert.deepEqual(large.parks.find(q=>q.id===p.id),p);
 assert.equal(new Set(large.props.map(p=>p.id)).size,large.props.length);
});

test('furniture and park footprints stay clear of every sale plot and asphalt corridor',()=>{
 const layout=streetScape(95),road=streetLayout(95).road;
 const shapes=[...layout.props.map(p=>({...p,w:p.kind==='lamp'?4:p.kind==='flowerbed'?34:30,d:p.kind==='lamp'?4:16})),...layout.parks];
 for(const p of shapes){
  for(let i=0;i<=95;i++){const lot=streetLotPosition(i);assert.ok(p.x+p.w/2<lot.x||p.x-p.w/2>lot.x+78||p.y+p.d/2<lot.y||p.y-p.d/2>lot.y+70,`${p.id} overlaps lot ${i}`);}
  for(const r of road){const dx=Math.max(Math.abs(p.x-r.x)-p.w/2,0),dy=Math.max(Math.abs(p.y-r.y)-p.d/2,0);assert.ok(Math.hypot(dx,dy)>17,`${p.id} footprint on asphalt`);}
 }
});
