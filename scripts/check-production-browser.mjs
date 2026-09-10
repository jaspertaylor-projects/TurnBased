#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright', '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try another installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');
const artifacts = process.env.PRODUCTION_ARTIFACT_DIR || '/tmp/turnbased-production-browser';
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
await mkdir(artifacts, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [], catalogWrites = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/v1/') && request.method() !== 'GET') catalogWrites.push(request.url()); });
const button = name => page.getByRole('button', { name, exact: true });
const panel = page.getByRole('region', { name: 'Prepare supplier order', exact: true });
const article = name => page.getByRole('article', { name: `Supplier for ${name}`, exact: true });
const exportButton = () => button('Download supplier package');
const cardName = 'Moonlit cards', coinName = '24 Moonlit coins';
const cardSlug = 'custom-white-border-poker-sized-cards', coinSlug = 'circle-game-tiles-micro-1inch';
let fixture;
async function saved() {
  if (await button('Open sidebar').isVisible()) await button('Open sidebar').click();
  await page.waitForTimeout(850);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
  return page.evaluate(async id => (await import('/src/editor/storage.ts')).loadEditorProject(id), fixture.projectId);
}
async function ready() {
  await page.waitForFunction(() => {
    const node = document.querySelector('[aria-label="Refresh supplier details"]');
    return node && !node.disabled;
  });
}
async function openOrder() {
  await button('print & share').click();
  await page.getByRole('navigation', { name: 'Print and order tools', exact: true }).getByRole('button', { name: 'Prepare supplier order', exact: true }).click();
  await panel.waitFor();
  await ready();
}
async function match(name, category, query, title, variantLabel) {
  const item = article(name);
  const chooser = item.getByRole('button', { name: /^(Choose|Change) supplier$/ });
  await chooser.click();
  const dialog = page.getByRole('dialog', { name: `Match supplier · ${name}`, exact: true });
  await dialog.getByLabel('Catalog category', { exact: true }).selectOption(category);
  await dialog.getByLabel('Find a supplier product', { exact: true }).fill(query);
  await dialog.getByRole('button').filter({ hasText: title }).click();
  await dialog.getByLabel('Supplier variant', { exact: true }).selectOption({ label: variantLabel });
  await dialog.getByRole('radio', { name: /^Fit template to supplier size/ }).check();
  await button('Review match').click();
  await page.screenshot({ path: `${artifacts}/${category}-match-review.png` });
  await button('Apply supplier match').click();
  await dialog.waitFor({ state: 'hidden' });
  await ready();
  await saved();
}
async function bounded(label) {
  const metrics = await panel.evaluate(node => {
    const panel = node.getBoundingClientRect();
    const footer = node.querySelector('footer').getBoundingClientRect();
    const exportButton = [...node.querySelectorAll('button')].find(item => item.textContent.includes('Download supplier package'))?.getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], pageOverflowX: document.documentElement.scrollWidth - innerWidth, panel: { right: panel.right, bottom: panel.bottom, width: panel.width }, footer: { left: footer.left, right: footer.right, top: footer.top, bottom: footer.bottom }, export: exportButton && { left: exportButton.left, right: exportButton.right, bottom: exportButton.bottom } };
  });
  assert.ok(metrics.pageOverflowX <= 1 && metrics.footer.right <= metrics.viewport[0] + 1 && metrics.footer.bottom <= metrics.viewport[1] + 1 && metrics.export?.right <= metrics.viewport[0] + 1, `${label}: bounded footer ${JSON.stringify(metrics)}`);
  return metrics;
}

