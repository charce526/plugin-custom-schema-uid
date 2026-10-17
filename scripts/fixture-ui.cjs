const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { rspack } = require('@rspack/core');
const { setup, db, cleanup } = require('./test.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'storage/fixture-ui');
async function main() {
  const service = await setup();
  const classic = await service.create({ type: 'page', title: '经典项目管理', uid: 'classic-projects', tabUid: 'classic-overview' });
  const modern = await service.create({ type: 'flowPage', title: '项目质量看板', uid: 'quality-dashboard', tabUid: 'quality-overview' });
  await service.create({ type: 'tabs', title: '质量问题', uid: 'quality-issues', parentId: modern.id });
  await service.create({ type: 'tabs', title: '进度跟踪', uid: 'classic-progress', parentId: classic.id });
  await db.getRepository('uiSchemas').insertAdjacent('beforeEnd', 'classic-progress', { 'x-uid': 'fixture-card', name: 'stable-card', 'x-component': 'CardItem', title: '已有项目区块', type: 'void', properties: {} });
  await new Promise((resolve, reject) => rspack({ mode: 'development', devtool: false, entry: path.join(__dirname, 'fixture-ui.tsx'),
    output: { path: output, filename: 'app.js' }, resolve: { extensions: ['.tsx', '.ts', '.js', '.json'] }, experiments: { css: true },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } } } }, { test: /\.css$/, type: 'css' }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:13002');
    if (url.pathname === '/__shutdown' && req.method === 'POST') {
      res.end('stopping'); setTimeout(stop, 100);
    } else if (url.pathname.startsWith('/api/')) {
      try {
        let text = ''; for await (const chunk of req) text += chunk;
        const values = text ? JSON.parse(text) : {};
        const action = url.pathname.split(':')[1];
        const handlers = { list: () => service.list(), parents: async () => (await service.rows('desktopRoutes')).filter((r) => ['page', 'flowPage', 'group'].includes(r.type)),
          preview: () => service.preview(values.routeId, values.uid, 1), execute: () => service.execute(values.id, 1, values.confirmed),
          status: () => service.status(url.searchParams.get('id'), 1), create: () => service.create(values) };
        if (!handlers[action]) throw new Error('Unsupported action');
        const data = await handlers[action](); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data }));
      } catch (error) { res.statusCode = error.status || 400; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ errors: [{ message: error.message }] })); }
    } else if (url.pathname === '/app.js' || url.pathname === '/app.css') {
      res.setHeader('content-type', url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css');
      res.end(fs.readFileSync(path.join(output, url.pathname.slice(1))));
    } else {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>UID 插件隔离验收</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');
    }
  });
  server.listen(13002, '127.0.0.1', () => console.log('UID fixture ready: http://127.0.0.1:13002'));
  const stop = () => server.close(async () => { await cleanup(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(async (error) => { console.error(error); await cleanup(); process.exitCode = 1; });
