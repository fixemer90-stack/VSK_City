import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const AGENT = 'TEST-AGENT-001-001';
const STREET = `STREET-${AGENT}`;
const query = `agentId=${AGENT}&role=agent`;

test.beforeAll(async ({ request, baseURL }) => {
  const target = new URL(baseURL);
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(target.hostname);
  const response = await request.get(`/api/demo/state?${query}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const state = await response.json();
  expect(state.mode).toBe('pitch');
  expect(state.cities).toHaveLength(25);
  expect(state.cities.every((city) => city.id.startsWith('TEST-CITY-'))).toBe(true);
});

function own(state, streetId = STREET) {
  const street = state.cities.flatMap((city) => city.streets).find((item) => item.id === streetId);
  expect(street).toBeTruthy();
  return street;
}

function motorContribution(street) {
  return street.houses.reduce((sum, house) => sum + house.xp, 0)
    + street.parking.reduce((sum, parking) => sum + parking.spaces, 0);
}

async function action(request, type, requestId = `browser-${crypto.randomUUID()}`) {
  const response = await request.post(`/api/demo/actions?${query}`, {
    data: { agentId: AGENT, type, requestId },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test('real API: seed, privacy, progression, delayed demolition and retry protection', async ({ request }) => {
  const health = await request.get('/health');
  expect(health.ok(), await health.text()).toBeTruthy();
  let state = await action(request, 'reset');
  expect(state.mode).toBe('pitch');
  expect(state.cities).toHaveLength(25);
  for (const city of state.cities) expect(city.streets).toHaveLength(50);
  const streets = state.cities.flatMap((city) => city.streets);
  expect(streets.filter((street) => street.name !== null)).toHaveLength(1);
  for (const street of streets) {
    expect(street).not.toHaveProperty('firstName');
    expect(street).not.toHaveProperty('lastName');
  }
  expect(own(state).houses).toHaveLength(0);
  expect(own(state).parking).toHaveLength(0);
  state = await action(request, 'property');
  const first = own(state).houses[0];
  expect(first.xp).toBe(0);
  expect(first.floors).toBe(2);
  await action(request, 'motor');
  await action(request, 'motor');
  const key = `retry-${crypto.randomUUID()}`;
  state = await action(request, 'motor', key);
  expect(own(state).houses[0].xp).toBe(3);
  expect(own(state).houses[0].floors).toBe(5);
  const version = state.version;
  state = await action(request, 'motor', key);
  expect(state.version).toBe(version);
  expect(motorContribution(own(state))).toBe(3);
  state = await action(request, 'property');
  expect(own(state).houses.find((house) => house.id === first.id).xp).toBe(3);
  expect(own(state).houses.filter((house) => house.xp === 0)).toHaveLength(1);
  state = await action(request, 'terminate-property');
  const pending = own(state).houses.find((house) => house.status === 'pending_demolition');
  expect(pending).toBeTruthy();
  expect(pending.xp).toBe(0);
  expect(Date.parse(pending.demolishAt) - Date.parse(state.now)).toBeGreaterThan(24 * 60 * 60 * 1000 - 60_000);
  state = await action(request, 'motor');
  expect(own(state).houses.find((house) => house.id === pending.id).xp).toBe(0);
  expect(motorContribution(own(state))).toBe(4);
  state = await action(request, 'advance-day');
  expect(own(state).houses.some((house) => house.id === pending.id)).toBe(false);
  expect(motorContribution(own(state))).toBe(4);
  expect(own(state).houses[0].lotIndex).toBe(first.lotIndex);
  const director = await request.get(`/api/demo/state?agentId=${AGENT}&role=director`);
  expect(director.ok()).toBeTruthy();
  const observed = await director.json();
  for (const city of observed.cities) {
    expect(city.streets.filter((street) => street.name !== null)).toHaveLength(
      city.id === observed.viewer.cityId ? 50 : 0,
    );
  }
  const denied = await request.post(`/api/demo/actions?agentId=${AGENT}&role=director`, {
    data: { agentId: AGENT, type: 'property', requestId: crypto.randomUUID() },
  });
  expect(denied.status()).toBe(403);
  const motorOnlyId = 'STREET-TEST-AGENT-001-006';
  const motorOnly = own(state, motorOnlyId);
  expect(motorOnly.houses).toHaveLength(0);
  expect(motorOnly.parking.map((parking) => parking.spaces)).toEqual([10, 3]);
  await action(request, 'reset');
});

test('real browser: country, city, street and pitch controls', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('demo-scenario')).toHaveValue('TEST-AGENT-001-044');
  const countryNav = page.getByTestId('country-nav').first();
  if (await countryNav.isEnabled()) await countryNav.click();
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath('01-country.png'), fullPage: true });
  // Fixed viewport + deterministic fixture: exercise native Pixi pointertap, not only DOM navigation.
  await page.mouse.click(580, 507);
  await expect(page.getByTestId('scene-title')).toContainText('Москва');
  await page.getByTestId('country-nav').click();
  await page.mouse.click(1268, 593);
  await expect(page.getByTestId('scene-title')).toContainText('Владивосток');
  await page.getByTestId('country-nav').click();
  await page.getByTestId('city-TEST-CITY-001').first().click();
  await expect(page.getByTestId('scene-title')).toContainText('Москва');
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: info.outputPath('02-city.png'), fullPage: true });
  await page.getByTestId('my-street').first().click();
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: info.outputPath('03-street.png'), fullPage: true });
  const scenario = page.getByTestId('demo-scenario');
  const emptyValue = await scenario.locator('option').evaluateAll((options) =>
    options.find((option) => /Пуст|Без продаж|Чистый лист/i.test(option.label))?.value,
  );
  expect(emptyValue).toBeTruthy();
  await scenario.selectOption(emptyValue);
  await expect(page.getByTestId('action-property')).toBeEnabled();
  await expect(scenario).toHaveValue(emptyValue);
  await page.getByTestId('my-street').first().click();
  await page.getByTestId('action-property').click();
  await expect(page.getByTestId('action-motor')).toBeEnabled();
  await page.getByTestId('action-motor').click();
  await expect(page.getByTestId('action-terminate-property')).toBeEnabled();
  await page.getByTestId('action-terminate-property').click();
  await expect(page.locator('.demolition').getByText('Под снос', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('04-pending-demolition.png'), fullPage: true });
  await page.getByTestId('action-advance-day').click();
  await expect(page.getByTestId('action-property')).toBeEnabled();
  await expect(page.locator('.demolition')).toHaveCount(0);
  await page.getByTestId('demo-role').selectOption('director');
  await expect(page.getByTestId('my-street').first()).not.toBeVisible();
  await page.getByTestId('demo-role').selectOption('agent');
  await expect(scenario).toBeEnabled();
  await scenario.selectOption('TEST-AGENT-001-045');
  await expect(page.getByTestId('action-property')).toBeEnabled();
  await page.getByTestId('my-street').first().click();
  await page.locator('.object-list summary').click();
  await expect(page.locator('.object-list > div')).toHaveCount(50);
  await page.screenshot({ path: info.outputPath('07-large-street.png'), fullPage: true });
  await scenario.selectOption('TEST-AGENT-001-044');
  await expect(page.getByTestId('action-property')).toBeEnabled();
  await page.getByTestId('my-street').first().click();
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1600, height: 1000 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`desktop-${viewport.width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('frontend exposes a recoverable API failure instead of a fake city', async ({ page }) => {
  await page.route('**/api/demo/state**', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Проверка недоступного сервера' }),
  }));
  await page.goto('/');
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('05-api-error.png'), fullPage: true });
  await page.unroute('**/api/demo/state**');
  await page.reload();
  await expect(page.getByTestId('scene-surface')).toHaveAttribute('data-ready', 'true');
});

