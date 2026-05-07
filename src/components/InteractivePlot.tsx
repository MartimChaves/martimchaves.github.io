import { useMemo, useState } from 'react'
import { Box, Button, Flex, Text, Textarea, useColorModeValue } from '@chakra-ui/react'
import { compileComplex, usesT } from '../utils/complexEval'

interface InteractivePlotProps {
  defaultExpr: string
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  samples?: number
  tMin?: number
  tMax?: number
}

type Polyline = Array<[number, number]>

interface CurveSegment {
  curveIndex: number
  points: Polyline
}

interface RawResult {
  polylines: Polyline[]
  error: string | null
}

interface EvalResult {
  segments: CurveSegment[]
  error: string | null
}

function evaluatePolyline(expr: string): RawResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(expr)
  } catch (e) {
    return { polylines: [], error: (e as Error).message }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { polylines: [], error: 'expected non-empty array' }
  }

  const isVertex = (v: unknown): v is [number, number] =>
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])

  const raw = parsed as unknown[]
  const polylines: Polyline[] =
    isVertex(raw[0]) ? [raw as Polyline] : (raw as Polyline[])

  for (let p = 0; p < polylines.length; p++) {
    const line = polylines[p]
    if (!Array.isArray(line) || line.length < 2) {
      return { polylines: [], error: `polyline ${p} needs at least 2 vertices` }
    }
    for (let i = 0; i < line.length; i++) {
      if (!isVertex(line[i])) {
        return { polylines: [], error: `polyline ${p} vertex ${i} is not [x, y]` }
      }
    }
  }

  return { polylines, error: null }
}

function evaluateFunction(
  expr: string,
  xMin: number,
  xMax: number,
  samples: number,
): RawResult {
  let fn: (x: number) => number
  try {
    // Bare math names mirror the complex parametric DSL so `exp(x)`,
    // `sin(x)`, `pi`, `tau`, etc. work the same way in both modes.
    const preamble =
      '"use strict";' +
      'const {exp,sin,cos,tan,log,sqrt,abs,floor,ceil,round,min,max,pow,atan,atan2}=Math;' +
      'const pi=Math.PI, e=Math.E, tau=2*Math.PI;'
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    fn = new Function('x', 'Math', `${preamble} return (${expr});`) as unknown as (
      x: number,
    ) => number
  } catch (e) {
    return { polylines: [], error: (e as Error).message }
  }

  const xStep = (xMax - xMin) / samples
  const polylines: Polyline[] = []
  let current: Polyline = []
  let prevX: number | null = null
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples
    let y: number
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (fn as any)(x, Math)
    } catch (e) {
      return { polylines: [], error: (e as Error).message }
    }
    if (typeof y === 'boolean') y = y ? 1 : 0
    if (typeof y !== 'number' || !Number.isFinite(y)) {
      if (current.length > 0) {
        polylines.push(current)
        current = []
      }
      prevX = null
      continue
    }
    if (prevX !== null && Math.abs(x - prevX) > xStep * 1.5 && current.length > 0) {
      polylines.push(current)
      current = []
    }
    current.push([x, y])
    prevX = x
  }
  if (current.length > 0) polylines.push(current)
  return { polylines, error: null }
}

function evaluateParametric(
  expr: string,
  tMin: number,
  tMax: number,
  samples: number,
): RawResult {
  let fn: (t: number) => { re: number; im: number }
  try {
    fn = compileComplex(expr)
  } catch (e) {
    return { polylines: [], error: (e as Error).message }
  }
  const points: Polyline = []
  for (let i = 0; i <= samples; i++) {
    const t = tMin + ((tMax - tMin) * i) / samples
    let z: { re: number; im: number }
    try {
      z = fn(t)
    } catch (e) {
      return { polylines: [], error: (e as Error).message }
    }
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) continue
    points.push([z.re, z.im])
  }
  return { polylines: points.length > 0 ? [points] : [], error: null }
}

function evaluate(
  expr: string,
  xMin: number,
  xMax: number,
  samples: number,
  tMin: number,
  tMax: number,
): EvalResult {
  const trimmed = expr.trim()
  // Single polyline (whole body is JSON array starting with `[`).
  if (trimmed.startsWith('[')) {
    const r = evaluatePolyline(trimmed)
    if (r.error) return { segments: [], error: r.error }
    return {
      segments: r.polylines.map((points) => ({ curveIndex: 0, points })),
      error: null,
    }
  }

  // Strip `# ...` comments and blank lines; each remaining line is one curve.
  const lines = trimmed
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return { segments: [], error: null }

  const segments: CurveSegment[] = []
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const r = line.startsWith('[')
      ? evaluatePolyline(line)
      : usesT(line)
        ? evaluateParametric(line, tMin, tMax, samples)
        : evaluateFunction(line, xMin, xMax, samples)
    if (r.error) {
      const prefix = lines.length > 1 ? `line ${idx + 1}: ` : ''
      return { segments: [], error: prefix + r.error }
    }
    for (const points of r.polylines) segments.push({ curveIndex: idx, points })
  }
  return { segments, error: null }
}

