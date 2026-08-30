# 山海问道

东方志怪题材的放置养成 × 卡牌构筑 × 轻量肉鸽单机游戏。

玩家携两只妖灵挂机历练、收集武器功法与奇物，并在境界瓶颈中进入随机劫境，通过卡牌 Combo 完成突破。

## 当前状态

项目处于 **M4 挂机主线完成阶段**。30 关槐阴古道、在线/离线同核推进、失败回退、稳定刷取、解释性离线报告、v2 存档迁移与 17 件主线像素素材已经接入。

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
- M4 已包含 30 关、1–3 波敌人、最多 24 小时离线结算和 17 件主线像素素材。
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

完成 M4 自动检查和人工验收后进入 M5：实现 7×7 槐阴劫境、行炁、迷雾、临时牌组、怪谈事件和突破结算。M5 之前不扩展第二地域或批量生成全量正式素材。
