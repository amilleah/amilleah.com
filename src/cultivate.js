import path from 'path';
import { promises as fs } from 'fs';
import ejs from 'ejs';
import { marked } from 'marked';
import {
    addMediaMetadata,
    collectDirectoryTree,
    compareNamesNatural,
    createBaseFileInfo,
    createIgnoreMatcher,
    readIgnorePatterns,
} from './core/garden.js';
marked.use({ async: true, mangle: false, headerIds: false });

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GARDEN_DIR = path.join(__dirname, '..');

function slug(name) {
    return name.replace(/\.md$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function parseFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: text };
    const fm = {};
    let currentKey = null, inList = false;
    for (const line of match[1].split('\n')) {
        const listMatch = line.match(/^\s+-\s+(.+)/);
        const kvMatch = line.match(/^([\w_]+):\s*(.*)/);
        if (listMatch && inList && currentKey) {
            if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
            fm[currentKey].push(listMatch[1].trim());
        } else if (kvMatch) {
            currentKey = kvMatch[1];
            const val = kvMatch[2].trim();
            fm[currentKey] = val === '' ? [] : val;
            inList = val === '';
        }
    }
    return { frontmatter: fm, body: match[2] };
}

function renderInlineVars(text) {
    return text.replace(/\(([\w-]+)::\s*([^)]+)\)/g, (_match, key, value) => {
        return `<span class="inline-var"><span class="inline-var__key">${key}::</span> <span class="inline-var__value">${value}</span></span>`;
    });
}

function countWhenEntries(text) {
    const matches = text.match(/\(when::\s*[^)]+\)\s*\S/g);
    return matches ? matches.length : 0;
}

