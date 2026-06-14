const GUESTBOOK_ID = process.env.GUESTBOOK_ID || '';
const TOKEN        = process.env.GITHUB_TOKEN || '';
const FILENAME     = 'guestbook.json';

if (!GUESTBOOK_ID || !TOKEN) {
  console.error('Set GITHUB_TOKEN and GUESTBOOK_ID env vars.');
  process.exit(1);
}

const name = process.argv[2]?.trim();
const body = process.argv[3]?.trim();
if (!name || !body) {
  console.error('Usage: node src/guestbook.js "name" "message"');
  process.exit(1);
}

const now = new Date();
const timestamp = `${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

const res = await fetch(`https://api.github.com/gists/${GUESTBOOK_ID}`, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' },
});
if (!res.ok) { console.error('Fetch failed', res.status); process.exit(1); }

const gist    = await res.json();
const current = gist.files[FILENAME] ? JSON.parse(gist.files[FILENAME].content) : [];
const updated = [{ name, body, timestamp }, ...current];

const patch = await fetch(`https://api.github.com/gists/${GUESTBOOK_ID}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(updated, null, 2) } } }),
});
if (!patch.ok) { console.error('Patch failed', patch.status); process.exit(1); }

console.log(`posted: [${timestamp}] ${name}: ${body}`);
