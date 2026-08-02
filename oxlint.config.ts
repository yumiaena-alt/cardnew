import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import next from 'ultracite/oxlint/next';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

export default defineConfig({
  extends: [core, react, next, vitest],
  rules: {
    'no-warning-comments': 'off', // Allow TODO and FIXME comments
    'no-inline-comments': 'off', // Allow nearby comments

    'sort-keys': 'off',
    'func-style': 'off',

    'typescript/no-unsafe-assignment': 'off', // Allow implicit `any` assignments
    'typescript/no-unsafe-call': 'off', // Allow implicit `any` calls
    'typescript/no-unsafe-member-access': 'off', // Allow member access on implicit `any` values
    'typescript/strict-boolean-expressions': 'off', // Allow non-boolean conditional checks
    'typescript/consistent-type-definitions': ['error', 'type'], // Use `type` instead of `interface`
    'typescript/no-misused-promises': 'off', // React Hook Form's handleSubmit returns a Promise-typed handler
    'typescript/strict-void-return': 'off', // Allow functions returning Promise<void> where void functions are expected
    'typescript/prefer-regexp-exec': 'off', // Allow use of String#match

    'unicorn/filename-case': 'off', // Impossible to enforce consistent filename case due to multiple conventions

    // --- JSDoc Rules ---
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-description': 'error',
  },
  overrides: [
    {
      // Ported from a previous project of ours (see docs/07-PORTED-MODULES.md).
      // The logic and its tests came across unchanged and pass as-is; only the
      // house documentation and ordering conventions differ. Rules are relaxed
      // per directory and re-enabled as each module gets integrated and
      // reviewed, so the port stays reviewable as a straight copy for now.
      files: [
        'src/lib/slidedoc/**',
        'src/lib/plan/**',
        'src/lib/renderer/**',
        'src/lib/images/**',
        'services/**',
      ],
      rules: {
        'jsdoc/require-param': 'off',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/require-returns-description': 'off',
        'no-use-before-define': 'off',
        'no-nested-ternary': 'off',
        'unicorn/no-nested-ternary': 'off',
        'no-negated-condition': 'off',
        'unicorn/no-negated-condition': 'off',
        'typescript/consistent-return': 'off',
        'default-case': 'off',
        'jsdoc/check-tag-names': 'off',
        // FNV-1a is bitwise by definition, and `Math.trunc` is not a
        // substitute for `>>> 0` — it does not coerce to unsigned 32-bit.
        'no-bitwise': 'off',
        'unicorn/prefer-math-trunc': 'off',
        'prefer-destructuring': 'off',
        'unicorn/no-array-reduce': 'off',
        'unicorn/no-array-for-each': 'off',
        'unicorn/consistent-function-scoping': 'off',
        'max-classes-per-file': 'off',
        'typescript/parameter-properties': 'off',
        'require-unicode-regexp': 'off',
        'promise/prefer-await-to-then': 'off',
        'promise/avoid-new': 'off',
        'no-empty-function': 'off',
        'require-await': 'off',
        'unicorn/no-immediate-mutation': 'off',
        // The provider contract declares these as instance methods; making one
        // static because it happens not to read state would break the interface.
        'class-methods-use-this': 'off',
        'typescript/return-await': 'off',
        'unicorn/custom-error-definition': 'off',
        'typescript/use-unknown-in-catch-callback-variable': 'off',
        'promise/prefer-await-to-callbacks': 'off',
        'no-param-reassign': 'off',
        'typescript/no-non-null-assertion': 'off',
        'vitest/no-conditional-expect': 'off',
        'vitest/max-expects': 'off',
        'vitest/prefer-describe-function-title': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
      },
    },
  ],
  options: {
    reportUnusedDisableDirectives: 'error',
  },
});
