# 像素美术素材流程

本规范适用于开发期 AI 生成素材。游戏运行时不得调用生成模型。

## 统一规格

- 风格：阴森惊悚的古卷工笔像素，四头身角色，中等像素颗粒，约 32 色。
- 主色：墨黑、枯褐、旧纸灰；点色使用妖火青、朱砂红和病态鎏金。
- 图片不得包含名称、描述、数字、卡框、可读文字、Logo 或水印。
- 卡框、角花、费用珠、关键词和状态标记由 HTML/CSS 绘制。
- 最终文件位于 `public/assets/pixel/`，全部使用稳定英文文件名和 PNG。

## 生成与后处理

- 生成方式：Codex 内置 OpenAI `image_gen`。
- 模型标识：工具未提供。
- 随机种子：工具未提供。
- 生成日期：2026-08-28。
- 背景、卡图和纹理使用 FFmpeg 最近邻缩放并量化为 32 色 PNG。
- 透明角色使用 FFmpeg 最近邻缩放和透明补边；为保留 alpha，不进行会破坏透明通道的调色板量化。
- 目标尺寸：背景 960×540、角色 256×256、卡图 320×180、纹理 64×64。

生成原图保留在 Codex 生成目录，仓库只跟踪经过校验的最终资源。新增素材时必须记录最终提示词、输出路径、尺寸和任何例外。

## M2 样板记录

### `bg-huaiyin-road.png`

```text
Use case: stylized-concept
Asset type: desktop card-battle game environment background
Primary request: 槐阴古道的夜间战斗场景，一条荒废古道穿过扭曲老槐树、残破山神庙与低垂纸灯，浓雾中隐约出现不自然的人影，场地中央留出清晰的卡桌战斗区域
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, medium pixel clusters, crisp silhouettes, ink-line texture, four-head-tall character world proportions but no visible foreground characters
Composition/framing: wide 16:9 establishing view, symmetrical enough for a battle board, strong depth layers, center kept readable for enemy cards and effects
Lighting/mood: genuinely eerie and threatening, moonless night, cold ghost-fire cyan in fog, cinnabar-red paper lantern accents, sickly tarnished gold highlights
Color palette: soot black, dead brown, aged paper gray, ghost-fire cyan, cinnabar red, tarnished gold
Materials/textures: aged xuan paper grain, dry ink, cracked timber, mossy stone, pixel dithering
Constraints: true pixel-art appearance; no text, no letters, no UI, no cards, no logos, no watermark; no gradients that blur pixel clusters
Avoid: photorealism, smooth digital painting, anime gloss, purple neon, cute mood
```

### `texture-aged-xuan-paper.png`

```text
Use case: stylized-concept
Asset type: tileable game UI texture
Primary request: seamless aged xuan paper texture stained by dry black ink, faint cinnabar fibers and sparse tarnished-gold flecks
Style/medium: true 32-color Chinese horror pixel art, medium pixel clusters, hand-crafted dithering
Composition/framing: square seamless tile, even visual density, no central focal point
Color palette: charcoal black, dead brown, aged paper gray, muted cinnabar, tiny sickly gold
Constraints: perfectly tileable edges; texture only; no objects, symbols, writing, letters, logos, cards, frames, or watermark
Avoid: photoreal paper scan, smooth gradients, bright clean parchment
```

### `portrait-leader-01.png`

```text
Use case: stylized-concept
Asset type: transparent game character portrait
Primary request: a nameless wandering Chinese cultivator carrying a narrow azure sword and wearing weathered dark Daoist travel robes, calm but wary, subtle ghost-fire reflection, four-head-tall stylized proportions
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouette, medium pixel clusters
Composition/framing: full figure centered, three-quarter view, generous transparent padding, readable at small card size
Lighting/mood: ominous moonless night, cold cyan rim light, tiny tarnished-gold fittings
Color palette: soot black, dead brown, paper gray, ghost-fire cyan, tarnished gold
Constraints: genuinely transparent background; one character only; no text, runes, letters, UI, border, logo, watermark
Avoid: photorealism, anime gloss, chibi-cute expression, smooth painting
```

### `spirit-paper-bride.png`

