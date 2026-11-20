import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // ERP architecture v2.2 section 5: scope boundaries
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            // Features may use core, UI, metadata forms, the API client and shared libs; never another feature
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:core', 'type:ui', 'type:data', 'type:contracts', 'type:util'],
            },
            { sourceTag: 'type:core', onlyDependOnLibsWithTags: ['type:core', 'type:ui', 'type:data', 'type:contracts', 'type:util'] },
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:contracts', 'type:util'] },
            { sourceTag: 'type:data', onlyDependOnLibsWithTags: ['type:data', 'type:contracts', 'type:util'] },
            { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: ['type:contracts', 'type:util'] },
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util', 'type:contracts'] },
            // The app is the composition root: it wires the shell and lazy feature routes
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
