import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Box, Button, Flex, Input, Text, useColorModeValue } from '@chakra-ui/react'
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

interface View {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

// A "nice" tick step (1, 2, 5 × 10ⁿ) so gridlines stay readable at any zoom.
function niceStep(range: number, target: number): number {
  if (!(range > 0)) return 1
  const raw = range / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}

function makeTicks(min: number, max: number, target: number): { ticks: number[]; step: number } {
  const step = niceStep(max - min, target)
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let i = 0; i < 1000; i++) {
    const t = start + i * step
    if (t > max + step * 1e-9) break
    ticks.push(t)
  }
  return { ticks, step }
}

function fmtTick(v: number, step: number): string {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step))))
  return Number(v.toFixed(decimals)).toString()
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
  // One editable input per function. Seeded from defaultExpr (one curve per
  // line) so existing plots keep working; readers can add/remove rows.
  const [exprs, setExprs] = useState<string[]>(() => {
    const lines = defaultExpr.split('\n')
    return lines.length > 0 ? lines : ['']
  })
  const exprText = exprs.join('\n')
  const axisColor = useColorModeValue('#888', '#666')
  const gridColor = useColorModeValue('#e2e8f0', '#2d3748')
  const curvePaletteLight = ['#c0392b', '#2c7a7b', '#6b46c1', '#b7791f', '#2b6cb0']
  const curvePaletteDark = ['#ff6b6b', '#4fd1c5', '#b794f4', '#f6ad55', '#63b3ed']
  const curvePalette = useColorModeValue(curvePaletteLight, curvePaletteDark)
  const bg = useColorModeValue('#fafafa', '#1a202c')
  const borderColor = useColorModeValue('#e2e8f0', '#2d3748')
  const errorColor = useColorModeValue('#c53030', '#fc8181')
  const labelColor = useColorModeValue('#4a5568', '#a0aec0')

  // Plot dimensions
  const W = 640
  const H = 320
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 32
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const clipId = useId()

  // The visible window. Initialized from props, then pannable/zoomable. Resets
  // whenever the configured bounds change.
  const initialView = useMemo<View>(
    () => ({ xMin, xMax, yMin, yMax }),
    [xMin, xMax, yMin, yMax],
  )
  const [view, setView] = useState<View>(initialView)
  useEffect(() => setView(initialView), [initialView])

  // Latest view in a ref so native (non-React) wheel/pointer handlers always
  // read current bounds without re-binding listeners on every change.
  const viewRef = useRef(view)
  viewRef.current = view

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ cx: number; cy: number; view: View } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const result = useMemo(
    () => evaluate(exprText, view.xMin, view.xMax, samples, tMin, tMax),
    [exprText, view.xMin, view.xMax, samples, tMin, tMax],
  )

  // Curve color index per input row, counting only rows that actually plot
  // (non-blank, non-comment) so swatches line up with the rendered curves.
  const rowColorIndex = useMemo(() => {
    let active = 0
    return exprs.map((line) => {
      if (line.replace(/#.*$/, '').trim().length === 0) return null
      return active++
    })
  }, [exprs])

  const setExprAt = (i: number, value: string) =>
    setExprs((prev) => prev.map((e, j) => (j === i ? value : e)))
  const addExpr = () => setExprs((prev) => [...prev, ''])
  const removeExpr = (i: number) =>
    setExprs((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))

  const xToPx = (x: number) => padL + ((x - view.xMin) / (view.xMax - view.xMin)) * plotW
  const yToPx = (y: number) => padT + (1 - (y - view.yMin) / (view.yMax - view.yMin)) * plotH

  // Client (screen) coords -> data coords, using the supplied view.
  const toData = (clientX: number, clientY: number, v: View) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const vbX = ((clientX - rect.left) / rect.width) * W
    const vbY = ((clientY - rect.top) / rect.height) * H
    return {
      x: v.xMin + ((vbX - padL) / plotW) * (v.xMax - v.xMin),
      y: v.yMin + (1 - (vbY - padT) / plotH) * (v.yMax - v.yMin),
    }
  }

  // Wheel = zoom toward the cursor. Bound natively so we can preventDefault
  // (React's onWheel is passive and cannot stop the page from scrolling).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      const p = toData(e.clientX, e.clientY, v)
      if (!p) return
      const scale = Math.exp(e.deltaY * 0.0015)
      const nxMin = p.x - (p.x - v.xMin) * scale
      const nxMax = p.x + (v.xMax - p.x) * scale
      const nyMin = p.y - (p.y - v.yMin) * scale
      const nyMax = p.y + (v.yMax - p.y) * scale
      const rx = nxMax - nxMin
      const ry = nyMax - nyMin
      if (rx < 1e-9 || ry < 1e-9 || rx > 1e12 || ry > 1e12) return
      setView({ xMin: nxMin, xMax: nxMax, yMin: nyMin, yMax: nyMax })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { cx: e.clientX, cy: e.clientY, view: viewRef.current }
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (drag) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const dxData = (((e.clientX - drag.cx) / rect.width) * W / plotW) * (drag.view.xMax - drag.view.xMin)
      const dyData = (((e.clientY - drag.cy) / rect.height) * H / plotH) * (drag.view.yMax - drag.view.yMin)
      setView({
        xMin: drag.view.xMin - dxData,
        xMax: drag.view.xMax - dxData,
        yMin: drag.view.yMin + dyData,
        yMax: drag.view.yMax + dyData,
      })
    } else {
      setCursor(toData(e.clientX, e.clientY, viewRef.current))
    }
  }

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      dragRef.current = null
      setDragging(false)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }
  }

  // Each segment -> one SVG path with the color of its source curve. Points
  // outside the plot area are clipped via the clipPath below.
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

  // Axis ticks — "nice" spacing recomputed for the current zoom level.
  const { ticks: xTicks, step: xStep } = makeTicks(view.xMin, view.xMax, 10)
  const { ticks: yTicks, step: yStep } = makeTicks(view.yMin, view.yMax, 6)
  const showXAxis = view.yMin <= 0 && view.yMax >= 0
  const showYAxis = view.xMin <= 0 && view.xMax >= 0

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
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => setCursor(null)}
          style={{
            display: 'block',
            maxWidth: `${W}px`,
            margin: '0 auto',
            touchAction: 'none',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={padL} y={padT} width={plotW} height={plotH} />
            </clipPath>
          </defs>

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

          {/* Axes (only drawn when zero is within view) */}
          {showXAxis && (
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yToPx(0)}
              y2={yToPx(0)}
              stroke={axisColor}
              strokeWidth={1.5}
            />
          )}
          {showYAxis && (
            <line
              x1={xToPx(0)}
              x2={xToPx(0)}
              y1={padT}
              y2={padT + plotH}
              stroke={axisColor}
              strokeWidth={1.5}
            />
          )}

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
              {fmtTick(t, xStep)}
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
              {fmtTick(t, yStep)}
            </text>
          ))}

          {/* Curves (clipped to the plot area) */}
          <g clipPath={`url(#${clipId})`}>
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
          </g>

          {/* Cursor coordinate readout */}
          {cursor && !dragging && (
            <text
              x={padL + plotW}
              y={padT + 12}
              fontSize="11"
              textAnchor="end"
              fill={labelColor}
              fontFamily="monospace"
            >
              ({cursor.x.toFixed(2)}, {cursor.y.toFixed(2)})
            </text>
          )}
        </svg>
      </Box>

      <Box borderTop="1px solid" borderColor={borderColor} p={3}>
        <Text fontSize="xs" color={labelColor} mb={1.5}>
          Functions
        </Text>
        <Flex direction="column" gap={1.5}>
          {exprs.map((value, i) => {
            const ci = rowColorIndex[i]
            const swatch =
              ci === null ? 'transparent' : curvePalette[ci % curvePalette.length]
            return (
              <Flex key={i} align="center" gap={2}>
                <Box
                  w="10px"
                  h="10px"
                  flexShrink={0}
                  borderRadius="full"
                  bg={swatch}
                  border={ci === null ? '1px solid' : 'none'}
                  borderColor={borderColor}
                />
                <Input
                  value={value}
                  onChange={(e) => setExprAt(i, e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  size="sm"
                  spellCheck={false}
                  placeholder="e.g. sin(x)"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  px={2}
                  flexShrink={0}
                  aria-label="Remove function"
                  isDisabled={exprs.length <= 1}
                  onClick={() => removeExpr(i)}
                >
                  ✕
                </Button>
              </Flex>
            )
          })}
        </Flex>
        <Button mt={2} size="xs" variant="outline" onClick={addExpr}>
          + Add function
        </Button>
        {result.error && (
          <Text mt={2} fontSize="xs" color={errorColor} fontFamily="mono">
            {result.error}
          </Text>
        )}
        <Flex mt={2} justify="space-between" align="center" gap={3}>
          <Text fontSize="xs" color={labelColor}>
            One function per row. <code>f(x)</code> with <code>Math</code>, or{' '}
            <code>z(t)</code> with <code>i</code>, <code>exp</code>,{' '}
            <code>sin</code>, <code>cos</code>, <code>pi</code>, <code>tau</code>,
            or <code>[[x,y],...]</code>. Drag to pan, scroll to zoom.
          </Text>
          <Flex gap={2} flexShrink={0}>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setView(initialView)}
            >
              Reset view
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setExprs(defaultExpr.split('\n'))
                setView(initialView)
              }}
            >
              Reset
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Box>
  )
}
