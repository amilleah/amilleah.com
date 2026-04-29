import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PHOTOS_DIR = path.join(ROOT, 'photos')
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs')

await fs.mkdir(THUMBS_DIR, { recursive: true })

const files = (await fs.readdir(PHOTOS_DIR)).filter(f => f.endsWith('.webp'))
await Promise.all(files.map(async f => {
  const dst = path.join(THUMBS_DIR, f)
  try { await fs.access(dst); return } catch {}
  await sharp(path.join(PHOTOS_DIR, f))
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(dst)
  console.log('thumb', f)
}))
