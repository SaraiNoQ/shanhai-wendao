import { useEffect, useRef, useState } from 'react'
import { assetUrl as gameAssetUrl } from '../content/assets'
import type { BattleCardReference, BattleEvent, BattleState, UnitId, UnitState } from '../game/types'
import './BattleScene.css'

export type BattleVisualCue = {
  key: string
  kind: 'hit' | 'heal' | 'shield' | 'card' | 'summon' | 'phase'
  sourceId?: string
  targetId?: UnitId
  amount?: number
}

// eslint-disable-next-line react/only-export-components
export function battleEventsToVisualCues(events: readonly BattleEvent[]): BattleVisualCue[] {
  return events.flatMap((event, index): BattleVisualCue[] => {
    if (event.type === 'damage') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'hit', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount + event.shieldAbsorbed }]
    if (event.type === 'heal') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'heal', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount }]
    if (event.type === 'shield') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'shield', sourceId: event.sourceId, targetId: event.targetId, amount: event.amount }]
    if (event.type === 'card_played') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'card', sourceId: event.cardId }]
    if (event.type === 'unit_summoned') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'summon', sourceId: event.sourceId, targetId: event.unitId }]
    if (event.type === 'boss_phase_changed') return [{ key: `${index}:${event.type}:${event.atMs}`, kind: 'phase' }]
    return []
  })
}

export interface BattleSceneProps {
  battle: BattleState<BattleCardReference>
  events: readonly BattleEvent[]
  backgroundUrl: string
  reducedMotion?: boolean
  className?: string
}

function unitKey(unit: UnitState, index: number) { return `${unit.id}:${index}` }

interface BattlePixiScene {
  updateState: (battle: BattleState<BattleCardReference>) => void
  pushEvents: (events: readonly BattleEvent[]) => void
  setReducedMotion: (reducedMotion: boolean) => void
  destroy: () => void
}

