import ejs from 'ejs';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readTemplate(name) {
  const file = path.join(ROOT, 'views', `${name}.ejs`);
  return ejs.compile(await fs.readFile(file, 'utf8'), { filename: file });
}

async function main() {
  const [index, project, guestbook] = await Promise.all([
    readTemplate('index'),
    readTemplate('project'),
    readTemplate('guestbook'),
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

  let cvUpdated = '';
  try {
    const stat = await fs.stat(path.join(ROOT, 'research', 'amilleahrodriguez_cv.pdf'));
    const d = stat.mtime;
    cvUpdated = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {}

  const gistId = process.env.GIST_ID || '';
  await fs.writeFile(path.join(ROOT, 'index.html'), index({ projects, cvUpdated, gistId }));

  const gbData = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'guestbook.json'), 'utf8'));
  const gbDir = path.join(ROOT, 'guestbook');
  await fs.mkdir(gbDir, { recursive: true });
  await fs.writeFile(path.join(gbDir, 'index.html'), guestbook({ entries: gbData.entries }));

  const photoDir = path.join(ROOT, 'projects', 'photos');
  const thumbDir = path.join(photoDir, 'thumbnail');
  await fs.mkdir(thumbDir, { recursive: true });
  const photoFiles = (await fs.readdir(photoDir)).filter(f => /\.(webp|jpe?g|png|gif)$/i.test(f));
  for (const file of photoFiles) {
    const thumb = path.join(thumbDir, file);
    try { await fs.access(thumb); } catch {
      execFileSync('convert', [
        path.join(photoDir, file),
        '-resize', '384x384^', '-gravity', 'center', '-extent', '384x384',
        '-quality', '80', thumb,
      ]);
    }
  }

  const photosData = bySlug['photos'];
  if (photosData) {
    try {
      const entries = await fs.readdir(photoDir);
      photosData.photos = entries
        .filter(f => /\.(webp|jpe?g|png|gif)$/i.test(f))
        .sort((a, b) => parseInt(a) - parseInt(b));
    } catch {
      photosData.photos = [];
    }
  }

  const zinesData = bySlug['zines'];
  if (zinesData?.items?.length) {
    await Promise.all(zinesData.items.map(async item => {
      const frameDir = path.join(ROOT, 'projects', zinesData.slug, item.slug);
      try {
        const entries = await fs.readdir(frameDir);
        item.frames = entries.filter(f => f.startsWith('frame-') && f.endsWith('.png')).length;
      } catch {
        item.frames = 0;
      }
    }));
  }

  await Promise.all(Object.values(bySlug).map(async p => {
    const dir = path.join(ROOT, 'projects', p.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), project({ project: p }));
  }));
}

main().catch(err => { console.error(err); process.exit(1); });
