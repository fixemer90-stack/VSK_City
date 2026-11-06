import {GEO_RINGS,CITY_COORDINATES} from './country-data';
export interface MapPoint {x:number;y:number}
const rad=Math.PI/180;
const p1=50*rad,p2=70*rad;
const n=Math.log(Math.cos(p1)/Math.cos(p2))/Math.log(Math.tan(Math.PI/4+p2/2)/Math.tan(Math.PI/4+p1/2));
const F=Math.cos(p1)*Math.pow(Math.tan(Math.PI/4+p1/2),n)/n;
function conic(lon:number,lat:number):MapPoint {
 const longitude=lon<0?lon+360:lon;
 const rho=F/Math.pow(Math.tan(Math.PI/4+lat*rad/2),n),theta=n*(longitude-100)*rad;
 return {x:rho*Math.sin(theta),y:rho*Math.cos(theta)};
}
const raw=GEO_RINGS.map(ring=>ring.map(([lon,lat])=>conic(lon,lat)));
const points=raw.flat(),minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
const scale=1100/(Math.max(...points.map(p=>p.x))-minX);
export function projectGeo(lon:number,lat:number):MapPoint {
 const p=conic(lon,lat);return {x:(p.x-minX)*scale,y:(p.y-minY)*scale};
}
export const COUNTRY_RINGS:readonly (readonly number[])[]=raw.map(ring=>ring.flatMap(p=>[(p.x-minX)*scale,(p.y-minY)*scale]));
export const COUNTRY_BOUNDS={x:0,y:0,width:1100,height:(Math.max(...points.map(p=>p.y))-minY)*scale};
export function cityPoint(name:string):MapPoint|undefined {
 const coord=CITY_COORDINATES[name];return coord?projectGeo(...coord):undefined;
}
export const LABEL_CITIES=new Set(['Москва','Санкт-Петербург','Калининград','Мурманск','Казань','Екатеринбург','Новосибирск','Владивосток']);
