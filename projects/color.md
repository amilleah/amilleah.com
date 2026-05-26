## color

Color search for the Princeton University Art Museum collection. Uses mean shift clustering to extract dominant colors from each artwork, then lets you browse the archive by color through LAB colorspace. The index is rebuilt monthly as PUAM updates their (free) API.

[color.amilleah.com](https://color.amilleah.com)

Also applied to Are.na:

<style>
  .arena-channels { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .arena-label {
    display: flex; align-items: center; gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.78rem; color: var(--muted); margin-bottom: 0.35rem;
    text-decoration: none;
  }
  .arena-label:hover { color: var(--link-hover); }
  .arena-swatch { display: inline-block; width: 0.45rem; height: 0.45rem; border-radius: 50%; flex-shrink: 0; }
  .arena-scroll { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; }
  .arena-scroll::-webkit-scrollbar { display: none; }
  .arena-img { height: 4rem; width: auto; flex-shrink: 0; display: block; object-fit: cover; background: var(--line); }
  .arena-count { opacity: 0.5; }
</style>

<div class="arena-channels" id="arena-channels"></div>

<script type="module">
const channels = [
  { slug: 'ff0077', color: '#ff0077' },
  { slug: 'ecfa23', color: '#ecfa23' },
  { slug: 'df4a16', color: '#df4a16' },
  { slug: '4f7a28', color: '#4f7a28'}
]

const container = document.getElementById('arena-channels')

for (const ch of channels) {
  const row = document.createElement('div')

  const label = document.createElement('a')
  label.href = `https://www.are.na/amilleah/${ch.slug}`
  label.target = '_blank'
  label.rel = 'noopener noreferrer'
  label.className = 'arena-label'
  label.innerHTML = `<span class="arena-swatch" style="background:${ch.color}"></span>${ch.color} <span class="arena-count"></span>`

  const scroll = document.createElement('div')
  scroll.className = 'arena-scroll'

  row.appendChild(label)
  row.appendChild(scroll)
  container.appendChild(row)

  fetch(`https://api.are.na/v2/channels/${ch.slug}?per=50`)
    .then(r => r.json())
    .then(data => {
      const countEl = label.querySelector('.arena-count')
      if (countEl) countEl.textContent = `(${data.length})`
      const blocks = (data.contents || []).filter(b => b.class === 'Image' && b.image)
      for (const block of blocks) {
        const img = document.createElement('img')
        img.src = block.image.thumb?.url || block.image.display?.url || ''
        img.alt = block.title || ''
        img.className = 'arena-img'
        scroll.appendChild(img)
      }
    })
}
</script>