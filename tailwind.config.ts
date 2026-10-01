/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Status semantik — meniru warna asli MagangHub */
        'status-pending':       '#2F6FED',
        'status-pending-bg':    '#E8F0FE',
        'status-done':          '#2E9E5B',
        'status-done-bg':       '#E6F6EC',
        'status-unknown':       '#8A8F98',
        'status-unknown-bg':    '#EEF0F2',

        /* Warna dasar aplikasi */
        'app-bg':               '#F7F8FA',
        'surface':              '#FFFFFF',
        'border':               '#E4E7EB',
        'text-primary':         '#1A1D23',
        'text-secondary':       '#5B6270',
        'text-muted':           '#9AA1AC',

        /* Aksen utama */
        'primary':              '#2F6FED',
        'primary-dark':         '#1E4FBB',

        /* Warning sesi expired */
        'warning':              '#E0A100',
        'warning-bg':           '#FFF4DC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:   '1rem',    /* 16px = rounded-2xl */
        badge:  '9999px',  /* rounded-full */
        button: '0.75rem', /* rounded-xl */
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};
