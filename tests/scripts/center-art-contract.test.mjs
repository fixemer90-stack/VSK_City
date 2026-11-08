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

test('Vladivostok inlet opens into the city river without a stone line or color seam across the water',async()=>{
 const svg=await readFile(new URL('src/frontend/public/sprites/source/center-vladivostok.svg',root),'utf8');
 assert.match(svg,/id="river-continuity"/);
 assert.match(svg,/M20 350 115 395\.6 M225 448\.4 320 494 620 350/);
 assert.match(svg,/M24 349 320 210 415 251\.6 M525 304\.4 616 349/);
 assert.match(svg,/<polygon[^>]+fill="url\(#river-continuity\)"/);
 assert.doesNotMatch(svg,/d="M20 350 320 494 620 350"/);
 assert.doesNotMatch(svg,/d="M21 350 320 493 619 350"|d="M29 350 320 489 611 350"/,'late landscape highlights must also leave the inlet open');
});
