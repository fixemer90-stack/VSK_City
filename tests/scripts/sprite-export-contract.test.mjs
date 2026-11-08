import test from 'node:test';
import './center-art-contract.test.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
const floors=[1,3,4,5,6,9,12,14,17,25];
const houseSources=[
 ['IC_L01_A.svg','IC_L01_B.svg'],['IC_L03_A.svg','IC_L03_B.svg'],
 ['IC_L04_A.svg','IC_L04_B.svg'],['IC_L05_A_II05.svg','IC_L05_B_Brick.svg'],
 ['IC_L06_A.svg','IC_L06_B.svg'],['IC_L09_A.svg','IC_L09_B.svg'],
 ['IC_L12_A_P42_P43.svg','IC_L12_B_P44M.svg'],['IC_L14_A_P55.svg','IC_L14_B_Erker.svg'],
 ['IC_L17_A_Section.svg','IC_L17_B_KOPE.svg'],['IC_L25_A_KOPE_Tower.svg','IC_L25_B_Stalin_Skyscraper.svg'],
];
const houseIds=floors.flatMap((_,i)=>['a','b'].map(v=>`house-${String(i+1).padStart(2,'0')}-${v}`));
const nonHouse=['parking-01','parking-02','parking-03','parking-04','center-moscow','center-vladivostok','center-generic','tree-broadleaf','tree-conifer','shrub','grass','vacant-lot','road-straight','road-crossing','sidewalk'];
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
test('parking sources use the four current native raster wrappers and calibrated lot placement',async()=>{
 const spec=await json('scripts/sprite-spec.json');
 const parking=spec.filter(e=>e.group==='parking');assert.equal(parking.length,4);
 for(const item of parking){
  assert.equal(item.sourceFile,`parking/${item.id}.svg`);
  const svg=await readFile(new URL(`src/frontend/public/sprites/source/${item.sourceFile}`,root),'utf8');
  const [width,height]=item.id==='parking-01'?[1672,941]:[1680,1030];
  assert.match(svg,new RegExp(`viewBox="0 0 ${width} ${height}"`));assert.match(svg,/<image\b/);
  assert.equal(item.width,width);assert.equal(item.height,height);assert.equal(item.pixelRatio,1);
  assert.ok(item.anchorX>0&&item.anchorX<width);assert.ok(item.anchorY>0&&item.anchorY<height);
  assert.ok(item.worldPerSourcePixel>=0.07&&item.worldPerSourcePixel<=0.15);
 }
});
test('exports exact 35 IDs with all 20 literal sources, native raster resolution and source identity',async()=>{
 const spec=await json('scripts/sprite-spec.json');
 assert.deepEqual(spec.map(e=>e.id).sort(),[...houseIds,...nonHouse].sort());
 for(const [i,sources] of houseSources.entries())for(const [variantIndex,variant] of ['a','b'].entries()){
  const item=spec.find(e=>e.id===`house-${String(i+1).padStart(2,'0')}-${variant}`);
  assert.equal(item.sourceFile,`house/${sources[variantIndex]}`);
  const original=await readFile(new URL(`src/frontend/public/sprites/source/${item.sourceFile}`,root),'utf8');
  assert.equal(item.pixelRatio,/<image\b/.test(original)?1:2);
 }
 console.log(execFileSync(process.execPath,['scripts/export-sprites.mjs'],{cwd:root,encoding:'utf8'}));
 const manifest=await json('src/frontend/public/sprites/manifest.json');
 assert.deepEqual(manifest.entries.map(e=>e.id).sort(),[...houseIds,...nonHouse].sort());
 for(const entry of manifest.entries){
  const png=await readFile(new URL(`src/frontend/public/sprites/${entry.file.split('?')[0]}`,root));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),entry.width);assert.equal(png.readUInt32BE(20),entry.height);
  assert.equal(createHash('sha256').update(png).digest('hex'),entry.sha256);
  const source=await readFile(new URL(`src/frontend/public/sprites/source/${entry.sourceFile}`,root));
  assert.equal(createHash('sha256').update(source).digest('hex'),entry.sourceSha256);
  assert.ok(entry.anchorX>=0&&entry.anchorX<=1&&entry.anchorY>=0&&entry.anchorY<=1);
  const item=spec.find(e=>e.id===entry.id);
  assert.equal(entry.worldScale,item.worldPerSourcePixel/entry.pixelRatio);
  if(entry.group==='houses'){
   assert.ok(entry.width*entry.worldScale>=89&&entry.width*entry.worldScale<=126);
   assert.equal(entry.pixelRatio,/<image\b/.test(source.toString())?1:2);
   assert.equal(/<(?:script|foreignObject)\b/.test(source.toString()),false);
  }
 }
 const catalog=await readFile(new URL('src/frontend/public/sprites/catalog.html',root),'utf8');
 assert.equal((catalog.match(/<figure data-sprite=/g)||[]).length,35);
 assert.match(catalog,/35 отдельных спрайтов/);
});
