/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
        dark: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        // WhatsApp Web exact color palette
        wa: {
          green: '#00a884',
          'green-dark': '#008069',
          'green-light': '#25d366',
          teal: '#005c4b',
          'teal-deep': '#00a884',
          // Light mode
          'bg': '#eae6df',
          'panel': '#ffffff',
          'panel-header': '#f0f2f5',
          'chat-bg': '#efeae2',
          'bubble-out': '#d9fdd3',
          'bubble-in': '#ffffff',
          'input-bg': '#f0f2f5',
          'hover': '#f5f6f6',
          'border': '#e9edef',
          'search': '#f0f2f5',
          // Dark mode
          'dark-bg': '#0b141a',
          'dark-panel': '#111b21',
          'dark-panel-header': '#202c33',
          'dark-chat-bg': '#0b141a',
          'dark-bubble-out': '#005c4b',
          'dark-bubble-in': '#202c33',
          'dark-input': '#2a3942',
          'dark-hover': '#202c33',
          'dark-border': '#233138',
          'dark-search': '#202c33',
          // Text
          'text-primary': '#111b21',
          'text-secondary': '#667781',
          'text-light': '#8696a0',
          'dark-text-primary': '#e9edef',
          'dark-text-secondary': '#8696a0',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        'wa': '0 1px 3px rgba(11,20,26,0.08)',
        'wa-md': '0 2px 8px rgba(11,20,26,0.12)',
        'wa-lg': '0 4px 16px rgba(11,20,26,0.16)',
      },
    },
  },
  plugins: [],
};
