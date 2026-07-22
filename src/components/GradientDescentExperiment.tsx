import { useEffect, useMemo, useState } from 'react'
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
  label: number
}

interface SubjectResult {
  prediction: number
  loss: number
  error: number
}

interface Evaluation {
  averageLoss: number
  gradientA: number
  gradientB1: number
  gradientB2: number
  subjectResults: SubjectResult[]
}

interface ExperimentStep {
  step: number
  a: number
  b1: number
  b2: number
  evaluation: Evaluation
}

const SUBJECTS: Subject[] = [
  { id: 'A', dose: 3.2, age: 38, label: 1 },
  { id: 'B', dose: 3.9, age: 69, label: 1 },
  { id: 'C', dose: 3.0, age: 73, label: 0 },
  { id: 'D', dose: 1.1, age: 43, label: 0 },
  { id: 'E', dose: 2.0, age: 55, label: 0 },
]

const MAX_STEPS = 30
const STEP_DURATION_MS = 800

function sigmoid(score: number): number {
  if (score >= 0) {
    const exponential = Math.exp(-score)
    return 1 / (1 + exponential)
  }
  const exponential = Math.exp(score)
  return exponential / (1 + exponential)
}

function crossEntropy(label: number, prediction: number): number {
  const safePrediction = Math.min(Math.max(prediction, 1e-12), 1 - 1e-12)
  return -(
    label * Math.log(safePrediction) +
    (1 - label) * Math.log(1 - safePrediction)
  )
}

function evaluate(a: number, b1: number, b2: number): Evaluation {
  let gradientA = 0
  let gradientB1 = 0
  let gradientB2 = 0
  let totalLoss = 0

  const subjectResults = SUBJECTS.map((subject) => {
    const score = a + b1 * subject.dose + b2 * subject.age
    const prediction = sigmoid(score)
    const error = prediction - subject.label
    const loss = crossEntropy(subject.label, prediction)

    gradientA += error
    gradientB1 += error * subject.dose
    gradientB2 += error * subject.age
    totalLoss += loss

    return { prediction, loss, error }
  })

  return {
    averageLoss: totalLoss / SUBJECTS.length,
    gradientA: gradientA / SUBJECTS.length,
    gradientB1: gradientB1 / SUBJECTS.length,
    gradientB2: gradientB2 / SUBJECTS.length,
    subjectResults,
  }
}

function buildTimeline(
  startingA: number,
  startingB1: number,
  startingB2: number,
  learningRate: number,
  updates: number,
): ExperimentStep[] {
  const timeline: ExperimentStep[] = []
  let a = startingA
  let b1 = startingB1
  let b2 = startingB2

  for (let step = 0; step <= updates; step += 1) {
    const evaluation = evaluate(a, b1, b2)
    timeline.push({ step, a, b1, b2, evaluation })

    a -= learningRate * evaluation.gradientA
    b1 -= learningRate * evaluation.gradientB1
    b2 -= learningRate * evaluation.gradientB2
  }

  return timeline
}

