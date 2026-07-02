import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'

interface PopulationGrowthProps {
  /** Starting values, overridable from the fence meta line. */
  lifeExpectancy?: number
  childrenPerCouple?: number
  childbearingAge?: number
}

// --- Model -----------------------------------------------------------------
// A deterministic year-by-year cohort simulation. We track how many people are
// alive at each age, then each year: (1) people in their reproductive window
// have children, (2) everyone ages one year, (3) anyone who reaches the life
// expectancy dies. The total population over time is what we plot.
//
// "children per couple" is the lifetime total a couple has between them, so each
// *person* contributes children/2 to the next generation — which makes
// replacement ≈ 2 (two parents, two kids). Spreading those births across an
// 8-year window keeps the curve smooth instead of echoing in pulses.

const MAX_AGE = 100
const SIM_YEARS = 200
const REPRO_SPAN = 8 // childbearing spread over `age` .. `age + REPRO_SPAN`
// Founding population: a fixed young cohort, seeded independently of the
// childbearing age so that age only shapes the dynamics, not the starting size.
const SEED_BAND = 20
const SEED_PER_AGE = 5

interface SimResult {
  totals: number[] // population at each year, length SIM_YEARS + 1
  /** Steady-state multiplier of the population per generation (~childbearing age). */
  factorPerGen: number
  /** Steady-state annual multiplier. */
  factorPerYear: number
}

function simulate(L: number, childrenPerCouple: number, childbearingAge: number): SimResult {
  const lifeExp = Math.max(1, Math.round(L))
  const startAge = Math.round(childbearingAge)
  // Per-person, per-year birth contribution while inside the reproductive window.
  const perYearBirths = childrenPerCouple / 2 / REPRO_SPAN

  // Seed a *small founding population* of young people, then let it grow into
  // its age structure. This is what makes all three sliders visibly matter: a
  // longer life expectancy stacks more generations on top of each other (a
  // taller plateau), a younger childbearing age fills the pyramid faster, and
  // fertility sets whether it keeps climbing or levels off. The seed is a fixed
  // young band so the starting count never depends on the childbearing age.
  let pop = new Array<number>(MAX_AGE + 1).fill(0)
  for (let age = 0; age < SEED_BAND && age <= MAX_AGE; age++) pop[age] = SEED_PER_AGE

  const totals: number[] = []
  totals.push(pop.reduce((s, n) => s + n, 0))

  for (let year = 0; year < SIM_YEARS; year++) {
    // (1) Births from everyone currently in the reproductive window (and alive).
    let births = 0
    for (let age = startAge; age < startAge + REPRO_SPAN; age++) {
      if (age >= lifeExp || age > MAX_AGE) break
      births += pop[age] * perYearBirths
    }
    // (2) Age everyone by a year; newborns enter at age 0.
    const next = new Array<number>(MAX_AGE + 1).fill(0)
    next[0] = births
    for (let age = 1; age <= MAX_AGE; age++) next[age] = pop[age - 1]
    // (3) Death at life expectancy.
    for (let age = lifeExp; age <= MAX_AGE; age++) next[age] = 0
    pop = next
    totals.push(pop.reduce((s, n) => s + n, 0))
  }

  // Read the asymptotic growth rate off the tail, where transients have settled.
  const a = totals[SIM_YEARS - 50]
  const b = totals[SIM_YEARS]
  let factorPerYear = 1
  if (a > 1e-9 && b > 1e-9) factorPerYear = Math.pow(b / a, 1 / 50)
  else if (b <= 1e-9) factorPerYear = 0
  const factorPerGen = factorPerYear === 0 ? 0 : Math.pow(factorPerYear, startAge)

  return { totals, factorPerGen, factorPerYear }
}

