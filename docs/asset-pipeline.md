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
