/* Real NocoBase repositories on isolated MariaDB tables; never touches application tables. */
const assert = require('node:assert/strict');
const path = require('node:path');
if (process.env.UID_RUNTIME_ROOT) {
  const Module = require('node:module');
  const original = Module._resolveFilename;
  const runtime = path.resolve(process.env.UID_RUNTIME_ROOT, 'node_modules');
  Module._resolveFilename = function (name, parent, ...rest) {
    if (name.startsWith('@nocobase/') || name === 'sequelize') return original.call(this, path.join(runtime, name), parent, ...rest);
    return original.call(this, name, parent, ...rest);
  };
}
const { Database, MagicAttributeModel } = require('@nocobase/database');
const { ACL } = require('@nocobase/acl');
const { UidService } = require('../dist/server/service');
const { normalizeUid, rewriteReferences } = require('../dist/shared/uid');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../../.env') });
const prefix = `uid_test_${process.pid}_${Date.now()}_`;
const db = new Database({ dialect: process.env.DB_DIALECT || 'mariadb', host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306), database: process.env.DB_DATABASE,
  username: process.env.DB_USER, password: process.env.DB_PASSWORD, dialectModule: require('mariadb'), underscored: true, tablePrefix: prefix, logging: false });
const pluginBase = (name) => path.dirname(require.resolve(`@nocobase/${name}/package.json`));
const flow = pluginBase('plugin-flow-engine') + '/dist/server/';
const ui = pluginBase('plugin-ui-schema-storage') + '/dist/server/';
const definition = (filename) => require(filename).default;
let checks = 0;
const pass = (label) => { checks++; console.log('PASS', label); };
async function setup() {
  let sequence = 1000;
  require('@nocobase/database').SnowflakeIdField.setApp({ snowflakeIdGenerator: { generate: () => String(++sequence) } });
  db.registerFieldTypes({ sort: require('@nocobase/plugin-field-sort/dist/server/sort-field').SortField });
  require('@nocobase/plugin-field-sort/dist/server/sort-field').SortField.lockManager = { runExclusive: async (_key, fn) => fn() };
  db.collectionFactory.registerCollectionType(require('@nocobase/plugin-collection-tree/dist/server/tree-collection').TreeCollection, { condition: (options) => options.tree });
  db.registerModels({ MagicAttributeModel, ...require(flow + 'model'), ...require(ui + 'model') });
  db.registerRepositories({ ...require(flow + 'repository'), UiSchemaRepository: definition(ui + 'repository') });
  db.collection({ name: 'roles', autoGenId: false, fields: [{ name: 'name', type: 'string', primaryKey: true }] });
  db.collection({ name: 'users', fields: [{ name: 'name', type: 'string' }] });
  const desktop = definition(pluginBase('plugin-client') + '/dist/server/collections/desktopRoutes');
  db.collection(desktop);
  for (const file of ['flowModels', 'flowModelTreePath']) db.collection(definition(flow + 'collections/' + file));
  const schemaDef = definition(ui + 'collections/uiSchemas');
  db.collection({ ...schemaDef, fields: schemaDef.fields.filter((field) => field.type !== 'hasMany') });
  db.collection(definition(ui + 'collections/uiSchemaTreePath'));
  db.collection({ name: 'uiSchemaServerHooks', fields: [{ name: 'uid', type: 'string' }, { name: 'params', type: 'json' }] });
  db.collection({ name: 'uiButtonSchemasRoles', autoGenId: false, fields: [{ name: 'uid', type: 'string', primaryKey: true }, { name: 'roleName', type: 'string', primaryKey: true }] });
  await db.import({ directory: path.resolve(__dirname, '../dist/server/collections') });
  await db.sync();
  const service = new UidService(db); await service.initialize();
  // The same route anchor behavior as plugin-client's official afterCreate hook.
  db.on('desktopRoutes.afterCreate', async (row, options) => {
    await db.getRepository('flowModels').create({ values: { uid: row.schemaUid, name: row.schemaUid, use: 'RouteModel' }, transaction: options.transaction });
  });
  return service;
}
async function main() {
  assert.equal(normalizeUid(' project-a '), 'project-a');
  for (const value of ['', '-a', 'a b', '中文', 'a/b', 'settings', 'a'.repeat(65), 42]) assert.throws(() => normalizeUid(value));
  assert.equal(normalizeUid(undefined, true), ''); pass('shared normalization and reserved paths');
  const warnings = [];
  const refs = rewriteReferences({ uid: 'old', title: 'old', parentId: 'old', code: 'return "old"', href: '/v/admin/old/tabs/old?q=old#old', url: 'https://example.com/admin/old' }, 'old', 'new', warnings);
  assert.equal(refs.uid, 'new'); assert.equal(refs.parentId, 'new'); assert.equal(refs.title, 'old'); assert.equal(refs.code, 'return "old"');
  assert.equal(refs.href, '/v/admin/new/tabs/new?q=old#old'); assert.equal(refs.url, 'https://example.com/admin/old'); assert(warnings.length); pass('typed references, complete URL segments and manual-script warnings');
  const service = await setup();
  const M = (name) => db.getModel(name);
  const v1 = await service.create({ type: 'page', title: 'Classic page', uid: 'classic-page', tabUid: 'classic-default' });
  const v2 = await service.create({ type: 'flowPage', title: 'Modern page', uid: 'modern-page', tabUid: 'modern-default' });
  const tab = await service.create({ type: 'tabs', title: 'Modern tab', parentId: v2.id, uid: 'modern-tab' });
  const classicTab = await service.create({ type: 'tabs', title: 'Classic tab', parentId: v1.id, uid: 'classic-tab' });
  const v1schema = await db.getRepository('uiSchemas').getJsonSchema('classic-page', { includeAsyncNode: true });
  assert(JSON.stringify(v1schema).includes('classic-tab')); assert.equal(tab.version, 'V2'); assert.equal(classicTab.version, 'V1');
  pass('atomic V1/V2 page, default tab and extra tab creation using official schema repository');
  // Existing layouts, model tree, structured links, user script and role membership.
  await db.getRepository('uiSchemas').insertAdjacent('beforeEnd', 'classic-tab', { 'x-uid': 'existing-block', name: 'stable-property', type: 'void', 'x-component': 'CardItem', title: 'Block', properties: {} });
  await M('flowModels').create({ uid: 'existing-grid', name: 'grid', options: { use: 'BlockGridModel', parentId: 'modern-tab', props: { href: '/v/admin/modern-page/tabs/modern-tab', title: 'Keep this' }, stepParams: { js: { code: 'return "modern-tab"' } } } });
  await M('flowModelTreePath').create({ ancestor: 'modern-tab', descendant: 'existing-grid', depth: 1, type: 'grid', sort: 1 });
  await M('flowModelTreePath').create({ ancestor: 'modern-tab', descendant: 'modern-tab', depth: 0 });
  await M('roles').create({ name: 'reader' });
  await M('rolesDesktopRoutes').create({ roleName: 'reader', desktopRouteId: v2.id });
  await M('uiButtonSchemasRoles').create({ uid: 'classic-tab', roleName: 'reader' });
  await M('uiSchemaServerHooks').create({ uid: 'classic-tab', params: { schemaUid: 'classic-tab' } });
  const permissions = await M('rolesDesktopRoutes').findAll({ raw: true });
  const originalIds = (await service.rows('desktopRoutes')).map((r) => String(r.id));
  const p = await service.preview(tab.id, 'renamed-tab', 1);
  assert(p.warnings.length > 0); assert.equal((await M('desktopRoutes').findByPk(tab.id)).schemaUid, 'modern-tab');
  await assert.rejects(() => service.execute(p.id, 1, false));
  await assert.rejects(() => service.execute(p.id, 2, true));
  const done = await service.execute(p.id, 1, true);
  assert.equal(done.to, 'renamed-tab');
  assert.equal((await M('flowModels').findByPk('existing-grid')).get('options').parentId, 'renamed-tab');
  assert(await M('flowModels').findByPk('renamed-tab')); assert.equal(await M('flowModels').findByPk('modern-tab'), null);
  assert.equal((await M('flowModelTreePath').findOne({ where: { descendant: 'existing-grid' } })).ancestor, 'renamed-tab');
  assert.equal((await M('flowModels').findByPk('existing-grid')).get('options').stepParams.js.code, 'return "modern-tab"');
  assert.deepEqual(await M('rolesDesktopRoutes').findAll({ raw: true }), permissions);
  assert.deepEqual((await service.rows('desktopRoutes')).map((r) => String(r.id)), originalIds);
  assert.deepEqual(await service.execute(p.id, 1, true), done); pass('existing V2 tab identity, grid tree, content, permissions, confirmation and idempotent retry');
  const classicPreview = await service.preview(classicTab.id, 'renamed-classic', 1);
  await service.execute(classicPreview.id, 1, true);
  const tree = await db.getRepository('uiSchemas').getJsonSchema('classic-page', { includeAsyncNode: true });
  assert(JSON.stringify(tree).includes('existing-block')); assert(JSON.stringify(tree).includes('renamed-classic'));
  assert(await M('uiButtonSchemasRoles').findOne({ where: { uid: 'renamed-classic', roleName: 'reader' } }));
  assert.equal((await M('uiSchemaServerHooks').findOne()).uid, 'renamed-classic');
  pass('existing V1 schema tree, stable property names, blocks, schema permissions and server hooks');
  const pagePreview = await service.preview(v2.id, 'new-modern-page', 1); await service.execute(pagePreview.id, 1, true);
  assert.equal((await M('desktopRoutes').findByPk(tab.id)).schemaUid, 'renamed-tab');
  assert.deepEqual(await service.resolve(['modern-page', 'modern-tab']), {});
  assert.equal((await service.status(pagePreview.id, 1)).result.oldAddress, 'invalid');
  assert.equal(await M('desktopRoutes').count({ where: { schemaUid: 'modern-page' } }), 0);
  await assert.rejects(() => service.available('modern-page'), /retired identifier/);
  await assert.rejects(() => service.guardStale({ values: { parentId: 'modern-tab' } }), /another session/);
  pass('old page/tab URLs have no redirect mapping; retired-UID stale-write protection remains');
  await M('flowModels').update({ options: { use: 'BlockGridModel', parentId: 'renamed-tab', props: { addedAfterRename: true } } }, { where: { uid: 'existing-grid' } });
  const back = await service.preview(tab.id, 'modern-tab', 1); await service.execute(back.id, 1, true);
  assert.equal((await M('flowModels').findByPk('existing-grid')).get('options').props.addedAfterRename, true);
  assert.deepEqual(await service.resolve(['renamed-tab']), {});
  pass('rename back retains configurations added after the first rename');
  const stale = await service.preview(tab.id, 'stale-target', 1);
  await M('desktopRoutes').update({ title: 'Changed by another session' }, { where: { id: tab.id } });
  await assert.rejects(() => service.execute(stale.id, 1, true), /Configuration changed/);
  pass('preview invalidation after concurrent edits');
  const rollback = await service.preview(tab.id, 'must-rollback', 1);
  const before = await service.snapshot(); const write = service.write.bind(service);
  let calls = 0;
  service.write = async (...args) => { await write(...args); if (++calls === 2) throw new Error('injected write failure'); };
  // Ensure at least two updates participate in this rename.
  await assert.rejects(() => service.execute(rollback.id, 1, true), /injected write failure/);
  service.write = write;
  assert.deepEqual(await service.snapshot(), before);
  assert.equal((await service.status(rollback.id, 1)).status, 'preview');
  assert.equal(await M('xzUidAliases').findByPk('must-rollback'), null);
  pass('mid-transaction failure rolls back route, model, tree, aliases and audit status');
  const contested = await Promise.all([service.preview(tab.id, 'contested', 1), service.preview(v1.id, 'contested', 1)]);
  const attempts = await Promise.allSettled(contested.map((item) => service.execute(item.id, 1, true)));
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await M('desktopRoutes').count({ where: { schemaUid: 'contested' } }), 1);
  await assert.rejects(() => service.create({ type: 'page', title: 'duplicate', uid: 'contested' }));
  pass('concurrent claims yield exactly one success; duplicate creation cannot overwrite');
  const delayed = await service.preview(tab.id, 'timeout-confirmed', 1);
  let entered, release, blocked = false;
  const reached = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  service.write = async (...args) => { await write(...args); if (!blocked) { blocked = true; entered(); await gate; } };
  const executing = service.execute(delayed.id, 1, true); await reached;
  const querying = service.status(delayed.id, 1); setTimeout(release, 80);
  await executing; assert.equal((await querying).status, 'completed'); service.write = write;
  pass('status queries wait for a running transaction instead of reporting an uncommitted preview');
  await M('flowModelTreePath').create({ ancestor: 'orphan-slot', descendant: 'orphan-slot', depth: 0 });
  await assert.rejects(() => service.available('orphan-slot'), /conflicts/);
  pass('orphaned tree identifiers are reserved rather than reused');
  const actions = {}; const acl = new ACL(); let middleware;
  const Plugin = require('../dist/server').default;
  const plugin = new Plugin({ db, acl, resourceManager: { define(r) { Object.assign(actions, r.actions); }, use(fn) { middleware = fn; } } }, { name: '@xiezuo/plugin-custom-schema-uid' });
  await plugin.beforeLoad(); await plugin.load();
  assert(!await acl.allowManager.isAllowed('xzSchemaUid', 'execute', { state: { currentUser: { id: 1 }, currentRoles: ['member'] } }));
  assert(await acl.allowManager.isAllowed('xzSchemaUid', 'execute', { state: { currentUser: { id: 1 }, currentRoles: ['root'] } }));
  assert(!await acl.allowManager.isAllowed('xzSchemaUid', 'resolve', { state: {} }));
  pass('server ACL restricts management and requires authentication for alias resolution');
  const native = await db.getRepository('desktopRoutes').create({ values: { type: 'flowPage', title: 'Native', schemaUid: ' native-trimmed ' } });
  assert.equal(native.schemaUid, 'native-trimmed');
  await assert.rejects(() => db.getRepository('desktopRoutes').update({ filterByTk: native.id, values: { schemaUid: 'direct-change' } }), /UID management/);
  await assert.rejects(() => db.getRepository('desktopRoutes').create({ values: { type: 'page', schemaUid: '-invalid' } }));
  pass('native server hooks normalize input and reject invalid creation and direct UID edits');
  const invokeNative = (schemaUid) => {
    const values = { type: 'flowPage', title: 'Concurrent native', schemaUid };
    const ctx = { action: { resourceName: 'desktopRoutes', actionName: 'updateOrCreate', params: { values } },
      throw(status, message) { throw Object.assign(new Error(message), { status }); } };
    return middleware(ctx, () => db.getRepository('desktopRoutes').updateOrCreate({ filterKeys: ['schemaUid'], values }));
  };
  const nativeRace = await Promise.allSettled([invokeNative('native-contested'), invokeNative('native-contested')]);
  assert.equal(nativeRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await M('desktopRoutes').count({ where: { schemaUid: 'native-contested' } }), 1);
  pass('standard updateOrCreate requests are serialized and cannot overwrite on a concurrent duplicate');
  const groupLater = await db.getRepository('desktopRoutes').create({ values: { type: 'group', title: 'Later group', schemaUid: 'later-group', sort: 20 } });
  const groupFirst = await db.getRepository('desktopRoutes').create({ values: { type: 'group', title: 'First group', schemaUid: 'first-group', sort: 10 } });
  const nested = await db.getRepository('desktopRoutes').create({ values: { type: 'group', title: 'Nested group', schemaUid: 'nested-group', parentId: groupFirst.id, sort: 1 } });
  const child = await service.create({ type: 'page', title: 'Nested page', uid: 'nested-page', parentId: nested.id });
  const listing = await service.list();
  assert(listing.every((row) => row.id != null && row.type));
  assert(listing.findIndex((row) => String(row.id) === String(groupFirst.id)) < listing.findIndex((row) => String(row.id) === String(groupLater.id)));
  assert.equal(String(listing.find((row) => String(row.id) === String(child.id)).parentId), String(nested.id));
  assert.equal(listing.find((row) => String(row.id) === String(groupFirst.id)).version, undefined);
  pass('management rows include sorted groups and nested parents as plain records');
  await M('xzUidAliases').create({ uid: 'legacy-old-address', routeId: String(child.id) });
  assert.deepEqual(await service.resolve(['legacy-old-address', 'nested-page']), {});
  // v1.1.0 completed operations may still store redirect metadata. Never advertise it after upgrading.
  const historical = await M('xzUidOperations').findByPk(pagePreview.id);
  await historical.update({ result: { ...historical.get('result'), oldAddress: 'redirect' } });
  assert.equal((await service.status(pagePreview.id, 1)).result.oldAddress, 'invalid');
  assert.equal((await service.execute(pagePreview.id, 1, true)).oldAddress, 'invalid');
  const noWritePreview = await service.preview(child.id, 'cancelled-nested-page', 1);
  assert(noWritePreview.id);
  const unchanged = await M('desktopRoutes').findByPk(child.id);
  assert.equal(unchanged.schemaUid, 'nested-page'); assert.equal(unchanged.title, 'Nested page');
  pass('upgrade ignores historical redirect metadata; preview leaves UID and title unchanged until execution');
  console.log(`PASS: ${checks} scenario groups on real NocoBase + ${db.sequelize.getDialect()}`);
}
async function cleanup() {
  try {
    const qi = db.sequelize.getQueryInterface();
    const all = await qi.showAllTables();
    for (const item of all) {
      const name = typeof item === 'string' ? item : item.tableName;
      if (name.startsWith(prefix) && /^uid_test_\d+_\d+_/.test(name)) await qi.dropTable(name);
    }
  } finally { await db.close(); }
}
module.exports = { setup, db, cleanup };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; }).finally(cleanup);
