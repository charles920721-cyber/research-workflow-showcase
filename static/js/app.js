/* 研究工作流程管理系統 - 前端邏輯 */

let config = null;
let selectedAppId = null;
let selectedAltConfig = null;
let socket = null;
let runs = {};

const METRIC_LABELS = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1_score: 'F1 Score',
  auc: 'AUC',
};

const LABEL_COLORS = {
  '健康': '#10b981',
  '確診': '#ef4444',
  '非確診': '#10b981',
  '正常': '#10b981',
  '良性': '#f59e0b',
  '惡性': '#ef4444',
  'COVID-19': '#ef4444',
  '病毒性肺炎': '#f97316',
  '細菌性肺炎': '#8b5cf6',
};

let currentDataset = null;
let currentResearch = null;
let currentPancreaticDetails = null;
let currentPancreaticSimulation = null;
let pancreaticTrainingJobs = {};
let currentSampleCategory = 'all';
let currentSamplePage = 1;

const DATASET_IDS = {
  pancreatic: 'pancreatic_dataset',
  covid: 'covid_dataset',
};

const IS_EMBED = new URLSearchParams(window.location.search).get('embed') === '1';
let authState = { entered: false, can_edit: false, is_admin: false, user: null, access_mode: null };

function getSiteVersionFromPath() {
  if (window.location.pathname.startsWith('/app/test')) return 'test';
  const v = new URLSearchParams(window.location.search).get('v');
  if (v === 'test') return 'test';
  return 'stable';
}

function getEffectiveSiteVersion() {
  return authState.site_version || getSiteVersionFromPath();
}

function apiVersionQuery() {
  return getEffectiveSiteVersion() === 'test' ? '?v=test' : '';
}

function isPancreaticAdvancedFeature() {
  return true;
}

const PANCREATIC_AI_CUSTOM_MODEL = '__custom__';

const PANCREATIC_AI_FALLBACK_MODELS = {
  ollama: [
    { id: 'llama3.2:3b', label: 'llama3.2:3b（推薦，較快）' },
    { id: 'llama3.1', label: 'llama3.1（較強）' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini（推薦）' },
    { id: 'gpt-4o', label: 'gpt-4o' },
  ],
  gemini: [
    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite（帳號可用，推薦）' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022', label: 'claude-3-5-haiku（推薦）' },
  ],
  openai_compatible: [
    { id: 'deepseek-chat', label: 'deepseek-chat（推薦）' },
  ],
};

const PANCREATIC_AI_FALLBACK_PROVIDERS = [
  {
    id: 'ollama',
    label: 'Ollama（本機）',
    description: '完全免費、資料不出本機；需先安裝 Ollama 並 pull 模型（如 llama3.2:3b）。',
    default_model: 'llama3.2:3b',
    needs_api_key: false,
    default_base_url: 'http://127.0.0.1:11434/v1/chat/completions',
    models: PANCREATIC_AI_FALLBACK_MODELS.ollama,
  },
  {
    id: 'openai',
    label: 'OpenAI（GPT）',
    description: '品質穩定、繁體中文佳；建議 gpt-4o-mini。',
    default_model: 'gpt-4o-mini',
    needs_api_key: true,
    default_base_url: 'https://api.openai.com/v1/chat/completions',
    models: PANCREATIC_AI_FALLBACK_MODELS.openai,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: '需 Google AI API Key；固定使用 gemini-3.1-flash-lite。',
    default_model: 'gemini-3.1-flash-lite',
    needs_api_key: true,
    default_base_url: '',
    models: PANCREATIC_AI_FALLBACK_MODELS.gemini,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    description: '長文分析佳；建議 claude-3-5-haiku。',
    default_model: 'claude-3-5-haiku-20241022',
    needs_api_key: true,
    default_base_url: '',
    models: PANCREATIC_AI_FALLBACK_MODELS.anthropic,
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI 相容 API',
    description: '適用 DeepSeek、Groq 等。',
    default_model: 'deepseek-chat',
    needs_api_key: true,
    default_base_url: 'https://api.deepseek.com/v1/chat/completions',
    models: PANCREATIC_AI_FALLBACK_MODELS.openai_compatible,
  },
];

const PANCREATIC_AI_OLLAMA_DEFAULTS = {
  provider: 'ollama',
  model: 'llama3.2:3b',
  base_url: 'http://127.0.0.1:11434/v1/chat/completions',
  auto_generate: false,
  content: '',
  providers: PANCREATIC_AI_FALLBACK_PROVIDERS,
};

function gateUrl() {
  return getSiteVersionFromPath() === 'test' ? '/test' : '/';
}

const PAGE_GUIDES = {
  application: {
    summary: '先選擇要查看的研究。選定後，資料、建模、模擬和分析都會換成該研究的內容。',
    items: [
      { name: '研究卡片', text: '列出新冠辨識與胰臟癌辨識，點選後進入該研究。' },
      { name: '已選項目', text: '顯示研究名稱、說明，以及要分辨的類別。' },
      { name: 'Lab Online', text: '進入 E309 實驗室線上導覽。' },
      { name: '台積電訓練網站', text: '測試版附上的外部連結，可開啟半導體教材與測驗。' },
    ],
  },
  data: {
    default: {
      summary: '這一頁說明訓練用的影像從哪裡來、有多少筆，並可預覽樣本。請先在「1. 應用」選擇研究。',
      items: [
        { name: '資料集來源', text: '官方網站與本機資料夾。' },
        { name: '資料摘要', text: '檔案格式與基本規格。' },
        { name: '對照論文', text: '使用同一資料集的相關論文。' },
        { name: '樣本統計', text: '各類別的數量。' },
        { name: '影像預覽', text: '篩選並查看樣本。登入後才能看圖。' },
      ],
    },
    pancreatic: {
      summary: '這一頁說明胰臟癌辨識用的 CT 影像從哪裡來、有多少筆，並可預覽樣本。',
      items: [
        { name: '資料集來源', text: '官方資料網站，以及對應的本機資料夾。' },
        { name: '資料摘要', text: '檔案格式、影像尺寸等基本資訊。' },
        { name: '對照論文', text: '使用同一資料集的相關論文。' },
        { name: '樣本統計', text: '健康與患病各有多少筆。' },
        { name: '影像預覽', text: '可依類別篩選並放大查看。需登入才能看圖。' },
      ],
    },
    covid: {
      summary: '這一頁說明新冠辨識用的影像從哪裡來、有多少筆，並可預覽樣本。',
      items: [
        { name: '資料集來源', text: '官方資料網站，以及對應的本機資料夾。' },
        { name: '資料摘要', text: '檔案格式與基本規格。' },
        { name: '對照論文', text: '使用同一資料集的相關論文。' },
        { name: '樣本統計', text: '確診與非確診各有多少筆。' },
        { name: '影像預覽', text: '可依類別篩選並放大查看。需登入才能看圖。' },
      ],
    },
  },
  modeling: {
    default: {
      summary: '這一頁說明模型怎麼設定。請先在「1. 應用」選擇研究。',
      items: [
        { name: '模型設定', text: '架構、優化器與超參數。' },
        { name: '架構與優化器', text: '可比較的網路和訓練方法。' },
      ],
    },
    pancreatic: {
      summary: '這一頁說明胰臟癌模型怎麼建，以及這台電腦用什麼硬體訓練。',
      items: [
        { name: '硬體規格', text: '處理器、記憶體與顯示卡。' },
        { name: '預設架構與優化器', text: '目前採用的網路和優化器。' },
        { name: '調整參數', text: '各實驗相對預設改過的設定，可切換實驗查看。' },
        { name: '網路架構', text: '點開可看架構介紹與可調參數。' },
        { name: '優化器', text: '點開可看優化器介紹與可調參數。' },
      ],
    },
    covid: {
      summary: '這一頁整理新冠辨識最後採用的模型，以及比較過的架構和優化器。',
      items: [
        { name: '開發環境與方法', text: '使用的框架和作法。' },
        { name: '最終架構與優化器', text: '篩選後採用的組合。' },
        { name: '最佳超參數', text: '這組模型使用的訓練參數。' },
        { name: '網路架構表', text: '各架構的參數量與說明。' },
        { name: '優化器卡片', text: '各優化器的簡介。' },
      ],
    },
  },
  simulation: {
    default: {
      summary: '這一頁用來查看或啟動訓練。請先在「1. 應用」選擇研究。',
      items: [
        { name: '訓練控制', text: '選擇設定並開始新的訓練。' },
        { name: '訓練進度', text: '查看每個 RUN 跑到哪裡。' },
      ],
    },
    pancreatic: {
      summary: '這一頁列出胰臟癌的訓練環境、參數規劃，以及每一支訓練程式。',
      items: [
        { name: '訓練環境', text: '使用的軟體、框架，以及程式和成果放在哪裡。' },
        { name: '模擬規劃', text: '參數總表、已調整項目和待調整項目。' },
        { name: '訓練程式清單', text: '每支程式的日期、架構與優化器。調整項目裡包含 MBS。管理員可編輯並開始訓練。' },
      ],
    },
    covid: {
      summary: '這一頁整理新冠辨識的模擬流程，並可查看訓練 RUN。',
      items: [
        { name: 'RUN 數量', text: '架構篩選、小規模調參與大規模實驗各做了多少次。' },
        { name: '架構與優化器', text: '不同組合的測試準確度。' },
        { name: '超參數調整', text: '各階段調過的參數與對應成績。' },
        { name: '訓練 RUN', text: '已啟動的訓練進度。' },
      ],
    },
  },
  analysis: {
    default: {
      summary: '這一頁比較實驗成績。請先在「1. 應用」選擇研究。',
      items: [
        { name: '成績摘要', text: '實驗規模與主要準確度。' },
        { name: '結果表', text: '各組合的評估指標。' },
      ],
    },
    pancreatic: {
      summary: '這一頁比較胰臟癌各次實驗的成績，並附上論文對照、建議與後續規劃。',
      items: [
        { name: '成果摘要', text: '實驗組數、總 RUN 數，以及成績檔放在哪裡。' },
        { name: '分析表', text: '項目預設由大到小。每一列有架構、調整項目（含 MBS）和各項評估指標，可排序、展開 Run、看曲線、日誌與性能測試。' },
        { name: 'PK Paper', text: '對照論文的架構、資料與指標。' },
        { name: 'AI 建議', text: '依目前成績產生下一步調整建議。' },
        { name: '未來規劃', text: '尚未進行的研究方向。' },
      ],
    },
    covid: {
      summary: '這一頁彙整新冠辨識各階段的準確度，並用表格比較不同組合。',
      items: [
        { name: '成績摘要', text: '架構篩選、小規模與大規模的 RUN 數和準確度。' },
        { name: 'RUN 統計', text: '各階段做了多少次實驗。' },
        { name: '結果表', text: '依階段列出架構、優化器與準確度。' },
      ],
    },
  },
};

function pageGuideSpec(step) {
  const entry = PAGE_GUIDES[step];
  if (!entry) return null;
  if (entry.summary) return entry;
  return entry[getActiveAppId()] || entry.default;
}

function renderPageGuideHtml(spec) {
  const items = (spec.items || []).map((item) => `
    <li>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.text)}</span>
    </li>`).join('');
  return `
    <p class="page-guide-kicker">本頁導覽</p>
    <p class="page-guide-summary">${escapeHtml(spec.summary)}</p>
    <ul class="page-guide-items">${items}</ul>`;
}

function renderAllPageGuides() {
  Object.keys(PAGE_GUIDES).forEach((step) => {
    const host = document.getElementById(`pageGuide-${step}`);
    const spec = pageGuideSpec(step);
    if (host && spec) host.innerHTML = renderPageGuideHtml(spec);
  });
}

// ── 初始化 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (IS_EMBED) {
    document.body.classList.add('embed-mode');
  } else {
    initSessionBar();
  }
  initNavigation();
  initModelDetailModal();
  try { initSocket(); } catch (err) { console.warn('Socket 初始化失敗，即時訓練更新不可用', err); }
  document.addEventListener('inline-edit-authenticated', () => {
    if (document.getElementById('step-analysis')?.classList.contains('active') && getActiveAppId() === 'pancreatic') {
      loadAnalysis();
    }
  });
  await loadAuthState();
  renderAllPageGuides();
  const savedApp = sessionStorage.getItem('selectedAppId');
  await loadConfig();
  if (savedApp && config?.applications?.[savedApp]) {
    await selectApp(savedApp);
  }
});

async function loadAuthState() {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
    authState = await res.json();
    updateSessionUI();
    if (!IS_EMBED && !authState.entered) {
      window.location.href = gateUrl();
    }
  } catch {
    if (!IS_EMBED) {
      window.location.href = gateUrl();
    }
  }
}

function initSessionBar() {
  document.getElementById('sessionLogoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = gateUrl();
  });
}

function updateSessionUI() {
  const label = document.getElementById('sessionLabel');
  const adminLink = document.getElementById('adminLink');
  const versionPill = document.getElementById('versionPill');
  if (!label) return;

  if (authState.access_mode === 'guest') {
    label.textContent = '訪客模式';
  } else if (authState.user) {
    label.textContent = authState.user.display_name || authState.user.username;
  } else {
    label.textContent = '—';
  }

  if (adminLink) {
    adminLink.style.display = authState.is_admin ? 'flex' : 'none';
    const v = authState.site_version || getSiteVersionFromPath();
    adminLink.href = v === 'test' ? '/admin/test' : '/admin/stable';
  }

  updatePancreaticScriptEditorPermissions();

  const homeLink = document.getElementById('homeLink');
  if (homeLink) {
    homeLink.href = gateUrl();
  }

  const version = authState.site_version || getSiteVersionFromPath();
  const isTest = version === 'test';
  if (versionPill) {
    versionPill.textContent = isTest ? '測試版' : '穩定版';
    versionPill.classList.toggle('is-test', isTest);
  }
  renderTestVersionApplicationExtras();
}

function initModelDetailModal() {
  document.getElementById('modelDetailClose')?.addEventListener('click', closeModelDetailModal);
  document.getElementById('modelDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modelDetailModal') closeModelDetailModal();
  });
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modelDetailModal');
    if (modal?.classList.contains('show') && pancreaticRunViewer.itemId) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePancreaticRun(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePancreaticRun(1);
        return;
      }
    }
    if (e.key === 'Escape') closeModelDetailModal();
  });
  bindPancreaticModelDetailEvents();
  bindPancreaticSimulationEvents();
  bindPancreaticAnalysisEvents();
}

function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`step-${step}`).classList.add('active');
      if (step === 'analysis') loadAnalysis();
      if (step === 'simulation' && selectedAppId === 'covid' && currentResearch) renderCovidSimulation(currentResearch);
      if (step === 'simulation' && selectedAppId === 'pancreatic') renderPancreaticSimulation();
      if (step === 'modeling' && selectedAppId === 'pancreatic') {
        const modelCfg = config?.model_configs?.pancreatic;
        if (modelCfg?.architectures?.length) void renderPancreaticModelConfig(modelCfg);
      }
    });
  });
}

function initSocket() {
  socket = io();
  const statusEl = document.getElementById('connectionStatus');

  socket.on('connect', () => {
    statusEl.classList.add('connected');
    statusEl.querySelector('span:last-child').textContent = '已連線';
  });

  socket.on('disconnect', () => {
    statusEl.classList.remove('connected');
    statusEl.querySelector('span:last-child').textContent = '已斷線';
  });

  socket.on('all_runs', (allRuns) => {
    allRuns.forEach(run => {
      if (run.status === 'cancelled') return;
      runs[run.run_id] = run;
      renderRunCard(run);
    });
  });

  socket.on('training_update', (run) => {
    if (run.status === 'cancelled') {
      removeRunCard(run.run_id);
      return;
    }
    runs[run.run_id] = run;
    renderRunCard(run);
  });

  socket.on('training_complete', (result) => {
    loadAnalysis();
  });

  socket.on('pancreatic_training_jobs', (jobs) => {
    jobs.forEach(job => {
      pancreaticTrainingJobs[job.job_id] = job;
      updatePancreaticTrainingPanel(job);
    });
  });

  socket.on('pancreatic_training_update', (job) => {
    pancreaticTrainingJobs[job.job_id] = job;
    updatePancreaticTrainingPanel(job);
  });

  socket.on('pancreatic_analysis_update', () => {
    if (getActiveAppId() === 'pancreatic') {
      loadAnalysis();
      refreshPancreaticTuningTable(true);
    }
  });

  socket.on('pancreatic_simulation_update', () => {
    if (getActiveAppId() === 'pancreatic') {
      renderPancreaticSimulation();
    }
  });

  socket.on('pancreatic_ai_update', (payload) => {
    if (getActiveAppId() === 'pancreatic') {
      renderPancreaticAiSuggestionContent(payload);
    }
  });
}

async function loadConfig() {
  const res = await fetch('/api/config');
  config = await res.json();
  renderAppCards();
  renderTestVersionApplicationExtras();
}

function renderTestVersionApplicationExtras() {
  const el = document.getElementById('testVersionApplicationExtras');
  if (!el) return;

  el.hidden = false;
  el.innerHTML = `
    <a class="test-version-external-link" href="/lab/test">
      <span class="test-version-external-link-label">Lab Online</span>
      <span class="test-version-external-link-desc">E309 實驗室線上導覽，可走動查看座位與研究網站</span>
      <span class="test-version-external-link-arrow" aria-hidden="true">↗</span>
    </a>
    <a class="test-version-external-link" href="https://charles920721-cyber.github.io/tsmc-training-site/index.html" target="_blank" rel="noopener noreferrer">
      <span class="test-version-external-link-label">台積電訓練網站</span>
      <span class="test-version-external-link-desc">半導體基礎、光刻製程教材與隨機測驗</span>
      <span class="test-version-external-link-arrow" aria-hidden="true">↗</span>
    </a>`;
}

// ── 步驟 1：應用 ─────────────────────────────────────────
function renderAppCards() {
  const container = document.getElementById('appCards');
  container.innerHTML = '';

  Object.values(config.applications).forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.dataset.appId = app.id;
    card.innerHTML = `
      <h3>${app.name}</h3>
      <p>${app.description}</p>
    `;
    card.addEventListener('click', () => selectApp(app.id));
    container.appendChild(card);
  });
}

async function selectApp(appId) {
  selectedAppId = appId;
  sessionStorage.setItem('selectedAppId', appId);
  selectedAltConfig = null;

  document.querySelectorAll('.app-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.appId === appId);
  });

  const res = await fetch(`/api/applications/${appId}`);
  const data = await res.json();
  const app = data.application;

  const infoEl = document.getElementById('selectedAppInfo');
  infoEl.style.display = 'block';
  document.getElementById('selectedAppName').textContent = app.name;
  document.getElementById('selectedAppDesc').textContent = app.description;

  const tagsEl = document.getElementById('classTags');
  tagsEl.innerHTML = app.classes.map(c =>
    `<span class="tag">${c}</span>`
  ).join('');

  renderDataset(data.dataset);
  await renderModelConfig(data.model_config, data.research);
  updateConfigSelect(data.model_config, data.research);
  currentResearch = data.research || null;
  currentPancreaticDetails = data.model_details || null;
  currentPancreaticSimulation = data.simulation || null;
  if (selectedAppId === 'covid' && currentResearch) {
    renderCovidSimulation(currentResearch);
  } else if (selectedAppId === 'pancreatic') {
    renderPancreaticSimulation();
  } else {
    document.getElementById('covidSimulationPlan').innerHTML = '';
  }
  updateSimulationDemoVisibility();

  if (document.getElementById('step-analysis')?.classList.contains('active')) {
    loadAnalysis();
  }
  renderAllPageGuides();
}

// ── 步驟 2：資料 ─────────────────────────────────────────
function renderDataset(dataset) {
  if (!dataset || !dataset.name) return;

  currentDataset = dataset;
  currentSampleCategory = 'all';
  currentSamplePage = 1;

  document.getElementById('datasetDesc').textContent = dataset.description;
  renderDatasetSources(dataset);
  renderDatasetMeta(dataset);
  renderDatasetReferences(dataset);
  renderDatasetStats(dataset);
  renderSampleFilter(dataset);
  loadDatasetSamples();
}

