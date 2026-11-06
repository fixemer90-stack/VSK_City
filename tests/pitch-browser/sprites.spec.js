import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';

test('all 23 transparent sprites are real decoded PNGs and the local catalog renders every asset',async({page,request},info)=>{
 const response=await request.get('/sprites/manifest.json');
 expect(response.headers()['content-type']).toContain('application/json');
 const manifest=await response.json();expect(manifest.entries).toHaveLength(23);
 expect(new Set(manifest.entries.map(e=>e.id)).size).toBe(23);
 for(const entry of manifest.entries){
  const image=await request.get('/sprites/'+entry.file);
  expect(image.ok()).toBe(true);expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(entry.sha256);
  if(entry.id.startsWith('house-')){
   expect(entry.sourceFile).toBe(`new/house_${entry.id.slice(-2)}.svg`);
   const original=await request.get('/sprites/source/'+entry.sourceFile);
   expect(original.ok()).toBe(true);
   expect(createHash('sha256').update(await original.body()).digest('hex')).toBe(entry.sourceSha256);
  }
 }
 await page.goto('/sprites/catalog.html');
 await expect(page.locator('figure[data-sprite]')).toHaveCount(23);
 await expect.poll(()=>page.locator('figure img').evaluateAll(images=>images.filter(img=>img.complete&&img.naturalWidth>0).length)).toBe(23);
 const alpha=await page.locator('figure img').evaluateAll(images=>images.map(image=>{
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let transparent=0,painted=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;else painted++;}
  return {transparent,painted};
 }));
 expect(alpha.every(image=>image.transparent>0&&image.painted>100)).toBe(true);
 await page.screenshot({path:info.outputPath('sprite-catalog.png'),fullPage:true});
});

test('street and city use actual sprite instances through read-only UI navigation',async({page,request},info)=>{
 const writes=[],errors=[];
 page.on('request',req=>{if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(req.url());});page.on('pageerror',error=>errors.push(error.message));
 const state=await(await request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent')).json();
 const city=state.cities.find(c=>c.id===state.viewer.cityId);
 const large=city.streets.find(s=>s.scenario==='large'),parking=city.streets.find(s=>s.parking.length>0);
 expect(large).toBeTruthy();expect(parking).toBeTruthy();
 await page.goto('/');
 const surface=page.getByTestId('scene-surface');
 await expect(surface).toHaveAttribute('data-ready','true');await expect(surface).toHaveAttribute('data-sprite-assets','23');
 await page.screenshot({path:info.outputPath('sprite-street.png'),fullPage:true});
 await page.getByTestId('demo-scenario').selectOption(large.agentId);
 await expect(page.getByTestId('action-property')).toBeEnabled();await page.getByTestId('my-street').click();
 await expect.poll(()=>surface.evaluate(el=>Object.entries(JSON.parse(el.dataset.spriteInstances||'{}')).filter(([id])=>id.startsWith('house-')).reduce((sum,[,count])=>sum+count,0))).toBe(large.houses.length);
 await page.screenshot({path:info.outputPath('sprite-large-street.png'),fullPage:true});
 await page.getByTestId('demo-scenario').selectOption(parking.agentId);
 await expect(page.getByTestId('action-property')).toBeEnabled();await page.getByTestId('my-street').click();
 await expect.poll(()=>surface.evaluate(el=>Object.keys(JSON.parse(el.dataset.spriteInstances||'{}')).some(id=>id.startsWith('parking-')))).toBe(true);
 await page.screenshot({path:info.outputPath('sprite-parking.png'),fullPage:true});
 for(const [id,kind] of [['001','moscow'],['025','vladivostok']]){
  await page.getByTestId('country-nav').click();await page.getByTestId('city-TEST-CITY-'+id).click();
  await expect(surface).toHaveAttribute('data-landmark',kind);
  await expect.poll(()=>surface.evaluate((el,kind)=>JSON.parse(el.dataset.spriteInstances||'{}')['center-'+kind]||0,kind)).toBe(1);
  await page.screenshot({path:info.outputPath('sprite-'+kind+'.png'),fullPage:true});
 }
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
