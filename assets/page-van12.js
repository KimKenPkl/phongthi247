/* Tach tu van12.html de bat CSP script-src 'self'. */
(function() {
  const inp = document.getElementById('inpSearch');
  const secs = Array.from(document.querySelectorAll('.van-sec'));
  const stat = document.getElementById('searchStat');
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    let visibleCount = 0;
    secs.forEach(sec => {
      const ps = Array.from(sec.querySelectorAll('.van-subhead, .van-lead, .van-p, tr'));
      if (!q) {
        sec.style.display = '';
        ps.forEach(p => { p.style.display = ''; });
        visibleCount++;
        return;
      }
      let hitSec = false;
      ps.forEach(p => {
        const match = p.textContent.toLowerCase().includes(q);
        p.style.display = match ? '' : 'none';
        if (match) hitSec = true;
      });
      sec.style.display = hitSec ? '' : 'none';
      if (hitSec) visibleCount++;
    });
    stat.textContent = q ? ('Tìm thấy trong ' + visibleCount + '/' + secs.length + ' phần') : (secs.length + ' phần chuyên đề');
  });
})();
