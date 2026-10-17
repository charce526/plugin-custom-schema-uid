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
  const { rewriteReferences } = load('shared/uid.ts');
  assert.equal(rewriteReferences({ customSchemaUid: 'old' }, 'old', 'new').customSchemaUid, 'new');
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
  let nextChange = null, changeCalls = [], reloads = [];
  const state = []; let cursor = 0;
  const fakeReact = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const editEntry = load('client-v2/PageUidEditorEntry.tsx', {
    react: { __esModule: true, default: fakeReact, useEffect: (effect) => { effect(); }, useState: (initial) => {
      const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } },
    antd: { Alert: 'Alert', Button: 'Button', Form: { Item: 'FormItem' }, Input: 'Input', Modal: 'Modal', Space: 'Space', Typography: { Text: 'Text' } },
    '@ant-design/icons': { EditOutlined: 'EditOutlined' },
    './uidChange': { requestUidChange: (options) => {
      changeCalls.push(options);
      return new Promise((resolve) => options.showConfirmation({ title: 'Confirm UID change', okText: 'Confirm UID change', content: 'Confirmation content',
        onCancel: () => resolve(null), onOk: async () => resolve(await nextChange) }));
    }, reloadChangedPage: (result) => reloads.push(result) },
  }, { window: { getComputedStyle: (element) => ({ zIndex: element.zIndex }) } });
  // Exercise the real schema compiler used before opening the native edit dialog.
  // Runtime context contains proxies, cycles and lazily evaluated services; it must stay outside schema data.
  let contextReads = 0;
  const guardedContext = { model: { getRoute: () => ({ id: 91, schemaUid: 'guarded-page' }) } };
  Object.defineProperty(guardedContext, 'api', { enumerable: true, get() {
    contextReads++; throw new Error('Schema traversed the runtime context');
  } });
  guardedContext.self = guardedContext;
  const guardedField = editEntry.pageUidEditorField(guardedContext, (key) => key, '/admin/');
  assert.doesNotThrow(() => JSON.stringify(guardedField));
  const { compileUiSchema } = load(path.relative(root, path.resolve('node_modules/@nocobase/flow-engine/src/utils/schema-utils.ts')), {
    '../flowContext': {}, './setupRuntimeContextSteps': {},
  });
  const schema = compileUiSchema({ t: (key) => key }, { type: 'object', properties: {
    customSchemaUid: guardedField, title: { type: 'string', title: "{{t('Title')}}" },
  } });
  const { Schema } = require('@formily/json-schema');
  const compiledField = new Schema(schema).properties.customSchemaUid;
  assert.equal(compiledField['x-component'], editEntry.PageUidEditor);
  assert.equal(compiledField['x-component-props'].getContext(), guardedContext);
  assert.equal(contextReads, 0);
  console.log('PASS native edit schema compilation never serializes or traverses runtime context, including cycles and lazy services');
  const elements = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children || []).flatMap(elements)];
  const { installMenuUidSupport } = load('client-v2/menuUidSupport.ts', {
    './creationDialog': { CreationUidInput: () => null }, './PageUidEditorEntry': editEntry,
    './uidChange': { requestUidChange: async (options) => { changeCalls.push(options); return nextChange; }, reloadChangedPage: (result) => reloads.push(result) },
  });
  for (const runtime of ['legacy', 'modern']) {
    const baseSchema = { title: { type: 'string' } };
    const saveTitle = () => 'title-saved';
    const baseSteps = { edit: { uiSchema: baseSchema, beforeParamsSave: saveTitle }, insertBefore: { uiSchema: () => baseSchema }, insertAfter: { uiSchema: () => baseSchema }, insertInner: { uiSchema: () => baseSchema } };
    class Menu {
      static flows = { menuCreation: { key: 'menuCreation', manual: true, steps: { basic: { preset: true, uiSchema: () => baseSchema } } }, menuSettings: { key: 'menuSettings', steps: baseSteps } };
      static globalFlowRegistry = { getFlow: (key) => new FlowDefinition(this.flows[key], {}) };
      static registerFlow(flow) { this.flows[flow.key] = flow; }
      constructor() { this.routes = []; this.schemas = []; }
      getCreationMeta() { return this.meta; }
      getRoute() { return this.route; }
      setProps(props) { this.route = props.route; }
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
      assert(form.customSchemaUid); assert(!baseSchema.customSchemaUid);
      assert.equal(await Menu.flows.menuSettings.steps.edit.beforeParamsSave({ model: menu }, {}), 'title-saved');
      assert.equal(await form.customSchemaUid['x-validator']('occupied'), 'UID is already in use.');
      assert.equal(await form.customSchemaUid['x-validator'](''), undefined);
    }
    menu.meta = undefined;
    let dialogConfig, contentProps, nativeOpen = false, dialogCount = 0;
    const nativeView = { Header: 'NativeHeader', Footer: 'NativeFooter',
      async close(_result, force) { if (!force && this.beforeClose?.() === false) return false; nativeOpen = false; return true; } };
    const editContext = { model: menu, api: {}, viewer: { dialog(config) {
      dialogCount++; nativeOpen = true; dialogConfig = config;
      contentProps = config.content(nativeView).props;
      return nativeView;
    }, getNextZIndex: () => 1003 } };
    for (const type of ['page', 'flowPage']) {
      menu.route = { id: 42, type, schemaUid: 'existing-page' };
      const editForm = await Menu.flows.menuSettings.steps.edit.uiSchema(editContext);
      assert.equal(editForm.customSchemaUid.type, 'string');
      assert.equal(editForm.customSchemaUid['x-component'], editEntry.PageUidEditor);
      assert.equal((await Menu.flows.menuSettings.steps.edit.defaultParams(editContext)).customSchemaUid, 'existing-page');
      assert.equal(editForm.title, baseSchema.title); assert(!baseSchema.customSchemaUid);
      state.length = 0;
      let ui = elements(editEntry.PageUidEditor(editForm.customSchemaUid['x-component-props']));
      assert.equal(ui.find((node) => node.type === 'Text').props.copyable.text, 'existing-page');
      assert(!ui.find((node) => node.type === 'Modal'));
      const previousDialogCount = dialogCount;
      ui.find((node) => node.type === 'Button').props.onClick({ currentTarget: { closest: () => ({ querySelector: () => ({ zIndex: '5000' }) }) } });
      assert.equal(dialogCount, previousDialogCount + 1);
      assert.equal(nativeOpen, true);
      assert.equal(dialogConfig.zIndex, 5100, 'Actual parent is 5000 even when viewer reports 1003');
      const render = () => { cursor = 0; return elements(editEntry.UidEditDialog(contentProps)); };
      ui = render();
      assert(ui.find((node) => node.type === 'NativeFooter'));
      ui.find((node) => node.type === 'Input').props.onChange({ target: { value: 'new-uid' } });
      nextChange = null;
      const pendingSave = render().find((node) => node.type === 'Button' && node.props.type === 'primary').props.onClick();
      ui = render();
      assert.equal(dialogCount, previousDialogCount + 1, 'Confirmation must reuse the same native window');
      assert.equal(ui.find((node) => node.type === 'NativeHeader').props.title, 'Confirm UID change');
      assert.equal(ui.find((node) => node.type === 'Button' && node.props.type === 'primary').props.loading, false);
      assert(!ui.find((node) => node.type === 'Input'));
      assert.equal(await nativeView.close(), false, 'External close must not discard a pending confirmation');
      ui.find((node) => node.type === 'Button' && node.props.type !== 'primary').props.onClick(); await pendingSave;
      assert.equal(menu.route.schemaUid, 'existing-page');
      ui = render(); assert.equal(nativeOpen, true);
      assert(!ui.find((node) => node.type === 'Alert'), 'Cancellation must not become an error alert');
      assert.equal(ui.find((node) => node.type === 'Input').props.value, 'new-uid');
      assert.equal(await Menu.flows.menuSettings.steps.edit.beforeParamsSave(editContext, { title: 'New title' }), 'title-saved');
      nextChange = { from: 'existing-page', to: 'new-uid' };
      const confirmedSave = ui.find((node) => node.type === 'Button' && node.props.type === 'primary').props.onClick();
      await render().find((node) => node.type === 'Button' && node.props.type === 'primary').props.onClick(); await confirmedSave;
      assert.equal(menu.route.schemaUid, 'new-uid');
      assert.equal(nativeOpen, false);
      assert.equal(changeCalls.at(-1).routeValues, undefined);
      assert.equal(changeCalls.at(-1).modern, runtime === 'modern');
    }
    for (const type of ['group', 'link']) {
      menu.route = { id: 42, type };
      assert(!(await Menu.flows.menuSettings.steps.edit.uiSchema(editContext)).customSchemaUid);
    }
    menu.meta = { menuType: 'page' }; menu.route = { id: 42, type: 'page' };
    assert(!(await Menu.flows.menuSettings.steps.edit.uiSchema(editContext)).customSchemaUid);
    await assert.rejects(() => menu.createMenuFromMeta({ menuType: 'page' }, { customSchemaUid: '-invalid' }));
    installMenuUidSupport(Menu, (key) => key, '/ignored/');
    await menu.createMenuFromMeta({ menuType: 'page' }, {}); assert.equal(menu.routes.at(-1).schemaUid, 'temporary-page');
    console.log(`PASS ${runtime}: read-only UID with copy/edit controls, native viewer mounts above the actual 5000 parent layer; input and confirmation reuse one native window, cancellation preserves draft without error, normal save and creation preserved`);
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
  assert.equal(t('Save cancelled.'), '已取消保存。'); assert.equal(t(': '), '：');
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
  const noRedirect = load('client-v2/runtime.ts', {}, { location });
  noRedirect.installRuntime({ request() { throw new Error('Must not resolve historical URLs'); } }, () => {});
  assert.equal(location.redirected, undefined);
  console.log('PASS runtime never requests alias resolution or redirects historical URLs');
  for (const scenario of ['confirm', 'cancel', 'validation-error', 'response-lost', 'embedded-confirm', 'embedded-cancel']) {
    const calls = [], dialogs = [], notices = []; let staticDialogs = 0;
    let shown;
    const visible = new Promise((resolve) => { shown = resolve; });
    const controller = load('client-v2/uidChange.tsx', {
      antd: { message: { info: (text) => notices.push(text) }, Alert: 'div', Space: 'div', Typography: { Text: 'span' }, Modal: { confirm(options) {
        staticDialogs++; dialogs.push(options); shown(options);
        return { update(patch) { Object.assign(options, patch); } };
      } } },
    });
    const api = { request: async (config) => {
      const action = config.url.split(':')[1]; calls.push(action);
      assert.equal(config.timeout, undefined, 'Use the host request configuration without a plugin timeout');
      if (action === 'preview') return { data: { data: { id: 'op', from: 'old', to: 'new', newPath: '/v/admin/new', route: { title: 'Page' }, counts: {}, warnings: [] } } };
      if (action === 'execute' && scenario === 'validation-error') throw { response: { status: 409, data: { errors: [{ message: 'Configuration changed.' }] } } };
      if (action === 'execute' && scenario === 'response-lost') throw new Error('network response lost');
      return { data: { data: action === 'status' ? { status: 'completed', result: { to: 'new' } } : { to: 'new' } } };
    } };
    const result = controller.requestUidChange({ api, routeId: 1, uid: 'new', t: (s) => s, zIndex: 3701,
      ...(scenario.startsWith('embedded-') ? { showConfirmation: (options) => {
        dialogs.push(options); shown(options);
        return { update(patch) { Object.assign(options, patch); } };
      } } : {}) });
    const dialog = await visible;
    assert.equal(dialog.zIndex, 3701);
    assert.equal(calls.join(','), 'preview'); assert.equal(dialogs.length, 1);
    if (['cancel', 'embedded-cancel'].includes(scenario)) { dialog.onCancel(); assert.equal(await result, null); assert.equal(calls.join(','), 'preview'); assert.equal(notices.join(','), 'Save cancelled.'); }
    else if (scenario === 'validation-error') {
      await assert.rejects(dialog.onOk); assert.equal(dialogs.length, 1);
      dialog.onCancel(); assert.equal(await result, null);
    } else if (scenario === 'response-lost') {
      await assert.rejects(dialog.onOk); assert.equal(dialog.cancelButtonProps.disabled, true);
      assert.equal(dialog.okText, 'Query execution status');
      await dialog.onOk(); assert.equal((await result).to, 'new');
      assert.equal(calls.join(','), 'preview,execute,status');
    } else { await dialog.onOk(); assert.equal((await result).to, 'new'); }
    assert.equal(dialogs.length, 1);
    assert.equal(staticDialogs, scenario.startsWith('embedded-') ? 0 : 1);
  }
  console.log('PASS confirmation: cancellation releases loading, host timeout settings preserved, lost responses query status without duplicate execution');
  const successReload = load('client-v2/uidChange.tsx', {
  }, { location, setTimeout: (fn) => fn() });
  successReload.reloadChangedPage({ from: 'old-page', to: 'new-page' });
  assert.equal(location.redirected, '/v/admin/new-page/tabs/old-tab/popup/keep?a=1#keep');
  console.log('PASS only the successful editing session reloads its new address with suffix/query/hash preserved');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
