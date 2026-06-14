import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const GIST_ID  = process.env.GIST_ID  || '';
const TOKEN    = process.env.GITHUB_TOKEN || '';
const FILENAME = 'rss.json';

if (!GIST_ID || !TOKEN) {
  console.error('Set GITHUB_TOKEN and GIST_ID env vars.');
  process.exit(1);
}

const body = process.argv[2]?.trim();
if (!body) {
  console.error('Usage: node src/post.js "your update here"');
  process.exit(1);
}

const now = new Date();
const date = `${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' },
});
if (!res.ok) { console.error('Fetch failed', res.status); process.exit(1); }

const gist    = await res.json();
const current = JSON.parse(gist.files[FILENAME].content);
const updated = [{ timestamp: date, body }, ...current];

const patch = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(updated, null, 2) } } }),
});
if (!patch.ok) { console.error('Patch failed', patch.status); process.exit(1); }

console.log(`posted: [${date}] ${body}`);
