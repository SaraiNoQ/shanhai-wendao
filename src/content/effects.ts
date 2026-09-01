export interface EffectSpec {
  effectId: string
  params: Record<string, number | string | boolean>
  scalableParams?: string[]
}

/** Non-card collectible effects are content data so battle rules and detail UI share the same values. */
export const COLLECTIBLE_EFFECTS: Readonly<Record<string, EffectSpec>> = {
  equipment_green_bamboo_crown: { effectId: 'sword_card_streak', params: { cards: 3, swordIntent: 1 } },
  equipment_cinnabar_crown: { effectId: 'first_mark_bonus', params: { marks: 1 } },
  equipment_hundred_beast_circlet: { effectId: 'opening_spirit_bond', params: { spiritBond: 1 } },
  equipment_wandering_cloud_robe: { effectId: 'first_card_shield', params: { shield: 12 }, scalableParams: ['shield'] },
  equipment_talisman_silk_robe: { effectId: 'mark_burst_shield', params: { shieldPerMark: 2 }, scalableParams: ['shieldPerMark'] },
  equipment_mountain_lord_pelt: { effectId: 'spirit_combo_guard', params: { shield: 8 }, scalableParams: ['shield'] },
  equipment_wind_chasing_shoes: { effectId: 'weapon_tag_discount', params: { discount: 1, target: '武器同标签首张牌' } },
  equipment_star_treading_shoes: { effectId: 'talisman_streak_energy', params: { cards: 3, energy: 1 } },
  equipment_tracking_straw_sandals: { effectId: 'alternating_spirit_damage', params: { powerPercent: 25 } },
  equipment_hidden_edge_jade: { effectId: 'sword_finisher_cap', params: { swordIntentCap: 12, finisherPercent: 108 } },
  equipment_thunder_coin: { effectId: 'overflow_mark_burn', params: { burstPercent: 108, burnPerOverflow: 1 } },
  equipment_paired_bronze_bell: { effectId: 'alternating_spirit_bond', params: { spiritBond: 1 } },
  treasure_crescent_sword_case: { effectId: 'sword_case_barrage', params: { hits: 3, powerPercent: 80, intentPercent: 5 }, scalableParams: ['powerPercent', 'intentPercent'] },
  treasure_demon_revealing_mirror: { effectId: 'reveal_weakness', params: { armorBreak: 2, marks: 1 } },
  treasure_primordial_gourd: { effectId: 'gourd_refill', params: { energy: 3, finisherDiscount: 2 } },
  treasure_demon_binding_rope: { effectId: 'bind_enemy', params: { delayMs: 4_000 }, scalableParams: ['delayMs'] },
  treasure_mountain_river_inkstone: { effectId: 'inkstone_shield', params: { shield: 36, targets: '全队' }, scalableParams: ['shield'] },
  treasure_soul_summoning_banner: { effectId: 'summon_bonds', params: { spiritBond: 2, targets: 2 } },
  consumable_spring_return_pill: { effectId: 'spring_heal', params: { healPercent: 35 }, scalableParams: ['healPercent'] },
  consumable_spirit_gathering_pill: { effectId: 'gather_spirit', params: { energy: 3 } },
  consumable_meridian_guard_pill: { effectId: 'meridian_guard', params: { shield: 40, triggerPercent: 30 }, scalableParams: ['shield'] },
  consumable_evil_breaking_talisman: { effectId: 'break_evil', params: { armorBreak: 2, clearAttackBonus: true } },
  consumable_armor_escape_talisman: { effectId: 'armor_escape', params: { shield: 50, targets: '单个友方' }, scalableParams: ['shield'] },
  consumable_thunder_summoning_talisman: { effectId: 'summon_thunder', params: { powerPercent: 120, marksDetonated: 1, targets: '全体敌人' }, scalableParams: ['powerPercent'] },
}
