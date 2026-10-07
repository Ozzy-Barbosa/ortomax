import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const base=process.env.APP_URL||'http://127.0.0.1:4193/gina/';
const browser=await chromium.launch();const results=[];
await fs.mkdir('output/qa',{recursive:true});
for(const width of [320,390,430,768,1440]){
 const context=await browser.newContext({viewport:{width,height:900},locale:'es-MX'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Explorar demostración'}).waitFor();await page.evaluate(()=>document.fonts.ready);
 const collect=async(name,axe=false)=>{const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);const violations=axe?(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})):[];results.push({width,page:name,axeChecked:axe,overflow,errors:[...errors],violations});if(width===390||width===1440)await page.screenshot({path:`output/qa/${name}-${width}.png`,fullPage:true});};
 await collect('inicio',width===390||width===1440);
 await page.getByRole('button',{name:'Explorar demostración'}).click();await page.getByRole('heading',{name:'Tu resumen.'}).waitFor();
 await collect('resumen',width===390||width===1440);
 const nav=page.locator(width<=960?'.bottom-nav':'.sidebar nav');
 await nav.getByRole('button',{name:'Actividades',exact:true}).click();await collect('actividades',width===390);
 await page.getByRole('button',{name:'Configuración',exact:true}).last().click();await collect('configuracion',width===390);
 await page.getByRole('button',{name:'Reportes y cierre mensual'}).click();await collect('reportes',width===390);
 await nav.getByRole('button',{name:width<=960?'Registrar':'NO',exact:true}).count().then(async n=>{if(width<=960)await nav.getByRole('button',{name:'Registrar',exact:true}).click();else await page.locator('.sidebar').getByRole('button',{name:'Registrar movimiento',exact:true}).click()});
 await collect('registro',width===390);await page.getByRole('button',{name:'Cerrar ventana'}).click();
 await context.close();
}
await browser.close();await fs.writeFile('output/qa/visual-report.json',JSON.stringify({base,at:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results.map(r=>({width:r.width,page:r.page,overflow:r.overflow,errors:r.errors,violations:r.violations.map(v=>({id:v.id,count:v.nodes.length,examples:v.nodes.slice(0,4)}))})),null,2));
if(results.some(r=>r.overflow||r.errors.length||r.violations.length))process.exitCode=1;
