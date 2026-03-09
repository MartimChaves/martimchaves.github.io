import { Box, Flex, Link, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  const navLink = (to: string, label: string) => {
    const isActive = location.hash === `#${to}` || (to === '/' && location.hash === '')
    return (
      <Link
        as={RouterLink}
        to={to}
        fontSize="sm"
        fontWeight="500"
        color={isActive ? 'slate.900' : 'slate.500'}
        textDecoration="none"
        letterSpacing="0.01em"
        _hover={{ color: 'slate.900', textDecoration: 'none' }}
      >
        {label}
      </Link>
    )
  }

  return (
    <Box as="header" borderBottom="1px solid" borderColor="slate.200" bg="white">
      <Flex
        maxW="760px"
        mx="auto"
        px={{ base: 5, md: 8 }}
        py={4}
        justify="space-between"
        align="center"
      >
        <Link as={RouterLink} to="/" textDecoration="none" _hover={{ textDecoration: 'none' }}>
          <Text fontWeight="700" fontSize="md" color="slate.900" letterSpacing="-0.01em">
            Martim Chaves
          </Text>
          <Text fontSize="xs" color="slate.500" fontWeight="400">
            AI Engineer & Consultant
          </Text>
        </Link>
        <Box as="nav" display="flex" gap={6}>
          {navLink('/', 'Home')}
          {navLink('/blog', 'Writing')}
        </Box>
      </Flex>
    </Box>
  )
}
