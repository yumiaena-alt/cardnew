// Web server entry point for Playwright: applies pending migrations, then boots
// Next against the PGlite instance that pglite-server just started.
//
// This exists because pglite-server spawns its `--run` command without a shell —
// it splits the string on whitespace and calls `spawn` directly. That rules out
// `&&` chaining and any npm-based runner (`run-s`, `npm run`), because Windows
// resolves those to `npm.cmd`, which needs a shell. One Node entry point works
// the same way on every platform.
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const NEXT_BIN = 'node_modules/next/dist/bin/next';
const DOTENV_BIN = 'node_modules/dotenv-cli/cli.js';
const DRIZZLE_BIN = 'node_modules/drizzle-kit/bin.cjs';

/**
 * Runs a Node entry point to completion.
 *
 * @param {string[]} args - Arguments passed to the Node binary.
 * @returns {Promise<void>} Resolves on exit code 0.
 */
async function runNode(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  // `once` rejects if the child emits `error`, so a spawn failure surfaces too.
  const [code] = await once(child, 'close');

  if (code !== 0) {
    throw new Error(`${args[0]} exited with code ${code}`);
  }
}

await runNode([DOTENV_BIN, '-c', '--', 'node', DRIZZLE_BIN, 'migrate']);

// CI serves the prebuilt output; locally there is no build step before the run.
await runNode([NEXT_BIN, process.env.CI ? 'start' : 'dev']);
