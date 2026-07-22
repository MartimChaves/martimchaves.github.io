import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  Box,
  Button,
  Flex,
  Text,
  useColorModeValue,
  usePrefersReducedMotion,
} from '@chakra-ui/react'

interface LapSample {
  time: number
  distance: number
  speed: number
  acceleration: number
}

type Metric = 'speed' | 'acceleration'

const TRACK_LEFT = 88
const TRACK_RIGHT = 312
const TRACK_CENTER_Y = 150
const TRACK_RADIUS = 12
const TRACK_TOP = TRACK_CENTER_Y - TRACK_RADIUS
const TRACK_BOTTOM = TRACK_CENTER_Y + TRACK_RADIUS
const STRAIGHT_LENGTH = TRACK_RIGHT - TRACK_LEFT
const CORNER_LENGTH = Math.PI * TRACK_RADIUS
const TRACK_LENGTH = 2 * STRAIGHT_LENGTH + 2 * CORNER_LENGTH
const TRACK_PATH = `M ${TRACK_LEFT} ${TRACK_TOP} H ${TRACK_RIGHT} A ${TRACK_RADIUS} ${TRACK_RADIUS} 0 0 1 ${TRACK_RIGHT} ${TRACK_BOTTOM} H ${TRACK_LEFT} A ${TRACK_RADIUS} ${TRACK_RADIUS} 0 0 1 ${TRACK_LEFT} ${TRACK_TOP}`
const CORNER_SPEED = 42
const MAX_SPEED = 112
const ACCELERATION_END = 0.27567
const BRAKING_START = 1 - ACCELERATION_END
const LAP_SAMPLE_COUNT = 1600
const PLOT_WINDOW_SECONDS = 10
const REVIEW_LAPS = 3
const TANGENT_SAMPLE_SECONDS = 0.25

