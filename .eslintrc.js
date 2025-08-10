module.exports = {
    extends: ['@nestjs', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    plugins: ['@typescript-eslint', 'prettier'],
    rules: {
        'prettier/prettier': [
            'error',
            {
                printWidth: 120,
                tabWidth: 4,
                useTabs: false,
                semi: true,
                singleQuote: true,
                trailingComma: 'all',
                bracketSpacing: true,
                arrowParens: 'avoid',
                endOfLine: 'lf',
                experimentalTernaries: true,
            },
        ],
        'operator-linebreak': [
            'error',
            'before',
            {
                overrides: {
                    '?': 'before',
                    ':': 'before',
                    '&&': 'before',
                    '||': 'before',
                },
            },
        ],
        '@typescript-eslint/indent': 'off',
    },
};
