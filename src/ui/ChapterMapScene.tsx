import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  CHAPTERS,
  STAGES,
  getChapterRouteSegments,
  getUnlockedChapters,
  type ChapterDefinition,
  type ChapterId,
  type MapRouteSegment,
} from '../content/stages'
import { assetUrl } from '../content/assets'
import './ChapterMapScene.css'

export interface ChapterDustPoint {
  x: number
  y: number
  radius: number
  alpha: number
}

export interface ChapterMapVisualCue {
  mapArtKey: string
  route: readonly MapRouteSegment[]
  dust: readonly ChapterDustPoint[]
  pulseStage?: number
  animated: boolean
}

export interface ChapterMapSceneProps {
  chapter: ChapterDefinition
  highestClearedStage: number
  activeStage: number
  selectedStage?: number
  onSelectStage: (stageNumber: number) => void
  onChapterChange?: (chapterId: ChapterId) => void
  mapArtUrls?: Partial<Record<ChapterId, string>>
  reducedMotion?: boolean
  className?: string
}

const DEFAULT_MAP_ART_URLS: Record<ChapterId, string> = {
  mist_road: assetUrl('map_mist_road')!,
  ruined_waystation: assetUrl('map_ruined_waystation')!,
  huai_roots: assetUrl('map_huai_roots')!,
}

const DUST_POINTS: readonly ChapterDustPoint[] = [
  { x: 11, y: 14, radius: 2.2, alpha: 0.2 },
  { x: 24, y: 27, radius: 1.5, alpha: 0.25 },
  { x: 37, y: 12, radius: 1.7, alpha: 0.18 },
  { x: 48, y: 25, radius: 2.4, alpha: 0.2 },
  { x: 63, y: 15, radius: 1.3, alpha: 0.24 },
  { x: 77, y: 29, radius: 2.1, alpha: 0.17 },
  { x: 89, y: 13, radius: 1.8, alpha: 0.22 },
  { x: 16, y: 51, radius: 1.4, alpha: 0.2 },
  { x: 31, y: 78, radius: 2.1, alpha: 0.16 },
  { x: 55, y: 68, radius: 1.6, alpha: 0.24 },
  { x: 72, y: 82, radius: 2.3, alpha: 0.18 },
  { x: 91, y: 66, radius: 1.5, alpha: 0.22 },
]

// eslint-disable-next-line react/only-export-components
export function getChapterMapVisualCue(chapter: ChapterDefinition, activeStage: number, reducedMotion = false): ChapterMapVisualCue {
  const hasActiveStage = activeStage >= chapter.startStage && activeStage <= chapter.endStage
  return {
    mapArtKey: chapter.mapArtKey,
    route: getChapterRouteSegments(chapter),
    dust: reducedMotion ? [] : DUST_POINTS,
    pulseStage: hasActiveStage ? activeStage : undefined,
    animated: !reducedMotion,
  }
}

function stageIsReachable(stageNumber: number, highestClearedStage: number) {
  return stageNumber <= highestClearedStage + 1
}

function chapterIndex(chapterId: ChapterId) {
  return CHAPTERS.findIndex((chapter) => chapter.id === chapterId)
}

function stagePoint(stageNumber: number) {
  const stage = STAGES.find((item) => item.stageNumber === stageNumber)
  return stage?.mapPosition ?? { x: 50, y: 50 }
}

function mapArtUrl(chapterId: ChapterId, mapArtUrls?: Partial<Record<ChapterId, string>>) {
  return mapArtUrls?.[chapterId] ?? DEFAULT_MAP_ART_URLS[chapterId]
}

interface PixiScene {
  redraw: (chapter: ChapterDefinition, activeStage: number, reducedMotion: boolean) => void
  destroy: () => void
}

