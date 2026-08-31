import { PROTOTYPE_CONTENT } from './prototype'

export type CollectionCategory = 'weapon' | 'equipment' | 'technique' | 'card' | 'treasure' | 'consumable' | 'spirit'
export type EssenceType = 'daoEssence' | 'spiritEssence' | 'artifactEssence'
export type EquipmentSlot = 'head' | 'robe' | 'feet' | 'charm'
export type AffixId = 'max_hp' | 'attack' | 'defense' | 'opening_energy' | 'tag_discount' | 'shield_power' | 'spirit_combo_power' | 'mark_burst_power' | 'sword_finisher_power'

export interface CollectibleDefinition {
  id: string
  name: string
  category: CollectionCategory
  rarity: 'common' | 'uncommon' | 'rare' | 'legacy'
  tags: string[]
  summary: string
  lore: string
  unlockSource: string
  essenceType: EssenceType
  duplicateEssence: number
  slot?: EquipmentSlot
  affixSlots?: 1 | 2
  artKey?: string
}

const categoryEssence: Record<CollectionCategory, EssenceType> = {
  weapon: 'artifactEssence', equipment: 'artifactEssence', treasure: 'artifactEssence',
  technique: 'daoEssence', card: 'daoEssence', consumable: 'daoEssence', spirit: 'spiritEssence',
}

function item(id: string, name: string, category: CollectionCategory, summary: string, options: Partial<CollectibleDefinition> = {}): CollectibleDefinition {
  return {
    id, name, category, summary,
    rarity: options.rarity ?? 'common', tags: options.tags ?? [],
    lore: options.lore ?? '槐阴古道所得，器上仍留有未散的山雾。',
    unlockSource: options.unlockSource ?? '炼气试演',
    essenceType: categoryEssence[category], duplicateEssence: options.duplicateEssence ?? 12,
    slot: options.slot, affixSlots: options.affixSlots, artKey: options.artKey,
  }
}

/** 稳定素材键；未列出的收藏继续使用统一占位图。 */
export const CORE_COLLECTION_ART_KEYS = {
  azure_wind_sword: 'weapon_azure_wind_sword',
  cinnabar_brush: 'weapon_cinnabar_brush',
  spirit_bell: 'weapon_spirit_bell',
  hidden_edge_art: 'technique_hidden_edge_art',
  edict_talisman_codex: 'technique_edict_talisman_codex',
  hundred_spirit_codex: 'technique_hundred_spirit_codex',
  equipment_hidden_edge_jade: 'equipment_hidden_edge_jade',
  equipment_thunder_coin: 'equipment_thunder_coin',
  equipment_paired_bronze_bell: 'equipment_paired_bronze_bell',
  treasure_crescent_sword_case: 'treasure_crescent_sword_case',
  treasure_mountain_river_inkstone: 'treasure_mountain_river_inkstone',
  treasure_soul_summoning_banner: 'treasure_soul_summoning_banner',
} as const

const equipment = [
  item('equipment_green_bamboo_crown', '青竹束冠', 'equipment', '每打出第 3 张剑式牌，获得 1 点剑意。', { slot: 'head', tags: ['sword'], affixSlots: 1 }),
  item('equipment_cinnabar_crown', '朱砂法冠', 'equipment', '敌人首次获得符印时额外增加 1 层。', { slot: 'head', tags: ['talisman'], affixSlots: 2, rarity: 'uncommon' }),
  item('equipment_hundred_beast_circlet', '百兽额环', 'equipment', '两只妖灵开场各获得 1 点灵契。', { slot: 'head', tags: ['spirit'], affixSlots: 2, rarity: 'uncommon' }),
  item('equipment_wandering_cloud_robe', '游云道袍', 'equipment', '每场战斗首张牌打出后获得护盾。', { slot: 'robe', tags: ['shield'], affixSlots: 1 }),
  item('equipment_talisman_silk_robe', '法绢纸衣', 'equipment', '引爆符印时，按引爆层数获得护盾。', { slot: 'robe', tags: ['talisman', 'shield'], affixSlots: 2, rarity: 'uncommon' }),
  item('equipment_mountain_lord_pelt', '山君皮裘', 'equipment', '妖灵协击后减轻主将下一次受伤。', { slot: 'robe', tags: ['spirit'], affixSlots: 2, rarity: 'rare' }),
  item('equipment_wind_chasing_shoes', '追风履', 'equipment', '前三张不同卡牌的费用总计降低 1 点。', { slot: 'feet', tags: ['sword'], affixSlots: 1 }),
  item('equipment_star_treading_shoes', '踏罡履', 'equipment', '连续打出 3 张符法牌后恢复 1 点灵力。', { slot: 'feet', tags: ['talisman'], affixSlots: 2, rarity: 'uncommon' }),
  item('equipment_tracking_straw_sandals', '寻踪草履', 'equipment', '两只妖灵轮流行动时，下一次妖灵伤害提高。', { slot: 'feet', tags: ['spirit'], affixSlots: 2, rarity: 'uncommon' }),
  item('equipment_hidden_edge_jade', '藏锋玉佩', 'equipment', '剑意上限提高 2，终结伤害提高。', { slot: 'charm', tags: ['sword'], affixSlots: 2, rarity: 'rare', artKey: CORE_COLLECTION_ART_KEYS.equipment_hidden_edge_jade }),
  item('equipment_thunder_coin', '雷纹古钱', 'equipment', '符印引爆伤害提高，过量符印转为灼烧。', { slot: 'charm', tags: ['talisman'], affixSlots: 2, rarity: 'rare', artKey: CORE_COLLECTION_ART_KEYS.equipment_thunder_coin }),
  item('equipment_paired_bronze_bell', '同心铜铃', 'equipment', '两只不同妖灵接连行动时，各获得 1 点灵契。', { slot: 'charm', tags: ['spirit'], affixSlots: 2, rarity: 'rare', artKey: CORE_COLLECTION_ART_KEYS.equipment_paired_bronze_bell }),
]

