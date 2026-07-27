const TYPES = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
};
const REPO = process.env.ASSETS_REPO || 'amilleah/rss';

export const handler = async (event) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { statusCode: 500, body: 'not configured' };

  const file = (event.path || '').split('/').pop();
  if (!file || !/^[\w.-]+$/.test(file)) return { statusCode: 400, body: 'bad path' };

  const type = TYPES[file.split('.').pop().toLowerCase()];
  if (!type) return { statusCode: 415, body: 'unsupported type' };

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' },
  });
  if (!res.ok) return { statusCode: res.status === 404 ? 404 : 502, body: 'not found' };

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    statusCode: 200,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: buf.toString('base64'),
    isBase64Encoded: true,
  };
};
