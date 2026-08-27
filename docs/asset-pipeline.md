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