async function createPixiScene(host: HTMLDivElement, initialChapter: ChapterDefinition, activeStage: number, reducedMotion: boolean, imageUrl: string): Promise<PixiScene> {
  const pixi = await import('pixi.js')
  const app = new pixi.Application()
  await app.init({
    resizeTo: host,
    background: 0x080d0c,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  })
  host.appendChild(app.canvas)

  let texture: import('pixi.js').Texture | undefined
  try {
    texture = await pixi.Assets.load(imageUrl)
  } catch {
    texture = undefined
  }

  const root = new pixi.Container()
  app.stage.addChild(root)
  const dustSprites: import('pixi.js').Graphics[] = []
  let pulseRing: import('pixi.js').Graphics | undefined
  let pulseInner: import('pixi.js').Graphics | undefined
  let pulseTime = 0
  let currentChapter = initialChapter
  let currentActiveStage = activeStage
  let motionReduced = reducedMotion
  let destroyed = false

  const redraw = (chapter: ChapterDefinition, nextActiveStage: number, nextReducedMotion: boolean) => {
    if (destroyed) return
    currentChapter = chapter
    currentActiveStage = nextActiveStage
    motionReduced = nextReducedMotion
    for (const child of root.removeChildren()) child.destroy()
    dustSprites.length = 0
    pulseRing = undefined
    pulseInner = undefined
    const width = Math.max(1, host.clientWidth || 960)
    const height = Math.max(1, host.clientHeight || width * 9 / 16)
    const cue = getChapterMapVisualCue(chapter, nextActiveStage, nextReducedMotion)

    const base = new pixi.Graphics().rect(0, 0, width, height).fill({ color: 0x080d0c })
    root.addChild(base)
    if (texture) {
      const background = new pixi.Sprite(texture)
      background.width = width
      background.height = height
      root.addChild(background)
    }

    const wash = new pixi.Graphics().rect(0, 0, width, height).fill({ color: 0x08100d, alpha: 0.38 })
    root.addChild(wash)
    const route = new pixi.Graphics()
    for (const segment of cue.route) {
      route.moveTo(segment.from.x / 100 * width, segment.from.y / 100 * height)
      route.lineTo(segment.to.x / 100 * width, segment.to.y / 100 * height)
    }
    route.stroke({ width: Math.max(2, width / 420), color: 0xd0ad64, alpha: 0.52 })
    root.addChild(route)

    const fog = new pixi.Graphics()
    fog.ellipse(width * 0.16, height * 0.78, width * 0.26, height * 0.13).fill({ color: 0x0e1e1a, alpha: 0.33 })
    fog.ellipse(width * 0.84, height * 0.25, width * 0.28, height * 0.18).fill({ color: 0x122721, alpha: 0.25 })
    root.addChild(fog)

    for (const point of cue.dust) {
      const dust = new pixi.Graphics().circle(point.x / 100 * width, point.y / 100 * height, point.radius).fill({ color: 0x86c2b0, alpha: point.alpha })
      dustSprites.push(dust)
      root.addChild(dust)
    }

    if (cue.pulseStage !== undefined) {
      const point = stagePoint(cue.pulseStage)
      const x = point.x / 100 * width
      const y = point.y / 100 * height
      pulseRing = new pixi.Graphics().circle(x, y, 20).stroke({ width: 2, color: 0x9dd8c1, alpha: 0.62 })
      pulseInner = new pixi.Graphics().circle(x, y, 10).fill({ color: 0xc74e39, alpha: 0.52 })
      root.addChild(pulseRing, pulseInner)
    }
  }

  const tick = (ticker: { deltaTime: number }) => {
    if (motionReduced || !pulseRing || !pulseInner) return
    pulseTime += ticker.deltaTime / 60
    const wave = (Math.sin(pulseTime * Math.PI * 2) + 1) / 2
    pulseRing.alpha = 0.38 + wave * 0.45
    pulseRing.scale.set(0.8 + wave * 0.28)
    pulseInner.alpha = 0.34 + (1 - wave) * 0.28
    dustSprites.forEach((dust, index) => { dust.alpha = 0.72 + Math.sin(pulseTime * 0.4 + index) * 0.2 })
  }

  redraw(initialChapter, activeStage, reducedMotion)
  app.ticker.add(tick)
  if (reducedMotion || document.hidden) app.ticker.stop()
  const onVisibilityChange = () => { if (document.hidden) app.ticker.stop(); else if (!motionReduced) app.ticker.start() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => redraw(currentChapter, currentActiveStage, motionReduced))
  resizeObserver?.observe(host)

  return {
    redraw,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      resizeObserver?.disconnect()
      app.ticker.stop()
      app.ticker.remove(tick)
      app.destroy({ removeView: true })
    },
  }
}

function MapNodes({ chapter, highestClearedStage, activeStage, selectedStage, onSelectStage }: Pick<ChapterMapSceneProps, 'chapter' | 'highestClearedStage' | 'activeStage' | 'selectedStage' | 'onSelectStage'>) {
  const stages = useMemo(() => STAGES.filter((stage) => stage.regionId === chapter.id), [chapter.id])
  return <div className="chapter-map-nodes" aria-label={`${chapter.name}关卡节点`}>
    {stages.map((stage) => {
      const cleared = stage.stageNumber <= highestClearedStage
      const current = stage.stageNumber === activeStage
      const selected = stage.stageNumber === selectedStage
      const reachable = stageIsReachable(stage.stageNumber, highestClearedStage)
      return <button
        key={stage.id}
        type="button"
        className={`chapter-map-node ${cleared ? 'is-cleared' : ''} ${current ? 'is-current' : ''} ${selected ? 'is-selected' : ''} ${stage.isRealmGate ? 'is-gate' : ''} ${reachable ? '' : 'is-locked'}`}
        style={{ left: `${stage.mapPosition.x}%`, top: `${stage.mapPosition.y}%` }}
        disabled={!reachable}
        aria-current={current ? 'step' : undefined}
        aria-pressed={selected}
        aria-label={`第${stage.stageNumber}关 ${stage.name}${cleared ? '，已通关' : current ? '，当前推进' : reachable ? '，可挑战' : '，尚未解锁'}`}
        onClick={() => onSelectStage(stage.stageNumber)}
      >
        <span className="chapter-map-node-ring" aria-hidden="true">{stage.isRealmGate ? '劫' : cleared ? '✓' : stage.stageNumber}</span>
        <span className="chapter-map-node-name">{stage.name}</span>
      </button>
    })}
  </div>
}

