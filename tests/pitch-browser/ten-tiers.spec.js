import {test,expect} from '@playwright/test';

const floors=[1,3,4,5,6,9,12,14,17,25];
const thresholds=Array.from({length:10},(_,i)=>Math.round(i*100/9));
const stateUrl='/api/demo/state?agentId=TEST-AGENT-001-044&role=agent';

test('persisted XP projects through ten evenly spaced thresholds with the same 100 XP capacity',async({request})=>{
 const response=await request.get(stateUrl);expect(response.ok()).toBe(true);
 const state=await response.json();expect(state.mode).toBe('pitch');expect(state.rulesVersion).toBe(2);
 const houses=state.cities.flatMap(c=>c.streets.flatMap(s=>s.houses));
 expect(houses.length).toBeGreaterThan(0);
 const wrong=houses.filter(h=>{
  const tier=thresholds.filter(xp=>h.xp>=xp).length;
  return !Number.isInteger(h.xp)||h.xp<0||h.xp>100||h.tier!==tier||h.floors!==floors[tier-1];
 });
 expect(wrong.slice(0,10),`${wrong.length} houses have obsolete progression`).toEqual([]);
 expect(houses.some(h=>h.xp===100&&h.tier===10&&h.floors===25)).toBe(true);
});

test('each house keeps its A or B artwork after reload and between street and city',async({page,request},info)=>{
 const writes=[],errors=[];
 page.on('request',req=>{if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(req.url());});
 page.on('pageerror',error=>errors.push(error.message));
 const state=await(await request.get(stateUrl)).json();
 const city=state.cities.find(c=>c.id===state.viewer.cityId);
 const large=city.streets.find(s=>s.scenario==='large');expect(large).toBeTruthy();
 const ids=large.houses.map(h=>h.id).sort();
 const surface=page.getByTestId('scene-surface');
 const read=()=>surface.evaluate(el=>JSON.parse(el.dataset.houseSprites||'{}'));
 const openStreet=async()=>{
  await page.getByTestId('demo-scenario').selectOption(large.agentId);
  await expect(page.getByTestId('action-property')).toBeEnabled();
  await page.getByTestId('my-street').click();
  await expect.poll(async()=>Object.keys(await read()).sort()).toEqual(ids);
 };
 await page.goto('/');await expect(surface).toHaveAttribute('data-ready','true');
 await openStreet();const before=await read();
 expect(Object.values(before).every(id=>/^house-(0[1-9]|10)-[ab]$/.test(id))).toBe(true);
 expect(new Set(Object.values(before).map(id=>id.slice(-1))).size).toBe(2);
 await page.reload();await expect(surface).toHaveAttribute('data-ready','true');
 await openStreet();expect(await read()).toEqual(before);
 await page.screenshot({path:info.outputPath('ten-tier-large-street.png'),fullPage:true});
 await page.getByTestId('country-nav').click();await page.getByTestId('city-'+city.id).click();
 const preview=large.houses.slice(0,5).map(h=>h.id);
 await expect.poll(async()=>{const current=await read();return preview.map(id=>current[id]);}).toEqual(preview.map(id=>before[id]));
 await page.screenshot({path:info.outputPath('ten-tier-city.png'),fullPage:true});
 const sky=city.streets.find(s=>s.scenario==='skyscraper');expect(sky).toBeTruthy();
 await page.getByTestId('demo-scenario').selectOption(sky.agentId);
 await expect(page.getByTestId('action-property')).toBeEnabled();await page.getByTestId('my-street').click();
 await expect.poll(async()=>Object.keys(await read()).sort()).toEqual(sky.houses.map(h=>h.id).sort());
 expect(Object.values(await read()).some(id=>id.startsWith('house-10-'))).toBe(true);
 await page.screenshot({path:info.outputPath('ten-tier-max.png'),fullPage:true});
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
