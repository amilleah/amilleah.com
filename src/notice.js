import { execFileSync } from 'child_process';

const GIST_ID  = process.env.GIST_ID || '';
const TOKEN    = process.env.GITHUB_TOKEN || '';
const FILENAME = 'rss.json';

const git = args => execFileSync('git', args).toString().trim();

try {
  if (!GIST_ID || !TOKEN) {
    console.log('notice: GIST_ID/GITHUB_TOKEN not set, skipping');
    process.exit(0);
  }

  const head = process.env.COMMIT_REF || git(['rev-parse', 'HEAD']);
  const prev = process.env.CACHED_COMMIT_REF || '';

  let subjects;
  try {
    subjects = prev && prev !== head
      ? git(['log', '--pretty=%s', `${prev}..${head}`]).split('\n').filter(Boolean)
      : [git(['log', '-1', '--pretty=%s', head])];
  } catch {
    subjects = [git(['log', '-1', '--pretty=%s'])];
  }
  if (!subjects.length) process.exit(0);

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
  if (!res.ok) { console.log('notice: gist fetch failed', res.status); process.exit(0); }

  const gist    = await res.json();
  const current = JSON.parse(gist.files[FILENAME].content);

  if (current.some(item => item.commit === head)) {
    console.log('notice: already posted for', head.slice(0, 7));
    process.exit(0);
  }

  const now  = new Date();
  const date = `${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  const body = `site update: ${subjects.join(', ')}`;

  const updated = [{ timestamp: date, body, commit: head }, ...current];

  const patch = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(updated, null, 2) } } }),
  });
  if (!patch.ok) { console.log('notice: gist patch failed', patch.status); process.exit(0); }

  console.log(`notice: posted "${body}"`);
} catch (err) {
  console.log('notice: skipped —', err.message);
  process.exit(0);
}
