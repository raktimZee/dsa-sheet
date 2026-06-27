/** AlgoSheet design system — "Terminal Dark" (IDE/terminal aesthetic).
 *  Semantic tokens are remapped to a dark GitHub/VS Code-style palette so the whole app
 *  re-themes without touching component classes. Accent = terminal green. */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0D1117',
        'on-background': '#E6EDF3',
        surface: '#0D1117',
        'on-surface': '#E6EDF3',
        'on-surface-variant': '#8B949E',
        'surface-bright': '#161B22',
        'surface-dim': '#010409',
        'surface-container-lowest': '#161B22',
        'surface-container-low': '#0F141A',
        'surface-container': '#1C2128',
        'surface-container-high': '#21262D',
        'surface-container-highest': '#30363D',
        'surface-variant': '#21262D',
        'inverse-surface': '#E6EDF3',
        'inverse-on-surface': '#0D1117',
        outline: '#6E7681',
        'outline-variant': '#30363D',

        // Accent: terminal green
        primary: '#3FB950',
        'on-primary': '#06210C',
        'surface-tint': '#2EA043',
        'primary-fixed-dim': '#2EA043',
        'primary-container': '#13351F',
        'on-primary-container': '#56D364',
        'inverse-primary': '#2EA043',

        // Secondary: terminal blue (links/alt accents)
        secondary: '#8B949E',
        'secondary-container': '#0E2A47',
        'on-secondary-container': '#58A6FF',
        tertiary: '#8B949E',
        'tertiary-container': '#21262D',
        'on-tertiary-container': '#E6EDF3',

        error: '#F85149',
        'on-error': '#0D1117',
        'error-container': '#3D1518',
        'on-error-container': '#FF7B72',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.375rem', xl: '0.5rem', full: '9999px' },
      spacing: {
        lg: '24px', md: '16px', xxl: '64px', sm: '8px', xl: '32px',
        gutter: '24px', xs: '4px', 'container-max': '1280px', base: '4px',
      },
      fontFamily: {
        // Body = IBM Plex Sans; headings/code/labels = JetBrains Mono (set in CSS base).
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        'code-snippet': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-lg': ['44px', { lineHeight: '52px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg-mobile': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'code-snippet': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'body-lg': ['17px', { lineHeight: '28px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
