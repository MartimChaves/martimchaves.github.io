import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Box, Code, Divider, Heading, Image, Link, ListItem, OrderedList, Table, Tbody, Td, Text, Th, Thead, Tr, UnorderedList, useColorModeValue } from '@chakra-ui/react'
import type { Components } from 'react-markdown'
import type { CSSProperties } from 'react'

interface CodeProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const syntaxTheme = useColorModeValue(oneLight, oneDark) as Record<string, CSSProperties>
  const codeBg = useColorModeValue('#f6f8fa', '#1e293b')

  const components: Components = {
    h1: ({ children }) => (
      <Heading as="h1" size="xl" mt={8} mb={4} color="page.text" letterSpacing="-0.02em">
        {children}
      </Heading>
    ),
    h2: ({ children }) => (
      <Heading as="h2" size="lg" mt={8} mb={3} color="page.text" letterSpacing="-0.02em">
        {children}
      </Heading>
    ),
    h3: ({ children }) => (
      <Heading as="h3" size="md" mt={6} mb={3} color="page.text">
        {children}
      </Heading>
    ),
    h4: ({ children }) => (
      <Heading as="h4" size="sm" mt={4} mb={2} color="page.text">
        {children}
      </Heading>
    ),
    p: ({ children }) => (
      <Text mb={5} lineHeight="1.75" color="page.text">
        {children}
      </Text>
    ),
    a: ({ href, children }) => (
      <Link href={href} color="page.brand" isExternal={href?.startsWith('http')}>
        {children}
      </Link>
    ),
    ul: ({ children }) => (
      <UnorderedList mb={5} pl={4} spacing={1.5}>
        {children}
      </UnorderedList>
    ),
    ol: ({ children }) => (
      <OrderedList mb={5} pl={4} spacing={1.5}>
        {children}
      </OrderedList>
    ),
    li: ({ children }) => <ListItem lineHeight="1.75" color="page.text">{children}</ListItem>,
    blockquote: ({ children }) => (
      <Box
        borderLeft="3px solid"
        borderColor="page.border"
        pl={4}
        ml={0}
        my={6}
        color="page.textSecondary"
        fontStyle="italic"
      >
        {children}
      </Box>
    ),
    hr: () => <Divider my={8} borderColor="page.border" />,
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
    th: ({ children }) => <Th color="page.text">{children}</Th>,
    td: ({ children }) => <Td color="page.text">{children}</Td>,
    code: ({ inline, className, children }: CodeProps) => {
      const match = /language-(\w+)/.exec(className ?? '')
      if (!inline && (match || String(children).includes('\n'))) {
        return (
          <Box my={5} fontSize="sm" borderRadius="md" overflow="hidden" border="1px solid" borderColor="page.border">
            <SyntaxHighlighter
              style={syntaxTheme}
              language={match?.[1]}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 0,
                padding: '1rem 1.25rem',
                background: codeBg,
                fontSize: '0.875rem',
              }}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </Box>
        )
      }
      return (
        <Code
          px={1.5}
          py={0.5}
          borderRadius="sm"
          fontSize="0.875em"
          bg="page.inlineCode"
          color="page.inlineCodeText"
        >
          {children}
        </Code>
      )
    },
    pre: ({ children }) => <Box>{children}</Box>,
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