function renderDatasetReferences(dataset) {
  const el = document.getElementById('datasetReferences');
  const refs = dataset.references || [];

  if (!refs.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <h3 class="section-subtitle">對照論文（同資料集）</h3>
    <div class="ref-table-wrap">
      <table class="ref-table">
        <thead>
          <tr>
            <th>論文</th>
            <th>準確度</th>
            <th>架構</th>
            <th>優化器</th>
          </tr>
        </thead>
        <tbody>
          ${refs.map(r => `
            <tr>
              <td><strong>[${r.id}]</strong> ${r.title}</td>
              <td>${r.accuracy}</td>
              <td>${r.architecture}</td>
              <td>${r.optimizer}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDatasetSources(dataset) {
  const el = document.getElementById('datasetSources');
  const sources = dataset.sources || [];

  if (!sources.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <h3 class="section-subtitle">資料集來源（點擊前往官方網站）</h3>
    <div class="source-cards">
      ${sources.map(src => `
        <a class="source-card source-${src.id}" href="${src.source_url}" target="_blank" rel="noopener noreferrer">
          <div class="source-card-header">
            <span class="source-label tag">${src.label}</span>
            <span class="source-link-icon">↗</span>
          </div>
          <h4>${src.source_name}</h4>
          <p>${src.description}</p>
          <div class="source-meta">
            <span>本地資料夾：<code>${src.local_folder}/</code></span>
            ${src.sample_count !== undefined ? `<span>${src.sample_count.toLocaleString()} 個 .npy 檔案</span>` : ''}
          </div>
        </a>
      `).join('')}
    </div>
  `;
}

function renderDatasetMeta(dataset) {
  const el = document.getElementById('datasetMeta');
  const parts = [];

  if (dataset.file_format) {
    parts.push(`<div class="meta-item"><span class="meta-key">檔案格式</span><span class="meta-val">${dataset.file_format}</span></div>`);
  }
  if (dataset.train_ratio !== undefined) {
    parts.push(`<div class="meta-item"><span class="meta-key">資料切分</span><span class="meta-val">${dataset.train_ratio * 100}% 訓練 · ${dataset.val_ratio * 100}% 驗證 · ${dataset.test_ratio * 100}% 測試</span></div>`);
  }
  if (dataset.local_path) {
    parts.push(`<div class="meta-item meta-path"><span class="meta-key">本地路徑</span><span class="meta-val" title="${dataset.local_path}">${dataset.local_path}</span></div>`);
  }

  el.innerHTML = parts.length
    ? `<div class="meta-bar">${parts.join('')}</div>`
    : '';
}

function renderDatasetStats(dataset) {
  const statsEl = document.getElementById('datasetStats');

  if (dataset.sources && dataset.sources.length) {
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-value">${(dataset.total_samples || 0).toLocaleString()}</div><div class="stat-label">總樣本數</div></div>
      ${dataset.sources.map(s => `
        <div class="stat-card">
          <div class="stat-value">${(s.sample_count || 0).toLocaleString()}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('')}
      ${dataset.train_samples ? `<div class="stat-card"><div class="stat-value">${dataset.train_samples.toLocaleString()}</div><div class="stat-label">訓練集 (80%)</div></div>` : ''}
      ${dataset.val_samples ? `<div class="stat-card"><div class="stat-value">${dataset.val_samples.toLocaleString()}</div><div class="stat-label">驗證集 (10%)</div></div>` : ''}
      ${dataset.test_samples ? `<div class="stat-card"><div class="stat-value">${dataset.test_samples.toLocaleString()}</div><div class="stat-label">測試集 (10%)</div></div>` : ''}
    `;
    return;
  }

  statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-value">${dataset.total_samples || 0}</div><div class="stat-label">總樣本數</div></div>
    <div class="stat-card"><div class="stat-value">${dataset.train_samples || 0}</div><div class="stat-label">訓練集</div></div>
    <div class="stat-card"><div class="stat-value">${dataset.val_samples || 0}</div><div class="stat-label">驗證集</div></div>
    <div class="stat-card"><div class="stat-value">${dataset.test_samples || 0}</div><div class="stat-label">測試集</div></div>
  `;
}

function renderSampleFilter(dataset) {
  const filterEl = document.getElementById('sampleFilter');

  if (!dataset.sources || !dataset.local_path) {
    filterEl.style.display = 'none';
    return;
  }

  filterEl.style.display = 'flex';
  filterEl.innerHTML = `
    <button class="filter-btn active" data-category="all">全部</button>
    ${dataset.sources.map(s => `
      <button class="filter-btn" data-category="${s.category || s.local_folder}">${s.label}</button>
    `).join('')}
  `;

  filterEl.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSampleCategory = btn.dataset.category;
      currentSamplePage = 1;
      loadDatasetSamples();
    });
  });
}

async function loadDatasetSamples() {
  const gridEl = document.getElementById('imageGrid');
  gridEl.innerHTML = '<p class="placeholder-text">載入中...</p>';

  const datasetId = DATASET_IDS[selectedAppId];

  if (currentDataset?.local_path && datasetId) {
    const params = new URLSearchParams({
      category: currentSampleCategory,
      page: currentSamplePage,
      limit: 24,
    });
    const res = await fetch(`/api/datasets/${datasetId}/samples?${params}`);
    const data = await res.json();
    if (!res.ok) {
      gridEl.innerHTML = `<p class="placeholder-text">${escapeHtml(data.error || '無法載入影像')}</p>`;
      return;
    }

    if (!data.samples?.length) {
      gridEl.innerHTML = '<p class="placeholder-text">找不到樣本檔案</p>';
      return;
    }

    gridEl.innerHTML = data.samples.map(img => `
      <div class="image-card" data-id="${img.id}">
        <img class="image-thumb" src="/api/datasets/${datasetId}/preview/${img.category}/${encodeURIComponent(img.filename)}" alt="${img.filename}" loading="lazy">
        <div class="image-card-info">
          <div class="label">${img.label}</div>
          <div class="meta">${img.filename}</div>
        </div>
      </div>
    `).join('');

    gridEl.querySelectorAll('.image-card').forEach((card, i) => {
      card.addEventListener('click', () => showSamplePreview(data.samples[i], currentDataset, datasetId));
    });

    renderSamplePagination(data);
    return;
  }

  gridEl.innerHTML = '';
  (currentDataset.images || []).forEach(img => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
      ${generatePlaceholderSVG(img.label, img.filename)}
      <div class="image-card-info">
        <div class="label">${img.label}</div>
        <div class="meta">${img.id} · ${img.split}</div>
      </div>
    `;
    card.addEventListener('click', () => showImagePreview(img, currentDataset.name));
    gridEl.appendChild(card);
  });
}

function renderSamplePagination(data) {
  let paginationEl = document.getElementById('samplePagination');
  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'samplePagination';
    paginationEl.className = 'sample-pagination';
    document.getElementById('imageGrid').after(paginationEl);
  }

  if (data.pages <= 1) {
    paginationEl.innerHTML = `<span class="page-info">共 ${data.total.toLocaleString()} 個樣本</span>`;
    return;
  }

  paginationEl.innerHTML = `
    <button class="btn btn-page" ${data.page <= 1 ? 'disabled' : ''} onclick="changeSamplePage(${data.page - 1})">← 上一頁</button>
    <span class="page-info">第 ${data.page} / ${data.pages} 頁（共 ${data.total.toLocaleString()} 個樣本）</span>
    <button class="btn btn-page" ${data.page >= data.pages ? 'disabled' : ''} onclick="changeSamplePage(${data.page + 1})">下一頁 →</button>
  `;
}

function changeSamplePage(page) {
  currentSamplePage = page;
  loadDatasetSamples();
  document.getElementById('step-data').scrollIntoView({ behavior: 'smooth' });
}

function showSamplePreview(img, dataset, datasetId) {
  const preview = document.getElementById('imagePreview');
  preview.style.display = 'flex';

  const source = (dataset.sources || []).find(s => s.local_folder === img.category || s.category === img.category);
  document.getElementById('previewImage').innerHTML = `
    <img src="/api/datasets/${datasetId}/preview/${img.category}/${encodeURIComponent(img.filename)}" alt="${img.filename}">
  `;
  document.getElementById('previewInfo').innerHTML = `
    <h3>${img.filename}</h3>
    <dl>
      <dt>資料集</dt><dd>${dataset.name}</dd>
      <dt>標籤</dt><dd style="color:${LABEL_COLORS[img.label] || '#fff'}">${img.label}</dd>
      <dt>類別資料夾</dt><dd>${img.category}/</dd>
      <dt>檔案格式</dt><dd>${dataset.file_format || '-'}</dd>
      <dt>資料來源</dt><dd>${source ? `<a href="${source.source_url}" target="_blank" rel="noopener">${source.source_name} ↗</a>` : '-'}</dd>
      <dt>本地路徑</dt><dd style="font-size:0.8rem;word-break:break-all">${dataset.local_path}\\${img.category}\\${img.filename}</dd>
    </dl>
  `;
}

function showNpyPreview(img, dataset) {
  showSamplePreview(img, dataset, DATASET_IDS.pancreatic);
}

function generatePlaceholderSVG(label, filename) {
  const color = LABEL_COLORS[label] || '#4f46e5';
  return `
    <svg class="image-thumb" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#0a0f1e"/>
      <rect x="20" y="20" width="160" height="160" rx="8" fill="#1e293b" stroke="${color}" stroke-width="2"/>
      <text x="100" y="120" text-anchor="middle" fill="${color}" font-size="14" font-family="sans-serif">${label}</text>
      <text x="100" y="155" text-anchor="middle" fill="#64748b" font-size="10" font-family="monospace">${filename}</text>
    </svg>
  `;
}

function showImagePreview(img, datasetName) {
  const preview = document.getElementById('imagePreview');
  preview.style.display = 'flex';

  document.getElementById('previewImage').innerHTML = generatePlaceholderSVG(img.label, img.filename);
  document.getElementById('previewInfo').innerHTML = `
    <h3>${img.filename}</h3>
    <dl>
      <dt>資料集</dt><dd>${datasetName}</dd>
      <dt>影像 ID</dt><dd>${img.id}</dd>
      <dt>標籤</dt><dd style="color:${LABEL_COLORS[img.label] || '#fff'}">${img.label}</dd>
      <dt>資料分割</dt><dd>${img.split === 'train' ? '訓練集' : img.split === 'val' ? '驗證集' : '測試集'}</dd>
    </dl>
  `;
}

function closeImagePreview() {
  document.getElementById('imagePreview').style.display = 'none';
}

// ── 步驟 3：建模 ─────────────────────────────────────────
async function renderModelConfig(modelCfg, research) {
  const extraEl = document.getElementById('covidModelExtra');
  if (!modelCfg || !modelCfg.architecture) {
    document.getElementById('modelConfig').innerHTML = '<p class="placeholder-text">請先選擇應用項目</p>';
    extraEl.innerHTML = '';
    return;
  }

  if (research && selectedAppId === 'covid') {
    renderCovidModelConfig(modelCfg, research);
    document.getElementById('alternativesSection').style.display = 'none';
    return;
  }

  if (selectedAppId === 'pancreatic' && modelCfg.architectures?.length) {
    await renderPancreaticModelConfig(modelCfg);
    document.getElementById('alternativesSection').style.display = 'none';
    return;
  }

  extraEl.innerHTML = '';
  const hp = modelCfg.hyperparameters || {};
  const hpItems = Object.entries(hp).map(([k, v]) => `
    <div class="hyperparam-item">
      <div class="hp-key">${formatHyperparamKey(k)}</div>
      <div class="hp-val">${v}</div>
    </div>
  `).join('');

  document.getElementById('modelConfig').innerHTML = `
    <div class="config-card">
      <h3>Architecture</h3>
      <div class="value">${modelCfg.architecture}</div>
    </div>
    <div class="config-card">
      <h3>Optimizer</h3>
      <div class="value">${modelCfg.optimizer}</div>
    </div>
    <div class="config-card" style="grid-column: span 2;">
      <h3>Hyperparameters</h3>
      <div class="hyperparams-grid">${hpItems}</div>
    </div>
  `;

  const alts = modelCfg.alternatives || [];
  const altSection = document.getElementById('alternativesSection');
  if (alts.length) {
    altSection.style.display = 'block';
    document.getElementById('altCards').innerHTML = alts.map((alt, i) => `
      <div class="alt-card" data-alt-index="${i}">
        <h4>${alt.architecture}</h4>
        <p>Optimizer: ${alt.optimizer}</p>
      </div>
    `).join('');
  } else {
    altSection.style.display = 'none';
  }
}

function renderCovidModelConfig(modelCfg, research) {
  const hp = modelCfg.hyperparameters || {};
  const hpItems = Object.entries(hp).map(([k, v]) => `
    <div class="hyperparam-item">
      <div class="hp-key">${formatHyperparamKey(k)}</div>
      <div class="hp-val">${v}</div>
    </div>
  `).join('');

  document.getElementById('modelConfig').innerHTML = `
    <div class="config-card"><h3>開發環境</h3><div class="value" style="font-size:1.1rem">${modelCfg.framework}</div></div>
    <div class="config-card"><h3>方法</h3><div class="value" style="font-size:1.1rem">${modelCfg.method}</div></div>
    <div class="config-card"><h3>最終架構</h3><div class="value">${modelCfg.architecture}</div></div>
    <div class="config-card"><h3>最終優化器</h3><div class="value">${modelCfg.optimizer}</div></div>
    <div class="config-card" style="grid-column: span 2;">
      <h3>最佳超參數</h3>
      <div class="hyperparams-grid">${hpItems}</div>
    </div>
  `;

  const architectures = [...(research.architectures || [])].sort((a, b) => {
    if (a.name === 'MobileNetV2') return -1;
    if (b.name === 'MobileNetV2') return 1;
    return 0;
  });
  const optimizers = [...(research.optimizers || [])].sort((a, b) => {
    if (a.name === 'Adam') return -1;
    if (b.name === 'Adam') return 1;
    return 0;
  });

  const archRows = architectures.map(a => `
    <tr class="${a.selected ? 'selected-row' : ''}">
      <td><strong>${a.name}</strong>${a.selected ? ' ✓' : ''}</td>
      <td>${a.parameters_display}</td>
      <td>${a.description}</td>
    </tr>
  `).join('');

  const optCards = optimizers.map(o => `
    <div class="opt-card">
      <h4>${o.name}</h4>
      <p>${o.description}</p>
    </div>
  `).join('');

  document.getElementById('covidModelExtra').innerHTML = `
    <h3 class="section-subtitle">網路架構</h3>
    <div class="ref-table-wrap">
      <table class="ref-table">
        <thead><tr><th>架構</th><th>參數量</th><th>說明</th></tr></thead>
        <tbody>${archRows}</tbody>
      </table>
    </div>
    <h3 class="section-subtitle" style="margin-top:24px">優化器</h3>
    <div class="opt-cards">${optCards}</div>
  `;
}

function renderPancreaticModelConfig(modelCfg) {
  return renderPancreaticModelConfigAsync(modelCfg);
}

async function fetchPancreaticModelDetails(force = false) {
  const cached = currentPancreaticDetails;
  if (!force && cached?.architectures && Object.keys(cached.architectures).length) {
    return cached;
  }
  try {
    const res = await fetch('/api/pancreatic/model-details');
    if (res.ok) {
      currentPancreaticDetails = await res.json();
      return currentPancreaticDetails;
    }
    console.error('載入建模詳情失敗', res.status, res.statusText);
  } catch (err) {
    console.error('載入建模詳情失敗', err);
  }
  return currentPancreaticDetails || { architectures: {}, optimizers: {} };
}

let pancreaticTuningModelCfg = null;
let pancreaticTuningItems = [];
let pancreaticTuningPinnedId = null;
let pancreaticTuningGroupByKind = false;
const pancreaticTuningExpandedNames = new Set();

const PANCREATIC_TUNING_INTROS = {
  'Batch Size': '每次參數更新所使用的樣本數（MiniBatchSize）。數值較大時梯度較穩定，但需要更多記憶體。優化器預設為 128。',
  'Learning Rate': '控制每次參數更新的步長（InitialLearnRate）。過大容易發散，過小則收斂變慢。Adam 的預設初始學習率為 0.001。',
  'Dropout': '訓練時隨機丟棄一部分神經元連接，用來減輕過擬合。SqueezeNet 在分類前的預設丟棄率為 0.5。',
  'Weight Decay': 'L2 正則化強度，懲罰過大的權重以減輕過擬合。優化器預設為 0.0001。',
  'Label Smoothing': '將訓練標籤稍微平滑，避免模型對正確類別過度自信。預設不使用，數值為 0。',
  'Learning Rate 下限（eta_min）': 'Cosine 學習率排程的下限，避免訓練後期學習率降到 0。預設為 0。',
  'Crop Padding': 'ROI 裁切時在病灶邊界外多保留的像素邊距。預設不額外留白，數值為 0。',
  'Freeze Epochs': '前幾個 Epoch 先凍結預訓練特徵層，只訓練分類頭。預設不凍結，數值為 0。',
  'Finetune Learning Rate': '解凍特徵層之後，全面微調所使用的學習率。預設與初始學習率相同，為 0.001。',
  'LearnRateSchedule': '是否依訓練進度調整學習率，例如 cosine 或分段下降。預設關閉。',
  'ReLU': '卷積後的非線性激活函數。預設啟用 ReLU；移除後該層輸出保持線性。',
  '激活函數': '特徵層使用的非線性函數。預設為 ReLU，可改為 LeakyReLU 以保留負值訊息。',
  'ROI 資料裁切': '是否先依胰臟區域裁切影像，再送入模型。預設使用完整影像、不裁切。',
  '測試集': '測試階段的影像是否沿用訓練時的前處理。此項改為直接使用原圖評估。',
  '預訓練權重': '是否載入 ImageNet 預訓練權重再進行微調。預設從頭訓練、不載入預訓練權重。',
  '凍結預訓練特徵層': '是否凍結骨幹特徵層，只更新後段分類層。預設全部層都可訓練。',
  '資料增強': '訓練時是否對影像做隨機變換，以增加樣本變化。預設關閉。',
  '資料切分（訓練&測試）': '訓練集與測試集的樣本比例。',
};

function pancreaticDefaultHyperparams(modelCfg) {
  const hp = modelCfg?.hyperparameters || {};
  return {
    batch_size: 128,
    dropout: hp.dropout ?? 0.5,
    learning_rate: 0.001,
    weight_decay: hp.weight_decay ?? 0.0001,
  };
}

function mapPancreaticTuningToken(token, hp) {
  const t = String(token || '').trim();
  let match;
  if ((match = t.match(/^lr([0-9.eE+-]+)$/i))) {
    return { name: 'Learning Rate', value: match[1], defaultValue: String(hp.learning_rate), kind: '優化器' };
  }
  if ((match = t.match(/^dropout([0-9.]+)$/i))) {
    return { name: 'Dropout', value: match[1], defaultValue: String(hp.dropout), kind: '架構' };
  }
  if ((match = t.match(/^weight_decay([0-9.eE+-]+)$/i))) {
    return { name: 'Weight Decay', value: match[1], defaultValue: String(hp.weight_decay), kind: '優化器' };
  }
  if ((match = t.match(/^label_smoothing([0-9.eE+-]+)$/i))) {
    return { name: 'Label Smoothing', value: match[1], defaultValue: '0', kind: '優化器' };
  }
  if ((match = t.match(/^eta_min([0-9.eE+-]+)$/i))) {
    return { name: 'Learning Rate 下限（eta_min）', value: match[1], defaultValue: '0', kind: '優化器' };
  }
  if ((match = t.match(/^crop_padding(\d+)$/i))) {
    return { name: 'Crop Padding', value: match[1], defaultValue: '0', kind: '架構' };
  }
  if ((match = t.match(/^freeze_epochs(\d+)$/i))) {
    return { name: 'Freeze Epochs', value: match[1], defaultValue: '0', kind: '架構' };
  }
  if ((match = t.match(/^finetune_learning_rate(.+)$/i))) {
    return { name: 'Finetune Learning Rate', value: match[1], defaultValue: String(hp.learning_rate), kind: '優化器' };
  }
  if (/^LearnRateSchedule$/i.test(t)) {
    return { name: 'LearnRateSchedule', value: '啟用', defaultValue: '關閉', kind: '優化器' };
  }
  if (t === '移除ReLU') {
    return { name: 'ReLU', value: '移除', defaultValue: '啟用', kind: '架構' };
  }
  if (/LeakyReLU/i.test(t)) {
    return { name: '激活函數', value: 'LeakyReLU', defaultValue: 'ReLU', kind: '架構' };
  }
  if (t.includes('ROI')) {
    return { name: 'ROI 資料裁切', value: '啟用', defaultValue: '關閉', kind: '架構' };
  }
  if (t.includes('測試集原圖')) {
    return { name: '測試集', value: '原圖', defaultValue: '與訓練相同前處理', kind: '架構' };
  }
  if (t.includes('預訓練權重')) {
    return { name: '預訓練權重', value: '啟用', defaultValue: '關閉', kind: '架構' };
  }
  if (t.includes('凍結')) {
    return { name: '凍結預訓練特徵層', value: '啟用', defaultValue: '關閉', kind: '架構' };
  }
  if (t.includes('資料增強')) {
    return { name: '資料增強', value: '啟用', defaultValue: '關閉', kind: '架構' };
  }
  if ((match = t.match(/^\(?(\d+)\s*&\s*(\d+)\)?$/))) {
    return { name: '資料切分（訓練&測試）', value: `${match[1]} / ${match[2]}`, defaultValue: '—', kind: '架構' };
  }
  return { name: t, value: '已調整', defaultValue: '預設', kind: '架構' };
}

function splitPancreaticArchMbs(archOptimizer) {
  const text = String(archOptimizer || '').trim();
  const match = text.match(/^(.*?)\s+MBS(\d+)\s*$/i);
  if (!match) return { arch: text || '-', mbs: '' };
  return { arch: match[1].trim() || '-', mbs: `MBS${match[2]}` };
}

function renderPancreaticAdjustmentList(archOptimizer, adjustments) {
  const parsed = splitPancreaticArchMbs(archOptimizer);
  const items = [];
  if (parsed.mbs) items.push(parsed.mbs);
  (adjustments || []).forEach((item) => {
    const text = String(item || '').trim();
    if (text) items.push(text);
  });
  if (!items.length) return '<li class="adj-default">預設參數（無額外調整）</li>';
  return items.map((item, i) => `<li><span class="adj-num">${i + 1}.</span> ${escapeHtml(item)}</li>`).join('');
}

function parsePancreaticTuningRows(item, modelCfg) {
  const hp = pancreaticDefaultHyperparams(modelCfg);
  const rows = [];
  const batch = String(item?.arch_optimizer || '').match(/MBS(\d+)/i);
  if (batch) {
    rows.push({
      name: 'Batch Size',
      value: batch[1],
      defaultValue: String(hp.batch_size),
      kind: '優化器',
    });
  }
  (item?.adjustments || []).forEach((token) => {
    rows.push(mapPancreaticTuningToken(token, hp));
  });
  return rows;
}

function pancreaticTuningOptionLabel(item) {
  const index = item.displayIndex || item.chronological_index || '';
  const date = item.date ? `${item.date.slice(0, 4)}-${item.date.slice(4, 6)}-${item.date.slice(6, 8)}` : '';
  const arch = item.arch_optimizer || '';
  return `項目 ${index}${date ? ` · ${date}` : ''}${arch ? ` · ${arch}` : ''}`;
}

function pancreaticTuningIntro(name) {
  return PANCREATIC_TUNING_INTROS[name] || '此參數來自該實驗相對預設設定的調整項目。';
}

function renderPancreaticTuningDataRows(rows) {
  return rows.map((row) => {
    const open = pancreaticTuningExpandedNames.has(row.name);
    return `
      <tr>
        <td>
          <button type="button" class="tuning-name-btn${open ? ' open' : ''}" data-tuning-name="${escapeAttr(row.name)}" aria-expanded="${open ? 'true' : 'false'}">
            <span class="tuning-name-caret" aria-hidden="true">${open ? '▼' : '▶'}</span>
            ${escapeHtml(row.name)}
          </button>
        </td>
        <td><strong>${escapeHtml(row.value)}</strong></td>
        <td>${escapeHtml(row.defaultValue)}</td>
        <td>${escapeHtml(row.kind)}</td>
      </tr>
      <tr class="tuning-intro-row"${open ? '' : ' hidden'}>
        <td colspan="4">${escapeHtml(pancreaticTuningIntro(row.name))}</td>
      </tr>`;
  }).join('');
}

function renderPancreaticTuningBody(rows) {
  if (!rows.length) {
    return '<tr><td colspan="4" class="placeholder-text">此項目無額外調整，沿用預設參數</td></tr>';
  }
  if (!pancreaticTuningGroupByKind) return renderPancreaticTuningDataRows(rows);
  const kinds = [...new Set(rows.map(row => row.kind))];
  const order = ['架構', '優化器', ...kinds.filter(kind => kind !== '架構' && kind !== '優化器')];
  return order.map((kind) => {
    const group = rows.filter(row => row.kind === kind);
    if (!group.length) return '';
    return `
      <tr class="tuning-group-row"><td colspan="4">${escapeHtml(kind)}</td></tr>
      ${renderPancreaticTuningDataRows(group)}`;
  }).join('');
}

function renderPancreaticTuningTable() {
  const host = document.getElementById('pancreaticTuningHost');
  if (!host) return;
  const items = pancreaticTuningItems;
  if (!items.length) {
    host.innerHTML = `
      <h3>調整參數</h3>
      <p class="placeholder-text">尚無分析結果，有新實驗後會自動顯示最新項目。</p>`;
    return;
  }

  const latest = items[items.length - 1];
  const pinned = pancreaticTuningPinnedId
    ? items.find(item => item.id === pancreaticTuningPinnedId)
    : null;
  const selected = pinned || latest;
  const useDropdown = items.length > 1;
  const rows = parsePancreaticTuningRows(selected, pancreaticTuningModelCfg);
  const body = renderPancreaticTuningBody(rows);
  const picker = useDropdown
    ? `<label class="pancreatic-tuning-picker">
        <span>實驗項目</span>
        <select id="pancreaticTuningItemSelect">
          ${items.map(item => `
            <option value="${escapeAttr(item.id)}"${item.id === selected.id ? ' selected' : ''}>${escapeHtml(pancreaticTuningOptionLabel(item))}</option>`).join('')}
        </select>
      </label>`
    : `<p class="section-hint">${escapeHtml(pancreaticTuningOptionLabel(selected))}</p>`;

  host.innerHTML = `
    <h3>調整參數</h3>
    <p class="section-hint">點項目名稱可展開介紹。點「架構or優化器參數」可依架構與優化器分類。有新結果時會自動切到最新項目。</p>
    ${picker}
    <div class="ref-table-wrap pancreatic-tuning-table-wrap">
      <table class="ref-table compact pancreatic-tuning-table">
        <thead>
          <tr>
            <th>項目名稱</th>
            <th>項目數值</th>
            <th>預設數值</th>
            <th>
              <button type="button" class="tuning-kind-btn${pancreaticTuningGroupByKind ? ' active' : ''}" id="pancreaticTuningKindSort">
                架構or優化器參數
              </button>
            </th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

async function refreshPancreaticTuningTable(jumpToLatest = false) {
  if (selectedAppId !== 'pancreatic') return;
  if (!document.getElementById('pancreaticTuningHost')) return;
  if (jumpToLatest) pancreaticTuningPinnedId = null;
  try {
    const res = await fetch(`/api/pancreatic/analysis${apiVersionQuery()}`);
    if (!res.ok) return;
    const data = await res.json();
    const items = applyPancreaticChronologicalOrder(data.items || []);
    items.forEach((item, index) => { item.displayIndex = index + 1; });
    pancreaticTuningItems = items;
    renderPancreaticTuningTable();
  } catch (err) {
    console.error('載入調整參數失敗', err);
  }
}

function bindPancreaticTuningEvents() {
  if (bindPancreaticTuningEvents.bound) return;
  bindPancreaticTuningEvents.bound = true;
  document.addEventListener('change', (event) => {
    const select = event.target.closest('#pancreaticTuningItemSelect');
    if (!select) return;
    pancreaticTuningPinnedId = select.value;
    pancreaticTuningExpandedNames.clear();
    renderPancreaticTuningTable();
  });
  document.addEventListener('click', (event) => {
    const host = event.target.closest('#pancreaticTuningHost');
    if (!host) return;
    const nameBtn = event.target.closest('.tuning-name-btn');
    if (nameBtn) {
      const name = nameBtn.dataset.tuningName;
      if (pancreaticTuningExpandedNames.has(name)) pancreaticTuningExpandedNames.delete(name);
      else pancreaticTuningExpandedNames.add(name);
      renderPancreaticTuningTable();
      return;
    }
    if (event.target.closest('#pancreaticTuningKindSort')) {
      pancreaticTuningGroupByKind = !pancreaticTuningGroupByKind;
      renderPancreaticTuningTable();
    }
  });
}

async function renderPancreaticModelConfigAsync(modelCfg) {
  document.getElementById('covidModelExtra').innerHTML = '';
  pancreaticTuningModelCfg = modelCfg;
  bindPancreaticTuningEvents();

  document.getElementById('modelConfig').innerHTML = `
    <div class="config-card pancreatic-hardware-card">
      <h3>硬體規格</h3>
      <div class="pancreatic-hardware-list">
        <div><span>處理器</span><strong>Intel Core i5-8400（6 核心）</strong></div>
        <div><span>記憶體</span><strong>8 GB DDR4</strong></div>
        <div><span>顯示卡</span><strong>NVIDIA GeForce RTX 2060 12 GB</strong></div>
      </div>
    </div>
    <div class="config-card"><h3>預設架構</h3><div class="value">${modelCfg.architecture}</div></div>
    <div class="config-card"><h3>預設優化器</h3><div class="value">${modelCfg.optimizer}</div></div>
    <div class="config-card pancreatic-tuning-card" id="pancreaticTuningHost">
      <h3>調整參數</h3>
      <p class="placeholder-text">載入分析結果…</p>
    </div>
  `;
  await refreshPancreaticTuningTable(false);

  const architectures = modelCfg.architectures || [];
  const optimizers = modelCfg.optimizers || [];

  const archItems = architectures.map(a => `
    <div class="arch-expand-item" data-arch="${escapeAttr(a.name)}">
      <button type="button" class="arch-expand-header">
        <span class="arch-expand-title">
          <strong>${a.name}</strong>${a.selected ? ' <span class="arch-selected">✓ 預設</span>' : ''}
          <span class="arch-meta">${a.parameters_display || ''}</span>
        </span>
        <span class="expand-icon">▼</span>
      </button>
      <div class="arch-expand-body">
        <p class="arch-brief">${a.description || ''}</p>
        <div class="arch-expand-actions">
          <button type="button" class="btn btn-ghost btn-sm arch-detail-btn" data-type="params">可調參數</button>
          <button type="button" class="btn btn-ghost btn-sm arch-detail-btn" data-type="intro">架構介紹</button>
        </div>
      </div>
    </div>
  `).join('');

  const optCards = optimizers.map(o => `
    <button type="button" class="opt-card opt-card-btn" data-opt="${escapeAttr(o.name)}">
      <h4>${o.name}</h4>
      <p>${o.description || ''}</p>
      <span class="opt-card-hint">點擊查看可調參數 →</span>
    </button>
  `).join('');

  document.getElementById('covidModelExtra').innerHTML = `
    <h3 class="section-subtitle">網路架構</h3>
    <p class="section-hint">點擊架構名稱展開，可查看可調參數或架構介紹</p>
    <div class="arch-expand-list">${archItems}</div>
    <h3 class="section-subtitle" style="margin-top:24px">優化器</h3>
    <p class="section-hint">點擊優化器卡片查看可調參數</p>
    <div class="opt-cards">${optCards}</div>
  `;

  await fetchPancreaticModelDetails(true);
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let pancreaticDetailEventsBound = false;

function bindPancreaticModelDetailEvents() {
  if (pancreaticDetailEventsBound) return;
  pancreaticDetailEventsBound = true;
  document.addEventListener('click', onPancreaticModelDetailClick);
}

async function onPancreaticModelDetailClick(e) {
  if (selectedAppId !== 'pancreatic') return;
  const modelingPanel = document.getElementById('step-modeling');
  if (!modelingPanel?.classList.contains('active')) return;
  if (!e.target.closest('#covidModelExtra')) return;

  const archBtn = e.target.closest('.arch-detail-btn');
  if (archBtn) {
    e.preventDefault();
    e.stopPropagation();
    const item = archBtn.closest('.arch-expand-item');
    const archName = item?.dataset.arch;
    const type = archBtn.dataset.type;
    const details = await fetchPancreaticModelDetails();
    const archData = details.architectures?.[archName];
    if (!archData) {
      alert('無法載入架構詳情，請重新整理頁面 (Ctrl+F5) 後再試');
      return;
    }
    if (type === 'params') {
      showModelDetailTable(`${archName} · 可調參數`, archData.tunable_params);
    } else {
      showModelDetailIntro(`${archName} · 架構介紹`, archData.introduction);
    }
    return;
  }

  const optBtn = e.target.closest('.opt-card-btn');
  if (optBtn) {
    e.preventDefault();
    e.stopPropagation();
    const optName = optBtn.dataset.opt;
    const details = await fetchPancreaticModelDetails();
    const optData = details.optimizers?.[optName];
    if (!optData) {
      alert('無法載入優化器詳情，請重新整理頁面 (Ctrl+F5) 後再試');
      return;
    }
    showModelDetailTable(`${optName} · 可調參數`, optData);
    return;
  }

  const header = e.target.closest('.arch-expand-header');
  if (header) {
    e.preventDefault();
    const item = header.closest('.arch-expand-item');
    if (!item) return;
    const open = item.classList.toggle('open');
    const icon = header.querySelector('.expand-icon');
    if (icon) icon.textContent = open ? '▲' : '▼';
  }
}

function showModelDetailTable(title, tableData) {
  if (!tableData?.columns || !tableData?.rows?.length) {
    alert('找不到可顯示的參數資料');
    return;
  }
  const head = tableData.columns.map(c => `<th>${c}</th>`).join('');
  const body = tableData.rows.map(row => `
    <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
  `).join('');
  openModelDetailModal(title, `
    <div class="ref-table-wrap model-detail-table-wrap">
      <table class="ref-table compact">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `);
}

function showModelDetailIntro(title, introData) {
  if (!introData?.sections?.length) {
    alert('找不到架構介紹內容');
    return;
  }
  const html = introData.sections.map(s => `
    <div class="model-intro-section">
      <h3>${s.title}</h3>
      <div class="model-intro-content">${formatIntroText(s.content)}</div>
    </div>
  `).join('');
  openModelDetailModal(title, html);
}

function formatIntroText(text) {
  return String(text)
    .split('\n')
    .map(line => line.trim() ? `<p>${line.replace(/^•\s*/, '• ')}</p>` : '')
    .join('');
}

function openModelDetailModal(title, bodyHtml) {
  const modal = document.getElementById('modelDetailModal');
  if (!modal) {
    alert('彈窗元件未載入，請強制重新整理頁面 (Ctrl+F5)');
    return;
  }
  document.getElementById('modelDetailTitle').textContent = title;
  document.getElementById('modelDetailBody').innerHTML = bodyHtml;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModelDetailModal() {
  const modal = document.getElementById('modelDetailModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  modal.querySelector('.model-detail-card')?.classList.remove('wide');
  pancreaticRunViewer = { itemId: null, runNum: 1, runCount: 1 };
}

function renderCovidSimulation(research) {
  const el = document.getElementById('covidSimulationPlan');
  if (!research) { el.innerHTML = ''; return; }

  const summary = research.run_summary || {};
  const matrix = research.architecture_optimizer_matrix || {};
  const matrixRows = (matrix.results || []).map(r => `
    <tr>
      <td>${r.architecture}</td>
      <td>${r.optimizer}</td>
      <td>${r.test_accuracy != null ? (r.test_accuracy * 100).toFixed(2) + '%' : r.note || '-'}</td>
    </tr>
  `).join('');

  const tuningBlocks = (research.hyperparameter_tuning || []).map(phase => {
    const rows = (phase.results || []).map(r => {
      const paramVal = r.value !== undefined ? r.value : JSON.stringify(r.hyperparameters || {});
      return `<tr><td>${r.optimizer || '-'}</td><td>${paramVal}</td><td>${r.test_accuracy != null ? (r.test_accuracy * 100).toFixed(2) + '%' : '-'}</td></tr>`;
    }).join('');
    return `
      <div class="phase-card">
        <h4>${phase.phase} <span class="phase-runs">${phase.runs} RUN</span></h4>
        <p class="phase-meta">架構：${phase.fixed_architecture || 'MobileNetV2'} · 調參項目：${phase.parameter || '混合'}</p>
        <div class="ref-table-wrap"><table class="ref-table compact">
          <thead><tr><th>優化器</th><th>參數值</th><th>測試準確度</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="sim-summary-bar">
      <div class="summary-card"><div class="summary-value">${summary.architecture_screening_runs || 80}</div><div class="summary-label">架構×優化器 RUN</div></div>
      <div class="summary-card"><div class="summary-value">${summary.small_scale_runs || 280}</div><div class="summary-label">小規模 RUN</div></div>
      <div class="summary-card"><div class="summary-value">${summary.large_scale_runs || 500}</div><div class="summary-label">大規模 RUN</div></div>
      <div class="summary-card"><div class="summary-value">${summary.total_runs || 870}</div><div class="summary-label">總 RUN 數</div></div>
    </div>
    <h3 class="section-subtitle">架構×優化器混合測試（${matrix.runs || 80} RUN）</h3>
    <div class="ref-table-wrap"><table class="ref-table">
      <thead><tr><th>架構</th><th>優化器</th><th>平均測試準確度</th></tr></thead>
      <tbody>${matrixRows}</tbody>
    </table></div>
    <h3 class="section-subtitle" style="margin-top:24px">超參數調整（小規模 ${summary.small_scale_runs || 280} RUN）</h3>
    <div class="phase-grid">${tuningBlocks}</div>
    <div class="phase-card highlight" style="margin-top:20px">
      <h4>大規模模擬 · ${research.large_scale_summary?.runs || 500} RUN</h4>
      <p>配置：${research.large_scale_summary?.architecture}+${research.large_scale_summary?.optimizer}</p>
      <div class="sim-results">
        <div class="sim-item"><span>平均驗證準確度</span><strong>${((research.large_scale_summary?.avg_val_accuracy || 0) * 100).toFixed(2)}%</strong></div>
        <div class="sim-item"><span>平均測試準確度</span><strong>${((research.large_scale_summary?.avg_test_accuracy || 0) * 100).toFixed(2)}%</strong></div>
      </div>
    </div>
  `;

  document.getElementById('runsContainer').innerHTML = '';
}

function updateSimulationDemoVisibility() {
  const simControls = document.getElementById('simControls');
  const runsContainer = document.getElementById('runsContainer');
  const appId = getActiveAppId();
  const hideDemo = appId === 'pancreatic' || appId === 'covid';

  if (simControls) simControls.style.display = hideDemo ? 'none' : 'flex';
  if (runsContainer) {
    if (appId === 'pancreatic') {
      runsContainer.style.display = 'none';
      runsContainer.innerHTML = '';
      Object.keys(runs).forEach(id => delete runs[id]);
    } else {
      runsContainer.style.display = '';
    }
  }
}

function removeRunCard(runId) {
  document.getElementById(`run-${runId}`)?.remove();
  delete runs[runId];
  const container = document.getElementById('runsContainer');
  if (container && container.style.display !== 'none' && !container.querySelector('.run-card')) {
    container.innerHTML = '<p class="placeholder-text">尚無訓練 RUN，點擊「開始新 RUN」啟動</p>';
  }
}

let pancreaticSimPlanMode = 'all';

function pancreaticSimPlanValueChanged(row) {
  const norm = (value) => String(value ?? '').replace(/分別為：/g, '').replace(/"/g, '').replace(/\s+/g, '');
  return norm(row.defaultValue) !== norm(row.current);
}

function renderPancreaticSimPlanLines(lines) {
  return (lines || []).map((line) => escapeHtml(line)).join('<br>');
}

function pancreaticSimPlanHasPending(row) {
  return (row.adjustments || []).some((value) => String(value ?? '').trim());
}

function renderPancreaticSimPlanTable() {
  const source = (typeof PANCREATIC_SIM_PLAN_ROWS === 'undefined') ? [] : PANCREATIC_SIM_PLAN_ROWS;
  const rows = pancreaticSimPlanMode === 'adjusted'
    ? source.filter(pancreaticSimPlanValueChanged)
    : pancreaticSimPlanMode === 'pending'
      ? source.filter(pancreaticSimPlanHasPending)
      : source;
  const body = rows.length
    ? rows.map((row) => `
        <tr class="${pancreaticSimPlanValueChanged(row) ? 'is-adjusted' : ''}">
          <td>${escapeHtml(row.index)}</td>
          <td>${escapeHtml(row.categoryIndex)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td class="sim-plan-name">${renderPancreaticSimPlanLines(row.name)}</td>
          <td>${escapeHtml(row.defaultValue)}</td>
          <td>${escapeHtml(row.current)}</td>
          <td class="sim-plan-num">${renderPancreaticSimPlanLines(row.adjustments)}</td>
          <td class="sim-plan-reason">${escapeHtml(row.description)}</td>
        </tr>`).join('')
    : `<tr><td colspan="8" class="placeholder-text">${pancreaticSimPlanMode === 'pending' ? '沒有待調整項目' : '沒有調整項目'}</td></tr>`;
  return `
    <div class="ref-table-wrap pancreatic-sim-plan-wrap">
      <table class="ref-table compact pancreatic-sim-plan-table">
        <thead>
          <tr>
            <th>項目編號(全部)</th>
            <th>項目編號(類別)</th>
            <th>類別</th>
            <th>參數名稱</th>
            <th>預設值</th>
            <th>目前數值</th>
            <th>調整數值</th>
            <th>參數說明</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderPancreaticSimulationPlan() {
  bindPancreaticSimPlanEvents();
  return `
    <section class="pancreatic-sim-plan" id="pancreaticSimPlan">
      <div class="pancreatic-sim-plan-head">
        <div>
          <h3 class="section-subtitle">模擬規劃</h3>
          <p class="section-hint">SqueezeNet + Adam</p>
        </div>
        <div class="pancreatic-sim-plan-switch" role="group" aria-label="模擬規劃表格版本">
          <button type="button" class="btn btn-ghost btn-sm${pancreaticSimPlanMode === 'all' ? ' active' : ''}" data-sim-plan-mode="all">總表</button>
          <button type="button" class="btn btn-ghost btn-sm${pancreaticSimPlanMode === 'adjusted' ? ' active' : ''}" data-sim-plan-mode="adjusted">調整項目</button>
          <button type="button" class="btn btn-ghost btn-sm${pancreaticSimPlanMode === 'pending' ? ' active' : ''}" data-sim-plan-mode="pending">待調整項目</button>
        </div>
      </div>
      <div id="pancreaticSimPlanTable">${renderPancreaticSimPlanTable()}</div>
    </section>`;
}

function bindPancreaticSimPlanEvents() {
  if (bindPancreaticSimPlanEvents.bound) return;
  bindPancreaticSimPlanEvents.bound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-sim-plan-mode]');
    if (!btn || !btn.closest('#pancreaticSimPlan')) return;
    pancreaticSimPlanMode = btn.dataset.simPlanMode;
    const host = document.getElementById('pancreaticSimPlanTable');
    if (host) host.innerHTML = renderPancreaticSimPlanTable();
    document.querySelectorAll('#pancreaticSimPlan [data-sim-plan-mode]').forEach((el) => {
      el.classList.toggle('active', el.dataset.simPlanMode === pancreaticSimPlanMode);
    });
  });
}

async function renderPancreaticSimulation() {
  updateSimulationDemoVisibility();
  const el = document.getElementById('covidSimulationPlan');
  if (!el) return;

  try {
    const [simRes, jobsRes] = await Promise.all([
      fetch('/api/pancreatic/simulation'),
      fetch('/api/pancreatic/simulation/jobs'),
    ]);
    if (simRes.ok) currentPancreaticSimulation = await simRes.json();
    if (jobsRes.ok) {
      const jobs = await jobsRes.json();
      jobs.forEach(j => { pancreaticTrainingJobs[j.job_id] = j; });
    }
  } catch (err) {
    console.error('載入模擬設定失敗', err);
  }

  const sim = currentPancreaticSimulation;
  const codePaths = (sim?.code_paths?.length ? sim.code_paths : (sim?.code_path ? [sim.code_path] : []));
  if (!codePaths.length) {
    el.innerHTML = renderPancreaticSimulationPlan();
    return;
  }

  const scripts = sim.scripts || [];
  const scriptRows = scripts.length
    ? scripts.flatMap(s => {
        const adjItems = renderPancreaticAdjustmentList(s.arch_optimizer, s.adjustments);
        const fnameKey = encodeFilenameKey(s.filename);
        const editBtnHtml = isPancreaticAdvancedFeature()
          ? `<button type="button" class="btn btn-ghost btn-sm btn-edit-script" data-filename="${escapeAttr(s.filename)}">
                  編輯程式
                </button>`
          : '';
        const archMbs = splitPancreaticArchMbs(s.arch_optimizer);
        return [
          `<tr class="script-data-row" data-filename-key="${fnameKey}">
            <td class="col-date">${s.date || '-'}</td>
            <td class="col-arch">${escapeHtml(archMbs.arch)}</td>
            <td class="col-adjust">
              <ol class="adjust-list">${adjItems}</ol>
            </td>
            <td class="col-action">
              <div class="training-action-btns">
                ${editBtnHtml}
                <button type="button" class="btn btn-primary btn-sm btn-start-training" data-filename="${escapeAttr(s.filename)}">
                  開始訓練
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-stop-training" data-filename="${escapeAttr(s.filename)}" data-job-id="" hidden>
                  停止訓練
                </button>
                <button type="button" class="btn btn-ghost btn-sm btn-view-log" data-filename="${escapeAttr(s.filename)}" data-job-id="" hidden>
                  觀看日誌
                </button>
              </div>
            </td>
          </tr>`,
          `<tr class="training-progress-row" data-progress-for="${fnameKey}" hidden>
            <td colspan="4">
              <details class="training-progress-details" open>
                <summary class="training-progress-summary">
                  <span class="progress-status-dot pending"></span>
                  訓練進度
                </summary>
                <div class="training-progress-body">
                  <div class="training-progress-stats">
                    <div class="pg-stat">
                      <span class="pg-label">Run</span>
                      <span class="pg-value">第 <strong class="pg-run">-</strong> / <span class="pg-run-total">-</span> Run</span>
                    </div>
                    <div class="pg-stat">
                      <span class="pg-label">Epoch</span>
                      <span class="pg-value">第 <strong class="pg-epoch">-</strong> / <span class="pg-epoch-total">-</span> Epoch</span>
                    </div>
                    <div class="pg-stat">
                      <span class="pg-label">時間</span>
                      <span class="pg-value">已運行 <strong class="pg-elapsed">0</strong> 秒</span>
                    </div>
                  </div>
                  <div class="progress-bar-wrap">
                    <div class="progress-bar pg-bar" style="width:0%"></div>
                  </div>
                  <p class="pg-message phase-meta">等待開始…</p>
                </div>
              </details>
            </td>
          </tr>`,
        ];
      }).join('')
    : '<tr><td colspan="4" class="placeholder-text">此資料夾尚無 .py 程式檔</td></tr>';

  ensurePancreaticScriptEditorHost();
  if (!isPancreaticAdvancedFeature()) {
    hidePancreaticScriptEditor();
  }

  el.innerHTML = `
    <div class="sim-summary-bar">
      <div class="summary-card">
        <div class="summary-value">${sim.training_environment?.split(' ')[0] || 'VSCode'}</div>
        <div class="summary-label">訓練環境</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${sim.framework || 'PyTorch'}</div>
        <div class="summary-label">深度學習框架</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${sim.script_count ?? scripts.length}</div>
        <div class="summary-label">訓練程式</div>
      </div>
    </div>
    <div class="phase-card highlight">
      <h4>訓練環境設定</h4>
      <div class="dataset-meta" style="margin-top:12px">
        <div class="meta-item">
          <span class="meta-key">訓練環境</span>
          <span class="meta-val">${sim.training_environment || 'Visual Studio Code (VSCode)'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-key">框架</span>
          <span class="meta-val">${sim.framework || 'PyTorch'}</span>
        </div>
        <div class="meta-item meta-path">
          <span class="meta-key">程式來源</span>
          <span class="meta-val">${codePaths.map(p => escapeHtml(p)).join('<br>')}</span>
        </div>
        ${sim.output_path ? `
        <div class="meta-item meta-path">
          <span class="meta-key">成果輸出位置</span>
          <span class="meta-val">${sim.output_path}</span>
        </div>` : ''}
      </div>
      ${sim.description ? `<p class="phase-meta" style="margin-top:12px">${sim.description}</p>` : ''}
    </div>
    ${renderPancreaticSimulationPlan()}
    <h3 class="section-subtitle" style="margin-top:24px">訓練 RUN 清單</h3>
    <p class="section-hint">架構&amp;優化器代號：S = SqueezeNet1.1，A = Adam（例：S+A）。MBS 列在調整項目。可「編輯程式」修改參數後儲存，再按「開始訓練」；下方也可建立新 .py 檔。</p>
    <div class="ref-table-wrap pancreatic-training-table-wrap">
      <table class="ref-table pancreatic-training-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>架構&amp;優化器</th>
            <th>調整項目（與預設相比）</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${scriptRows}</tbody>
      </table>
    </div>
  `;

  Object.values(pancreaticTrainingJobs).forEach(job => {
    updatePancreaticTrainingPanel(job);
    updateTrainingActionButtons(job);
  });

  ensurePancreaticScriptEditorHost();
  if (isPancreaticAdvancedFeature() && pancreaticScriptEditor.filename) {
    document.getElementById('pancreaticScriptEditorHost').hidden = false;
  }
}

function hidePancreaticScriptEditor() {
  const host = document.getElementById('pancreaticScriptEditorHost');
  if (host) host.hidden = true;
  pancreaticScriptEditor.filename = null;
  pancreaticScriptEditor.dirty = false;
  pancreaticScriptEditor.loaded = false;
}

const PANCREATIC_CM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
let pancreaticScriptEditor = {
  cm: null,
  filename: null,
  dirty: false,
  loaded: false,
};
let codeMirrorLoadPromise = null;
let pancreaticScriptEditorEventsBound = false;

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function ensureCodeMirrorLoaded() {
  if (window.CodeMirror) return Promise.resolve();
  if (!codeMirrorLoadPromise) {
    codeMirrorLoadPromise = (async () => {
      await loadStylesheet(`${PANCREATIC_CM_CDN}/codemirror.min.css`);
      await loadStylesheet(`${PANCREATIC_CM_CDN}/theme/dracula.min.css`);
      await loadScript(`${PANCREATIC_CM_CDN}/codemirror.min.js`);
      await loadScript(`${PANCREATIC_CM_CDN}/mode/python/python.min.js`);
      await loadScript(`${PANCREATIC_CM_CDN}/addon/edit/matchbrackets.min.js`);
      await loadScript(`${PANCREATIC_CM_CDN}/addon/edit/closebrackets.min.js`);
    })();
  }
  return codeMirrorLoadPromise;
}

function ensurePancreaticScriptEditorHost() {
  if (!isPancreaticAdvancedFeature() || getActiveAppId() !== 'pancreatic') return null;
  let host = document.getElementById('pancreaticScriptEditorHost');
  if (host) return host;

  const panel = document.getElementById('step-simulation');
  const plan = document.getElementById('covidSimulationPlan');
  if (!panel || !plan) return null;

  host = document.createElement('div');
  host.id = 'pancreaticScriptEditorHost';
  host.className = 'pancreatic-script-editor-host';
  host.hidden = true;
  host.innerHTML = `
    <div class="pancreatic-script-editor-card">
      <div class="pancreatic-script-editor-header">
        <div>
          <h3 class="section-subtitle">Python 程式編輯</h3>
          <p class="pancreatic-script-editor-intro">在網頁編輯或新建訓練腳本後儲存，即可開始訓練。</p>
          <p class="pancreatic-script-editor-filename" id="pancreaticScriptEditorFilename">—</p>
        </div>
        <div class="pancreatic-script-editor-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="pancreaticScriptEditorReloadBtn">重新載入</button>
          <button type="button" class="btn btn-ghost btn-sm" id="pancreaticScriptEditorSaveBtn">儲存</button>
          <button type="button" class="btn btn-primary btn-sm" id="pancreaticScriptEditorRunBtn">儲存並開始訓練</button>
          <button type="button" class="btn btn-ghost btn-sm" id="pancreaticScriptEditorCloseBtn">關閉</button>
        </div>
      </div>
      <div class="pancreatic-script-new-panel" id="pancreaticScriptNewPanel">
        <label class="pancreatic-script-new-field">
          <span>新建 .py 檔名</span>
          <input id="pancreaticScriptNewName" type="text" placeholder="例：20260713 S+A lr0.0001.py">
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="pancreaticScriptNewCreateBtn">建立新檔</button>
      </div>
      <div id="pancreaticScriptEditorStatus" class="pancreatic-script-editor-status"></div>
      <textarea id="pancreaticScriptEditorTextarea"></textarea>
    </div>`;

  panel.insertBefore(host, plan.nextSibling);
  bindPancreaticScriptEditorEvents();
  updatePancreaticScriptEditorPermissions();
  return host;
}

function updatePancreaticScriptEditorPermissions() {
  const canEdit = !!authState.can_edit;
  document.getElementById('pancreaticScriptEditorSaveBtn')?.toggleAttribute('disabled', !canEdit);
  document.getElementById('pancreaticScriptEditorRunBtn')?.toggleAttribute('disabled', !canEdit);
  document.getElementById('pancreaticScriptNewCreateBtn')?.toggleAttribute('disabled', !canEdit);
  document.getElementById('pancreaticScriptNewPanel')?.classList.toggle('is-readonly', !canEdit);
  if (pancreaticScriptEditor.cm) {
    pancreaticScriptEditor.cm.setOption('readOnly', canEdit ? false : 'nocursor');
  }
}

function bindPancreaticScriptEditorEvents() {
  if (pancreaticScriptEditorEventsBound) return;
  pancreaticScriptEditorEventsBound = true;
  document.getElementById('pancreaticScriptEditorSaveBtn')?.addEventListener('click', () => savePancreaticScriptFromEditor(false));
  document.getElementById('pancreaticScriptEditorRunBtn')?.addEventListener('click', () => savePancreaticScriptFromEditor(true));
  document.getElementById('pancreaticScriptEditorReloadBtn')?.addEventListener('click', () => reloadPancreaticScriptFromDisk());
  document.getElementById('pancreaticScriptEditorCloseBtn')?.addEventListener('click', () => closePancreaticScriptEditor());
  document.getElementById('pancreaticScriptNewCreateBtn')?.addEventListener('click', () => createNewPancreaticScript());
}

function setPancreaticScriptEditorStatus(message, type = '') {
  const el = document.getElementById('pancreaticScriptEditorStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = `pancreatic-script-editor-status${type ? ` is-${type}` : ''}`;
}

async function initPancreaticCodeMirror() {
  if (pancreaticScriptEditor.cm) return pancreaticScriptEditor.cm;
  await ensureCodeMirrorLoaded();
  const textarea = document.getElementById('pancreaticScriptEditorTextarea');
  if (!textarea || !window.CodeMirror) return null;
  pancreaticScriptEditor.cm = window.CodeMirror.fromTextArea(textarea, {
    mode: 'python',
    theme: 'dracula',
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    viewportMargin: Infinity,
  });
  pancreaticScriptEditor.cm.on('change', () => {
    if (!pancreaticScriptEditor.loaded) return;
    pancreaticScriptEditor.dirty = true;
    setPancreaticScriptEditorStatus('有未儲存的變更', 'warn');
  });
  updatePancreaticScriptEditorPermissions();
  return pancreaticScriptEditor.cm;
}

async function openPancreaticScriptEditor(filename) {
  if (!isPancreaticAdvancedFeature()) return;
  if (!filename) return;
  if (pancreaticScriptEditor.dirty && pancreaticScriptEditor.filename !== filename) {
    const ok = confirm('目前有未儲存的變更，確定要切換到其他檔案嗎？');
    if (!ok) return;
  }

  const host = ensurePancreaticScriptEditorHost();
  if (!host) return;
  host.hidden = false;
  setPancreaticScriptEditorStatus('載入中…');
  document.getElementById('pancreaticScriptEditorFilename').textContent = filename;

  try {
      const res = await fetch(`/api/pancreatic/simulation/scripts/${encodeURIComponent(filename)}${apiVersionQuery()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || '載入失敗');

    const cm = await initPancreaticCodeMirror();
    if (!cm) throw new Error('無法初始化編輯器');

    pancreaticScriptEditor.loaded = false;
    cm.setValue(data.content || '');
    pancreaticScriptEditor.filename = filename;
    pancreaticScriptEditor.dirty = false;
    pancreaticScriptEditor.loaded = true;

    const meta = authState.can_edit ? `可編輯 · 上次修改 ${data.modified || '—'}` : `唯讀模式 · 上次修改 ${data.modified || '—'}`;
    setPancreaticScriptEditorStatus(meta, 'ok');
    cm.focus();
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    setPancreaticScriptEditorStatus(err.message || '載入程式失敗', 'error');
  }
}

function closePancreaticScriptEditor() {
  if (pancreaticScriptEditor.dirty && !confirm('有未儲存的變更，確定關閉？')) return;
  const host = document.getElementById('pancreaticScriptEditorHost');
  if (host) host.hidden = true;
  pancreaticScriptEditor.filename = null;
  pancreaticScriptEditor.dirty = false;
  pancreaticScriptEditor.loaded = false;
  setPancreaticScriptEditorStatus('');
}

async function reloadPancreaticScriptFromDisk() {
  if (!pancreaticScriptEditor.filename) return;
  if (pancreaticScriptEditor.dirty && !confirm('未儲存的變更將被捨棄，確定重新載入？')) return;
  await openPancreaticScriptEditor(pancreaticScriptEditor.filename);
}

async function savePancreaticScriptFromEditor(andRun = false) {
  if (!authState.can_edit) {
    alert('需要登入編輯權限才能儲存程式');
    return;
  }
  if (!pancreaticScriptEditor.filename || !pancreaticScriptEditor.cm) return;

  const content = pancreaticScriptEditor.cm.getValue();
  const filename = pancreaticScriptEditor.filename;
  setPancreaticScriptEditorStatus('儲存中…');

  try {
    const res = await fetch(`/api/pancreatic/simulation/scripts/${encodeURIComponent(filename)}${apiVersionQuery()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || '儲存失敗');

    pancreaticScriptEditor.dirty = false;
    setPancreaticScriptEditorStatus(`已儲存 · ${data.modified || ''}`, 'ok');
    await renderPancreaticSimulation();
    if (pancreaticScriptEditor.filename) {
      document.getElementById('pancreaticScriptEditorHost').hidden = false;
      document.getElementById('pancreaticScriptEditorFilename').textContent = filename;
      if (pancreaticScriptEditor.cm) pancreaticScriptEditor.cm.setValue(content);
    }

    if (andRun) {
      const startBtn = document.querySelector(`.btn-start-training[data-filename="${CSS.escape(filename)}"]`);
      if (startBtn) await startPancreaticTraining(filename, startBtn);
    }
  } catch (err) {
    setPancreaticScriptEditorStatus(err.message || '儲存失敗', 'error');
  }
}

async function createNewPancreaticScript() {
  if (!authState.can_edit) {
    alert('需要登入編輯權限才能建立新檔');
    return;
  }
  const nameInput = document.getElementById('pancreaticScriptNewName');
  const filename = (nameInput?.value || '').trim();
  if (!filename) {
    alert('請輸入新檔名（需含 .py）');
    return;
  }
  if (!filename.toLowerCase().endsWith('.py')) {
    alert('檔名必須以 .py 結尾');
    return;
  }

  setPancreaticScriptEditorStatus('建立新檔中…');
  try {
    const res = await fetch(`/api/pancreatic/simulation/scripts${apiVersionQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || '建立失敗');

    if (nameInput) nameInput.value = '';
    await renderPancreaticSimulation();
    await openPancreaticScriptEditor(filename);
    setPancreaticScriptEditorStatus('新檔已建立，請修改參數後儲存', 'ok');
  } catch (err) {
    setPancreaticScriptEditorStatus(err.message || '建立失敗', 'error');
  }
}

function encodeFilenameKey(filename) {
  return btoa(unescape(encodeURIComponent(filename))).replace(/=/g, '');
}

function decodeFilenameKey(key) {
  try {
    const pad = key.length % 4 === 0 ? '' : '='.repeat(4 - (key.length % 4));
    return decodeURIComponent(escape(atob(key + pad)));
  } catch {
    return key;
  }
}

function showPancreaticProgressPanel(filename) {
  const row = document.querySelector(`.training-progress-row[data-progress-for="${encodeFilenameKey(filename)}"]`);
  if (row) {
    row.hidden = false;
    row.querySelector('details')?.setAttribute('open', 'open');
  }
}

function getTrainingActionCell(filename) {
  const escaped = CSS.escape(filename);
  return document.querySelector(`.btn-start-training[data-filename="${escaped}"]`)?.closest('.training-action-btns');
}

function updateTrainingActionButtons(job) {
  if (!job?.filename) return;
  const cell = getTrainingActionCell(job.filename);
  if (!cell) return;

  const startBtn = cell.querySelector('.btn-start-training');
  const stopBtn = cell.querySelector('.btn-stop-training');
  const logBtn = cell.querySelector('.btn-view-log');
  const isRunning = job.status === 'running';
  const hasLog = Boolean(job.log_path);

  if (startBtn) {
    startBtn.hidden = isRunning;
    startBtn.disabled = false;
    startBtn.textContent = '開始訓練';
  }
  if (stopBtn) stopBtn.hidden = !isRunning;
  if (logBtn) logBtn.hidden = !(isRunning || hasLog);
  if (stopBtn && job.job_id) stopBtn.dataset.jobId = job.job_id;
  if (logBtn && job.job_id) logBtn.dataset.jobId = job.job_id;
}

function updatePancreaticTrainingPanel(job) {
  if (!job?.filename) return;
  const key = encodeFilenameKey(job.filename);
  const row = document.querySelector(`.training-progress-row[data-progress-for="${key}"]`);
  if (!row) return;

  row.hidden = false;
  const dot = row.querySelector('.progress-status-dot');
  const runEl = row.querySelector('.pg-run');
  const runTotalEl = row.querySelector('.pg-run-total');
  const epochEl = row.querySelector('.pg-epoch');
  const epochTotalEl = row.querySelector('.pg-epoch-total');
  const elapsedEl = row.querySelector('.pg-elapsed');
  const barEl = row.querySelector('.pg-bar');
  const msgEl = row.querySelector('.pg-message');

  if (dot) {
    dot.className = `progress-status-dot ${job.status || 'pending'}`;
  }
  if (runEl) runEl.textContent = job.current_run > 0 ? job.current_run : '-';
  if (runTotalEl) runTotalEl.textContent = job.total_runs || '-';
  if (epochEl) epochEl.textContent = job.current_epoch > 0 ? job.current_epoch : '-';
  if (epochTotalEl) epochTotalEl.textContent = job.total_epochs || '-';
  if (elapsedEl) elapsedEl.textContent = job.elapsed_seconds ?? 0;
  if (barEl) barEl.style.width = `${job.progress || 0}%`;
  if (msgEl) msgEl.textContent = job.message || '';

  updateTrainingActionButtons(job);
}

let pancreaticSimEventsBound = false;

function bindPancreaticSimulationEvents() {
  if (pancreaticSimEventsBound) return;
  pancreaticSimEventsBound = true;
  document.addEventListener('click', (e) => {
    if (selectedAppId !== 'pancreatic') return;

    const startBtn = e.target.closest('.btn-start-training');
    if (startBtn) {
      e.preventDefault();
      startPancreaticTraining(startBtn.dataset.filename, startBtn);
      return;
    }

    const stopBtn = e.target.closest('.btn-stop-training');
    if (stopBtn) {
      e.preventDefault();
      stopPancreaticTraining(stopBtn.dataset.filename, stopBtn);
      return;
    }

    const logBtn = e.target.closest('.btn-view-log');
    if (logBtn) {
      e.preventDefault();
      viewPancreaticTrainingLog(logBtn.dataset.filename, logBtn);
      return;
    }

    const editBtn = e.target.closest('.btn-edit-script');
    if (editBtn) {
      e.preventDefault();
      openPancreaticScriptEditor(editBtn.dataset.filename);
    }
  });
}

async function startPancreaticTraining(filename, btn) {
  if (!filename) return;
  btn.disabled = true;
  btn.textContent = '啟動中…';
  try {
    const res = await fetch('/api/pancreatic/simulation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (data.ok) {
      showPancreaticProgressPanel(filename);
      if (data.job_id) {
        pancreaticTrainingJobs[data.job_id] = {
          job_id: data.job_id,
          filename,
          status: 'running',
          current_run: 0,
          current_epoch: 0,
          total_runs: data.total_runs || 10,
          total_epochs: data.total_epochs || 30,
          elapsed_seconds: 0,
          progress: 0,
          message: data.message || '正在啟動訓練…',
          log_path: data.log_path || '',
        };
        updatePancreaticTrainingPanel(pancreaticTrainingJobs[data.job_id]);
      }
    } else {
      showPancreaticProgressPanel(filename);
      updatePancreaticTrainingPanel({
        filename,
        status: 'failed',
        current_run: 0,
        current_epoch: 0,
        total_runs: 10,
        total_epochs: 30,
        elapsed_seconds: 0,
        progress: 0,
        message: data.error || '無法啟動訓練',
      });
      alert(data.error || '無法啟動訓練');
      btn.disabled = false;
      btn.textContent = '開始訓練';
    }
  } catch (err) {
    console.error(err);
    alert('啟動訓練失敗，請確認伺服器正在本機運行');
    btn.disabled = false;
    btn.textContent = '開始訓練';
  }
}

async function stopPancreaticTraining(filename, btn) {
  if (!filename || !confirm('確定要停止此訓練嗎？')) return;
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '停止中…';
  const jobId = btn.dataset.jobId || Object.values(pancreaticTrainingJobs).find(j => j.filename === filename && j.status === 'running')?.job_id || '';
  try {
    const res = await fetch('/api/pancreatic/simulation/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, job_id: jobId }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* 非 JSON（如 404 HTML） */ }
    if (!res.ok || !data.ok) {
      const msg = data.error
        || (res.status === 404 ? '伺服器尚未更新，請重啟 start.bat 後再試' : `停止失敗 (HTTP ${res.status})`);
      alert(msg);
      return;
    }
    if (jobId && pancreaticTrainingJobs[jobId]) {
      pancreaticTrainingJobs[jobId].status = 'cancelled';
      pancreaticTrainingJobs[jobId].message = data.message || '訓練已由使用者停止';
      updatePancreaticTrainingPanel(pancreaticTrainingJobs[jobId]);
    }
  } catch (err) {
    console.error(err);
    alert('停止訓練失敗，請確認伺服器正在本機運行');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function viewPancreaticTrainingLog(filename, btn) {
  if (!filename) return;
  const job = Object.values(pancreaticTrainingJobs).find(j => j.filename === filename);
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '開啟中…';
  try {
    const res = await fetch('/api/pancreatic/simulation/logs/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, job_id: job?.job_id || '' }),
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error || '無法開啟日誌');
    }
  } catch (err) {
    console.error(err);
    alert('無法開啟 VS Code 日誌');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function formatHyperparamKey(key) {
  const map = {
    learning_rate: 'Learning Rate',
    initial_learn_rate: 'Initial Learn Rate',
    batch_size: 'Batch Size',
    mini_batch_size: 'Mini Batch Size',
    epochs: 'Epochs',
    weight_decay: 'Weight Decay',
    l2_regularization: 'L2 Regularization',
    learn_rate_drop_factor: 'Learn Rate Drop Factor',
    learn_rate_drop_period: 'Learn Rate Drop Period',
    dropout: 'Dropout',
    image_size: 'Image Size',
  };
  return map[key] || key;
}

function updateConfigSelect(modelCfg, research) {
  const select = document.getElementById('configSelect');
  if (research && selectedAppId === 'covid') {
    select.innerHTML = `<option value="default">${modelCfg.architecture} + ${modelCfg.optimizer}（最佳配置）</option>`;
    return;
  }

  if (selectedAppId === 'pancreatic' && modelCfg.architectures?.length && modelCfg.optimizers?.length) {
    select.innerHTML = '';
    modelCfg.architectures.forEach((arch, ai) => {
      modelCfg.optimizers.forEach((opt, oi) => {
        const isDefault = arch.name === modelCfg.architecture && opt.name === modelCfg.optimizer;
        const label = isDefault ? `${arch.name} + ${opt.name}（預設）` : `${arch.name} + ${opt.name}`;
        select.innerHTML += `<option value="combo_${ai}_${oi}">${label}</option>`;
      });
    });
    return;
  }

  select.innerHTML = `<option value="default">預設：${modelCfg.architecture} + ${modelCfg.optimizer}</option>`;
  (modelCfg.alternatives || []).forEach((alt, i) => {
    select.innerHTML += `<option value="alt_${i}">${alt.architecture} + ${alt.optimizer}</option>`;
  });
}

// ── 步驟 4：模擬 ─────────────────────────────────────────
async function startTraining() {
  if (!selectedAppId) {
    alert('請先在「應用」步驟選擇研究項目');
    return;
  }

  const btn = document.getElementById('startTrainingBtn');
  btn.disabled = true;

  const selectVal = document.getElementById('configSelect').value;
  let trainingConfig = null;

  if (selectVal === 'default') {
    const modelCfg = config.model_configs[selectedAppId];
    trainingConfig = {
      architecture: modelCfg.architecture,
      optimizer: modelCfg.optimizer,
      hyperparameters: modelCfg.hyperparameters,
    };
  } else if (selectVal.startsWith('combo_')) {
    const [, ai, oi] = selectVal.split('_');
    const modelCfg = config.model_configs[selectedAppId];
    const arch = modelCfg.architectures[Number(ai)];
    const opt = modelCfg.optimizers[Number(oi)];
    trainingConfig = {
      architecture: arch.name,
      optimizer: opt.name,
      hyperparameters: modelCfg.hyperparameters,
    };
  } else if (selectVal.startsWith('alt_')) {
    const idx = parseInt(selectVal.split('_')[1]);
    const alt = config.model_configs[selectedAppId].alternatives[idx];
    trainingConfig = {
      architecture: alt.architecture,
      optimizer: alt.optimizer,
      hyperparameters: {
        ...config.model_configs[selectedAppId].hyperparameters,
        learning_rate: alt.learning_rate,
        batch_size: alt.batch_size,
      },
    };
  }

  const res = await fetch('/api/training/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: selectedAppId, config: trainingConfig }),
  });

  const run = await res.json();
  runs[run.run_id] = run;
  renderRunCard(run);

  btn.disabled = false;
}

function renderRunCard(run) {
  if (run.status === 'cancelled') {
    removeRunCard(run.run_id);
    return;
  }
  const container = document.getElementById('runsContainer');
  if (!container || container.style.display === 'none') return;
  const placeholder = container.querySelector('.placeholder-text');
  if (placeholder) placeholder.remove();

  let card = document.getElementById(`run-${run.run_id}`);
  if (!card) {
    card = document.createElement('div');
    card.id = `run-${run.run_id}`;
    container.insertBefore(card, container.firstChild);
  }

  const statusLabels = {
    pending: '等待中',
    running: '訓練中',
    completed: '已完成',
    cancelled: '已取消',
  };

  const cfg = run.config || {};
  const hp = cfg.hyperparameters || {};

  card.className = `run-card ${run.status}`;
  card.innerHTML = `
    <div class="run-header">
      <div>
        <div class="run-id">RUN #${run.run_id}</div>
        <div class="run-config">${cfg.architecture || ''} · ${cfg.optimizer || ''} · ${hp.epochs || '?'} epochs</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="run-status ${run.status}">${statusLabels[run.status] || run.status}</span>
        ${run.status === 'running' ? `<button class="btn btn-danger" onclick="cancelRun('${run.run_id}')">取消</button>` : ''}
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar" style="width:${run.progress || 0}%"></div>
    </div>
    <div class="run-metrics">
      <span>Epoch: <strong>${run.current_epoch || 0} / ${run.total_epochs || '?'}</strong></span>
      <span>進度: <strong>${run.progress || 0}%</strong></span>
      ${run.loss !== null ? `<span>Loss: <strong>${run.loss}</strong></span>` : ''}
      ${run.val_accuracy !== null ? `<span>Val Acc: <strong>${(run.val_accuracy * 100).toFixed(1)}%</strong></span>` : ''}
    </div>
    ${run.result ? renderRunResult(run.result) : ''}
  `;
}

function renderRunResult(result) {
  const metrics = result.metrics || {};
  return `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">最終評估結果</div>
      <div class="run-metrics">
        ${Object.entries(metrics).map(([k, v]) =>
          `<span>${METRIC_LABELS[k] || k}: <strong style="color:var(--success)">${(v * 100).toFixed(1)}%</strong></span>`
        ).join('')}
      </div>
    </div>
  `;
}

async function cancelRun(runId) {
  await fetch(`/api/training/${runId}/cancel`, { method: 'POST' });
  removeRunCard(runId);
}

// ── 步驟 5：分析 ─────────────────────────────────────────
function getActiveAppId() {
  return selectedAppId
    || sessionStorage.getItem('selectedAppId')
    || document.querySelector('.app-card.selected')?.dataset.appId
    || null;
}

function renderAnalysisEmptyState() {
  document.getElementById('analysisSummary').innerHTML = `
    <div class="summary-card">
      <div class="summary-value">—</div>
      <div class="summary-label">尚未選擇應用</div>
    </div>`;
  document.getElementById('covidRunSummary').innerHTML = '';
  document.getElementById('bestMetrics').innerHTML = '';
  hidePancreaticFuturePlans();
  document.getElementById('resultsTableHead').innerHTML = '';
  document.getElementById('resultsTableBody').innerHTML =
    '<tr><td colspan="9" class="placeholder-text">請至「1. 應用」選擇新冠辨識或胰臟癌辨識後，再查看對應分析結果</td></tr>';
}

async function loadAnalysis() {
  const appId = getActiveAppId();
  if (!appId) {
    renderAnalysisEmptyState();
    return;
  }

  if (appId === 'pancreatic') {
    try {
      const res = await fetch(`/api/pancreatic/analysis${apiVersionQuery()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.source === 'trained_results') {
          if (data.future_plans === undefined) {
            data.future_plans = await fetchPancreaticFuturePlans();
          }
          renderPancreaticAnalysis(data);
          return;
        }
      }
      const fallback = await fetch(`/api/results/analysis?app_id=${appId}`);
      const data = await fallback.json();
      if (data.source === 'trained_results') {
        if (data.future_plans === undefined) {
          data.future_plans = await fetchPancreaticFuturePlans();
        }
        renderPancreaticAnalysis(data);
        return;
      }
    } catch (err) {
      console.error('載入胰臟癌分析失敗', err);
    }
    const futurePlans = await fetchPancreaticFuturePlans();
    renderPancreaticAnalysis({ source: 'trained_results', count: 0, items: [], results_path: '', future_plans: futurePlans });
    return;
  }

  const res = await fetch(`/api/results/analysis?app_id=${appId}`);
  const data = await res.json();

  if (data.source === 'manual') {
    hidePancreaticFuturePlans();
    renderManualCovidAnalysis(data.analysis);
    return;
  }

  if (data.source === 'ppt') {
    hidePancreaticFuturePlans();
    renderCovidAnalysis(data);
    return;
  }

  hidePancreaticFuturePlans();
  document.getElementById('covidRunSummary').innerHTML = '';
  document.getElementById('resultsTableHead').innerHTML = `
    <tr>
      <th>RUN ID</th><th>架構</th><th>優化器</th>
      <th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1 Score</th><th>AUC</th><th>完成時間</th>
    </tr>`;
  renderAnalysisSummary(data);
  renderBestMetrics(data.best);
  renderResultsTable(data.results, data.averages);
}

function renderManualCovidAnalysis(analysis) {
  const summaryCards = analysis.summary_cards || [];
  document.getElementById('analysisSummary').innerHTML = summaryCards.map((c, i) => `
    <div class="summary-card">
      <div class="summary-value inline-editable" data-edit="summary_cards.${i}.value">${c.value}</div>
      <div class="summary-label inline-editable" data-edit="summary_cards.${i}.label">${c.label}</div>
    </div>
  `).join('');

  const summary = analysis.run_summary || {};
  const runSummaryItems = [
    ['architecture_screening_runs', '架構×優化器篩選'],
    ['small_scale_runs', '小規模超參數調整'],
    ['large_scale_runs', '大規模模擬'],
    ['total_runs', '總計'],
  ];
  document.getElementById('covidRunSummary').innerHTML = Object.keys(summary).length ? `
    <h3 class="section-subtitle">RUN 統計</h3>
    <div class="meta-bar">
      ${runSummaryItems.filter(([k]) => summary[k] != null).map(([k, label]) => `
        <div class="meta-item">
          <span class="meta-key">${label}</span>
          <span class="meta-val"><span class="inline-editable" data-edit="run_summary.${k}">${summary[k]}</span> RUN</span>
        </div>`).join('')}
    </div>
  ` : '';

  const best = analysis.best_metric;
  document.getElementById('bestMetrics').innerHTML = best ? `
    <div class="best-card">
      <div class="metric-name"><span class="inline-editable" data-edit="best_metric.label">${best.label || '最佳指標'}</span></div>
      <div class="metric-value inline-editable" data-edit="best_metric.value">${best.value}</div>
      ${best.detail != null ? `<div class="metric-run inline-editable" data-edit="best_metric.detail">${best.detail}</div>` : ''}
    </div>
  ` : '';

  const table = analysis.table || {};
  const columns = table.columns || [];
  const rows = table.rows || [];

  document.getElementById('resultsTableHead').innerHTML = `
    <tr>${columns.map((col, ci) => `<th><span class="inline-editable" data-edit="table.columns.${ci}">${col}</span></th>`).join('')}</tr>`;

  const tbody = document.getElementById('resultsTableBody');
  const colCount = columns.length || 1;

  tbody.innerHTML = rows.map((row, ri) => {
    if (row.section) {
      return `<tr><td colspan="${colCount}" style="background:var(--bg-card);font-weight:600;padding:14px"><span class="inline-editable" data-edit="table.rows.${ri}.section">${row.section}</span></td></tr>`;
    }
    const cells = row.cells || [];
    const cellClass = row.highlight ? 'best-cell' : '';
    return `<tr${row.highlight ? ' class="avg-row"' : ''}>${cells.map((c, ci) => `<td class="${cellClass}"><span class="inline-editable" data-edit="table.rows.${ri}.cells.${ci}">${c ?? '-'}</span></td>`).join('')}</tr>`;
  }).join('');

  if (window.InlineEdit) InlineEdit.attachAnalysis(analysis);
}

function renderCovidAnalysis(data) {
  const research = data.research || {};
  const avg = data.averages || {};
  const summary = research.run_summary || {};

  document.getElementById('analysisSummary').innerHTML = `
    <div class="summary-card"><div class="summary-value">${summary.architecture_screening_runs || 80}</div><div class="summary-label">架構篩選 RUN</div></div>
    <div class="summary-card"><div class="summary-value">${summary.small_scale_runs || 280}</div><div class="summary-label">小規模 RUN</div></div>
    <div class="summary-card"><div class="summary-value">${summary.large_scale_runs || 500}</div><div class="summary-label">大規模 RUN</div></div>
    <div class="summary-card"><div class="summary-value">${((avg.accuracy_small_scale || 0) * 100).toFixed(2)}%</div><div class="summary-label">小規模最佳測試準確度</div></div>
    <div class="summary-card"><div class="summary-value">${((avg.accuracy_large_scale || 0) * 100).toFixed(2)}%</div><div class="summary-label">大規模平均測試準確度</div></div>
    <div class="summary-card"><div class="summary-value">${((avg.val_accuracy_large_scale || 0) * 100).toFixed(2)}%</div><div class="summary-label">大規模平均驗證準確度</div></div>
  `;

  document.getElementById('covidRunSummary').innerHTML = `
    <h3 class="section-subtitle">RUN 統計</h3>
    <div class="meta-bar">
      <div class="meta-item"><span class="meta-key">架構×優化器篩選</span><span class="meta-val">${summary.architecture_screening_runs} RUN</span></div>
      <div class="meta-item"><span class="meta-key">小規模超參數調整</span><span class="meta-val">${summary.small_scale_runs} RUN</span></div>
      <div class="meta-item"><span class="meta-key">大規模模擬</span><span class="meta-val">${summary.large_scale_runs} RUN</span></div>
      <div class="meta-item"><span class="meta-key">總計</span><span class="meta-val">${summary.total_runs} RUN</span></div>
    </div>
  `;

  const best = data.best?.accuracy;
  document.getElementById('bestMetrics').innerHTML = best ? `
    <div class="best-card">
      <div class="metric-name">最高測試準確度</div>
      <div class="metric-value">${(best.value * 100).toFixed(2)}%</div>
      <div class="metric-run">${best.run_id} · ${best.architecture} · ${best.optimizer}</div>
    </div>
  ` : '';

  document.getElementById('resultsTableHead').innerHTML = `
    <tr>
      <th>階段</th><th>規模</th><th>RUN 數</th><th>架構</th><th>優化器</th><th>測試準確度</th><th>驗證準確度</th>
    </tr>`;

  const tbody = document.getElementById('resultsTableBody');
  const results = data.results || [];
  tbody.innerHTML = results.map(r => {
    const m = r.metrics || {};
    return `<tr>
      <td>${r.phase || '-'}</td>
      <td>${r.scale || '-'}</td>
      <td>${r.runs || '-'}</td>
      <td>${r.architecture || '-'}</td>
      <td>${r.optimizer || '-'}</td>
      <td class="best-cell">${m.accuracy != null ? (m.accuracy * 100).toFixed(2) + '%' : '-'}</td>
      <td>${m.val_accuracy != null ? (m.val_accuracy * 100).toFixed(2) + '%' : '-'}</td>
    </tr>`;
  }).join('') + `
    <tr class="avg-row">
      <td colspan="2"><strong>小規模 / 大規模平均</strong></td>
      <td>${summary.small_scale_runs} / ${summary.large_scale_runs}</td>
      <td colspan="2">MobileNetV2 + Adam</td>
      <td>${((avg.accuracy_small_scale || 0) * 100).toFixed(2)}% / ${((avg.accuracy_large_scale || 0) * 100).toFixed(2)}%</td>
      <td>- / ${avg.val_accuracy_large_scale ? (avg.val_accuracy_large_scale * 100).toFixed(2) + '%' : '-'}</td>
    </tr>`;

  const paperRows = (research.paper_comparison || []).map(p => `
    <tr><td>${p.name}</td><td>${p.architecture || '-'}</td><td>${p.optimizer || '-'}</td>
    <td>${p.accuracy != null ? (p.accuracy * 100).toFixed(2) + '%' : (p.test_accuracy ? (p.test_accuracy * 100).toFixed(2) + '%' : '-')}</td>
    <td>${p.val_accuracy ? (p.val_accuracy * 100).toFixed(2) + '%' : '-'}</td></tr>
  `).join('');

  tbody.innerHTML += `
    <tr><td colspan="7" style="background:var(--bg-card);font-weight:600;padding:14px">對照論文比較</td></tr>
    ${paperRows}
  `;
}

function renderAnalysisSummary(data) {
  const el = document.getElementById('analysisSummary');
  el.innerHTML = `
    <div class="summary-card">
      <div class="summary-value">${data.count}</div>
      <div class="summary-label">總 RUN 數</div>
    </div>
    ${Object.entries(data.averages || {}).map(([k, v]) => `
      <div class="summary-card">
        <div class="summary-value">${(v * 100).toFixed(1)}%</div>
        <div class="summary-label">${METRIC_LABELS[k] || k} 平均</div>
      </div>
    `).join('')}
  `;
}

function renderBestMetrics(best) {
  const el = document.getElementById('bestMetrics');
  if (!best || !Object.keys(best).length) {
    el.innerHTML = '<p class="placeholder-text">完成訓練 RUN 後將顯示各指標最佳值</p>';
    return;
  }

  el.innerHTML = Object.entries(best).map(([metric, info]) => `
    <div class="best-card">
      <div class="metric-name">最高 ${METRIC_LABELS[metric] || metric}</div>
      <div class="metric-value">${(info.value * 100).toFixed(2)}%</div>
      <div class="metric-run">RUN #${info.run_id} · ${info.architecture} · ${info.optimizer}</div>
    </div>
  `).join('');
}

function renderResultsTable(results, averages) {
  const tbody = document.getElementById('resultsTableBody');

  if (!results || !results.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="placeholder-text">尚無結果資料，請先完成訓練 RUN</td></tr>';
    return;
  }

  const bestValues = {};
  config.metrics.forEach(m => {
    bestValues[m] = Math.max(...results.map(r => r.metrics?.[m] || 0));
  });

  tbody.innerHTML = results.map(r => {
    const m = r.metrics || {};
    return `
      <tr>
        <td><strong>${r.run_id}</strong></td>
        <td>${r.architecture || '-'}</td>
        <td>${r.optimizer || '-'}</td>
        ${['accuracy','precision','recall','f1_score','auc'].map(k => {
          const val = m[k];
          const isBest = val === bestValues[k];
          return `<td class="${isBest ? 'best-cell' : ''}">${val !== undefined ? (val * 100).toFixed(2) + '%' : '-'}</td>`;
        }).join('')}
        <td style="font-size:0.8rem;color:var(--text-muted)">${r.completed_at ? new Date(r.completed_at).toLocaleString('zh-TW') : '-'}</td>
      </tr>
    `;
  }).join('');

  if (averages && Object.keys(averages).length) {
    tbody.innerHTML += `
      <tr class="avg-row">
        <td colspan="3"><strong>n RUN 平均 (${results.length} runs)</strong></td>
        ${['accuracy','precision','recall','f1_score','auc'].map(k =>
          `<td>${averages[k] !== undefined ? (averages[k] * 100).toFixed(2) + '%' : '-'}</td>`
        ).join('')}
        <td>-</td>
      </tr>
    `;
  }
}

const PANCREATIC_CM_TERMS = {
  TP: { name: 'True Positive（真陽性）', desc: '實際為確診（diseased），模型亦預測為確診。' },
  TN: { name: 'True Negative（真陰性）', desc: '實際為健康（healthy），模型亦預測為健康。' },
  FP: { name: 'False Positive（偽陽性）', desc: '實際為健康，模型卻預測為確診（誤報）。' },
  FN: { name: 'False Negative（偽陰性）', desc: '實際為確診，模型卻預測為健康（漏診）。' },
};

function pancreaticCmTerm(symbol) {
  const t = PANCREATIC_CM_TERMS[symbol];
  return { symbol, name: t.name, desc: t.desc };
}

const PANCREATIC_ANALYSIS_METRICS = [
  {
    key: 'train_time',
    label: 'Train_Time',
    formula: 'Train_Time = 訓練結束時間 − 訓練開始時間（表格以分、秒顯示）',
    terms: [
      { symbol: '訓練開始時間', name: 'Run 開始時刻', desc: '該次 Run 開始執行訓練程式的時間點。' },
      { symbol: '訓練結束時間', name: 'Run 結束時刻', desc: '該次 Run 完成所有 Epoch 或停止訓練的時間點。' },
      { symbol: '分、秒', name: '時間顯示', desc: '以「X分Y秒」呈現各 Run 最後 Epoch 的訓練耗時；多 Run 時另顯示標準差。' },
    ],
    intro: '衡量一次完整訓練流程的耗時；數值越小通常代表訓練效率越高。',
  },
  {
    key: 'train_acc',
    label: 'Train_Acc',
    formula: 'Accuracy = (TP + TN) / (TP + TN + FP + FN) × 100%',
    terms: [
      pancreaticCmTerm('TP'),
      pancreaticCmTerm('TN'),
      pancreaticCmTerm('FP'),
      pancreaticCmTerm('FN'),
      { symbol: '訓練集', name: 'Training Set', desc: '用於訓練模型權重的影像樣本集合；Train_Acc 在此集合上計算。' },
    ],
    intro: '訓練集準確率，反映模型對已見資料的學習與擬合程度；公式與 Test_Acc 相同，僅資料來源為訓練集。',
  },
  {
    key: 'test_acc',
    label: 'Test_Acc',
    formula: 'Accuracy = (TP + TN) / (TP + TN + FP + FN) × 100%',
    terms: [
      pancreaticCmTerm('TP'),
      pancreaticCmTerm('TN'),
      pancreaticCmTerm('FP'),
      pancreaticCmTerm('FN'),
      { symbol: '測試集', name: 'Test Set', desc: '訓練時未參與梯度更新的獨立樣本集合；Test_Acc 在此集合上計算。' },
    ],
    intro: '測試集準確率，用於評估模型對未見資料的泛化能力；公式與 Train_Acc 相同，僅資料來源為測試集。',
  },
  {
    key: 'precision',
    label: 'Precision',
    formula: 'Precision = TP / (TP + FP)',
    terms: [pancreaticCmTerm('TP'), pancreaticCmTerm('FP')],
    intro: '精確度：在所有被模型預測為確診的樣本中，實際確診的比例；越高代表誤報越少。',
  },
  {
    key: 'recall',
    label: 'Recall',
    formula: 'Recall = TP / (TP + FN)',
    terms: [pancreaticCmTerm('TP'), pancreaticCmTerm('FN')],
    intro: '召回率：在所有實際確診樣本中，被模型正確找出的比例；越高代表漏診越少。',
  },
  {
    key: 'f1_score',
    label: 'F1-Score',
    formula: 'F1 = 2 × (Precision × Recall) / (Precision + Recall)',
    terms: [
      { symbol: 'Precision', name: '精確度', desc: 'TP / (TP + FP)；預測為確診樣本中的正確比例。' },
      { symbol: 'Recall', name: '召回率', desc: 'TP / (TP + FN)；實際確診樣本中被找出的比例。' },
      pancreaticCmTerm('TP'),
      pancreaticCmTerm('FP'),
      pancreaticCmTerm('FN'),
    ],
    intro: '精確度與召回率的調和平均；在類別不平衡時比單看 Accuracy 更具參考價值。',
  },
  {
    key: 'auc',
    label: 'AUC',
    formula: 'AUC = ∫ TPR d(FPR)（ROC 曲線下面積）',
    terms: [
      { symbol: 'TPR', name: 'True Positive Rate（真陽性率）', desc: 'TPR = TP / (TP + FN)，等同 Recall。' },
      { symbol: 'FPR', name: 'False Positive Rate（偽陽性率）', desc: 'FPR = FP / (FP + TN)；實際健康卻被預測為確診的比例。' },
      pancreaticCmTerm('TP'),
      pancreaticCmTerm('TN'),
      pancreaticCmTerm('FP'),
      pancreaticCmTerm('FN'),
    ],
    intro: '衡量模型在不同分類閾值下區分確診與健康的能力；AUC 越接近 1 代表整體判別能力越好。',
  },
  {
    key: 'ap',
    label: 'AP (mAP)',
    formula: 'AP = ∫ Precision d(Recall)（PR 曲線下面積）',
    terms: [
      { symbol: 'Precision', name: '精確度', desc: 'TP / (TP + FP)；在每個閾值下的精確度。' },
      { symbol: 'Recall', name: '召回率', desc: 'TP / (TP + FN)；在每個閾值下的召回率。' },
      pancreaticCmTerm('TP'),
      pancreaticCmTerm('FP'),
      pancreaticCmTerm('FN'),
    ],
    intro: '平均精確度（Average Precision）；對正樣本較少的任務，比 Accuracy 更能反映偵測品質。',
  },
];

let pancreaticAnalysisExpandedId = null;
let pancreaticRunViewer = { itemId: null, runNum: 1, runCount: 1, mode: 'single' };
let pancreaticAnalysisCache = null;
let pancreaticAnalysisSort = { key: 'item', dir: 'desc' };

function parsePancreaticMetricValue(metric) {
  if (!metric?.mean) return null;
  const normalized = String(metric.mean).replace(/%/g, '').trim();
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function computePancreaticMetricMaxima(items) {
  const maxima = {};
  PANCREATIC_ANALYSIS_METRICS.forEach(({ key }) => {
    if (key === 'train_time') return;
    let max = null;
    items.forEach(item => {
      const v = parsePancreaticMetricValue(item.metrics?.[key]);
      if (v == null) return;
      if (max == null || v > max) max = v;
    });
    maxima[key] = max;
  });
  return maxima;
}

function isPancreaticMetricBest(metricKey, metric, maxima) {
  if (metricKey === 'train_time') return false;
  const max = maxima[metricKey];
  if (max == null) return false;
  const v = parsePancreaticMetricValue(metric);
  if (v == null) return false;
  return Math.abs(v - max) < 1e-9;
}

function pancreaticItemSortKey(item) {
  let ts = item.started_ts ?? item.modified_ts;
  if (ts == null && item.modified) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(item.modified);
    if (m) ts = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`).getTime() / 1000;
  }
  return [item.date || '', ts ?? 0, item.id || ''];
}

function sortPancreaticItemsChronologically(items) {
  return [...items].sort((a, b) => {
    const ka = pancreaticItemSortKey(a);
    const kb = pancreaticItemSortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] === kb[i]) continue;
      return ka[i] < kb[i] ? -1 : 1;
    }
    return 0;
  });
}

function applyPancreaticChronologicalOrder(rawItems) {
  const items = Array.isArray(rawItems) ? [...rawItems] : [];
  if (!items.length) return items;
  if (items.every(it => Number.isInteger(it.chronological_index) && it.chronological_index > 0)) {
    items.sort((a, b) => a.chronological_index - b.chronological_index);
    return items;
  }
  return sortPancreaticItemsChronologically(items);
}

function getSortedPancreaticItems(items) {
  if (!pancreaticAnalysisSort.key || !pancreaticAnalysisSort.dir) return items;
  const dir = pancreaticAnalysisSort.dir === 'asc' ? 1 : -1;
  const sortKey = pancreaticAnalysisSort.key;
  return [...items].sort((a, b) => {
    let va;
    let vb;
    if (sortKey === 'item') {
      va = a.displayIndex ?? 0;
      vb = b.displayIndex ?? 0;
    } else {
      va = parsePancreaticMetricValue(a.metrics?.[sortKey]);
      vb = parsePancreaticMetricValue(b.metrics?.[sortKey]);
    }
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * dir;
  });
}

function renderPancreaticSortButtons(sortKey) {
  const active = pancreaticAnalysisSort.key === sortKey;
  return `
    <div class="pa-sort-btns">
      <button type="button" class="pa-sort-btn${active && pancreaticAnalysisSort.dir === 'asc' ? ' active' : ''}" data-sort-key="${sortKey}" data-sort-dir="asc" title="最小">最小</button>
      <button type="button" class="pa-sort-btn${active && pancreaticAnalysisSort.dir === 'desc' ? ' active' : ''}" data-sort-key="${sortKey}" data-sort-dir="desc" title="最大">最大</button>
    </div>`;
}

function showPancreaticMetricDetail(metricKey) {
  const metric = PANCREATIC_ANALYSIS_METRICS.find(m => m.key === metricKey);
  if (!metric) return;

  const termRows = (metric.terms || []).map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${t.symbol}</strong></td>
      <td>${t.name}</td>
      <td>${t.desc}</td>
    </tr>`).join('');

  openModelDetailModal(`${metric.label} · 評估指標說明`, `
    <div class="metric-detail-formula">${metric.formula}</div>
    <div class="ref-table-wrap model-detail-table-wrap">
      <table class="ref-table compact">
        <thead>
          <tr>
            <th>編號</th>
            <th>符號</th>
            <th>代表意義</th>
            <th>說明</th>
          </tr>
        </thead>
        <tbody>${termRows}</tbody>
      </table>
    </div>
    <div class="metric-detail-intro">
      <h3>指標說明</h3>
      <p>${metric.intro}</p>
    </div>
  `);
}

function renderPancreaticAnalysisTableHead() {
  document.getElementById('resultsTableHead').innerHTML = `
    <tr>
      <th class="pa-sortable-header col-item">
        <div class="pa-th-main">
          <span class="pa-th-label">項目</span>
          ${renderPancreaticSortButtons('item')}
        </div>
      </th>
      <th>架構&amp;優化器</th>
      <th>調整項目(與預設相比)</th>
      ${PANCREATIC_ANALYSIS_METRICS.map(m => `
          <th class="pa-metric-header" data-metric-key="${m.key}">
            <div class="pa-th-main">
              <button type="button" class="pa-metric-label" data-metric-key="${m.key}">${m.label}</button>
              ${renderPancreaticSortButtons(m.key)}
            </div>
          </th>`).join('')}
    </tr>`;
}

function renderPancreaticAnalysisTableBody(items) {
  const tbody = document.getElementById('resultsTableBody');
  const colCount = 3 + PANCREATIC_ANALYSIS_METRICS.length;

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="placeholder-text">尚無訓練成果，請確認成果統整資料夾路徑</td></tr>`;
    return;
  }

  const maxima = computePancreaticMetricMaxima(items);

  tbody.innerHTML = items.flatMap(item => {
    const adjItems = renderPancreaticAdjustmentList(item.arch_optimizer, item.adjustments);
    const metrics = item.metrics || {};
    const runCount = item.run_count || 0;
    const isExpanded = pancreaticAnalysisExpandedId === item.id;
    const runButtons = Array.from({ length: runCount }, (_, i) => {
      const runNum = i + 1;
      return `<button type="button" class="btn btn-ghost btn-sm pancreatic-run-btn" data-item-id="${escapeAttr(item.id)}" data-run="${runNum}">${runNum}Run</button>`;
    }).join('');
    const allRunsBtn = runCount > 1
      ? `<button type="button" class="btn btn-ghost btn-sm pancreatic-all-runs-btn" data-item-id="${escapeAttr(item.id)}" data-run-count="${runCount}">All Run Curves</button>`
      : '';
    const logBtn = `<button type="button" class="btn btn-ghost btn-sm pancreatic-log-btn" data-item-id="${escapeAttr(item.id)}">日誌</button>`;
    const probeBtn = `<button type="button" class="btn btn-ghost btn-sm pancreatic-probe-btn" data-item-id="${escapeAttr(item.id)}">性能測試</button>`;

    const archMbs = splitPancreaticArchMbs(item.arch_optimizer);
    return [
      `<tr class="pancreatic-result-row${isExpanded ? ' expanded' : ''}" data-item-id="${escapeAttr(item.id)}" data-run-count="${runCount}">
        <td class="col-item-num"><strong>${item.displayIndex ?? '-'}</strong></td>
        <td class="col-arch">${escapeHtml(archMbs.arch)}</td>
        <td class="col-adjust"><ol class="adjust-list">${adjItems}</ol></td>
        ${PANCREATIC_ANALYSIS_METRICS.map(m => {
          const isBest = isPancreaticMetricBest(m.key, metrics[m.key], maxima);
          return `<td class="metric-cell${isBest ? ' metric-best' : ''}">${formatPancreaticMetricCell(metrics[m.key], runCount, m.key)}</td>`;
        }).join('')}
      </tr>`,
      `<tr class="pancreatic-run-picker-row" data-item-id="${escapeAttr(item.id)}" ${isExpanded ? '' : 'hidden'}>
        <td colspan="${colCount}">
          <div class="pancreatic-run-picker">
            <span class="run-picker-label">選擇 Run（共 ${runCount} 次）：</span>
            <div class="pancreatic-run-btns">${runButtons}${allRunsBtn}${logBtn}${probeBtn}${!runButtons ? '<span class="placeholder-text">無 Run 資料</span>' : ''}</div>
          </div>
        </td>
      </tr>`,
    ];
  }).join('');
}

function formatPancreaticDurationSeconds(valueStr) {
  const total = parseFloat(String(valueStr ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(total) || total < 0) return String(valueStr ?? '-');
  let minutes = Math.floor(total / 60);
  let seconds = Math.round(total - minutes * 60);
  if (seconds >= 60) {
    minutes += Math.floor(seconds / 60);
    seconds %= 60;
  }
  if (minutes <= 0) return `${seconds}秒`;
  return `${minutes}分${seconds}秒`;
}

function formatPancreaticMetricCell(metric, runCount, metricKey) {
  if (!metric?.mean) return '-';
  const isTrainTime = metricKey === 'train_time';
  const meanDisplay = isTrainTime ? formatPancreaticDurationSeconds(metric.mean) : metric.mean;
  const showStd = runCount > 1 && metric.std && metric.std !== '0.000000' && metric.std !== '0.000000%';
  if (showStd) {
    const stdDisplay = isTrainTime ? formatPancreaticDurationSeconds(metric.std) : metric.std;
    return `<div class="metric-mean">${meanDisplay}</div><div class="metric-std">± ${stdDisplay}</div>`;
  }
  return `<div class="metric-mean">${meanDisplay}</div>`;
}

function hidePancreaticFuturePlans() {
  const section = document.getElementById('pancreaticFuturePlansSection');
  if (section) section.style.display = 'none';
  hidePancreaticPkPaper();
  hidePancreaticAiSuggestion();
}

function hidePancreaticPkPaper() {
  const section = document.getElementById('pancreaticPkPaperSection');
  if (section) section.style.display = 'none';
}

function hidePancreaticAiSuggestion() {
  const section = document.getElementById('pancreaticAiSection');
  if (section) section.style.display = 'none';
}

function ensurePancreaticPkPaperSection() {
  let section = document.getElementById('pancreaticPkPaperSection');
  if (section) {
    if (!document.getElementById('pancreaticPkPaperContent')) {
      const content = document.createElement('div');
      content.id = 'pancreaticPkPaperContent';
      section.appendChild(content);
    }
    return section;
  }

  const panel = document.getElementById('step-analysis');
  if (!panel) return null;

  section = document.createElement('div');
  section.id = 'pancreaticPkPaperSection';
  section.className = 'pancreatic-pk-paper-section';
  section.style.display = 'none';
  section.innerHTML = `
    <h3 class="section-subtitle">PK Paper</h3>
    <div id="pancreaticPkPaperContent"></div>`;

  const futureSection = document.getElementById('pancreaticFuturePlansSection');
  const aiSection = document.getElementById('pancreaticAiSection');
  const insertBefore = aiSection || futureSection;
  if (insertBefore) {
    panel.insertBefore(section, insertBefore);
  } else {
    panel.appendChild(section);
  }
  return section;
}

function ensurePancreaticAiSection() {
  let section = document.getElementById('pancreaticAiSection');
  if (section) return section;

  const panel = document.getElementById('step-analysis');
  const futureSection = document.getElementById('pancreaticFuturePlansSection');
  if (!panel) return null;

  section = document.createElement('div');
  section.id = 'pancreaticAiSection';
  section.className = 'pancreatic-ai-section';
  section.innerHTML = `
    <h3 class="section-subtitle">AI 建議</h3>
    <p class="pancreatic-ai-intro">閱讀所有實驗的調整項目與評估指標後，由生成式 AI 提出下一輪調參建議。</p>
    <div class="pancreatic-ai-toolbar">
      <label class="pancreatic-ai-field">
        <span>AI 供應商</span>
        <select id="pancreaticAiProvider"></select>
      </label>
      <label class="pancreatic-ai-field">
        <span>模型</span>
        <select id="pancreaticAiModel"></select>
      </label>
      <label class="pancreatic-ai-field pancreatic-ai-field-wide" id="pancreaticAiModelCustomField" hidden>
        <span>自訂模型名稱</span>
        <input id="pancreaticAiModelCustom" type="text" placeholder="輸入模型 ID">
      </label>
      <label class="pancreatic-ai-field pancreatic-ai-field-wide" id="pancreaticAiBaseUrlField">
        <span>API Base URL</span>
        <input id="pancreaticAiBaseUrl" type="text" placeholder="OpenAI 相容 API 網址">
      </label>
      <label class="pancreatic-ai-field pancreatic-ai-field-wide" id="pancreaticAiApiKeyField">
        <span>API Key</span>
        <input id="pancreaticAiApiKey" type="password" placeholder="留空則保留既有 Key">
      </label>
      <label class="pancreatic-ai-checkbox">
        <input id="pancreaticAiAutoGenerate" type="checkbox">
        <span>有新成果時提示更新建議</span>
      </label>
      <div class="pancreatic-ai-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="pancreaticAiSaveConfigBtn">儲存設定</button>
        <button type="button" class="btn btn-primary btn-sm" id="pancreaticAiGenerateBtn">產生建議</button>
      </div>
    </div>
    <div id="pancreaticAiProviderHint" class="pancreatic-ai-provider-hint"></div>
    <div id="pancreaticAiStatus" class="pancreatic-ai-status"></div>
    <div id="pancreaticAiContent" class="pancreatic-ai-content"></div>`;

  if (futureSection) {
    panel.insertBefore(section, futureSection);
  } else {
    panel.appendChild(section);
  }

  bindPancreaticAiEvents();
  return section;
}

let pancreaticAiProviders = [];
let pancreaticAiState = null;
let pancreaticAiEventsBound = false;

function bindPancreaticAiEvents() {
  if (pancreaticAiEventsBound) return;
  pancreaticAiEventsBound = true;

  document.getElementById('pancreaticAiProvider')?.addEventListener('change', () => {
    updatePancreaticAiProviderFields({ resetModel: true });
  });
  document.getElementById('pancreaticAiModel')?.addEventListener('change', updatePancreaticAiModelCustomField);
  document.getElementById('pancreaticAiBaseUrl')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });
  document.getElementById('pancreaticAiSaveConfigBtn')?.addEventListener('click', savePancreaticAiConfig);
  document.getElementById('pancreaticAiGenerateBtn')?.addEventListener('click', generatePancreaticAiSuggestion);
}

function getSelectedPancreaticAiProviderMeta() {
  const providerId = document.getElementById('pancreaticAiProvider')?.value;
  return pancreaticAiProviders.find(p => p.id === providerId) || pancreaticAiProviders[0] || null;
}

function getPancreaticAiProviderModels(meta) {
  if (!meta) return [];
  if (meta.models?.length) return meta.models;
  if (meta.default_model) return [{ id: meta.default_model, label: meta.default_model }];
  return PANCREATIC_AI_FALLBACK_MODELS[meta.id] || [];
}

function getPancreaticAiModelValue() {
  const select = document.getElementById('pancreaticAiModel');
  if (!select) return '';
  if (select.value === PANCREATIC_AI_CUSTOM_MODEL) {
    return document.getElementById('pancreaticAiModelCustom')?.value?.trim() || '';
  }
  return select.value || '';
}

function setPancreaticAiModelValue(modelName) {
  const select = document.getElementById('pancreaticAiModel');
  const customField = document.getElementById('pancreaticAiModelCustomField');
  const customInput = document.getElementById('pancreaticAiModelCustom');
  if (!select) return;

  const model = (modelName || '').trim();
  const options = Array.from(select.options).map(opt => opt.value).filter(v => v !== PANCREATIC_AI_CUSTOM_MODEL);
  if (model && options.includes(model)) {
    select.value = model;
    if (customInput) customInput.value = '';
    if (customField) {
      customField.hidden = true;
      customField.style.display = 'none';
    }
    return;
  }

  select.value = PANCREATIC_AI_CUSTOM_MODEL;
  if (customInput) customInput.value = model;
  if (customField) {
    customField.hidden = !model;
    customField.style.display = model ? '' : 'none';
  }
}

function updatePancreaticAiModelCustomField() {
  const select = document.getElementById('pancreaticAiModel');
  const customField = document.getElementById('pancreaticAiModelCustomField');
  if (!select || !customField) return;
  const showCustom = select.value === PANCREATIC_AI_CUSTOM_MODEL;
  customField.hidden = !showCustom;
  customField.style.display = showCustom ? '' : 'none';
}

function fillPancreaticAiModelOptions(meta, selectedModel, { resetModel = false } = {}) {
  const select = document.getElementById('pancreaticAiModel');
  if (!select || !meta) return;

  const models = getPancreaticAiProviderModels(meta);
  const allowCustom = meta.id !== 'gemini';
  select.innerHTML = [
    ...models.map(m => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.label || m.id)}</option>`),
    ...(allowCustom ? [`<option value="${PANCREATIC_AI_CUSTOM_MODEL}">自訂…</option>`] : []),
  ].join('');

  const nextModel = resetModel
    ? (meta.default_model || models[0]?.id || '')
    : (selectedModel || meta.default_model || models[0]?.id || '');
  setPancreaticAiModelValue(nextModel);
  updatePancreaticAiModelCustomField();
}

