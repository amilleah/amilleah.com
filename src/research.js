import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const researchDir = path.join(rootDir, 'research');
const bibPath = path.join(researchDir, 'ref.bib');
const outputPath = path.join(researchDir, 'research.md');

const SECTION_ORDER = ['Publications', 'Conference Talks', 'Conference Posters'];
const MONTH_ORDER = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const RESEARCHER_LAST_NAME = 'Rodriguez';
const RESEARCHER_DISPLAY = '**Rodriguez, A.**';

function splitEntries(bibtex) {
  const entries = [];
  let start = -1;
  let depth = 0;

  for (let i = 0; i < bibtex.length; i += 1) {
    const char = bibtex[i];

    if (char === '@' && depth === 0) {
      start = i;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        entries.push(bibtex.slice(start, i + 1).trim());
        start = -1;
      }
    }
  }

  return entries;
}

function parseEntry(entryText) {
  const headerMatch = entryText.match(/^@(\w+)\s*\{\s*([^,]+),/);
  if (!headerMatch) return null;

  const [, type, key] = headerMatch;
  const body = entryText
    .replace(/^@\w+\s*\{\s*[^,]+,/, '')
    .replace(/\}\s*$/, '');

  const fields = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*([\w-]+)\s*=\s*\{(.*)\},?\s*$/);
    if (!match) continue;
    fields[match[1].toLowerCase()] = match[2].trim();
  }

  return { type: type.toLowerCase(), key: key.trim(), fields };
}

function parseBibtex(bibtex) {
  return splitEntries(bibtex)
    .map(parseEntry)
    .filter(Boolean);
}

function normalizeYear(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return numeric;
  if ((value || '').toLowerCase().includes('in prep')) return Number.MAX_SAFE_INTEGER;
  return 0;
}

function normalizeMonth(value) {
  return MONTH_ORDER[(value || '').toLowerCase()] || 0;
}

function compareEntries(a, b) {
  const yearDiff = normalizeYear(b.fields.year) - normalizeYear(a.fields.year);
  if (yearDiff !== 0) return yearDiff;

  const monthDiff = normalizeMonth(b.fields.month) - normalizeMonth(a.fields.month);
  if (monthDiff !== 0) return monthDiff;

  return (a.fields.title || '').localeCompare(b.fields.title || '');
}

async function resolveFileLink(fileValue) {
  if (!fileValue) return null;

  const absolutePath = path.resolve(researchDir, fileValue);
  try {
    await fs.access(absolutePath);
    return path.relative(researchDir, absolutePath);
  } catch {
    return null;
  }
}

function splitAuthors(value) {
  return (value || '')
    .split(/\s+and\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
}

function formatAuthorName(author) {
  const parts = author.split(',').map(part => part.trim()).filter(Boolean);
  const last = parts[0] || '';
  const given = parts[1] || '';
  const initials = given
    .split(/\s+/)
    .map(token => token.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .map(token => `${token[0]}.`)
    .join(' ');

  const formatted = initials ? `${last}, ${initials}` : last;
  return last.toLowerCase() === RESEARCHER_LAST_NAME.toLowerCase() ? RESEARCHER_DISPLAY : formatted;
}

function formatAuthors(value) {
  const authors = splitAuthors(value).map(formatAuthorName);
  if (authors.length <= 1) return authors[0] || '';
  if (authors.length === 2) return `${authors[0]}, & ${authors[1]}`;
  return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
}

function formatTitle(fields) {
  return fields.url ? `[${fields.title}](${fields.url})` : fields.title || '';
}

function formatPublicationVenue(fields) {
  const parts = [];
  if (fields.booktitle) parts.push(fields.booktitle.replace(/^Proceedings of the /i, ''));
  if (fields.year && !String(fields.year).toLowerCase().includes('in prep')) {
    const year = String(fields.year).trim();
    if (parts.length > 0) parts[0] = `${parts[0]}, ${year}`;
    else parts.push(year);
  }
  if (fields.pages) parts.push(fields.pages.replace(/--/g, '-'));
  return parts.join('. ');
}

function formatPresentationVenue(fields) {
  const venue = fields.howpublished || fields.booktitle || '';
  const address = fields.address || '';
  return [venue, address].filter(Boolean).join('. ') + ([venue, address].filter(Boolean).length ? '.' : '');
}

function publicationStatus(fields) {
  const year = String(fields.year || '').trim();
  return year.toLowerCase().includes('in prep') ? 'in prep' : year;
}

function presentationYear(fields) {
  return String(fields.year || '').trim();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

async function formatPublicationRow(entry) {
  const { fields } = entry;
  const status = publicationStatus(fields);
  const title = formatTitle(fields);
  const authors = formatAuthors(fields.author);
  const venue = formatPublicationVenue(fields);
  return [
    '<li class="research-row">',
    `  <div class="research-meta">${inlineMarkdownToHtml(status)}</div>`,
    '  <div class="research-main">',
    `    <div class="research-title">${inlineMarkdownToHtml(title)}</div>`,
    authors ? `    <div class="research-authors">${inlineMarkdownToHtml(authors)}</div>` : '',
    venue ? `    <div class="research-venue">${inlineMarkdownToHtml(venue)}</div>` : '',
    '  </div>',
    '</li>',
  ].filter(Boolean).join('\n');
}

async function formatPresentationRow(entry) {
  const { fields } = entry;
  const year = presentationYear(fields);
  const title = formatTitle(fields);
  const authors = formatAuthors(fields.author);
  const venue = formatPresentationVenue(fields);
  return [
    '<li class="research-row">',
    `  <div class="research-meta">${inlineMarkdownToHtml(year)}</div>`,
    '  <div class="research-main">',
    `    <div class="research-title">${inlineMarkdownToHtml(title)}</div>`,
    authors ? `    <div class="research-authors">${inlineMarkdownToHtml(authors)}</div>` : '',
    venue ? `    <div class="research-venue">${inlineMarkdownToHtml(venue)}</div>` : '',
    '  </div>',
    '</li>',
  ].filter(Boolean).join('\n');
}

async function renderResearchMarkdown(entries) {
  const groups = new Map();
  for (const section of SECTION_ORDER) groups.set(section, []);
  for (const entry of entries) {
    const section = entry.fields.keywords || 'Other';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(entry);
  }

  const publications = (groups.get('Publications') || []).sort(compareEntries);
  const presentations = [
    ...(groups.get('Conference Talks') || []),
    ...(groups.get('Conference Posters') || []),
  ].sort(compareEntries);

  const publicationRows = await Promise.all(publications.map(formatPublicationRow));
  const presentationRows = await Promise.all(presentations.map(formatPresentationRow));

  const lines = [
    '<!-- generated by `pnpm run research` from `research/ref.bib`; edit the bibliography instead -->',
    '',
    '## publications',
    '',
    '<ul class="research-list">',
    ...publicationRows,
    '</ul>',
    '',
    '## presentations',
    '',
    '<ul class="research-list">',
    ...presentationRows,
    '</ul>',
    '',
  ];

  return lines.join('\n');
}

const usage = [
  'generate research/research.md from research/ref.bib',
  '',
  'usage:',
  '  node src/render-research.js',
  '',
  'options:',
  '  -h, --help   show this help text',
].join('\n');

if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log(usage);
} else {
  const bibtex = await fs.readFile(bibPath, 'utf8');
  const entries = parseBibtex(bibtex);
  const markdown = await renderResearchMarkdown(entries);
  await fs.writeFile(outputPath, markdown);
  console.log(`Generated ${path.relative(rootDir, outputPath)} from ${path.relative(rootDir, bibPath)}`);
}
