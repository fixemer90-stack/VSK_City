import '@angular/compiler';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppComponent} from '../app/app.ts';
import {readFileSync} from 'node:fs';
import {DemoApi} from '../app/model.ts';

test('demo dock provides a guarded +100 motor action beside single motor',()=>{
 const html=readFileSync(new URL('../app/app.html',import.meta.url),'utf8');
 assert.match(html,/data-testid="action-motor-100"[^>]*\[disabled\]="busy\(\)\|\|!!pending\(\)\|\|!state\(\)"[^>]*\(click\)="act\('motor-100'\)"/);
 assert.match(html,/＋100.*Мотор/);
});

test('bulk motor retries exactly the same single request after uncertain response',async()=>{
 const app=new AppComponent();const bodies:string[]=[];
 (app as any).api=new DemoApi((async(_url:RequestInfo|URL,init?:RequestInit)=>{
  bodies.push(String(init?.body));return new Response(JSON.stringify(bodies.length===1?null:world));
 }) as typeof fetch);
 try{
  await app.act('motor-100');assert.ok(app.pending());
  await app.act('motor-100');assert.equal(bodies.length,1);
  await app.act('motor-100',true);assert.equal(bodies.length,2);
  assert.equal(bodies[1],bodies[0]);assert.equal(JSON.parse(bodies[0]).type,'motor-100');assert.equal(app.pending(),null);
 }finally{app.ngOnDestroy();}
});

const world={mode:'pitch',version:2,now:'2026-11-05T00:00:00Z',viewer:{agentId:'TEST-AGENT-001-044',streetId:'street',cityId:'city',firstName:'Имя',lastName:'Фамилия',role:'agent'},cities:[]};

test('a new rules version invalidates cached city projections without changing saved world version',async()=>{
 const app=new AppComponent();
 const house={id:'house',lotIndex:0,xp:100,tier:8,floors:100,status:'active',demolishAt:null};
 const street={id:'street',agentId:world.viewer.agentId,name:null,scenario:'skyscraper',houses:[house],parking:[]};
 const city={id:'city',name:'Москва',mapX:0,mapY:0,streets:[street]};
 app.state.set({...world,rulesVersion:1,cities:[city]} as any);
 const updated={...world,rulesVersion:2,cities:[{...city,streets:[{...street,houses:[{...house,tier:10,floors:25}]}]}]};
 (app as any).api=new DemoApi((async()=>new Response(JSON.stringify(updated))) as typeof fetch);
 try{
  await app.load(false);
  assert.equal(app.state()?.version,2);
  assert.equal(app.state()?.cities[0].streets[0].houses[0].tier,10);
  assert.equal(app.state()?.cities[0].streets[0].houses[0].floors,25);
 }finally{app.ngOnDestroy();}
});

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
