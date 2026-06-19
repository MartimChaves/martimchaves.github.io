import { useState } from 'react'
import { Box, Collapse, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react'
import MarkdownRenderer from './MarkdownRenderer'

interface TangentProps {
  /** Raw fenced-block body: first line is the title, the rest is markdown. */
  source: string
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Icon
      viewBox="0 0 24 24"
      boxSize={4}
      transition="transform 0.2s ease"
      transform={open ? 'rotate(90deg)' : 'rotate(0deg)'}
      aria-hidden
    >
      <path fill="currentColor" d="M9 6l6 6-6 6V6z" />
    </Icon>
  )
}

export default function Tangent({ source }: TangentProps) {
  const [open, setOpen] = useState(false)

  const bg = useColorModeValue('#eff6ff', 'rgba(37, 99, 235, 0.10)')
  const border = useColorModeValue('#bfdbfe', 'rgba(96, 165, 250, 0.30)')
  const accent = useColorModeValue('#1d4ed8', '#93c5fd')
  const hoverBg = useColorModeValue('#e0ecff', 'rgba(37, 99, 235, 0.16)')

  // First non-empty line is the title; everything after it is markdown body.
  const lines = source.replace(/\n$/, '').split('\n')
  let titleIdx = 0
  while (titleIdx < lines.length && lines[titleIdx].trim() === '') titleIdx++
  const title = (lines[titleIdx] ?? 'Tangent').trim()
  const body = lines.slice(titleIdx + 1).join('\n').trim()

  return (
    <Box
      my={6}
      borderRadius="md"
      border="1px solid"
      borderColor={border}
      bg={bg}
      overflow="hidden"
    >
      <Flex
        as="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        w="100%"
        align="center"
        gap={2}
        px={4}
        py={3}
        textAlign="left"
        color={accent}
        _hover={{ bg: hoverBg }}
        transition="background 0.15s ease"
      >
        <Chevron open={open} />
        <Text
          as="span"
          fontSize="xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="0.06em"
          opacity={0.8}
        >
          Tangent
        </Text>
        <Text as="span" fontSize="sm" fontWeight="semibold">
          {title}
        </Text>
      </Flex>

      <Collapse in={open} animateOpacity>
        <Box px={4} pb={1} pt={0} borderTop="1px solid" borderColor={border}>
          <MarkdownRenderer content={body} />
        </Box>
      </Collapse>
    </Box>
  )
}
