import { Box, Flex, Link, Text } from '@chakra-ui/react'

export default function Footer() {
  return (
    <Box as="footer" mt={20} py={8} borderTop="1px solid" borderColor="slate.200">
      <Flex
        maxW="760px"
        mx="auto"
        px={{ base: 5, md: 8 }}
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={3}
      >
        <Text fontSize="sm" color="slate.500">
          © {new Date().getFullYear()} Martim Chaves
        </Text>
        <Flex gap={5}>
          <Link href="https://github.com/MartimChaves" isExternal fontSize="sm" color="slate.500" _hover={{ color: 'slate.900' }}>
            GitHub
          </Link>
          <Link href="mailto:mgrc99@gmail.com" fontSize="sm" color="slate.500" _hover={{ color: 'slate.900' }}>
            Email
          </Link>
        </Flex>
      </Flex>
    </Box>
  )
}
