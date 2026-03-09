import { Box, Divider, Flex, Heading, Link, Tag, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ALL_POSTS } from '../utils/posts'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const RECENT_COUNT = 4

export default function Home() {
  const recentPosts = ALL_POSTS.slice(0, RECENT_COUNT)

  return (
    <Box pb={8}>
      {/* Hero */}
      <Box mb={14}>
        <Heading as="h1" fontSize={{ base: '3xl', md: '4xl' }} fontWeight="700" mb={4} lineHeight="1.15" letterSpacing="-0.03em">
          AI Engineering &<br />Consulting
        </Heading>
        <Text fontSize="lg" color="slate.600" maxW="540px" mb={6} lineHeight="1.7">
          I'm Martim Chaves — an AI engineer with a focus on LLMs, MLOps, and production ML systems.
          I help teams design, evaluate, and ship AI products that work reliably in the real world.
        </Text>
        <Flex gap={4} flexWrap="wrap">
          <Link
            href="mailto:mgrc99@gmail.com"
            bg="slate.900"
            color="white"
            px={5}
            py={2.5}
            borderRadius="md"
            fontSize="sm"
            fontWeight="600"
            textDecoration="none"
            _hover={{ bg: 'slate.700', textDecoration: 'none' }}
          >
            Get in touch
          </Link>
          <Link
            href="https://github.com/MartimChaves"
            isExternal
            border="1px solid"
            borderColor="slate.200"
            color="slate.700"
            px={5}
            py={2.5}
            borderRadius="md"
            fontSize="sm"
            fontWeight="600"
            textDecoration="none"
            _hover={{ borderColor: 'slate.400', textDecoration: 'none' }}
          >
            GitHub
          </Link>
        </Flex>
      </Box>

      <Divider borderColor="slate.200" mb={12} />

      {/* Areas of focus */}
      <Box mb={14}>
        <Text fontSize="xs" fontWeight="600" letterSpacing="0.08em" color="slate.400" textTransform="uppercase" mb={5}>
          Areas of focus
        </Text>
        <Flex gap={3} flexWrap="wrap">
          {['Large Language Models', 'Retrieval & RAG', 'LLM Evaluation', 'MLOps', 'Information Retrieval'].map((area) => (
            <Box
              key={area}
              px={3}
              py={1.5}
              bg="slate.50"
              border="1px solid"
              borderColor="slate.200"
              borderRadius="md"
              fontSize="sm"
              color="slate.700"
              fontWeight="500"
            >
              {area}
            </Box>
          ))}
        </Flex>
      </Box>

      <Divider borderColor="slate.200" mb={12} />

      {/* Recent writing */}
      <Box>
        <Flex justify="space-between" align="baseline" mb={6}>
          <Text fontSize="xs" fontWeight="600" letterSpacing="0.08em" color="slate.400" textTransform="uppercase">
            Recent writing
          </Text>
          <Link as={RouterLink} to="/blog" fontSize="sm" color="brand.600" fontWeight="500" _hover={{ textDecoration: 'underline' }}>
            View all →
          </Link>
        </Flex>
        <Box>
          {recentPosts.map((post) => (
            <Flex
              key={post.slug}
              as={RouterLink}
              to={`/blog/${post.slug}`}
              justify="space-between"
              align="baseline"
              py={4}
              borderBottom="1px solid"
              borderColor="slate.100"
              gap={4}
              textDecoration="none"
              _hover={{ '& .post-title': { color: 'brand.600' } }}
            >
              <Box flex="1" minW="0">
                <Text
                  className="post-title"
                  fontWeight="500"
                  color="slate.800"
                  fontSize="sm"
                  transition="color 0.15s"
                  noOfLines={1}
                >
                  {post.title}
                </Text>
                <Flex gap={1.5} mt={1} flexWrap="wrap">
                  {post.tags.map((tag) => (
                    <Tag key={tag} size="sm" bg="brand.50" color="brand.700" border="1px solid" borderColor="brand.100" fontSize="xs">
                      {tag}
                    </Tag>
                  ))}
                </Flex>
              </Box>
              <Text fontSize="xs" color="slate.400" flexShrink={0}>
                {formatDate(post.date)}
              </Text>
            </Flex>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
