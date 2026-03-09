import { Box, Flex, Link, Text } from '@chakra-ui/react'

export default function Footer() {
  return (
    <Box as="footer" mt={20} py={8} borderTop="1px solid" borderColor="page.border">
      <Flex
        maxW="760px"
        mx="auto"
        px={{ base: 5, md: 8 }}
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={3}
      >
        <Text fontSize="sm" color="page.textSecondary">
          © {new Date().getFullYear()} Martim Chaves
        </Text>
        <Flex gap={5}>
          <Link href="https://github.com/MartimChaves" isExternal fontSize="sm" color="page.textSecondary" _hover={{ color: 'page.text' }}>
            GitHub
          </Link>
          <Link href="mailto:martim.chaves@pm.me" fontSize="sm" color="page.textSecondary" _hover={{ color: 'page.text' }}>
            Email
          </Link>
        </Flex>
      </Flex>
    </Box>
  )
}