async function loadMarkdownSource(filePath, source) {
    if (!source || typeof source !== 'string') return '';
    const trimmed = source.trim();
    if (!trimmed) return '';

    if (/^https?:\/\//i.test(trimmed)) {
        if (typeof fetch !== 'function') return '';
        const response = await fetch(trimmed);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${trimmed}`);
        }
        return await response.text();
    }

    const resolvedPath = path.resolve(path.dirname(filePath), trimmed);
    return await fs.readFile(resolvedPath, 'utf8');
}

function normalizeImportSources(value) {
    if (!value) return [];
    return Array.isArray(value)
        ? value.map(entry => String(entry).trim()).filter(Boolean)
        : [String(value).trim()].filter(Boolean);
}

const TEMPLATE = ejs.compile(await fs.readFile(path.join(GARDEN_DIR, 'views', 'page.ejs'), 'utf8'));
const IGNORE_PATTERNS = await readIgnorePatterns(GARDEN_DIR);
const isIgnored = createIgnoreMatcher(IGNORE_PATTERNS);

let SIDEBAR_LINKS_HTML = '';
try {
    const { body } = parseFrontmatter(await fs.readFile(path.join(GARDEN_DIR, 'links.md'), 'utf8'));
    SIDEBAR_LINKS_HTML = await marked.parse(body);
} catch {}

async function cultivateFile(fileName, currPath) {
    const filePath = path.join(currPath, fileName);
    const stats = await fs.stat(filePath);
    const fileInfo = createBaseFileInfo(fileName, stats);

    await addMediaMetadata(fileInfo, filePath);
    if (fileInfo.type) return fileInfo;

    switch (fileInfo.ext) {
        case 'md': {
            const raw = await fs.readFile(filePath, 'utf8');
            const { frontmatter, body } = parseFrontmatter(raw);
            let mdBody = body;
            if (fileName === 'now.md') {
                fileInfo.nowEntryCount = countWhenEntries(body);
            }
            const importSources = normalizeImportSources(frontmatter.import_markdown);
            for (const source of importSources) {
                try {
                    const importedRaw = await loadMarkdownSource(filePath, source);
                    const { body: importedBody } = parseFrontmatter(importedRaw);
                    if (importedBody.trim()) {
                        mdBody = `${mdBody.trim()}\n\n---\n\n${importedBody}`;
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.log(`Warning: could not import markdown source ${source} (${message})`);
                }
            }
            if (Array.isArray(frontmatter.who_am_i) && frontmatter.who_am_i.length) {
                const whoHtml = `<span class="who-am-i-rotator">${
                    frontmatter.who_am_i.map((r, i) => {
                        const article = /^[aeiou]/i.test(r) ? 'an' : 'a';
                        return `<span class="who-am-i-item${i === 0 ? ' who-am-i-item--active' : ''}">${article} <span class="who-am-i">${r}</span></span>`;
                    }).join('')
                }</span>`;
                mdBody = mdBody.replace('<!-- who-am-i -->', whoHtml);
            }
            if (Array.isArray(frontmatter.sunday_entries) && frontmatter.sunday_entries.length) {
                const sorted = [...frontmatter.sunday_entries].sort((a, b) => b.localeCompare(a));
                const listHtml = sorted.map(entry => {
                    const [date, ...rest] = entry.split(' ');
                    const name = rest.join(' ');
                    const inlineDate = `<span class="inline-var"><span class="inline-var__key">when::</span> <span class="inline-var__value">${date}</span></span>`;
                    return `<p>${inlineDate} <a href="/projects/sunday/${name}/">${name}</a></p>`;
                }).join('\n');
                mdBody = mdBody.replace('<!-- sunday-list -->', listHtml);
            }
            if (frontmatter.redirect) {
                fileInfo.type = 'redirect';
                fileInfo.redirect = frontmatter.redirect;
                break;
            }
            mdBody = renderInlineVars(mdBody);
            fileInfo.type = 'markdown';
            fileInfo.subtitle = frontmatter.subtitle ? await marked.parseInline(frontmatter.subtitle) : '';
            fileInfo.contents = await marked.parse(mdBody);
            break;
        }

        case '':
            if (fileName === 'LICENSE') { fileInfo.type = 'other'; break; }
            fileInfo.type = 'raw';
            try { fileInfo.contents = await fs.readFile(filePath, 'utf8'); }
            catch (e) { console.log('Error reading file:', filePath, e); }
            break;

        case 'txt': default:
            fileInfo.type = 'other';
    }

    return fileInfo;
}

async function collect(rootPath, currDir = '', depth = 6) {
    return collectDirectoryTree(rootPath, {
        currDir,
        depth,
        isIgnored,
        readFileInfo: cultivateFile,
        shouldIncludeEntry: async (entry, currentPath, entries) => {
            if (!entry.isDirectory()) return true;

            const siblingMarkdown = entries.find(candidate => {
                return candidate.isFile() && candidate.name === `${entry.name}.md`;
            });
            return !siblingMarkdown;
        },
    });
}

async function render(rootPath, rootFiles, currDir = '', urlBase = '/', relativePath = '.', depth = 6) {
    if (depth < 0) return;

    const currPath = path.join(rootPath, currDir);
    const unsortedFiles = currDir === ''
        ? rootFiles
        : (() => {
            const parts = currDir.split(path.sep);
            let node = rootFiles;
            for (const part of parts) {
                const dir = node.find(f => f.name === part + '/');
                if (!dir) return [];
                node = dir.children || [];
            }
            return node;
        })();

    const pageSlug = currDir ? path.basename(currDir) : '';
    const pageFileName = pageSlug ? `${pageSlug}.md` : '';
    const allFiles = [...unsortedFiles].sort((a, b) => {
        if (pageFileName) {
            if (a.type === 'markdown' && a.name === pageFileName) return -1;
            if (b.type === 'markdown' && b.name === pageFileName) return 1;
        }
        return compareNamesNatural(a.name, b.name);
    });

    const fileCount = allFiles.length;
    if (fileCount === 0) return;

    const title = relativePath !== '.' ? relativePath + '/' : '';
    const pageAlias = currDir === ''
        ? allFiles.find(f => f.type === 'markdown' && f.name === 'amilleah.md')
        : pageFileName ? allFiles.find(f => f.type === 'markdown' && f.name === pageFileName) : null;
    const contentFiles = pageAlias
        ? (currDir === '' ? allFiles.filter(f => f.type === 'markdown') : [pageAlias])
        : allFiles.filter(f => f.type !== 'redirect');
    const html = TEMPLATE({ title, files: contentFiles, sidebarLinksHtml: SIDEBAR_LINKS_HTML, rootFiles, urlBase });
    const outputPath = path.join(currPath, 'index.html');
    try {
        console.log('Read', fileCount, 'files from', relativePath);
        await fs.writeFile(outputPath, html);
        console.log('\tPlanted', path.join(relativePath, 'index.html'));
    } catch (err) {
        console.log(`Could not plant ${outputPath}:\n\t${err}`);
    }

    for (const dir of allFiles.filter(f => f.type === 'directory')) {
        const dirName = dir.name.replace(/\/$/, '');
        await render(
            rootPath, rootFiles,
            path.join(currDir, dirName),
            urlBase + dirName + '/',
            path.join(relativePath, dirName),
            depth - 1
        );
    }

    for (const file of allFiles.filter(f => f.type === 'redirect')) {
        const fileSlug = slug(file.name);
        if (!fileSlug) continue;
        const pageDir = path.join(currPath, fileSlug);
        const redirectHtml = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${file.redirect}"><script>window.location.replace(${JSON.stringify(file.redirect)})<\/script></head><body></body></html>`;
        try {
            await fs.mkdir(pageDir, { recursive: true });
            await fs.writeFile(path.join(pageDir, 'index.html'), redirectHtml);
            console.log('\tPlanted redirect', path.join(relativePath, fileSlug, 'index.html'), '->', file.redirect);
        } catch (err) {
            console.log(`Could not plant redirect ${path.join(pageDir, 'index.html')}:\n\t${err}`);
        }
    }

    for (const file of allFiles.filter(f => f.type === 'markdown' && f.name !== 'links.md')) {
        const fileSlug = slug(file.name);
        if (!fileSlug) continue;
        if (file.name === pageFileName) continue;
        if (currDir === '' && file.name === 'amilleah.md') continue;

        const pageDir = path.join(currPath, fileSlug);
        const pageUrl = urlBase + fileSlug + '/';
        const pageTitle = path.join(relativePath, fileSlug) + '/';
        const pageHtml = TEMPLATE({
            title: pageTitle !== './' ? pageTitle : '',
            files: [file],
            sidebarLinksHtml: SIDEBAR_LINKS_HTML,
            rootFiles,
            urlBase: pageUrl,
        });

        try {
            await fs.mkdir(pageDir, { recursive: true });
            await fs.writeFile(path.join(pageDir, 'index.html'), pageHtml);
            console.log('\tPlanted', path.join(relativePath, fileSlug, 'index.html'));
        } catch (err) {
            console.log(`Could not plant ${path.join(pageDir, 'index.html')}:\n\t${err}`);
        }
    }

}

async function cultivateHelper(root) {
    const stats = await fs.stat(root);
    if (!stats.isDirectory()) { console.error(`invalid directory ${root}`); return; }
    const rootFiles = await collect(root);
    await render(root, rootFiles);
}

const usage = [
    'turn a directory into a garden',
    '',
    'usage:',
    '  node src/cultivate.js DIR',
    '',
    'options:',
    '  -h, --help   show this help text',
    '',
    'notes:',
    '  writes an index.html file into DIR and nested folders',
    '  respects .gitignore and .gardenignore patterns',
].join('\n');

if (process.argv.includes('-h') || process.argv.includes('--help')) {
    console.log(usage);
} else if (process.argv.length === 3) {
    try {
        await cultivateHelper(await fs.realpath(process.argv[2]));
    } catch (err) {
        console.error(`invalid directory ${process.argv[2]}\n`, err);
    }
} else {
    console.log(usage);
}
