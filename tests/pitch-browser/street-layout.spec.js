import {test,expect} from '@playwright/test';
import {lotPosition} from '../../src/frontend/app/model.ts';

for(const scenario of ['empty','motor_only','mixed','skyscraper','overflow','large']){
 test(`winding street ${scenario} preserves real plots and artwork without writes`,async({page,request},info)=>{
  const writes=[],errors=[];
  await page.route('**/api/**',route=>{
   if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(route.request().url());return route.abort();}
   return route.continue();
  });
  page.on('pageerror',error=>errors.push(error.message));
  const response=await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent');expect(response.ok()).toBe(true);
  const state=await response.json(),city=state.cities.find(c=>c.id===state.viewer.cityId);
  const street=city.streets.find(s=>s.scenario===scenario);expect(street).toBeTruthy();
  await page.goto('/');const surface=page.getByTestId('scene-surface');await expect(surface).toHaveAttribute('data-ready','true');
  await page.getByTestId('demo-scenario').selectOption(street.agentId);
  await expect(page.getByTestId('action-property')).toBeEnabled();await page.getByTestId('my-street').click();
  await expect.poll(()=>surface.evaluate(el=>Object.keys(JSON.parse(el.dataset.houseSprites||'{}')).sort())).toEqual(street.houses.map(h=>h.id).sort());
  const read=()=>surface.evaluate(el=>({items:JSON.parse(el.dataset.depthOrder||'[]'),sprites:JSON.parse(el.dataset.spriteInstances||'{}')}));
  const baseline=await read();
  expect(Object.keys(baseline.sprites).some(id=>id.startsWith('center-'))).toBe(false);
  expect(Object.keys(baseline.sprites).some(id=>id.startsWith('road-'))).toBe(false);
  expect(baseline.sprites['grass']||0).toBe(0);
  expect(baseline.sprites['vacant-lot']||0).toBe(0); // continuous meadow, no opaque lot panels
  for(const house of street.houses){
   const item=baseline.items.find(i=>i.identity===house.id),p=lotPosition(house.lotIndex);
   expect(item).toBeTruthy();expect(item.x).toBeCloseTo(p.x+34-(p.y+32),8);expect(item.y).toBeCloseTo((p.x+34+p.y+32)*.48,8);
   expect(item.sprite).toMatch(new RegExp(`^house-${String(house.tier).padStart(2,'0')}-[ab]$`));
  }
  const expectedParking={};for(const p of street.parking){const id=`parking-0${p.spaces<=3?1:p.spaces<=6?2:p.spaces<=9?3:4}`;expectedParking[id]=(expectedParking[id]||0)+1;}
  expect(Object.fromEntries(Object.entries(baseline.sprites).filter(([id])=>id.startsWith('parking-')))).toEqual(expectedParking);
  const signature=view=>view.items.map(i=>[i.identity,i.sprite,i.streetId,i.depth]);
  const check=async()=>{const view=await read();expect(signature(view)).toEqual(signature(baseline));for(let i=1;i<view.items.length;i++)expect(view.items[i].depth).toBeGreaterThanOrEqual(view.items[i-1].depth);};
  for(const width of [1100,1440,1920]){
   await page.setViewportSize({width,height:960});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await check();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`${scenario}-${width}-fit.png`),fullPage:true});
  }
  for(let step=0;step<(scenario==='large'?4:1);step++)await page.getByRole('button',{name:'Приблизить',exact:true}).click();await check();
  await page.screenshot({path:info.outputPath(`${scenario}-zoom.png`),fullPage:true});
  await surface.focus();await page.keyboard.press('ArrowLeft');await check();
  await page.getByRole('button',{name:'Показать всю сцену',exact:true}).click();await check();
  expect(writes).toEqual([]);expect(errors).toEqual([]);
 });
}
