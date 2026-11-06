import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

test('four user parking vectors match the live PNG pack and real street occupancy',async({page,request},info)=>{
 const writes=[],errors=[];
 page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 const manifest=await(await request.get('/sprites/manifest.json')).json();
 const parking=manifest.entries.filter(e=>e.group==='parking');expect(parking).toHaveLength(4);
 for(const entry of parking){
  expect(entry.sourceFile).toBe(`parking/${entry.id}.svg`);expect(entry.pixelRatio).toBe(2);
  expect(entry.width*entry.worldScale).toBeGreaterThan(125);expect(entry.width*entry.worldScale).toBeLessThan(145);
  const original=await readFile(new URL(`../../src/frontend/public/sprites/source/${entry.sourceFile}`,import.meta.url));
  const source=await request.get('/sprites/source/'+entry.sourceFile);expect(source.ok()).toBe(true);
  expect(createHash('sha256').update(await source.body()).digest('hex')).toBe(entry.sourceSha256);
  expect(createHash('sha256').update(original).digest('hex')).toBe(entry.sourceSha256);
  const image=await request.get('/sprites/'+entry.file);expect(image.ok()).toBe(true);
  expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(entry.sha256);
 }
 await page.goto('/sprites/catalog.html');
 for(const entry of parking){
  const image=page.locator(`figure[data-sprite="${entry.id}"] img`);
  await expect(image).toHaveJSProperty('complete',true);await expect(image).toHaveJSProperty('naturalWidth',entry.width);
 }
 await page.locator('figure[data-sprite="parking-01"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('parking-catalog.png')});
 const state=await(await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent')).json();
 const city=state.cities.find(c=>c.id===state.viewer.cityId),street=city.streets.find(s=>s.parking.length>0);
 expect(street).toBeTruthy();const expected={};
 for(const p of street.parking){const tier=p.spaces<=3?1:p.spaces<=6?2:p.spaces<=9?3:4;const id=`parking-0${tier}`;expected[id]=(expected[id]||0)+1;}
 await page.goto('/');const surface=page.getByTestId('scene-surface');await expect(surface).toHaveAttribute('data-ready','true');
 await page.getByTestId('demo-scenario').selectOption(street.agentId);
 await expect(page.getByTestId('action-property')).toBeEnabled();await page.getByTestId('my-street').click();
 await expect.poll(()=>surface.evaluate(el=>Object.fromEntries(Object.entries(JSON.parse(el.dataset.spriteInstances||'{}')).filter(([id])=>id.startsWith('parking-'))))).toEqual(expected);
 await page.screenshot({path:info.outputPath('parking-street.png'),fullPage:true});
 await page.getByTestId('country-nav').click();await page.getByTestId('city-'+city.id).click();
 await expect.poll(()=>surface.evaluate(el=>Object.keys(JSON.parse(el.dataset.spriteInstances||'{}')).some(id=>id.startsWith('parking-')))).toBe(true);
 await page.screenshot({path:info.outputPath('parking-city.png'),fullPage:true});
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
