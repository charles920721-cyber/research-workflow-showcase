document.body.classList.add('showcase-mode');

function gateUrl() {
  return './index.html';
}

function getSiteVersionFromPath() {
  return 'test';
}

function renderTestVersionApplicationExtras() {
  const el = document.getElementById('testVersionApplicationExtras');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `
    <a class="test-version-external-link" href="https://charles920721-cyber.github.io/tsmc-training-site/index.html" target="_blank" rel="noopener noreferrer">
      <span class="test-version-external-link-label">台積電訓練網站</span>
      <span class="test-version-external-link-desc">半導體基礎、光刻製程教材與隨機測驗</span>
      <span class="test-version-external-link-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function removeShowcaseBanner() {
  document.querySelectorAll('.showcase-banner').forEach((el) => el.remove());
  document.querySelectorAll('body > div, body > p, body > section').forEach((el) => {
    const text = (el.textContent || '').replace(/\s+/g, '');
    if (text.includes('外觀與本機站相同') || text.includes('本機檔案預覽已關閉') || text.includes('展示版（唯讀）')) {
      el.remove();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  removeShowcaseBanner();

  const pill = document.getElementById('versionPill');
  if (pill) {
    pill.textContent = '測試版';
    pill.classList.add('is-test');
  }
  const home = document.getElementById('homeLink');
  if (home) home.href = './index.html';
  const admin = document.getElementById('adminLink');
  if (admin) admin.style.display = 'none';
  const logout = document.getElementById('sessionLogoutBtn');
  if (logout) logout.style.display = 'none';

  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.classList.add('connected');
    const label = statusEl.querySelector('span:last-child');
    if (label) label.textContent = '已連線';
  }
});
