import { Box, Flex, Heading, Link, Tag, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ALL_POSTS } from '../utils/posts'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Blog() {
  return (
    <Box pb={8}>
      <Box mb={10}>
        <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.02em" mb={2}>
          Writing
        </Heading>
        <Text color="slate.500" fontSize="sm">
          Notes on LLMs, information retrieval, and building AI systems.
        </Text>
      </Box>
      <Box>
        {ALL_POSTS.map((post) => (
          <Box
            key={post.slug}
            py={5}
            borderBottom="1px solid"
            borderColor="slate.100"
            _last={{ borderBottom: 'none' }}
          >
            <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
              <Box flex="1" minW="0">
                <Link
                  as={RouterLink}
                  to={`/blog/${post.slug}`}
                  textDecoration="none"
                  _hover={{ textDecoration: 'none' }}
                >
                  <Text
                    fontWeight="600"
                    fontSize="md"
                    color="slate.900"
                    mb={1}
                    _hover={{ color: 'brand.600' }}
                    transition="color 0.15s"
                  >
                    {post.title}
                  </Text>
                </Link>
                {post.description && (
                  <Text fontSize="sm" color="slate.500" mb={2}>
                    {post.description}
                  </Text>
                )}
                <Flex gap={1.5} flexWrap="wrap">
                  {post.tags.map((tag) => (
                    <Tag key={tag} size="sm" bg="brand.50" color="brand.700" border="1px solid" borderColor="brand.100" fontSize="xs">
                      {tag}
                    </Tag>
                  ))}
                </Flex>
              </Box>
              <Text fontSize="xs" color="slate.400" flexShrink={0} pt={1}>
                {formatDate(post.date)}
              </Text>
            </Flex>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