// --- Number formatting -----------------------------------------------------
function fmtBig(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return Math.round(v).toString()
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

interface ParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
  labelColor: string
  accent: string
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  labelColor,
  accent,
}: ParamSliderProps) {
  return (
    <Box>
      <Flex justify="space-between" align="baseline" mb={1}>
        <Text fontSize="xs" color={labelColor}>
          {label}
        </Text>
        <Text fontSize="xs" fontWeight="semibold" color={accent} fontFamily="mono">
          {display}
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

export default function PopulationGrowth({
  lifeExpectancy = 70,
  childrenPerCouple = 2.4,
  childbearingAge = 27,
}: PopulationGrowthProps) {
  const [life, setLife] = useState(lifeExpectancy)
  const [children, setChildren] = useState(childrenPerCouple)
  const [age, setAge] = useState(childbearingAge)
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)

  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const gridColor = useColorModeValue('#e2e8f0', '#2d3748')
  const axisColor = useColorModeValue('#888', '#666')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')
  const accent = useColorModeValue('#2b6cb0', '#63b3ed')
  const curveColor = useColorModeValue('#2b6cb0', '#63b3ed')
  // Blue for a correct pick (more colourblind-safe against the red than green).
  const correctColor = useColorModeValue('#2b6cb0', '#4299e1')
  const wrongColor = useColorModeValue('#c53030', '#fc8181')
  const neutralText = useColorModeValue('#4a5568', '#cbd5e0')

  const sim = useMemo(() => simulate(life, children, age), [life, children, age])

  // Whether the long-run trajectory is exponential growth depends on fertility
  // vs. replacement (~2 children per couple). Above it: runaway exponential.
  // At it: grows into its age structure, then plateaus. Below it: shrinks away.
  const factor = sim.factorPerGen
  const annualPct = (sim.factorPerYear - 1) * 100
  const regime: 'grow' | 'flat' | 'shrink' =
    sim.factorPerYear > 1.001 ? 'grow' : sim.factorPerYear < 0.999 ? 'shrink' : 'flat'
  const correct: 'yes' | 'no' = regime === 'grow' ? 'yes' : 'no'

  let verdict = ''
  if (regime === 'grow') {
    verdict = `the population grows exponentially, multiplying by about ${factor.toFixed(2)}× every generation (~${Math.round(age)} yrs, ≈ ${annualPct.toFixed(1)}% / yr). Above ~2 children per couple, each generation is bigger than the last — and that compounds.`
  } else if (regime === 'flat') {
    verdict = `at ~2 children per couple you're at replacement. The population still grows while its age pyramid fills out — taller the longer people live — but then it levels off at a steady plateau. A flat line isn't exponential.`
  } else {
    verdict = `below ~2 children per couple the population can't replace itself: it drifts down toward extinction (about ${factor.toFixed(2)}× per generation). It's not growing at all.`
  }

  // --- Chart geometry ---
  const W = 640
  const H = 280
  const padL = 48
  const padR = 16
  const padT = 16
  const padB = 32
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const yMax = niceMax(Math.max(...sim.totals))
  const xToPx = (year: number) => padL + (year / SIM_YEARS) * plotW
  const yToPx = (n: number) => padT + (1 - n / yMax) * plotH

  const path = sim.totals
    .map((n, year) => `${year === 0 ? 'M' : 'L'} ${xToPx(year).toFixed(2)} ${yToPx(n).toFixed(2)}`)
    .join(' ')

  const xTicks = [0, 50, 100, 150, 200]
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)

  return (
    <Box my={6} borderRadius="md" border="1px solid" borderColor={borderColor} bg={bg} overflow="hidden">
      <Box p={3}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: `${W}px`, margin: '0 auto' }}>
          {/* Grid */}
          {yTicks.map((t) => (
            <line key={`gy-${t}`} x1={padL} x2={padL + plotW} y1={yToPx(t)} y2={yToPx(t)} stroke={gridColor} strokeWidth={1} />
          ))}
          {/* Axes */}
          <line x1={padL} x2={padL + plotW} y1={yToPx(0)} y2={yToPx(0)} stroke={axisColor} strokeWidth={1.5} />
          <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke={axisColor} strokeWidth={1.5} />
          {/* Tick labels */}
          {xTicks.map((t) => (
            <text key={`tx-${t}`} x={xToPx(t)} y={padT + plotH + 18} fontSize="11" textAnchor="middle" fill={labelColor}>
              {t}
            </text>
          ))}
          {yTicks.map((t) => (
            <text key={`ty-${t}`} x={padL - 8} y={yToPx(t) + 4} fontSize="11" textAnchor="end" fill={labelColor}>
              {fmtBig(t)}
            </text>
          ))}
          {/* Axis titles */}
          <text x={padL + plotW / 2} y={H - 2} fontSize="11" textAnchor="middle" fill={labelColor}>
            Years
          </text>
          {/* Curve */}
          <path d={path} fill="none" stroke={curveColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </Box>

      {/* Controls */}
      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Flex direction={{ base: 'column', md: 'row' }} gap={5}>
          <ParamSlider
            label="Life expectancy"
            value={life}
            min={15}
            max={90}
            step={1}
            display={`${Math.round(life)} yrs`}
            onChange={setLife}
            labelColor={labelColor}
            accent={accent}
          />
          <ParamSlider
            label="Children per couple"
            value={children}
            min={0}
            max={6}
            step={0.1}
            display={children.toFixed(1)}
            onChange={setChildren}
            labelColor={labelColor}
            accent={accent}
          />
          <ParamSlider
            label="Age when having children"
            value={age}
            min={18}
            max={45}
            step={1}
            display={`${Math.round(age)} yrs`}
            onChange={setAge}
            labelColor={labelColor}
            accent={accent}
          />
        </Flex>
      </Box>

      {/* Quiz */}
      <Box borderTop="1px solid" borderColor={borderColor} p={4}>
        <Text fontSize="sm" fontWeight="semibold" color={neutralText} mb={2}>
          Is the growth exponential?
        </Text>
        <Flex gap={2}>
          {(['yes', 'no'] as const).map((opt) => {
            const picked = answer === opt
            const isCorrectChoice = opt === correct
            let bgc: string | undefined
            let fg: string | undefined
            if (picked) {
              bgc = isCorrectChoice ? correctColor : wrongColor
              fg = '#fff'
            }
            return (
              <Button
                key={opt}
                size="sm"
                minW="72px"
                onClick={() => setAnswer(opt)}
                bg={bgc}
                color={fg}
                borderColor={picked ? bgc : borderColor}
                variant={picked ? 'solid' : 'outline'}
                _hover={picked ? { bg: bgc } : undefined}
                textTransform="capitalize"
              >
                {opt}
              </Button>
            )
          })}
        </Flex>
        {answer && (
          <Text mt={3} fontSize="sm" color={answer === correct ? correctColor : wrongColor}>
            {answer === correct ? 'Correct — ' : 'Not quite — '}
            {verdict}
          </Text>
        )}
      </Box>
    </Box>
  )
}
