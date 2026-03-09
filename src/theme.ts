import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  fonts: {
    body: '"Inter", system-ui, -apple-system, sans-serif',
    heading: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace',
  },
  colors: {
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    brand: {
      50: '#eff6ff',
      100: '#dbeafe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
  },
  semanticTokens: {
    colors: {
      'page.bg': { default: 'white', _dark: 'slate.900' },
      'page.surface': { default: 'slate.50', _dark: 'slate.800' },
      'page.border': { default: 'slate.200', _dark: 'slate.700' },
      'page.borderSubtle': { default: 'slate.100', _dark: 'slate.800' },
      'page.text': { default: 'slate.900', _dark: 'slate.100' },
      'page.textSecondary': { default: 'slate.500', _dark: 'slate.400' },
      'page.textMuted': { default: 'slate.400', _dark: 'slate.600' },
      'page.brand': { default: 'brand.600', _dark: 'brand.400' },
      'page.brandHover': { default: 'brand.700', _dark: 'brand.300' },
      'page.tagBg': { default: 'brand.50', _dark: 'slate.700' },
      'page.tagColor': { default: 'brand.700', _dark: 'brand.300' },
      'page.tagBorder': { default: 'brand.100', _dark: 'slate.600' },
      'page.inlineCode': { default: 'slate.100', _dark: 'slate.700' },
      'page.inlineCodeText': { default: 'slate.800', _dark: 'slate.200' },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'page.bg',
        color: 'page.text',
        fontSize: '16px',
        lineHeight: '1.7',
        WebkitFontSmoothing: 'antialiased',
      },
      a: {
        color: 'page.brand',
        textDecoration: 'none',
        _hover: {
          textDecoration: 'underline',
          color: 'page.brandHover',
        },
      },
      'h1, h2, h3, h4': {
        color: 'page.text',
        letterSpacing: '-0.02em',
      },
      pre: {
        overflowX: 'auto',
      },
    },
  },
  components: {
    Container: {
      baseStyle: {
        maxW: '760px',
        px: { base: 5, md: 8 },
      },
    },
  },
})

export default theme
