import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
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
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
  },
  styles: {
    global: {
      body: {
        bg: '#ffffff',
        color: 'slate.800',
        fontSize: '16px',
        lineHeight: '1.7',
        WebkitFontSmoothing: 'antialiased',
      },
      a: {
        color: 'brand.600',
        textDecoration: 'none',
        _hover: {
          textDecoration: 'underline',
          color: 'brand.700',
        },
      },
      'h1, h2, h3, h4': {
        color: 'slate.900',
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
