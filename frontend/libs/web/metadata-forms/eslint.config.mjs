import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Route/query-param bindings (withComponentInputBinding) need the param name as the input alias.
      '@angular-eslint/no-input-rename': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'erp',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'erp',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    rules: {
      // Labels wrap controls rendered through @if/@switch/ng-content, which the static check cannot see.
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
];