```text
Use case: stylized-concept
Asset type: transparent game spirit portrait
Primary request: 纸嫁娘, an eerie Chinese paper bride spirit in torn ceremonial red paper garments and a rigid folded-paper veil, pale faceless mask, long paper sleeves, four-head-tall stylized proportions
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouette, medium pixel clusters
Composition/framing: full figure centered, frontal three-quarter pose, floating slightly, generous transparent padding, readable at small card size
Lighting/mood: frightening and uncanny, cold ghost-fire cyan beneath the veil, cinnabar-red paper edges, sickly gold hair ornaments
Color palette: soot black, dirty paper white, cinnabar red, ghost-fire cyan, tarnished gold
Constraints: genuinely transparent background; one spirit only; no text, letters, UI, border, logo, watermark
Avoid: photorealism, romantic bridal beauty, anime gloss, cute mood, smooth painting
```

### `enemy-clay-idol.png`

```text
Use case: stylized-concept
Asset type: transparent game enemy portrait
Primary request: 泥胎傀, a squat clay funerary idol animated by roots and black talisman nails, cracked wet earth body, empty eye sockets with dim cinnabar light, four-head-tall monster proportions
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouette, medium pixel clusters
Composition/framing: full creature centered, aggressive three-quarter stance, generous transparent padding, readable at small card size
Lighting/mood: oppressive and uncanny, cold cyan underlight, restrained cinnabar glow inside cracks
Color palette: soot black, wet clay brown, moss gray, ghost-fire cyan, cinnabar red
Constraints: genuinely transparent background; one creature only; no text, letters, UI, border, logo, watermark
Avoid: photorealism, cute golem, anime gloss, smooth painting
```

### `card-mountain-splitter.png`

```text
Use case: stylized-concept
Asset type: horizontal game card illustration
Primary request: 一剑开山 — a lone cultivator releases one immense sword arc that splits a black mountain altar and the roots beneath it, debris suspended in a frozen instant
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouettes, medium pixel clusters
Composition/framing: cinematic 16:9 horizontal crop, diagonal sword arc as focal point, strong readable silhouette at small card size
Lighting/mood: violent and ominous, ghost-fire cyan sword light cutting through soot black, tiny tarnished-gold sparks
Color palette: soot black, dead brown, paper gray, ghost-fire cyan, tarnished gold
Constraints: illustration only; no card frame, no text, no letters, no numbers, no logo, no watermark
Avoid: photorealism, smooth painting, anime gloss, purple neon, busy tiny details
```

### `card-nine-heavens-edict.png`

首稿出现类似文字的符纹，已弃用并重新生成无字版本。

```text
Use case: stylized-concept
Asset type: horizontal game card illustration
Primary request: 九霄雷诏 — a storm-black sky tears open and jagged paper-white lightning strikes a circular altar surrounded by haunted clay idols; a single torn blank cinnabar-red paper strip floats above the impact
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouettes, medium pixel clusters
Composition/framing: cinematic 16:9 horizontal crop, blank red paper strip and lightning centered, strong readable shapes at small card size
Lighting/mood: terrifying ritual climax, white lightning, cold cyan ghost mist, sparse sickly-gold sparks
Color palette: soot black, paper white, cinnabar red, ghost-fire cyan, tarnished gold
Constraints: the paper strip must be completely blank with absolutely no marks, symbols, writing, glyphs, lines, seals, or characters; illustration only; no card frame, text, letters, numbers, logo, watermark
Avoid: any writing-like shapes, photorealism, smooth painting, anime gloss, purple neon, crowded composition
```

### `card-night-of-hundred-beasts.png`

```text
Use case: stylized-concept
Asset type: horizontal game card illustration
Primary request: 百兽夜行 — spectral Chinese mountain beasts surge down a moonless ancient road behind two leading妖灵 silhouettes, their eyes and breath forming a wave of ghost-fire
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color palette, crisp ink-line silhouettes, medium pixel clusters
Composition/framing: cinematic 16:9 horizontal crop, forward-moving beast procession, two clear foreground silhouettes and layered distant shapes, readable at small card size
Lighting/mood: frightening supernatural stampede, cold ghost-fire cyan, deep soot black, sparse cinnabar eyes and tarnished-gold bells
Color palette: soot black, dead brown, paper gray, ghost-fire cyan, cinnabar red, tarnished gold
Constraints: illustration only; no card frame, no text, no letters, no numbers, no logo, no watermark
Avoid: cute animals, photorealism, smooth painting, anime gloss, purple neon, clutter
```

## M4 主线素材记录

