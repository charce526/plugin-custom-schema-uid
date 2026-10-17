const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const tar = require('tar');
async function main() {
  const root = path.resolve(__dirname, '..'), pkg = require('../package.json');
  // The upstream builder does not trim CRLF ignore entries.
  const ignore = path.join(root, '.npmignore');
  fs.writeFileSync(ignore, fs.readFileSync(ignore, 'utf8').replace(/\r/g, ''));
  await require('@nocobase/build/lib/tarPlugin').tarPlugin(root, () => {});
  const archive = path.resolve('storage/tar', pkg.name + '-' + pkg.version + '.tgz'), entries = [];
  let packedMetadata;
  await tar.t({ file: archive, onentry: (entry) => {
    entries.push(entry.path);
    if (entry.path === 'package.json') {
      let content = '';
      entry.on('data', (chunk) => { content += chunk; });
      entry.on('end', () => { packedMetadata = JSON.parse(content); });
    }
  } });
  assert.equal(packedMetadata?.name, pkg.name, 'Packed name does not match source');
  assert.equal(packedMetadata?.version, pkg.version, 'Packed version does not match source');
  assert.equal(packedMetadata?.['description.zh-CN'], pkg['description.zh-CN'], 'Packed description does not match source');
  assert.equal(packedMetadata?.['x-upstream']?.repository, 'https://github.com/simousa/nocobase-plugin');
  for (const file of ['package.json', 'client.js', 'client-v2.js', 'server.js', 'dist/client/index.js', 'dist/client-v2/index.js',
    'dist/server/index.js', 'dist/server/index.d.ts', 'dist/server/service.js', 'dist/shared/uid.js',
    'dist/server/collections/xzUidAliases.js', 'dist/locale/zh-CN.json', 'UPSTREAM.md', 'LICENSE', 'LICENSING.md', 'VERIFICATION.md']) {
    assert(entries.includes(file), 'Missing ' + file);
  }
  assert(!entries.some((name) => /^(storage|scripts|src|release|node_modules)\//.test(name)), 'Unexpected development files');
  assert(!entries.some((name) => /(^|\/)\.env/.test(name)), 'Unexpected environment file');
  assert(!entries.some((name) => /(^|\/)\.(?:git|github)(\/|$)|\.(?:pem|key|sqlite|db)$/i.test(name)), 'Unexpected private or repository metadata');
  assert(pkg.contributors.some((person) => typeof person === 'object' && person.name.includes('simousa')), 'Missing original author');
  assert.equal(pkg['x-upstream'].commit, 'b2a60651ca579ab2aab990877cee641e34fde561');
  const dir = path.join(root, 'release'); fs.mkdirSync(dir, { recursive: true });
  const destination = path.join(dir, 'plugin-custom-schema-uid-' + pkg.version + '.tgz');
  fs.copyFileSync(archive, destination);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
  fs.writeFileSync(destination + '.sha256', hash + '  ' + path.basename(destination) + '\n');
  console.log('Package verified:', entries.length, 'files,', fs.statSync(destination).size, 'bytes');
  console.log(destination); console.log('SHA256', hash);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
