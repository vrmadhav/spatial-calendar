import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const results = [];
const pageSelectors = ['.pan-hint', '.distance-badge', '.event-meta', '.event-name', '.page-footer', '.zone-label', '.upcoming-copy small', '.date-tick', '.month-label small', '.eyebrow', '.demo-badge', '.zoom-control', '.calendar-legend', '.sidebar-description', '.person-heading small', '.source-option', '.sidebar-bottom small', '.section-heading>span'];
const dialogSelectors = ['.event-details dt', '.event-details dd small', '.detail-distance', '.detail-category', '.travel-details .eyebrow', '.dialog-intro', '.account-footnote', '.sync-description', '.demo-tools summary', '.account-status', '.subtle-button'];
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto('http://127.0.0.1:5173');
    await page.getByTestId('timeline-viewport').waitFor();
    async function measure(selectors, state) {
      const entries = await page.evaluate((selectors) => {
        const rgba = (value) => { const numbers = value.match(/[\d.]+/g)?.map(Number) ?? []; return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1]; };
        const mix = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
        const luminance = (rgb) => rgb.map((channel) => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, index) => sum + n * [.2126, .7152, .0722][index], 0);
        return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].filter((element) => element.textContent.trim() && element.getClientRects().length && !element.closest('[disabled]')).map((element) => {
          const style = getComputedStyle(element);
          const lineage = []; let node = element;
          while (node) { lineage.unshift(node); node = node.parentElement; }
          let background = [255, 255, 255]; let opacity = 1;
          for (const ancestor of lineage) { const inherited = getComputedStyle(ancestor); background = mix(rgba(inherited.backgroundColor), background); opacity *= Number(inherited.opacity); }
          const color = rgba(style.color); color[3] *= opacity;
          const foreground = mix(color, background);
          const a = luminance(foreground), b = luminance(background);
          return { selector, text: element.textContent.trim().slice(0, 80), color: style.color, background, opacity, fontSize: style.fontSize, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        }));
      }, selectors);
      results.push({ width, state, pageWidth: await page.evaluate(() => document.documentElement.scrollWidth), entries });
    }
    await measure(pageSelectors, 'overview');
    await page.screenshot({ path: `/tmp/spatial-contrast-${width}.png`, fullPage: true });
    await page.locator('[data-event-id]').first().click();
    await measure(dialogSelectors, 'event dialog');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    if (width === 375) await page.getByRole('button', { name: 'Toggle calendars' }).click();
    await page.getByRole('button', { name: 'Manage accounts' }).click();
    await measure(dialogSelectors, 'account dialog');
    await page.close();
  }
  await writeFile('/tmp/spatial-contrast-results.json', JSON.stringify(results, null, 2));
  const checks = results.flatMap((result) => result.entries);
  const failures = checks.filter((entry) => entry.ratio < 4.5);
  console.log(JSON.stringify({ checks: checks.length, minimum: Math.min(...checks.map((entry) => entry.ratio)), widths: results.map(({ width, state, pageWidth }) => ({ width, state, pageWidth })), failures }, null, 2));
  if (failures.length || results.some((result) => result.width !== result.pageWidth)) process.exitCode = 1;
} finally { await browser.close(); }
