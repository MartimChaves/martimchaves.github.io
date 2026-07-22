import { useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react'

type Metric = 'log' | 'derivative'

const X_MIN = 0.2
const X_MAX = 10
const WIDTH = 680
const HEIGHT = 180
const LEFT = 48
const RIGHT = 16
const TOP = 18
const BOTTOM = 30
const PLOT_WIDTH = WIDTH - LEFT - RIGHT
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM
const SAMPLE_COUNT = 260

function valueAt(metric: Metric, x: number): number {
  return metric === 'log' ? Math.log(x) : 1 / x
}

function boundsFor(metric: Metric): { min: number; max: number; ticks: number[] } {
  return metric === 'log'
    ? { min: -2, max: 2.5, ticks: [-2, -1, 0, 1, 2] }
    : { min: 0, max: 5.25, ticks: [0, 1, 2, 3, 4, 5] }
}

function xFor(x: number): number {
  return LEFT + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_WIDTH
}

function yFor(metric: Metric, value: number): number {
  const bounds = boundsFor(metric)
  return TOP + ((bounds.max - value) / (bounds.max - bounds.min)) * PLOT_HEIGHT
}

function pathFor(metric: Metric): string {
  const commands: string[] = []
  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = X_MIN + ((X_MAX - X_MIN) * index) / SAMPLE_COUNT
    commands.push(
      `${index === 0 ? 'M' : 'L'} ${xFor(x).toFixed(2)} ${yFor(metric, valueAt(metric, x)).toFixed(2)}`,
    )
  }
  return commands.join(' ')
}

const LOG_PATH = pathFor('log')
const DERIVATIVE_PATH = pathFor('derivative')

interface PlotProps {
  metric: Metric
  selectedX: number
  lineColor: string
  gridColor: string
  textColor: string
  panelColor: string
  onSelect: (event: ReactPointerEvent<SVGSVGElement>) => void
}

function LogPlot({
  metric,
  selectedX,
  lineColor,
  gridColor,
  textColor,
  panelColor,
  onSelect,
}: PlotProps) {
  const bounds = boundsFor(metric)
  const selectedValue = valueAt(metric, selectedX)
  const markerX = xFor(selectedX)
  const markerY = yFor(metric, selectedValue)
  const xTicks = [0.2, 2, 4, 6, 8, 10]
  const title = metric === 'log' ? 'The natural logarithm' : 'Its derivative'
  const formula = metric === 'log' ? 'ln(x)' : "ln′(x) = 1/x"

  return (
    <Box>
      <Flex mb={1} justify="space-between" align="baseline" gap={3}>
        <Text mb={0} fontSize="sm" fontWeight="semibold" color="page.text">
          {title}: {formula}
        </Text>
        <Text mb={0} fontSize="xs" color="page.textSecondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          x = {selectedX.toFixed(2)}, y = {selectedValue.toFixed(3)}
        </Text>
      </Flex>
      <Box border="1px solid" borderColor="page.border" borderRadius="md" overflow="hidden">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label={`${title} plot. Click to choose an x value.`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            onSelect(event)
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) onSelect(event)
          }}
          style={{ display: 'block', background: panelColor, cursor: 'crosshair', touchAction: 'pan-y' }}
        >
          {bounds.ticks.map((tick) => {
            const y = yFor(metric, tick)
            return (
              <g key={tick}>
                <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} stroke={gridColor} />
                <text x={LEFT - 7} y={y + 4} textAnchor="end" fontSize="10" fill={textColor}>
                  {tick}
                </text>
              </g>
            )
          })}
          {xTicks.map((tick) => {
            const x = xFor(tick)
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={TOP} y2={HEIGHT - BOTTOM} stroke={gridColor} />
                <text x={x} y={HEIGHT - 9} textAnchor="middle" fontSize="10" fill={textColor}>
                  {tick}
                </text>
              </g>
            )
          })}
          {bounds.min < 0 && bounds.max > 0 && (
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={yFor(metric, 0)}
              y2={yFor(metric, 0)}
              stroke={textColor}
              strokeOpacity="0.45"
            />
          )}
          <path
            d={metric === 'log' ? LOG_PATH : DERIVATIVE_PATH}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={TOP}
            y2={HEIGHT - BOTTOM}
            stroke={lineColor}
            strokeOpacity="0.35"
            strokeDasharray="4 4"
          />
          <circle cx={markerX} cy={markerY} r="5" fill={panelColor} stroke={lineColor} strokeWidth="3" />
          <text x={WIDTH - RIGHT} y={HEIGHT - 9} textAnchor="end" fontSize="10" fill={textColor}>
            x
          </text>
        </svg>
      </Box>
    </Box>
  )
}