const treasures = [
  item('treasure_crescent_sword_case', '残月剑匣', 'treasure', '蓄能后释放多段飞剑，读取当前剑意。', { tags: ['sword'], rarity: 'rare', artKey: CORE_COLLECTION_ART_KEYS.treasure_crescent_sword_case }),
  item('treasure_demon_revealing_mirror', '照妖镜', 'treasure', '揭示弱点，使当前目标承受更多标签伤害。', { rarity: 'uncommon' }),
  item('treasure_primordial_gourd', '混元葫芦', 'treasure', '恢复灵力，并让下一张高费牌减耗。', { rarity: 'rare' }),
  item('treasure_demon_binding_rope', '缚妖索', 'treasure', '延后敌人下一次行动。', { rarity: 'uncommon' }),
  item('treasure_mountain_river_inkstone', '山河砚', 'treasure', '为全队提供护盾。', { tags: ['shield'], rarity: 'rare', artKey: CORE_COLLECTION_ART_KEYS.treasure_mountain_river_inkstone }),
  item('treasure_soul_summoning_banner', '招魂幡', 'treasure', '两只妖灵立即各获得 2 点灵契。', { tags: ['spirit'], rarity: 'legacy', artKey: CORE_COLLECTION_ART_KEYS.treasure_soul_summoning_banner }),
]

const consumables = [
  item('consumable_spring_return_pill', '回春丹', 'consumable', '恢复主将生元。'),
  item('consumable_spirit_gathering_pill', '聚灵丹', 'consumable', '立即恢复 3 点灵力。'),
  item('consumable_meridian_guard_pill', '护脉丹', 'consumable', '主将濒危时自动获得护盾。', { rarity: 'uncommon' }),
  item('consumable_evil_breaking_talisman', '破煞符', 'consumable', '清除敌方增益并施加破甲。'),
  item('consumable_armor_escape_talisman', '遁甲符', 'consumable', '为一名友方提供大量护盾。', { rarity: 'uncommon' }),
  item('consumable_thunder_summoning_talisman', '召雷符', 'consumable', '伤害全体敌人，对符印目标额外结算。', { rarity: 'rare' }),
]

const existing = [
  ...Object.values(PROTOTYPE_CONTENT.weapons).map((value) => item(value.id, value.name, 'weapon', '决定基础攻击方式与攻击间隔。', { tags: [value.tag], artKey: CORE_COLLECTION_ART_KEYS[value.id as keyof typeof CORE_COLLECTION_ART_KEYS] })),
  ...Object.values(PROTOTYPE_CONTENT.techniques).map((value) => item(value.id, value.name, 'technique', '决定核心被动与流派资源。', { tags: [value.tag], rarity: 'uncommon', artKey: CORE_COLLECTION_ART_KEYS[value.id as keyof typeof CORE_COLLECTION_ART_KEYS] })),
  ...Object.values(PROTOTYPE_CONTENT.spirits).map((value) => item(value.id, value.name, 'spirit', `${value.title}，可参与自动行动与灵契协击。`, { tags: value.tags, rarity: 'uncommon' })),
  ...Object.values(PROTOTYPE_CONTENT.cards).map((value) => item(value.id, value.name, 'card', value.description, { tags: value.tags })),
]

export const COLLECTION = [...existing, ...equipment, ...treasures, ...consumables]
export const COLLECTION_BY_ID = Object.fromEntries(COLLECTION.map((value) => [value.id, value])) as Record<string, CollectibleDefinition>
export const EQUIPMENT = equipment
export const TREASURES = treasures
export const CONSUMABLES = consumables

export const AFFIXES: Record<AffixId, { name: string; value: number; suffix: string }> = {
  max_hp: { name: '生元', value: 12, suffix: '' }, attack: { name: '攻势', value: 2, suffix: '' }, defense: { name: '护体', value: 3, suffix: '' },
  opening_energy: { name: '开场灵力', value: 1, suffix: '' }, tag_discount: { name: '首张同标签牌减费', value: 1, suffix: '' },
  shield_power: { name: '护盾增幅', value: 8, suffix: '%' }, spirit_combo_power: { name: '妖灵协击增幅', value: 8, suffix: '%' },
  mark_burst_power: { name: '符印引爆增幅', value: 8, suffix: '%' }, sword_finisher_power: { name: '剑意终结增幅', value: 8, suffix: '%' },
}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['head', 'robe', 'feet', 'charm']
