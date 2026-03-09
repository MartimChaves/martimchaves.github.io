import { Box } from '@chakra-ui/react'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg="page.bg">
      <Header />
      <Box as="main" flex="1" maxW="760px" mx="auto" px={{ base: 5, md: 8 }} w="100%" pt={12} pb={8}>
        {children}
      </Box>
      <Footer />
    </Box>
  )
}
