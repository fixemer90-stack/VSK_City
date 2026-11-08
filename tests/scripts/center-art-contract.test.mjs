import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const details={moscow:['cathedral-relief','tower-masonry','roof-metalwork'],vladivostok:['tidal-reflections','deck-structure','pylon-joints'],generic:['roof-metalwork','entablature-relief','fountain-stonework']};
for(const [kind,groups] of Object.entries(details))test(`${kind}: authored architectural relief, safe local vector art and unchanged ground calibration`,async()=>{
 const svg=await readFile(new URL(`src/frontend/public/sprites/source/center-${kind}.svg`,root),'utf8');
 const spec=JSON.parse(await readFile(new URL('scripts/sprite-spec.json',root),'utf8')).find(e=>e.id===`center-${kind}`);
 assert.deepEqual([spec.width,spec.height,spec.anchorX,spec.anchorY,spec.worldPerSourcePixel],[640,520,320,350,0.62]);
 assert.match(svg,/viewBox="0 0 640 520"/);
 for(const id of [...groups,'landscape-craft']){
  const group=svg.match(new RegExp(`<g[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/g>`));
  assert.ok(group,`missing authored ${id}`);
  assert.match(group[1],/<(?:path|polygon|ellipse|circle)\b/,'relief must contain actual vector geometry');
 }
 assert.doesNotMatch(svg,/<(?:script|foreignObject|filter|image|text)\b|\bon\w+=|(?:https?:\/\/|data:)(?!www\.w3\.org)/);
 for(const match of svg.matchAll(/(?:href|url)\s*(?:=|\()\s*["']?([^"'\s)>]+)/g)){
  assert.ok(match[1].startsWith('#'));
  assert.ok(svg.includes(`id="${match[1].slice(1)}"`),`unresolved local paint or symbol ${match[1]}`);
 }
});
