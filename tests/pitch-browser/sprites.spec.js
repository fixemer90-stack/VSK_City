import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';

test('all 35 transparent sprites include twenty original paired houses and the catalog renders every asset',async({page,request},info)=>{
 const response=await request.get('/sprites/manifest.json');
 expect(response.headers()['content-type']).toContain('application/json');
 const manifest=await response.json();expect(manifest.entries).toHaveLength(35);
 expect(new Set(manifest.entries.map(e=>e.id)).size).toBe(35);
 const sources=[
  ['IC_L01_A.svg','IC_L01_B.svg'],['IC_L03_A.svg','IC_L03_B.svg'],
  ['IC_L04_A.svg','IC_L04_B.svg'],['IC_L05_A_II05.svg','IC_L05_B_Brick.svg'],
  ['IC_L06_A.svg','IC_L06_B.svg'],['IC_L09_A.svg','IC_L09_B.svg'],
  ['IC_L12_A_P42_P43.svg','IC_L12_B_P44M.svg'],['IC_L14_A_P55.svg','IC_L14_B_Erker.svg'],
  ['IC_L17_A_Section.svg','IC_L17_B_KOPE.svg'],['IC_L25_A_KOPE_Tower.svg','IC_L25_B_Stalin_Skyscraper.svg'],
 ];
 for(const entry of manifest.entries){
  const image=await request.get('/sprites/'+entry.file);
  expect(image.ok()).toBe(true);expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(entry.sha256);
  if(entry.id.startsWith('house-')){
   const match=/^house-(\d{2})-([ab])$/.exec(entry.id);expect(match).toBeTruthy();
   expect(entry.sourceFile).toBe(`house/${sources[Number(match[1])-1][match[2]==='a'?0:1]}`);
   const original=await request.get('/sprites/source/'+entry.sourceFile);
   expect(original.ok()).toBe(true);
   expect(createHash('sha256').update(await original.body()).digest('hex')).toBe(entry.sourceSha256);
   expect(entry.pixelRatio).toBe(/<image\b/.test((await original.body()).toString())?1:2);
  }
 }
 await page.goto('/sprites/catalog.html');
 await expect(page.locator('figure[data-sprite]')).toHaveCount(35);
 await expect.poll(()=>page.locator('figure img').evaluateAll(images=>images.filter(img=>img.complete&&img.naturalWidth>0).length)).toBe(35);
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
 await expect(surface).toHaveAttribute('data-ready','true');await expect(surface).toHaveAttribute('data-sprite-assets','35');
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
