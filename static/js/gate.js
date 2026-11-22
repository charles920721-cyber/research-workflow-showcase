function appUrl() {
  return './app.html';
}

async function enterApp() {
  window.location.href = appUrl();
}

document.getElementById('guestBtn').addEventListener('click', async () => {
  const btn = document.getElementById('guestBtn');
  btn.disabled = true;
  try {
    await fetch('/api/auth/guest', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* showcase may block POST; still enter */
  }
  window.location.href = appUrl();
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      await enterApp();
      return;
    }
    const data = await res.json().catch(() => ({}));
    errEl.textContent = data.error || '展示版為唯讀，請使用訪客模式進入';
  } catch {
    errEl.textContent = '展示版為唯讀，請使用訪客模式進入';
  }
});
