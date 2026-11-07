import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../app/model.ts';
import {lotPosition, scenarioLabel, DemoApi, ApiError} from '../app/model.ts';

test('city block positions keep all 50 streets stable outside the central 2x2 plaza',()=>{
 const position=(model as any).cityBlockPosition;
 assert.equal(typeof position,'function','city layout needs a reserved-plaza allocator');
 const slots=Array.from({length:50},(_,i)=>position(i));
 assert.equal(new Set(slots.map(p=>JSON.stringify(p))).size,50);
 for(const p of slots){const col=p.x/119,row=p.y/126;assert.ok(!(col>=3&&col<=4&&row>=3&&row<=4));assert.ok(col>=0&&col<8&&row>=0&&row<7);}
 assert.deepEqual(Array.from({length:50},(_,i)=>position(i)),slots);
});

 test('GET composes the 20s deadline with caller cancellation and reports timeout as ApiError',async(t)=>{
  const deadline=new AbortController();let milliseconds:number|undefined;let supplied:AbortSignal|undefined;
  t.mock.method(AbortSignal,'timeout',(ms:number)=>{milliseconds=ms;return deadline.signal;});
  const caller=new AbortController();
  const api=new DemoApi((async(_url:RequestInfo|URL,init?:RequestInit)=>{
   supplied=init?.signal as AbortSignal;
   return new Promise<Response>((_resolve,reject)=>supplied!.addEventListener('abort',()=>reject(supplied!.reason),{once:true}));
  }) as typeof fetch);
  const request=api.state('agent','agent',caller.signal);
  assert.equal(milliseconds,20000,'caller signal must not disable the deadline');
  deadline.abort(new DOMException('deadline','TimeoutError'));
  await assert.rejects(request,(e:unknown)=>e instanceof ApiError&&!e.uncertain&&/время|тайм|ожидани/i.test(e.message));
  assert.equal(supplied?.aborted,true);assert.equal(caller.signal.aborted,false);
 });

 test('GET caller abort remains intentional AbortError rather than ApiError',async(t)=>{
  const deadline=new AbortController();t.mock.method(AbortSignal,'timeout',()=>deadline.signal);
  const caller=new AbortController();let supplied:AbortSignal|undefined;
  const api=new DemoApi((async(_url:RequestInfo|URL,init?:RequestInit)=>{
   supplied=init?.signal as AbortSignal;
   return new Promise<Response>((_resolve,reject)=>supplied!.addEventListener('abort',()=>reject(supplied!.reason),{once:true}));
  }) as typeof fetch);
  const request=api.state('agent','agent',caller.signal);caller.abort();
  await assert.rejects(request,(e:unknown)=>e instanceof DOMException&&e.name==='AbortError');
  assert.equal(supplied?.aborted,true);assert.equal(deadline.signal.aborted,false);
 });

test('transport receives the global native-fetch receiver',async()=>{
 let receiver:unknown;
 // eslint-disable-next-line @typescript-eslint/no-this-alias -- Capture the native-fetch receiver to assert binding, not to replace lexical this.
 const api=new DemoApi((async function(this:unknown){receiver=this;if(this!==globalThis)throw new TypeError('Illegal invocation');return new Response(JSON.stringify({cities:[],viewer:{},now:'2026-11-05T00:00:00Z'}));}) as typeof fetch);
 await api.state('agent','agent');assert.equal(receiver,globalThis);
});

test('lot geometry is stable when other lots change and every lot is distinct', () => {
  const original = lotPosition(43);
  Array.from({length: 100}, (_, i) => lotPosition(i));
  assert.deepEqual(lotPosition(43), original);
  assert.equal(new Set(Array.from({length:100},(_,i)=>JSON.stringify(lotPosition(i)))).size, 100);
});

test('network-failed action can be retried with the exact same key and viewer identity', async () => {
 const requests:{url:string;init:RequestInit}[]=[];
 const state={cities:[],viewer:{agentId:'TEST-AGENT-001-044'},now:'2026-11-05T00:00:00Z'};
 const api=new DemoApi((async(url:RequestInfo|URL,init?:RequestInit)=>{requests.push({url:String(url),init:init!});if(requests.length===1)throw new TypeError('offline');return new Response(JSON.stringify(state));}) as typeof fetch);
 await assert.rejects(api.action('TEST-AGENT-001-044','agent','property','stable-key'),(e:any)=>e.uncertain===true);
 await api.action('TEST-AGENT-001-044','agent','property','stable-key');
 assert.equal(requests[0].init.body,requests[1].init.body);
 assert.deepEqual(JSON.parse(String(requests[1].init.body)),{agentId:'TEST-AGENT-001-044',type:'property',requestId:'stable-key'});
 assert.match(requests[1].url,/role=agent/);
});

test('HTTP rejection is never represented as success and preserves server message',async()=>{
 const api=new DemoApi((async()=>new Response(JSON.stringify({message:'Нет активного дома'}),{status:409})) as typeof fetch);
 await assert.rejects(api.action('agent','agent','terminate-property','key'),(e:any)=>e.message==='Нет активного дома'&&!e.uncertain);
});

test('scenario labels reveal no owner identity',()=>{
 assert.equal(scenarioLabel('overflow'),'Город и парковки');
 assert.equal(scenarioLabel('empty'),'Чистый лист');
});
