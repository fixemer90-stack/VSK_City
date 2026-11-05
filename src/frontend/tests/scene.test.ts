import '@angular/compiler';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneComponent} from '../app/scene.ts';

function fixture(){
 const scene=new SceneComponent();const internal=scene as any;
 const captures:number[]=[],releases:number[]=[];const held=new Set<number>();
 const host={setPointerCapture(id:number){captures.push(id);held.add(id);},hasPointerCapture(id:number){return held.has(id);},releasePointerCapture(id:number){releases.push(id);held.delete(id);}};
 scene.surface={nativeElement:host} as any;
 const event=(overrides:Record<string,unknown>={})=>({pointerId:7,isPrimary:true,button:0,buttons:1,clientX:10,clientY:20,currentTarget:host,...overrides});
 return {scene,internal,captures,releases,event};
}

test('SceneComponent captures the Pixi canvas, not its parent, so native pointertap keeps its target',()=>{
 const {internal,captures,event}=fixture();
 const canvasCaptures:number[]=[],canvasReleases:number[]=[];const held=new Set<number>();
 const canvas={setPointerCapture(id:number){canvasCaptures.push(id);held.add(id);},hasPointerCapture(id:number){return held.has(id);},releasePointerCapture(id:number){canvasReleases.push(id);held.delete(id);}};
 internal.app={canvas};
 internal.down(event({target:canvas}));
 assert.deepEqual(canvasCaptures,[7],'capture must not retarget Pixi pointerup to the parent');
 assert.deepEqual(captures,[]);
 internal.up(event({target:canvas}));
 assert.deepEqual(canvasReleases,[7]);
});

test('SceneComponent stops return movement with buttons=0 and releases captured pointer',()=>{
 const {internal,captures,releases,event}=fixture();
 internal.down(event());internal.move(event({clientX:30,clientY:40}));
 assert.equal(internal.root.x,20);assert.equal(internal.root.y,20);
 internal.move(event({buttons:0,clientX:100,clientY:100}));
 assert.equal(internal.root.x,20,'release outside must not pan on return');
 internal.move(event({clientX:120,clientY:120}));
 assert.equal(internal.root.x,20,'drag must stay stopped');
 assert.deepEqual(captures,[7]);assert.deepEqual(releases,[7]);
});

test('SceneComponent captures only primary left pointer and ignores other pointer movement/up',()=>{
 const {internal,captures,releases,event}=fixture();
 internal.down(event({button:2,buttons:2}));internal.move(event({clientX:30}));
 assert.equal(internal.root.x,0);assert.deepEqual(captures,[]);
 internal.down(event({isPrimary:false}));assert.deepEqual(captures,[]);
 internal.down(event());internal.down(event({pointerId:8}));
 internal.move(event({pointerId:8,clientX:70}));internal.up(event({pointerId:8}));
 internal.move(event({clientX:30}));assert.equal(internal.root.x,20);
 internal.up(event());internal.move(event({clientX:60}));assert.equal(internal.root.x,20);
 assert.deepEqual(captures,[7]);assert.deepEqual(releases,[7]);
});

test('SceneComponent pointercancel and lostpointercapture stop the active drag',()=>{
 for(const type of ['pointercancel','lostpointercapture']){
  const {internal,releases,event}=fixture();internal.down(event());internal.up(event({type}));
  internal.move(event({clientX:80}));assert.equal(internal.root.x,0);assert.deepEqual(releases,[7]);
 }
});