export function ChapterMapScene({ chapter, highestClearedStage, activeStage, selectedStage, onSelectStage, onChapterChange, mapArtUrls, reducedMotion = false, className = '' }: ChapterMapSceneProps) {
  const pixiMountRef = useRef<HTMLDivElement>(null)
  const pixiSceneRef = useRef<PixiScene | undefined>(undefined)
  const scenePropsRef = useRef({ chapter, activeStage, reducedMotion })
  const [renderer, setRenderer] = useState<'loading' | 'pixi' | 'fallback'>('loading')
  const chapterUrl = mapArtUrl(chapter.id, mapArtUrls)
  const cue = getChapterMapVisualCue(chapter, activeStage, reducedMotion)
  const unlocked = useMemo(() => new Set(getUnlockedChapters({ highestClearedStage }).map((item) => item.id)), [highestClearedStage])
  const chapterNumber = chapterIndex(chapter.id) + 1
  const selected = selectedStage ?? activeStage
  const fallbackStyle = { '--chapter-map-image': `url("${chapterUrl}")` } as CSSProperties

  useEffect(() => { scenePropsRef.current = { chapter, activeStage, reducedMotion } }, [chapter, activeStage, reducedMotion])

  useEffect(() => {
    let cancelled = false
    const host = pixiMountRef.current
    if (!host) return
    setRenderer('loading')
    const initial = scenePropsRef.current
    void createPixiScene(host, initial.chapter, initial.activeStage, initial.reducedMotion, chapterUrl).then((scene) => {
      if (cancelled) { scene.destroy(); return }
      pixiSceneRef.current?.destroy()
      pixiSceneRef.current = scene
      setRenderer('pixi')
    }).catch(() => { if (!cancelled) setRenderer('fallback') })
    return () => {
      cancelled = true
      pixiSceneRef.current?.destroy()
      pixiSceneRef.current = undefined
    }
  }, [chapter.id, chapterUrl])

  useEffect(() => {
    const current = scenePropsRef.current
    pixiSceneRef.current?.redraw(current.chapter, current.activeStage, current.reducedMotion)
  }, [chapter.id, activeStage, reducedMotion])

  const moveChapter = (offset: number) => {
    if (!onChapterChange) return
    const next = CHAPTERS[chapterIndex(chapter.id) + offset]
    if (next && unlocked.has(next.id)) onChapterChange(next.id)
  }

  return <section className={`chapter-map-scene ${className} renderer-${renderer}`} style={fallbackStyle} onKeyDown={(event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveChapter(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveChapter(1) }
  }} aria-labelledby="chapter-map-title">
    <header className="chapter-map-header">
      <div><span className="chapter-map-kicker">LINEAR ROUTE · 山河图</span><h2 id="chapter-map-title">{chapter.name}</h2><p>{chapter.subtitle} · 第 {chapter.startStage}—{chapter.endStage} 关</p></div>
      <div className="chapter-map-switcher" aria-label="章节切换">
        <button type="button" aria-label="上一章" disabled={!onChapterChange || chapterNumber <= 1 || !unlocked.has(CHAPTERS[chapterNumber - 2]?.id)} onClick={() => moveChapter(-1)}>‹</button>
        {CHAPTERS.map((item, index) => <button key={item.id} type="button" className={item.id === chapter.id ? 'is-active' : ''} disabled={!onChapterChange || !unlocked.has(item.id)} aria-pressed={item.id === chapter.id} aria-label={`${item.name}${unlocked.has(item.id) ? '' : `，通关第${item.unlockAfterStage}关后解锁`}`} onClick={() => onChapterChange?.(item.id)}><span>{['壹', '贰', '叁'][index]}</span>{item.name}{!unlocked.has(item.id) && <small>锁</small>}</button>)}
        <button type="button" aria-label="下一章" disabled={!onChapterChange || chapterNumber >= CHAPTERS.length || !unlocked.has(CHAPTERS[chapterNumber]?.id)} onClick={() => moveChapter(1)}>›</button>
      </div>
    </header>
    <div className="chapter-map-viewport">
      <div ref={pixiMountRef} className="chapter-map-pixi" aria-hidden="true" />
      <div className="chapter-map-fallback" aria-hidden={renderer === 'pixi'}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={cue.route.map((segment) => `${segment.from.x},${segment.from.y} ${segment.to.x},${segment.to.y}`).join(' ')} /></svg>
        {!reducedMotion && <div className="chapter-map-fallback-fog" aria-hidden="true" />}
      </div>
      <MapNodes chapter={chapter} highestClearedStage={highestClearedStage} activeStage={activeStage} selectedStage={selected} onSelectStage={onSelectStage} />
      {renderer === 'loading' && <p className="chapter-map-loading" role="status">正在展开山河图……</p>}
    </div>
    <footer className="chapter-map-footer"><span>当前推进：第 {activeStage} 关</span><span>查看节点不会改变推进目标</span><span>{cue.animated ? '墨尘随风' : '减弱动态'}</span></footer>
  </section>
}
