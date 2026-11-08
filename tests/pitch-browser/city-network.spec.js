import {test,expect} from '@playwright/test';
import {cityBlockPosition} from '../../src/frontend/app/model.ts';

const read=surface=>surface.evaluate(el=>JSON.parse(el.dataset.depthOrder||'[]'));
const settled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
for(const [id,kind] of [['001','moscow'],['025','vladivostok'],['021','generic']])test(`city network ${kind} keeps its center and every miniature at fit and closeup without writes`,async({page,request},info)=>{
 const writes=[],errors=[];page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 const response=await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent');expect(response.ok()).toBe(true);const state=await response.json(),city=state.cities.find(c=>c.id===`TEST-CITY-${id}`);
 await page.goto('/');const surface=page.getByTestId('scene-surface');await expect(surface).toHaveAttribute('data-ready','true');await page.getByTestId('country-nav').click();await page.getByTestId(`city-${city.id}`).click();await expect(surface).toHaveAttribute('data-landmark',kind);
 const signature=items=>items.filter(i=>i.identity||i.sprite.startsWith('center-')).map(i=>[i.sprite,i.identity,i.x,i.y]);const initial=signature(await read(surface));
 for(const width of [1100,1440,1920]){
  await page.setViewportSize({width,height:960});await settled(page);await page.getByRole('button',{name:'Показать всю сцену',exact:true}).click();await settled(page);
  const items=await read(surface),center=items.find(i=>i.sprite===`center-${kind}`),box=await surface.boundingBox();
  expect(items.filter(i=>i.sprite.startsWith('center-'))).toHaveLength(1);expect(signature(items)).toEqual(initial);
  expect(center.bounds.x).toBeGreaterThan(0);expect(center.bounds.y).toBeGreaterThan(0);expect(center.bounds.x+center.bounds.width).toBeLessThan(box.width);expect(center.bounds.y+center.bounds.height).toBeLessThan(box.height);
  expect(items.filter(i=>i.identity).map(i=>i.identity).sort()).toEqual(city.streets.flatMap(s=>s.houses.slice(0,5).map(h=>h.id)).sort());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`${kind}-${width}-fit.png`),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:960});await settled(page);await page.getByRole('button',{name:'Показать всю сцену',exact:true}).click();
 for(let n=0;n<3;n++)await page.getByRole('button',{name:'Приблизить',exact:true}).click();await settled(page);
 expect(signature(await read(surface))).toEqual(initial);await page.screenshot({path:info.outputPath(`${kind}-1440-closeup.png`),fullPage:true});
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});

test('all 50 city streets retain native visible-object or floor-polygon navigation without writes',async({page,request})=>{
 test.setTimeout(240_000);const writes=[],errors=[];page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 const response=await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent');expect(response.ok()).toBe(true);const state=await response.json(),city=state.cities.find(c=>c.id==='TEST-CITY-001');expect(city.streets).toHaveLength(50);
 await page.goto('/');const surface=page.getByTestId('scene-surface');await expect(surface).toHaveAttribute('data-ready','true');const selected=[];
 for(let index=0;index<city.streets.length;index++){
  const street=city.streets[index];await page.getByTestId('country-nav').click();await page.getByTestId(`city-${city.id}`).click();await expect(surface).toHaveAttribute('data-landmark','moscow');
  const items=await read(surface),box=await surface.boundingBox(),a=items[0],b=items.find(i=>Math.abs(i.x-a.x)>100),scale=(b.screenX-a.screenX)/(b.x-a.x),tx=a.screenX-a.x*scale,ty=a.screenY-a.y*scale;
  const contains=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;
  const origin=cityBlockPosition(index);let point;
  for(const dy of [84,92,100,75,65,55])for(const dx of [48,24,72,12,96]){
   if(point)continue;const wx=origin.x+dx,wy=origin.y+dy,x=tx+(wx-wy)*scale,y=ty+(wx+wy)*.48*scale;
   if(x>8&&y>8&&x<box.width-8&&y<box.height-8&&!items.some(i=>contains(i.bounds,x,y)))point={x,y};
  }
  if(!point){
   for(const item of items.filter(i=>i.streetId===street.id&&i.bounds)){
    const x=item.bounds.x+item.bounds.width*.5,y=item.bounds.y+item.bounds.height*.72;
    if(x>8&&y>8&&x<box.width-8&&y<box.height-8&&!items.some(later=>later.drawIndex>item.drawIndex&&later.streetId!==street.id&&contains(later.bounds,x,y))){point={x,y};break;}
   }
  }
  expect(point,`street ${index} needs an unobscured native target`).toBeTruthy();await page.mouse.click(box.x+point.x,box.y+point.y);
  await expect.poll(()=>surface.getAttribute('data-landmark')).toBeNull();await expect(surface).toHaveAttribute('data-ready','true');
  await expect.poll(async()=>[...new Set((await read(surface)).map(i=>i.streetId).filter(Boolean))]).toEqual([street.id]);
  expect(await surface.evaluate(el=>Object.keys(JSON.parse(el.dataset.houseSprites||'{}')).sort())).toEqual(street.houses.map(h=>h.id).sort());selected.push(street.id);
 }
 expect(new Set(selected).size).toBe(50);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
