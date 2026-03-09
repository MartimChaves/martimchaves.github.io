import { Box, Flex, Heading, Link, Tag, Text } from '@chakra-ui/react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getPostBySlug } from '../utils/posts'
import MarkdownRenderer from '../components/MarkdownRenderer'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) {
    return (
      <Box pb={8}>
        <Text mb={4} color="slate.600">Post not found.</Text>
        <Link as={RouterLink} to="/blog" fontSize="sm" color="brand.600">
          ← Back to writing
        </Link>
      </Box>
    )
  }

  return (
    <Box pb={8}>
      <Box mb={8}>
        <Link as={RouterLink} to="/blog" fontSize="sm" color="slate.400" fontWeight="500" textDecoration="none" _hover={{ color: 'slate.700', textDecoration: 'none' }}>
          ← Writing
        </Link>
      </Box>
      <Box mb={8}>
        <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" lineHeight="1.25" letterSpacing="-0.025em" mb={4}>
          {post.title}
        </Heading>
        <Flex align="center" gap={3} flexWrap="wrap">
          <Text fontSize="sm" color="slate.400">
            {formatDate(post.date)}
          </Text>
          <Box w="1px" h="12px" bg="slate.200" />
          <Flex gap={1.5} flexWrap="wrap">
            {post.tags.map((tag) => (
              <Tag key={tag} size="sm" bg="brand.50" color="brand.700" border="1px solid" borderColor="brand.100" fontSize="xs">
                {tag}
              </Tag>
            ))}
          </Flex>
        </Flex>
      </Box>
      <Box
        sx={{
          'p': { color: 'slate.700', fontSize: '16px', lineHeight: '1.75', mb: 5 },
          'h2': { mt: 10, mb: 4, fontSize: '20px', fontWeight: '600', color: 'slate.900', letterSpacing: '-0.02em' },
          'h3': { mt: 8, mb: 3, fontSize: '17px', fontWeight: '600', color: 'slate.900' },
          'h4': { mt: 6, mb: 2, fontSize: '15px', fontWeight: '600', color: 'slate.900' },
          'ul, ol': { pl: 5, mb: 5, color: 'slate.700' },
          'li': { mb: 1.5, lineHeight: '1.75' },
          'blockquote': { borderLeft: '3px solid', borderColor: 'slate.200', pl: 4, ml: 0, my: 6, color: 'slate.500', fontStyle: 'italic' },
          'hr': { borderColor: 'slate.200', my: 8 },
        }}
      >
        <MarkdownRenderer content={post.content} />
      </Box>
    </Box>
  )
}
