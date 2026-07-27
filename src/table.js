import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import tzlookup from 'tz-lookup';

// "2018:03:31 15:10:13" (UTC) -> "2018-03-31T15:10:13Z" for sorting
function toIso(utc) {
  const m = String(utc || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : '';
}

// GPS-UTC timestamp "2018:03:31 15:10:14" parsed as UTC.
function parseStamp(s) {
  const m = String(s || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

const offsetLabel = (tz, instant) =>
  (new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(instant).find(p => p.type === 'timeZoneName')?.value || '').replace('GMT', 'UTC');


function toLocalDisplay(utc, date, lat, lon) {
  let tz = null;
  if (lat != null && lon != null) { try { tz = tzlookup(lat, lon); } catch {} }
  const ms = parseStamp(utc);
  if (!Number.isNaN(ms) && tz) {
    const d = new Date(ms);
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d).replace(',', '');
    return `${stamp}${tz ? ' ' + offsetLabel(tz, d) : ''}`;
  }

  const m = String(date || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return '';
  const off = tz ? offsetLabel(tz, new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))) : '';
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}${off ? ' ' + off : ''}`;
}

const round = n => (typeof n === 'number' ? Number(n.toFixed(2)) : null);

// dominant color of an image as [r, g, b] in 0-255
function dominantColor(file) {
  const out = execFileSync('convert', [
    file, '-resize', '100x100', '-depth', '8', '-colors', '6',
    '-format', '%c', 'histogram:info:',
  ], { encoding: 'utf8' });
  let best = [0, 0, 0], bestCount = -1;
  for (const line of out.split('\n')) {
    const m = line.match(/(\d+):\s*\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!m) continue;
    const count = Number(m[1]);
    if (count > bestCount) {
      bestCount = count;
      best = [Math.round(+m[2]), Math.round(+m[3]), Math.round(+m[4])];
    }
  }
  return best;
}

// sRGB (0-255) -> CIE Lab (D65). perceptual, so darks/nights separate cleanly.
function rgbToLab([r, g, b]) {
  const lin = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// neutral tiles first, ordered dark -> light
// then chromatic tiles around the hue wheel and dark -> light
// then saturation
function colorRanks(rgb) {
  const feats = rgb.map(c => {
    const [L, a, b] = rgbToLab(c);
    return { L, C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
  });
  const NEUTRAL = 12;
  const order = rgb.map((_, i) => i).sort((i, j) => {
    const A = feats[i], B = feats[j];
    const an = A.C < NEUTRAL, bn = B.C < NEUTRAL;
    if (an !== bn) return an ? -1 : 1;
    if (an) return A.L - B.L;
    return A.H - B.H || A.L - B.L;
  });
  const rank = new Array(rgb.length);
  order.forEach((i, pos) => { rank[i] = pos; });
  return rank;
}

// longitude west -> east, then latitude north -> south.
function locationRanks(manifest) {
  const order = manifest.map((_, i) => i).sort((i, j) => {
    const a = manifest[i], b = manifest[j];
    const la = a.lon ?? 0, lb = b.lon ?? 0;
    if (la !== lb) return la - lb;
    return (b.lat ?? 0) - (a.lat ?? 0);
  });
  const rank = new Array(manifest.length);
  order.forEach((i, pos) => { rank[i] = pos; });
  return rank;
}

export function makeThumbnail(src, dest, size = 256) {
  execFileSync('convert', [
    src,
    '-resize', `${size}x${size}^`, '-gravity', 'center', '-extent', `${size}x${size}`,
    '-quality', '80', dest,
  ]);
}

export async function buildTable(dir) {
  const thumbDir = path.join(dir, 'thumbnail');
  await fs.mkdir(thumbDir, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));

  const colorsPath = path.join(dir, 'colors.json');
  let colors = {};
  try { colors = JSON.parse(await fs.readFile(colorsPath, 'utf8')); } catch {}

  const makeThumb = (e, thumb) => makeThumbnail(path.join(dir, e.file), thumb);

  let dirty = false;
  for (const e of manifest) {
    const thumb = path.join(thumbDir, e.file);
    try { await fs.access(thumb); } catch { makeThumb(e, thumb); }
    if (Array.isArray(colors[e.file])) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { colors[e.file] = dominantColor(thumb); dirty = true; break; }
      catch {
        if (attempt === 0) { try { makeThumb(e, thumb); } catch {} }
        else { colors[e.file] = [128, 128, 128]; dirty = true; }
      }
    }
  }
  if (dirty) await fs.writeFile(colorsPath, JSON.stringify(colors));

  const rgb = manifest.map(e => colors[e.file]);
  const colorRank = colorRanks(rgb);
  const locRank = locationRanks(manifest);

  return manifest.map((e, i) => {
    const iso = toIso(e.utc) || toIso(e.date);   // fall back to local date when no GPS-UTC
    return {
      index: i,
      file: e.file,
      local: toLocalDisplay(e.utc, e.date, e.lat, e.lon),
      ts: iso ? Date.parse(iso) : 0,
      lat: round(e.lat),
      lon: round(e.lon),
      alt: typeof e.alt === 'number' ? e.alt : null,
      colorRank: colorRank[i],
      locRank: locRank[i],
    };
  });
}
