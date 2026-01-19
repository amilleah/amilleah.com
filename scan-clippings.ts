import fs from 'node:fs/promises';
import path from 'node:path';

const CLIPPINGS_DIR = './public/images/clippings';
const OUTPUT_FILE = './src/data/lexicon.json';

interface Clipping {
  id: string;
  word: string;
  source: string;
  src: string;
  rotation: number;
}

async function scan() {
  try {
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

    const lexicon: Clipping[] = [];
    
    try {
        await fs.access(CLIPPINGS_DIR);
    } catch {
        process.exit(1);
    }

    const sources = await fs.readdir(CLIPPINGS_DIR, { withFileTypes: true });

    for (const source of sources) {
      if (!source.isDirectory()) continue;

      const sourcePath = path.join(CLIPPINGS_DIR, source.name);
      const files = await fs.readdir(sourcePath);

      for (const file of files) {
        if (!file.match(/\.(png|jpg|jpeg|gif|webp)$/)) continue;

        const fileName = path.parse(file).name;
        
        lexicon.push({
          id: `${source.name}-${fileName}`,
          word: fileName.toLowerCase(),
          source: source.name,
          src: `/images/clippings/${source.name}/${file}`,
          rotation: Math.random() * 6 - 3 
        });
      }
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(lexicon, null, 2));

  } catch (err) {
    process.exit(1);
  }
}

scan();