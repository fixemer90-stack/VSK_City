import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from '../tests/pitch-browser/node_modules/playwright-core/index.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'src/frontend/public/sprites');
const spec=JSON.parse(await readFile(path.join(root,'scripts/sprite-spec.json'),'utf8'));
const expectedCount=35;
if(spec.length!==expectedCount||new Set(spec.map(e=>e.id)).size!==expectedCount)throw new Error('Expected exactly 35 source sprites');
const approved={houses:Array.from({length:10},(_,i)=>['a','b'].map(variant=>`house-${String(i+1).padStart(2,'0')}-${variant}`)).flat(),parking:Array.from({length:4},(_,i)=>`parking-0${i+1}`),centers:['center-moscow','center-vladivostok','center-generic'],environment:['tree-broadleaf','tree-conifer','shrub','grass','vacant-lot','road-straight','road-crossing','sidewalk']};
for(const [group,ids] of Object.entries(approved)){
 const actual=spec.filter(entry=>entry.group===group).map(entry=>entry.id);
 if(actual.length!==ids.length||ids.some(id=>!actual.includes(id)))throw new Error('Incorrect sprite IDs/groups: '+group);
}
const defaultRatio=2;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const entries=[],output=[];
try{
 const page=await browser.newPage();
 for(const item of spec){
  const sourceFile=item.sourceFile??item.id+'.svg';
  const sourceRoot=path.join(directory,'source'),sourcePath=path.resolve(sourceRoot,sourceFile),relative=path.relative(sourceRoot,sourcePath);
  if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)||!sourcePath.endsWith('.svg'))throw new Error('Source path must stay inside sprite source directory');
  const ratio=item.pixelRatio??defaultRatio;
  if(!Number.isInteger(ratio)||ratio<1||ratio>4)throw new Error('Invalid pixel ratio: '+item.id);
  const svg=await readFile(sourcePath,'utf8');
  const raster=await page.evaluate(async({svg,item,ratio})=>{
   const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
   if(doc.querySelector('parsererror,script,foreignObject')||doc.documentElement.localName!=='svg'||doc.documentElement.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('Invalid or non-local SVG: '+item.id);
   for(const el of doc.querySelectorAll('*'))for(const attr of el.attributes){
    if(attr.name.startsWith('on')||/url\(\s*['"]?(?:https?:|data:|\/\/)/i.test(attr.value))throw new Error('External SVG reference: '+item.id);
    if(attr.localName==='href'&&!attr.value.startsWith('#')){
     if(el.localName!=='image'||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(attr.value)||attr.value.length>16_000_000)throw new Error('Only embedded PNG images are allowed: '+item.id);
     const header=atob(attr.value.split(',')[1].slice(0,48));
     if(!header.startsWith('\x89PNG\r\n\x1a\n'))throw new Error('Invalid embedded PNG: '+item.id);
     const bytes=Uint8Array.from(header,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
     const width=view.getUint32(16),height=view.getUint32(20);
     if(width<1||height<1||width>4096||height>4096)throw new Error('Embedded PNG dimensions exceed limit: '+item.id);
    }
   }
   const box=doc.documentElement.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
   if(!box||box.length!==4||box[0]!==0||box[1]!==0||box[2]!==item.width||box[3]!==item.height)throw new Error('Incorrect SVG viewBox: '+item.id);
   const image=new Image();
   let binary='';const encoded=new TextEncoder().encode(svg);
   for(let i=0;i<encoded.length;i+=8192)binary+=String.fromCharCode(...encoded.subarray(i,i+8192));
   image.src='data:image/svg+xml;base64,'+btoa(binary);
   await image.decode();
   const canvas=document.createElement('canvas');canvas.width=item.width*ratio;canvas.height=item.height*ratio;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let left=canvas.width,top=canvas.height,right=-1,bottom=-1,opaque=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba[(y*canvas.width+x)*4+3]>1){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);opaque++;}
   if(right<0||opaque<100||opaque>canvas.width*canvas.height*.95)throw new Error('Empty/opaque background: '+item.id);
   left=Math.max(0,left-4);top=Math.max(0,top-4);right=Math.min(canvas.width-1,right+4);bottom=Math.min(canvas.height-1,bottom+4);
   const width=right-left+1,height=bottom-top+1;
   const anchorX=(item.anchorX*ratio-left)/width,anchorY=(item.anchorY*ratio-top)/height;
   if(anchorX<0||anchorX>1||anchorY<0||anchorY>1)throw new Error('Ground anchor outside trimmed sprite: '+item.id);
   const cropped=document.createElement('canvas');cropped.width=width;cropped.height=height;
   cropped.getContext('2d').drawImage(canvas,left,top,width,height,0,0,width,height);
   return {png:cropped.toDataURL('image/png').split(',')[1],width,height,anchorX,anchorY,sourceCrop:{left,top,width,height},paintedPixels:opaque};
  },{svg,item,ratio});
  const bytes=Buffer.from(raster.png,'base64');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const {png,...geometry}=raster;
  entries.push({id:item.id,title:item.title,group:item.group,sourceFile,file:item.id+'.png?v='+sha256.slice(0,12),...geometry,worldScale:item.worldPerSourcePixel/ratio,pixelRatio:ratio,sha256,sourceSha256:createHash('sha256').update(svg).digest('hex')});
  output.push({id:item.id,bytes});
 }
}finally{await browser.close();}
if(entries.length!==expectedCount)throw new Error('Incomplete pack');
await mkdir(directory,{recursive:true});
for(const file of output)await writeFile(path.join(directory,file.id+'.png'),file.bytes);
await writeFile(path.join(directory,'manifest.json'),JSON.stringify({version:1,entries},null,2)+'\n');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const groups={houses:'Архитектура',parking:'Парковки',centers:'Городские центры',environment:'Городская среда'};
const sections=Object.entries(groups).map(([group,title])=>`<section data-group="${group}"><h2>${title}<span>${entries.filter(e=>e.group===group).length} объектов</span></h2><div class="grid">${entries.filter(e=>e.group===group).map(e=>`<figure data-sprite="${e.id}"><div class="preview"><img src="${escape(e.file)}" width="${Math.round(e.width*(group==='houses'?e.worldScale*1.8:group==='centers'?.24:.3))}" ${group==='houses'?`style="position:absolute;max-width:none;width:${e.width*e.worldScale*1.8}px;left:calc(50% - ${e.width*e.worldScale*1.8*e.anchorX}px);top:${270-e.height*e.worldScale*1.8*e.anchorY}px"`:''} alt="${escape(e.title)}"></div><figcaption>${escape(e.title)}<small>${e.id}</small></figcaption></figure>`).join('')}</div></section>`).join('');
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Материалы города — ${expectedCount} спрайтов</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f2e9;color:#2d4650;font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:56px 40px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d4dbce;padding-bottom:30px}.eyebrow{font-size:11px;letter-spacing:3px;color:#778b7b}h1{font-size:42px;letter-spacing:-1.5px;margin:10px 0}header p{color:#7c887e;font-size:14px}header a{color:#356a82;text-decoration:none;border:1px solid #cbd5c9;border-radius:8px;padding:12px 18px}h2{font-size:21px;margin:44px 0 18px;display:flex;justify-content:space-between}h2 span{font-size:12px;font-weight:400;color:#8a9689}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}figure{margin:0;background:#fcfaf3;border:1px solid #e0e3d7;border-radius:12px;overflow:hidden}.preview{position:relative;height:340px;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:radial-gradient(ellipse at 50% 90%,#e5e9d9 0%,#f9f8f0 65%)}img{display:block;max-width:100%;height:auto}figcaption{padding:18px 20px;font-size:14px;font-weight:600;border-top:1px solid #edf0e4;background:#fffdf8}small{display:block;font-size:10px;font-weight:400;letter-spacing:1px;color:#95a090;margin-top:7px}section[data-group=parking] .preview,section[data-group=environment] .preview{height:230px}section[data-group=centers] .grid{grid-template-columns:repeat(3,minmax(0,1fr))}section[data-group=centers] .preview{height:300px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:28px 18px}header{display:block}header a{display:inline-block}h1{font-size:32px}}</style></head><body><main><header><div><div class="eyebrow">МОЙ ГОРОД / МАТЕРИАЛЫ АТЛАСА</div><h1>Архитектура в деталях</h1><p>${expectedCount} отдельных спрайтов · прозрачный фон · дома: исходный растр, единый масштаб показа 1,8×, общий якорь земли</p></div><a href="/">Открыть атлас ↗</a></header>${sections}</main></body></html>`;
await writeFile(path.join(directory,'catalog.html'),html+'\n');
console.log(JSON.stringify({sprites:entries.length,pngBytes:output.reduce((sum,f)=>sum+f.bytes.length,0),groups:Object.fromEntries(Object.keys(groups).map(g=>[g,entries.filter(e=>e.group===g).length])),directory},null,2));
