/* Tach tu gioi-thieu.html de bat CSP script-src 'self'. */
/* Nếu đề dùng thử đang bị ẩn trong data/exams.json thì bỏ các nút dẫn vào đề. */
fetch('data/exams.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(d => {
    const demo = (d.exams || []).find(x => x.id === 'dung-thu');
    if (demo && !demo.hidden) return;
    document.querySelectorAll('[data-demo-cta]').forEach(el => el.remove());
    const note = document.getElementById('libraryHiddenNote');
    if (note) note.hidden = false;
  })
  .catch(() => {});