- 生成日期：2026-08-30。
- 生成方式：Codex 内置 OpenAI `image_gen`；模型标识与随机种子均未提供。
- 风格参考：背景引用 `bg-huaiyin-road.png`；角色引用 `spirit-paper-bride.png`、`portrait-leader-01.png` 或 `enemy-clay-idol.png`；卡图分别引用三张 M2 招牌卡。
- 原图目录：`/Users/sarainoq/.codex/generated_images/01a04267-409c-74d2-b38c-d0d3f52f27af/`。

本批提示词共用以下不可省略约束，表格中的“主体”与“构图”逐项替换对应行：

```text
Use case: stylized-concept
Asset type: transparent game character portrait / horizontal game card illustration / desktop card-battle environment background
Input images: style references only; match ancient Chinese horror pixel art, medium pixel clusters, limited palette and crisp dry-ink silhouettes
Primary request: <表格主体>
Style/medium: ancient Chinese horror pixel art, hand-crafted 32-color feeling, crisp dry-ink outlines, medium pixel clusters
Composition/framing: <表格构图>
Lighting/mood: genuinely eerie supernatural horror; cold ghost-fire cyan, restrained cinnabar red and sparse sickly tarnished-gold highlights
Color palette: soot black, dead brown, aged paper gray, ghost-fire cyan, cinnabar red, tarnished gold
Constraints: no text, letters, writing, glyphs, numbers, UI, card border, logo or watermark; character assets require genuine alpha transparency and one subject only
Avoid: fake checkerboard transparency, photorealism, smooth painting, anime gloss, purple neon, cute mood
```

| 最终文件 | 主体 | 构图 | 原图 / 例外 |
|---|---|---|---|
| `bg-huaiyin-waystation.png` | 雨夜废弃驿站与无人纸铺，纸扎人藏在破门内，远处残庙钟楼隐入浓雾 | 16:9 三层景深，中央保留卡桌区域 | `exec-3b80c0cc-92eb-467b-9506-347ee0a6ed1f.png` |
| `bg-huaiyin-roots.png` | 巨型槐根挤裂石路并吞没祖祠，根须围住幽暗石门 | 16:9 低压树冠与中央纵深道路 | `exec-c13d59cb-cbcd-47e0-8085-c9f517e2fac7.png` |
| `spirit-blade-tail-fox.png` | 刃尾狐，长尾如缺口青色剑刃，暗红绳结与伏击姿态 | 低伏三分之四全身，刃尾是主轮廓 | `exec-744c5641-7313-4ae5-881c-7154eda5b493.png` |
| `spirit-iron-beak-crane.png` | 铁喙鹤，长枪般铁喙、补缀祭羽、铜脚环与破损光轮 | 三分之四全身，长喙与收翼构成三角轮廓 | `exec-19813796-96f8-4d10-b773-a889c6c8dc4c.png` |
| `spirit-lantern-ghost.png` | 灯笼鬼，破裂红纸灯笼身躯内悬着苍白面具与青火 | 漂浮全身，灯笼轮廓在小卡面清晰 | `exec-9e4ecfd8-5329-4a6c-9ddc-af6c618d2e73.png` |
| `spirit-mountain-child.png` | 山童，石肤、虎皮肩衣与苔痕守护石板 | 宽阔防御姿态，石板占主要轮廓 | 初稿伪棋盘底；背景提取后使用 `exec-18d02e3a-c21e-48c4-979d-ac61c6556206.png` |
| `spirit-dream-tapir.png` | 食梦貘，短鼻、墨黑皮毛、骨白纹样和噩梦烟影 | 三分之四全身，短鼻与烟影可辨 | `exec-cb9a332c-c685-4ace-ac28-f28748de333f.png` |
| `boss-ancient-huai-matriarch.png` | 千年槐姥，老妇面孔自古槐树身浮现，根臂与空白红纸交织 | 对称首领全身，枝冠和根臂形成压迫轮廓 | `exec-e244f364-352f-4b00-a7f6-2cd86936fc33.png` |
| `enemy-shadow-civet.png` | 影狸，由被盗人影组成的瘦长狸兽，尾部溶成墨迹 | 低伏捕猎姿态 | `exec-2befcccd-b46c-4252-8563-40cac6b056ff.png` |
| `enemy-paper-child.png` | 纸面童，空白圆纸脸、歪斜竹架与破损丧服 | 僵硬前伸的全身木偶姿态 | `exec-8f222a93-8767-4d22-a2b1-9782f82ea00a.png` |
| `enemy-headless-woodcutter.png` | 无首樵夫，草蓑腐尸、巨斧、空颈内青火 | 三分之四全身，缺首与巨斧清晰 | 初稿白底；背景提取后使用 `exec-81a7134c-58c4-4d03-897c-141fbd5c857e.png` |
| `enemy-borrowed-life-crone.png` | 借命婆，佝偻老妇、黑茶碗、红命线与裂纹丧帘 | 佝偻但具压迫感，茶碗与命线可辨 | 初稿伪棋盘底；使用 `exec-b28b4d81-8036-424a-843d-c17ce7d756cb.png` |
| `enemy-hundred-eyed-branch.png` | 百眼槐枝，根腿行走的断枝，闭合木眼渗出青光 | 放射枝冠与多眼树身 | 初稿白底；使用 `exec-23ce2de5-fcd7-45b7-b094-2f3002d0daea.png` |
| `enemy-paper-armor-envoy.png` | 纸甲巡使，丧纸竹甲、无面黑罩、钩杖与空白红令 | 直立精英全身，钩杖与纸甲层次可辨 | 初稿白底；使用 `exec-e25d0b54-ebcf-4daa-a63b-70c16aed1a9a.png` |
| `card-guiding-edge.png` | 引锋式，修士拔出一掌长青刃，第一道剑光切开黑雾 | 16:9 对角拔剑，单一剑光焦点 | `exec-1381a9f9-9924-472d-a169-7d8bfbbe42d2.png` |
| `card-fire-talisman.png` | 贴火符，完全空白朱砂纸贴上影物胸口并爆出青红鬼火 | 16:9 近距离仪式冲击，空白红纸居中 | `exec-eeadc462-36dc-41d1-b820-c20d923e9712.png` |
| `card-call-true-name.png` | 唤名，修士摇动铜铃，两只远处妖灵循青色声环回首 | 16:9 前景铃铛、远处恰好两只妖灵 | `exec-fde5a02f-4564-4258-93c0-20a48649534f.png` |