test('small screens get an honest desktop boundary without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText(/компьютер|большом экране|desktop|настольн/i).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('06-desktop-boundary.png'), fullPage: true });
});

test('a real backend restart preserves the street, pending deadline and request ledger', async ({ request }, info) => {
  test.setTimeout(150_000);
  const agentId = 'TEST-AGENT-025-001';
  const streetId = `STREET-${agentId}`;
  const url = `/api/demo/actions?agentId=${agentId}&role=agent`;
  const post = async (type, requestId = `persistence-${crypto.randomUUID()}`) => {
    const response = await request.post(url, { data: { agentId, type, requestId } });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  await post('property');
  await post('motor');
  const terminationKey = `persistence-${crypto.randomUUID()}`;
  const before = await post('terminate-property', terminationKey);
  const expected = own(before, streetId);
  expect(expected.houses.some((house) => house.status === 'pending_demolition')).toBe(true);
  const compose = fileURLToPath(new URL('../../infra/pitch.compose.yaml', import.meta.url));
  const env = fileURLToPath(new URL('../../infra/pitch.env.example', import.meta.url));
  const restarted = await promisify(execFile)('docker', [
    'compose', '-p', 'vsk-pitch', '--env-file', env, '-f', compose, 'restart', 'backend',
  ], { timeout: 60_000 });
  await expect.poll(async () => {
    try { return (await request.get('/health', { timeout: 5000 })).status(); }
    catch { return 0; }
  }, { timeout: 60_000 }).toBe(200);
  const response = await request.get(`/api/demo/state?agentId=${agentId}&role=agent`);
  expect(response.ok()).toBe(true);
  const after = await response.json();
  expect(own(after, streetId)).toEqual(expected);
  const repeated = await post('terminate-property', terminationKey);
  expect(own(repeated, streetId)).toEqual(expected);
  expect(repeated.version).toBe(after.version);
  await writeFile(info.outputPath('persistence.json'), JSON.stringify({
    verified: true, agentId, streetId,
    versionBefore: before.version, versionAfter: after.version,
    pending: expected.houses.filter((house) => house.status === 'pending_demolition'),
    restartOutput: restarted.stdout + restarted.stderr,
  }, null, 2));
});
