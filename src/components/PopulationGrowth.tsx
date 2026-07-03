import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  snapshots: number[][] // full age distribution at each year
  /** Exact multiplier of the population per generation (the net reproduction rate R0). */
  factorPerGen: number
  /** Exact asymptotic annual multiplier (dominant eigenvalue via Euler–Lotka). */
  factorPerYear: number
  /** Mean age of parents at a birth — the generation length. */
  meanGenAge: number
}

// The asymptotic annual growth factor λ solves the Euler–Lotka equation
//   Σ_a m_a · λ^-(a+1) = 1
// where m_a is the per-person birth rate at age a (the +1 because newborns
// enter the population the year after the birth is counted). Monotone in λ,
// so bisection converges fast.
function solveLambda(perYearBirths: number, reproAges: number[]): number {
  const f = (lam: number) =>
    reproAges.reduce((s, a) => s + perYearBirths * Math.pow(lam, -(a + 1)), 0) - 1
  let lo = 0.25
  let hi = 4
  if (f(lo) < 0) return 0 // even tiny λ can't balance: population dies out
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function simulate(L: number, childrenPerCouple: number, childbearingAge: number): SimResult {
  const lifeExp = Math.max(1, Math.round(L))
  const startAge = Math.round(childbearingAge)
  // Per-person, per-year birth contribution while inside the reproductive window.
  const perYearBirths = childrenPerCouple / 2 / REPRO_SPAN

  // Ages that actually produce births: inside the window and still alive.
  const reproAges: number[] = []
  for (let a = startAge; a < startAge + REPRO_SPAN; a++) {
    if (a >= lifeExp || a > MAX_AGE) break
    reproAges.push(a)
  }

  // Seed a *small founding population* of young people, then let it grow into
  // its age structure. This is what makes all three sliders visibly matter: a
  // longer life expectancy stacks more generations on top of each other (a
  // taller plateau), a younger childbearing age fills the pyramid faster, and
  // fertility sets whether it keeps climbing or levels off. The seed is a fixed
  // young band so the starting count never depends on the childbearing age.
  let pop = new Array<number>(MAX_AGE + 1).fill(0)
  for (let age = 0; age < SEED_BAND && age <= MAX_AGE; age++) pop[age] = SEED_PER_AGE

  const totals: number[] = []
  const snapshots: number[][] = []
  totals.push(pop.reduce((s, n) => s + n, 0))
  snapshots.push([...pop])

  for (let year = 0; year < SIM_YEARS; year++) {
    // (1) Births from everyone currently in the reproductive window (and alive).
    let births = 0
    for (const age of reproAges) births += pop[age] * perYearBirths
    // (2) Age everyone by a year; newborns enter at age 0.
    const next = new Array<number>(MAX_AGE + 1).fill(0)
    next[0] = births
    for (let age = 1; age <= MAX_AGE; age++) next[age] = pop[age - 1]
    // (3) Death at life expectancy.
    for (let age = lifeExp; age <= MAX_AGE; age++) next[age] = 0
    pop = next
    totals.push(pop.reduce((s, n) => s + n, 0))
    snapshots.push([...pop])
  }

  // The regime is exact, not measured off the curve: with deterministic
  // survival, lifetime births per person is R0 = perYearBirths × (years of the
  // window actually lived). Measuring the tail slope instead is a trap — at
  // replacement the curve still carries decaying generation-length echoes of
  // the founding age bump, and sampling two points of a wave reads as spurious
  // growth or decline.
  const factorPerGen = perYearBirths * reproAges.length
  let factorPerYear: number
  if (factorPerGen <= 0) factorPerYear = 0
  else if (Math.abs(factorPerGen - 1) < 1e-12) factorPerYear = 1
  else factorPerYear = solveLambda(perYearBirths, reproAges)
  const meanGenAge = reproAges.length
    ? reproAges.reduce((s, a) => s + a, 0) / reproAges.length + 1
    : startAge

  return { totals, snapshots, factorPerGen, factorPerYear, meanGenAge }
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

// --- Age pyramid -----------------------------------------------------------
// The model has no sex, so each age bucket is split 50/50 and mirrored: males
// left, females right. Scaled to the selected year's largest bucket so the
// *shape* stays readable across the whole range; the caption carries the total.

const BUCKET = 5
const N_BUCKETS = 18 // ages 0–89; life expectancy caps at 90 so no one is older

// A horizontal bar growing from `xBase` in direction `dir`, with a 4px rounded
// data-end and a square baseline, per the mark spec.
function sideBarPath(xBase: number, y: number, w: number, h: number, dir: 1 | -1): string {
  if (w < 0.15) return ''
  const r = Math.min(4, w, h / 2)
  const xEnd = xBase + dir * w
  if (dir === 1) {
    return `M ${xBase} ${y} H ${xEnd - r} A ${r} ${r} 0 0 1 ${xEnd} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${xEnd - r} ${y + h} H ${xBase} Z`
  }
  return `M ${xBase} ${y} H ${xEnd + r} A ${r} ${r} 0 0 0 ${xEnd} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 0 ${xEnd + r} ${y + h} H ${xBase} Z`
}

interface AgePyramidProps {
  ages: number[]
  year: number
  total: number
  maleColor: string
  femaleColor: string
  labelColor: string
  axisColor: string
}

function AgePyramid({ ages, year, total, maleColor, femaleColor, labelColor, axisColor }: AgePyramidProps) {
  const W = 240
  const H = 280
  const padT = 26 // legend row
  const padB = 34 // scale ticks + caption
  const padSide = 8
  const gutter = 30 // central column for age labels
  const plotH = H - padT - padB
  const halfW = (W - gutter - 2 * padSide) / 2
  const rowH = plotH / N_BUCKETS

  const buckets: number[] = []
  for (let i = 0; i < N_BUCKETS; i++) {
    let s = 0
    for (let a = i * BUCKET; a < (i + 1) * BUCKET; a++) s += ages[a] ?? 0
    buckets.push(s / 2) // per-sex count
  }
  const xMax = niceMax(Math.max(...buckets))
  const maleBase = padSide + halfW
  const femaleBase = maleBase + gutter
  const yOf = (i: number) => padT + plotH - (i + 1) * rowH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: `${W}px`, margin: '0 auto' }}>
      {/* Legend */}
      <rect x={padSide} y={8} width={9} height={9} rx={2} fill={maleColor} />
      <text x={padSide + 13} y={16} fontSize="10" fill={labelColor}>
        Male
      </text>
      <rect x={padSide + 52} y={8} width={9} height={9} rx={2} fill={femaleColor} />
      <text x={padSide + 65} y={16} fontSize="10" fill={labelColor}>
        Female
      </text>
      {/* Central baselines the bars grow from */}
      <line x1={maleBase} x2={maleBase} y1={padT} y2={padT + plotH} stroke={axisColor} strokeWidth={1} />
      <line x1={femaleBase} x2={femaleBase} y1={padT} y2={padT + plotH} stroke={axisColor} strokeWidth={1} />
      {/* Bars, with a 2px surface gap between rows */}
      {buckets.map((v, i) => {
        const w = (v / xMax) * halfW
        const y = yOf(i) + 1
        const h = rowH - 2
        const lo = i * BUCKET
        const hi = lo + BUCKET - 1
        return (
          <g key={`b-${i}`}>
            <path d={sideBarPath(maleBase, y, w, h, -1)} fill={maleColor}>
              <title>{`Ages ${lo}–${hi} · Male: ${fmtBig(v)}`}</title>
            </path>
            <path d={sideBarPath(femaleBase, y, w, h, 1)} fill={femaleColor}>
              <title>{`Ages ${lo}–${hi} · Female: ${fmtBig(v)}`}</title>
            </path>
          </g>
        )
      })}
      {/* Age labels in the central gutter */}
      {[0, 4, 8, 12, 16].map((i) => (
        <text
          key={`age-${i}`}
          x={maleBase + gutter / 2}
          y={yOf(i) + rowH / 2 + 3}
          fontSize="9"
          textAnchor="middle"
          fill={labelColor}
        >
          {i * BUCKET}
        </text>
      ))}
      {/* Scale ticks at the outer ends */}
      <text x={padSide} y={padT + plotH + 12} fontSize="9" textAnchor="start" fill={labelColor}>
        {fmtBig(xMax)}
      </text>
      <text x={W - padSide} y={padT + plotH + 12} fontSize="9" textAnchor="end" fill={labelColor}>
        {fmtBig(xMax)}
      </text>
      {/* Caption */}
      <text x={W / 2} y={H - 6} fontSize="11" textAnchor="middle" fill={labelColor}>
        {`Year ${year} · ${fmtBig(total)} people`}
      </text>
    </svg>
  )
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
    <Box flex="1">
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
  const [selYear, setSelYear] = useState(SIM_YEARS)

  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const gridColor = useColorModeValue('#e2e8f0', '#2d3748')
  const axisColor = useColorModeValue('#888', '#666')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')
  const accent = useColorModeValue('#2b6cb0', '#63b3ed')
  const curveColor = useColorModeValue('#2b6cb0', '#63b3ed')
  // Pyramid pair, validated for CVD separation and ≥3:1 contrast on both surfaces.
  const maleColor = useColorModeValue('#2b6cb0', '#4299e1')
  const femaleColor = useColorModeValue('#dd6b20', '#dd6b20')
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
    factor > 1 + 1e-9 ? 'grow' : factor < 1 - 1e-9 ? 'shrink' : 'flat'
  const correct: 'yes' | 'no' = regime === 'grow' ? 'yes' : 'no'

  let verdict = ''
  if (regime === 'grow') {
    verdict = `the population grows exponentially, multiplying by about ${factor.toFixed(2)}× every generation (~${Math.round(sim.meanGenAge)} yrs, ≈ ${annualPct.toFixed(1)}% / yr). Above ~2 children per couple, each generation is bigger than the last — and that compounds.`
  } else if (regime === 'flat') {
    verdict = `at ~2 children per couple you're at replacement: each generation exactly replaces the last. The population still grows while its age pyramid fills out — and the leftover waves are echoes of the founding age bump slowly dying away — but it settles around a plateau. A plateau isn't exponential.`
  } else {
    verdict = `below ~2 children per couple the population can't replace itself: it drifts down toward extinction (about ${factor.toFixed(2)}× per generation). It's not growing at all.`
  }

  // --- Chart geometry ---
  const W = 420
  const H = 280
  const padL = 48
  const padR = 12
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

  // Returns null when the svg has no layout box yet (e.g. inside a collapsed
  // tangent) — dividing by a zero-width rect would yield NaN.
  const yearFromEvent = (e: ReactPointerEvent<SVGSVGElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!(rect.width > 0)) return null
    const x = ((e.clientX - rect.left) / rect.width) * W
    const year = Math.round(((x - padL) / plotW) * SIM_YEARS)
    if (!Number.isFinite(year)) return null
    return Math.max(0, Math.min(SIM_YEARS, year))
  }
  const selectYear = (e: ReactPointerEvent<SVGSVGElement>) => {
    const year = yearFromEvent(e)
    if (year !== null) setSelYear(year)
  }

  return (
    <Box my={6} borderRadius="md" border="1px solid" borderColor={borderColor} bg={bg} overflow="hidden">
      <Box p={3}>
        <Flex direction={{ base: 'column', md: 'row' }} align="center" gap={2}>
          <Box flex="1" minW={0} w="100%">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{ display: 'block', maxWidth: `${W}px`, margin: '0 auto', cursor: 'pointer', touchAction: 'pan-y' }}
              onPointerDown={selectYear}
              onPointerMove={(e) => {
                if (e.buttons & 1) selectYear(e)
              }}
            >
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
              {/* Selected-year marker */}
              <line
                x1={xToPx(selYear)}
                x2={xToPx(selYear)}
                y1={padT}
                y2={padT + plotH}
                stroke={accent}
                strokeWidth={1}
                opacity={0.45}
              />
              {/* Curve */}
              <path d={path} fill="none" stroke={curveColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {/* Marker dot, ringed in the surface color so it reads on the line */}
              <circle cx={xToPx(selYear)} cy={yToPx(sim.totals[selYear])} r={4.5} fill={curveColor} stroke={bg} strokeWidth={2} />
            </svg>
          </Box>
          <Box w={{ base: '100%', md: '240px' }} flexShrink={0}>
            <AgePyramid
              ages={sim.snapshots[selYear] ?? sim.snapshots[sim.snapshots.length - 1]}
              year={selYear}
              total={sim.totals[selYear]}
              maleColor={maleColor}
              femaleColor={femaleColor}
              labelColor={labelColor}
              axisColor={axisColor}
            />
          </Box>
        </Flex>
        <Text mt={1} fontSize="xs" color={labelColor} textAlign="center">
          Click (or drag) anywhere on the curve to see the age structure at that year — sexes assumed 50/50.
        </Text>
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
