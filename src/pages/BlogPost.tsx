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
        <Text mb={4} color="page.textSecondary">Post not found.</Text>
        <Link as={RouterLink} to="/blog" fontSize="sm" color="page.brand">
          ← Back to writing
        </Link>
      </Box>
    )
  }

  return (
    <Box pb={8}>
      <Box mb={8}>
        <Link as={RouterLink} to="/blog" fontSize="sm" color="page.textMuted" fontWeight="500" textDecoration="none" _hover={{ color: 'page.textSecondary', textDecoration: 'none' }}>
          ← Writing
        </Link>
      </Box>
      <Box mb={8}>
        <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" lineHeight="1.25" letterSpacing="-0.025em" mb={4} color="page.text">
          {post.title}
        </Heading>
        <Flex align="center" gap={3} flexWrap="wrap">
          <Text fontSize="sm" color="page.textMuted">
            {formatDate(post.date)}
          </Text>
          <Box w="1px" h="12px" bg="page.border" />
          <Flex gap={1.5} flexWrap="wrap">
            {post.tags.map((tag) => (
              <Tag key={tag} size="sm" bg="page.tagBg" color="page.tagColor" border="1px solid" borderColor="page.tagBorder" fontSize="xs">
                {tag}
              </Tag>
            ))}
          </Flex>
        </Flex>
      </Box>
      <MarkdownRenderer content={post.content} />
    </Box>
  )
}
