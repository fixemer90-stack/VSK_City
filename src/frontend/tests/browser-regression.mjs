// Exercises the production bundle without restarting the pitch frontend.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../../tests/pitch-browser/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const root=fileURLToPath(new URL('../dist/atlas/browser/',import.meta.url));
const server=createServer(async(req,res)=>{
 try {
  if(req.url.startsWith('/api/')||req.url==='/health'){
   const response=await fetch(`http://127.0.0.1:5189${req.url}`);
   res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!path.startsWith(root)){res.writeHead(403);res.end();return;}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
  res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});res.end(await readFile(path));
 }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const stateResponse=page.waitForResponse(r=>r.url().includes('/api/demo/state')&&r.status()===200);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const state=await (await stateResponse).json();
 const select=page.getByTestId('demo-scenario');await select.waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-testid="demo-scenario"]')?.options.length===50);
 assert.equal(state.viewer.agentId,'TEST-AGENT-001-044');
 assert.equal(await select.inputValue(),state.viewer.agentId,'initial select must reflect the actual viewer, not the first async option');
 for(const id of ['TEST-AGENT-001-001','TEST-AGENT-001-044']){
  const response=page.waitForResponse(r=>r.url().includes('/api/demo/state')&&r.url().includes(`agentId=${id}`)&&r.status()===200);
  await select.selectOption(id);const next=await (await response).json();
  await page.waitForFunction(()=>document.querySelector('[data-testid="demo-scenario"]')?.options.length===50);
  assert.equal(await select.inputValue(),next.viewer.agentId,'reloaded options must retain chosen identity');
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({nativeFetch:'real backend GET 200, no fetch override',initialViewer:state.viewer.agentId,selectReloads:2,pageErrors:errors}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