背景提取编辑的最终提示词：

```text
Use case: background-extraction
Primary request: remove only the white or checkerboard background and convert it to genuine alpha transparency
Constraints: preserve the exact character design, pose, proportions, colors and pixel clusters; preserve fine edge pixels; no checkerboard, scenery, shadow panel, text, UI, border, logo or watermark
```

后处理结果：2 张背景为 960×540、3 张卡图为 320×180，均为 32 色 `pal8`；12 张角色与敌人为 256×256 `rgba`，使用最近邻缩放与透明补边。

## M5 核心收藏与劫境素材记录

- 生成日期：2026-08-31。
- 生成方式：Codex 内置 OpenAI `image_gen`；模型标识与随机种子未提供。
- 风格参考：`bg-huaiyin-roots.png`、`portrait-leader-01.png`、`spirit-paper-bride.png`、`card-mountain-splitter.png`、`card-nine-heavens-edict.png`、`spirit-iron-beak-crane.png`。
- 原图目录：`/Users/sarainoq/.codex/generated_images/01a04267-409c-74d2-b38c-d0d3f52f27af/`。
- 共用提示词约束：古卷工笔像素、约 32 色、墨黑/枯褐/旧纸灰、妖火青/朱砂红/病态鎏金点色；透明对象只保留一个主体；不得出现文字、数字、符文、卡框、Logo、水印或棋盘格假透明。