async function createBattlePixiScene(host: HTMLDivElement, initial: BattleState<BattleCardReference>, events: readonly BattleEvent[], backgroundUrl: string, reducedMotion: boolean): Promise<BattlePixiScene> {
  const pixi = await import('pixi.js')
  const app = new pixi.Application()
  await app.init({ resizeTo: host, background: 0x080d0c, antialias: false, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), preference: 'webgl' })
  host.appendChild(app.canvas)
  app.ticker.maxFPS = 60

  const root = new pixi.Container()
  const effects = new pixi.Container()
  app.stage.addChild(root, effects)
  const spriteMap = new Map<string, import('pixi.js').Sprite>()
  let cursor = 0
  let motionReduced = reducedMotion
  let destroyed = false

  const pointFor = (id: string | undefined, state: BattleState<BattleCardReference>) => {
    if (id === 'leader') return { x: 0.2, y: 0.64 }
    const spiritIndex = state.spirits.findIndex((spirit) => spirit.id === id)
    if (spiritIndex >= 0) return { x: 0.34, y: spiritIndex ? 0.66 : 0.46 }
    const enemyIndex = state.enemies.findIndex((enemy) => enemy.id === id)
    return enemyIndex >= 0 ? { x: 0.76 + (enemyIndex % 3) * 0.08, y: 0.34 + Math.floor(enemyIndex / 3) * 0.2 } : { x: 0.5, y: 0.5 }
  }

  const draw = async (state: BattleState<BattleCardReference>) => {
    if (destroyed) return
    for (const child of root.removeChildren()) child.destroy()
    spriteMap.clear()
    const width = Math.max(1, host.clientWidth || 960)
    const height = Math.max(1, host.clientHeight || width * 9 / 16)
    const backdrop = new pixi.Graphics().rect(0, 0, width, height).fill({ color: 0x080d0c })
    root.addChild(backdrop)
    try {
      const texture = await pixi.Assets.load(backgroundUrl)
      texture.source.scaleMode = 'nearest'
      const background = new pixi.Sprite(texture)
      background.width = width
      background.height = height
      root.addChild(background)
    } catch { /* static fallback remains visible below the canvas */ }
    root.addChild(new pixi.Graphics().rect(0, 0, width, height).fill({ color: 0x07100d, alpha: 0.38 }))
    const units = [...state.spirits, ...state.enemies, state.leader]
    await Promise.all(units.map(async (unit, index) => {
      const url = gameAssetUrl(unit.artKey ?? '')
      if (!url) return
      try {
        const texture = await pixi.Assets.load(url)
        texture.source.scaleMode = 'nearest'
        const sprite = new pixi.Sprite(texture)
        const point = pointFor(unit.id, state)
        const scale = unit.id === 'leader' ? 0.3 : state.enemies.some((enemy) => enemy.id === unit.id) ? 0.22 : 0.18
        sprite.anchor.set(0.5, 0.7)
        sprite.width = 256 * scale
        sprite.height = 256 * scale
        sprite.x = point.x * width
        sprite.y = point.y * height
        sprite.alpha = unit.hp > 0 ? 0.95 : 0.2
        root.addChild(sprite)
        spriteMap.set(unitKey(unit, index), sprite)
      } catch { /* units without an image stay represented by the DOM cards */ }
    }))
  }

  const updateState = (state: BattleState<BattleCardReference>) => {
    const width = Math.max(1, host.clientWidth || 960)
    const height = Math.max(1, host.clientHeight || width * 9 / 16)
    const units = [...state.spirits, ...state.enemies, state.leader]
    units.forEach((unit, index) => {
      const sprite = spriteMap.get(unitKey(unit, index))
      if (!sprite) return
      const point = pointFor(unit.id, state)
      sprite.x = point.x * width
      sprite.y = point.y * height
      sprite.alpha = unit.hp > 0 ? 0.95 : 0.2
    })
  }

  const pushEvents = (nextEvents: readonly BattleEvent[]) => {
    if (nextEvents.length < cursor) cursor = 0
    const cues = battleEventsToVisualCues(nextEvents).slice(cursor)
    cursor = battleEventsToVisualCues(nextEvents).length
    if (motionReduced) return
    const width = Math.max(1, host.clientWidth || 960)
    const height = Math.max(1, host.clientHeight || width * 9 / 16)
    for (const cue of cues.slice(-12)) {
      if (cue.kind === 'phase') {
        const flash = new pixi.Graphics().rect(0, 0, width, height).fill({ color: 0xc74e39, alpha: 0.24 })
        effects.addChild(flash)
        window.setTimeout(() => flash.destroy(), 480)
        continue
      }
      const source = pointFor(cue.sourceId, initial)
      const target = pointFor(cue.targetId, initial)
      const color = cue.kind === 'hit' ? 0xd35d46 : cue.kind === 'shield' ? 0xd0ad64 : cue.kind === 'heal' ? 0x8fd4bd : 0xf0dda8
      const line = new pixi.Graphics().moveTo(source.x * width, source.y * height).lineTo(target.x * width, target.y * height).stroke({ width: 3, color, alpha: 0.85 })
      effects.addChild(line)
      window.setTimeout(() => line.destroy(), cue.kind === 'card' ? 360 : 260)
      if (cue.amount !== undefined && cue.kind !== 'card') {
        const label = new pixi.Text({ text: `${cue.kind === 'hit' ? '-' : '+'}${cue.amount}`, style: { fill: color, fontSize: 16, fontFamily: 'monospace', stroke: { color: 0x080d0c, width: 4 } } })
        label.anchor.set(0.5)
        label.x = target.x * width
        label.y = target.y * height - 28
        effects.addChild(label)
        window.setTimeout(() => label.destroy(), 620)
      }
    }
  }

  await draw(initial)
  pushEvents(events)
  const onVisibility = () => { if (document.hidden) app.ticker.stop(); else if (!motionReduced) app.ticker.start() }
  document.addEventListener('visibilitychange', onVisibility)
  if (motionReduced || document.hidden) app.ticker.stop()
  return {
    updateState,
    pushEvents,
    setReducedMotion: (value) => { motionReduced = value; if (value || document.hidden) app.ticker.stop(); else app.ticker.start() },
    destroy: () => { if (destroyed) return; destroyed = true; document.removeEventListener('visibilitychange', onVisibility); app.ticker.stop(); app.destroy({ removeView: true }) },
  }
}

export function BattleScene({ battle, events, backgroundUrl, reducedMotion = false, className = '' }: BattleSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BattlePixiScene | undefined>(undefined)
  const inputRef = useRef({ battle, events, reducedMotion })
  const [renderer, setRenderer] = useState<'loading' | 'pixi' | 'fallback'>('loading')
  useEffect(() => { inputRef.current = { battle, events, reducedMotion } }, [battle, events, reducedMotion])

  useEffect(() => {
    const host = mountRef.current
    if (!host) return
    let cancelled = false
    setRenderer('loading')
    const input = inputRef.current
    void createBattlePixiScene(host, input.battle, input.events, backgroundUrl, input.reducedMotion).then((scene) => {
      if (cancelled) { scene.destroy(); return }
      sceneRef.current?.destroy()
      sceneRef.current = scene
      setRenderer('pixi')
    }).catch(() => { if (!cancelled) setRenderer('fallback') })
    return () => { cancelled = true; sceneRef.current?.destroy(); sceneRef.current = undefined }
  }, [battle.seed, backgroundUrl])

  useEffect(() => { sceneRef.current?.updateState(battle) }, [battle])
  useEffect(() => { sceneRef.current?.pushEvents(events); sceneRef.current?.setReducedMotion(reducedMotion) }, [events, reducedMotion])

  return <div className={`battle-scene renderer-${renderer} ${className}`} aria-hidden="true"><div ref={mountRef} className="battle-scene-canvas" /><div className="battle-scene-fallback" style={{ backgroundImage: `url("${backgroundUrl}")` }} /></div>
}
