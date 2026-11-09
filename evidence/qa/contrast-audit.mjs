import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const result = [];
try {
  for (const width of [375,1440]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    await page.goto('http://127.0.0.1:5173');
    await page.getByRole('heading',{name:'Life, all together.'}).waitFor();
    async function audit(state) {
      const entries = await page.evaluate(()=> {
        const rgb=c=>c.match(/[\d.]+/g)?.map(Number);
        const blend=(a,b,opacity)=>a.slice(0,3).map((v,i)=>v*opacity+b[i]*(1-opacity));
        const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        return Array.from(document.querySelectorAll('body *')).filter(el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && !el.closest('[aria-hidden=true]') && Array.from(el.childNodes).some(n=>n.nodeType===3 && n.textContent.trim())).map(el=>{
          const style=getComputedStyle(el); let parent=el; const backgrounds=[]; let opacity=1;
          while(parent) {const cs=getComputedStyle(parent); const bg=rgb(cs.backgroundColor); if(bg) backgrounds.unshift(bg); opacity*=Number(cs.opacity); parent=parent.parentElement;}
          let bg=[255,255,255]; for(const layer of backgrounds) bg=blend(layer,bg,layer[3]??1);
          const foreground=rgb(style.color); const fg=blend(foreground,bg,opacity*(foreground[3]??1)); const a=luminance(fg),b=luminance(bg);
          const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); const size=parseFloat(style.fontSize);const weight=parseInt(style.fontWeight)||400;
          return {tag:el.tagName,className:el.className,text:Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim().slice(0,120),color:style.color,bg,opacity,size,weight,ratio,required:size>=24||(size>=18.66&&weight>=700)?3:4.5};
        });
      });
      result.push({width,state,entries,belowTarget:entries.filter(e=>e.ratio<e.required)});
    }
    await audit('overview');
    const menu=page.getByRole('button',{name:'Toggle calendars'});if(await menu.isVisible())await menu.click();
    await page.getByRole('button',{name:'Manage accounts'}).click();
    await page.getByRole('dialog').waitFor(); await audit('accounts');
    await page.screenshot({path:`evidence/qa/accounts-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');
    if(await menu.isVisible()) await menu.click();
    await page.locator('[data-event-id]').filter({hasText:'Fly to Palm Springs'}).click();
    await page.getByRole('dialog').waitFor(); await audit('event');
    await page.screenshot({path:`evidence/qa/event-${width}.png`,fullPage:true});
    await page.close();
  }
  writeFileSync('evidence/qa/contrast-audit.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.map(({width,state,belowTarget})=>({width,state,belowTarget})),null,2));
} finally {await browser.close();}
