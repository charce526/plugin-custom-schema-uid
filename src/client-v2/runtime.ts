import { RESOURCE, rewriteReferences } from '../shared/uid';

/** Resolve only the page and tab segments. Prefix, query, fragment, and popup suffix are preserved. */
export async function resolveCurrentAddress(api: any) {
  const match = location.pathname.match(/^(.*\/(?:v\/)?admin\/)([^/]+)(?:\/tabs\/([^/]+))?(.*)$/);
  if (!match || ['settings', 'login'].includes(match[2])) return;
  const { data } = await api.request({ url: `${RESOURCE}:resolve`, method: 'post', data: { uids: [match[2], match[3]].filter(Boolean) } });
  const mapping = data.data || {};
  const path = match[1] + (mapping[match[2]] || match[2]) + (match[3] ? '/tabs/' + (mapping[match[3]] || match[3]) : '') + match[4];
  if (path !== location.pathname) location.replace(path + location.search + location.hash);
}

export function installRuntime(api: any, onChanged: () => void) {
  let running = false;
  const resolve = async () => {
    if (running) return;
    running = true;
    try { await resolveCurrentAddress(api); } catch { /* Auth may not yet be ready; retry after accessible routes load. */ }
    finally { running = false; }
  };
  api.axios.interceptors.response.use((response: any) => {
    if (/desktopRoutes:(listAccessible|getAccessible)/.test(response.config?.url || '')) void resolve();
    return response;
  });
  window.addEventListener('popstate', () => void resolve());
  window.addEventListener('hashchange', () => void resolve());
  // SPA navigation need not fetch the routes again.
  for (const key of ['pushState', 'replaceState'] as const) {
    const original = history[key].bind(history);
    history[key] = (...args: Parameters<History[typeof key]>) => { original(...args); void resolve(); };
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('xz-schema-uid');
    channel.onmessage = () => { onChanged(); void resolve(); };
  }
}

/** Legacy creation runs in two API calls (route, then UI schema). Translate the same temporary UID in both. */
export function installLegacyCreation(api: any, ask: (config?: any) => Promise<string | null>, types = ['page', 'tabs']) {
  const pending = new Map<string, string>();
  api.axios.interceptors.request.use(async (config: any) => {
    const url = config.url || '';
    if (/desktopRoutes:create(?:\?|$)/.test(url) && types.includes(config.data?.type)) {
      const custom = await ask(config);
      if (custom === null) throw new Error('已取消新建。');
      if (custom && custom !== config.data.schemaUid) pending.set(config.data.schemaUid, custom);
    }
    if (/desktopRoutes:|uiSchemas:/.test(url)) {
      for (const [from, to] of pending) {
        if (config.data) config.data = rewriteReferences(config.data, from, to);
        if (config.params) config.params = rewriteReferences(config.params, from, to);
      }
    }
    return config;
  });
  api.axios.interceptors.response.use((response: any) => {
    const config = response.config;
    if (/uiSchemas:insert/.test(config?.url || '') && pending.size) {
      const body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      if ([...pending.values()].some((uid) => body.includes(`"${uid}"`))) {
        const mappings = new Map(pending); pending.clear();
        // Finish the caller's awaited mutation, then reload its local schema with the persisted UID.
        setTimeout(() => {
          let path = location.pathname;
          for (const [from, to] of mappings) path = path.replace(new RegExp(`(/admin/|/tabs/)${from}(?=/|$)`, 'g'), '$1' + to);
          location.replace(path + location.search + location.hash);
        }, 300);
      }
    }
    return response;
  }, (error: any) => {
    if (/desktopRoutes:create/.test(error.config?.url || '')) pending.clear();
    return Promise.reject(error);
  });
}
