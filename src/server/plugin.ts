import { Plugin } from '@nocobase/server';
import { RESOURCE } from '../shared/uid';
import { UidError, UidService } from './service';

export class PluginCustomSchemaUidServer extends Plugin {
  service: UidService;
  async beforeLoad() {
    this.service = new UidService(this.db);
    this.db.on('desktopRoutes.beforeCreate', async (row, options) => {
      if (row.get('schemaUid') || ['page', 'flowPage', 'tabs'].includes(row.get('type'))) {
        try { row.set('schemaUid', await this.service.available(row.get('schemaUid'), options.transaction)); }
        catch (error) { if (error instanceof UidError) throw error; throw new UidError(400, (error as Error).message); }
      }
    });
    this.db.on('desktopRoutes.beforeUpdate', async (row) => {
      if (row.changed('schemaUid')) throw new UidError(409, 'Use UID management to change an existing UID.');
    });
  }
  async load() {
    const admin = (ctx: any) => !!ctx.state.currentUser && (ctx.state.currentRoles || []).includes('root');
    this.app.acl.allow(RESOURCE, ['list', 'check', 'preview', 'execute', 'status', 'create', 'parents'], admin);
    this.app.acl.allow(RESOURCE, 'resolve', 'loggedIn');
    this.app.acl.registerSnippet({ name: 'pm.uid-management', actions: [`${RESOURCE}:list`, `${RESOURCE}:preview`, `${RESOURCE}:execute`, `${RESOURCE}:create`] });
    const user = (ctx: any) => ctx.state.currentUser?.id;
    const handler = (fn: (ctx: any) => Promise<any>) => async (ctx: any, next: any) => {
      try { ctx.body = await fn(ctx); }
      catch (error) {
        if (error instanceof UidError) ctx.throw(error.status, error.message);
        if (error instanceof Error && /UID|Title/.test(error.message)) ctx.throw(400, error.message);
        throw error;
      }
      await next();
    };
    this.app.resourceManager.define({ name: RESOURCE, actions: {
      list: handler(() => this.service.list()),
      parents: handler(async () => (await this.service.routeRows()).filter((r) => ['page', 'flowPage', 'group'].includes(r.type))),
      check: handler(async (ctx) => { await this.service.available(ctx.action.params.values?.uid || ctx.action.params.uid); return { available: true }; }),
      preview: handler((ctx) => this.service.preview(ctx.action.params.values?.routeId, ctx.action.params.values?.uid, user(ctx))),
      execute: handler((ctx) => this.service.execute(ctx.action.params.values?.id, user(ctx), ctx.action.params.values?.confirmed)),
      status: handler((ctx) => this.service.status(ctx.action.params.id, user(ctx))),
      create: handler((ctx) => this.service.create(ctx.action.params.values || {})),
      resolve: handler((ctx) => this.service.resolve(ctx.action.params.values?.uids)),
    } });
    const resources = new Set(['desktopRoutes', 'flowModels', 'uiSchemas', 'uiSchemaTreePath', 'flowModelTreePath', 'uiSchemaServerHooks', 'uiButtonSchemasRoles']);
    const reads = new Set(['list', 'get', 'listAccessible', 'getAccessible', 'findOne', 'getJsonSchema', 'getProperties', 'getParentJsonSchema', 'getServerHooks']);
    this.app.resourceManager.use(async (ctx, next) => {
      if (!resources.has(ctx.action.resourceName) || reads.has(ctx.action.actionName)) return next();
      await this.service.locked(async () => {
        try {
          await this.service.guardStale({ ...ctx.action.params, uid: ctx.action.params.uid });
          const values = ctx.action.params.values;
          if (ctx.action.resourceName === 'desktopRoutes' && ctx.action.actionName === 'updateOrCreate' && values?.type && values.id == null) {
            await this.service.available(values.schemaUid);
          }
          await next();
        } catch (error) {
          if (error instanceof UidError) ctx.throw(error.status, error.message);
          throw error;
        }
      });
    }, { tag: 'xz-uid-write-guard', after: 'auth', before: 'action' });
  }
  async install() { await this.service.initialize(); }
  async afterEnable() { await this.service.initialize(); }
}
export default PluginCustomSchemaUidServer;
