import path from 'node:path';
import { promises as fs } from 'node:fs';
import imageSize from 'image-size';
import getVideoDimensions from 'get-video-dimensions';
import parse from 'parse-gitignore';
import micromatch from 'micromatch';
import prettyBytes from 'pretty-bytes';

const IMAGE_EXTENSIONS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'apng', 'svg', 'bmp', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const NATURAL_COMPARE_OPTIONS = { numeric: true, sensitivity: 'base' };

export function compareNamesNatural(a, b) {
  return a.localeCompare(b, undefined, NATURAL_COMPARE_OPTIONS);
}

export async function readIgnorePatterns(rootDir) {
  const readPatterns = async fileName => {
    try {
      const contents = await fs.readFile(path.join(rootDir, fileName), 'utf8');
      return parse(contents).patterns;
    } catch {
      return [];
    }
  };

  const [gitignore, gardenignore] = await Promise.all([
    readPatterns('.gitignore'),
    readPatterns('.gardenignore'),
  ]);

  return { gitignore, gardenignore };
}

export function createIgnoreMatcher({ gitignore = [], gardenignore = [] }) {
  return function isIgnored(name, isDir = false) {
    return micromatch.isMatch(name, gitignore) ||
      micromatch.isMatch(name, gardenignore) ||
      (isDir && (
        micromatch.isMatch(`${name}/`, gitignore) ||
        micromatch.isMatch(`${name}/`, gardenignore)
      ));
  };
}

export function getExtension(fileName) {
  return fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
}

export function createBaseFileInfo(fileName, stats) {
  return {
    path: fileName,
    name: fileName,
    size: prettyBytes(stats.size, { space: false }),
    ext: getExtension(fileName),
  };
}

export async function addMediaMetadata(fileInfo, filePath) {
  if (IMAGE_EXTENSIONS.has(fileInfo.ext)) {
    fileInfo.type = 'image';
    try {
      const dimensions = imageSize(filePath);
      fileInfo.width = dimensions.width;
      fileInfo.height = dimensions.height;
      if (dimensions.orientation === 6 || dimensions.orientation === 8) {
        [fileInfo.width, fileInfo.height] = [fileInfo.height, fileInfo.width];
      }
    } catch (error) {
      console.log('Error reading image:', filePath, error);
    }
    return fileInfo;
  }

  if (VIDEO_EXTENSIONS.has(fileInfo.ext)) {
    fileInfo.type = 'video';
    try {
      const dimensions = await getVideoDimensions(filePath);
      fileInfo.width = dimensions.width;
      fileInfo.height = dimensions.height;
    } catch (error) {
      console.log('Error reading video:', filePath, error);
    }
    return fileInfo;
  }

  if (AUDIO_EXTENSIONS.has(fileInfo.ext)) {
    fileInfo.type = 'audio';
  }

  return fileInfo;
}

export async function collectDirectoryTree(rootPath, {
  currDir = '',
  depth = 3,
  isIgnored,
  readFileInfo,
  shouldIncludeEntry,
} = {}) {
  if (depth < 0) return [];

  const currentPath = path.join(rootPath, currDir);
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  const directories = [];
  const files = [];

  for (const entry of entries) {
    if (shouldIncludeEntry && !(await shouldIncludeEntry(entry, currentPath, entries))) continue;
    if (isIgnored?.(entry.name, entry.isDirectory())) continue;
    if (entry.isDirectory()) directories.push(entry.name);
    if (entry.isFile()) files.push(entry.name);
  }

  const processedDirectories = await Promise.all(directories.map(async directoryName => {
    const children = await collectDirectoryTree(rootPath, {
      currDir: path.join(currDir, directoryName),
      depth: depth - 1,
      isIgnored,
      readFileInfo,
      shouldIncludeEntry,
    });

    return {
      path: `${directoryName}/`,
      name: `${directoryName}/`,
      type: 'directory',
      contents: children.length === 0 ? 'empty' : `${children.length} item${children.length !== 1 ? 's' : ''}`,
      children,
    };
  }));

  const processedFiles = await Promise.all(files.map(fileName => {
    return readFileInfo(fileName, currentPath);
  }));

  return [...processedDirectories, ...processedFiles].sort((a, b) => compareNamesNatural(a.name, b.name));
}
