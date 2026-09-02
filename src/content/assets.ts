import { COLLECTION } from './collection'
import { LORE_ENTRIES } from './lore'

export type GameAssetKind = 'background' | 'character' | 'card' | 'texture'
export type GameAssetOrientation = 'square' | 'landscape' | 'portrait'

export interface GameAsset {
  key: string
  file: string
  width: number
  height: number
  kind: GameAssetKind
  bundle: 'shell' | 'travel' | 'battle' | 'character'
}

const background = (key: string, file: string, bundle: GameAsset['bundle'] = 'travel'): GameAsset => ({ key, file, width: 960, height: 540, kind: 'background', bundle })
const character = (key: string, file: string, bundle: GameAsset['bundle'] = 'battle'): GameAsset => ({ key, file, width: 256, height: 256, kind: 'character', bundle })
const card = (key: string, file: string, bundle: GameAsset['bundle'] = 'battle'): GameAsset => ({ key, file, width: 320, height: 180, kind: 'card', bundle })

const reservedCollectionAssets = Object.fromEntries(COLLECTION.map((item) => [item.artKey, item.category === 'card' ? card(item.artKey, `${item.artKey.replaceAll('_', '-')}.png`) : character(item.artKey, `${item.artKey.replaceAll('_', '-')}.png`, 'character')]))
const reservedLoreAssets = Object.fromEntries(LORE_ENTRIES.map((entry) => [entry.artKey, entry.kind === 'event' ? card(entry.artKey, `${entry.artKey.replaceAll('_', '-')}.png`, 'travel') : character(entry.artKey, `${entry.artKey.replaceAll('_', '-')}.png`)]))

export const GAME_ASSETS: Readonly<Record<string, GameAsset>> = {
  ...reservedCollectionAssets,
  ...reservedLoreAssets,
  bg_huaiyin_road: background('bg_huaiyin_road', 'bg-huaiyin-road.png', 'battle'),
  bg_huaiyin_waystation: background('bg_huaiyin_waystation', 'bg-huaiyin-waystation.png', 'battle'),
  bg_huaiyin_roots: background('bg_huaiyin_roots', 'bg-huaiyin-roots.png', 'battle'),
  bg_huaiyin_trial_map: background('bg_huaiyin_trial_map', 'bg-huaiyin-trial-map.png', 'battle'),
  map_mist_road: background('map_mist_road', 'map-mist-road-v1.png', 'travel'),
  map_ruined_waystation: background('map_ruined_waystation', 'map-ruined-waystation-v1.png', 'travel'),
  map_huai_roots: background('map_huai_roots', 'map-huai-roots-v1.png', 'travel'),
  character_cultivator_full: { key: 'character_cultivator_full', file: 'character-cultivator-full-v1.png', width: 512, height: 768, kind: 'character', bundle: 'character' },
  portrait_leader_01: character('portrait_leader_01', 'portrait-leader-01.png'),
  spirit_paper_bride: character('spirit_paper_bride', 'spirit-paper-bride.png'),
  spirit_blade_tail_fox: character('spirit_blade_tail_fox', 'spirit-blade-tail-fox.png'),
  spirit_iron_beak_crane: character('spirit_iron_beak_crane', 'spirit-iron-beak-crane.png'),
  spirit_lantern_ghost: character('spirit_lantern_ghost', 'spirit-lantern-ghost.png'),
  spirit_mountain_child: character('spirit_mountain_child', 'spirit-mountain-child.png'),
  spirit_dream_tapir: character('spirit_dream_tapir', 'spirit-dream-tapir.png'),
  enemy_clay_idol: character('enemy_clay_idol', 'enemy-clay-idol.png'),
  enemy_shadow_civet: character('enemy_shadow_civet', 'enemy-shadow-civet.png'),
  enemy_paper_child: character('enemy_paper_child', 'enemy-paper-child.png'),
  enemy_headless_woodcutter: character('enemy_headless_woodcutter', 'enemy-headless-woodcutter.png'),
  enemy_borrowed_life_crone: character('enemy_borrowed_life_crone', 'enemy-borrowed-life-crone.png'),
  enemy_hundred_eyed_branch: character('enemy_hundred_eyed_branch', 'enemy-hundred-eyed-branch.png'),
  enemy_paper_armor_envoy: character('enemy_paper_armor_envoy', 'enemy-paper-armor-envoy.png'),
  boss_ancient_huai_matriarch: character('boss_ancient_huai_matriarch', 'boss-ancient-huai-matriarch.png'),
  card_guiding_edge: card('card_guiding_edge', 'card-guiding-edge.png'),
  card_fire_talisman: card('card_fire_talisman', 'card-fire-talisman.png'),
  card_call_true_name: card('card_call_true_name', 'card-call-true-name.png'),
  card_mountain_splitter: card('card_mountain_splitter', 'card-mountain-splitter.png'),
  card_nine_heavens_edict: card('card_nine_heavens_edict', 'card-nine-heavens-edict.png'),
  card_night_of_hundred_beasts: card('card_night_of_hundred_beasts', 'card-night-of-hundred-beasts.png'),
  weapon_azure_wind_sword: character('weapon_azure_wind_sword', 'weapon-azure-wind-sword.png', 'character'),
  weapon_cinnabar_brush: character('weapon_cinnabar_brush', 'weapon-cinnabar-brush.png', 'character'),
  weapon_spirit_bell: character('weapon_spirit_bell', 'weapon-spirit-bell.png', 'character'),
  technique_hidden_edge_art: character('technique_hidden_edge_art', 'technique-hidden-edge-art.png', 'character'),
  technique_edict_talisman_codex: character('technique_edict_talisman_codex', 'technique-edict-talisman-codex.png', 'character'),
  technique_hundred_spirit_codex: character('technique_hundred_spirit_codex', 'technique-hundred-spirit-codex.png', 'character'),
  equipment_hidden_edge_jade: character('equipment_hidden_edge_jade', 'equipment-hidden-edge-jade.png', 'character'),
  equipment_thunder_coin: character('equipment_thunder_coin', 'equipment-thunder-coin.png', 'character'),
  equipment_paired_bronze_bell: character('equipment_paired_bronze_bell', 'equipment-paired-bronze-bell.png', 'character'),
  treasure_crescent_sword_case: character('treasure_crescent_sword_case', 'treasure-crescent-sword-case.png', 'character'),
  treasure_mountain_river_inkstone: character('treasure_mountain_river_inkstone', 'treasure-mountain-river-inkstone.png', 'character'),
  treasure_soul_summoning_banner: character('treasure_soul_summoning_banner', 'treasure-soul-summoning-banner.png', 'character'),
  texture_aged_xuan_paper: { key: 'texture_aged_xuan_paper', file: 'texture-aged-xuan-paper.png', width: 64, height: 64, kind: 'texture', bundle: 'shell' },
}

export function assetUrl(key: string) {
  const asset = GAME_ASSETS[key]
  return asset ? `/assets/pixel/${asset.file}` : undefined
}

export function assetOrientation(key: string): GameAssetOrientation | undefined {
  const asset = GAME_ASSETS[key]
  if (!asset) return undefined
  return asset.width === asset.height ? 'square' : asset.width > asset.height ? 'landscape' : 'portrait'
}
