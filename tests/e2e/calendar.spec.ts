import { expect, test, type Page } from '@playwright/test';
import type { HouseholdSnapshot } from '../../src/shared/contracts';

const base = '/api/v1/households/household-rivera';
const headers = { 'X-Demo-User': 'demo-alex' };
async function snapshot(page: Page): Promise<HouseholdSnapshot> {
  const response = await page.request.get(`${base}/snapshot`, { headers });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function showSources(page: Page) {
  const menu = page.getByRole('button', { name: 'Toggle calendars' });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
}
async function assertReadableText(page: Page, selectors: string[]) {
  const checks = await page.locator(selectors.join(',')).evaluateAll((elements) => {
    const rgba = (color: string): number[] => {
      const channels = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return channels.length === 3 ? [...channels, 1] : channels;
    };
    const blend = (front: number[], back: number[]) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return elements.filter((element) => element.getClientRects().length > 0 && element.textContent?.trim()).map((element) => {
      const ancestry: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestry.unshift(node);
      let background = [255, 255, 255];
      let opacity = 1;
      for (const node of ancestry) {
        const style = getComputedStyle(node);
        background = blend(rgba(style.backgroundColor), background);
        opacity *= Number(style.opacity);
      }
      const foreground = rgba(getComputedStyle(element).color);
      foreground[3] *= opacity;
      const textLight = luminance(blend(foreground, background));
      const backLight = luminance(background);
      return { selector: element.className || element.tagName, text: element.textContent?.trim().slice(0, 60), ratio: (Math.max(textLight, backLight) + 0.05) / (Math.min(textLight, backLight) + 0.05) };
    });
  });
  expect(checks.length).toBeGreaterThan(0);
  for (const check of checks) expect(check.ratio, `${check.selector}: ${check.text}`).toBeGreaterThanOrEqual(4.5);
}
test.beforeEach(async ({ page }) => {
  const state = await snapshot(page);
  for (const account of state.accounts) {
    if (account.profileId === 'sam') await page.request.delete(`${base}/accounts/${account.id}`, { headers });
    else if (account.syncStatus === 'error') await page.request.post(`${base}/accounts/${account.id}/sync`, { headers, data: {} });
  }
  for (const source of state.sources.filter((item) => !item.selected && !item.id.includes('sam'))) {
    await page.request.patch(`${base}/sources/${source.id}`, { headers, data: { selected: true } });
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Life, all together.' })).toBeVisible();
});

test('three-month overview preserves focal date across presets, continuous zoom and navigation', async ({ page }, testInfo) => {
  const timeline = page.getByTestId('timeline-viewport');
  const geometry = () => timeline.evaluate((element) => ({ origin: Number(element.getAttribute('data-origin')), scale: Number(element.getAttribute('data-scale')), width: Number(element.getAttribute('data-width')), center: Number(element.getAttribute('data-center')) }));
  const state = await snapshot(page);
  const date = new Date(`${state.today}T00:00:00Z`);
  const expectedStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1) / 86400000;
  const expectedEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 1) / 86400000;
  const initial = await geometry();
  expect(initial.origin).toBe(expectedStart);
  expect(initial.width / initial.scale).toBeCloseTo(expectedEnd - expectedStart, 8);
  for (const level of ['Week', 'Day', 'Month']) {
    await page.getByRole('button', { name: level, exact: true }).click();
    const next = await geometry();
    expect(Math.abs((initial.center - next.origin) * next.scale - next.width / 2)).toBeLessThan(1);
  }
  await page.getByRole('slider', { name: 'Zoom level', exact: true }).fill('68.5');
  const continuous = await geometry();
  expect(Math.abs((initial.center - continuous.origin) * continuous.scale - continuous.width / 2)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: 'Next period' }).click();
  expect((await geometry()).origin).toBeGreaterThan(initial.origin);
  await page.getByRole('button', { name: 'Previous period' }).click();
  expect((await geometry()).origin).toBeCloseTo(initial.origin, 8);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  expect((await geometry()).origin).toBe(initial.origin);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
});

test('travel details, conflicts and dialog focus are usable with a keyboard', async ({ page }) => {
  const state = await snapshot(page);
  const flight = state.events.find((event) => event.travel?.kind === 'flight')!;
  const trigger = page.locator(`[data-event-id="${flight.id}"]`);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: flight.title });
  await expect(dialog).toBeVisible();
  for (const text of ['In 18 days', 'America/Los_Angeles', 'SFO · Terminal 2', 'DEMO-FLY', 'Alex Rivera']) {
    await expect(dialog.getByText(text, { exact: false }).first()).toBeVisible();
  }
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Back to the calendar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: /Family dentist,.*scheduling conflict/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /School rehearsal,.*scheduling conflict/ })).toBeVisible();
  const hotel = state.events.find((event) => event.travel?.kind === 'hotel')!;
  await page.locator(`[data-event-id="${hotel.id}"]`).click();
  const hotelDialog = page.getByRole('dialog', { name: hotel.title });
  await expect(hotelDialog.getByText('Four nights · Family suite')).toBeVisible();
  await expect(hotelDialog.getByText(/All day/)).toBeVisible();
  if (hotel.time.kind === 'allDay') {
    const lastDay = new Date(Date.parse(`${hotel.time.endDate}T00:00:00Z`) - 86400000);
    const displayedEnd = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(lastDay);
    await expect(hotelDialog.getByText(/All day/)).toContainText(displayedEnd);
  }
  await page.keyboard.press('Escape');
});

