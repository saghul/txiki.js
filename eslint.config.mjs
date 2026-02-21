import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
    {
        ignores: [
            'build/**',
            'deps/**',
            'docs/**',
            'types/api/**',
            'examples/**',
            'tests/**',
            'src/bundles/**',
            'website/**',
        ],
    },
    js.configs.recommended,
    {
        plugins: {
            '@stylistic': stylistic,
            'import-x': importX,
        },
        languageOptions: {
            ecmaVersion: 2025,
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'arrow-body-style': [
                'error',
                'as-needed',
                { requireReturnForObjectLiteral: true },
            ],
            'curly': 'error',
            'eqeqeq': 'error',
            'no-nested-ternary': 'error',
            'no-unused-private-class-members': 'off',
            'no-unused-vars': [ 'error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                destructuredArrayIgnorePattern: '^_',
            } ],

            '@stylistic/array-bracket-spacing': [
                'error',
                'always',
                { objectsInArrays: true },
            ],
            '@stylistic/arrow-parens': [ 'error', 'as-needed' ],
            '@stylistic/block-spacing': [ 'error', 'always' ],
            '@stylistic/brace-style': 'error',
            '@stylistic/indent': [
                'error',
                4,
                { SwitchCase: 1 },
            ],
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/max-len': [ 'error', 120 ],
            '@stylistic/no-mixed-spaces-and-tabs': 'error',
            '@stylistic/no-multiple-empty-lines': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': [ 'error', 'always' ],
            '@stylistic/padded-blocks': [ 'error', 'never' ],
            '@stylistic/padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: [ 'const', 'let', 'var' ], next: '*' },
                { blankLine: 'any', prev: [ 'const', 'let', 'var' ], next: [ 'const', 'let', 'var' ] },
                { blankLine: 'always', prev: '*', next: 'return' },
                { blankLine: 'always', prev: '*', next: 'block-like' },
                { blankLine: 'always', prev: 'block-like', next: '*' },
            ],
            '@stylistic/quotes': [ 'error', 'single' ],
            '@stylistic/semi': [ 'error', 'always' ],
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/spaced-comment': 'error',

            'import-x/no-duplicates': 'error',
            'import-x/order': [ 'error', {
                alphabetize: {
                    order: 'asc',
                },
                groups: [ [ 'builtin', 'external' ], 'parent', 'sibling', 'index' ],
                'newlines-between': 'always',
            } ],
        },
    },
];
