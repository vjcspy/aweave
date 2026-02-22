import { baseConfig } from '../../eslint.config.mjs';

export default [
    { ignores: ['dist/**', 'src/generated/**'] },
    ...baseConfig,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
];
