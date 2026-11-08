export interface StreetPoint {x:number;y:number}
const RUN_LENGTH=610,LEFT=-50,ROW_GAP=360,RADIUS=ROW_GAP/2;

// Index alone fixes the address; filling a vacancy or extending the street never reflows it.
export function streetLotPosition(index:number):StreetPoint {
 const row=Math.floor(index/8),station=Math.floor((index%8)/2);
 const x=(row%2===0?station:3-station)*140;
 const wave=10*Math.sin(Math.PI*(x+39-LEFT)/RUN_LENGTH)**2;
 return {x,y:130+row*ROW_GAP+wave+(index%2===0?-125:50)};
}

// A prefix of one open promenade. No per-row roads or count-dependent reflow.
export function streetLayout(maxLot:number):{road:StreetPoint[]} {
 const runs=Math.max(2,Math.floor(maxLot/8)+1),road:StreetPoint[]=[];
 for(let row=0;row<runs;row++){
  const forward=row%2===0,base=130+row*ROW_GAP;
  for(let step=0;step<=32;step++){
   if(row>0&&step===0)continue;
   const t=step/32,x=LEFT+RUN_LENGTH*(forward?t:1-t);
   road.push({x,y:base+10*Math.sin(Math.PI*t)**2});
  }
  if(row<runs-1){
   const edge=forward?LEFT+RUN_LENGTH:LEFT;
   // Sample a semicircle with a horizontal tangent at each end.
   for(let step=1;step<=36;step++){
    const angle=Math.PI*step/36;
    road.push({x:edge+(forward?1:-1)*RADIUS*Math.sin(angle),y:base+RADIUS*(1-Math.cos(angle))});
   }
  }
 }
 return {road};
}
