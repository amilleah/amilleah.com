const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const GH_ATTACHMENT = /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+$/;
const SITE = 'https://amilleah.com';

function renderBody(body) {
  let hasImage = false;
  let html = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (!GH_ATTACHMENT.test(src)) return escape(match);
    hasImage = true;
    return `<img src="${src}" alt="${alt.replace(/"/g, '&quot;')}">`;
  });
  if (/<img\b[^>]*\bsrc="\/rss\/img\/[\w.-]+"/.test(html)) {
    hasImage = true;
    html = html.replace(/(<img\b[^>]*\bsrc=")(\/rss\/img\/[\w.-]+)"/g, `$1${SITE}$2"`);
  }
  return hasImage ? `<![CDATA[${html}]]>` : escape(body);
}

export const handler = async () => {
  const gistId = process.env.GIST_ID;
  if (!gistId) return { statusCode: 500, body: 'not configured' };

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return { statusCode: 502, body: 'upstream error' };

  const gist = await res.json();
  const file = gist.files['rss.json'];
  if (!file) return { statusCode: 500, body: 'rss.json not found in gist' };
  const items = JSON.parse(file.content);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>amilleah</title>
    <link>https://amilleah.com</link>
    <description>amilleah's feed</description>
${items.map(item => `    <item>
      <guid isPermaLink="false">${escape(item.timestamp)}</guid>
      <title>${escape(item.timestamp)}</title>
      <description>${renderBody(item.body)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    body: xml,
  };
};
