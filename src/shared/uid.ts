export const PLUGIN_NAME = '@xiezuo/plugin-custom-schema-uid';
export const RESOURCE = 'xzSchemaUid';
export const RESERVED = new Set(['settings', 'login', 'logout', 'signin', 'signup', 'api', 'admin', 'v', 'mobile', 'tabs', '403', '404']);

export function normalizeUid(value: unknown, optional = false): string {
  if (value == null && optional) return '';
  if (typeof value !== 'string') throw new Error('UID must be a string.');
  const result = value.trim();
  if (!result && optional) return '';
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/.test(result)) {
    throw new Error('UID must contain 1–64 letters, digits, underscores or hyphens and cannot start with a hyphen.');
  }
  if (RESERVED.has(result.toLowerCase())) throw new Error('This UID is reserved by the system.');
  return result;
}

const referenceKeys = new Set(['uid', 'x-uid', 'schemaUid', 'pageSchemaUid', 'tabSchemaUid', 'menuSchemaUid',
  'parentId', 'parentUid', 'pageUid', 'tabUid', 'targetUid', 'sourceUid', 'modelUid', 'gridUid', 'tabActiveKey']);
const scriptKeys = /^(code|script|javascript|js|expression|html|content|sql)$/i;

/** Only typed identifiers and complete NocoBase URL segments are rewritten. Never replace arbitrary text. */
export function rewriteReferences(value: any, from: string, to: string, warnings: string[] = [], path = ''): any {
  if (Array.isArray(value)) return value.map((item, i) => rewriteReferences(item, from, to, warnings, `${path}.${i}`));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (typeof item === 'string') {
      if (scriptKeys.test(key) || item.includes('{{')) {
        result[key] = item;
        if (item.includes(from)) warnings.push(location);
      } else if (referenceKeys.has(key) && item === from) {
        result[key] = to;
      } else if (['href', 'url', 'path', 'pathname', 'link'].includes(key) && /^\/(?:v\/)?admin\//.test(item)) {
        result[key] = item.replace(/(\/admin\/|\/tabs\/)([^/?#]+)/g, (match, prefix, id) => id === from ? prefix + to : match);
      } else {
        result[key] = item;
        if (item.includes(from) && key !== 'title' && key !== 'name') warnings.push(location);
      }
    } else result[key] = rewriteReferences(item, from, to, warnings, location);
  }
  return result;
}

export function routePath(route: any, routes: any[], modern = true): string {
  const prefix = modern ? '/v/admin/' : '/admin/';
  if (route.type === 'group') return prefix + route.id;
  if (route.type === 'link') return route.options?.href || '';
  if (route.type !== 'tabs') return prefix + route.schemaUid;
  const parent = routes.find((item) => String(item.id) === String(route.parentId));
  return parent ? `${prefix}${parent.schemaUid}/tabs/${route.schemaUid}` : '';
}
