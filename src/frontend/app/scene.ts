import {AfterViewInit,Component,ElementRef,EventEmitter,Input,OnChanges,OnDestroy,Output,ViewChild,signal} from '@angular/core';
import {Application,Container,Graphics,Text,Rectangle,Circle,Sprite} from 'pixi.js';
import {City,Street,House,lotPosition,cityBlockPosition} from './model';
import {COUNTRY_RINGS,cityPoint,LABEL_CITIES} from './country-geometry';
import {landmarkKind,landmarkName} from './city-landmarks';
import {SpritePack,SpriteId,houseSpriteId,parkingSpriteId,loadSpritePack} from './sprite-pack';
export type SceneKind='country'|'city'|'street';
@Component({selector:'vsk-scene',standalone:true,styles:[`.graphics-loading{position:absolute;inset:0;display:grid;place-items:center;background:#f5f4ebcc;color:#698172;font-size:14px;pointer-events:none}.landmark-caption{position:absolute;top:64px;left:26px;z-index:2;pointer-events:none;padding:9px 14px;border:1px solid #dce1d7;border-radius:8px;background:rgba(248,247,240,.94);color:#456274;font-size:13px;font-weight:600;box-shadow:0 4px 15px #28463808}`],template:`<div #surface class="pixi-surface" data-testid="scene-surface" [attr.data-ready]="ready()" role="img" [attr.aria-label]="description" tabindex="0" (keydown)="keyboard($event)"></div><div class="scene-tools" aria-label="Управление видом"><button (click)="zoom(1.2)" aria-label="Приблизить">＋</button><button (click)="zoom(1/1.2)" aria-label="Отдалить">−</button><button (click)="fit()" aria-label="Показать всю сцену">↗</button></div>@if(kind==='city'){<div class="landmark-caption" data-testid="landmark-caption">{{centerName}}</div>}@if(!ready()&&!error()){<div class="graphics-loading" role="status">Загружаем рисунки города…</div>}@if(error()){<div class="render-error" role="alert">{{error()}} <button (click)="initialize()">Повторить</button></div>}`})
export class SceneComponent implements AfterViewInit,OnChanges,OnDestroy {
 @ViewChild('surface',{static:true}) surface!:ElementRef<HTMLDivElement>;
 @Input() kind:SceneKind='street';@Input() cities:City[]=[];@Input() city?:City;@Input() street?:Street;
 @Output() citySelect=new EventEmitter<City>();@Output() streetSelect=new EventEmitter<Street>();
 ready=signal(false);error=signal('');private app?:Application;private root=new Container();private observer?:ResizeObserver;private dead=false;private dragging=false;private pointerId:number|null=null;private captureTarget?:Element;private moved=false;private last={x:0,y:0};private key='';private initing=false;
 get centerName(){return landmarkName(this.city);}
 private pack?:SpritePack;private houseSprites:Record<string,string>={};
 get description(){return this.kind==='country'?'Карта России на географической основе. Выбор городов доступен в списке.':this.kind==='city'?`${this.city?.name??'Город'}. Постоянный центр: ${this.centerName}. Улицы доступны на карте и в списке.`:'Изометрическая застройка. Стрелки — перемещение, плюс и минус — масштаб. Доступный список объектов находится рядом.';}
 ngAfterViewInit(){void this.initialize();}ngOnChanges(){this.draw();}ngOnDestroy(){this.dead=true;this.observer?.disconnect();this.app?.destroy(true,{children:true});}
 async initialize(){if(this.initing||this.app||this.dead)return;this.initing=true;this.error.set('');const app=new Application();try{this.pack=await loadSpritePack();if(this.dead)return;await app.init({preference:'webgl',backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false,width:this.surface.nativeElement.clientWidth,height:this.surface.nativeElement.clientHeight});if(this.dead){app.destroy(true,{children:true});return;}this.app=app;this.surface.nativeElement.append(app.canvas);app.stage.addChild(this.root);this.observer=new ResizeObserver(()=>{app.renderer.resize(this.surface.nativeElement.clientWidth,this.surface.nativeElement.clientHeight);this.fit();});this.observer.observe(this.surface.nativeElement);const host=this.surface.nativeElement;host.addEventListener('pointerdown',this.down);host.addEventListener('pointermove',this.move);host.addEventListener('pointerup',this.up);host.addEventListener('pointercancel',this.up);host.addEventListener('lostpointercapture',this.up);host.addEventListener('wheel',this.wheel,{passive:false});this.draw();}catch(e){this.error.set('Графика недоступна. Попробуйте включить WebGL или повторите загрузку. Списки навигации остаются доступны.');console.error(e);}finally{this.initing=false;}}
 private down=(e:PointerEvent)=>{if(!e.isPrimary||e.button!==0||this.pointerId!==null)return;const target=this.app?.canvas??this.surface.nativeElement;target.setPointerCapture(e.pointerId);this.captureTarget=target;this.pointerId=e.pointerId;this.dragging=true;this.moved=false;this.last={x:e.clientX,y:e.clientY};};
 private move=(e:PointerEvent)=>{if(!this.dragging||e.pointerId!==this.pointerId)return;if((e.buttons&1)===0){this.up(e);return;}const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;if(Math.abs(dx)+Math.abs(dy)>2)this.moved=true;this.root.x+=dx;this.root.y+=dy;this.last={x:e.clientX,y:e.clientY};this.render();};
 private up=(e:PointerEvent)=>{if(e.pointerId!==this.pointerId)return;const id=this.pointerId;this.pointerId=null;this.dragging=false;const target=this.captureTarget;this.captureTarget=undefined;if(target?.hasPointerCapture(id))target.releasePointerCapture(id);};private wheel=(e:WheelEvent)=>{e.preventDefault();this.zoom(e.deltaY<0?1.1:1/1.1);};
 keyboard(e:KeyboardEvent){const dirs:Record<string,[number,number]>={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]};if(dirs[e.key]){e.preventDefault();this.root.x+=dirs[e.key][0];this.root.y+=dirs[e.key][1];this.render();}else if(e.key==='+'||e.key==='=')this.zoom(1.2);else if(e.key==='-')this.zoom(1/1.2);else if(e.key==='Home')this.fit();}
 zoom(factor:number){if(!this.app)return;const old=this.root.scale.x,next=Math.max(.15,Math.min(5,old*factor)),cx=this.app.screen.width/2,cy=this.app.screen.height/2;this.root.position.set(cx-(cx-this.root.x)*next/old,cy-(cy-this.root.y)*next/old);this.root.scale.set(next);this.render();}
 fit(){if(!this.app||!this.root.children.length)return;const b=this.root.getLocalBounds();const w=this.app.screen.width,h=this.app.screen.height;const s=Math.min((w-100)/b.width,(h-100)/b.height,1.65);this.root.scale.set(s);this.root.position.set(w/2-(b.x+b.width/2)*s,h/2-(b.y+b.height/2)*s);this.render();}
 private countryMarkers:{id:string;x:number;y:number;label:Text}[]=[];
 private render(){
  this.app?.render();
  const host=this.surface?.nativeElement;
  if(host?.dataset){if(this.kind==='city')host.dataset['landmark']=landmarkKind(this.city);else delete host.dataset['landmark'];}
  if(host?.dataset){
   host.dataset['spriteAssets']=String(this.pack?.manifest.entries.length??0);
   const counts:Record<string,number>={};
   const visit=(container:Container)=>{for(const child of container.children){if(child instanceof Sprite)counts[child.label]=(counts[child.label]??0)+1;else if(child instanceof Container)visit(child);}};
   visit(this.root);host.dataset['spriteInstances']=JSON.stringify(counts);host.dataset['houseSprites']=JSON.stringify(this.houseSprites);
  }
  if(host?.dataset)host.dataset['countryMarkers']=this.kind==='country'?JSON.stringify(this.countryMarkers.map(m=>{
   const b=m.label.visible?m.label.getBounds():undefined;
   return {id:m.id,x:this.root.x+m.x*this.root.scale.x,y:this.root.y+m.y*this.root.scale.y,label:b?{x:b.x,y:b.y,width:b.width,height:b.height}:undefined};
  })):'[]';
 }
 private poly(g:Graphics,p:number[],color:number,alpha=1){g.poly(p).fill({color,alpha});}
 private iso(x:number,y:number,z=0){return{x:x-y,y:(x+y)*.48-z};}
 private tile(g:Graphics,x:number,y:number,w:number,d:number,color:number){const a=this.iso(x,y),b=this.iso(x+w,y),c=this.iso(x+w,y+d),e=this.iso(x,y+d);this.poly(g,[a.x,a.y,b.x,b.y,c.x,c.y,e.x,e.y],color);}
 private tree(g:Graphics,x:number,y:number){const p=this.iso(x,y);this.pack!.place(g.parent??this.root,Math.round(x+y)%3===0?'tree-conifer':'tree-broadleaf',p.x,p.y);}
 private shrub(g:Graphics,x:number,y:number){const p=this.iso(x,y);this.pack!.place(g.parent??this.root,'shrub',p.x,p.y);}
 private building(g:Graphics,x:number,y:number,tier:number,identity:string,pending=false,scale=1){
  const p=this.iso(x+22*scale,y+22*scale);const sprite=this.pack!.place(g.parent??this.root,houseSpriteId(tier,identity),p.x,p.y,scale);this.houseSprites[identity]=sprite.label;
  if(pending){sprite.tint=0xc7b394;const badge=this.iso(x,y+37*scale+8),flag=new Graphics();flag.roundRect(badge.x-23,badge.y-8,72,18,4).fill(0xe5bf71);const label=new Text({text:'Под снос',style:{fontFamily:'Manrope Variable, sans-serif',fontSize:10,fontWeight:'600',fill:0x59451f}});label.position.set(badge.x-18,badge.y-6);(g.parent??this.root).addChild(flag,label);}
 }
 private parking(g:Graphics,x:number,y:number,spaces:number){const id=parkingSpriteId(spaces);if(id){const p=this.iso(x+32.5,y+32.5);this.pack!.place(g.parent??this.root,id,p.x,p.y);}}
 private landmark(g:Graphics,x:number,y:number){const p=this.iso(x+45,y+45);this.pack!.place(g.parent??this.root,'center-generic',p.x,p.y,.6);}
 private draw(){if(!this.app)return;this.ready.set(false);const key=this.kind+this.city?.id+this.street?.id;const changed=key!==this.key;this.key=key;this.houseSprites={};this.root.removeChildren().forEach(c=>c.destroy({children:true}));if(this.kind==='country')this.country();else if(this.kind==='city'&&this.city)this.cityScene(this.city);else if(this.street)this.streetScene(this.street);if(changed)this.fit();else this.render();this.ready.set(true);}
 private country(){
  this.countryMarkers=[];
  const shadow=new Graphics(),land=new Graphics();
  shadow.position.set(2,5);this.root.addChild(shadow,land);
  for(const ring of COUNTRY_RINGS){
   shadow.poly([...ring]).fill({color:0x78988d,alpha:.13});
   land.poly([...ring]).fill(0xdce3d4).stroke({color:0xb4c6b4,width:1.1});
  }
  const sea=new Text({text:'С Е В Е Р Н Ы Й   Л Е Д О В И Т Ы Й   О К Е А Н',style:{fontSize:12,fill:0x92a3a2,fontFamily:'Manrope Variable, sans-serif'}});
  sea.position.set(385,-30);this.root.addChild(sea);
  const labels:{x:number;y:number;w:number;h:number}[]=[];
  const markerLayer=new Container();
  for(const c of this.cities){
   const point=cityPoint(c.name);if(!point)continue;
   const {x,y}=point,major=LABEL_CITIES.has(c.name);
   const mark=new Graphics().circle(x,y,major?11:6).fill({color:0x326c9b,alpha:.09}).circle(x,y,major?4.5:2.6).fill(0x236a9d);
   const distances=this.cities.filter(other=>other.id!==c.id).map(other=>cityPoint(other.name)).filter(p=>p!==undefined).map(p=>Math.hypot(p.x-x,p.y-y));
   mark.hitArea=new Circle(x,y,Math.min(7,...distances.map(distance=>distance*.49)));mark.eventMode='static';mark.cursor='pointer';
   const text=new Text({text:c.name,style:{fontSize:major?15:14,fontWeight:major?'600':'500',fill:0x304b59,fontFamily:'Manrope Variable, sans-serif'}});
   const w=text.width+8,h=23;let pos={x:x+12,y:y-10,w,h};
   for(const [dx,dy] of [[12,-10],[-w-12,-10],[12,-29],[-w-12,15],[12,15],[-w-12,-29]]){
    const candidate={x:x+dx,y:y+dy,w,h};
    if(!labels.some(r=>candidate.x<r.x+r.w&&candidate.x+w>r.x&&candidate.y<r.y+r.h&&candidate.y+h>r.y)){pos=candidate;break;}
   }
   if(major)labels.push(pos);
   text.position.set(pos.x,pos.y);text.visible=major;text.eventMode='static';text.cursor='pointer';
   const select=()=>{if(!this.moved)this.citySelect.emit(c);};
   mark.on('pointertap',select);text.on('pointertap',select);
   mark.on('pointerover',()=>{text.visible=true;this.render();});
   mark.on('pointerout',()=>{text.visible=major;this.render();});
   markerLayer.addChild(mark);this.root.addChild(text);this.countryMarkers.push({id:c.id,x,y,label:text});
  }
  // Keep exact geographic centers clickable even where a label crosses another marker.
  this.root.addChild(markerLayer);
 }
 private cityScene(city:City){const ground=new Graphics();this.root.addChild(ground);this.tile(ground,-65,-65,1020,910,0xe0e2d4);this.tile(ground,-42,-42,974,864,0xf1eee3);this.tile(ground,-42,365,974,55,0xa8c4c3);this.tile(ground,410,-42,45,864,0xc4c7bb);
  city.streets.forEach((s,i)=>{
   const {x,y}=cityBlockPosition(i),cluster=new Container(),g=new Graphics();cluster.addChild(g);
   this.pack!.ground(cluster,'grass',x,y,100,105);this.pack!.ground(cluster,'road-straight',x,y+85,109,16);
   s.houses.slice(0,5).forEach((h,j)=>this.building(g,x+8+(j%3)*29,y+12+Math.floor(j/3)*32,h.tier,h.id,h.status==='pending_demolition',.49));
   s.parking.slice(0,1).forEach(p=>{const id=parkingSpriteId(p.spaces);if(id){const spot=this.iso(x+78,y+59);this.pack!.place(cluster,id,spot.x,spot.y,.4);}});
   this.tree(g,x+92,y+16);cluster.eventMode='static';cluster.cursor='pointer';
   const a=this.iso(x,y),b=this.iso(x+105,y+105);cluster.hitArea=new Rectangle(a.x-108,a.y-95,215,b.y-a.y+100);
   cluster.on('pointertap',()=>{if(!this.moved)this.streetSelect.emit(s);});this.root.addChild(cluster);
   if(s.name){const p=this.iso(x,y+103);const label=new Text({text:s.name,style:{fontSize:8,fill:0x36526a,fontFamily:'sans-serif'}});label.position.set(p.x,p.y+3);this.root.addChild(label);}
  });
  const center=this.iso(485,505);this.pack!.place(this.root,`center-${landmarkKind(city)}` as SpriteId,center.x,center.y);
 }
 private streetScene(street:Street){const g=new Graphics();this.root.addChild(g);const max=Math.max(11,...street.houses.map(h=>h.lotIndex),...street.parking.map(p=>p.lotIndex)),rows=Math.floor(max/6)+1;
 this.tile(g,-70,-85,790,rows*126+180,0xdde1d2);this.tile(g,-50,-65,750,rows*126+140,0xece9dc);
 const terrain=new Container();this.root.addChild(terrain);
 for(let row=0;row<rows;row++)for(let xx=-50;xx<700;xx+=88){
  const width=Math.min(88,700-xx);
  this.pack!.ground(terrain,xx===302?'road-crossing':'road-straight',xx,row*126+83,width,32);
  this.pack!.ground(terrain,'sidewalk',xx,row*126+79,width,4);
  this.pack!.ground(terrain,'sidewalk',xx,row*126+115,width,5);
 }
 const occupied=new Set([...street.houses,...street.parking].map(h=>h.lotIndex));
 for(let i=0;i<=max;i++){
  const p=lotPosition(i);this.pack!.ground(terrain,occupied.has(i)?'grass':'vacant-lot',p.x-5,p.y-5,88,80);
  if(!occupied.has(i))this.tree(g,p.x+55,p.y+24);
  this.tree(g,p.x+81,p.y+73);this.shrub(g,p.x+66,p.y+70);
 }
 this.landmark(g,690,30);const items=[...street.houses.map(h=>({lot:h.lotIndex,house:h})),...street.parking.map(p=>({lot:p.lotIndex,park:p}))].sort((a,b)=>{const x=lotPosition(a.lot),y=lotPosition(b.lot);return x.x+x.y-y.x-y.y;});for(const item of items){const p=lotPosition(item.lot);if('house'in item)this.building(g,p.x+12,p.y+10,item.house!.tier,item.house!.id,item.house!.status==='pending_demolition');else this.parking(g,p.x+5,p.y+3,item.park!.spaces);}
 }
}