export default function LogDerivativeExplorer() {
  const [selectedX, setSelectedX] = useState(2)
  const panelColor = useColorModeValue('#ffffff', '#0b1220')
  const cardColor = useColorModeValue('#f8fafc', '#111827')
  const gridColor = useColorModeValue('#e2e8f0', '#243247')
  const textColor = useColorModeValue('#64748b', '#94a3b8')
  const logColor = useColorModeValue('#2563eb', '#60a5fa')
  const derivativeColor = useColorModeValue('#7c3aed', '#c084fc')
  const derivative = 1 / selectedX
  const smallChange = 0.01

  const selectFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * WIDTH
    const boundedX = Math.min(WIDTH - RIGHT, Math.max(LEFT, svgX))
    const nextX = X_MIN + ((boundedX - LEFT) / PLOT_WIDTH) * (X_MAX - X_MIN)
    setSelectedX(nextX)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const step = event.shiftKey ? 0.5 : 0.1
    setSelectedX((current) => Math.min(X_MAX, Math.max(X_MIN, current + direction * step)))
  }

  return (
    <Box
      my={5}
      p={{ base: 3, md: 4 }}
      border="1px solid"
      borderColor="page.border"
      borderRadius="lg"
      bg={cardColor}
      role="slider"
      tabIndex={0}
      aria-label="Selected x value"
      aria-valuemin={X_MIN}
      aria-valuemax={X_MAX}
      aria-valuenow={Number(selectedX.toFixed(2))}
      onKeyDown={handleKeyDown}
    >
      <Text mt={0} mb={3} fontSize="sm" color="page.textSecondary">
        Click or drag either plot to inspect the logarithm and its derivative at the same value of x.
      </Text>

      <Box mb={5}>
        <LogPlot
          metric="log"
          selectedX={selectedX}
          lineColor={logColor}
          gridColor={gridColor}
          textColor={textColor}
          panelColor={panelColor}
          onSelect={selectFromPointer}
        />
      </Box>
      <LogPlot
        metric="derivative"
        selectedX={selectedX}
        lineColor={derivativeColor}
        gridColor={gridColor}
        textColor={textColor}
        panelColor={panelColor}
        onSelect={selectFromPointer}
      />

      <Box mt={4} px={3} py={3} borderLeft="3px solid" borderColor={derivativeColor} bg={panelColor}>
        <Text mt={0} mb={1} fontSize="sm" fontWeight="semibold" color="page.text">
          Derivative at x = {selectedX.toFixed(2)}
        </Text>
        <Text mb={1} fontFamily="mono" fontSize="sm" color="page.text" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          ln′({selectedX.toFixed(2)}) = 1 / {selectedX.toFixed(2)} = {derivative.toFixed(3)}
        </Text>
        <Text mb={0} fontSize="xs" color="page.textSecondary">
          Near this point, increasing x by {smallChange.toFixed(2)} changes ln(x) by approximately{' '}
          {derivative.toFixed(3)} × {smallChange.toFixed(2)} = {(derivative * smallChange).toFixed(4)}.
        </Text>
      </Box>
    </Box>
  )
}
