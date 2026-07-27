import { readFileSync } from 'fs';
import path from 'path';

const GIST_ID     = process.env.GIST_ID  || '';
const TOKEN       = process.env.GITHUB_TOKEN || '';
const ASSETS_REPO = process.env.ASSETS_REPO || 'amilleah/rss';
const FILENAME    = 'rss.json';

if (!GIST_ID || !TOKEN) {
  console.error('Set GITHUB_TOKEN and GIST_ID env vars.');
  process.exit(1);
}

const body      = process.argv[2]?.trim();
const imagePath = process.argv[3]?.trim();
if (!body) {
  console.error('Usage: node src/post.js "your update here" [path/to/image]');
  process.exit(1);
}

const gh = (url, opts = {}) =>
  fetch(`https://api.github.com${url}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });

async function uploadImage(localPath) {
  const buf      = readFileSync(localPath);
  const filename = `${Date.now()}-${path.basename(localPath).replace(/[^\w.-]/g, '_')}`;

  if ((await gh(`/repos/${ASSETS_REPO}`)).status === 404) {
    const name = ASSETS_REPO.split('/')[1];
    const mk = await gh('/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name, private: true, auto_init: true, description: 'rss feed images' }),
    });
    if (!mk.ok) { console.error('Repo create failed', mk.status, await mk.text()); process.exit(1); }
  }

  const ref = await (await gh(`/repos/${ASSETS_REPO}/git/refs/heads/main`)).json();
  const baseSha = ref.object?.sha;
  if (!baseSha) { console.error('Could not read main ref of', ASSETS_REPO); process.exit(1); }

  const blob = await (await gh(`/repos/${ASSETS_REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
  })).json();

  const tree = await (await gh(`/repos/${ASSETS_REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseSha,
      tree: [{ path: filename, mode: '100644', type: 'blob', sha: blob.sha }],
    }),
  })).json();

  const commit = await (await gh(`/repos/${ASSETS_REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: `add ${filename}`, tree: tree.sha, parents: [baseSha] }),
  })).json();

  const upd = await gh(`/repos/${ASSETS_REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  if (!upd.ok) { console.error('Ref update failed', upd.status, await upd.text()); process.exit(1); }

  return `/rss/img/${filename}`;
}

const now = new Date();
const date = `${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

let finalBody = body;
if (imagePath) {
  const url = await uploadImage(imagePath);
  finalBody = `${body} <img alt="" src="${url}" style="max-width:100%" />`;
}

const res = await gh(`/gists/${GIST_ID}`);
if (!res.ok) { console.error('Fetch failed', res.status); process.exit(1); }

const gist    = await res.json();
const current = JSON.parse(gist.files[FILENAME].content);
const updated = [{ timestamp: date, body: finalBody }, ...current];

const patch = await gh(`/gists/${GIST_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(updated, null, 2) } } }),
});
if (!patch.ok) { console.error('Patch failed', patch.status); process.exit(1); }

console.log(`posted: [${date}] ${finalBody}`);
