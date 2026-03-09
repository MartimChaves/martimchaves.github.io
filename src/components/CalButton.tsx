import { useEffect } from 'react'
import { Box } from '@chakra-ui/react'

const CAL_LINK = 'martimchaves/30min'
const CAL_ORIGIN = 'https://cal.eu'

export default function CalButton() {
  useEffect(() => {
    // Bootstrapper copied from cal.eu embed snippet, adapted for cal.eu origin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (!w.Cal) {
      ;(function (C: any, A: string, L: string) {
        const p = (a: any, ar: any) => { a.q.push(ar) }
        const d = C.document
        C.Cal = C.Cal || function (...args: any[]) {
          const cal = C.Cal
          if (!cal.loaded) {
            cal.ns = {}
            cal.q = cal.q || []
            d.head.appendChild(d.createElement('script')).src = A
            cal.loaded = true
          }
          if (args[0] === L) {
            const api: any = (...a: any[]) => p(api, a)
            api.q = []
            typeof args[1] === 'string'
              ? ((cal.ns[args[1]] = api), p(api, args))
              : p(cal, args)
            return
          }
          p(cal, args)
        }
        C.Cal.q = C.Cal.q || []
      })(window, `${CAL_ORIGIN}/embed/embed.js`, 'init')
    }

    w.Cal('init', { origin: CAL_ORIGIN })
    w.Cal('ui', {
      theme: 'light',
      hideEventTypeDetails: false,
      layout: 'month_view',
    })
  }, [])

  return (
    <Box
      as="button"
      data-cal-link={CAL_LINK}
      data-cal-origin={CAL_ORIGIN}
      bg="brand.600"
      color="white"
      px={5}
      py={2.5}
      borderRadius="md"
      fontSize="sm"
      fontWeight="600"
      cursor="pointer"
      border="none"
      transition="background 0.15s"
      _hover={{ bg: 'brand.700' }}
    >
      Book Free Call
    </Box>
  )
}
