import { useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'

interface Subject {
  id: string
  dose: number
  age: number
  y: number
}

function createSubjects(count: number): Subject[] {
  let seed = 20260720
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  return Array.from({ length: count }, (_, index) => {
    const age = Math.round(20 + random() * 55)
    const expectedDose =
      1.2 + ((age - 20) / 55) * 2.6
    const dose =
      Math.round(Math.max(0.5, Math.min(6, expectedDose + (random() - 0.5) * 3)) * 10) / 10
    const z = 0.3 + 0.65 * (dose - 3) - 0.045 * (age - 45)
    const probability = sigmoid(z)
    const id =
      index < 26
        ? String.fromCharCode(65 + index)
        : `A${String.fromCharCode(65 + index - 26)}`

    return { id, dose, age, y: random() < probability ? 1 : 0 }
  })
}

const SUBJECTS = createSubjects(30)

const MAX_STEPS = 20

function sigmoid(z: number): number {
  if (z > 500) return 1
  if (z < -500) return 0
  return 1 / (1 + Math.exp(-z))
}

function crossEntropy(y: number, yHat: number): number {
  const c = Math.max(1e-7, Math.min(1 - 1e-7, yHat))
  return -(y * Math.log(c) + (1 - y) * Math.log(1 - c))
}

interface SubjectResult {
  subjectIdx: number
  prediction: number
  loss: number
}

interface StepResult {
  step: number
  averageLoss: number
  subjectResults: SubjectResult[]
}

export default function ParameterTuner() {
  const [a, setA] = useState('0')
  const [b1, setB1] = useState('0')
  const [b2, setB2] = useState('0')
  const [steps, setSteps] = useState<StepResult[]>([])
  const [subjectCount, setSubjectCount] = useState(2)
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0)
  const activeSubjects = SUBJECTS.slice(0, subjectCount)

  const num = (s: string) => {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : 0
  }

  const handleProceed = () => {
    if (steps.length >= MAX_STEPS) return
    const subjectResults = activeSubjects.map((sub, subjectIdx) => {
      const z = num(a) + num(b1) * sub.dose + num(b2) * sub.age
      const prediction = sigmoid(z)
      return {
        subjectIdx,
        prediction,
        loss: crossEntropy(sub.y, prediction),
      }
    })
    const averageLoss =
      subjectResults.reduce((sum, result) => sum + result.loss, 0) /
      activeSubjects.length

    setSteps((previous) => [
      ...previous,
      {
        step: previous.length + 1,
        averageLoss,
        subjectResults,
      },
    ])
    setCurrentSubjectIdx((index) => (index + 1) % activeSubjects.length)
  }

  const handleRemoveSubject = () => {
    const nextSubjectCount = Math.max(2, subjectCount - 1)
    setSubjectCount(nextSubjectCount)
    setCurrentSubjectIdx((index) =>
      Math.min(index, nextSubjectCount - 1),
    )
  }

  const handleReset = () => {
    setSteps([])
    setA('0')
    setB1('0')
    setB2('0')
    setSubjectCount(2)
    setCurrentSubjectIdx(0)
  }

  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const highlightBg = useColorModeValue('#ebf8ff', '#1a365d')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')
  const textColor = useColorModeValue('#1a202c', '#e2e8f0')
  const lineColor = useColorModeValue('#c0392b', '#ff6b6b')

  const latestStep = steps[steps.length - 1]
  const getResult = (idx: number) =>
    latestStep?.subjectResults.find((result) => result.subjectIdx === idx)

  const exampleSub = activeSubjects[currentSubjectIdx] ?? activeSubjects[0]
  const aVal = num(a)
  const b1Val = num(b1)
  const b2Val = num(b2)
  const exampleZ = aVal + b1Val * exampleSub.dose + b2Val * exampleSub.age
  const examplePrediction = sigmoid(exampleZ)
  const exampleLoss = crossEntropy(exampleSub.y, examplePrediction)
  const formatValue = (value: number) =>
    Number.isInteger(value)
      ? value.toString()
      : parseFloat(value.toFixed(4)).toString()
  const signedCoefficient = (value: number) =>
    `${value >= 0 ? '+' : '−'} ${formatValue(Math.abs(value))}`

  // Average-loss history chart
  const W = 520
  const H = 190
  const pL = 52
  const pR = 18
  const pT = 16
  const pB = 38
  const plotW = W - pL - pR
  const plotH = H - pT - pB
  const maxY =
    steps.length > 0
      ? Math.ceil(Math.max(...steps.map((step) => step.averageLoss), 0.1) * 10) /
        10
      : 1
  const pointX = (index: number) =>
    steps.length === 1
      ? pL + plotW / 2
      : pL + (index / (steps.length - 1)) * plotW
  const pointY = (loss: number) => pT + plotH - (loss / maxY) * plotH
  const linePoints = steps
    .map((step, index) => `${pointX(index)},${pointY(step.averageLoss)}`)
    .join(' ')

  return (
    <Box
      my={6}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
      bg={bg}
      overflow="hidden"
    >
      <Box overflowX="auto" overflowY="auto" maxH="480px">
        <Table size="sm" variant="simple">
          <Thead position="sticky" top={0} zIndex={1} bg={bg}>
            <Tr>
              <Th color={textColor} px={3} />
              <Th color={textColor} textAlign="center" px={3}>
                Dose
              </Th>
              <Th color={textColor} textAlign="center" px={3}>
                Age
              </Th>
              <Th color={textColor} textAlign="center" px={3}>
                Label (y)
              </Th>
              <Th color={textColor} textAlign="center" px={3}>
                Prediction (ŷ)
              </Th>
              <Th color={textColor} textAlign="center" px={3}>
                Loss
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {activeSubjects.map((sub, idx) => {
              const result = getResult(idx)
              const isExample = idx === currentSubjectIdx
              return (
                <Tr key={sub.id} bg={isExample ? highlightBg : undefined}>
                  <Td
                    px={3}
                    color={textColor}
                    whiteSpace="nowrap"
                    fontWeight={isExample ? 'bold' : 'normal'}
                  >
                    {isExample ? '→ ' : ' '}
                    {sub.id}
                  </Td>
                  <Td textAlign="center" px={3} color={textColor}>
                    {sub.dose} mg
                  </Td>
                  <Td textAlign="center" px={3} color={textColor}>
                    {sub.age}
                  </Td>
                  <Td textAlign="center" px={3} color={textColor}>
                    {sub.y}
                  </Td>
                  <Td textAlign="center" px={3} fontFamily="mono" color={textColor}>
                    {result ? result.prediction.toFixed(4) : '—'}
                  </Td>
                  <Td
                    textAlign="center"
                    px={3}
                    fontFamily="mono"
                    color={textColor}
                    fontWeight={result ? lossFontWeight(result.loss) : 'normal'}
                  >
                    {result ? result.loss.toFixed(4) : '—'}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Box>

      <Flex justify="flex-end" gap={2} px={3} py={2} borderTop="1px solid" borderColor={borderColor}>
        <Button
          size="xs"
          variant="outline"
          minW="28px"
          h="28px"
          borderRadius="full"
          fontSize="lg"
          lineHeight="1"
          onClick={handleRemoveSubject}
          isDisabled={subjectCount <= 2}
          aria-label="Remove last subject"
          title="Remove last subject"
        >
          −
        </Button>
        <Button
          size="xs"
          variant="outline"
          minW="28px"
          h="28px"
          borderRadius="full"
          fontSize="lg"
          lineHeight="1"
          onClick={() =>
            setSubjectCount((count) => Math.min(count + 1, SUBJECTS.length))
          }
          isDisabled={subjectCount >= SUBJECTS.length}
          aria-label="Add another subject"
          title="Add another subject"
        >
          +
        </Button>
      </Flex>

      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Text fontSize="xs" color={labelColor} mb={2}>
          Edit the parameters directly in the formula:
        </Text>
        <Box overflowX="auto" pb={2} mb={2}>
          <Flex
            role="group"
            aria-label="Editable logistic regression formula"
            align="center"
            justify={{ base: 'flex-start', md: 'center' }}
            minW="650px"
            color={textColor}
            fontFamily="KaTeX_Main, Times New Roman, serif"
            fontSize={{ base: 'xl', md: '2xl' }}
            lineHeight="1"
          >
            <Text as="span" fontStyle="italic" mr={3}>
              ŷ =
            </Text>
            <Flex direction="column" align="stretch" textAlign="center">
              <Text as="span" py={1}>
                1
              </Text>
              <Box borderTop="1.5px solid currentColor" pt={3} px={2}>
                <Flex align="center" gap={1} whiteSpace="nowrap">
                  <Text as="span">1 + e</Text>
                  <Flex
                    as="span"
                    align="center"
                    gap={1}
                    fontSize="md"
                    transform="translateY(-0.65em)"
                    ml={-1}
                  >
                    <Text as="span">−(</Text>
                    <Text as="label" htmlFor="parameter-a" fontStyle="italic">
                      a=
                    </Text>
                    <Input
                      id="parameter-a"
                      value={a}
                      onChange={(e) => {
                        setA(e.target.value)
                      }}
                      size="sm"
                      w="58px"
                      h="28px"
                      px={1}
                      bg={bg}
                      fontFamily="inherit"
                      fontSize="md"
                      textAlign="center"
                      aria-label="Parameter a"
                    />
                    <Text as="span">+</Text>
                    <Text as="label" htmlFor="parameter-b1" fontStyle="italic">
                      b₁=
                    </Text>
                    <Input
                      id="parameter-b1"
                      value={b1}
                      onChange={(e) => {
                        setB1(e.target.value)
                      }}
                      size="sm"
                      w="58px"
                      h="28px"
                      px={1}
                      bg={bg}
                      fontFamily="inherit"
                      fontSize="md"
                      textAlign="center"
                      aria-label="Parameter b1"
                    />
                    <Text as="span">· dose +</Text>
                    <Text as="label" htmlFor="parameter-b2" fontStyle="italic">
                      b₂=
                    </Text>
                    <Input
                      id="parameter-b2"
                      value={b2}
                      onChange={(e) => {
                        setB2(e.target.value)
                      }}
                      size="sm"
                      w="58px"
                      h="28px"
                      px={1}
                      bg={bg}
                      fontFamily="inherit"
                      fontSize="md"
                      textAlign="center"
                      aria-label="Parameter b2"
                    />
                    <Text as="span">· age)</Text>
                  </Flex>
                </Flex>
              </Box>
            </Flex>
          </Flex>
        </Box>

        <Text fontSize="xs" color={labelColor} mb={2}>
          Substituting subject <Text as="span" fontWeight="bold" color={textColor}>{exampleSub.id}</Text> (dose{' '}
          <Text as="span" fontWeight="bold" color={textColor}>{exampleSub.dose} mg</Text>, age{' '}
          <Text as="span" fontWeight="bold" color={textColor}>{exampleSub.age}</Text>):
        </Text>
        <Box overflowX="auto" pb={3} mb={1}>
          <Flex
            role="img"
            aria-label={`Therefore, ${examplePrediction.toFixed(4)} equals one divided by one plus e to the negative quantity ${formatValue(aVal)} ${signedCoefficient(b1Val)} times ${exampleSub.dose} ${signedCoefficient(b2Val)} times ${exampleSub.age}`}
            aria-live="polite"
            align="center"
            justify={{ base: 'flex-start', md: 'center' }}
            minW="560px"
            color={textColor}
            fontFamily="KaTeX_Main, Times New Roman, serif"
            fontSize={{ base: 'lg', md: 'xl' }}
            lineHeight="1"
          >
            <Text as="span" fontSize="3xl" mr={4} aria-hidden="true">
              ⇔
            </Text>
            <Text as="span" fontWeight="semibold" mr={3} aria-hidden="true">
              {examplePrediction.toFixed(4)} =
            </Text>
            <Flex
              direction="column"
              align="stretch"
              textAlign="center"
              aria-hidden="true"
            >
              <Text as="span" py={1}>
                1
              </Text>
              <Box borderTop="1.5px solid currentColor" pt={2} px={2}>
                <Flex align="center" whiteSpace="nowrap">
                  <Text as="span">1 + e</Text>
                  <Text
                    as="span"
                    fontSize="sm"
                    transform="translateY(-0.65em)"
                    ml={-0.5}
                  >
                    −({formatValue(aVal)} {signedCoefficient(b1Val)} ·{' '}
                    {exampleSub.dose} {signedCoefficient(b2Val)} ·{' '}
                    {exampleSub.age})
                  </Text>
                </Flex>
              </Box>
            </Flex>
          </Flex>
        </Box>

        <Flex
          justify={{ base: 'flex-start', md: 'center' }}
          gap={5}
          flexWrap="wrap"
          mb={3}
          fontSize="sm"
          color={textColor}
          aria-live="polite"
        >
          <Text>label = <strong>{exampleSub.y}</strong></Text>
          <Text>prediction = <strong>{examplePrediction.toFixed(4)}</strong></Text>
          <Text>loss = <strong>{exampleLoss.toFixed(4)}</strong></Text>
        </Flex>


        <Flex gap={2} flexWrap="wrap">
          <Button
            size="sm"
            colorScheme="blue"
            onClick={handleProceed}
            isDisabled={steps.length >= MAX_STEPS}
          >
            Proceed
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </Flex>
        <Text fontSize="xs" color={labelColor} mt={2}>
          Proceed evaluates all {activeSubjects.length} subjects.
        </Text>
        <Text fontSize="xs" color={labelColor}>
          Step={Math.min(steps.length + 1, MAX_STEPS)}
        </Text>
      </Box>

      {steps.length > 0 && (
        <Box borderTop="1px solid" borderColor={borderColor} p={4}>
          <Text fontSize="xs" color={labelColor} mb={2}>
            Average loss by step
          </Text>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ maxWidth: `${W}px`, display: 'block' }}
          >
            <line
              x1={pL}
              x2={pL}
              y1={pT}
              y2={pT + plotH}
              stroke={borderColor}
              strokeWidth={1}
            />
            <line
              x1={pL}
              x2={pL + plotW}
              y1={pT + plotH}
              y2={pT + plotH}
              stroke={borderColor}
              strokeWidth={1}
            />
            {[0, maxY / 2, maxY].map((v) => {
              const yPos = pT + plotH - (v / maxY) * plotH
              return (
                <g key={v}>
                  <line
                    x1={pL - 3}
                    x2={pL}
                    y1={yPos}
                    y2={yPos}
                    stroke={labelColor}
                    strokeWidth={1}
                  />
                  <text
                    x={pL - 6}
                    y={yPos + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill={labelColor}
                  >
                    {v.toFixed(1)}
                  </text>
                </g>
              )
            })}
            {steps.length > 1 && (
              <polyline
                points={linePoints}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {steps.map((step, index) => {
              const x = pointX(index)
              const y = pointY(step.averageLoss)
              return (
                <g key={step.step}>
                  <circle cx={x} cy={y} r={4} fill={lineColor}>
                    <title>
                      Step {step.step}: {step.averageLoss.toFixed(4)}
                    </title>
                  </circle>
                  <text
                    x={x}
                    y={pT + plotH + 15}
                    textAnchor="middle"
                    fontSize="9"
                    fill={labelColor}
                  >
                    {step.step}
                  </text>
                </g>
              )
            })}
            <text
              x={pL + plotW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fill={labelColor}
            >
              Step
            </text>
            <text
              x={12}
              y={pT + plotH / 2}
              textAnchor="middle"
              fontSize="10"
              fill={labelColor}
              transform={`rotate(-90 12 ${pT + plotH / 2})`}
            >
              Average loss
            </text>
          </svg>
        </Box>
      )}
    </Box>
  )
}

function lossFontWeight(loss: number): number {
  const cappedLoss = Math.min(Math.max(loss, 0), 3)
  const weight = 400 + (cappedLoss / 3) * 400
  return Math.round(weight / 100) * 100
}
