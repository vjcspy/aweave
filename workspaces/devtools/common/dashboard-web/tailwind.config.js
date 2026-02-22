/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'sans-serif'],
                mono: ['"Geist Mono"', 'monospace'],
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};
