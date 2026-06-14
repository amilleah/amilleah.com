function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

function initForm() {
  const textarea = document.querySelector('textarea[name="message"]');
  if (!textarea) return;
  const counter = textarea.nextElementSibling;
  const form    = textarea.closest('form');

  form.addEventListener('submit', e => {
    if (wordCount(textarea.value) > 200) { e.preventDefault(); counter.classList.add('over'); }
  });

  textarea.addEventListener('input', () => {
    const left = 200 - wordCount(textarea.value);
    counter.textContent = left + ' words left';
    counter.classList.toggle('over', left < 0);
  });
}

async function loadLog() {
  const logEl = document.getElementById('guestbook-log');
  const gistId = logEl?.dataset.gistId;
  if (!logEl || !gistId) return;
  try {
    const res   = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    const gist  = await res.json();
    const file  = gist.files['guestbook.json'];
    if (!file) return;
    const entries = JSON.parse(file.content);
    logEl.innerHTML = entries.map(entry =>
      `<p><span class="--muted" style="margin-right:2em">${entry.timestamp}</span>${entry.name}: ${entry.body}</p>`
    ).join('<hr>');
  } catch {}
}

function init() {
  initForm();
  loadLog();
}

document.addEventListener('panel:loaded', e => { if (e.detail === 'guestbook') init(); });
init();
