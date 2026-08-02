import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    'src/types/I18n.ts',
    // Referenced only as a command string in `playwright.config.ts`.
    'scripts/e2e-server.mjs',
    // Ported layout engine (docs/07-PORTED-MODULES.md). Its consumers — typeset,
    // templates, the renderer — arrive in the next stage, so most exports read
    // as unused until then. Remove these two entries once that lands.
    'src/lib/slidedoc/**',
    'src/lib/deckplan/**',
    'src/lib/renderer/**',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@clerk/shared',
    // Agreed form stack (docs/02-ARCHITECTURE.md §폼). Wired up when the first
    // real form ships; the boilerplate counter form that used them is gone.
    'react-hook-form',
    '@hookform/resolvers',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
  ],
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['tests/**/*.@(integ|e2e).ts'],
  },
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/gu)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
