// Telemetria local e relatório de integridade; dependências recebidas do núcleo.
(function(root){
'use strict';
function createDiagnostics({userKey, APP_VERSION, TELEMETRY_SCHEMA, PAGES, diagnosticFixtureStorages}) {
  return (() => {
  const key = userKey('reserva.diagnostics.v1');
  const sessionKey = key + '.active';
  const eventLimit = 1000;
  const retentionDays = 30;
  const retentionMs = retentionDays * 86400000;
  const trailLimit = 30;
  const trailKey = key + '.trail';
  const sessionId = (() => {
    try { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
    catch { return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
  })();
  function safeText(value, maxBytes = 240) {
    let text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&](?:access_token|token|secret|password|api_key|authorization|cookie)=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/\b\d{3}[. -]?\d{3}[. -]?\d{3}[- .]?\d{2}\b/g, '[REDACTED_ID]')
      .replace(/\b\d{2}[. -]?\d{3}[. -]?\d{3}[/. -]?\d{4}[- .]?\d{2}\b/g, '[REDACTED_ID]')
      .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)9?\d{4}[-. ]?\d{4}\b/g, '[REDACTED_PHONE]')
      .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_NUMBER]');
    while (new TextEncoder().encode(text).length > maxBytes) text = text.slice(0, Math.max(0, text.length - 8));
    return text;
  }
  const severity = (code, status) => ['alerta','falha','erro'].includes(String(status).toLowerCase()) ? 'WARN' :
    /(?:\.failed|\.error|\.invalid|^javascript\.|^session\.interrupted)/i.test(code) ? 'ERROR' : 'INFO';
  let module;
  let trail = [];
  let events = [];
  let storageAvailable = true;
  let storageEstimate = { usedBytes: null, quotaBytes: null };
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) events = saved.slice(-eventLimit);
  } catch { storageAvailable = false; }
  function pruneEvents() {
    const cutoff=Date.now()-retentionMs;
    events=events.filter(event=>{const time=Date.parse(event.ts||event.at||'');return Number.isFinite(time)&&time>cutoff;}).slice(-eventLimit);
  }
  pruneEvents();

  try {
    const saved = JSON.parse(sessionStorage.getItem(trailKey) || '[]');
    if (Array.isArray(saved)) trail = saved.slice(-trailLimit);
  } catch {}

  function step(action, page = module) {
    if (PAGES.some(([id]) => id === page)) module = page;
    trail.push({ at: new Date().toISOString(), action, module });
    if (trail.length > trailLimit) trail.shift();
    try { sessionStorage.setItem(trailKey, JSON.stringify(trail)); } catch {}
  }

  function environment() {
    const nav = navigator;
    const brands = nav.userAgentData?.brands?.map(item => ({
      brand: item.brand.slice(0, 32), version: item.version.split('.')[0]
    })) || [];
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const mem = performance.memory;
    const hints = nav.userAgentData;
    const cap = window.Capacitor;
    const perf = performance.getEntriesByType?.('navigation')?.[0];
    let native = null;
    try { if (cap?.isNativePlatform?.()) native = cap.getPlatform?.() || 'native'; } catch {}
    return {
      module, online: nav.onLine,
      mode: native || (location.protocol === 'file:' ? 'html' : window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser'),
      browser: { userAgent: nav.userAgent || 'unknown', brands, platform: hints?.platform || nav.platform || 'unknown', platformVersion: hints?.platformVersion || null, model: hints?.model || null, architecture: hints?.architecture || null, bitness: hints?.bitness || null, mobile: hints?.mobile ?? null, language: nav.language || 'unknown' },
      device: { memoryGb: nav.deviceMemory || null, logicalCpuCores: nav.hardwareConcurrency || null, pixelRatio: window.devicePixelRatio || 1, screen: { width: screen.width, height: screen.height, availableWidth: screen.availWidth, availableHeight: screen.availHeight, colorDepth: screen.colorDepth, orientation: screen.orientation?.type || 'unknown' }, viewport: { width: window.innerWidth, height: window.innerHeight } },
      connection: conn ? { type: conn.type || 'unknown', effectiveType: conn.effectiveType || 'unknown', downlinkMbps: Number.isFinite(conn.downlink) ? conn.downlink : null, rttMs: Number.isFinite(conn.rtt) ? conn.rtt : null, saveData: Boolean(conn.saveData) } : null,
      memory: mem ? { jsHeapUsedBytes: mem.usedJSHeapSize, jsHeapTotalBytes: mem.totalJSHeapSize, jsHeapLimitBytes: mem.jsHeapSizeLimit } : null,
      storage: { ...storageEstimate, available: storageAvailable },
      runtime: { visibility: document.visibilityState || 'unknown', focused: document.hasFocus?.() ?? null, secureContext: window.isSecureContext, cookieEnabled: nav.cookieEnabled, serviceWorkerSupported: 'serviceWorker' in nav, serviceWorkerState: nav.serviceWorker?.controller?.state || 'uncontrolled', capacitorPlatform: native, pageLoadMs: Number.isFinite(perf?.loadEventEnd) ? Math.round(perf.loadEventEnd) : null, domReadyMs: Number.isFinite(perf?.domContentLoadedEventEnd) ? Math.round(perf.domContentLoadedEventEnd) : null }
    };
  }

  async function refreshStorageEstimate() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      storageEstimate = {
        usedBytes: Number.isFinite(estimate?.usage) ? estimate.usage : null,
        quotaBytes: Number.isFinite(estimate?.quota) ? estimate.quota : null
      };
    } catch {}
  }
  refreshStorageEstimate();

  function record(code, error, context = {}) {
    if (diagnosticFixtureStorages.has(window.localStorage)) return;
    pruneEvents();
    const at = new Date().toISOString();
    const type = ['Error','TypeError','ReferenceError','SyntaxError','RangeError',
      'QuotaExceededError','SecurityError','NetworkError','AbortError','NotAllowedError']
      .includes(error?.name) ? error.name : undefined;
    const safeContext = {...context};
    if (safeContext.reason !== undefined) safeContext.reason = safeText(safeContext.reason);
    if (safeContext.error_message !== undefined) safeContext.error_message = safeText(safeContext.error_message);
    if (error?.message && safeContext.error_message === undefined) safeContext.error_message = safeText(error.message);
    const status = safeContext.status;
    events.push({ event_id: (() => { try { return crypto.randomUUID(); } catch { return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); } })(),
      ts:at, level:severity(code,status), service:'reserva-simples-pwa', env:window.matchMedia?.('(display-mode: standalone)').matches?'standalone':'browser',
      schema_version:TELEMETRY_SCHEMA, session_id:sessionId, msg:safeText(code,96), at, version:APP_VERSION, code, type, module, online:navigator.onLine,
      ...safeContext, ...(code === 'session.started' ? {} : { trail: trail.slice(-10) }) });
    if (error?.stack && code.startsWith('javascript.')) {
      events[events.length - 1].stack = String(error.stack).split('\n').slice(1, 8)
        .map(line => line.replace(/https?:\/\/[^/\s)]+[^\s)]*/g, '[app]').replace(/file:\/\/[^\s)]*/g, '[local]'))
        .join('\n').slice(0, 1200);
    }
    if (events.length > eventLimit) events.shift();
    try {
      localStorage.setItem(key, JSON.stringify(events));
      storageAvailable = true;
    } catch { storageAvailable = false; }
  }
  addEventListener('error', event => {
    if (event.target !== window && !event.message) {
      record('resource.failed', undefined, { element: ['SCRIPT','LINK','IMG'].includes(event.target?.tagName) ? event.target.tagName : 'other' });
      return;
    }
    record('javascript.error', event.error, { line: event.lineno || undefined, column: event.colno || undefined });
  }, true);
  addEventListener('unhandledrejection', event => record('javascript.rejection', event.reason));
  function markActive() {
    try { sessionStorage.setItem(sessionKey, '1'); } catch {}
  }
  try {
    if (sessionStorage.getItem(sessionKey)) record('session.interrupted');
  } catch {}
  markActive();
  addEventListener('pageshow', markActive);
  addEventListener('pagehide', () => {
    try { sessionStorage.removeItem(sessionKey); } catch {}
  });
  record('session.started');
  return {
    record,
    step,
    report: () => ({
      format: 2,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      storageAvailable,
      eventLimit,
      retentionDays,
      environment: environment(),
      recentActions: trail.slice(),
      events: events.slice()
    }),
    clear() {
      events = [];
      trail = [];
      try { sessionStorage.removeItem(trailKey); } catch {}
      try { localStorage.removeItem(key); storageAvailable = true; }
      catch { storageAvailable = false; }
    }
  };
})();
}
root.ReservaDiagnostics=Object.freeze({create:createDiagnostics});
})(window);
