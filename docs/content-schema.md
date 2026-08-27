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

## 8. 内容提交检查

新增或修改内容时确认：

- ID 唯一且符合命名规则。
- 名称、标签和关键词与现有术语一致。
- 获取来源在当前垂直切片内可到达。
- 等级 3、6、10 的变化不会引入未定义机制。
- 自动目标有效，不会选择已死亡、离场或不合法目标。
- 重复转化、图鉴文本和素材键完整。
- 至少有一个确定性检查覆盖新增的非平凡效果。