function boundedNumber(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function formatParameter(value: number): string {
  const rounded = Math.abs(value) < 0.00005 ? 0 : value
  return rounded.toFixed(4)
}

function formatContribution(value: number, first: boolean): string {
  const sign = value < 0 ? '−' : first ? '' : '+'
  return `${first ? sign : ` ${sign} `}${Math.abs(value).toFixed(3)}`
}

function formatSum(values: number[]): string {
  return values.map((value, index) => formatContribution(value, index === 0)).join('')
}

function formatProducts(errors: number[], feature: 'dose' | 'age'): string {
  return errors
    .map((error, index) => {
      const featureValue = SUBJECTS[index][feature]
      const sign = error < 0 ? '−' : index === 0 ? '' : '+'
      const prefix = index === 0 ? sign : ` ${sign} `
      return `${prefix}${Math.abs(error).toFixed(3)}·${featureValue}`
    })
    .join('')
}

function lossFontWeight(loss: number): number {
  const cappedLoss = Math.min(Math.max(loss, 0), 3)
  return Math.round((400 + (cappedLoss / 3) * 400) / 100) * 100
}

export default function GradientDescentExperiment() {
  const [startingA, setStartingA] = useState('0')
  const [startingB1, setStartingB1] = useState('0')
  const [startingB2, setStartingB2] = useState('0')
  const [learningRate, setLearningRate] = useState('0.002')
  const [numberOfSteps, setNumberOfSteps] = useState('30')
  const [currentStep, setCurrentStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  const bg = useColorModeValue('#fafafa', '#1a202c')
  const panelBg = useColorModeValue('#ffffff', '#111827')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const highlightBg = useColorModeValue('#fff7ed', 'rgba(154, 52, 18, 0.18)')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')
  const textColor = useColorModeValue('#1a202c', '#e2e8f0')
  const lineColor = useColorModeValue('#2563eb', '#60a5fa')

  const configuredA = boundedNumber(startingA, 0, -10, 10)
  const configuredB1 = boundedNumber(startingB1, 0, -10, 10)
  const configuredB2 = boundedNumber(startingB2, 0, -10, 10)
  const configuredRate = boundedNumber(learningRate, 0.002, 0, 1)
  const configuredUpdates = Math.round(
    boundedNumber(numberOfSteps, MAX_STEPS, 1, MAX_STEPS),
  )

  const timeline = useMemo(
    () =>
      buildTimeline(
        configuredA,
        configuredB1,
        configuredB2,
        configuredRate,
        configuredUpdates,
      ),
    [configuredA, configuredB1, configuredB2, configuredRate, configuredUpdates],
  )
  const displayedStep = Math.min(currentStep, configuredUpdates)
  const current = timeline[displayedStep]
  const next = timeline[Math.min(displayedStep + 1, configuredUpdates)]

  useEffect(() => {
    if (!playing) return undefined
    if (currentStep >= configuredUpdates) {
      setPlaying(false)
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setCurrentStep((step) => Math.min(step + 1, configuredUpdates))
    }, STEP_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [playing, currentStep, configuredUpdates])

  const restartProgress = () => {
    setPlaying(false)
    setCurrentStep(0)
  }

  const reset = () => {
    setPlaying(false)
    setCurrentStep(0)
  }

  const togglePlaying = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (currentStep < configuredUpdates) setPlaying(true)
  }

  const worstSubjectIndex = current.evaluation.subjectResults.reduce(
    (worst, result, index, results) =>
      result.loss > results[worst].loss ? index : worst,
    0,
  )
  const errors = current.evaluation.subjectResults.map((result) => result.error)

  const W = 540
  const H = 210
  const pL = 54
  const pR = 18
  const pT = 16
  const pB = 38
  const plotW = W - pL - pR
  const plotH = H - pT - pB
  const losses = timeline.map((step) => step.evaluation.averageLoss)
  const observedMinLoss = Math.min(...losses)
  const observedMaxLoss = Math.max(...losses)
  const observedLossRange = observedMaxLoss - observedMinLoss
  const lossPadding = Math.max(observedLossRange * 0.12, observedMaxLoss * 0.02, 0.005)
  const chartMinLoss = Math.max(0, observedMinLoss - lossPadding)
  const chartMaxLoss = observedMaxLoss + lossPadding
  const chartLossRange = Math.max(chartMaxLoss - chartMinLoss, 1e-9)
  const lossTicks = [chartMinLoss, chartMinLoss + chartLossRange / 2, chartMaxLoss]
  const pointX = (step: number) => pL + (step / Math.max(configuredUpdates, 1)) * plotW
  const pointY = (loss: number) => pT + ((chartMaxLoss - loss) / chartLossRange) * plotH
  const linePoints = timeline
    .map((step) => `${pointX(step.step)},${pointY(step.evaluation.averageLoss)}`)
    .join(' ')
  const stepTicks = Array.from(
    new Set([0, Math.round(configuredUpdates / 2), configuredUpdates]),
  )

  return (
    <Box
      my={6}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
      bg={bg}
      overflow="hidden"
    >
      <Box p={4}>
        <Text mt={0} mb={3} fontSize="sm" fontWeight="semibold" color={textColor}>
          Choose the experiment settings
        </Text>
        <Flex gap={3} flexWrap="wrap" align="flex-end">
          {[
            { id: 'gd-a', label: 'Starting a', value: startingA, setValue: setStartingA },
            { id: 'gd-b1', label: 'Starting b₁', value: startingB1, setValue: setStartingB1 },
            { id: 'gd-b2', label: 'Starting b₂', value: startingB2, setValue: setStartingB2 },
          ].map((field) => (
            <Box key={field.id}>
              <Text as="label" htmlFor={field.id} display="block" mb={1} fontSize="xs" color={labelColor}>
                {field.label}
              </Text>
              <Input
                id={field.id}
                type="number"
                min={-10}
                max={10}
                step="0.1"
                value={field.value}
                onChange={(event) => {
                  field.setValue(event.target.value)
                  restartProgress()
                }}
                size="sm"
                w="110px"
                bg={panelBg}
              />
            </Box>
          ))}
          <Box>
            <Text as="label" htmlFor="gd-learning-rate" display="block" mb={1} fontSize="xs" color={labelColor}>
              Learning rate
            </Text>
            <Input
              id="gd-learning-rate"
              type="number"
              min={0}
              max={1}
              step="0.001"
              value={learningRate}
              onChange={(event) => {
                setLearningRate(event.target.value)
                restartProgress()
              }}
              size="sm"
              w="120px"
              bg={panelBg}
            />
          </Box>
          <Box>
            <Text as="label" htmlFor="gd-steps" display="block" mb={1} fontSize="xs" color={labelColor}>
              Steps (max. {MAX_STEPS})
            </Text>
            <Input
              id="gd-steps"
              type="number"
              min={1}
              max={MAX_STEPS}
              step="1"
              value={numberOfSteps}
              onChange={(event) => {
                const value = event.target.value
                if (value === '') setNumberOfSteps(value)
                else {
                  const parsed = Number(value)
                  setNumberOfSteps(
                    Number.isFinite(parsed)
                      ? String(Math.min(MAX_STEPS, Math.max(1, Math.round(parsed))))
                      : value,
                  )
                }
                restartProgress()
              }}
              size="sm"
              w="120px"
              bg={panelBg}
            />
          </Box>
        </Flex>
        <Text mt={2} mb={3} fontSize="xs" color={labelColor}>
          Because age is used in years without normalization, small learning rates such as 0.001–0.002 work best.
        </Text>
        <Flex gap={2} align="center" flexWrap="wrap">
          <Button
            size="sm"
            colorScheme="blue"
            onClick={togglePlaying}
            isDisabled={!playing && currentStep >= configuredUpdates}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          {!playing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setCurrentStep((step) => Math.min(step + 1, configuredUpdates))
              }
              isDisabled={currentStep >= configuredUpdates}
            >
              Next step
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={reset}>
            Reset
          </Button>
          <Text mb={0} ml={2} fontSize="xs" color={labelColor}>
            Step {displayedStep} of {configuredUpdates}
            {playing ? ' — calculating the next update…' : ''}
          </Text>
        </Flex>
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} p={4} overflowX="auto">
        <Text mt={0} mb={2} fontSize="xs" color={labelColor}>
          Function at step {displayedStep}:
        </Text>
        <Flex
          minW="570px"
          justify="center"
          align="center"
          color={textColor}
          fontFamily="KaTeX_Main, Times New Roman, serif"
          fontSize="xl"
        >
          <Text as="span" mr={2} fontStyle="italic">ŷ =</Text>
          <Flex direction="column" align="stretch" textAlign="center">
            <Text as="span" py={1}>1</Text>
            <Box borderTop="1.5px solid currentColor" pt={2} px={2}>
              <Flex align="center" whiteSpace="nowrap">
                <Text as="span">1 + e</Text>
                <Text as="span" ml={-0.5} fontSize="sm" transform="translateY(-0.65em)">
                  −({formatParameter(current.a)} + {formatParameter(current.b1)} · dose +{' '}
                  {formatParameter(current.b2)} · age)
                </Text>
              </Flex>
            </Box>
          </Flex>
        </Flex>
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead bg={bg}>
            <Tr>
              <Th color={textColor}>Subject</Th>
              <Th color={textColor} textAlign="center">Dose</Th>
              <Th color={textColor} textAlign="center">Age</Th>
              <Th color={textColor} textAlign="center">Label (y)</Th>
              <Th color={textColor} textAlign="center">Prediction (ŷ)</Th>
              <Th color={textColor} textAlign="center">Error (ŷ−y)</Th>
              <Th color={textColor} textAlign="center">Loss</Th>
            </Tr>
          </Thead>
          <Tbody>
            {SUBJECTS.map((subject, index) => {
              const result = current.evaluation.subjectResults[index]
              const isWorst = index === worstSubjectIndex
              return (
                <Tr key={subject.id} bg={isWorst ? highlightBg : undefined}>
                  <Td color={textColor} fontWeight={isWorst ? 'bold' : 'normal'}>{subject.id}</Td>
                  <Td color={textColor} textAlign="center">{subject.dose} mg</Td>
                  <Td color={textColor} textAlign="center">{subject.age}</Td>
                  <Td color={textColor} textAlign="center">{subject.label}</Td>
                  <Td color={textColor} textAlign="center" fontFamily="mono">
                    {result.prediction.toFixed(4)}
                  </Td>
                  <Td color={textColor} textAlign="center" fontFamily="mono">
                    {result.error.toFixed(4)}
                  </Td>
                  <Td
                    color={textColor}
                    textAlign="center"
                    fontFamily="mono"
                    fontWeight={lossFontWeight(result.loss)}
                  >
                    {result.loss.toFixed(4)}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Text mt={0} mb={1} fontSize="sm" fontWeight="semibold" color={textColor}>
          Gradient calculated at step {displayedStep}
        </Text>
        <Text mt={0} mb={3} fontSize="xs" color={labelColor}>
          First calculate each subject's error, ŷ−y. Then average its contribution to each partial derivative:
        </Text>
        <Box overflowX="auto" px={3} py={2} bg={panelBg} borderRadius="md">
          <Text mb={2} minW="720px" fontFamily="mono" fontSize="xs" color={textColor}>
            ∂L̄/∂a = ({formatSum(errors)}) / 5 = {current.evaluation.gradientA.toFixed(4)}
          </Text>
          <Text mb={2} minW="720px" fontFamily="mono" fontSize="xs" color={textColor}>
            ∂L̄/∂b₁ = ({formatProducts(errors, 'dose')}) / 5 ={' '}
            {current.evaluation.gradientB1.toFixed(4)}
          </Text>
          <Text mb={0} minW="720px" fontFamily="mono" fontSize="xs" color={textColor}>
            ∂L̄/∂b₂ = ({formatProducts(errors, 'age')}) / 5 ={' '}
            {current.evaluation.gradientB2.toFixed(4)}
          </Text>
        </Box>

        {displayedStep < configuredUpdates ? (
          <Box mt={3} overflowX="auto">
            <Text mb={1} fontSize="xs" color={labelColor}>The next update subtracts the gradient:</Text>
            <Text mb={1} minW="660px" fontFamily="mono" fontSize="xs" color={textColor}>
              a ← {formatParameter(current.a)} − {configuredRate}·({current.evaluation.gradientA.toFixed(4)}) ={' '}
              {formatParameter(next.a)}
            </Text>
            <Text mb={1} minW="660px" fontFamily="mono" fontSize="xs" color={textColor}>
              b₁ ← {formatParameter(current.b1)} − {configuredRate}·({current.evaluation.gradientB1.toFixed(4)}) ={' '}
              {formatParameter(next.b1)}
            </Text>
            <Text mb={0} minW="660px" fontFamily="mono" fontSize="xs" color={textColor}>
              b₂ ← {formatParameter(current.b2)} − {configuredRate}·({current.evaluation.gradientB2.toFixed(4)}) ={' '}
              {formatParameter(next.b2)}
            </Text>
          </Box>
        ) : (
          <Text mt={3} mb={0} fontSize="xs" color={labelColor}>
            Experiment complete after {configuredUpdates} parameter updates.
          </Text>
        )}
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Flex mb={3} gap={4} flexWrap="wrap" fontSize="sm" color={textColor}>
          <Text mb={0}>a = <strong>{formatParameter(current.a)}</strong></Text>
          <Text mb={0}>b₁ = <strong>{formatParameter(current.b1)}</strong></Text>
          <Text mb={0}>b₂ = <strong>{formatParameter(current.b2)}</strong></Text>
          <Text mb={0}>
            average loss = <strong>{current.evaluation.averageLoss.toFixed(4)}</strong>
          </Text>
        </Flex>
        <Text mt={0} mb={2} fontSize="xs" color={labelColor}>
          Average loss over the complete experiment
        </Text>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Average loss across ${configuredUpdates} gradient descent steps with the current step at ${displayedStep}`}
          style={{ maxWidth: `${W}px`, display: 'block' }}
        >
          <line x1={pL} x2={pL} y1={pT} y2={pT + plotH} stroke={borderColor} />
          <line x1={pL} x2={pL + plotW} y1={pT + plotH} y2={pT + plotH} stroke={borderColor} />
          {lossTicks.map((loss) => {
            const y = pointY(loss)
            return (
              <g key={loss}>
                <line x1={pL} x2={pL + plotW} y1={y} y2={y} stroke={borderColor} strokeOpacity="0.55" />
                <line x1={pL - 3} x2={pL} y1={y} y2={y} stroke={labelColor} />
                <text x={pL - 6} y={y + 3} textAnchor="end" fontSize="9" fill={labelColor}>
                  {loss.toFixed(3)}
                </text>
              </g>
            )
          })}
          {stepTicks.map((step) => (
            <text key={step} x={pointX(step)} y={pT + plotH + 15} textAnchor="middle" fontSize="9" fill={labelColor}>
              {step}
            </text>
          ))}
          <polyline
            points={linePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line
            x1={pointX(displayedStep)}
            x2={pointX(displayedStep)}
            y1={pT}
            y2={pT + plotH}
            stroke={lineColor}
            strokeOpacity="0.35"
            strokeDasharray="4 4"
          />
          {timeline.map((step) => (
            <circle
              key={step.step}
              cx={pointX(step.step)}
              cy={pointY(step.evaluation.averageLoss)}
              r={step.step === displayedStep ? 5 : 2}
              fill={step.step === displayedStep ? panelBg : lineColor}
              stroke={lineColor}
              strokeWidth={step.step === displayedStep ? 3 : 0}
            >
              <title>Step {step.step}: {step.evaluation.averageLoss.toFixed(4)}</title>
            </circle>
          ))}
          <text x={pL + plotW / 2} y={H - 4} textAnchor="middle" fontSize="10" fill={labelColor}>
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
    </Box>
  )
}