| 最终文件 | 用途 | 原图 | 后处理 |
|---|---|---|---|
| `bg-huaiyin-trial-map.png` | 7×7 劫境山河图背景 | `exec-4e03caa4-c882-4420-a9b7-9606fd61b3f0.png` | FFmpeg 最近邻缩放 960×540，32 色 `pal8`，无透明 |
| `weapon-azure-wind-sword.png` | 青岚剑图鉴 | `exec-05d355d6-61c2-4d8f-a487-ab7411c33528.png` | 最近邻缩放 256×256，保留 alpha |
| `weapon-cinnabar-brush.png` | 朱砂笔图鉴 | `exec-e4d76ae7-f9f4-4e78-83c2-cc0f12c6dfc3.png` | 最近邻缩放 256×256，保留 alpha |
| `weapon-spirit-bell.png` | 唤灵铃图鉴 | `exec-db01e817-6dad-405c-a37e-840c58b3abec.png` | 最近邻缩放 256×256，保留 alpha |
| `technique-hidden-edge-art.png` | 太虚藏锋诀图鉴 | `exec-797050bb-9b9e-4369-9887-a892102ebd89.png` | 最近邻缩放 256×256，保留 alpha |
| `technique-edict-talisman-codex.png` | 上清敕符录图鉴 | `exec-9a83c86d-49b4-4587-90d7-9233ab591d59.png` | 最近邻缩放 256×256，保留 alpha |
| `technique-hundred-spirit-codex.png` | 百灵归契篇图鉴 | `exec-3f791b9a-9f8b-44ef-a656-9c0fdb0eb198.png` | 最近邻缩放 256×256，保留 alpha |
| `equipment-hidden-edge-jade.png` | 藏锋玉佩图鉴 | `exec-edaa4ea5-4e1a-4a9b-85d4-085f4a4fe1be.png` | 最近邻缩放 256×256，保留 alpha |
| `equipment-thunder-coin.png` | 雷纹古钱图鉴 | `exec-8d32df03-a099-4ef2-8b13-9eb18178da4c.png` | 最近邻缩放 256×256，保留 alpha |
| `equipment-paired-bronze-bell.png` | 同心铜铃图鉴 | `exec-a486ca46-3945-447e-ad68-5b1bb4645ef4.png` | 最近邻缩放 256×256，保留 alpha |
| `treasure-crescent-sword-case.png` | 残月剑匣图鉴 | `exec-258e9ff2-41e4-4f27-992b-2018210b2235.png` | 最近邻缩放 256×256，保留 alpha |
| `treasure-mountain-river-inkstone.png` | 山河砚图鉴 | `exec-75fa39ca-5a9c-4824-85cf-8cb519c5a3e7.png` | 最近邻缩放 256×256，保留 alpha |
| `treasure-soul-summoning-banner.png` | 招魂幡图鉴 | `exec-b5ca2c3f-e907-42a7-bd2b-9908c8d17448.png` | 最近邻缩放 256×256，保留 alpha |

两次额外单图生成用于纠正首批输出主体错配：`exec-edaa4ea5-4e1a-4a9b-85d4-085f4a4fe1be.png` 明确为单枚玉佩，`exec-a486ca46-3945-447e-ad68-5b1bb4645ef4.png` 明确为一对铜铃；未采用错配的 `exec-22532d33-f0a5-45be-b619-eda06f2e60d5.png` 与 `exec-f9478cd6-3963-4897-9053-a4f42443ab47.png`。所有透明对象已用 `ffprobe` 检查为 `rgba` 且 alpha 范围为 0–255；棋盘背景已检查为 960×540/32 色。

## M5.5 章节地图与角色素材记录

- 生成日期：2026-09-01。
- 生成方式：Codex 内置 OpenAI `image_gen`；模型标识与随机种子未提供。
- 风格参考：M4/M5 的 `bg-huaiyin-road.png`、`bg-huaiyin-waystation.png`、`bg-huaiyin-roots.png`、`portrait-leader-01.png`；本批提示词要求同一阴森古卷工笔像素、约 32 色和清晰负空间。
- 原图目录：`/Users/sarainoq/.codex/generated_images/01a04267-409c-74d2-b38c-d0d3f52f27af/`。

共用提示词约束：背景仅包含章节环境，不包含路线节点、文字、数字、符号、UI、Logo 或水印；角色为一个透明背景的四头身成人修士，不包含装备叠加层、文字、伪棋盘格或水印。

| 最终文件 | 用途 | 原图 | 后处理 |
|---|---|---|---|
| `map-mist-road-v1.png` | 雾路章节线性地图底图 | `exec-fafa4ad3-645f-4250-a4fa-d4922b875605.png` | FFmpeg 最近邻缩放 960×540、32 色 `pal8` |
| `map-ruined-waystation-v1.png` | 废驿章节线性地图底图 | `exec-e34fc3fb-cfb9-4f76-8a8b-96cb2c3e499b.png` | FFmpeg 最近邻缩放 960×540、32 色 `pal8` |
| `map-huai-roots-v1.png` | 槐根深处章节线性地图底图 | `exec-2216c628-3cfc-4936-b1e0-fd8e7dded3b5.png` | FFmpeg 最近邻缩放 960×540、32 色 `pal8` |
| `character-cultivator-full-v1.png` | 角色管理页静态主将全身像 | `exec-edcd85a5-c942-4829-874d-8f75aee3c089.png` | FFmpeg 最近邻缩放 512×768，保留 `rgba` alpha |

地图最终文件均为 960×540 `pal8`；主将最终文件为 512×768 `rgba`，已用 `ffprobe` 检查 alpha 范围为 0–255。Pixi/DOM 运行时只引用 `GAME_ASSETS`，不调用生成模型。

