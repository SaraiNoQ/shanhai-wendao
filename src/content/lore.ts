import type { TrialEncounterId, TrialEventId } from './trial'

export type LoreEntryKind = 'enemy' | 'event'

export interface LoreEntryBase {
  id: string
  kind: LoreEntryKind
  name: string
  title: string
  summary: string
  lore: string
  loreKey: string
  artKey?: string
}

export interface EnemyLoreEntry extends LoreEntryBase {
  id: TrialEncounterId
  kind: 'enemy'
  rank: 'common' | 'elite' | 'boss'
}

export interface EventLoreEntry extends LoreEntryBase {
  id: TrialEventId
  kind: 'event'
  bodyKey: string
}

export type LoreEntry = EnemyLoreEntry | EventLoreEntry

export const ENEMY_LORE: readonly EnemyLoreEntry[] = [
  { id: 'shadow_civet', kind: 'enemy', rank: 'common', name: '影狸', title: '雾中窃影', summary: '会偷走旅人影子的狸兽。', lore: '影狸不先伤人，只把脚下的影子叼走。失去影子的人在槐阴古道上走不出第二个岔口。', loreKey: 'lore_enemy_shadow_civet', artKey: 'enemy_shadow_civet' },
  { id: 'withered_vine_spirit', kind: 'enemy', rank: 'common', name: '枯藤魅', title: '朽根缠生', summary: '借枯根护身的藤木精怪。', lore: '它曾是驿道旁的一截老藤，吸饱了过路人的叹息，便学会在朽木中结出一层护壳。', loreKey: 'lore_enemy_withered_vine_spirit' },
  { id: 'paper_child', kind: 'enemy', rank: 'common', name: '纸面童', title: '纸扎成群', summary: '由白纸和旧竹架扎成的低阶伥物。', lore: '纸面童没有自己的脸，谁在它面前哭过，它便把谁的神情贴在脸上，随夜风成群行走。', loreKey: 'lore_enemy_paper_child', artKey: 'enemy_paper_child' },
  { id: 'corpse_lantern_moth', kind: 'enemy', rank: 'common', name: '尸灯蛾', title: '尸火扑面', summary: '追逐尸火并留下灼痕的夜蛾。', lore: '尸灯蛾的翅粉沾过棺中灯油，落在活人身上便会点起不肯熄灭的冷火。', loreKey: 'lore_enemy_corpse_lantern_moth' },
  { id: 'title_seeking_immortal', kind: 'enemy', rank: 'common', name: '讨封黄仙', title: '借口成人', summary: '以一句称谓换取修行机缘的黄仙。', lore: '它拦路并非只为争胜，而是想从过客口中借一句“仙家”。说出口的人，往往也把一缕运势留在了雾里。', loreKey: 'lore_enemy_title_seeking_immortal' },
  { id: 'clay_idol', kind: 'enemy', rank: 'common', name: '泥胎傀', title: '负土成形', summary: '以湿土和镇钉维持形体的泥祠傀儡。', lore: '泥胎傀守着一座没有香火的祠，身上的裂缝越多，里面埋着的旧愿便越清晰。', loreKey: 'lore_enemy_clay_idol', artKey: 'enemy_clay_idol' },
  { id: 'coin_corpse', kind: 'enemy', rank: 'common', name: '铜钱尸', title: '钱眼通阴', summary: '用古钱封住七窍的行尸。', lore: '铜钱尸以钱眼辨认活人，临死前攥得越紧，死后便越不肯把那笔账放下。', loreKey: 'lore_enemy_coin_corpse' },
  { id: 'night_wandering_thrall', kind: 'enemy', rank: 'common', name: '夜游伥', title: '逐灵而噬', summary: '专挑气息最弱的妖灵下口的伥鬼。', lore: '夜游伥没有完整的魂魄，只能循着最微弱的灵息寻找下一段梦。', loreKey: 'lore_enemy_night_wandering_thrall' },
  { id: 'grave_crow_flock', kind: 'enemy', rank: 'common', name: '墓鸦群', title: '群喙叩骨', summary: '以低声啼鸣扰乱心神的墓地乌鸦。', lore: '墓鸦只在没有月亮的夜里成群飞起，三声啄响之后，坟中人和路上人便再难分清。', loreKey: 'lore_enemy_grave_crow_flock' },
  { id: 'headless_woodcutter', kind: 'enemy', rank: 'common', name: '无首樵夫', title: '伐根不止', summary: '失去头颅仍挥斧伐根的亡樵。', lore: '樵夫的头被槐根藏在土下，身体却还记得最后一棵要砍倒的树，斧声因此从不在天亮前停下。', loreKey: 'lore_enemy_headless_woodcutter', artKey: 'enemy_headless_woodcutter' },
  { id: 'borrowed_life_crone', kind: 'enemy', rank: 'elite', name: '借命婆', title: '一盏换一命', summary: '把他人疗愈变成自身寿数的精怪婆子。', lore: '借命婆提着一盏没有灯芯的茶灯，收走的每一口生气都会在她脸上添回一条旧年皱纹。', loreKey: 'lore_enemy_borrowed_life_crone', artKey: 'enemy_borrowed_life_crone' },
  { id: 'hundred_eyed_branch', kind: 'enemy', rank: 'elite', name: '百眼槐枝', title: '见法生壳', summary: '会窥见术式并结出适应护壳的槐枝。', lore: '百眼槐枝从老槐身上折落，每一只木眼都记得一种曾经斩过它的法。', loreKey: 'lore_enemy_hundred_eyed_branch', artKey: 'enemy_hundred_eyed_branch' },
  { id: 'paper_armor_envoy', kind: 'enemy', rank: 'elite', name: '纸甲巡使', title: '封关巡夜', summary: '护着后排纸人的巡关纸甲。', lore: '纸甲巡使奉一纸无字的夜令巡关，令上没有终点，所以它也没有停下的理由。', loreKey: 'lore_enemy_paper_armor_envoy', artKey: 'enemy_paper_armor_envoy' },
  { id: 'ancient_huai_matriarch', kind: 'enemy', rank: 'boss', name: '千年槐姥', title: '槐根渡劫', summary: '扎根槐阴古道尽头的千年树姥。', lore: '槐姥以过路人的愿望养根，以修行者的执念开花。想从她的树荫下走过，先要回答自己为何还不肯倒下。', loreKey: 'lore_enemy_ancient_huai_matriarch', artKey: 'boss_ancient_huai_matriarch' },
]

