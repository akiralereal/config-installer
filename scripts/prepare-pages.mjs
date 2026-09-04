import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const clientRoot = path.join(projectRoot, 'dist', 'client');
const pagesRoot = path.join(projectRoot, 'dist', 'pages');
const prefixedAssets = path.join(
  clientRoot,
  'config-installer',
  '_next',
);

await mkdir(pagesRoot, { recursive: true });

for (const filename of [
  'index.html',
  'index.rsc',
  'favicon.svg',
  'sample.mobileconfig',
]) {
  await cp(path.join(clientRoot, filename), path.join(pagesRoot, filename), {
    force: true,
  });
}

await cp(prefixedAssets, path.join(pagesRoot, '_next'), {
  force: true,
  recursive: true,
});
await writeFile(path.join(pagesRoot, '.nojekyll'), '');

for (const requiredPath of [
  'index.html',
  'favicon.svg',
  'sample.mobileconfig',
  '_next',
]) {
  await access(path.join(pagesRoot, requiredPath));
}

console.log('GitHub Pages artifact prepared at dist/pages');