function sectionAtDistance(distance: number): { kind: 'straight' | 'corner'; progress: number } {
  let cursor = ((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH

  if (cursor < STRAIGHT_LENGTH) {
    return { kind: 'straight', progress: cursor / STRAIGHT_LENGTH }
  }
  cursor -= STRAIGHT_LENGTH

  if (cursor < CORNER_LENGTH) {
    return { kind: 'corner', progress: cursor / CORNER_LENGTH }
  }
  cursor -= CORNER_LENGTH

  if (cursor < STRAIGHT_LENGTH) {
    return { kind: 'straight', progress: cursor / STRAIGHT_LENGTH }
  }

  return { kind: 'corner', progress: (cursor - STRAIGHT_LENGTH) / CORNER_LENGTH }
}

function speedAtDistance(distance: number): number {
  const section = sectionAtDistance(distance)
  if (section.kind === 'corner') return CORNER_SPEED

  const speedRange = MAX_SPEED - CORNER_SPEED
  if (section.progress < ACCELERATION_END) {
    const progress = section.progress / ACCELERATION_END
    const smoothProgress = progress * progress * (3 - 2 * progress)
    return CORNER_SPEED + speedRange * smoothProgress
  }
  if (section.progress < BRAKING_START) return MAX_SPEED

  const progress = (section.progress - BRAKING_START) / (1 - BRAKING_START)
  const smoothProgress = progress * progress * (3 - 2 * progress)
  return MAX_SPEED - speedRange * smoothProgress
}

function accelerationAtDistance(distance: number): number {
  const section = sectionAtDistance(distance)
  if (section.kind === 'corner') return 0

  const speedRangeMetresPerSecond = (MAX_SPEED - CORNER_SPEED) / 3.6
  let speedChangePerMetre = 0

  if (section.progress < ACCELERATION_END) {
    const progress = section.progress / ACCELERATION_END
    speedChangePerMetre =
      (speedRangeMetresPerSecond * 6 * progress * (1 - progress)) /
      (ACCELERATION_END * STRAIGHT_LENGTH)
  } else if (section.progress >= BRAKING_START) {
    const progress = (section.progress - BRAKING_START) / (1 - BRAKING_START)
    speedChangePerMetre =
      (-speedRangeMetresPerSecond * 6 * progress * (1 - progress)) /
      ((1 - BRAKING_START) * STRAIGHT_LENGTH)
  }

  return speedChangePerMetre * (speedAtDistance(distance) / 3.6)
}

function buildLapSamples(): LapSample[] {
  const samples: LapSample[] = []
  const distanceStep = TRACK_LENGTH / LAP_SAMPLE_COUNT
  let time = 0

  for (let index = 0; index <= LAP_SAMPLE_COUNT; index += 1) {
    const distance = index * distanceStep
    const speed = speedAtDistance(distance)

    if (index > 0) {
      const previousSpeed = samples[index - 1].speed
      const averageSpeedMetresPerSecond = (previousSpeed + speed) / (2 * 3.6)
      time += distanceStep / averageSpeedMetresPerSecond
    }

    samples.push({
      time,
      distance,
      speed,
      acceleration: accelerationAtDistance(distance),
    })
  }

  return samples
}

const LAP_SAMPLES = buildLapSamples()
const LAP_DURATION = LAP_SAMPLES[LAP_SAMPLES.length - 1].time

function sampleLap(time: number): LapSample {
  const wrappedTime = ((time % LAP_DURATION) + LAP_DURATION) % LAP_DURATION
  let low = 0
  let high = LAP_SAMPLES.length - 1

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (LAP_SAMPLES[middle].time <= wrappedTime) low = middle
    else high = middle
  }

  const before = LAP_SAMPLES[low]
  const after = LAP_SAMPLES[high]
  const interval = after.time - before.time
  const amount = interval > 0 ? (wrappedTime - before.time) / interval : 0

  return {
    time: wrappedTime,
    distance: before.distance + (after.distance - before.distance) * amount,
    speed: before.speed + (after.speed - before.speed) * amount,
    acceleration:
      before.acceleration + (after.acceleration - before.acceleration) * amount,
  }
}

function pointOnTrack(distance: number): { x: number; y: number; angle: number } {
  let cursor = ((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH

  if (cursor < STRAIGHT_LENGTH) {
    return { x: TRACK_LEFT + cursor, y: TRACK_TOP, angle: 0 }
  }
  cursor -= STRAIGHT_LENGTH

  if (cursor < CORNER_LENGTH) {
    const angle = -Math.PI / 2 + cursor / TRACK_RADIUS
    return {
      x: TRACK_RIGHT + TRACK_RADIUS * Math.cos(angle),
      y: TRACK_CENTER_Y + TRACK_RADIUS * Math.sin(angle),
      angle: angle + Math.PI / 2,
    }
  }
  cursor -= CORNER_LENGTH

  if (cursor < STRAIGHT_LENGTH) {
    return { x: TRACK_RIGHT - cursor, y: TRACK_BOTTOM, angle: Math.PI }
  }
  cursor -= STRAIGHT_LENGTH

  const angle = Math.PI / 2 + cursor / TRACK_RADIUS
  return {
    x: TRACK_LEFT + TRACK_RADIUS * Math.cos(angle),
    y: TRACK_CENTER_Y + TRACK_RADIUS * Math.sin(angle),
    angle: angle + Math.PI / 2,
  }
}

function drivingPhase(distance: number): string {
  const section = sectionAtDistance(distance)
  if (section.kind === 'corner') return 'Constant speed through the corner'
  if (section.progress < ACCELERATION_END) return 'Accelerating hard on the straight'
  if (section.progress < BRAKING_START) return 'Holding top speed on the straight'
  return 'Slowing for the corner'
}

function formatAcceleration(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} m/s²`
}

interface PlotProps {
  metric: Metric
  liveTime: number
  reviewEnd: number
  playing: boolean
  lineColor: string
  gridColor: string
  textColor: string
  panelColor: string
}

function DerivativePlot({
  metric,
  liveTime,
  reviewEnd,
  playing,
  lineColor,
  gridColor,
  textColor,
  panelColor,
}: PlotProps) {
  const width = 680
  const height = 154
  const left = 44
  const right = 14
  const top = 22
  const bottom = 26
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const focusTime = playing ? liveTime : reviewEnd
  const domainStart = focusTime - PLOT_WINDOW_SECONDS / 2
  const domainEnd = focusTime + PLOT_WINDOW_SECONDS / 2
  const yMin = metric === 'speed' ? 30 : -18
  const yMax = metric === 'speed' ? 120 : 18
  const label =
    metric === 'speed' ? 'Speed — derivative of distance' : 'Acceleration — derivative of speed'
  const unit = metric === 'speed' ? 'km/h' : 'm/s²'
  const currentSample = sampleLap(focusTime)
  const currentValue = currentSample[metric]
  const previousValue = sampleLap(focusTime - TANGENT_SAMPLE_SECONDS)[metric]
  const nextValue = sampleLap(focusTime + TANGENT_SAMPLE_SECONDS)[metric]
  const slope = (nextValue - previousValue) / (2 * TANGENT_SAMPLE_SECONDS)

  const xFor = (time: number) =>
    left + ((time - domainStart) / (domainEnd - domainStart)) * plotWidth
  const yFor = (value: number) => top + ((yMax - value) / (yMax - yMin)) * plotHeight

  const pointCount = 180
  const points: string[] = []
  for (let index = 0; index <= pointCount; index += 1) {
    const time = domainStart + ((domainEnd - domainStart) * index) / pointCount
    const value = sampleLap(time)[metric]
    points.push(`${index === 0 ? 'M' : 'L'} ${xFor(time).toFixed(2)} ${yFor(value).toFixed(2)}`)
  }

  const markerX = xFor(focusTime)
  const markerY = yFor(currentValue)
  const horizontalGrid = [yMin, (yMin + yMax) / 2, yMax]
  const verticalGrid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap={3} mb={1}>
        <Text fontSize="sm" fontWeight="semibold" color="page.text">
          {label}
        </Text>
        <Text
          fontSize="xs"
          color="page.textSecondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {currentValue.toFixed(1)} {unit}
        </Text>
      </Flex>
      <Box border="1px solid" borderColor="page.border" borderRadius="md" overflow="hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          aria-label={`${label} over time`}
          style={{ display: 'block', background: panelColor }}
        >
          {horizontalGrid.map((value) => {
            const y = yFor(value)
            return (
              <g key={value}>
                <line x1={left} x2={width - right} y1={y} y2={y} stroke={gridColor} />
                <text x={left - 7} y={y + 4} textAnchor="end" fontSize="10" fill={textColor}>
                  {value}
                </text>
              </g>
            )
          })}
          {verticalGrid.map((position) => {
            const x = left + plotWidth * position
            return (
              <line
                key={position}
                x1={x}
                x2={x}
                y1={top}
                y2={height - bottom}
                stroke={gridColor}
              />
            )
          })}
          {metric === 'acceleration' && (
            <line
              x1={left}
              x2={width - right}
              y1={yFor(0)}
              y2={yFor(0)}
              stroke={textColor}
              strokeOpacity="0.45"
            />
          )}
          <path
            d={points.join(' ')}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={top}
            y2={height - bottom}
            stroke={lineColor}
            strokeOpacity="0.25"
            strokeDasharray="4 4"
          />
          <g transform={`translate(${markerX} ${markerY})`}>
            <rect
              x="-8"
              y="-5"
              width="16"
              height="10"
              rx="3"
              fill="#ef4444"
              stroke={panelColor}
              strokeWidth="1.5"
            />
            <path d="M -2 -4 L 4 -3.5 L 4 3.5 L -2 4 Z" fill="#bae6fd" />
            <rect x="-5" y="-7" width="4" height="2.5" rx="1" fill="#0f172a" />
            <rect x="-5" y="4.5" width="4" height="2.5" rx="1" fill="#0f172a" />
            <rect x="3" y="-7" width="4" height="2.5" rx="1" fill="#0f172a" />
            <rect x="3" y="4.5" width="4" height="2.5" rx="1" fill="#0f172a" />
          </g>
          <text x={left} y={height - 7} fontSize="10" fill={textColor}>
            −{PLOT_WINDOW_SECONDS / 2}s
          </text>
          <text x={markerX} y={height - 7} textAnchor="middle" fontSize="10" fill={textColor}>
            {playing ? 'now' : 'selected time'}
          </text>
          <text x={width - right} y={height - 7} textAnchor="end" fontSize="10" fill={textColor}>
            +{PLOT_WINDOW_SECONDS / 2}s
          </text>
        </svg>
      </Box>
      {!playing && metric === 'speed' && (
        <Box mt={2} px={3} py={2} borderLeft="3px solid" borderColor={lineColor} bg={panelColor}>
          <Text mb={0} fontSize="xs" color="page.text" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            The rate of change of speed is the acceleration: Δspeed / Δtime ≈ ({nextValue.toFixed(2)} −{' '}
            {previousValue.toFixed(2)}) / {(2 * TANGENT_SAMPLE_SECONDS).toFixed(2)} ={' '}
            {slope.toFixed(2)} km/h/s = {(slope / 3.6).toFixed(2)} m/s². The acceleration
            plot below shows {currentSample.acceleration.toFixed(2)} m/s² at this same moment.
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default function DerivativeCar() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [playing, setPlaying] = useState(() => !prefersReducedMotion)
  const [liveTime, setLiveTime] = useState(LAP_DURATION)
  const [reviewEnd, setReviewEnd] = useState(LAP_DURATION)
  const [dragging, setDragging] = useState(false)
  const elapsedRef = useRef(LAP_DURATION)
  const pausedAtRef = useRef(LAP_DURATION)
  const dragRef = useRef<{ pointerId: number; startX: number; startEnd: number } | null>(null)

  const cardBg = useColorModeValue('#f8fafc', '#111827')
  const panelBg = useColorModeValue('#ffffff', '#0b1220')
  const grass = useColorModeValue('#dcfce7', '#123524')
  const road = useColorModeValue('#475569', '#64748b')
  const roadEdge = useColorModeValue('#cbd5e1', '#334155')
  const grid = useColorModeValue('#e2e8f0', '#243247')
  const mutedText = useColorModeValue('#64748b', '#94a3b8')
  const speedColor = useColorModeValue('#2563eb', '#60a5fa')
  const accelerationColor = useColorModeValue('#dc2626', '#fb7185')

  useEffect(() => {
    if (!playing) return undefined

    let animationFrame = 0
    let previousTimestamp: number | null = null

    const animate = (timestamp: number) => {
      if (previousTimestamp !== null) {
        const elapsed = Math.min((timestamp - previousTimestamp) / 1000, 0.05)
        elapsedRef.current += elapsed
        setLiveTime(elapsedRef.current)
      }
      previousTimestamp = timestamp
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [playing])

  const visualTime = playing ? liveTime : reviewEnd
  const sample = sampleLap(visualTime)
  const car = pointOnTrack(sample.distance)
  const reviewOffset = pausedAtRef.current - reviewEnd

  const togglePlaying = () => {
    if (playing) {
      const pauseTime = elapsedRef.current
      pausedAtRef.current = pauseTime
      setLiveTime(pauseTime)
      setReviewEnd(pauseTime)
      setPlaying(false)
      return
    }

    elapsedRef.current = reviewEnd
    setLiveTime(reviewEnd)
    setPlaying(true)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (playing) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startEnd: reviewEnd,
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (playing || !drag || drag.pointerId !== event.pointerId) return

    const width = event.currentTarget.getBoundingClientRect().width
    const draggedSeconds = ((event.clientX - drag.startX) / Math.max(width, 1)) * PLOT_WINDOW_SECONDS
    const earliest = pausedAtRef.current - REVIEW_LAPS * LAP_DURATION
    const latest = pausedAtRef.current + REVIEW_LAPS * LAP_DURATION
    const nextTime = Math.min(latest, Math.max(earliest, drag.startEnd - draggedSeconds))
    setReviewEnd(nextTime)
  }

  const endDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <Box
      my={5}
      p={{ base: 3, md: 4 }}
      border="1px solid"
      borderColor="page.border"
      borderRadius="lg"
      bg={cardBg}
    >
      <Box borderRadius="md" overflow="hidden" bg={grass}>
        <svg
          viewBox="0 0 400 210"
          width="100%"
          role="img"
          aria-label={`Car on a closed circuit, ${drivingPhase(sample.distance).toLowerCase()}`}
          style={{ display: 'block', maxHeight: '310px' }}
        >
          <path
            d={TRACK_PATH}
            fill="none"
            stroke={roadEdge}
            strokeWidth="20"
          />
          <path
            d={TRACK_PATH}
            fill="none"
            stroke={road}
            strokeWidth="16"
          />
          <path
            d={TRACK_PATH}
            fill="none"
            stroke="#f8fafc"
            strokeOpacity="0.8"
            strokeWidth="1.5"
            strokeDasharray="8 8"
          />
          <line
            x1="104"
            x2="104"
            y1={TRACK_TOP - 9}
            y2={TRACK_TOP + 9}
            stroke="#f8fafc"
            strokeWidth="2"
          />
          <g
            transform={`translate(${car.x} ${car.y}) rotate(${(car.angle * 180) / Math.PI}) scale(0.72)`}
          >
            <rect x="-11" y="-7" width="22" height="14" rx="4" fill="#ef4444" />
            <path d="M -3 -6 L 5 -5 L 5 5 L -3 6 Z" fill="#bae6fd" />
            <rect x="-7" y="-9" width="6" height="3" rx="1" fill="#0f172a" />
            <rect x="-7" y="6" width="6" height="3" rx="1" fill="#0f172a" />
            <rect x="4" y="-9" width="5" height="3" rx="1" fill="#0f172a" />
            <rect x="4" y="6" width="5" height="3" rx="1" fill="#0f172a" />
          </g>
          <text x="200" y="38" textAnchor="middle" fontSize="13" fontWeight="600" fill={mutedText}>
            {drivingPhase(sample.distance)}
          </text>
          <text x="200" y="64" textAnchor="middle" fontSize="24" fontWeight="700" fill={mutedText}>
            {sample.speed.toFixed(0)} km/h
          </text>
          <text x="200" y="84" textAnchor="middle" fontSize="12" fill={mutedText}>
            acceleration {formatAcceleration(sample.acceleration)}
          </text>
        </svg>
      </Box>

      <Flex mt={3} mb={4} gap={3} align="center" wrap="wrap">
        <Button size="sm" colorScheme="blue" onClick={togglePlaying} minW="5rem">
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Text fontSize="sm" color="page.textSecondary">
          {playing
            ? 'Live: the full curves move beneath the centered car markers.'
            : Math.abs(reviewOffset) < 0.05
              ? 'Paused: drag either plot backward or forward through the repeating laps.'
              : reviewOffset > 0
                ? `Reviewing ${reviewOffset.toFixed(1)} seconds before the pause.`
                : `Reviewing ${Math.abs(reviewOffset).toFixed(1)} seconds after the pause.`}
        </Text>
      </Flex>

      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDragging}
        onPointerCancel={endDragging}
        cursor={playing ? 'default' : dragging ? 'grabbing' : 'grab'}
        sx={{ touchAction: playing ? 'auto' : 'pan-y', userSelect: 'none' }}
        aria-label={playing ? undefined : 'Drag horizontally to review earlier or later plot values'}
      >
        <Box mb={4}>
          <DerivativePlot
            metric="speed"
            liveTime={liveTime}
            reviewEnd={reviewEnd}
            playing={playing}
            lineColor={speedColor}
            gridColor={grid}
            textColor={mutedText}
            panelColor={panelBg}
          />
        </Box>
        <DerivativePlot
          metric="acceleration"
          liveTime={liveTime}
          reviewEnd={reviewEnd}
          playing={playing}
          lineColor={accelerationColor}
          gridColor={grid}
          textColor={mutedText}
          panelColor={panelBg}
        />
      </Box>

      <Text mt={3} mb={0} fontSize="xs" color="page.textSecondary">
        The widget reuses one fixed lap of values, so its history does not grow while it runs.
      </Text>
    </Box>
  )
}
