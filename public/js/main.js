/**
 * main.js – Client-side enhancements.
 *
 * Keeps things lightweight: no frameworks, no build step.
 * All logic is progressive enhancement on top of the server-rendered HTML.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Auto-dismiss alerts after 6 s ────────────────────────────────────────
  document.querySelectorAll('.alert').forEach((el) => {
    setTimeout(() => {
      el.style.transition = 'opacity .5s ease, transform .5s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 500);
    }, 6000);
  });

  // ── Confirm on "Reset Group" button ──────────────────────────────────────
  document.querySelectorAll('form[action="/reset"]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!confirm('Are you sure you want to reset the group? All data will be lost.')) {
        e.preventDefault();
      }
    });
  });

  // ── Prevent double-submit on all forms ───────────────────────────────────
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', function handleSubmit() {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = btn.textContent + '…';
      }
    });
  });

  // ── Highlight the current-week row on page load ───────────────────────────
  const currentRow = document.querySelector('.rotation-item.current');
  if (currentRow) {
    currentRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

});
