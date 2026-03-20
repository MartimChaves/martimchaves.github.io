import { Box, Flex, Heading, Link, Tab, TabList, TabPanel, TabPanels, Tabs, Tag, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { NOTES_POSTS, PERSONAL_POSTS, TECH_POSTS } from '../utils/posts'
import type { Post } from '../utils/posts'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PostList({ posts }: { posts: Post[] }) {
  return (
    <Box>
      {posts.map((post) => (
        <Box
          key={post.slug}
          py={5}
          borderBottom="1px solid"
          borderColor="page.borderSubtle"
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
                  color="page.text"
                  mb={1}
                  _hover={{ color: 'page.brand' }}
                  transition="color 0.15s"
                >
                  {post.title}
                </Text>
              </Link>
              {post.description && (
                <Text fontSize="sm" color="page.textSecondary" mb={2}>
                  {post.description}
                </Text>
              )}
              <Flex gap={1.5} flexWrap="wrap">
                {post.tags.map((tag) => (
                  <Tag key={tag} size="sm" bg="page.tagBg" color="page.tagColor" border="1px solid" borderColor="page.tagBorder" fontSize="xs">
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </Box>
            <Text fontSize="xs" color="page.textMuted" flexShrink={0} pt={1}>
              {formatDate(post.date)}
            </Text>
          </Flex>
        </Box>
      ))}
    </Box>
  )
}

export default function Blog() {
  return (
    <Box pb={8}>
      <Box mb={8}>
        <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.02em" mb={2} color="page.text">
          Writing
        </Heading>
      </Box>
      <Tabs variant="unstyled">
        <TabList mb={8} borderBottom="1px solid" borderColor="page.border" gap={0}>
          {(['Technical', 'Notes', 'Personal'] as const).map((label) => (
            <Tab
              key={label}
              pb={3}
              px={0}
              mr={6}
              fontSize="sm"
              fontWeight="500"
              color="page.textMuted"
              borderBottom="2px solid transparent"
              _selected={{ color: 'page.text', borderBottomColor: 'page.text' }}
              _hover={{ color: 'page.textSecondary' }}
            >
              {label}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          <TabPanel p={0}>
            <Text color="page.textSecondary" fontSize="sm" mb={6}>
              Notes on LLMs, information retrieval, and building AI systems.
            </Text>
            <PostList posts={TECH_POSTS} />
          </TabPanel>
          <TabPanel p={0}>
            <Text color="page.textSecondary" fontSize="sm" mb={6}>
              Short notes on papers, tools, and ideas.
            </Text>
            <PostList posts={NOTES_POSTS} />
          </TabPanel>
          <TabPanel p={0}>
            <Text color="page.textSecondary" fontSize="sm" mb={6}>
              Thoughts on books, life, and other things.
            </Text>
            <PostList posts={PERSONAL_POSTS} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}