test('source selection persists on reload and preserves other calendars', async ({ page }) => {
  const state = await snapshot(page);
  const travel = state.sources.find((source) => source.name === 'Family travel')!;
  await showSources(page);
  // Selection changes only after server confirmation, so assert the settled state.
  await page.getByRole('checkbox', { name: travel.name, exact: true }).click();
  await expect(page.getByRole('checkbox', { name: travel.name, exact: true })).not.toBeChecked();
  await expect.poll(async () => (await snapshot(page)).sources.find((source) => source.id === travel.id)?.selected).toBe(false);
  await expect(page.locator('[data-event-id]').filter({ hasText: 'Fly to Palm Springs' })).toHaveCount(0);
  expect((await snapshot(page)).events.every((event) => event.sourceId !== travel.id)).toBeTruthy();
  expect((await snapshot(page)).events.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Life, all together.' })).toBeVisible();
  await showSources(page);
  await expect(page.getByRole('checkbox', { name: travel.name, exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: travel.name, exact: true }).click();
  await expect(page.getByRole('checkbox', { name: travel.name, exact: true })).toBeChecked();
  await expect.poll(async () => (await snapshot(page)).events.some((event) => event.sourceId === travel.id)).toBe(true);
});

test('account connect, failed sync, recovery, disconnect and reconnect work against the API', async ({ page }) => {
  await showSources(page);
  await page.getByRole('button', { name: 'Manage accounts' }).click();
  const dialog = page.getByRole('dialog');
  const sam = dialog.locator('.manage-account').filter({ hasText: 'Sam Rivera' });
  await sam.getByRole('button', { name: 'Connect Sam’s demo account' }).click();
  await expect(sam.getByText('Connected', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(sam.locator('summary')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  const connected = await snapshot(page);
  const account = connected.accounts.find((item) => item.profileId === 'sam')!;
  const sourceIds = connected.sources.filter((source) => source.accountId === account.id).map((source) => source.id);
  const eventIds = connected.events.filter((event) => sourceIds.includes(event.sourceId)).map((event) => event.id).sort();
  expect(eventIds.length).toBeGreaterThan(0);
  await sam.getByText('Demo tools', { exact: true }).click();
  await sam.getByRole('button', { name: 'Simulate sync failure' }).click();
  await expect(sam.getByText('Needs attention', { exact: true })).toBeVisible();
  expect((await snapshot(page)).events.filter((event) => sourceIds.includes(event.sourceId)).map((event) => event.id).sort()).toEqual(eventIds);
  await sam.getByRole('button', { name: 'Retry sync' }).click();
  await expect(sam.getByText('Connected', { exact: true })).toBeVisible();
  await sam.getByRole('button', { name: 'Sync now' }).click();
  await expect(sam.getByRole('button', { name: 'Sync now' })).toBeEnabled();
  expect((await snapshot(page)).events.filter((event) => sourceIds.includes(event.sourceId)).map((event) => event.id).sort()).toEqual(eventIds);
  await sam.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(sam.getByText('Available', { exact: true })).toBeVisible();
  expect((await snapshot(page)).events.some((event) => sourceIds.includes(event.sourceId))).toBe(false);
  await sam.getByRole('button', { name: 'Connect Sam’s demo account' }).click();
  await expect(sam.getByText('Connected', { exact: true })).toBeVisible();
  await sam.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(sam.getByText('Available', { exact: true })).toBeVisible();
});

test('meaningful secondary and event text remains readable in overview and dialogs', async ({ page }) => {
  await assertReadableText(page, ['.pan-hint', '.distance-badge', '.event-meta', '.event-name', '.page-footer', '.zone-label', '.upcoming-copy small', '.date-tick', '.month-label small', '.eyebrow', '.demo-badge', '.zoom-control', '.calendar-legend']);
  const flight = (await snapshot(page)).events.find((event) => event.travel?.kind === 'flight')!;
  await page.locator(`[data-event-id="${flight.id}"]`).click();
  await assertReadableText(page, ['.event-details dt', '.event-details dd small', '.detail-distance', '.travel-details .eyebrow']);
  await page.keyboard.press('Escape');
  await showSources(page);
  await page.getByRole('button', { name: 'Manage accounts' }).click();
  await assertReadableText(page, ['.dialog-intro', '.account-footnote', '.sync-description', '.demo-tools summary', '.account-status']);
});