const inspectZip = String.raw`
import collections,csv,io,json,math,pathlib,sys,zipfile,xml.etree.ElementTree as ET
from PIL import Image
path=sys.argv[1]
with zipfile.ZipFile(path) as archive:
 assert archive.testzip() is None, 'ZIP CRC mismatch'
 names=archive.namelist()
 assert len(names)==len(set(names)), 'duplicate ZIP paths'
 assert all(not x.startswith('/') and '..' not in pathlib.PurePosixPath(x).parts and '\\' not in x for x in names), 'unsafe paths'
 required=['START-HERE.html','order-plan.json','copy-map.csv','rulebook.html','README.txt']
 assert all(x in names for x in required)
 package=json.loads(archive.read('order-plan.json'))
 assert package['format']=='turnbased-supplier-package' and package['orderPlaced'] is False
 plan=package['plan']
 assert plan['gameCopies']==1 and plan['totalPhysical']==42
 assert len(plan['rows'])==2 and all(x['status']=='ready' for x in plan['rows'])
 cards=next(x for x in plan['rows'] if x['name']=='Moonlit cards')
 coins=next(x for x in plan['rows'] if x['name']=='24 Moonlit coins')
 assert cards['purchase']['totalUnits']==1 and cards['purchase']['unitsPerPack']==18
 assert coins['purchase']['totalUnits']==1 and coins['purchase']['unitsPerPack']==36
 assert coins['purchase']['overagePhysical']==12
 assert all(x['estimate']['amount'] is None for x in plan['rows']), 'ambiguous cached prices must stay unknown'
 rows=list(csv.DictReader(io.StringIO(archive.read('copy-map.csv').decode())))
 assert len(rows)==42, f'expected42copyrows,got{len(rows)}'
 assert collections.Counter(x['Component'] for x in rows)=={'Moonlit cards':18,'24 Moonlit coins':24}
 assert collections.Counter(x['Design'] for x in rows)=={'Lantern seller':9,'Moonflower stall':9,'Moon coin':24}
 for row in rows:
  assert row['Front artwork'] in names and row['Back artwork'] in names
  assert row['Front artwork']!=row['Back artwork']
 images=package['artwork']
 assert len(images)==6 and len([x for x in names if x.endswith('.png')])==6
 assert collections.Counter(x['faceId'] for x in images)=={'front':3,'back':3}
 checked=[]
 for item in images:
  assert item['dpi']==300
  image=Image.open(io.BytesIO(archive.read(item['path'])))
  assert image.format=='PNG'
  expected=(int(item['widthMm']/25.4*300+.5),int(item['heightMm']/25.4*300+.5))
  assert image.size==expected,(item['path'],image.size,expected)
  assert all(abs(x-300)<.1 for x in image.info.get('dpi',(0,0))), (item['path'],image.info)
  rgba=image.convert('RGBA')
  counts=collections.Counter(pixel[:3] for pixel in rgba.getdata() if pixel[3]>200)
  colors=[(211,37,49),(34,83,208)] if item['faceId']=='front' else [(239,172,24),(24,141,89)]
  for color in colors:
   assert counts[color]>image.width*image.height*.025, (item['path'],'missing embedded artwork color',color,counts[color])
  svg=ET.fromstring(archive.read(item['path'][:-4]+'.svg'))
  references=[x.attrib.get('href','') for x in svg.iter() if x.tag.endswith('}image')]
  assert references and all(x.startswith('data:image/png;base64,') for x in references)
  checked.append({'path':item['path'],'pixels':image.size,'dpi':image.info.get('dpi'),'artworkColorsVerified':True})
 assert 'Production fixture rulebook: collect moon coins' in archive.read('rulebook.html').decode()
 backups=[x for x in names if x.endswith('-with-history.json')]
 assert len(backups)==1
 backup=json.loads(archive.read(backups[0]))
 assert backup['format']=='turnbased-design-archive' and backup['version']==2
 assert len(backup['project']['componentDesigns'])==2
 # Tiny embedded PNGs may remain inline; larger images are deduplicated into assets.
 for studio in backup['project']['componentDesigns'].values():
  for source in [studio['rows'][0]['artUrl'],studio['template']['document']['faces'][1]['layers'][0]['source']]:
   assert source.startswith('data:image/png;base64,') or any(source.endswith(key) for key in backup['assets']), 'backup artwork missing'
 assert sum(sum(r['copies'] for r in studio['rows']) for studio in backup['project']['componentDesigns'].values())==42
 assert len([x for x in names if x.startswith('home-print/') and x.endswith('.html')])==2
 assert 'does not place an order' in archive.read('START-HERE.html').decode()
 print(json.dumps({'passed':True,'zipCRC':'valid','files':len(names),'copyRows':len(rows),'artwork':checked,'orderPlaced':False},indent=2))
`;
try {
  await page.goto(`${base}/#/dashboard`);
  fixture = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/editor/project.ts');
    const { createStudioComponent, setProjectComponentDesign } = await import('/src/editor/componentStudio/model.ts');
    const { createTemplateLayer } = await import('/src/editor/templateStudio/model.ts');
    const { saveEditorProject } = await import('/src/editor/storage.ts');
    function image(left, right) {
      const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
      const context=canvas.getContext('2d'); context.fillStyle=left;context.fillRect(0,0,32,64);context.fillStyle=right;context.fillRect(32,0,32,64);
      return canvas.toDataURL('image/png');
    }
    const front=image('#d32531','#2253d0'), back=image('#efac18','#188d59');
    const deck=createStudioComponent(createBlankProject('Moonlit production regression'),'card','Moonlit cards');
    let project=deck.project;
    const coins=createStudioComponent(project,'token','24 Moonlit coins'); project=coins.project;
    for (const [id,isDeck] of [[deck.instanceId,true],[coins.instanceId,false]]) {
      const studio=project.componentDesigns[id], document=studio.template.document;
      document.faces=['front','back'].map(faceId=>({id:faceId,name:faceId==='front'?'Front':'Back',background:'#fffdf6',layers:[{...createTemplateLayer('image',document),id:faceId+'-art',name:'Test artwork '+faceId,x:0,y:0,width:document.widthMm,height:document.heightMm,source:faceId==='front'?'{{artUrl}}':back,fit:'stretch'}]}));
      studio.rows=(isDeck?['Lantern seller','Moonflower stall']:['Moon coin']).map((title,index)=>({...studio.rows[0],id:`${id}-row-${index+1}`,title,body:'Production fixture artwork',artUrl:front,copies:isDeck?9:24}));
      project=setProjectComponentDesign(project,id,studio);
    }
    project.rules.chapters[0].body='Production fixture rulebook: collect moon coins and trade at the market.';
    await saveEditorProject(project);
    return {projectId:project.id,cardsId:deck.instanceId,coinsId:coins.instanceId};
  });
  await page.goto(`${base}/#/editor/${fixture.projectId}`);
  await openOrder();
  assert.equal(await exportButton().isEnabled(),false,'Unmatched components block package export');
  assert.match(await panel.locator('[data-layout="productionInventorySummary"]').innerText(),/42 pieces/);
  await match(cardName,'cards','white border poker','Custom White Border Poker Sized Cards','Up to 18 cards - (S27) Smooth - Smooth');
  assert.equal(await exportButton().isEnabled(),false,'A still-unmatched coin blocks the package');
  await match(coinName,'tiles','circle','Custom Circle Game Tiles 1" Micro Size','36 tiles/sheet - 1.6mm thick');
  await exportButton().waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent==='Download supplier package'&&!x.disabled));
  assert.match(await article(coinName).innerText(),/12 spare pieces/);
  assert.match(await article(cardName).innerText(),/1 deck/);
  assert.match(await article(coinName).innerText(),/1 sheet/);
  assert.equal(await panel.locator('.production-price').filter({hasText:'Price at supplier'}).count(),2);
  assert.doesNotMatch(await panel.innerText(),/\$0\.00/);
  const matched=await saved();
  assert.equal(matched.instances[fixture.cardsId].properties.catalogSlug,cardSlug);
  assert.equal(matched.instances[fixture.coinsId].properties.catalogSlug,coinSlug);
  assert.equal(matched.instances[fixture.coinsId].properties.catalogProductionType,'printable');
  assert.equal(matched.instances[fixture.coinsId].properties.catalogMatchMode,'fit-template');
  const rowsFit=await panel.evaluate(node=>{
    const footer=node.querySelector('footer').getBoundingClientRect();
    const body=node.querySelector('[data-layout="productionContents"]').getBoundingClientRect();
    return [...node.querySelectorAll('.production-component')].map(row=>{const rect=row.getBoundingClientRect();return {name:row.getAttribute('aria-label'),top:rect.top,bottom:rect.bottom,visible:rect.top>=body.top&&rect.bottom<=footer.top};});
  });
  assert.ok(rowsFit.every(row=>row.visible),`Both component rows fit above the footer at1600×900: ${JSON.stringify(rowsFit)}`);
  await page.screenshot({path:`${artifacts}/one-game-ready.png`});
  await writeFile(`${artifacts}/preview-geometry.json`, JSON.stringify(await panel.locator('[data-layout="productionComponentPreview"]').evaluateAll(nodes=>nodes.map(node=>({html:node.innerHTML.slice(0,1500),bounds:node.getBoundingClientRect().toJSON(),svg:node.querySelector('svg')?.getBoundingClientRect().toJSON(),svgStyle:node.querySelector('svg')&&{height:getComputedStyle(node.querySelector('svg')).height,width:getComputedStyle(node.querySelector('svg')).width},image:node.querySelector('image')?.getBoundingClientRect().toJSON()}))),null,2));
  for (const name of [cardName,coinName]) {
    const preview=article(name).locator('[data-layout="productionComponentPreview"]');
    await preview.scrollIntoViewIfNeeded();
    const geometry=await preview.evaluate(node=>({box:node.getBoundingClientRect().toJSON(),image:node.querySelector('image').getBoundingClientRect().toJSON()}));
    assert.ok(geometry.image.width>20&&geometry.image.height>20&&geometry.image.top>=geometry.box.top&&geometry.image.bottom<=geometry.box.bottom&&geometry.image.left>=geometry.box.left&&geometry.image.right<=geometry.box.right,`${name}: authored image fits visible thumbnail`);
    const previewPath=`${artifacts}/${name===cardName?'card':'coin'}-preview.png`;
    await preview.screenshot({path:previewPath});
    execFileSync('python3',['-c','from PIL import Image; import collections,sys; c=collections.Counter(Image.open(sys.argv[1]).convert("RGB").getdata()); assert c[(211,37,49)]>40 and c[(34,83,208)]>40, "Authored preview artwork is missing"',previewPath],{encoding:'utf8'});
  }
  await bounded('desktop');
  await page.reload();await openOrder();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent==='Download supplier package'&&!x.disabled));
  await page.getByLabel('Game copies to order',{exact:true}).fill('2');
  assert.match(await panel.locator('[data-layout="productionInventorySummary"]').innerText(),/84 pieces/);
  assert.match(await article(cardName).innerText(),/2 decks/);
  assert.match(await article(coinName).innerText(),/2 sheets/);
  assert.match(await article(coinName).innerText(),/24 spare pieces/);
  await page.screenshot({path:`${artifacts}/two-games-ready.png`});
  await page.getByLabel('Game copies to order',{exact:true}).fill('1');
  await article(coinName).getByRole('button',{name:'Unlink',exact:true}).click();
  assert.equal(await exportButton().isEnabled(),false,'Unlink invalidates an earlier ready plan');
  await match(coinName,'tiles','circle','Custom Circle Game Tiles 1" Micro Size','36 tiles/sheet - 1.6mm thick');
  const failureRoute=`**/v1/products/${cardSlug}`;
  await page.route(failureRoute,route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"Regression catalog offline"}'}));
  await button('Refresh supplier details').click();await ready();
  assert.equal(await exportButton().isEnabled(),false,'Missing current catalog data blocks export');
  assert.match(await panel.innerText(),/Some supplier details could not be loaded/);
  assert.doesNotMatch(await panel.innerText(),/\$0\.00/);
  await page.screenshot({path:`${artifacts}/catalog-unavailable.png`});
  await page.unroute(failureRoute);
  await button('Refresh supplier details').click();await ready();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(x=>x.textContent==='Download supplier package'&&!x.disabled));
  await page.setViewportSize({width:760,height:850});
  const narrow=await bounded('760px');
  await page.screenshot({path:`${artifacts}/narrow-order.png`});
  await page.setViewportSize({width:1600,height:900});
  const download=page.waitForEvent('download',{timeout:90000});
  await exportButton().click();
  const file=await download;
  const zipPath=`${artifacts}/${file.suggestedFilename()}`;
  await file.saveAs(zipPath);
  await page.getByText(/Supplier package downloaded:/).waitFor();
  const inspection=JSON.parse(execFileSync('python3',['-',zipPath],{input:inspectZip,encoding:'utf8',maxBuffer:8*1024*1024}));
  await writeFile(`${artifacts}/zip-inspection.json`,JSON.stringify(inspection,null,2));
  await page.screenshot({path:`${artifacts}/package-downloaded.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(catalogWrites,[]);
  const result={passed:true,projectId:fixture.projectId,errors,catalogWrites,zipPath,narrow,inspection};
  await writeFile(`${artifacts}/result.json`,JSON.stringify(result,null,2));
  console.log(`Production browser PASS:42pieces,12spares,6real300dpiartworkfaces,42copyrows,zeroerrors/orders; ${artifacts}`);
} catch(error) {
  await page.screenshot({path:`${artifacts}/failure.png`}).catch(()=>{});
  await writeFile(`${artifacts}/result.json`,JSON.stringify({passed:false,error:String(error),errors,catalogWrites},null,2));
  throw error;
} finally {await context.close();await browser.close();}
