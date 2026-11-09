import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, isMobile: width === 375 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173');
    await page.getByRole('heading', { name: 'Life, all together.' }).waitFor();
    const timeline = page.getByTestId('timeline-viewport');
    const before = Number(await timeline.getAttribute('data-origin'));
    const pan = page.locator('.timeline-pan');
    const box = await pan.boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = box.x + box.width * .7, y = box.y + 12;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 20 * step, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = Number(await timeline.getAttribute('data-origin'));
    assert.ok(after > before, 'horizontal touch gesture must advance timeline');
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    const anchor = Number(await timeline.getAttribute('data-center'));
    const geometry = [];
    for (const level of ['Week', 'Day', 'Month']) {
      await page.getByRole('button', { name: level, exact: true }).click();
      const measured = await timeline.evaluate((el, anchor) => {
        const rect = el.getBoundingClientRect();
        const origin = +el.dataset.origin, scale = +el.dataset.scale;
        return { error: Math.abs((anchor-origin)*scale-rect.width/2), width: rect.width, center: +el.dataset.center };
      }, anchor);
      assert.ok(measured.error < 1); geometry.push({level,...measured});
    }
    await page.getByRole('slider', {name:'Zoom level', exact:true}).fill('48.5');
    const sliderError = await timeline.evaluate((el, anchor) => Math.abs((anchor-(+el.dataset.origin))*(+el.dataset.scale)-el.getBoundingClientRect().width/2), anchor);
    assert.ok(sliderError<1);
    await page.getByRole('button',{name:'Month',exact:true}).click();
    await page.getByRole('button',{name:'Today',exact:true}).click();
    const colors = await page.evaluate(() => ['.pan-hint','.distance-badge','.event-meta','.page-footer','.zone-label','.upcoming-copy small'].map(selector=>{
      const el = document.querySelector(selector); let parent=el; let bg='';
      while(parent) { bg=getComputedStyle(parent).backgroundColor; if(bg!=='rgba(0, 0, 0, 0)') break; parent=parent.parentElement; }
      return {selector,text:el.textContent,color:getComputedStyle(el).color,background:bg,fontSize:getComputedStyle(el).fontSize};
    }));
    const lum = color => { const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return .2126*values[0]+.7152*values[1]+.0722*values[2]; };
    for(const color of colors) {const a=lum(color.color),b=lum(color.background); color.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
    await page.screenshot({path:`evidence/qa/overview-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    results.push({width,touchPan:{before,after},geometry,sliderError,colors});
    await context.close();
  }
  console.log(JSON.stringify(results,null,2));
  writeFileSync('evidence/qa/browser-results.json',JSON.stringify(results,null,2));
} finally { await browser.close(); }
