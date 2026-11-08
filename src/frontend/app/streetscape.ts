export type FurnitureKind='lamp'|'bench'|'bin'|'flowerbed'|'tree';
export interface StreetProp {id:string;kind:FurnitureKind;x:number;y:number}
export interface PocketPark {id:string;x:number;y:number;w:number;d:number}
// Geometry only: no sales, XP, owner name or random seed. Each completed row adds a prefix.
export function streetScape(maxLot:number):{props:StreetProp[];parks:PocketPark[]}{
 const rows=Math.max(2,Math.floor(maxLot/8)+1),props:StreetProp[]=[],parks:PocketPark[]=[];
 for(let row=0;row<rows;row++){
  const base=130+row*360;
  for(const x of [95,305,515])for(const side of [-1,1])props.push({id:`row-${row}-lamp-${x}-${side}`,kind:'lamp',x,y:base+10*Math.sin(Math.PI*(x+50)/610)**2+side*22});
  if(row===rows-1)continue;
  const y=base+180;
  const add=(kind:FurnitureKind,x:number,dy=0)=>props.push({id:`row-${row}-${kind}-${x}`,kind,x,y:y+dy});
  add('bench',140,-20);add('bin',169,-20);add('flowerbed',335,20);add('flowerbed',390,20);
  parks.push({id:`park-${row}`,x:260,y,w:370,d:68});
  if(row>0){
   add('bench',300,15);add('tree',95,-12);add('tree',435,-10);
  }
 }
 return {props,parks};
}
