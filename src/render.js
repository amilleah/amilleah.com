import ejs from 'ejs';
import { promises as fs } from 'fs';
import path from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { buildTable } from './table.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readTemplate(name) {
  const file = path.join(ROOT, 'views', `${name}.ejs`);
  return ejs.compile(await fs.readFile(file, 'utf8'), { filename: file });
}

async function main() {
  const [index, project, guestbook, notFound] = await Promise.all([
    readTemplate('index'),
    readTemplate('project'),
    readTemplate('guestbook'),
    readTemplate('404'),
  ]);

  const contentDir = path.join(ROOT, 'content');
  const files = (await fs.readdir(contentDir))
    .filter(f => f.endsWith('.json') && f !== 'home.json' && f !== 'guestbook.json' && !f.startsWith('_'));

  const bySlug = Object.fromEntries(
    await Promise.all(files.map(async f => {
      const data = JSON.parse(await fs.readFile(path.join(contentDir, f), 'utf8'));
      return [data.slug, data];
    }))
  );

  const home = JSON.parse(await fs.readFile(path.join(contentDir, 'home.json'), 'utf8'));

  const byDate = (a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') ||
    (a.slug ?? '').localeCompare(b.slug ?? '');

  const projects = (home.projects ?? [])
    .map(s => bySlug[s] ?? { slug: s })
    .sort(byDate);

  const pages = (home.pages ?? [])
    .map(s => bySlug[s] ?? { slug: s });

  const toSite = s => (typeof s === 'string' ? { name: s, url: `https://${s}` } : s);
  const sites = (home.sites ?? []).map(toSite);
  const media = (home.media ?? []).map(toSite);

  let cvUpdated = '';
  try {
    const stat = await fs.stat(path.join(ROOT, 'research', 'amilleahrodriguez_cv.pdf'));
    const d = stat.mtime;
    cvUpdated = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {}

  const gistId = process.env.GIST_ID || '';
  await fs.writeFile(path.join(ROOT, 'index.html'), index({ projects, pages, sites, cvUpdated, gistId }));
  await fs.writeFile(path.join(ROOT, '404.html'), notFound({ projects, pages, sites, cvUpdated, haiku: home.haiku ?? [] }));

  const guestbookId = process.env.GUESTBOOK_ID || '';
  const gbDir = path.join(ROOT, 'guestbook');
  await fs.mkdir(gbDir, { recursive: true });
  await fs.writeFile(path.join(gbDir, 'index.html'), guestbook({ guestbookId }));

  const zinesData = bySlug['zines'];
  if (zinesData?.items?.length) {
    await Promise.all(zinesData.items.map(async item => {
      const frameDir = path.join(ROOT, 'projects', zinesData.slug, item.slug);
      try {
        const entries = await fs.readdir(frameDir);
        item.frames = entries.filter(f => f.startsWith('frame-') && f.endsWith('.webp')).length;
      } catch {
        item.frames = 0;
      }
    }));
  }

  const hereData = bySlug['here'];
  if (hereData) {
    try {
      hereData.tiles = await buildTable(path.join(ROOT, 'projects', 'here', hereData.itemsDir || 'items'));
    } catch (err) {
      console.error('here tiles:', err.message);
      hereData.tiles = [];
    }
  }

  await Promise.all(Object.values(bySlug).map(async p => {
    const mdPath = path.join(ROOT, 'projects', p.slug, `${p.slug}.md`);
    try { p.body = marked.parse(await fs.readFile(mdPath, 'utf8')); } catch {}
  }));

  await Promise.all(Object.values(bySlug).map(async p => {
    const dir = path.join(ROOT, 'projects', p.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), project({ project: p }));
  }));
}

main().catch(err => { console.error(err); process.exit(1); });