## M5.7 全图鉴样板与批量记录

- 生成日期：2026-09-02。
- 生成方式：Codex 内置 OpenAI `image_gen`；模型标识与随机种子未提供。
- 风格参考：卡图使用 `card-guiding-edge.png`、`card-mountain-splitter.png`、`card-fire-talisman.png` 或 `card-nine-heavens-edict.png`；透明对象使用 `equipment-hidden-edge-jade.png`、`weapon-azure-wind-sword.png` 或 `treasure-mountain-river-inkstone.png`；敌人使用 `enemy-clay-idol.png`、`enemy-shadow-civet.png`；怪谈使用 `bg-huaiyin-road.png`、`bg-huaiyin-waystation.png`。
- 共用最终约束：阴森惊悚古卷工笔像素、约 32 色、墨黑/枯褐/旧纸灰、妖火青/朱砂红/病态鎏金；不得出现文字、数字、伪符文、卡框、Logo、水印或假棋盘格。卡图和怪谈使用 16:9 横向构图；对象与敌人使用单主体透明背景。

### 六张已确认样板

| 最终文件 | 生成原图 | 类型与后处理 | 最终提示词主体与构图 |
|---|---|---|---|
| `card-returning-wind.png` | `exec-b710ba13-9212-475e-87e1-1698d58c6a15.png` | 320×180，FFmpeg 最近邻缩放，32 色 `pal8` | 回风剑：修士挥出环形青刃，双重剑光暗示连续两击；横向电影构图，留出卡面文字空间。 |
| `card-linked-talisman-script.png` | `exec-e7264208-0976-44bc-bd04-b787989a3394.png` | 320×180，FFmpeg 最近邻缩放，32 色 `pal8` | 符阵连书：旧册展开，空白朱砂纸围绕祭坛成阵，青色灵火连接；所有纸张完全无字无符号。 |
| `equipment-green-bamboo-crown.png` | `exec-e8b29746-9d43-4621-990f-67d332b6908d.png` | 256×256，FFmpeg 最近邻缩放，保留 `rgba` alpha | 青竹束冠：单个破旧竹编冠，暗线与小剑穗，透明留白，物品图标构图。 |
| `consumable-spring-return-pill.png` | `exec-c277d8af-77c7-444f-b331-243b17ca2efc.png` | 256×256，FFmpeg 最近邻缩放，保留 `rgba` alpha | 回春丹：单个开裂青瓷药瓶，青色药液、朱砂绳和枯叶；无标签无文字。 |
| `enemy-withered-vine-spirit.png` | `exec-57c656cb-5554-4be3-80f1-91dff59671fb.png` | 256×256，FFmpeg 最近邻缩放，保留 `rgba` alpha | 枯藤魅：枯藤根须缠成的人形怪物，空洞青火结眼，透明背景，单一生物轮廓。 |
| `event-roadside-red-sedan.png` | `exec-4e8a06ca-948e-45ee-b5ce-12d00a7bfbee.png` | 320×180，FFmpeg 最近邻缩放，32 色 `pal8` | 路边红轿：雾中古道旁的废弃朱砂红轿，帘内只有黑暗，脚印在轿前中断；横向场景图。 |

六张样板通过主体、轮廓、像素颗粒、透明通道和无伪文字检查后，按同一模板单图生成剩余 44 张：18 张缺失卡图、9 件装备、3 件法宝、6 种消耗品、6 种敌人和 8 张怪谈场景图。每一项均补充原图路径、最终提示词主体、尺寸、后处理和异常；未提供的模型/种子记录为“未提供”。

### M5.7 批量素材记录

- 生成日期：2026-09-02；生成方式：Codex 内置 OpenAI `image_gen`；模型标识与随机种子：未提供。
- 所有卡图与怪谈场景均使用 `320×180` 最近邻缩放、32 色 `pal8`、无透明；所有器物、丹药和敌人均使用 `256×256` 最近邻缩放、`rgba`、保留 alpha。以下“主体”即最终提示词中的 `Primary request`，共用约束沿用样板记录。

#### 缺失卡图

