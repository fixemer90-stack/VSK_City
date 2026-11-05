import {Component,OnDestroy,OnInit,computed,signal} from '@angular/core';
import {SceneComponent,SceneKind} from './scene';
import {Action,ApiError,City,DemoApi,Role,State,Street,scenarioLabel} from './model';
@Component({selector:'vsk-app',standalone:true,imports:[SceneComponent],templateUrl:'./app.html'})
export class AppComponent implements OnInit,OnDestroy {
 state=signal<State|null>(null);loading=signal(true);busy=signal(false);error=signal('');scene=signal<SceneKind>('street');cityId=signal('');streetId=signal('');query=signal('');agentId=signal('TEST-AGENT-001-044');role=signal<Role>('agent');
 private api=new DemoApi();private timer?:ReturnType<typeof setTimeout>;private abort?:AbortController;private epoch=0;private stopped=false;
 pending=signal<{type:Action;requestId:string}|null>(null);
 cities=computed(()=>this.state()?.cities??[]);city=computed(()=>this.cities().find(c=>c.id===this.cityId()));street=computed(()=>this.city()?.streets.find(s=>s.id===this.streetId()));
 filteredCities=computed(()=>this.cities().filter(c=>c.name.toLocaleLowerCase('ru').includes(this.query().toLocaleLowerCase('ru'))));
 personas=computed(()=>{const city=this.cities().find(c=>c.id===this.state()?.viewer.cityId);return city?.streets??[];});
 title=computed(()=>this.scene()==='country'?'Одна страна. Много историй.':this.scene()==='city'?this.city()?.name??'Город':this.street()?.name??'');
 scenarioLabel=scenarioLabel;
 ngOnInit(){void this.load(true);}ngOnDestroy(){this.stopped=true;this.epoch++;clearTimeout(this.timer);this.abort?.abort();}
 private schedule(){clearTimeout(this.timer);if(!this.stopped)this.timer=setTimeout(()=>{if(!document.hidden&&!this.busy()&&!this.pending())void this.load(false);else this.schedule();},6500);}
 async load(identity=false){const epoch=++this.epoch;this.abort?.abort();this.abort=new AbortController();if(identity)this.loading.set(true);try{const state=await this.api.state(this.agentId(),this.role(),this.abort.signal);if(epoch!==this.epoch)return;const old=this.state();if(old&&old.version===state.version&&!identity)state.cities=old.cities;this.state.set(state);this.error.set('');if(identity){this.cityId.set(state.viewer.cityId);this.streetId.set(state.viewer.streetId);this.scene.set(this.role()==='agent'?'street':'city');}}catch(e){if(epoch===this.epoch&&!(e instanceof DOMException&&e.name==='AbortError'))this.error.set(e instanceof Error?e.message:'Не удалось загрузить мир.');}finally{if(epoch===this.epoch){this.loading.set(false);this.schedule();}}}
 choosePersona(id:string){if(this.busy()||this.pending())return;this.agentId.set(id);this.state.set(null);void this.load(true);}
 chooseRole(role:string){if(this.busy()||this.pending())return;this.role.set(role==='director'?'director':'agent');this.state.set(null);void this.load(true);}
 openCity(c:City){this.cityId.set(c.id);this.scene.set('city');}openStreet(s:Street){this.streetId.set(s.id);this.scene.set('street');}
 myStreet(){const s=this.state();if(!s||this.role()==='director')return;this.cityId.set(s.viewer.cityId);this.streetId.set(s.viewer.streetId);this.scene.set('street');}
 async act(type:Action,retry=false){if(this.busy()||this.role()!=='agent'||(!retry&&this.pending()))return;if(type==='reset'&&!retry&&!confirm('Начать тестовый мир заново? Изменения всех демо-персон будут сброшены.'))return;const action=retry?this.pending():{type,requestId:crypto.randomUUID()};if(!action)return;this.pending.set(action);this.busy.set(true);this.error.set('');clearTimeout(this.timer);this.abort?.abort();this.epoch++;
 try{const state=await this.api.action(this.agentId(),this.role(),action.type,action.requestId);this.state.set(state);this.pending.set(null);}catch(e){this.error.set(e instanceof Error?e.message:'Действие не выполнено.');if(!(e instanceof ApiError)||!e.uncertain)this.pending.set(null);}finally{this.busy.set(false);this.schedule();}}
 retry(){const p=this.pending();if(p)void this.act(p.type,true);else void this.load(!this.state());}
 deadline(date:string|null){if(!date)return'Срок уточняется сервером';return 'Снос после '+new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(date))+' МСК';}
 demoTime(){const now=this.state()?.now;return now?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(now))+' МСК':'';}
}
