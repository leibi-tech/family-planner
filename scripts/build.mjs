// Baut die App in den Ordner "docs/" – von dort zeigt GitHub Pages sie an.
// Aufruf: node scripts/build.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs');
const pub = join(root, 'public');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const stamp = new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' });
const version = `${pkg.version} (${stamp})`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'chrome90'],
  jsx: 'automatic',
  outdir: out,
  entryNames: 'app-[hash]',
  define: { 'process.env.NODE_ENV': '"production"', __APP_VERSION__: JSON.stringify(version) },
  metafile: true,
  logLevel: 'warning',
});

const files = Object.keys(result.metafile.outputs).map((p) => p.split('/').pop());
const js = files.find((f) => f.endsWith('.js'));
const css = files.find((f) => f.endsWith('.css'));

const html = readFileSync(join(pub, 'index.html'), 'utf8').replace('%JS%', js).replace('%CSS%', css);
writeFileSync(join(out, 'index.html'), html);

for (const f of readdirSync(pub)) {
  if (f === 'index.html' || f === 'sw.template.js') continue;
  cpSync(join(pub, f), join(out, f));
}
writeFileSync(join(out, '.nojekyll'), '');

const assets = ['./', './index.html', ...readdirSync(out).filter((f) => !f.startsWith('.') && f !== 'index.html' && f !== 'sw.js').map((f) => './' + f)];
const hash = createHash('sha1').update(assets.join() + version).digest('hex').slice(0, 10);
const sw = readFileSync(join(pub, 'sw.template.js'), 'utf8')
  .replaceAll('%VERSION%', hash)
  .replaceAll('%ASSETS%', JSON.stringify(assets));
writeFileSync(join(out, 'sw.js'), sw);

console.log(`Fertig: docs/  ·  Version ${version}  ·  ${files.join(', ')}`);