| 最终文件 | 原图 | 主体 |
|---|---|---|
| `card-hidden-edge.png` | `exec-fa78d0d1-2662-43ea-878f-b129300cd3b4.png` | 藏锋：旧石鞘中的收敛青刃与护盾墨纹 |
| `card-flowing-cloud-slashes.png` | `exec-86986d85-845c-42af-a915-fb09f74b1ee8.png` | 流云三斩：三道连续青色剑弧切开纸影 |
| `card-armor-piercing-star.png` | `exec-30835177-f489-488d-8330-d1e7fd9c6a79.png` | 破甲点星：细剑光刺穿泥甲并形成星芒裂纹 |
| `card-sheathe-sword.png` | `exec-e8323a1b-cd28-439d-853c-f04a192b5507.png` | 御剑归鞘：青刃回到旧木剑鞘、剑光收束 |
| `card-ten-thousand-blades.png` | `exec-fc7d5dea-79ab-4dd9-907a-647583577cc6.png` | 万剑成势：细小飞剑在古道形成旋涡阵势 |
| `card-mountain-seal.png` | `exec-e163df0e-9d1b-44af-ae8e-69be74db2b21.png` | 镇岳符：空白朱砂纸符扩散青金护盾圆环 |
| `card-thunder-talisman.png` | `exec-3d3e6f73-017a-4984-b0e9-78052b6946be.png` | 引雷符：空白纸符牵引冷白雷光击中异物 |
| `card-shadow-binding-talisman.png` | `exec-3efe9da1-eedf-499e-b806-daf4a056c4c6.png` | 缚影符：空白朱砂纸带缠住黑色影子 |
| `card-life-talisman.png` | `exec-e9b0d3e6-3141-4fe7-a09e-b3a20922aefa.png` | 续命符：青色生命火焰回流到受伤友方 |
| `card-urgent-edict.png` | `exec-74708268-12e7-4b34-a068-974a2c419d55.png` | 敕令：空白纸符被撕起并爆成青红光屑 |
| `card-share-spirit-breath.png` | `exec-ff409640-b347-40f1-aa48-ad58341280d7.png` | 分食灵息：两只妖灵分流一团青色灵息 |
| `card-fight-together.png` | `exec-a78ef575-7610-425a-b524-35ec11938ee8.png` | 并肩：两只妖灵同步扑向雾中目标 |
| `card-protect-master.png` | `exec-84a18257-5b9e-4029-8b4c-72e0ab12bcf1.png` | 护主：妖灵在修士前张开青金护盾 |
| `card-spirit-tide.png` | `exec-d10c123b-ddad-48bf-b55a-80a88e609eae.png` | 兽潮：两只妖灵带领山兽从古道奔涌而来 |
| `card-borrow-spirit.png` | `exec-2fca3af4-71b9-4a96-82c3-6e62d21fef83.png` | 借灵：妖灵魂火复制成第二个青色回响 |
| `card-all-spirits-covenant.png` | `exec-870c642b-8bab-4682-8898-a3f0e384bbf6.png` | 万灵同契：两只妖灵在契约光环两侧相连 |

#### 缺失装备

| 最终文件 | 原图 | 主体 |
|---|---|---|
| `equipment-cinnabar-crown.png` | `exec-36e75965-e675-4351-9765-f05c0118ab0d.png` | 朱砂法冠：窄边道冠、空白纸签与红线结 |
| `equipment-hundred-beast-circlet.png` | `exec-29cc72ac-d9e7-4ba8-9e09-f94f9903fb80.png` | 百兽额环：古铜兽首额环与红色绳穗 |
| `equipment-wandering-cloud-robe.png` | `exec-5fda54f3-5ac5-49d4-a965-dcb4b4ae58a8.png` | 游云道袍：折叠深色旧袍与青色云线 |
| `equipment-talisman-silk-robe.png` | `exec-1fe17663-8571-40e0-b6ea-e93554ab2b31.png` | 法绢纸衣：白灰法绢、空白纸条与护盾光屑 |
| `equipment-mountain-lord-pelt.png` | `exec-adf4cd53-93e1-41a8-b88f-7ee1fc799bed.png` | 山君皮裘：厚重虎纹皮裘、铜扣与青火绒毛 |
| `equipment-wind-chasing-shoes.png` | `exec-b5f71bb2-5637-40ab-980b-66dc613d567d.png` | 追风履：轻薄行鞋、青色风痕与朱砂结 |
| `equipment-star-treading-shoes.png` | `exec-717161dd-27c8-4af4-9e6a-ab3f907aaf33.png` | 踏罡履：厚底道靴、金色星点与青色尘痕 |
| `equipment-tracking-straw-sandals.png` | `exec-d9ae3082-01b6-4e12-bef9-3270229ba216.png` | 寻踪草履：编草凉鞋、湿泥与青色足迹 |

#### 缺失法宝与消耗品

