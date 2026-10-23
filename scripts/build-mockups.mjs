import { cp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.join(root, '.mockup-build');
const apps = process.argv.slice(2).length ? process.argv.slice(2) : ['pagely', 'wavr', 'figma'];
for (const app of apps) {
  if (!['pagely', 'wavr', 'figma'].includes(app)) throw new Error(`Unknown mockup: ${app}`);
}
await mkdir(build, { recursive: true });
await cp(path.join(root, 'mockup-source/lib'), path.join(build, 'lib'), { recursive: true });
await writeFile(path.join(build, 'package.json'), await readFile(path.join(root, 'package.json')));
try { await symlink(path.join(root, 'node_modules'), path.join(build, 'node_modules')); }
catch (error) { if (error.code !== 'EEXIST') throw error; }

for (const app of apps) {
  const destination = path.join(build, 'apps', app);
  await cp(path.join(root, 'mockup-source/apps', app), destination, { recursive: true });
  await writeFile(path.join(destination, 'next.config.mjs'), `export default {
    output: 'export', trailingSlash: true, basePath: '/static/mockups/${app}',
    experimental: { cpus: 2 }, devIndicators: false
  };\n`);
  // Figma's original client component receives Next's server searchParams promise.
  // A static export reads the same stateId on the client; UI/state logic is unchanged.
  if (app === 'figma') {
    const filename = path.join(destination, 'app/page.tsx');
    let source = await readFile(filename, 'utf8');
    source = source.replace('import { use,', 'import { Suspense,');
    source = source.replace('import { createPortal }', 'import { useSearchParams } from "next/navigation";\nimport { createPortal }');
    const original = /export default function Page\(\{\s*searchParams,\s*\}: \{\s*searchParams: Promise<\{ stateId\?: string; stateid\?: string \}>;\s*\}\) \{\s*const resolvedSearchParams = use\(searchParams\);/;
    if (!original.test(source)) throw new Error('Figma query adapter no longer matches the source');
    source = source.replace(original, 'function FigmaContent() {\n  const params = useSearchParams();\n  const resolvedSearchParams = { stateId: params.get("stateId"), stateid: params.get("stateid") };');
    source += '\nexport default function Page() { return <Suspense fallback={null}><FigmaContent /></Suspense>; }\n';
    await writeFile(filename, source);
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', destination, '--webpack'], {
      cwd: destination, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${app} build exited ${code}`)));
  });
  const output = path.join(root, 'static/mockups', app);
  await rm(output, { recursive: true, force: true });
  await cp(path.join(destination, 'out'), output, { recursive: true });
  console.log(`Exported ${app} to ${path.relative(root, output)}`);
}
