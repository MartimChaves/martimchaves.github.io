import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'

// --- BM25 -------------------------------------------------------------------
// A small, transparent BM25 so readers can watch the score move. Each line of
// the corpus is one "chunk" (document). We tokenize the same way the post does
// (lowercase, split on word characters), compute an IDF per term over the whole
// corpus, then score every chunk against the query.

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
}

interface TermStat {
  term: string
  df: number // chunks containing the term
  idf: number
}

interface TermContribution {
  term: string
  tf: number // occurrences in this chunk
  df: number
  idf: number
  contribution: number
}

interface ChunkScore {
  id: number
  text: string
  length: number
  score: number
  terms: TermContribution[]
}

interface Bm25Result {
  chunks: ChunkScore[] // ranked, best first
  avgLen: number
  numChunks: number
  termStats: TermStat[]
}

function computeBm25(
  corpusText: string,
  query: string,
  k1: number,
  b: number,
): Bm25Result {
  const docs = corpusText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text, id) => ({ id, text, tokens: tokenize(text) }))

  const N = docs.length
  const avgLen = N === 0 ? 0 : docs.reduce((s, d) => s + d.tokens.length, 0) / N

  // Unique query terms — each word counts once.
  const queryTerms = Array.from(new Set(tokenize(query)))

  // Document frequency + IDF for each query term.
  const termStats: TermStat[] = queryTerms.map((term) => {
    const df = docs.filter((d) => d.tokens.includes(term)).length
    // Smoothed Okapi IDF: always positive, rarer terms score higher.
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    return { term, df, idf }
  })
  const idfByTerm = new Map(termStats.map((t) => [t.term, t]))

  const chunks: ChunkScore[] = docs.map((d) => {
    const len = d.tokens.length
    const norm = 1 - b + b * (avgLen === 0 ? 0 : len / avgLen)
    const terms: TermContribution[] = queryTerms.map((term) => {
      const tf = d.tokens.filter((t) => t === term).length
      const stat = idfByTerm.get(term)!
      const contribution =
        tf === 0 ? 0 : stat.idf * ((tf * (k1 + 1)) / (tf + k1 * norm))
      return { term, tf, df: stat.df, idf: stat.idf, contribution }
    })
    const score = terms.reduce((s, t) => s + t.contribution, 0)
    return { id: d.id, text: d.text, length: len, score, terms }
  })

  chunks.sort((a, b2) => b2.score - a.score)
  return { chunks, avgLen, numChunks: N, termStats }
}

// --- UI ---------------------------------------------------------------------

interface ParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  labelColor: string
  accent: string
}

function ParamSlider({ label, value, min, max, step, onChange, labelColor, accent }: ParamSliderProps) {
  return (
    <Box flex="1">
      <Flex justify="space-between" align="baseline" mb={1}>
        <Text fontSize="xs" color={labelColor}>
          {label}
        </Text>
        <Text fontSize="xs" fontWeight="semibold" color={accent} fontFamily="mono">
          {value.toFixed(2)}
        </Text>
      </Flex>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} focusThumbOnChange={false}>
        <SliderTrack>
          <SliderFilledTrack bg={accent} />
        </SliderTrack>
        <SliderThumb boxSize={4} />
      </Slider>
    </Box>
  )
}

const DEFAULT_CORPUS = [
  'Sinkhole collapse and earth movement are excluded from coverage.',
  'Coverage C protects personal property against fire and theft.',
  'We will pay reasonable expenses to remove debris after a covered loss.',
  'Earthquake and volcanic eruption are common types of earth movement.',
  'The liability coverage limit is shown on the policy declarations.',
].join('\n')

const DEFAULT_QUERY = 'sinkhole earth movement'
const DEFAULT_K1 = 1.5
const DEFAULT_B = 0.75

