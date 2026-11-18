/**
 * build-game-engine.mjs — bundles the MatrixEngine shell
 * (src/games-engine/shell.js, KAPLAY inlined) into the static file the
 * game pages load: public/games/engine/matrix-engine.js
 *
 * Runs as part of `npm run build` (see package.json) so the committed
 * bundle never drifts from the shell source. KAPLAY is MIT licensed;
 * its full licence text ships in the kaplay npm package.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(root, 'src/games-engine/shell.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2019'],
  minify: true,
  legalComments: 'none',
  banner: {
    js: '/* MatrixEngine — Matrix Hub arcade shell (KAPLAY engine, MIT). Source: src/games-engine/shell.js */'
  },
  outfile: join(root, 'public/games/engine/matrix-engine.js')
});

console.log('✔ MatrixEngine bundle → public/games/engine/matrix-engine.js');