export const EVENT_LORE: readonly EventLoreEntry[] = [
  { id: 'event_roadside_red_sedan', kind: 'event', name: '路边红轿', title: '无脚印的红轿', summary: '雾中红轿向过客招手，帘内不见新娘。', bodyKey: 'trial_event_roadside_red_sedan', loreKey: 'lore_event_roadside_red_sedan', lore: '红轿不载嫁妆，只载一段没有送达的路。掀帘的人会听见轿夫在雾外数脚步，却永远数不到自己的那一步。' },
  { id: 'event_talking_stele', kind: 'event', name: '会说话的石碑', title: '无字碑问冬', summary: '残碑以谜句试探每个经过的人。', bodyKey: 'trial_event_talking_stele', loreKey: 'lore_event_talking_stele', lore: '石碑原本没有碑文，所有字都是后来路人回答过的问题。它记得答案，却从不告诉下一个人。' },
  { id: 'event_borrowed_umbrella', kind: 'event', name: '雨夜借伞', title: '无影之人的雨', summary: '无影人借伞去槐树下还愿。', bodyKey: 'trial_event_borrowed_umbrella', loreKey: 'lore_event_borrowed_umbrella', lore: '那把伞遮得住雨，却遮不住借伞的因果。还愿的人没有影子，替他撑伞的人也会少一段归途。' },
  { id: 'event_moon_in_well', kind: 'event', name: '井中月', title: '水下的旧牌', summary: '废井映出一轮不属于今夜的月亮。', bodyKey: 'trial_event_moon_in_well', loreKey: 'lore_event_moon_in_well', lore: '井中月从不照见打捞者的脸，只照见他最想带走的东西。倒影一旦离水，便会要求一个新的主人。' },
  { id: 'event_title_seeking_immortal', kind: 'event', name: '黄仙讨封', title: '一句仙家', summary: '黄仙拦路，求过客替它定下名分。', bodyKey: 'trial_event_title_seeking_immortal', loreKey: 'lore_event_title_seeking_immortal', lore: '讨封不是请求，而是一场把称谓当作契约的买卖。认可它的人得到冥钱，失去的则是口袋里那点未定的好运。' },
  { id: 'event_empty_paper_shop', kind: 'event', name: '无人纸铺', title: '自己翻页的符箓', summary: '废驿纸铺没有掌柜，纸人却知道客人想买什么。', bodyKey: 'trial_event_empty_paper_shop', loreKey: 'lore_event_empty_paper_shop', lore: '纸铺只在掌柜不在时开门。买走符箓的人从不记得付过钱，只记得回头时柜台上多了一张自己的纸脸。' },
  { id: 'event_lost_woodcutter', kind: 'event', name: '迷路樵夫', title: '空柴篓问山路', summary: '背着空柴篓的樵夫在雾中寻找山下。', bodyKey: 'trial_event_lost_woodcutter', loreKey: 'lore_event_lost_woodcutter', lore: '樵夫每次问路，都会把一条旧路从山中砍出来。若跟错一步，空柴篓里装的便不是柴，而是同行者的名字。' },
  { id: 'event_ruined_mountain_shrine', kind: 'event', name: '山神残庙', title: '半张脸的山神', summary: '残庙供桌上仍有一盏刚点燃的灯。', bodyKey: 'trial_event_ruined_mountain_shrine', loreKey: 'lore_event_ruined_mountain_shrine', lore: '山神像只剩半张脸，另一半留在每个修缮者的梦里。留下供品的人得到庇护，取走供品的人则替山神走一段夜路。' },
]

export const LORE_ENTRIES: readonly LoreEntry[] = [...ENEMY_LORE, ...EVENT_LORE]
export const LORE_BY_ID = Object.fromEntries(LORE_ENTRIES.map((entry) => [entry.id, entry])) as unknown as Record<TrialEncounterId | TrialEventId, LoreEntry>
