/* guard.js — chống clickjacking cho trang tĩnh.
   GitHub Pages không đặt được header X-Frame-Options hay CSP frame-ancestors,
   nên chặn bằng JavaScript: phá khung lạ; nếu trình duyệt chặn điều hướng thì
   phủ một lớp thông báo để không ai bấm nhầm nội dung bị nhúng.
   Không ảnh hưởng trang mở trực tiếp hoặc nhúng cùng origin. */
(function () {
  'use strict';
  var selfWin = window.self;
  var topWin = window.top;
  if (selfWin === topWin) return;

  var sameOrigin = false;
  try { sameOrigin = topWin.location.origin === selfWin.location.origin; } catch (e) { sameOrigin = false; }
  if (sameOrigin) return;

  try { topWin.location.replace(selfWin.location.href); } catch (e) { /* trình duyệt chặn: dùng lớp phủ */ }

  function cover() {
    if (window.self === window.top) return;
    var host = document.body || document.documentElement;
    if (!host || document.getElementById('ptw-frame-guard')) return;
    var wrap = document.createElement('div');
    wrap.id = 'ptw-frame-guard';
    wrap.setAttribute('role', 'alertdialog');
    wrap.setAttribute('aria-label', 'Trang không cho phép nhúng');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;color:#111;' +
      'font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;' +
      'display:flex;align-items:center;justify-content:center;text-align:center';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:420px';
    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;font-size:18px;margin:0 0 8px';
    title.textContent = 'Trang này không cho phép hiển thị trong khung của website khác.';
    var note = document.createElement('p');
    note.style.cssText = 'margin:0 0 16px;color:#444';
    note.textContent = 'Để làm bài, em mở trực tiếp trang Phòng Thi 24/7.';
    var link = document.createElement('a');
    link.href = selfWin.location.href;
    link.target = '_top';
    link.rel = 'noopener';
    link.textContent = 'Mở trang trực tiếp';
    link.style.cssText = 'display:inline-block;padding:10px 18px;background:#4F46E5;color:#fff;' +
      'border-radius:8px;text-decoration:none;font-weight:600';
    box.appendChild(title);
    box.appendChild(note);
    box.appendChild(link);
    wrap.appendChild(box);
    host.appendChild(wrap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cover);
  else cover();
})();
