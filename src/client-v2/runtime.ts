import { rewriteReferences } from '../shared/uid';

/** Notify other editing sessions; historical URLs are never resolved or redirected. */
export function installRuntime(_api: any, onChanged: () => void) {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('xz-schema-uid');
    channel.onmessage = () => onChanged();
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
