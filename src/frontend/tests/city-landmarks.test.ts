import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Graphics} from 'pixi.js';

type Kind = 'moscow' | 'vladivostok' | 'generic';
const kinds: Kind[] = ['moscow', 'vladivostok', 'generic'];

function trace(g: Graphics) {
  return g.context.instructions.map(instruction => {
    assert.ok(instruction.action === 'fill' || instruction.action === 'stroke', 'geometry only');
    return {
      action: instruction.action,
      color: instruction.data.style.color,
      alpha: instruction.data.style.alpha,
      width: 'width' in instruction.data.style ? instruction.data.style.width : undefined,
      path: instruction.data.path.instructions,
    };
  });
}

function assertFinite(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}

const load = () => import('../app/city-landmarks');

test('three civic centers draw distinct finite compact geometry in real Pixi Graphics', async () => {
  const {drawCityLandmark} = await load();
  const traces = [];
  for (const kind of kinds) {
    const g = new Graphics();
    drawCityLandmark(g, 430, 440, kind);
    const commands = trace(g);
    assert.ok(commands.length > 20, `${kind}: detailed geometry`);
    assertFinite(commands);
    assert.equal(g.children.length, 0, 'no captions or other display children');
    const b = g.getLocalBounds();
    assertFinite([b.minX, b.minY, b.maxX, b.maxY]);
    // Projection of the compact reserved center; towers must not grow over nearby blocks.
    assert.ok(b.minX >= -237 && b.maxX <= 187, `${kind}: horizontal reserved space`);
    assert.ok(b.minY >= 340 && b.maxY <= 578, `${kind}: compact height/depth`);
    assert.ok(b.width > 200 && b.height > 100);
    traces.push(JSON.stringify(commands));
    g.destroy();
  }
  assert.equal(new Set(traces).size, 3, 'bridge, Kremlin and civic square are different drawings');
});

test('geometry repeats unchanged across sales states without reading their data', async () => {
  const {drawCityLandmark, landmarkKind, landmarkName} = await load();
  for (const name of ['Москва', 'Владивосток', 'Казань']) {
    const empty = Object.freeze({name, streets: [], sales: 0});
    const developed = Object.freeze({name, streets: [{houses: [{tier: 8}]}], sales: 100000});
    const protectedCity = {name, get sales(): never {throw new Error('sales must not be read');}};
    const drawings = [empty, developed, protectedCity, empty].map(city => {
      const g = new Graphics();
      drawCityLandmark(g, 430, 440, landmarkKind(city));
      const result = trace(g);
      g.destroy();
      assert.equal(landmarkName(city), landmarkName(empty));
      return result;
    });
    drawings.forEach(drawing => assert.deepEqual(drawing, drawings[0]));
  }
});

test('moving the origin applies scene isometric projection to the actual drawing', async () => {
  const {drawCityLandmark} = await load();
  for (const kind of kinds) {
    const original = new Graphics(), shifted = new Graphics();
    drawCityLandmark(original, 430, 440, kind);
    drawCityLandmark(shifted, 467, 453, kind);
    const a = original.getLocalBounds(), b = shifted.getLocalBounds();
    for (const edge of ['minX', 'maxX'] as const) assert.ok(Math.abs(b[edge] - a[edge] - 24) < 1e-8);
    for (const edge of ['minY', 'maxY'] as const) assert.ok(Math.abs(b[edge] - a[edge] - 24) < 1e-8);
    assert.equal(trace(original).length, trace(shifted).length);
    original.destroy();
    shifted.destroy();
  }
});

test('city identity selects permanent Russian landmark titles, with a safe civic fallback', async () => {
  const {landmarkKind, landmarkName} = await load();
  for (const [city, kind, title] of [
    [{name: 'Москва'}, 'moscow', 'Кремлёвская площадь'],
    [{name: 'Владивосток'}, 'vladivostok', 'Золотой мост'],
    [{name: 'Казань'}, 'generic', 'Городская площадь'],
    [undefined, 'generic', 'Городская площадь'],
  ] as const) {
    assert.equal(landmarkKind(city), kind);
    assert.equal(landmarkName(city), title);
  }
});
