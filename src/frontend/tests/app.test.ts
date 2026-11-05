import '@angular/compiler';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppComponent} from '../app/app.ts';
import {DemoApi} from '../app/model.ts';

const world={mode:'pitch',version:2,now:'2026-11-05T00:00:00Z',viewer:{agentId:'TEST-AGENT-001-044',streetId:'street',cityId:'city',firstName:'Имя',lastName:'Фамилия',role:'agent'},cities:[]};

test('a stale GET cannot overwrite a newer POST even if transport ignores abort',async()=>{
 const app=new AppComponent();let resolveGet!:(response:Response)=>void;
 (app as any).api=new DemoApi((async(_url:RequestInfo|URL,init?:RequestInit)=>init?.method==='POST'?new Response(JSON.stringify(world)):new Promise<Response>(resolve=>{resolveGet=resolve;})) as typeof fetch);
 try {const load=app.load();await app.act('motor');resolveGet(new Response(JSON.stringify({...world,version:1})));await load;assert.equal(app.state()?.version,2);assert.equal(app.error(),'');}finally{app.ngOnDestroy();}
});

test('null POST keeps pending, blocks fresh actions and identity changes, retries the same key and identity',async()=>{
 const app=new AppComponent();
 const requests:{url:string;body:string}[]=[];
 (app as any).api=new DemoApi((async(url:RequestInfo|URL,init?:RequestInit)=>{
  requests.push({url:String(url),body:String(init?.body)});
  return new Response(JSON.stringify(requests.length===1?null:world));
 }) as typeof fetch);
 try {
  await app.act('property');
  const pending=app.pending();
  assert.ok(pending,'possibly committed POST must keep its key');
  assert.equal(app.busy(),false);
  await app.act('motor');
  app.choosePersona('other');app.chooseRole('director');
  assert.equal(requests.length,1);
  assert.equal(app.agentId(),world.viewer.agentId);assert.equal(app.role(),'agent');
  await app.act('property',true);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1],requests[0]);
  assert.equal(JSON.parse(requests[1].body).requestId,pending.requestId);
  assert.equal(app.pending(),null);assert.equal(app.state()?.version,2);
 } finally {app.ngOnDestroy();}
});
