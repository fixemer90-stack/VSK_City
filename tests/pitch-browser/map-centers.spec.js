import {test,expect} from '@playwright/test';

test('geographic map fits every city and label, including Vladivostok, at desktop sizes',async({page},info)=>{
 const writes=[];page.on('request',request=>{if(request.method()==='POST')writes.push(request.url());});
 await page.goto('/');
 await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready','true');
 await page.getByTestId('country-nav').click();
 const surface=page.getByTestId('scene-surface');
 await expect(surface).toHaveAttribute('data-country-markers',/^\[/);
 for(const viewport of [{width:1100,height:720},{width:1280,height:800},{width:1440,height:960},{width:1920,height:1080}]){
  await page.setViewportSize(viewport);
  await expect.poll(()=>surface.evaluate(el=>{
   const points=JSON.parse(el.dataset.countryMarkers||'[]');
   return points.length===25&&points.every(p=>p.x>=14&&p.y>=14&&p.x<=el.clientWidth-14&&p.y<=el.clientHeight-14&&(!p.label||(p.label.x>=0&&p.label.y>=0&&p.label.x+p.label.width<=el.clientWidth&&p.label.y+p.label.height<=el.clientHeight)));
  })).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`country-${viewport.width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1100,height:720});
 await expect.poll(()=>surface.evaluate(el=>JSON.parse(el.dataset.countryMarkers||'[]').every(m=>m.x<=el.clientWidth&&m.y<=el.clientHeight))).toBe(true);
 const response=await page.request.get('/api/demo/state?agentId=TEST-AGENT-001-044&role=agent');
 const cities=(await response.json()).cities;
 for(const {id,name} of cities){
  await expect.poll(()=>surface.evaluate((el,id)=>JSON.parse(el.dataset.countryMarkers||'[]').some(m=>m.id===id),id)).toBe(true);
  const marker=await surface.evaluate((el,id)=>JSON.parse(el.dataset.countryMarkers).find(m=>m.id===id),id);
  const bounds=await surface.boundingBox();
  await page.mouse.click(bounds.x+marker.x,bounds.y+marker.y);
  await expect(page.getByTestId('scene-title')).toContainText(name);
  await page.getByTestId('country-nav').click();
 }
 await expect.poll(()=>surface.evaluate(el=>JSON.parse(el.dataset.countryMarkers||'[]').length)).toBe(25);
 const minor=await surface.evaluate(el=>JSON.parse(el.dataset.countryMarkers).find(m=>m.id==='TEST-CITY-010'));
 const box=await surface.boundingBox();
 await page.mouse.move(box.x+minor.x,box.y+minor.y);
 await expect.poll(()=>surface.evaluate(el=>!!JSON.parse(el.dataset.countryMarkers).find(m=>m.id==='TEST-CITY-010')?.label)).toBe(true);
 expect(writes).toEqual([]);
});

test('permanent city centers distinguish Moscow and Vladivostok with a civic fallback',async({page},info)=>{
 const writes=[];const errors=[];
 page.on('request',request=>{if(request.method()==='POST')writes.push(request.url());});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready','true');
 for(const [id,kind,name] of [['001','moscow','Кремлёвская площадь'],['025','vladivostok','Золотой мост'],['021','generic','Городская площадь']]){
  await page.getByTestId('country-nav').click();
  await page.getByTestId('city-TEST-CITY-'+id).click();
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-landmark',kind);
  await expect(page.getByTestId('landmark-caption')).toHaveText(name);
  for(const viewport of [{width:1280,height:800},{width:1440,height:960}]){
   await page.setViewportSize(viewport);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`${kind}-${viewport.width}.png`),fullPage:true});
  }
 }
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
