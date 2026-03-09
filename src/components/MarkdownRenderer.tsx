import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Box, Code, Divider, Heading, Image, Link, ListItem, OrderedList, Table, Tbody, Td, Text, Th, Thead, Tr, UnorderedList } from '@chakra-ui/react'
import type { Components } from 'react-markdown'
import type { CSSProperties } from 'react'

interface CodeProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

const components: Components = {
  h1: ({ children }) => (
    <Heading as="h1" size="xl" mt={8} mb={4}>
      {children}
    </Heading>
  ),
  h2: ({ children }) => (
    <Heading as="h2" size="lg" mt={8} mb={3}>
      {children}
    </Heading>
  ),
  h3: ({ children }) => (
    <Heading as="h3" size="md" mt={6} mb={3}>
      {children}
    </Heading>
  ),
  h4: ({ children }) => (
    <Heading as="h4" size="sm" mt={4} mb={2}>
      {children}
    </Heading>
  ),
  p: ({ children }) => (
    <Text mb={4} lineHeight="1.7">
      {children}
    </Text>
  ),
  a: ({ href, children }) => (
    <Link href={href} color="brand.600" isExternal={href?.startsWith('http')}>
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <UnorderedList mb={4} pl={4} spacing={1}>
      {children}
    </UnorderedList>
  ),
  ol: ({ children }) => (
    <OrderedList mb={4} pl={4} spacing={1}>
      {children}
    </OrderedList>
  ),
  li: ({ children }) => <ListItem lineHeight="1.7">{children}</ListItem>,
  blockquote: ({ children }) => (
    <Box
      borderLeft="3px solid"
      borderColor="slate.200"
      pl={4}
      ml={0}
      my={6}
      color="slate.500"
      fontStyle="italic"
    >
      {children}
    </Box>
  ),
  hr: () => <Divider my={8} />,
  img: ({ src, alt }) => (
    <Image src={src} alt={alt} maxW="100%" my={4} borderRadius="md" />
  ),
  table: ({ children }) => (
    <Box overflowX="auto" my={4}>
      <Table size="sm" variant="simple">
        {children}
      </Table>
    </Box>
  ),
  thead: ({ children }) => <Thead>{children}</Thead>,
  tbody: ({ children }) => <Tbody>{children}</Tbody>,
  tr: ({ children }) => <Tr>{children}</Tr>,
  th: ({ children }) => <Th>{children}</Th>,
  td: ({ children }) => <Td>{children}</Td>,
  code: ({ inline, className, children }: CodeProps) => {
    const match = /language-(\w+)/.exec(className ?? '')
    if (!inline && match) {
      return (
        <Box my={4} fontSize="sm">
          <SyntaxHighlighter
            style={oneLight as Record<string, CSSProperties>}
            language={match[1]}
            PreTag="div"
            customStyle={{
              borderRadius: '6px',
              padding: '1rem',
              background: '#f6f8fa',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </Box>
      )
    }
    if (!inline && !match && String(children).includes('\n')) {
      return (
        <Box my={4} fontSize="sm">
          <SyntaxHighlighter
            style={oneLight as Record<string, CSSProperties>}
            PreTag="div"
            customStyle={{
              borderRadius: '6px',
              padding: '1rem',
              background: '#f6f8fa',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </Box>
      )
    }
    return (
      <Code
        px={1}
        py={0.5}
        borderRadius="sm"
        fontSize="0.875em"
        bg="slate.100"
        color="slate.800"
      >
        {children}
      </Code>
    )
  },
  pre: ({ children }) => <Box>{children}</Box>,
}

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