export default function InteractivePlot({
  defaultExpr,
  xMin = -1,
  xMax = 10,
  yMin = -0.5,
  yMax = 4,
  samples = 1000,
  tMin = 0,
  tMax = 2 * Math.PI,
}: InteractivePlotProps) {
  const [expr, setExpr] = useState(defaultExpr)
  const axisColor = useColorModeValue('#888', '#666')
  const gridColor = useColorModeValue('#e2e8f0', '#2d3748')
  const curvePaletteLight = ['#c0392b', '#2c7a7b', '#6b46c1', '#b7791f', '#2b6cb0']
  const curvePaletteDark = ['#ff6b6b', '#4fd1c5', '#b794f4', '#f6ad55', '#63b3ed']
  const curvePalette = useColorModeValue(curvePaletteLight, curvePaletteDark)
  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const errorColor = useColorModeValue('#c53030', '#fc8181')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')

  const result = useMemo(
    () => evaluate(expr, xMin, xMax, samples, tMin, tMax),
    [expr, xMin, xMax, samples, tMin, tMax],
  )

  // Plot dimensions
  const W = 640
  const H = 320
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 32
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xToPx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW
  const yToPx = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH

  // Each segment -> one SVG path with the color of its source curve. Points
  // outside the viewport are kept as-is and clipped by the SVG viewBox.
  const renderedPaths = result.segments.map((seg) => ({
    d: seg.points
      .map(([x, y], i) => {
        const px = xToPx(x)
        const py = yToPx(y)
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`
      })
      .join(' '),
    color: curvePalette[seg.curveIndex % curvePalette.length],
  }))

  // Axis ticks
  const xTicks: number[] = []
  for (let t = Math.ceil(xMin); t <= Math.floor(xMax); t++) xTicks.push(t)
  const yTicks: number[] = []
  for (let t = Math.ceil(yMin); t <= Math.floor(yMax); t++) yTicks.push(t)

  return (
    <Box
      my={6}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
      bg={bg}
      overflow="hidden"
    >
      <Box p={3}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', maxWidth: `${W}px`, margin: '0 auto' }}
        >
          {/* Grid */}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              x1={xToPx(t)}
              x2={xToPx(t)}
              y1={padT}
              y2={padT + plotH}
              stroke={gridColor}
              strokeWidth={1}
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={padL}
              x2={padL + plotW}
              y1={yToPx(t)}
              y2={yToPx(t)}
              stroke={gridColor}
              strokeWidth={1}
            />
          ))}

          {/* Axes */}
          <line
            x1={padL}
            x2={padL + plotW}
            y1={yToPx(0)}
            y2={yToPx(0)}
            stroke={axisColor}
            strokeWidth={1.5}
          />
          <line
            x1={xToPx(0)}
            x2={xToPx(0)}
            y1={padT}
            y2={padT + plotH}
            stroke={axisColor}
            strokeWidth={1.5}
          />

          {/* Tick labels */}
          {xTicks.map((t) => (
            <text
              key={`tx-${t}`}
              x={xToPx(t)}
              y={padT + plotH + 16}
              fontSize="11"
              textAnchor="middle"
              fill={labelColor}
            >
              {t}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={`ty-${t}`}
              x={padL - 6}
              y={yToPx(t) + 4}
              fontSize="11"
              textAnchor="end"
              fill={labelColor}
            >
              {t}
            </text>
          ))}

          {/* Curves */}
          {renderedPaths.map(({ d, color }, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} p={3}>
        <Text fontSize="xs" color={labelColor} mb={1.5}>
          f(x) =
        </Text>
        <Textarea
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          fontFamily="mono"
          fontSize="sm"
          rows={2}
          spellCheck={false}
          resize="vertical"
        />
        {result.error && (
          <Text mt={2} fontSize="xs" color={errorColor} fontFamily="mono">
            {result.error}
          </Text>
        )}
        <Flex mt={2} justify="space-between" align="center" gap={3}>
          <Text fontSize="xs" color={labelColor}>
            One curve per line. <code>f(x)</code> with <code>Math</code>, or{' '}
            <code>z(t)</code> with <code>i</code>, <code>exp</code>,{' '}
            <code>sin</code>, <code>cos</code>, <code>pi</code>, <code>tau</code>,
            or <code>[[x,y],...]</code>.
          </Text>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setExpr(defaultExpr)}
          >
            Reset
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}
