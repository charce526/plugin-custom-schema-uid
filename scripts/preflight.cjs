// Source-only checks. Never loads .env, connects to a database, or contacts a remote.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const { wrap } = require('node:module');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const sourceDirs = new Set(['src', 'scripts', '.github']);
const rootFiles = new Set(['package.json', '.gitignore', '.npmignore', '.gitattributes', '.editorconfig',
  'client.js', 'client.d.ts', 'client-v2.js', 'client-v2.d.ts', 'server.js', 'server.d.ts']);
const files = [], errors = [];
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
function visit(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (!relative && !sourceDirs.has(entry.name) && !rootFiles.has(entry.name) && !/^(?:[^.].*\.md|LICENSE(?:\..*)?|NOTICE(?:\..*)?)$/i.test(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) { errors.push(`Symbolic link is not allowed: ${name}`); continue; }
    if (entry.isDirectory()) { visit(absolute, name); continue; }
    if (!entry.isFile()) { errors.push(`Unsupported source entry: ${name}`); continue; }
    if (/(?:^|\/)(?:\.env(?:\..*)?|node_modules|storage|dist|release|coverage|\.git)(?:\/|$)|\.(?:log|pem|key|sqlite|db|png|jpe?g|tgz|zip)$/i.test(name)) {
      errors.push(`Unexpected source file: ${name}`); continue;
    }
    files.push(name);
  }
}
visit(root);
files.sort();
const checks = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['API credential', /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/],
  ['literal credential', /\b(?:password|apiKey|clientSecret|accessToken|DB_PASSWORD)\s*[:=]\s*['"][^'"\r\n]{4,}['"]/i],
  ['credential in connection URL', /\b(?:mysql|mariadb|postgres(?:ql)?|https?):\/\/[^\s/:]+:[^\s/@]+@/i],
  ['private machine path', /(?:[A-Za-z]:[\\/](?:Users|AI-Codeding)[\\/]|\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/)/i],
];
for (const name of files) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  for (const [label, regex] of checks) if (regex.test(text)) errors.push(`${label}: ${name} (value omitted)`);
  if (/^(?:src|scripts)\//.test(name) && /\.(?:tsx?|cjs|js)$/.test(name)) {
    if (/^(?:<{7}|={7}|>{7})(?: |$)/m.test(text)) errors.push(`Merge conflict marker: ${name}`);
    if (/\.(?:cjs|js)$/.test(name)) {
      try { new vm.Script(wrap(text), { filename: name }); }
      catch { errors.push(`JavaScript syntax error: ${name}`); }
    }
  }
}
for (const name of ['README.md', 'UPSTREAM.md', 'LICENSING.md', 'PUBLISHING.md', 'RELEASE_NOTES.md', 'VERIFICATION.md']) {
  if (!files.includes(name)) errors.push(`Missing publication document: ${name}`);
}
for (const name of ['README.md', 'UPSTREAM.md', 'RELEASE_NOTES.md']) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  if (name !== 'RELEASE_NOTES.md' && (!text.includes('simousa') || !text.includes('https://github.com/simousa/nocobase-plugin'))) errors.push(`Missing upstream attribution: ${name}`);
  if (/原作者\s*(?:\*\*|`)?@simo\b/.test(text)) errors.push(`Incorrect public author attribution: ${name}`);
  if (['CHANGELOG.md', 'RELEASE_NOTES.md'].includes(name) && /撰稿人|编写人|本插件由\*\*偕作BIM/.test(text)) errors.push(`Unexpected editorial attribution: ${name}`);
}
if (pkg['x-upstream']?.commit !== 'b2a60651ca579ab2aab990877cee641e34fde561' || pkg['x-upstream']?.author !== 'simousa') errors.push('Missing pinned upstream metadata');
if (pkg.homepage?.includes('github.com/simousa/') || pkg.repository?.url?.includes('github.com/simousa/')) errors.push('Upstream must not be presented as this derivative repository');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locale/en-US.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, 'src/locale/zh-CN.json'), 'utf8'));
for (const key of new Set([...Object.keys(en), ...Object.keys(zh)])) {
  if (!en[key] || !zh[key]) errors.push(`Locale key is missing or empty: ${key}`);
}
for (const name of ['.gitignore', '.npmignore']) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  for (const pattern of ['storage/', 'release/', 'node_modules/', '.env']) if (!text.includes(pattern)) errors.push(`${name} missing ${pattern}`);
}
const publicReleaseReady = Boolean(pkg.license && pkg.license !== 'UNLICENSED' &&
  files.some((name) => /^LICENSE(?:\..*)?$/i.test(name)) && pkg['x-upstream']?.licenseStatus === 'confirmed');
const report = { package: pkg.name, version: pkg.version, sourceFileCount: files.length,
  sourceChecksPassed: !errors.length, publicReleaseReady, upstream: pkg['x-upstream'],
  limitations: ['Pattern-based credential scanning cannot detect every secret.', 'Runtime tests and full build are recorded separately in VERIFICATION.md.'],
  publicReleaseBlockers: publicReleaseReady ? [] : ['Upstream permission / applicable license must be documented before public release.'], errors };
if (errors.length) { console.error(JSON.stringify(report, null, 2)); process.exitCode = 1; }
else {
  console.log(`PASS source checks: ${files.length} allowlisted files; attribution, locale parity, syntax and basic credential checks.`);
  if (!publicReleaseReady) console.log('PUBLIC RELEASE PENDING: upstream permission / applicable license. See LICENSING.md.');
  if (args.has('--export')) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parent = path.join(root, 'storage/github-ready', `${pkg.version}-${stamp}`);
    const destination = path.join(parent, 'plugin-custom-schema-uid');
    fs.mkdirSync(destination, { recursive: true });
    for (const name of files) {
      const target = path.join(destination, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, name), target);
    }
    const git = (...argv) => execFileSync('git', ['-C', destination, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'core.autocrlf', 'false');
    git('add', '.');
    git('diff', '--cached', '--check');
    const staged = git('diff', '--cached', '--name-only', '--diff-filter=A').split(/\r?\n/).sort();
    if (JSON.stringify(staged) !== JSON.stringify(files)) throw new Error('Staged files do not match the source allowlist');
    const tree = git('write-tree');
    const archive = path.join(parent, `plugin-custom-schema-uid-${pkg.version}-source.zip`);
    git('archive', '--format=zip', `--output=${archive}`, tree);
    fs.writeFileSync(archive + '.sha256', `${hash(fs.readFileSync(archive))}  ${path.basename(archive)}\n`);
    const manifest = files.map((name) => `${hash(fs.readFileSync(path.join(destination, name)))}  ${name}`).join('\n') + '\n';
    fs.writeFileSync(path.join(parent, 'SOURCE_FILES.sha256'), manifest);
    fs.writeFileSync(path.join(parent, 'preflight-report.json'), JSON.stringify({ ...report, stagedTree: tree, sourceFiles: files }, null, 2) + '\n');
    console.log('Prepared Git directory (staged, no commit or remote):', destination);
    console.log('Source archive:', archive);
    console.log('Report:', path.join(parent, 'preflight-report.json'));
  }
  if (args.has('--strict-public') && !publicReleaseReady) process.exitCode = 2;
}
