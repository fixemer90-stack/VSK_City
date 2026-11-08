import {test,expect} from '@playwright/test';
import {cityBlockPosition} from '../../src/frontend/app/model.ts';

async function rendered(surface) {
 return surface.evaluate(el=>({layers:JSON.parse(el.dataset.sceneLayers||'[]'),items:JSON.parse(el.dataset.depthOrder||'[]')}));
}

function assertOrder(view,kind) {
 expect(view.layers).toEqual(['terrain','objects','annotations']);
 expect(view.items.length).toBeGreaterThan(20);
 const center=view.items.findIndex(item=>item.sprite===`center-${kind}`);
 expect(center).toBeGreaterThan(0);expect(center).toBeLessThan(view.items.length-1);
 for(let i=0;i<view.items.length;i++){
  const item=view.items[i];expect(item.drawIndex).toBe(i);
  expect(Number.isFinite(item.depth)).toBe(true);
  if(i)expect(item.depth).toBeGreaterThanOrEqual(view.items[i-1].depth);
 }
 const pivot=view.items[center];
 expect(view.items.some(item=>item.identity&&item.depth<pivot.depth)).toBe(true);
 expect(view.items.some(item=>item.identity&&item.depth>pivot.depth)).toBe(true);
 return pivot;
}

for(const [id,kind] of [['001','moscow'],['025','vladivostok'],['021','generic']]){
 test(`individual ground depth around ${kind} survives camera and native street selection without writes`,async({page,request},info)=>{
  const writes=[],errors=[];
  page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  const response=await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent');expect(response.ok()).toBe(true);
  const state=await response.json(),city=state.cities.find(c=>c.id===`TEST-CITY-${id}`);expect(city).toBeTruthy();
  await page.goto('/');const surface=page.getByTestId('scene-surface');
  await expect(surface).toHaveAttribute('data-ready','true');
  await page.getByTestId('country-nav').click();await page.getByTestId(`city-${city.id}`).click();
  await expect(surface).toHaveAttribute('data-landmark',kind);
  await expect.poll(async()=> (await rendered(surface)).items.length).toBeGreaterThan(20);
  let view=await rendered(surface);const pivot=assertOrder(view,kind);
  const signature=items=>items.map(item=>[item.sprite,item.identity,item.streetId,item.depth]);
  const baseline=signature(view.items);
  const expectedHouses=city.streets.flatMap(s=>s.houses.slice(0,5).map(h=>h.id)).sort();
  expect(view.items.filter(item=>item.identity).map(item=>item.identity).sort()).toEqual(expectedHouses);
  await page.screenshot({path:info.outputPath(`${kind}-depth-fit.png`),fullPage:true});
  const before=await rendered(surface);
  await page.getByRole('button',{name:'Приблизить',exact:true}).click();
  await expect.poll(async()=> (await rendered(surface)).items.find(i=>i.sprite===pivot.sprite)?.bounds?.width).not.toBe(before.items.find(i=>i.sprite===pivot.sprite)?.bounds?.width);
  view=await rendered(surface);assertOrder(view,kind);expect(signature(view.items)).toEqual(baseline);
  await page.screenshot({path:info.outputPath(`${kind}-depth-zoom.png`),fullPage:true});
  const box=await surface.boundingBox(),beforePan=view.items.find(item=>item.sprite===pivot.sprite);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+32,box.y+box.height/2+24,{steps:4});await page.mouse.up();
  await expect.poll(async()=> (await rendered(surface)).items.find(item=>item.sprite===pivot.sprite)?.screenX).toBeCloseTo(beforePan.screenX+32,0);
  expect(signature((await rendered(surface)).items)).toEqual(baseline);
  for(const width of [1100,1920,1440]){
   await page.setViewportSize({width,height:960});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   view=await rendered(surface);assertOrder(view,kind);expect(signature(view.items)).toEqual(baseline);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`${kind}-depth-${width}.png`),fullPage:true});
  }
  await page.getByRole('button',{name:'Показать всю сцену',exact:true}).click();
  view=await rendered(surface);assertOrder(view,kind);
  const canvasBox=await surface.boundingBox();
  const contains=(b,x,y)=>b&&x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;
  // Choose a visible foreground house point not covered by a later different owner.
  // Uses actual painted bounds/ordering, never DOM programmatic click or synthetic API state.
  const candidates=view.items.filter(i=>i.identity&&i.streetId&&i.depth>pivot.depth&&i.bounds).map(item=>{
   const x=item.bounds.x+item.bounds.width/2,y=item.bounds.y+item.bounds.height*.72;
   return {item,x,y};
  }).filter(p=>p.x>10&&p.y>10&&p.x<canvasBox.width-10&&p.y<canvasBox.height-10&&!view.items.some(later=>later.drawIndex>p.item.drawIndex&&later.streetId&&later.streetId!==p.item.streetId&&contains(later.bounds,p.x,p.y)));
  expect(candidates.length).toBeGreaterThan(0);
  const selected=candidates[0],street=city.streets.find(s=>s.id===selected.item.streetId);expect(street).toBeTruthy();
  await page.mouse.click(canvasBox.x+selected.x,canvasBox.y+selected.y);
  await expect.poll(()=>surface.getAttribute('data-landmark')).toBeNull();
  await expect.poll(()=>surface.evaluate(el=>Object.keys(JSON.parse(el.dataset.houseSprites||'{}')).sort())).toEqual(street.houses.map(h=>h.id).sort());
  await page.screenshot({path:info.outputPath(`${kind}-selected-foreground-street.png`),fullPage:true});
  // A second native path picks an unoccluded floor Polygon, not an elevated sprite.
  await page.getByTestId('country-nav').click();await page.getByTestId(`city-${city.id}`).click();
  await expect(surface).toHaveAttribute('data-landmark',kind);
  const groundView=(await rendered(surface)).items;
  const a=groundView[0],b=groundView.find(item=>Math.abs(item.x-a.x)>100);
  const scale=(b.screenX-a.screenX)/(b.x-a.x),tx=a.screenX-a.x*scale,ty=a.screenY-a.y*scale;
  let ground;
  for(let index=0;index<city.streets.length&&!ground;index++){
   const target=city.streets[index];if(target.houses.length||target.parking.length)continue;
   const position=cityBlockPosition(index,kind);
   for(const [dx,dy] of [[25,65],[45,60],[65,70]]){
    const wx=position.x+dx,wy=position.y+dy,x=tx+(wx-wy)*scale,y=ty+(wx+wy)*.48*scale;
    if(x>10&&y>10&&x<canvasBox.width-10&&y<canvasBox.height-10&&!groundView.some(item=>contains(item.bounds,x,y))){ground={x,y,target};break;}
   }
  }
  expect(ground,'existing empty street must offer visible ground outside sprite bounds').toBeTruthy();
  await page.mouse.click(canvasBox.x+ground.x,canvasBox.y+ground.y);
  await expect.poll(()=>surface.getAttribute('data-landmark')).toBeNull();
  await expect.poll(()=>surface.evaluate(el=>[...new Set(JSON.parse(el.dataset.depthOrder||'[]').map(item=>item.streetId).filter(Boolean))])).toEqual([ground.target.id]);
  expect(writes).toEqual([]);expect(errors).toEqual([]);
 });
}
