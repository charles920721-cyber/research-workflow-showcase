(() => {
  const BASE = document.querySelector('script[data-showcase-base]')?.dataset.showcaseBase
    || (document.querySelector('base')?.href || './');
  const root = new URL(BASE, window.location.href);
  const originalFetch = window.fetch.bind(window);

  function dataUrl(name) {
    return new URL(`data/${name}`, root).href;
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  async function fileResponse(name, fallback) {
    try {
      const res = await originalFetch(dataUrl(name), { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      return new Response(text, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (err) {
      if (fallback !== undefined) return jsonResponse(fallback);
      return jsonResponse({ error: '展示版無此資料', detail: String(err) }, 404);
    }
  }

  let imageManifest = null;
  let imageManifestPromise = null;

  function ensureImageManifest() {
    if (imageManifest) return Promise.resolve(imageManifest);
    if (!imageManifestPromise) {
      imageManifestPromise = originalFetch(dataUrl('image_manifest.json'), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : {}))
        .then((data) => {
          imageManifest = data || {};
          return imageManifest;
        })
        .catch(() => {
          imageManifest = {};
          return imageManifest;
        });
    }
    return imageManifestPromise;
  }

  function resolvePancreaticImageUrl(itemId, { run = 0, kind = 'curves', allRuns = false } = {}) {
    const entry = (imageManifest || {})[itemId];
    if (!entry || !entry.key) return '';
    const folder = new URL(`images/${entry.key}/`, root).href;
    if (allRuns && kind === 'curves') {
      return entry.all_curves === false ? '' : `${folder}all_curves.png`;
    }
    const runNum = Number(run) || 0;
    if (!runNum || (kind !== 'cm' && kind !== 'curves')) return '';
    const runStr = String(runNum).padStart(2, '0');
    return `${folder}Run_${runStr}_${kind}.png`;
  }

  window.showcasePancreaticImageUrl = function showcasePancreaticImageUrl(itemId, opts) {
    return resolvePancreaticImageUrl(itemId, opts || {});
  };
  window.showcaseEnsureImageManifest = ensureImageManifest;
  ensureImageManifest();

  function rewritePancreaticImageElement(img) {
    if (!img || img.dataset.showcaseImg === '1') return;
    const raw = img.getAttribute('src') || '';
    if (!raw.includes('/api/pancreatic/analysis/image')) return;
    let params;
    try {
      params = new URL(raw, window.location.href).searchParams;
    } catch {
      return;
    }
    const next = resolvePancreaticImageUrl(params.get('item') || '', {
      run: Number(params.get('run') || 0),
      kind: (params.get('kind') || 'curves').toLowerCase(),
      allRuns: params.get('all_runs') === '1',
    });
    if (!next) return;
    img.dataset.showcaseImg = '1';
    img.src = next;
    img.addEventListener('load', () => {
      const loading = img.parentElement?.querySelector('.pancreatic-all-runs-loading');
      if (loading) loading.remove();
    }, { once: true });
  }

  function scanPancreaticImages(rootEl) {
    (rootEl || document).querySelectorAll?.('img[src*="/api/pancreatic/analysis/image"]')?.forEach(rewritePancreaticImageElement);
  }

  ensureImageManifest().then(() => {
    scanPancreaticImages(document);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target?.tagName === 'IMG') {
          rewritePancreaticImageElement(m.target);
          continue;
        }
        m.addedNodes?.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'IMG') rewritePancreaticImageElement(node);
          else scanPancreaticImages(node);
        });
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  });

  const READ_MAP = [
    [/^\/api\/auth\/status\/?$/, 'auth_status.json', { entered: true, can_edit: false, is_admin: false, user: null, access_mode: 'guest', site_version: 'test' }],
    [/^\/api\/config\/?$/, 'config.json'],
    [/^\/api\/pancreatic\/model-details\/?$/, 'pancreatic_model_details.json', {}],
    [/^\/api\/pancreatic\/simulation\/?$/, 'pancreatic_simulation.json', { scripts: [], jobs: [] }],
    [/^\/api\/pancreatic\/simulation\/jobs\/?$/, 'pancreatic_jobs.json', { jobs: [] }],
    [/^\/api\/pancreatic\/analysis\/content\/?$/, 'pancreatic_analysis_content.json', { future_plans: '' }],
    [/^\/api\/pancreatic\/analysis\/?$/, 'pancreatic_analysis.json', { source: 'trained_results', count: 0, items: [], results_path: '', future_plans: '' }],
    [/^\/api\/applications\/pancreatic\/?$/, 'application_pancreatic.json'],
    [/^\/api\/applications\/covid\/?$/, 'application_covid.json'],
    [/^\/api\/covid\/research\/?$/, 'covid_research.json', {}],
    [/^\/api\/results\/?$/, 'results.json', []],
    [/^\/api\/results\/analysis\/?$/, null],
  ];

  function normalizePath(input) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    try {
      const u = new URL(raw, window.location.href);
      return u.pathname.replace(/\/+/g, '/');
    } catch {
      return String(raw).split('?')[0];
    }
  }

  window.fetch = async (input, init = {}) => {
    const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const path = normalizePath(input);

    if (path.startsWith('/api/')) {
      if (method === 'POST' && /^\/api\/auth\/guest\/?$/.test(path)) {
        return jsonResponse({ message: '訪客模式', access_mode: 'guest', site_version: 'test' });
      }
      if (method !== 'GET' && method !== 'HEAD') {
        return jsonResponse({
          error: '展示版為唯讀，請使用訪客模式進入',
          showcase: true,
        }, 403);
      }

      if (path.startsWith('/api/datasets/') && path.includes('/samples')) {
        return jsonResponse({ items: [], total: 0, page: 1, pages: 0 });
      }
      if (path.startsWith('/api/datasets/') && path.includes('/preview/')) {
        return new Response('', { status: 404 });
      }
      if (path.startsWith('/api/pancreatic/analysis/image')) {
        await ensureImageManifest();
        const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
        const resolved = resolvePancreaticImageUrl(url.searchParams.get('item') || '', {
          run: Number(url.searchParams.get('run') || 0),
          kind: (url.searchParams.get('kind') || 'curves').toLowerCase(),
          allRuns: url.searchParams.get('all_runs') === '1',
        });
        if (!resolved) return jsonResponse({ error: '展示版找不到訓練圖' }, 404);
        return originalFetch(resolved, { cache: 'force-cache' });
      }
      if (path.startsWith('/api/pancreatic/analysis/log')) {
        return jsonResponse({ error: '展示版未內嵌訓練日誌' }, 404);
      }

      if (/^\/api\/results\/analysis\/?$/.test(path)) {
        const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
        const appId = url.searchParams.get('app_id') || '';
        if (appId === 'covid') return fileResponse('results_analysis_covid.json', {});
        if (appId === 'pancreatic') return fileResponse('pancreatic_analysis.json', {});
        return jsonResponse({});
      }

      for (const [re, file, fallback] of READ_MAP) {
        if (re.test(path)) {
          if (!file) continue;
          return fileResponse(file, fallback);
        }
      }

      return jsonResponse({ error: '展示版未提供此 API', path }, 404);
    }

    return originalFetch(input, init);
  };

  // Socket.IO stub
  window.io = function io() {
    return {
      on() { return this; },
      off() { return this; },
      emit() { return this; },
      disconnect() {},
      connected: false,
    };
  };
})();
