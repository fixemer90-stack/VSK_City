import type {Graphics} from 'pixi.js';

export type LandmarkKind = 'moscow' | 'vladivostok' | 'generic';
type LandmarkCity = {name: string} | undefined;
type Point = readonly [number, number, number?];

const palette = {
  ivory: 0xf3eddd, stone: 0xd9d7c7, sage: 0x92aa8c, leaf: 0x718f78,
  red: 0xb96e59, redShade: 0x955749, green: 0x557b70, gold: 0xd4b56b,
  blue: 0x80afc1, deepBlue: 0x587f95, ink: 0x435d68,
};

/** All ground coordinates stay inside [390,580] × [410,605] at (430,440).
 * Only elevation is subtracted after projection, exactly as in scene.iso. */
export function drawCityLandmark(g: Graphics, x: number, y: number, kind: LandmarkKind): void {
  const p = (a: number, b: number, z = 0) => ({x: x + a - y - b, y: (x + a + y + b) * .48 - z});
  const poly = (points: readonly Point[], color: number, alpha = 1) => {
    g.poly(points.flatMap(([a, b, z]) => {const q = p(a, b, z); return [q.x, q.y];})).fill({color, alpha});
  };
  const tile = (a: number, b: number, w: number, d: number, color: number, z = 0) =>
    poly([[a,b,z],[a+w,b,z],[a+w,b+d,z],[a,b+d,z]], color);
  const line = (points: readonly Point[], color: number, width = 1, alpha = 1) => {
    points.forEach(([a,b,z], i) => {const q = p(a,b,z); if (i === 0) g.moveTo(q.x,q.y); else g.lineTo(q.x,q.y);});
    g.stroke({color,width,alpha});
  };
  const box = (a: number, b: number, w: number, d: number, h: number, front: number, side: number, roof = palette.ivory, z = 0) => {
    poly([[a+w,b,z],[a+w,b+d,z],[a+w,b+d,z+h],[a+w,b,z+h]],side);
    poly([[a,b+d,z],[a+w,b+d,z],[a+w,b+d,z+h],[a,b+d,z+h]],front);
    tile(a,b,w,d,roof,z+h);
  };
  const tree = (a: number, b: number) => {
    const q = p(a,b);
    g.ellipse(q.x+4,q.y+2,10,4).fill({color:palette.ink,alpha:.08});
    line([[a,b],[a,b,14]],0x958572,2);
    g.ellipse(q.x,q.y-17,8,11).fill(palette.leaf);
    g.ellipse(q.x-3,q.y-20,5,7).fill(palette.sage);
  };
  const bench = (a: number, b: number) => {
    box(a,b,20,5,4,0x9c927a,0x817d70,0xc4b696);
    line([[a,b,7],[a+20,b,7]],0xb4a58a,2);
  };

  tile(-40,-30,190,195,palette.stone);
  tile(-35,-25,180,185,palette.ivory);
  // Fine paving joints retain the quiet ivory/sage language of the surrounding city.
  for (let a = -20; a < 145; a += 22) line([[a,-22],[a,158]],0xdedccc,.6);
  for (let b = -5; b < 160; b += 22) line([[-33,b],[143,b]],0xdedccc,.6);

  if (kind === 'vladivostok') {
    // A compact blue inlet, stone quays and a cable-stayed span (not a suspension arch).
    tile(8,-25,100,185,0x9bbdcc);
    tile(16,-25,84,185,palette.blue);
    tile(8,-25,6,185,0xc3c8bb);
    tile(102,-25,6,185,0xc3c8bb);
    for (let b = -5; b < 155; b += 21) {
      line([[24,b],[46,b]],0xd8e8e6,1,.65);
      line([[65,b+9],[91,b+9]],0xc5dcdf,1,.55);
    }
    tile(25,75,70,22,palette.deepBlue);
    // Rear pylon legs and their cable fans first, for clean depth ordering.
    for (const a of [25,90]) {
      box(a,55,5,5,61,0xc8c8b6,0xa9b5ac,palette.ivory);
      for (const end of [-23,-9,5,45,60,75,122,139]) {
        if (Math.abs(end-a) <= 52) line([[a+2,57,60],[end,57,17]],0xd5c89b,.85);
      }
    }
    box(-28,56,170,21,15,0x859694,0x697e81,0xc5c9bb);
    tile(-28,59,170,15,0x899a98,15);
    for (let a = -20; a < 138; a += 20) tile(a,66,10,1,0xe6dfc2,15.1);
    for (const a of [25,90]) {
      box(a,77,5,5,61,0xe2ddc9,0xa6b4ad,palette.ivory);
      // Two sloping arms and a high cross-beam make a recognizable portal pylon.
      line([[a+2,57,61],[a+2,67,69],[a+2,79,61]],0xd9d8c3,3);
      for (const end of [-23,-9,5,45,60,75,122,139]) {
        if (Math.abs(end-a) <= 52) line([[a+2,79,60],[end,77,17]],0xe1d2a1,1);
      }
      line([[a+2,57,43],[a+2,79,43]],0xe0ddc8,2);
    }
    line([[-28,77,17],[142,77,17]],palette.ivory,1.3);
    line([[-28,56,17],[142,56,17]],0xe4e1d0,1);
    // A small sailboat and promenade gardens establish the coastal scale.
    const sail = p(59,129);
    g.ellipse(sail.x,sail.y,8,2.5).fill(palette.ivory);
    poly([[59,129,3],[59,129,19],[68,129,4]],0xf4eed9);
    line([[59,129],[59,129,20]],palette.ink,.8);
    for (const [a,b] of [[-20,2],[127,17],[-20,127],[128,141]]) tree(a,b);
    bench(-22,144);
  } else if (kind === 'moscow') {
    // Low crenellated red wall, small gilded cupolas and a modest clock tower.
    tile(-14,12,143,109,0xe4d8c2);
    tile(0,82,112,30,0xc8bfa9);
    box(73,17,35,31,24,0xe4d6bd,0xbfb9a4,0x8ba090);
    const cupola = (a: number, b: number, h: number, r: number) => {
      const q = p(a,b,h);
      g.ellipse(q.x,q.y,r,r*.48).fill(0xb69b59);
      g.moveTo(q.x-r,q.y).bezierCurveTo(q.x-r*1.5,q.y-r,q.x-r*.2,q.y-r*.8,q.x,q.y-r*1.8)
        .bezierCurveTo(q.x+r*.2,q.y-r*.8,q.x+r*1.5,q.y-r,q.x+r,q.y).fill(palette.gold);
      g.ellipse(q.x-2,q.y-r*.65,1.5,r*.45).fill(0xeddaa0);
      line([[a,b,h+r*1.8],[a,b,h+r*1.8+5]],0xb0934f,1);
    };
    for (const [a,b,h,r] of [[82,25,29,5],[99,25,29,5],[91,39,36,7]]) {
      box(a-3,b-3,6,6,h,0xe7dcc7,0xc8c1ab,palette.ivory);
      cupola(a,b,h,r);
    }
    box(-7,76,126,12,17,palette.red,palette.redShade,0xd18d70);
    for (let a = -7; a < 119; a += 12) box(a,76,6,12,4,palette.red,palette.redShade,0xd3987b,17);
    // Tower planes are deliberately under 100px tall so neighboring streets remain visible.
    box(30,47,25,25,53,palette.red,palette.redShade,0xe4c7a6);
    box(28,45,29,29,4,0xd6b99a,0xb49378,palette.ivory,48);
    box(34,51,17,17,15,palette.red,palette.redShade,0xcfaa86,53);
    poly([[31,71,68],[54,71,68],[42.5,59.5,92]],palette.green);
    poly([[54,48,68],[54,71,68],[42.5,59.5,92]],0x3e645d);
    line([[42.5,59.5,92],[42.5,59.5,98]],palette.gold,1.5);
    const star = p(42.5,59.5,99);
    g.circle(star.x,star.y,2).fill(palette.gold);
    const clock = p(42.5,73,40);
    g.circle(clock.x,clock.y,9).fill(palette.gold);
    g.circle(clock.x,clock.y,7.3).fill(palette.ink);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      g.circle(clock.x+Math.sin(angle)*5.7,clock.y+Math.cos(angle)*5.7,.65).fill(palette.ivory);
    }
    g.moveTo(clock.x,clock.y-4).lineTo(clock.x,clock.y).lineTo(clock.x+3,clock.y+1).stroke({color:palette.ivory,width:1.2});
    const door = p(42,73);
    g.roundRect(door.x-4,door.y-15,8,15,4).fill(0x694f43);
    for (const [a,b] of [[-19,22],[128,80],[-17,137],[116,144]]) tree(a,b);
    bench(25,136);
    bench(70,136);
  } else {
    tile(-15,8,134,113,0xe3dfcd);
    tile(-9,14,122,101,0xeee7d5);
    // Civic pavilion and fountain, not another generic residential building.
    box(22,16,58,30,23,0xd8ceb8,0xb3baa9,palette.ivory);
    for (const a of [26,42,58,74]) box(a,43,3,4,20,0xf3eddd,0xc7c9b8);
    poly([[19,49,25],[83,49,25],[51,31,38]],palette.green);
    poly([[83,13,25],[83,49,25],[51,31,38]],0x3e645d);
    const basin = p(51,82);
    g.ellipse(basin.x,basin.y,23,12).fill(0xb9c4bd);
    g.ellipse(basin.x,basin.y-2,19,9).fill(palette.blue);
    g.ellipse(basin.x,basin.y-2,12,5).stroke({color:0xdce9e1,width:1});
    line([[51,82,3],[51,82,20]],0xd8e7df,2);
    g.ellipse(basin.x,basin.y-15,7,3).fill(0xe1e8d9);
    for (const a of [-20,125]) for (const b of [10,73,138]) tree(a,b);
    bench(10,134);
    bench(74,134);
  }
}

export function landmarkKind(city: LandmarkCity): LandmarkKind {
  if (city?.name === 'Москва') return 'moscow';
  if (city?.name === 'Владивосток') return 'vladivostok';
  return 'generic';
}

export function landmarkName(city: LandmarkCity): string {
  return {moscow: 'Кремлёвская площадь', vladivostok: 'Золотой мост', generic: 'Городская площадь'}[landmarkKind(city)];
}
