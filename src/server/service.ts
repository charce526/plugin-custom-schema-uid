import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { uid } from '@nocobase/utils';
import { normalizeUid, rewriteReferences, routePath } from '../shared/uid';

export class UidError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const tables = ['desktopRoutes', 'uiSchemas', 'uiSchemaTreePath', 'flowModels', 'flowModelTreePath',
  'uiSchemaServerHooks', 'uiButtonSchemasRoles'];
const jsonFields: Record<string, string[]> = {
  desktopRoutes: ['options'], uiSchemas: ['schema'], flowModels: ['options'], uiSchemaServerHooks: ['params'],
};
const uidColumns: Record<string, string[]> = {
  desktopRoutes: ['schemaUid', 'menuSchemaUid'], uiSchemas: ['x-uid'],
  uiSchemaTreePath: ['ancestor', 'descendant'], flowModels: ['uid'], flowModelTreePath: ['ancestor', 'descendant'],
  uiSchemaServerHooks: ['uid'], uiButtonSchemasRoles: ['uid'],
};
const digest = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class UidService {
  constructor(public db: any) {}
  model(name: string): any { return this.db.getCollection(name)?.model; }
  async initialize() {
    await this.model('xzUidLocks').findOrCreate({ where: { id: 'global' }, defaults: { revision: 0 } });
  }
  /** A database row lock serializes all plugin and standard schema mutation HTTP requests, across workers. */
  async locked<T>(work: (transaction: any) => Promise<T>): Promise<T> {
    return this.db.sequelize.transaction(async (transaction: any) => {
      const lock = await this.model('xzUidLocks').findByPk('global', { transaction, lock: transaction.LOCK.UPDATE });
      if (!lock) throw new UidError(503, 'UID service is not initialized. Enable or upgrade the plugin first.');
      await lock.update({ revision: lock.get('revision') + 1 }, { transaction });
      return work(transaction);
    });
  }
  async rows(name: string, transaction?: any, lock = false): Promise<any[]> {
    const model = this.model(name);
    if (!model) return [];
    return model.findAll({ raw: true, transaction, order: model.primaryKeyAttributes.map((key: string) => [key, 'ASC']),
      ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  }
  async snapshot(transaction?: any, lock = false) {
    const result: Record<string, any[]> = {};
    for (const name of tables) result[name] = await this.rows(name, transaction, lock);
    return result;
  }
  async available(raw: unknown, transaction?: any, ownRouteId?: any) {
    const value = normalizeUid(raw);
    const route = await this.model('desktopRoutes').findOne({ where: { schemaUid: value }, transaction });
    if (route && String(route.get('id')) !== String(ownRouteId)) throw new UidError(409, 'UID is already in use.');
    const alias = await this.model('xzUidAliases').findByPk(value, { transaction });
    if (alias && String(alias.get('routeId')) !== String(ownRouteId)) throw new UidError(409, 'UID is reserved by an old address.');
    for (const [name, key] of [['uiSchemas', 'x-uid'], ['flowModels', 'uid']]) {
      if (await this.model(name)?.findByPk(value, { transaction })) throw new UidError(409, 'UID conflicts with an existing schema or model.');
      // Menu schema identifiers also share the V1 schema namespace.
    }
    if (await this.model('desktopRoutes').findOne({ where: { menuSchemaUid: value }, transaction })) {
      throw new UidError(409, 'UID conflicts with an existing menu schema.');
    }
    for (const name of ['uiSchemaTreePath', 'flowModelTreePath']) {
      if (this.model(name) && await this.db.getRepository(name).findOne({
        filter: { $or: [{ ancestor: value }, { descendant: value }] }, transaction,
      })) throw new UidError(409, 'UID conflicts with an existing schema or model.');
    }
    return value;
  }
  describe(route: any, routes: any[]) {
    const parent = routes.find((row) => String(row.id) === String(route.parentId));
    const kind = route.type === 'tabs' ? parent?.type : route.type;
    const version = kind === 'flowPage' ? 'V2' : kind === 'page' ? 'V1' : undefined;
    return { ...route, version, parentTitle: parent?.title, path: routePath(route, routes, true),
      legacyPath: routePath(route, routes, false) };
  }
  async list() {
    const routes = await this.routeRows();
    return routes.map((r) => this.describe(r, routes));
  }
  async routeRows() {
    // Match the official desktop routes page, including its default layout scope when available.
    const collection = this.db.getCollection('desktopRoutes');
    const filter = collection.getField('uiLayouts') ? { 'uiLayouts.uid': 'admin-layout-model' } : undefined;
    const routes = await this.db.getRepository('desktopRoutes').find({ sort: ['sort', 'id'], filter });
    // Association filters use eager loading, which returns model instances even with raw:true.
    return routes.map((route: any) => typeof route.toJSON === 'function' ? route.toJSON() : route);
  }
  plan(snapshot: Record<string, any[]>, routeId: any, nextUid: string) {
    const routes = snapshot.desktopRoutes;
    const route = routes.find((r) => String(r.id) === String(routeId));
    if (!route || !['page', 'flowPage', 'tabs'].includes(route.type)) throw new UidError(404, 'Page or tab not found.');
    const info = this.describe(route, routes);
    if (info.version === 'V1' && !snapshot.uiSchemas.some((r) => r['x-uid'] === route.schemaUid)) {
      throw new UidError(409, 'V1 schema is missing. Open and repair the page before changing its UID.');
    }
    if (info.version === 'V2' && !snapshot.flowModels.some((r) => r.uid === route.schemaUid)) {
      throw new UidError(409, 'V2 model is missing. Open and repair the page before changing its UID.');
    }
    const changes: any[] = [], warnings: string[] = [];
    for (const [table, rows] of Object.entries(snapshot)) {
      for (const row of rows) {
        const next = { ...row };
        for (const field of uidColumns[table] || []) if (row[field] === route.schemaUid) next[field] = nextUid;
        // Flow model name is an internal node name; V1 property names/tabSchemaName stay stable.
        if (table === 'flowModels' && row.uid === route.schemaUid && row.name === route.schemaUid) next.name = nextUid;
        for (const field of jsonFields[table] || []) {
          next[field] = rewriteReferences(row[field], route.schemaUid, nextUid, warnings, `${table}.${row.id || row.uid || row['x-uid']}.${field}`);
        }
        const values = Object.fromEntries(Object.entries(next).filter(([key, value]) => !isDeepStrictEqual(value, row[key])));
        if (Object.keys(values).length) changes.push({ table, row, values });
      }
    }
    return { route: info, nextUid, changes, warnings: [...new Set(warnings)],
      oldPath: info.path, newPath: routePath({ ...route, schemaUid: nextUid }, routes),
      counts: changes.reduce((acc, c) => ({ ...acc, [c.table]: (acc[c.table] || 0) + 1 }), {}) };
  }
  async preview(routeId: any, raw: unknown, userId: any) {
    return this.locked(async (transaction) => {
      const snapshot = await this.snapshot(transaction, true);
      const route = snapshot.desktopRoutes.find((r) => String(r.id) === String(routeId));
      const nextUid = normalizeUid(raw);
      if (route?.schemaUid === nextUid) throw new UidError(400, 'UID has not changed.');
      await this.available(nextUid, transaction, routeId);
      const plan = this.plan(snapshot, routeId, nextUid);
      const id = randomUUID();
      await this.model('xzUidOperations').create({ id, userId, status: 'preview', payload: {
        routeId: String(routeId), from: plan.route.schemaUid, to: nextUid, digest: digest(snapshot), expiresAt: Date.now() + 10 * 60_000,
      } }, { transaction });
      return { id, from: plan.route.schemaUid, to: nextUid, route: plan.route, oldPath: plan.oldPath, newPath: plan.newPath,
        counts: plan.counts, warnings: plan.warnings, oldAddress: 'redirect', expiresAt: Date.now() + 10 * 60_000 };
    });
  }
  /** Low-level writes preserve record identities and avoid create/destroy hooks and default role assignment. */
  async write(table: string, row: any, values: any, transaction: any) {
    const model = this.model(table);
    const column = (key: string) => model.rawAttributes[key]?.field || key;
    const where = Object.fromEntries(model.primaryKeyAttributes.map((key: string) => [column(key), row[key]]));
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [column(key), value]));
    await this.db.sequelize.getQueryInterface().bulkUpdate(model.getTableName(), fields, where,
      { transaction }, model.rawAttributes);
  }
  async execute(id: string, userId: any, confirmed: boolean) {
    if (confirmed !== true) throw new UidError(400, 'Explicit confirmation is required.');
    const result = await this.locked(async (transaction) => {
      const op = await this.model('xzUidOperations').findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!op || String(op.get('userId')) !== String(userId)) throw new UidError(404, 'Operation not found.');
      if (op.get('status') === 'completed') return op.get('result');
      const payload = op.get('payload');
      if (payload.expiresAt < Date.now()) throw new UidError(409, 'Preview expired. Check the impact again.');
      const snapshot = await this.snapshot(transaction, true);
      if (digest(snapshot) !== payload.digest) throw new UidError(409, 'Configuration changed. Check the impact again.');
      await this.available(payload.to, transaction, payload.routeId);
      const plan = this.plan(snapshot, payload.routeId, payload.to);
      // Change primary identifiers in place. Core foreign keys use ON UPDATE CASCADE;
      // an incompatible constraint fails and rolls back instead of deleting/recreating the page.
      const roots = plan.changes.filter((c) => ['uiSchemas', 'flowModels'].includes(c.table) && (c.row.uid === payload.from || c.row['x-uid'] === payload.from));
      for (const root of roots) await this.write(root.table, root.row, root.values, transaction);
      for (const change of plan.changes) if (!roots.includes(change)) await this.write(change.table, change.row, change.values, transaction);
      await this.model('xzUidAliases').destroy({ where: { uid: payload.to }, transaction });
      await this.model('xzUidAliases').upsert({ uid: payload.from, routeId: payload.routeId }, { transaction });
      const result = { id, status: 'completed', routeId: payload.routeId, from: payload.from, to: payload.to,
        oldPath: plan.oldPath, newPath: plan.newPath, oldAddress: 'redirect', warnings: plan.warnings, counts: plan.counts };
      await op.update({ status: 'completed', result }, { transaction });
      return result;
    });
    await this.clearCaches();
    return result;
  }
  async clearCaches() {
    for (const name of ['uiSchemas', 'flowModels']) {
      const cache = this.db.getRepository(name)?.cache;
      if (cache) await cache.reset();
    }
  }
  async status(id: string, userId: any) {
    // Wait for an in-flight execution to release the same lock; a pre-commit preview
    // must not be mistaken for a failed/rolled-back operation after a client timeout.
    return this.locked(async (transaction) => {
      const op = await this.model('xzUidOperations').findByPk(id, { transaction });
      if (!op || String(op.get('userId')) !== String(userId)) throw new UidError(404, 'Operation not found.');
      return { id, status: op.get('status'), result: op.get('result') };
    });
  }
  async resolve(ids: string[]) {
    if (!Array.isArray(ids) || ids.length > 32 || ids.some((id) => typeof id !== 'string' || id.length > 255)) throw new UidError(400, 'Invalid identifiers.');
    const result: Record<string, string> = {};
    for (const id of ids) {
      const alias = await this.model('xzUidAliases').findByPk(id);
      if (!alias) continue;
      const route = await this.model('desktopRoutes').findByPk(alias.get('routeId'));
      if (route) result[id] = route.get('schemaUid');
    }
    return result;
  }
  async guardStale(params: any) {
    const aliases = await this.rows('xzUidAliases');
    for (const alias of aliases) {
      const route = await this.model('desktopRoutes').findByPk(alias.routeId);
      if (!route || route.get('schemaUid') === alias.uid) continue;
      const warnings: string[] = [];
      const changed = rewriteReferences(params, alias.uid, '__retired__', warnings);
      // Requests to schema APIs also identify their root with filterByTk / x-uid / uid.
      if (!isDeepStrictEqual(changed, params) || params.filterByTk === alias.uid || params.resourceIndex === alias.uid) {
        throw new UidError(409, 'This UID was changed in another session. Reload before saving.');
      }
    }
  }
  async create(values: any) {
    return this.locked(async (transaction) => {
      const type = values.type;
      if (!['page', 'flowPage', 'tabs'].includes(type)) throw new UidError(400, 'Invalid object type.');
      if (typeof values.title !== 'string' || !values.title.trim() || values.title.length > 255) throw new UidError(400, 'Title is required (maximum 255 characters).');
      const schemaUid = await this.available(normalizeUid(values.uid, true) || uid(), transaction);
      let parent: any;
      if (values.parentId) {
        parent = await this.model('desktopRoutes').findByPk(values.parentId, { transaction });
        if (!parent || (type === 'tabs' ? !['page', 'flowPage'].includes(parent.type) : parent.type !== 'group')) throw new UidError(400, 'Invalid parent.');
      } else if (type === 'tabs') throw new UidError(400, 'A tab requires a parent page.');
      const tabUid = type === 'tabs' ? schemaUid : await this.available(normalizeUid(values.tabUid, true) || uid(), transaction);
      if (type !== 'tabs' && tabUid === schemaUid) throw new UidError(409, 'Page and tab must use different UIDs.');
      const tabName = uid();
      const route: any = await this.db.getRepository('desktopRoutes').create({ transaction, values: {
        type, title: values.title.trim(), schemaUid, parentId: parent?.id, tabSchemaName: type === 'tabs' ? tabName : undefined,
        ...(type !== 'tabs' ? { menuSchemaUid: uid(), enableTabs: false, children: [{ type: 'tabs', schemaUid: tabUid, tabSchemaName: tabName, hidden: true }] } : {}),
      } });
      const classic = type === 'page' || (type === 'tabs' && parent.type === 'page');
      if (classic) {
        const grid = { type: 'void', name: tabName, 'x-component': 'Grid', 'x-initializer': 'page:addBlock',
          'x-uid': tabUid, 'x-async': true, properties: {} };
        const repo = this.db.getRepository('uiSchemas');
        if (type === 'tabs') await repo.insertAdjacent('beforeEnd', parent.schemaUid, grid, { transaction });
        else await repo.insert({ type: 'void', 'x-component': 'Page', 'x-uid': schemaUid, properties: { [tabName]: grid } }, { transaction });
      }
      if (type === 'tabs') await this.db.getRepository('desktopRoutes').update({ filterByTk: parent.id, values: { enableTabs: true }, transaction });
      const routes = await this.rows('desktopRoutes', transaction);
      return this.describe(routes.find((r) => String(r.id) === String(route.id)), routes);
    });
  }
}
