function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

function init() {
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

document.addEventListener('panel:loaded', e => { if (e.detail === 'guestbook') init(); });
init();
