# 内容数据规范

本规范定义首个垂直切片的内容表达方式。具体玩法效果与数量以 [GDD](东方志怪放置卡牌_GDD_v0.1.md) 为准。

## 1. ID 与引用

- ID 使用小写英文 `snake_case`，格式为 `<类别>_<简名>`，例如 `card_guiding_edge`、`spirit_blade_tail_fox`。
- ID 一经进入存档不得修改；显示名称变化不影响 ID。
- 内容之间只使用 ID 引用，不复制完整对象。
- 奖励来源使用稳定 ID，确保一次性奖励可以幂等结算。

建议类别前缀：`weapon_`、`equipment_`、`technique_`、`card_`、`treasure_`、`consumable_`、`spirit_`、`enemy_`、`stage_`、`event_`、`effect_`。

## 2. 通用字段

```ts
type Collectible = {
  id: string
  category: 'weapon' | 'equipment' | 'technique' | 'card' | 'treasure' | 'consumable' | 'spirit'
  name: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legacy'
  tags: string[]
  levelCap: number
  effectId: string
  effectParams: Record<string, number | string | boolean>
  duplicateEssence: { type: 'dao' | 'spirit' | 'artifact'; amount: number }
  unlockSource: string
  artKey: string
  lore: string
}
```

内容文件保存静态定义，不保存 `level`、词条结果、是否拥有等玩家状态。

## 3. 效果表达

- `effectId` 表示可复用行为，`effectParams` 只提供数值或已有 ID。
- 同一行为仅参数不同必须复用 `effectId`，不得复制实现。
- 效果参数使用完整单位名，例如 `durationMs`、`damagePercent`、`stacks`，不使用含糊的 `value1`。
- 复合卡可以按顺序引用多个已有原子效果；不要为每张卡创建专属类。
- 只有现有效果组合无法表达且确实属于 GDD 时，才新增效果实现。

## 4. 单位与舍入

- 时间统一使用毫秒整数，界面再格式化为秒。
- 百分比数据保存为整数百分数，例如 `25` 表示 25%，不混用 `0.25`。
- 伤害、治疗、护盾、货币和层数均为非负整数。
- 比例计算在最终一步向下取整；最低伤害为 1。
- 层数必须声明上限，持续状态必须声明结束条件。

## 5. 卡牌附加字段

| 字段 | 规则 |
|---|---|
| `cost` | 0–10 的整数；0 费牌必须有限制或“耗用” |
| `cardType` | skill、spell、talisman |
| `targetRule` | current_enemy、all_enemies、lowest_hp_ally、chosen_unit 等固定枚举 |
| `keywords` | 只引用 GDD 已定义关键词 |
| `upgradeEffects` | 只定义 3、6、10 级变化 |
| `exhaust` | 是否在本场战斗移除 |
| `autoCondition` | 固定枚举，不接受玩家脚本 |

## 6. 装备与词条

- 命名装备定义固定核心效果、词条槽数量和允许的词条池。
- 玩家存档只保存该装备当前词条 ID 与数值；同名装备不保存多份实例。
- 词条只从 GDD 指定的小型池抽取，不能出现重复词条。
- 重铸先生成候选结果，玩家确认后才替换旧值。

## 7. 关卡、事件与奖励

- 主线关卡 ID 使用三位数字，例如 `stage_001`。
- 首次奖励与重复奖励分开定义，突破门槛使用明确布尔字段。
- 事件每个选项必须写明条件、成本、结果和是否解锁图鉴。
- 随机掉落池必须支持固定种子，并声明保底计数属于玩家状态还是单次试炼状态。
- 所有一次性奖励使用唯一 `sourceId`，重复结算返回空结果而非再次发奖。

### 7.1 M4 主线关卡

```ts
type StageDefinition = {
  id: `stage_${string}`
  stageNumber: number // 1–30，和 id 的三位数字一致
  name: string
  regionId: 'mist_road' | 'ruined_waystation' | 'huai_roots'
  recommendedTags: ('sword' | 'talisman' | 'spirit')[]
  waves: EnemyId[][] // 每关 1–3 波；每波只保存稳定 EnemyId
  firstClearReward: { cultivation: number; spiritSand: number }
  repeatReward: { cultivation: number; spiritSand: number }
  unlockIds: string[]
  isRealmGate: boolean
  backgroundArtKey: string
}
```