| 最终文件 | 原图 | 主体 |
|---|---|---|
| `treasure-demon-revealing-mirror.png` | `exec-6398939d-caa3-4a2b-9c00-c6088c97a365.png` | 照妖镜：裂纹古铜镜映出青色妖眼 |
| `treasure-primordial-gourd.png` | `exec-8a67bbeb-b53e-42e8-b94f-d742bfcc142f.png` | 混元葫芦：黑褐葫芦口溢出三枚灵力火珠 |
| `treasure-demon-binding-rope.png` | `exec-345a0f1d-1e7f-4d03-8edf-314a2566eccf.png` | 缚妖索：盘绕旧麻绳、铜环与锁魂火痕 |
| `consumable-spirit-gathering-pill.png` | `exec-ce947f23-0fe4-40dd-b5f3-bbef54c888c0.png` | 聚灵丹：古铜小盏、药丸与三点灵气 |
| `consumable-meridian-guard-pill.png` | `exec-1a257b21-a7b3-44c0-aa48-a10b0ffc1709.png` | 护脉丹：黑色药瓶、护脉光环与布塞 |
| `consumable-evil-breaking-talisman.png` | `exec-9d27c93e-e20e-4595-86e7-50527d5467e9.png` | 破煞符：空白纸符与净化青火 |
| `consumable-armor-escape-talisman.png` | `exec-ce25dc69-3ab3-426c-babf-ab9bc0de22a9.png` | 遁甲符：空白纸符、铜甲片与护盾碎光 |
| `consumable-thunder-summoning-talisman.png` | `exec-73a3125f-79c9-447f-8f18-c1cd94ff3d5f.png` | 召雷符：空白纸符、铜雷印与冷白雷丝 |

#### 缺失敌人与怪谈

| 最终文件 | 原图 | 主体 |
|---|---|---|
| `enemy-corpse-lantern-moth.png` | `exec-8b9241c7-928a-4cf2-84e7-16a5d6217175.png` | 尸灯蛾：棺灯烟灰翅膜与冷青尸火 |
| `enemy-title-seeking-immortal.png` | `exec-0725916e-332f-4fb1-8f63-8d5e0bc8f4f2.png` | 讨封黄仙：黄皮狐妖、空白红纸与铜钱 |
| `enemy-coin-corpse.png` | `exec-3b9fef4b-5122-4205-ab45-ba32f205217c.png` | 铜钱尸：寿衣僵尸、七窍古钱与红线 |
| `enemy-night-wandering-thrall.png` | `exec-d3aac19d-af44-4f36-8c69-4c9f5df75afc.png` | 夜游伥：无面黑斗篷伥鬼与低伏姿态 |
| `enemy-grave-crow-flock.png` | `exec-30f4da8a-8d17-4eea-8f29-4809f3414a64.png` | 墓鸦群：三只以上墓鸦组成统一群体剪影 |
| `event-talking-stele.png` | `exec-db7f0a50-601b-4e39-a50d-834fd05ae796.png` | 会说话的石碑：裂开无字石碑与青色鬼火 |
| `event-borrowed-umbrella.png` | `exec-6eab06bb-2401-4d23-a8cf-618bd90b9d38.png` | 雨夜借伞：无人油纸伞和无影人雨雾 |
| `event-moon-in-well.png` | `exec-1265144d-8e87-4b77-a074-e6728ed9551f.png` | 井中月：石井青白月影与水下手影 |
| `event-title-seeking-immortal.png` | `exec-c16919cb-cd19-4d3b-bdf7-dd40d9ed60f8.png` | 黄仙讨封：狐妖捧空白朱砂纸与悬浮铜钱 |
| `event-empty-paper-shop.png` | `exec-a56dcce5-8e43-4f97-8c25-dfc09c47a2a0.png` | 无人纸铺：空门纸人、纸灯和后屋青火 |
| `event-lost-woodcutter.png` | `exec-d355724d-62cc-43e1-bd14-bf8ba6ee0e3a.png` | 迷路樵夫：无面樵夫、空柴篓与三岔古道 |
| `event-ruined-mountain-shrine.png` | `exec-23e55882-5703-421c-b49f-3157e998fe97.png` | 山神残庙：半张石像脸、孤灯与穿墙槐根 |

异常记录：本批图像工具未返回模型与随机种子元数据，均记为“未提供”；未发现伪文字、假棋盘格或尺寸异常。透明图单张最大约 156KB，横向图单张均小于 80KB，像素目录总量约 8.3MB。
