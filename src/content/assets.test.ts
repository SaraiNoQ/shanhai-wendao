import { describe, expect, it } from 'vitest'
import { GAME_ASSETS, assetUrl } from './assets'

describe('asset registry', () => {
  it('keeps M5.5 map and character assets addressable with fixed dimensions', () => {
    expect(assetUrl('map_mist_road')).toBe('/assets/pixel/map-mist-road-v1.png')
    expect(GAME_ASSETS.character_cultivator_full).toMatchObject({ width: 512, height: 768, kind: 'character', bundle: 'character' })
    expect(GAME_ASSETS.map_huai_roots).toMatchObject({ width: 960, height: 540, kind: 'background', bundle: 'travel' })
  })

  it('uses stable keys for every registered file', () => {
    for (const asset of Object.values(GAME_ASSETS)) expect(assetUrl(asset.key)).toBe(`/assets/pixel/${asset.file}`)
  })
})
