import globals from 'globals';

import { baseConfig } from '../../eslint.config.mjs';

export default [
    { ignores: ['dist/**'] },
    ...baseConfig,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
];