function updatePancreaticAiProviderFields({ resetModel = false, selectedModel = null } = {}) {
  const meta = getSelectedPancreaticAiProviderMeta();
  const baseUrlInput = document.getElementById('pancreaticAiBaseUrl');
  const baseUrlField = document.getElementById('pancreaticAiBaseUrlField');
  const apiKeyField = document.getElementById('pancreaticAiApiKeyField');
  const hintEl = document.getElementById('pancreaticAiProviderHint');
  if (!meta) return;

  fillPancreaticAiModelOptions(meta, selectedModel, { resetModel });
  if (baseUrlInput && !baseUrlInput.dataset.userEdited) {
    baseUrlInput.value = meta.default_base_url || '';
  }
  if (baseUrlField) {
    baseUrlField.style.display = meta.id === 'openai' || meta.id === 'gemini' || meta.id === 'anthropic' ? 'none' : '';
  }
  if (apiKeyField) {
    apiKeyField.style.display = meta.needs_api_key ? '' : 'none';
  }
  if (hintEl) {
    hintEl.textContent = meta.description || '';
  }
}

function fillPancreaticAiProviderOptions(providers, selectedId, selectedModel) {
  pancreaticAiProviders = (providers && providers.length) ? providers : PANCREATIC_AI_FALLBACK_PROVIDERS;
  const select = document.getElementById('pancreaticAiProvider');
  if (!select) return;
  select.innerHTML = pancreaticAiProviders.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.label)}</option>`).join('');
  if (selectedId) select.value = selectedId;
  updatePancreaticAiProviderFields({ resetModel: false, selectedModel });
}

function renderPancreaticAiSuggestionContent(aiData) {
  pancreaticAiState = aiData || pancreaticAiState;
  const section = ensurePancreaticAiSection();
  if (!section || !aiData) return;

  section.style.display = 'block';
  fillPancreaticAiProviderOptions(aiData.providers || pancreaticAiProviders, aiData.provider, aiData.model);

  const baseUrlInput = document.getElementById('pancreaticAiBaseUrl');
  const autoGenerateInput = document.getElementById('pancreaticAiAutoGenerate');
  const statusEl = document.getElementById('pancreaticAiStatus');
  const contentEl = document.getElementById('pancreaticAiContent');
  const saveBtn = document.getElementById('pancreaticAiSaveConfigBtn');

  if (baseUrlInput) {
    baseUrlInput.value = aiData.base_url || '';
    delete baseUrlInput.dataset.userEdited;
  }
  if (autoGenerateInput) autoGenerateInput.checked = !!aiData.auto_generate;
  updatePancreaticAiProviderFields();

  if (saveBtn) {
    saveBtn.style.display = authState.is_admin ? '' : 'none';
  }
  document.getElementById('pancreaticAiApiKeyField')?.classList.toggle('is-admin-only-hidden', !authState.is_admin);

  if (statusEl) {
    const parts = [];
    if (aiData.load_error) {
      parts.push(`<span class="pancreatic-ai-badge is-error">${escapeHtml(aiData.load_error)}</span>`);
    }
    if (aiData.has_new_results) {
      parts.push('<span class="pancreatic-ai-badge">偵測到新訓練成果，建議重新產生 AI 建議</span>');
    }
    if (aiData.generated_at) {
      parts.push(`<span>上次產生：${escapeHtml(aiData.generated_at)}</span>`);
    }
    if (aiData.api_key_set) {
      parts.push(`<span>API Key：${escapeHtml(aiData.api_key_masked || '已設定')}</span>`);
    }
    statusEl.innerHTML = parts.join('');
  }

  if (contentEl) {
    const text = (aiData.content || '').trim();
    if (text) {
      contentEl.textContent = text;
      contentEl.classList.remove('is-empty');
    } else {
      contentEl.textContent = '尚無 AI 建議。請選擇供應商、設定 API Key（若需要），再按「產生建議」。';
      contentEl.classList.add('is-empty');
    }
  }
}

async function renderPancreaticAiSuggestion(analysisData) {
  if (getActiveAppId() !== 'pancreatic') {
    hidePancreaticAiSuggestion();
    return;
  }

  let aiData = analysisData?.ai_suggestion;
  let loadError = '';
  if (!aiData) {
    try {
      const res = await fetch(`/api/pancreatic/analysis/ai${apiVersionQuery()}`, { credentials: 'same-origin' });
      if (res.ok) {
        aiData = await res.json();
      } else {
        const errBody = await res.json().catch(() => ({}));
        loadError = errBody.error || `無法載入 AI 設定（HTTP ${res.status}）`;
      }
    } catch (err) {
      loadError = '無法連線至 AI 設定 API';
      console.warn('載入 AI 建議設定失敗', err);
    }
  }

  if (aiData) {
    renderPancreaticAiSuggestionContent(aiData);
    return;
  }

  renderPancreaticAiSuggestionContent({
    ...PANCREATIC_AI_OLLAMA_DEFAULTS,
    has_new_results: false,
    load_error: loadError || '伺服器可能尚未重啟，已套用 Ollama 預設值',
  });
}

async function savePancreaticAiConfig() {
  if (!authState.is_admin) {
    alert('需要管理員權限才能儲存 AI 設定');
    return;
  }

  const provider = document.getElementById('pancreaticAiProvider')?.value;
  const model = getPancreaticAiModelValue();
  const baseUrl = document.getElementById('pancreaticAiBaseUrl')?.value;
  const apiKey = document.getElementById('pancreaticAiApiKey')?.value;
  const autoGenerate = document.getElementById('pancreaticAiAutoGenerate')?.checked;
  const statusEl = document.getElementById('pancreaticAiStatus');

  try {
    const res = await fetch(`/api/pancreatic/analysis/ai/config${apiVersionQuery()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, base_url: baseUrl, api_key: apiKey, auto_generate: autoGenerate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '儲存失敗');
    document.getElementById('pancreaticAiApiKey').value = '';
    renderPancreaticAiSuggestionContent({
      ...data,
      current_fingerprint: pancreaticAiState?.current_fingerprint,
      has_new_results: pancreaticAiState?.has_new_results,
      item_count: pancreaticAiState?.item_count,
      providers: data.providers || pancreaticAiProviders,
    });
    if (statusEl) statusEl.innerHTML = '<span class="pancreatic-ai-badge is-ok">設定已儲存</span>';
  } catch (err) {
    alert(err.message || '儲存 AI 設定失敗');
  }
}

