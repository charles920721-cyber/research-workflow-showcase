(() => {
  const BASE = document.querySelector('script[data-showcase-base]')?.dataset.showcaseBase
    || (document.querySelector('base')?.href || './');
  const root = new URL(BASE, window.location.href);

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
      const res = await fetch(dataUrl(name), { cache: 'no-store' });
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

  const originalFetch = window.fetch.bind(window);
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
      if (path.startsWith('/api/pancreatic/analysis/image') || path.startsWith('/api/pancreatic/analysis/log')) {
        return jsonResponse({ error: '展示版未內嵌曲線／日誌檔' }, 404);
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
