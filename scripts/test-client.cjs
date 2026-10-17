const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { FlowDefinition } = require('@nocobase/flow-engine/lib/FlowDefinition');
const root = path.resolve(__dirname, '../src');
function load(file, stubs = {}, globals = {}) {
  const filename = path.join(root, file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const resolver = (name) => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith('.') && name.endsWith('.json')) return JSON.parse(fs.readFileSync(path.resolve(path.dirname(filename), name), 'utf8'));
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts', stubs, globals);
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { ...globals, console, setTimeout: globals.setTimeout || setTimeout })(resolver, module, module.exports);
  return module.exports;
}
async function main() {
  let answer = 'named-tab';
  class RootPageModel { constructor() { this.context = { api: {}, t: (s) => s }; this.props = { routeId: 123 }; } }
  const { CustomSchemaUidRootPageModel } = load('client-v2/custom-schema-uid/CustomSchemaUidRootPageModel.ts', {
    '@nocobase/client-v2': { RootPageModel }, '@nocobase/utils/client': { uid: () => 'random-id' },
    '../creationDialog': { askCreationUid: async () => answer },
  });
  const page = new CustomSchemaUidRootPageModel();
  let options = await page.createPageTabModelOptions();
  assert.equal(options.uid, 'named-tab'); assert.equal(options.props.route.schemaUid, options.uid); assert.equal(options.props.route.parentId, 123);
  answer = ''; options = await page.createPageTabModelOptions(); assert.equal(options.uid, 'random-id'); assert.equal(options.uid, options.props.route.schemaUid);
  answer = null; assert.equal(await page.createPageTabModelOptions(), null);
  console.log('PASS V2 tab UID is chosen before construction, empty uses random UID, cancel creates no model');
  const { installMenuUidSupport } = load('client-v2/menuUidSupport.ts', { './creationDialog': { CreationUidInput: () => null } });
  for (const runtime of ['legacy', 'modern']) {
    const baseSchema = { title: { type: 'string' } };
    const baseSteps = { edit: { uiSchema: baseSchema }, insertBefore: { uiSchema: () => baseSchema }, insertAfter: { uiSchema: () => baseSchema }, insertInner: { uiSchema: () => baseSchema } };
    class Menu {
      static flows = { menuCreation: { key: 'menuCreation', manual: true, steps: { basic: { preset: true, uiSchema: () => baseSchema } } }, menuSettings: { key: 'menuSettings', steps: baseSteps } };
      static globalFlowRegistry = { getFlow: (key) => new FlowDefinition(this.flows[key], {}) };
      static registerFlow(flow) { this.flows[flow.key] = flow; }
      constructor() { this.routes = []; this.schemas = []; }
      getCreationMeta() { return this.meta; }
      async createMenuRoute(route) { this.routes.push(route); }
      async insertRouteSchema(schema) { this.schemas.push(schema); }
      async createMenuFromMeta(meta) {
        this.meta = meta;
        const route = { type: meta.menuType, schemaUid: 'temporary-page', children: [{ type: 'tabs', schemaUid: 'independent-tab' }] };
        await this.createMenuRoute(route, { parentId: 42 });
        if (runtime === 'legacy') await this.insertRouteSchema({ 'x-uid': 'temporary-page', properties: { tab: { 'x-uid': 'independent-tab' } } });
      }
    }
    installMenuUidSupport(Menu, (key) => key, runtime === 'legacy' ? '/admin/' : '/v/admin/');
    assert.equal(Menu.flows.menuCreation.key, 'menuCreation');
    assert.equal(Menu.flows.menuCreation.manual, true);
    // Exercise already-created core instances too: a later core registration must not undo the extension.
    const menu = new Menu();
    for (const menuType of ['page', 'flowPage']) {
      await menu.createMenuFromMeta({ menuType }, { customSchemaUid: ' named-page ' });
      assert.equal(menu.routes.at(-1).schemaUid, 'named-page');
      assert.equal(menu.routes.at(-1).children[0].schemaUid, 'independent-tab');
      if (runtime === 'legacy') assert.equal(menu.schemas.at(-1)['x-uid'], 'named-page');
      const ctx = { model: menu, api: { request: async () => { throw new Error('UID is already in use.'); } } };
      const creation = await Menu.flows.menuCreation.steps.basic.uiSchema(ctx);
      assert(creation.customSchemaUid, `${runtime} ${menuType} must have an inline UID input`);
      assert.equal(creation.customSchemaUid['x-component-props'].addressPrefix, runtime === 'legacy' ? '/admin/' : '/v/admin/');
      const form = await Menu.flows.menuSettings.steps.insertBefore.uiSchema(ctx);
      assert(form.customSchemaUid); assert(!baseSchema.customSchemaUid); assert.equal(Menu.flows.menuSettings.steps.edit.uiSchema, baseSteps.edit.uiSchema);
      assert.equal(await form.customSchemaUid['x-validator']('occupied'), 'UID is already in use.');
      assert.equal(await form.customSchemaUid['x-validator'](''), undefined);
    }
    await assert.rejects(() => menu.createMenuFromMeta({ menuType: 'page' }, { customSchemaUid: '-invalid' }));
    installMenuUidSupport(Menu, (key) => key, '/ignored/');
    await menu.createMenuFromMeta({ menuType: 'page' }, {}); assert.equal(menu.routes.at(-1).schemaUid, 'temporary-page');
    console.log(`PASS ${runtime}: inline V1/V2 UID input, official creation lifecycle, Schema consistency, insertion, no shared-form mutation and idempotent installation`);
  }
  const { buildRouteTree } = load('client-v2/routeTree.ts');
  const routes = [
    { id: 'g2', type: 'group', title: 'Second-created first-sorted' },
    { id: 'nested', parentId: 'g1', type: 'group', title: 'Nested' },
    { id: 'hidden', parentId: 'p1', type: 'tabs', hidden: true, version: 'V1' },
    { id: 'p2', parentId: 'g2', type: 'flowPage', version: 'V2' },
    { id: 'g1', type: 'group', title: 'First-created second-sorted' },
    { id: 'p1', parentId: 'nested', type: 'page', title: 'Page one', version: 'V1' },
    { id: 'tab', parentId: 'p1', type: 'tabs', title: 'Matching tab', version: 'V1' },
    { id: 'link', type: 'link', title: 'Link' },
  ];
  let tree = buildRouteTree(routes);
  assert.equal(tree.map((r) => r.id).join(','), 'g2,g1,link');
  assert.equal(tree[1].children[0].children[0].children[0].id, 'tab');
  assert.equal(buildRouteTree(routes, '', 'V2').map((r) => r.id).join(','), 'g2');
  assert.equal(buildRouteTree(routes, 'Matching')[0].children[0].children[0].children[0].id, 'tab');
  assert.equal(buildRouteTree(routes, '', 'all', true)[1].children[0].children[0].children[0].id, 'hidden');
  console.log('PASS route hierarchy: official input order, nested groups, links, ancestor-preserving search/version filters and optional hidden tabs');
  const { registerTranslations } = load('client-v2/translations.ts');
  const bundles = {}; const i18n = { language: 'zh-CN', addResourceBundle(language, ns, values) { bundles[language] = values; }, t(key, options) { return bundles[this.language][key] || options.defaultValue; } };
  const t = registerTranslations(i18n);
  assert.equal(t('Title'), '标题'); assert.equal(t('Create page or tab'), '新建页面或页签');
  assert.equal(t('records'), '条'); assert.equal(t(': '), '：');
  i18n.language = 'en-US'; assert.equal(t('Title'), 'Title');
  console.log('PASS client-side locale registration, generic-label translation, Chinese punctuation and language switching');
  const requests = [], responses = [];
  const api = { axios: { interceptors: { request: { use(fn) { requests.push(fn); } }, response: { use(fn) { responses.push(fn); } } } } };
  const runtime = load('client-v2/runtime.ts'); let prompts = 0;
  runtime.installLegacyCreation(api, async () => { prompts++; return 'classic-named'; });
  let config = await requests[0]({ url: '/desktopRoutes:create', data: { type: 'page', schemaUid: 'temporary' } });
  assert.equal(config.data.schemaUid, 'classic-named');
  config = await requests[0]({ url: '/uiSchemas:insert', data: { 'x-uid': 'temporary', properties: { tab: { 'x-uid': 'independent-tab' } } } });
  assert.equal(config.data['x-uid'], 'classic-named'); assert.equal(config.data.properties.tab['x-uid'], 'independent-tab');
  await requests[0]({ url: '/desktopRoutes:create', data: { type: 'group', schemaUid: 'group' } }); assert.equal(prompts, 1);
  console.log('PASS legacy creation maps route and schema consistently without changing descendant UIDs or groups');
  const location = { pathname: '/v/admin/old-page/tabs/old-tab/popup/keep', search: '?a=1', hash: '#keep', replace(value) { this.redirected = value; } };
  const resolver = load('client-v2/runtime.ts', {}, { location });
  await resolver.resolveCurrentAddress({ request: async () => ({ data: { data: { 'old-page': 'new-page', 'old-tab': 'new-tab' } } }) });
  assert.equal(location.redirected, '/v/admin/new-page/tabs/new-tab/popup/keep?a=1#keep');
  console.log('PASS old address resolution preserves tab, popup suffix, query string and hash');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