async function generatePancreaticAiSuggestion() {
  const btn = document.getElementById('pancreaticAiGenerateBtn');
  const contentEl = document.getElementById('pancreaticAiContent');
  const statusEl = document.getElementById('pancreaticAiStatus');
  if (!btn || !contentEl) return;

  btn.disabled = true;
  btn.textContent = '產生中…';
  if (statusEl) statusEl.innerHTML = '<span>AI 正在分析所有實驗成果，請稍候…</span>';
  contentEl.textContent = '正在產生建議…';
  contentEl.classList.add('is-empty');

  try {
    const provider = document.getElementById('pancreaticAiProvider')?.value;
    const model = getPancreaticAiModelValue();
    const baseUrl = document.getElementById('pancreaticAiBaseUrl')?.value;
    const res = await fetch(`/api/pancreatic/analysis/ai/generate${apiVersionQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, base_url: baseUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '產生失敗');
    renderPancreaticAiSuggestionContent({
      ...data,
      providers: data.providers || pancreaticAiProviders,
    });
  } catch (err) {
    contentEl.textContent = err.message || '產生 AI 建議失敗';
    contentEl.classList.add('is-empty');
    if (statusEl) statusEl.innerHTML = `<span class="pancreatic-ai-badge is-error">${escapeHtml(err.message || '產生失敗')}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '產生建議';
  }
}

function ensurePancreaticFuturePlansSection() {
  let section = document.getElementById('pancreaticFuturePlansSection');
  if (section) return section;

  const panel = document.getElementById('step-analysis');
  if (!panel) return null;

  section = document.createElement('div');
  section.id = 'pancreaticFuturePlansSection';
  section.className = 'pancreatic-future-plans-section';
  section.innerHTML = `
    <h3 class="section-subtitle">未來規劃</h3>
    <div class="pancreatic-future-plans-box">
      <div id="pancreaticFuturePlansContent" class="pancreatic-future-plans-content"></div>
    </div>`;
  panel.appendChild(section);
  return section;
}

async function fetchPancreaticFuturePlans() {
  try {
    const res = await fetch('/api/pancreatic/analysis/content');
    if (res.ok) {
      const data = await res.json();
      return data.future_plans || '';
    }
  } catch (err) {
    console.warn('載入未來規劃失敗', err);
  }
  return '';
}

function renderPancreaticFuturePlans(futurePlans) {
  const section = ensurePancreaticFuturePlansSection();
  const contentEl = document.getElementById('pancreaticFuturePlansContent');
  if (!section || !contentEl) return;

  section.style.display = 'block';
  section.removeAttribute('hidden');
  const text = (futurePlans || '').trim();
  contentEl.dataset.edit = 'future_plans';
  contentEl.dataset.editScope = 'pancreatic';
  contentEl.className = 'pancreatic-future-plans-content';

  if (text) {
    contentEl.textContent = futurePlans;
  } else if (window.InlineEdit?.authenticated) {
    contentEl.textContent = '';
    contentEl.classList.add('is-empty');
    contentEl.dataset.placeholder = '點此輸入未來規劃…';
  } else {
    contentEl.textContent = '（尚無內容）';
    contentEl.classList.add('is-readonly-empty');
  }

  if (window.InlineEdit?.authenticated) {
    contentEl.classList.add('inline-editable-block');
  }

  if (window.InlineEdit) {
    InlineEdit.attachPancreaticAnalysis({ future_plans: futurePlans || '' });
  }
}

const PANCREATIC_PK_PAPER_TABLES = [
  {
    headers: ['項目', '詳細資訊 / 數值'],
    rows: [
      {
        item: '1. 網路架構與優化器',
        detail: [
          { text: '網路架構：AlexNet特徵提取器+GLSZM 紋理特徵+LSTM 分類器' },
          { text: '優化器：未具體指明，僅提及使用「梯度下降與反向傳播技術」。' },
        ],
      },
      {
        item: '2. 網路架構的參數量',
        detail: [
          { text: 'AlexNet特徵提取器(約61M )+GLSZM 紋理特徵(0)+LSTM 分類器(約2~9M)=約63M ~ 70M' },
          { text: '若使用 SqueezeNet1.1 取代此論文中的混合架構(AlexNet + GLSZM + LSTM)，總參數量將會大幅減少約 98.1% 到 98.2%。' },
        ],
      },
      {
        item: '3. 資料集',
        detail: [
          { text: 'NIH-Pancreas-CT 與 MSD (Medical Segmentation Decathlon) 資料集：' },
          { bullets: [
            'NIH 資料集包含 82 位病患的腹部對比增強 3D CT 影像（經逐層切片取得 2D 影像進行分析）。',
            'MSD 資料集提供胰臟腫瘤分割與辨識影像。',
          ] },
        ],
      },
      {
        item: '4. 評估指標',
        detail: [
          { text: '準確率 (Accuracy)：98.53%' },
          { text: '精確度 (Precision)：98.61%' },
          { text: '靈敏度 (Sensitivity/Recall)：98.53%' },
          { text: '特異度 (Specificity)：99.51%' },
          { text: 'F-Score：98.53%' },
          { text: '資料來源屬性：', bold: true },
          { bullets: [
            '是不是測試集？ 未知。論文沒有提供資料集的切割比例（如 Train/Test Split），無法確認這些指標是否為嚴格獨立的測試集數據。',
            '是不是平均值？ 未知。論文未提及是否進行 K-fold 交叉驗證或多次執行取平均，報表上的數據僅呈現單一數值。',
          ] },
        ],
      },
      {
        item: '5. 期刊 & 最新排名',
        detail: [
          { text: '期刊名稱：《International Journal of Intelligent Engineering and Systems》' },
          { text: '最新排名：', bold: true },
          { bullets: [
            'SCImago 分區：Q3',
            'SJR 指數：0.292',
            '影響分數 (Impact Score)：2.19',
          ] },
        ],
      },
    ],
  },
];

function renderPkPaperBlocks(blocks) {
  return (blocks || []).map((block) => {
    if (block.bullets) {
      return `<ul class="pk-paper-list">${block.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    const cls = block.bold ? 'pk-paper-label' : 'pk-paper-text';
    return `<p class="${cls}">${escapeHtml(block.text || '')}</p>`;
  }).join('');
}

function renderPkPaperTable(spec) {
  const head = spec.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = spec.rows.map((row) => {
    const cells = [
      `<td class="pk-item">${escapeHtml(row.item)}</td>`,
      `<td class="pk-detail">${renderPkPaperBlocks(row.detail)}</td>`,
    ];
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  const caption = spec.caption
    ? `<h4 class="pancreatic-pk-paper-caption">${escapeHtml(spec.caption)}</h4>`
    : '';
  return `
    <div class="pancreatic-pk-paper-block">
      ${caption}
      <div class="results-table-wrap pancreatic-pk-wrap">
        <table class="results-table pancreatic-pk-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function renderPancreaticPkPaper() {
  const section = ensurePancreaticPkPaperSection();
  const content = document.getElementById('pancreaticPkPaperContent');
  if (!section || !content) return;
  section.style.display = 'block';
  content.innerHTML = PANCREATIC_PK_PAPER_TABLES.map(renderPkPaperTable).join('');
}

function renderPancreaticAnalysis(data) {
  const items = applyPancreaticChronologicalOrder(data.items || []);
  document.getElementById('covidRunSummary').innerHTML = data.results_path ? `
    <div class="meta-bar">
      <div class="meta-item">
        <span class="meta-key">成果來源</span>
        <span class="meta-val pancreatic-results-path">${data.results_path}</span>
      </div>
      <div class="meta-item">
        <span class="meta-key">實驗組數</span>
        <span class="meta-val">${data.count || items.length} 組</span>
      </div>
    </div>
  ` : '';

  document.getElementById('analysisSummary').innerHTML = `
    <div class="summary-card">
      <div class="summary-value">${data.count || items.length}</div>
      <div class="summary-label">已訓練實驗組</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${items.reduce((sum, item) => sum + (item.run_count || 0), 0)}</div>
      <div class="summary-label">總 RUN 數</div>
    </div>
  `;

  document.getElementById('bestMetrics').innerHTML = `
    <p class="placeholder-text">評估指標採用各 Run 最後一個 Epoch 的成績，再對所有 Run 計算 Mean ± Std。點擊表格列可展開 Run 選單；點評估指標名稱可查看公式與符號說明；可按「最大／最小」排序。</p>
  `;

  items.forEach((item, index) => {
    item.displayIndex = index + 1;
  });
  pancreaticAnalysisCache = {
    items,
    future_plans: data.future_plans,
    results_path: data.results_path,
    count: data.count,
  };

  renderPancreaticAnalysisTableHead();
  renderPancreaticAnalysisTableBody(getSortedPancreaticItems(items));
  renderPancreaticPkPaper();
  renderPancreaticAiSuggestion(data);
  renderPancreaticFuturePlans(data.future_plans !== undefined ? data.future_plans : '');
}

function refreshPancreaticAnalysisTableBody() {
  if (!pancreaticAnalysisCache?.items?.length) return;
  renderPancreaticAnalysisTableBody(getSortedPancreaticItems(pancreaticAnalysisCache.items));
}

function togglePancreaticAnalysisRow(itemId) {
  pancreaticAnalysisExpandedId = pancreaticAnalysisExpandedId === itemId ? null : itemId;
  refreshPancreaticAnalysisTableBody();
}

function getPancreaticItemRunCount(itemId) {
  for (const r of document.querySelectorAll('.pancreatic-result-row')) {
    if (r.dataset.itemId === itemId) return Number(r.dataset.runCount) || 1;
  }
  return 1;
}

function equalizePancreaticRunVisuals(root) {
  const medias = root?.querySelectorAll('.run-visual-media');
  if (!medias?.length) return;

  const imgs = [...medias].map((m) => m.querySelector('img')).filter(Boolean);
  if (!imgs.length) return;

  const pending = imgs.some((img) => !img.complete || !img.naturalWidth);
  if (pending) {
    imgs.forEach((img) => {
      if (!img.complete || !img.naturalWidth) {
        img.addEventListener('load', () => equalizePancreaticRunVisuals(root), { once: true });
      }
    });
    return;
  }

  const boxH = medias[0].clientHeight;
  if (!boxH) return;

  let targetH = boxH;
  medias.forEach((media, index) => {
    const img = imgs[index];
    if (!img?.naturalWidth) return;
    const maxHFromWidth = media.clientWidth * (img.naturalHeight / img.naturalWidth);
    targetH = Math.min(targetH, maxHFromWidth);
  });

  imgs.forEach((img) => {
    img.style.height = `${Math.floor(targetH)}px`;
    img.style.width = 'auto';
    img.style.maxWidth = '100%';
    img.style.maxHeight = `${Math.floor(targetH)}px`;
  });
}

function renderPancreaticRunCurvesLegend(runCount) {
  return `
    <span class="pancreatic-curves-legend-item">
      <span class="pancreatic-curves-legend-swatch" style="background:#1f77b4"></span>
      Training Loss / Train Acc
    </span>
    <span class="pancreatic-curves-legend-item">
      <span class="pancreatic-curves-legend-swatch" style="background:#ff7f0e"></span>
      Test Loss / Test Acc
    </span>
    <span class="pancreatic-curves-legend-note">共 ${runCount} 次 Run 疊加（維持原色）</span>`;
}

function pancreaticShowcaseImageUrl(itemId, opts) {
  if (typeof window.showcasePancreaticImageUrl === 'function') {
    const resolved = window.showcasePancreaticImageUrl(itemId, opts);
    if (resolved) return resolved;
  }
  const params = new URLSearchParams({ item: itemId, kind: opts.kind || 'curves' });
  if (opts.allRuns) params.set('all_runs', '1');
  if (opts.run) params.set('run', String(opts.run));
  return `/api/pancreatic/analysis/image?${params.toString()}`;
}

function renderPancreaticAllRunCurvesBody(itemId, runCount) {
  const curvesUrl = pancreaticShowcaseImageUrl(itemId, { kind: 'curves', allRuns: true });

  return `
    <div class="pancreatic-all-runs-header">
      <span class="pancreatic-run-nav-label">全部 ${runCount} 次 Run 曲線疊圖</span>
    </div>
    <div class="pancreatic-curves-legend">${renderPancreaticRunCurvesLegend(runCount)}</div>
    <figure class="run-visual-block pancreatic-all-runs-curves">
      <figcaption>曲線圖 (All Run Curves)</figcaption>
      <div class="run-visual-media pancreatic-all-runs-media">
        <div class="pancreatic-all-runs-loading">正在合成曲線疊圖…</div>
        <img src="${curvesUrl}" alt="All Run Curves 疊圖" loading="lazy">
      </div>
    </figure>`;
}

function renderPancreaticRunDetailBody(itemId, runNum, runCount) {
  const cmUrl = pancreaticShowcaseImageUrl(itemId, { run: runNum, kind: 'cm' });
  const curvesUrl = pancreaticShowcaseImageUrl(itemId, { run: runNum, kind: 'curves' });
  const canPrev = runNum > 1;
  const canNext = runNum < runCount;

  return `
    <div class="pancreatic-run-nav">
      <button type="button" class="pancreatic-run-nav-btn pancreatic-run-nav-prev" ${canPrev ? '' : 'disabled'} aria-label="上一 Run">‹</button>
      <span class="pancreatic-run-nav-label">${runNum} / ${runCount} Run</span>
      <button type="button" class="pancreatic-run-nav-btn pancreatic-run-nav-next" ${canNext ? '' : 'disabled'} aria-label="下一 Run">›</button>
    </div>
    <div class="pancreatic-run-visuals">
      <figure class="run-visual-block">
        <figcaption>混淆矩陣 (CM)</figcaption>
        <div class="run-visual-media">
          <img src="${cmUrl}" alt="Run ${runNum} 混淆矩陣" loading="lazy">
        </div>
      </figure>
      <figure class="run-visual-block">
        <figcaption>曲線圖 (Curves)</figcaption>
        <div class="run-visual-media">
          <img src="${curvesUrl}" alt="Run ${runNum} 曲線圖" loading="lazy">
        </div>
      </figure>
    </div>`;
}

function showPancreaticRunDetail(itemId, runNum, runCount) {
  const modal = document.getElementById('modelDetailModal');
  const title = document.getElementById('modelDetailTitle');
  const body = document.getElementById('modelDetailBody');
  const card = modal?.querySelector('.model-detail-card');
  if (!modal || !title || !body) return;

  const totalRuns = runCount || getPancreaticItemRunCount(itemId);
  const safeRun = Math.min(Math.max(1, runNum), totalRuns);

  pancreaticRunViewer = { itemId, runNum: safeRun, runCount: totalRuns, mode: 'single' };

  title.textContent = `${itemId} — ${safeRun}Run`;
  body.innerHTML = renderPancreaticRunDetailBody(itemId, safeRun, totalRuns);
  equalizePancreaticRunVisuals(body);
  card?.classList.add('wide');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function showPancreaticAllRunCurves(itemId, runCount) {
  const modal = document.getElementById('modelDetailModal');
  const title = document.getElementById('modelDetailTitle');
  const body = document.getElementById('modelDetailBody');
  const card = modal?.querySelector('.model-detail-card');
  if (!modal || !title || !body) return;

  const totalRuns = runCount || getPancreaticItemRunCount(itemId);
  if (totalRuns <= 1) return;

  pancreaticRunViewer = { itemId, runNum: 1, runCount: totalRuns, mode: 'all' };

  title.textContent = `${itemId} — All Run Curves`;
  body.innerHTML = renderPancreaticAllRunCurvesBody(itemId, totalRuns);
  const img = body.querySelector('.pancreatic-all-runs-media img');
  const loadingEl = body.querySelector('.pancreatic-all-runs-loading');
  if (img && loadingEl) {
    const hideLoading = () => { loadingEl.style.display = 'none'; };
    img.addEventListener('load', hideLoading, { once: true });
    img.addEventListener('error', () => {
      loadingEl.textContent = '曲線疊圖載入失敗';
    }, { once: true });
    if (img.complete) hideLoading();
  }
  card?.classList.add('wide');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

async function showPancreaticTrainingLog(itemId) {
  const modal = document.getElementById('modelDetailModal');
  const title = document.getElementById('modelDetailTitle');
  const body = document.getElementById('modelDetailBody');
  const card = modal?.querySelector('.model-detail-card');
  if (!modal || !title || !body) return;

  pancreaticRunViewer = { itemId, runNum: 1, runCount: 1, mode: 'log' };
  title.textContent = `${itemId} — 訓練日誌`;
  body.innerHTML = '<p class="placeholder-text">載入訓練日誌中…</p>';
  card?.classList.add('wide');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');

  try {
    const res = await fetch(`/api/pancreatic/analysis/log?item=${encodeURIComponent(itemId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '載入失敗');
    body.innerHTML = `
      <div class="pancreatic-log-meta">
        <span class="pancreatic-log-meta-item">更新時間：${escapeHtml(data.modified || '-')}</span>
        <span class="pancreatic-log-meta-item">大小：${escapeHtml(formatBytes(data.size || 0))}</span>
      </div>
      <pre class="pancreatic-training-log">${escapeHtml(data.content || '')}</pre>`;
  } catch (err) {
    body.innerHTML = `<p class="placeholder-text">${escapeHtml(err.message || '載入訓練日誌失敗')}</p>`;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function navigatePancreaticRun(delta) {
  const { itemId, runNum, runCount, mode } = pancreaticRunViewer;
  if (!itemId || mode === 'all' || mode === 'log') return;

  const nextRun = runNum + delta;
  if (nextRun < 1 || nextRun > runCount) return;

  showPancreaticRunDetail(itemId, nextRun, runCount);
}

let pancreaticProbe = null;

function renderPancreaticProbeResult(result) {
  const host = document.getElementById('pancreaticProbeResult');
  if (!host) return;
  if (!result) {
    host.innerHTML = '';
    return;
  }
  if (result.error) {
    host.innerHTML = `<p class="probe-error">${escapeHtml(result.error)}</p>`;
    return;
  }
  const bars = (result.scores || []).map((score) => {
    const pct = Math.round((score.probability || 0) * 1000) / 10;
    const active = score.name === result.predicted_name ? ' is-predicted' : '';
    return `
      <div class="probe-score${active}">
        <div class="probe-score-label"><span>${escapeHtml(score.label)}</span><strong>${pct}%</strong></div>
        <div class="probe-score-track"><div class="probe-score-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
  host.innerHTML = `
    <p class="probe-verdict">判斷結果：<strong>${escapeHtml(result.predicted_label)}</strong></p>
    ${bars}
    <p class="section-hint">影像：${escapeHtml(result.source || '')}</p>`;
}

function shuffleProbeSamples(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function fetchRandomProbeSamples(category, count) {
  const limit = 24;
  const headRes = await fetch(`/api/datasets/pancreatic_dataset/samples?category=${encodeURIComponent(category)}&page=1&limit=1`);
  if (!headRes.ok) return [];
  const head = await headRes.json();
  const total = Number(head.total) || 0;
  if (!total) return [];
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = 1 + Math.floor(Math.random() * pages);
  const res = await fetch(`/api/datasets/pancreatic_dataset/samples?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return shuffleProbeSamples(data.samples || []).slice(0, count);
}

async function loadPancreaticProbeSamples() {
  const grid = document.getElementById('pancreaticProbeGrid');
  if (!grid) return;
  grid.innerHTML = '<p class="placeholder-text">載入影像…</p>';
  const [healthy, diseased] = await Promise.all([
    fetchRandomProbeSamples('healthy', 6),
    fetchRandomProbeSamples('diseased', 6),
  ]);
  const samples = shuffleProbeSamples([...healthy, ...diseased]);
  grid.innerHTML = samples.map((sample) => `
    <button type="button" class="probe-sample" data-sample-id="${escapeAttr(sample.id)}">
      <img src="/api/datasets/pancreatic_dataset/preview/${encodeURIComponent(sample.category)}/${encodeURIComponent(sample.filename)}" alt="">
      <span>${escapeHtml(sample.label || sample.category)}</span>
    </button>`).join('') || '<p class="placeholder-text">沒有影像</p>';
}

async function openPancreaticProbe(itemId) {
  openModelDetailModal('性能測試', '<p class="placeholder-text">正在隨機抽取模型…</p>');
  document.querySelector('#modelDetailModal .model-detail-card')?.classList.add('wide');
  try {
    const res = await fetch('/api/pancreatic/analysis/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: itemId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '無法開始性能測試');
    pancreaticProbe = { ...data, sampleId: '' };
    document.getElementById('modelDetailBody').innerHTML = `
      <p class="section-hint">已隨機抽取 <strong>Run ${escapeHtml(String(data.run || '-'))}</strong> 的模型（${escapeHtml(data.model_file || '')}）。請選擇資料集影像，或上傳一張圖。</p>
      <div class="probe-actions">
        <label class="btn btn-ghost btn-sm probe-upload">
          上傳影像
          <input id="pancreaticProbeFile" type="file" accept="image/*" hidden>
        </label>
        <button type="button" class="btn btn-primary btn-sm" id="pancreaticProbeRun" disabled>開始判斷</button>
      </div>
      <p class="probe-selected" id="pancreaticProbeSelected">尚未選擇影像</p>
      <div class="probe-sample-grid" id="pancreaticProbeGrid"></div>
      <div id="pancreaticProbeResult"></div>`;
    document.getElementById('pancreaticProbeFile')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      pancreaticProbe.sampleId = '';
      pancreaticProbe.file = file || null;
      document.querySelectorAll('.probe-sample').forEach((el) => el.classList.remove('is-selected'));
      document.getElementById('pancreaticProbeSelected').textContent = file ? `已選上傳檔：${file.name}` : '尚未選擇影像';
      document.getElementById('pancreaticProbeRun').disabled = !file;
    });
    document.getElementById('pancreaticProbeGrid')?.addEventListener('click', (event) => {
      const sample = event.target.closest('.probe-sample');
      if (!sample) return;
      pancreaticProbe.sampleId = sample.dataset.sampleId;
      pancreaticProbe.file = null;
      const fileInput = document.getElementById('pancreaticProbeFile');
      if (fileInput) fileInput.value = '';
      document.querySelectorAll('.probe-sample').forEach((el) => el.classList.toggle('is-selected', el === sample));
      document.getElementById('pancreaticProbeSelected').textContent = `已選資料集影像：${sample.dataset.sampleId}`;
      document.getElementById('pancreaticProbeRun').disabled = false;
    });
    document.getElementById('pancreaticProbeRun')?.addEventListener('click', () => runPancreaticProbe());
    await loadPancreaticProbeSamples();
  } catch (err) {
    document.getElementById('modelDetailBody').innerHTML = `<p class="probe-error">${escapeHtml(err.message || '無法開始性能測試')}</p>`;
  }
}

async function runPancreaticProbe() {
  if (!pancreaticProbe?.probe_id) return;
  const resultHost = document.getElementById('pancreaticProbeResult');
  if (resultHost) resultHost.innerHTML = '<p class="placeholder-text">模型判斷中…</p>';
  const body = new FormData();
  body.append('probe_id', pancreaticProbe.probe_id);
  if (pancreaticProbe.sampleId) body.append('sample_id', pancreaticProbe.sampleId);
  if (pancreaticProbe.file) body.append('image', pancreaticProbe.file);
  try {
    const res = await fetch('/api/pancreatic/analysis/probe/predict', { method: 'POST', body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '判斷失敗');
    renderPancreaticProbeResult(data);
  } catch (err) {
    renderPancreaticProbeResult({ error: err.message || '判斷失敗' });
  }
}

let pancreaticAnalysisEventsBound = false;

function bindPancreaticAnalysisEvents() {
  if (pancreaticAnalysisEventsBound) return;
  pancreaticAnalysisEventsBound = true;

  document.getElementById('modelDetailModal')?.addEventListener('click', (e) => {
    if (e.target.closest('.pancreatic-run-nav-prev')) {
      e.stopPropagation();
      navigatePancreaticRun(-1);
      return;
    }
    if (e.target.closest('.pancreatic-run-nav-next')) {
      e.stopPropagation();
      navigatePancreaticRun(1);
    }
  });

  document.getElementById('resultsTable')?.addEventListener('click', (e) => {
    if (selectedAppId !== 'pancreatic') return;

    const sortBtn = e.target.closest('.pa-sort-btn');
    if (sortBtn) {
      e.stopPropagation();
      pancreaticAnalysisSort = {
        key: sortBtn.dataset.sortKey,
        dir: sortBtn.dataset.sortDir,
      };
      renderPancreaticAnalysisTableHead();
      refreshPancreaticAnalysisTableBody();
      return;
    }

    const metricLabel = e.target.closest('.pa-metric-label');
    if (metricLabel) {
      e.stopPropagation();
      showPancreaticMetricDetail(metricLabel.dataset.metricKey);
      return;
    }
  });

  document.getElementById('resultsTableBody')?.addEventListener('click', (e) => {
    if (selectedAppId !== 'pancreatic') return;

    const runBtn = e.target.closest('.pancreatic-run-btn');
    if (runBtn) {
      e.stopPropagation();
      showPancreaticRunDetail(runBtn.dataset.itemId, Number(runBtn.dataset.run));
      return;
    }

    const allRunsBtn = e.target.closest('.pancreatic-all-runs-btn');
    if (allRunsBtn) {
      e.stopPropagation();
      showPancreaticAllRunCurves(allRunsBtn.dataset.itemId, Number(allRunsBtn.dataset.runCount));
      return;
    }

    const logBtn = e.target.closest('.pancreatic-log-btn');
    if (logBtn) {
      e.stopPropagation();
      showPancreaticTrainingLog(logBtn.dataset.itemId);
      return;
    }

    const probeBtn = e.target.closest('.pancreatic-probe-btn');
    if (probeBtn) {
      e.stopPropagation();
      openPancreaticProbe(probeBtn.dataset.itemId);
      return;
    }

    const row = e.target.closest('.pancreatic-result-row');
    if (row?.dataset.itemId) {
      togglePancreaticAnalysisRow(row.dataset.itemId);
    }
  });
}
