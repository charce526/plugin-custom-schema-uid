import { normalizeUid, RESOURCE, rewriteReferences } from '../shared/uid';
import { CreationUidInput } from './creationDialog';

const installed = new WeakSet<object>();

/** Extend the actual menu class for each runtime. Keep core creation, insertion and V1 schema initialization. */
export function installMenuUidSupport(Base: any, t: (key: string) => string, addressPrefix: string) {
  if (!Base || installed.has(Base)) return;
  installed.add(Base);
  const choices = new WeakMap<object, { uid: string; from?: string }>();
  const originalCreation = Base.prototype.createMenuFromMeta;
  const originalRoute = Base.prototype.createMenuRoute;
  const originalSchema = Base.prototype.insertRouteSchema;
  Base.prototype.createMenuFromMeta = async function (meta: any, values: any) {
    const page = ['page', 'flowPage'].includes(meta?.menuType);
    const custom = page ? normalizeUid(values?.customSchemaUid, true) : '';
    if (custom) choices.set(this, { uid: custom });
    try { return await originalCreation.call(this, meta, values); }
    finally { choices.delete(this); }
  };
  Base.prototype.createMenuRoute = function (route: any, options: any) {
    const choice = choices.get(this);
    if (choice && ['page', 'flowPage'].includes(route.type)) {
      choice.from = route.schemaUid;
      route = { ...route, schemaUid: choice.uid };
    }
    return originalRoute.call(this, route, options);
  };
  if (originalSchema) Base.prototype.insertRouteSchema = function (schema: any) {
    const choice = choices.get(this);
    return originalSchema.call(this, choice?.from ? rewriteReferences(schema, choice.from, choice.uid) : schema);
  };
  const field = (ctx: any, typeReaction: boolean) => ({
    type: 'string', title: t('Custom schema UID'),
    description: t('Leave empty to auto-generate. The UID is checked again by the server when saved.'),
    'x-decorator': 'FormItem', 'x-component': CreationUidInput,
    'x-component-props': { addressPrefix, autoLabel: t('Automatically generated'), placeholder: 'project-management', maxLength: 64 },
    'x-validator': async (raw: unknown) => {
      try {
        const value = normalizeUid(raw, true);
        if (value) await ctx.api.request({ url: `${RESOURCE}:check`, method: 'post', data: { uid: value } });
      } catch (error: any) { return t(error.response?.data?.errors?.[0]?.message || error.message); }
    },
    ...(typeReaction ? { 'x-reactions': { dependencies: ['menuType'], fulfill: { state: {
      hidden: '{{$deps[0] !== "page" && $deps[0] !== "flowPage"}}',
    } } } } : {}),
  });
  for (const key of ['menuCreation', 'menuSettings']) {
    const flow = Base.globalFlowRegistry.getFlow(key);
    if (!flow) continue;
    const steps = { ...flow.steps };
    for (const stepKey of key === 'menuCreation' ? ['basic'] : ['insertBefore', 'insertAfter', 'insertInner']) {
      const step = steps[stepKey];
      if (!step) continue;
      steps[stepKey] = { ...step, uiSchema: async (ctx: any) => {
        const source = typeof step.uiSchema === 'function' ? await step.uiSchema(ctx) : step.uiSchema;
        const schema = { ...(source || {}) };
        if (key === 'menuSettings' || ['page', 'flowPage'].includes(ctx.model.getCreationMeta()?.menuType)) {
          schema.customSchemaUid = field(ctx, key === 'menuSettings');
        }
        return schema;
      } };
    }
    // FlowDefinition exposes key/manual/etc. through getters; object spread loses them.
    Base.registerFlow({ ...flow.serialize(), steps });
  }
}
