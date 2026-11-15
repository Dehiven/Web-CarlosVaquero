// Genera assets del portfolio: foto en WebP y captura de proyectos.
// Uso: node scripts/assets.mjs
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

// Foto → WebP con el codificador del navegador (sin dependencias extra)
const png = await readFile('Foto_perfil.png').catch(() => readFile('site/assets/foto.png'));
const webp = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  c.getContext('2d').drawImage(img, 0, 0);
  return { url: c.toDataURL('image/webp', 0.86), w: c.width, h: c.height };
}, png.toString('base64'));
if (!webp.url.startsWith('data:image/webp')) throw new Error('El navegador no codificó WebP');
await writeFile('site/assets/foto.webp', Buffer.from(webp.url.split(',')[1], 'base64'));
console.log('foto.webp', webp.w, 'x', webp.h);

// Capturas de proyectos (1600x1000, primera pantalla)
const projects = [['https://docselemental.com', 'site/assets/work/docselemental.webp']];
for (const [url, out] of projects) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500); // deja terminar las animaciones de entrada
  const shot = await page.screenshot({ type: 'png' });
  const data = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.86);
  }, shot.toString('base64'));
  await writeFile(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out);
}

await browser.close();
