# 山海问道

东方志怪题材的放置养成 × 卡牌构筑 × 轻量肉鸽单机游戏。

玩家携两只妖灵挂机历练、收集武器功法与奇物，并在境界瓶颈中进入随机劫境，通过卡牌 Combo 完成突破。

## 当前状态

项目已完成 **M5.5 角色管理、章节地图与渲染性能修复**。M4.5 的主线反馈、M5 的劫境闭环、角色/背包管理、三章地图和 PixiJS 渲染层均已接入。

## 文档入口

- [游戏设计文档](docs/东方志怪放置卡牌_GDD_v0.1.md)
- [文档索引](docs/README.md)
- [技术架构](docs/architecture.md)
- [内容数据规范](docs/content-schema.md)
- [原型验收清单](docs/prototype-checklist.md)
- [像素素材流程](docs/asset-pipeline.md)

## 原型边界

- 横屏电脑网页、单机、本地存档。
- 一个地域“槐阴古道”，炼气至筑基。
- 30 个挂机关卡、卡桌战斗和一个 15–25 分钟突破劫境。
- 三套流派：剑意、符咒、御灵。
- M4 已包含 30 关、1–3 波敌人、最多 24 小时离线结算和 17 件主线像素素材；M4.5 已补齐高对比阅读、失败反馈、目标合法性和前期节奏平滑；M5 已加入 7×7 劫境、三阶段槐姥、22 条志怪录和 13 件核心收藏/劫境素材；M5.5 增加角色管理、三章线性地图、PixiJS 场景和缓存预算。
- 不包含联网、付费、多人、自由移动、完整动作系统或运行时 AI。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
pnpm check
pnpm cf:check
pnpm deploy
```

## 部署

- 线上地址：[https://wendao.sarainoq.cn](https://wendao.sarainoq.cn)
- 架构：Cloudflare Worker API + Static Assets
- 健康检查：[https://wendao.sarainoq.cn/api/health](https://wendao.sarainoq.cn/api/health)

首次使用先运行 `pnpm cf:whoami`。部署流程与密钥规则见 [`AGENTS.md`](AGENTS.md#cloudflare-部署)。

## 下一步

下一阶段再规划第二地域；当前不扩展第二境界、联网或批量生成全量正式素材。
