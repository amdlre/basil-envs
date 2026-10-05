// Bundles the CLI entry points into plain ESM for the production image (no tsx/ts there).
import { build } from 'esbuild';

await build({
  entryPoints: {
    migrate: 'src/db/migrate.ts',
    seed: 'src/db/seed.ts',
    'create-admin': 'scripts/create-admin.ts',
    'rotate-key': 'scripts/rotate-key.ts',
    'prune-audit': 'scripts/prune-audit.ts',
  },
  outdir: 'dist/cli',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // `server-only` resolves to an empty module under the react-server condition.
  conditions: ['react-server'],
  // Native addon: resolved at runtime from the image's node_modules.
  external: ['@node-rs/argon2'],
  // Some bundled CommonJS deps call require(); provide it in ESM output.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});