// The score bars use a "sticky" axis: it only rescales when the top score
// leaves a comfortable band. Otherwise, normalising the bars to the current top
// score every render pins the top bar at 100% and makes the *other* bars appear
// to move even when their own score didn't change. With a sticky axis, nudging
// a knob moves each bar by that chunk's actual score change.
const AXIS_HEADROOM = 1.25 // after a rescale the axis sits 25% above the top score
const AXIS_SHRINK_AT = 0.5 // rescale down once the top score drops below half the axis

function nextAxisMax(prev: number, top: number): number {
  if (top <= 0) return prev // nothing to show — keep the axis where it is
  if (prev <= 0) return top * AXIS_HEADROOM
  if (top > prev) return top * AXIS_HEADROOM // overflowed the axis — grow
  if (top < prev * AXIS_SHRINK_AT) return top * AXIS_HEADROOM // shrank too far — recenter
  return prev // still comfortable — leave it alone
}

export default function Bm25Explorer() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [corpus, setCorpus] = useState(DEFAULT_CORPUS)
  const [k1, setK1] = useState(DEFAULT_K1)
  const [b, setB] = useState(DEFAULT_B)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')
  const accent = useColorModeValue('#2b6cb0', '#63b3ed')
  const inputBg = useColorModeValue('#fff', '#0f172a')
  const highlightBg = useColorModeValue('#e0ecff', 'rgba(37, 99, 235, 0.18)')
  const rowBg = useColorModeValue('#fff', '#111827')
  const mutedText = useColorModeValue('#64748b', '#94a3b8')
  const textColor = useColorModeValue('#1a202c', '#e2e8f0')

  const result = useMemo(() => computeBm25(corpus, query, k1, b), [corpus, query, k1, b])

  // Which chunk's breakdown to show: the selected one if it still exists, else
  // the current top-ranked chunk.
  const selected =
    result.chunks.find((c) => c.id === selectedId) ?? result.chunks[0] ?? null

  // Sticky bar axis (see nextAxisMax). Seeded from the default view so the first
  // paint already has a stable axis, then nudged only when the top score leaves
  // the band.
  const topScore = result.chunks.length ? result.chunks[0].score : 0
  const [axisMax, setAxisMax] = useState(() => {
    const init = computeBm25(DEFAULT_CORPUS, DEFAULT_QUERY, DEFAULT_K1, DEFAULT_B)
    return (init.chunks[0]?.score ?? 1) * AXIS_HEADROOM
  })
  useEffect(() => {
    setAxisMax((prev) => nextAxisMax(prev, topScore))
  }, [topScore])
  const axis = axisMax > 0 ? axisMax : Math.max(topScore, 1e-9)

  return (
    <Box my={6} borderRadius="md" border="1px solid" borderColor={borderColor} bg={bg} overflow="hidden">
      {/* Inputs */}
      <Box p={4}>
        <Text fontSize="xs" color={labelColor} mb={1}>
          Query
        </Text>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          bg={inputBg}
          borderColor={borderColor}
          color={textColor}
          fontSize="sm"
          rows={1}
          minH="2.4rem"
          mb={3}
        />
        <Text fontSize="xs" color={labelColor} mb={1}>
          Corpus — one chunk per line
        </Text>
        <Textarea
          value={corpus}
          onChange={(e) => setCorpus(e.target.value)}
          bg={inputBg}
          borderColor={borderColor}
          color={textColor}
          fontSize="sm"
          fontFamily="mono"
          rows={5}
        />
      </Box>

      {/* Sliders */}
      <Box borderTop="1px solid" borderColor={borderColor} px={4} py={3}>
        <Flex direction={{ base: 'column', sm: 'row' }} gap={5} align="center">
          <ParamSlider
            label="k1 — term-frequency saturation"
            value={k1}
            min={0}
            max={3}
            step={0.05}
            onChange={setK1}
            labelColor={labelColor}
            accent={accent}
          />
          <ParamSlider
            label="b — length normalisation"
            value={b}
            min={0}
            max={1}
            step={0.05}
            onChange={setB}
            labelColor={labelColor}
            accent={accent}
          />
        </Flex>
        <Text fontSize="xs" color={mutedText} mt={2}>
          {result.numChunks} chunks · average length {result.avgLen.toFixed(1)} tokens
        </Text>
      </Box>

      {/* Ranked chunks */}
      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Flex justify="space-between" align="baseline" mb={2} gap={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Chunks ranked by BM25 score{' '}
            <Text as="span" fontWeight="normal" color={mutedText}>
              (click one to see the breakdown)
            </Text>
          </Text>
          <Text fontSize="xs" color={mutedText} fontFamily="mono">
            bar axis 0–{axis.toFixed(2)}
          </Text>
        </Flex>
        <Flex direction="column" gap={1.5}>
          {result.chunks.map((c) => {
            const isSel = selected?.id === c.id
            return (
              <Box
                key={c.id}
                as="button"
                type="button"
                onClick={() => setSelectedId(c.id)}
                textAlign="left"
                borderRadius="md"
                border="1px solid"
                borderColor={isSel ? accent : borderColor}
                bg={isSel ? highlightBg : rowBg}
                px={3}
                py={2}
              >
                <Flex align="center" gap={3}>
                  <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color={accent} minW="3.2rem">
                    {c.score.toFixed(3)}
                  </Text>
                  {/* score bar — scaled to the sticky axis, not the top score */}
                  <Box flex="1" minW="60px" h="6px" bg={borderColor} borderRadius="full" overflow="hidden">
                    <Box h="100%" w={`${Math.min(100, Math.max(0, (c.score / axis) * 100))}%`} bg={accent} />
                  </Box>
                </Flex>
                <Text fontSize="sm" color={textColor} mt={1} noOfLines={1}>
                  {c.text}
                </Text>
              </Box>
            )
          })}
        </Flex>
      </Box>

      {/* Per-term breakdown for the selected chunk */}
      {selected && (
        <Box borderTop="1px solid" borderColor={borderColor} p={4}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor} mb={2}>
            Score breakdown · {selected.length} tokens
          </Text>
          <Box overflowX="auto">
            <Box as="table" w="100%" fontSize="sm" fontFamily="mono" style={{ borderCollapse: 'collapse' }}>
              <Box as="thead">
                <Box as="tr" color={mutedText}>
                  {['term', 'tf', 'chunks w/ term', 'IDF', 'contribution'].map((h) => (
                    <Box as="th" key={h} textAlign={h === 'term' ? 'left' : 'right'} py={1} px={2} fontWeight="semibold">
                      {h}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {selected.terms.map((t) => (
                  <Box as="tr" key={t.term} color={textColor} opacity={t.tf === 0 ? 0.45 : 1}>
                    <Box as="td" textAlign="left" py={1} px={2}>
                      {t.term}
                    </Box>
                    <Box as="td" textAlign="right" py={1} px={2}>
                      {t.tf}
                    </Box>
                    <Box as="td" textAlign="right" py={1} px={2}>
                      {t.df}/{result.numChunks}
                    </Box>
                    <Box as="td" textAlign="right" py={1} px={2}>
                      {t.idf.toFixed(2)}
                    </Box>
                    <Box as="td" textAlign="right" py={1} px={2} fontWeight={t.contribution > 0 ? 'bold' : 'normal'}>
                      {t.contribution.toFixed(3)}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box as="tfoot">
                <Box as="tr" color={accent} fontWeight="bold" borderTop="1px solid" borderColor={borderColor}>
                  <Box as="td" py={1.5} px={2} colSpan={4} textAlign="left">
                    total
                  </Box>
                  <Box as="td" py={1.5} px={2} textAlign="right">
                    {selected.score.toFixed(3)}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
          <Text fontSize="xs" color={mutedText} mt={2}>
            Terms absent from this chunk (tf = 0) contribute nothing. Push <b>k1</b> up to reward repeated
            terms more; push <b>b</b> up to punish long chunks harder.
          </Text>
        </Box>
      )}
    </Box>
  )
}
