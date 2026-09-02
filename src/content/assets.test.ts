import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { COLLECTION } from './collection'
import { LORE_ENTRIES } from './lore'
import { PROTOTYPE_CONTENT } from './prototype'
import { GAME_ASSETS, assetOrientation, assetUrl } from './assets'

describe('asset registry', () => {
  it('keeps M5.5 map and character assets addressable with fixed dimensions', () => {
    expect(assetUrl('map_mist_road')).toBe('/assets/pixel/map-mist-road-v1.png')
    expect(GAME_ASSETS.character_cultivator_full).toMatchObject({ width: 512, height: 768, kind: 'character', bundle: 'character' })
    expect(GAME_ASSETS.map_huai_roots).toMatchObject({ width: 960, height: 540, kind: 'background', bundle: 'travel' })
  })

  it('uses stable keys for every registered file', () => {
    for (const asset of Object.values(GAME_ASSETS)) expect(assetUrl(asset.key)).toBe(`/assets/pixel/${asset.file}`)
  })

  it('reserves a registered art key for every collection and lore entry', () => {
    expect(COLLECTION).toHaveLength(60)
    expect(LORE_ENTRIES).toHaveLength(22)
    for (const item of COLLECTION) {
      expect(item.artKey, item.id).toBeTruthy()
      expect(GAME_ASSETS[item.artKey], item.id).toBeDefined()
    }
    for (const entry of LORE_ENTRIES) {
      expect(entry.artKey, entry.id).toBeTruthy()
      expect(GAME_ASSETS[entry.artKey], entry.id).toBeDefined()
    }
    for (const spirit of Object.values(PROTOTYPE_CONTENT.spirits)) expect(COLLECTION.find((item) => item.id === spirit.id)?.artKey).toBe(spirit.artKey)
    expect(Object.values(PROTOTYPE_CONTENT.cards).every((card) => Boolean(card.artKey))).toBe(true)
  })

  it('keeps card and character art dimensions distinct for layout consumers', () => {
    expect(assetOrientation('card_guiding_edge')).toBe('landscape')
    expect(assetOrientation('spirit_blade_tail_fox')).toBe('square')
    expect(assetOrientation('event_roadside_red_sedan')).toBe('landscape')
  })

  it('ships every codex image with the declared PNG budget and format', () => {
    const root = resolve(process.cwd(), 'public/assets/pixel')
    let totalBytes = 0
    for (const asset of Object.values(GAME_ASSETS)) {
      const path = resolve(root, asset.file)
      if (!existsSync(path)) continue
      totalBytes += statSync(path).size
    }
    expect(totalBytes).toBeLessThanOrEqual(12 * 1024 * 1024)
    for (const entry of [...COLLECTION, ...LORE_ENTRIES]) {
      const asset = GAME_ASSETS[entry.artKey]
      const path = resolve(root, asset.file)
      expect(existsSync(path), entry.id).toBe(true)
      const png = readFileSync(path)
      expect(png.subarray(0, 8).toString('hex'), entry.id).toBe('89504e470d0a1a0a')
      const width = png.readUInt32BE(16)
      const height = png.readUInt32BE(20)
      const colorType = png[25]
      if (('category' in entry && entry.category === 'card') || ('kind' in entry && entry.kind === 'event')) {
        expect([width, height, colorType], entry.id).toEqual([320, 180, 3])
        expect(statSync(path).size, entry.id).toBeLessThanOrEqual(80 * 1024)
      } else {
        expect([width, height, colorType], entry.id).toEqual([256, 256, 6])
        expect(statSync(path).size, entry.id).toBeLessThanOrEqual(160 * 1024)
      }
    }
  })
})