- 30 个关卡分为雾路、废驿、槐根深处，各 10 关；第 10、20 关为精英节点，第 30 关是劫境入口。
- 运行时按照 `100 + 8 × (stageNumber - 1)` 计算生元倍率，按照 `100 + 5 × (stageNumber - 1)` 计算攻势倍率，护体额外增加 `2 × floor((stageNumber - 1) / 3)`；最终结果向下取整。
- 首次奖励为 `20 + 5 × stageNumber` 修为和 `80 + 20 × stageNumber` 灵砂；重复奖励为 `5 + stageNumber` 修为和 `20 + 5 × stageNumber` 灵砂。
- `EnemyDefinition` 必须包含稳定 `id`、基础 `maxHp`、`attack`、`defense`、`attackIntervalMs`、`behaviorId` 和可选 `artKey`。`behaviorId` 只能使用已实现的少量 TypeScript 行为分支，不建立运行时脚本或卡牌 DSL。
- 10 种普通敌人和 3 种精英的教学职责固定为：影狸单体攻击、枯藤魅周期护盾、纸面童低生元群体、尸灯蛾施加灼烧、讨封黄仙叠攻势、泥胎傀高护体、铜钱尸死亡强化同伴、夜游伥优先攻击低血妖灵、墓鸦群三段攻击、无首樵夫延迟重击、借命婆反哺治疗、百眼槐枝响应同标签连出、纸甲巡使低血召唤纸面童。
- 第 30 关的 `isRealmGate` 必须为 `true`；胜利奖励只设置劫境入口，不直接生成筑基或首领战奖励。

### 7.2 M4 存档中的主线引用

主线状态属于 `state`，内容文件不得保存玩家进度；以下字段是存档与内容结算之间的稳定契约：

```ts
type CampaignProgress = {
  highestClearedStage: number // 0–30
  stableStage: number // 0–30
  mode: 'advance' | 'farm' | 'paused'
  campaignSeed: number
  battleSequence: number
  duplicateDropStreak: number
  trialUnlocked: boolean
  lastActiveAtMs: number
  settledRewardSourceIds: string[]
  lastFailure?: {
    stageNumber: number // 1–30
    fallbackStage: number // 0–30
    reason: string
    battleSequence: number
  }
  pendingOfflineSettlement?: PendingOfflineSettlement
}
```

- `saveVersion` 当前为 `4`；`v1/v2/v3 → v4` 迁移保留资源、收藏、等级、配装、词条和主线，补齐 `realmId`、劫境运行、结算幂等 ID 与志怪录字段。
- `lastFailure` 持久记录最近一次卡关、失败原因、稳定回退关和结算后的 `battleSequence`；稳定刷取胜利不覆盖提醒，成功越过失败关后清除。
- `PendingOfflineSettlement` 必须包含唯一 `reportId`、结算时长、战斗次数、推进/失败关卡、资源变化、新收藏、主线结果、奖励来源 ID 和可解释战报。
- 离线时长先把时间倒退归零，再限制为 24 小时；报告先挂起，确认领取后才能把资源、收藏和 `reportId` 写入当前存档。
- 失败后模式改为刷取 `stableStage`；稳定关也失败则逐关回退，第 1 关失败时暂停。第 30 关胜利后必须暂停。

### 7.3 素材引用

- `artKey` 是稳定素材键，不在内容对象中内嵌图片或生成提示词；对应文件、尺寸、参考图和后处理记录见 [素材流程](asset-pipeline.md)。
- M4 使用 17 件主线正式像素素材。图片不得包含名称、数字、卡框、Logo 或水印；未生成素材可以使用统一墨影占位。
- M5 使用 13 件劫境/核心收藏正式像素素材；`CollectibleDefinition.artKey` 可选，未生成素材继续使用统一占位。
- 背景和卡图使用 960×540 / 320×180，角色、妖灵和敌人使用 256×256 透明 PNG；运行时只加载静态文件，不调用 AI 或外部服务。

### 7.4 M5 劫境引用

```ts
type TrialTile = { id: string; x: number; y: number; kind: 'start' | 'combat' | 'elite' | 'event' | 'training' | 'merchant' | 'chest' | 'camp' | 'boss'; contentId?: string; resolved: boolean }
type BattleCardInstance = { instanceId: string; cardId: string; upgraded: boolean; exhaust: boolean }
```

- `TrialRun` 保存 26 个已生成格子、当前位置、已揭示格、18/22 行炁、0–2 劫印、6–12 张实例牌、法宝充能、消耗品次数、pending 事项和 secured 奖励；不保存战斗中间状态。
- 劫境事件使用 `event_` 稳定 ID，每局最多处理一次；发现的敌人和事件写入 `discoveredLoreIds`，不进入养成等级或掉落池。
- `TrialSettlement.sourceId` 是成功、失败或撤退结算的唯一键；失败/撤退只带回 `secured` 奖励，成功才设置 `foundation_established`。

## 8. 内容提交检查

新增或修改内容时确认：

- ID 唯一且符合命名规则。
- 名称、标签和关键词与现有术语一致。
- 获取来源在当前垂直切片内可到达。
- 等级 3、6、10 的变化不会引入未定义机制。
- 自动目标有效，不会选择已死亡、离场或不合法目标。
- 重复转化、图鉴文本和素材键完整。
- 至少有一个确定性检查覆盖新增的非平凡效果。
