# 山海问道

东方志怪题材的放置养成 × 卡牌构筑 × 轻量肉鸽单机游戏。

玩家携两只妖灵挂机历练、收集武器功法与奇物，并在境界瓶颈中进入随机劫境，通过卡牌 Combo 完成突破。

## 当前状态

项目处于 **M2 三流派完成阶段**。24 张牌、6 只妖灵、6 套快捷构筑、3 种跨流派 Combo、确定性自动战斗与首批像素美术样板已经可玩。

## 文档入口

- [游戏设计文档](docs/东方志怪放置卡牌_GDD_v0.1.md)
- [文档索引](docs/README.md)
- [技术架构](docs/architecture.md)
- [内容数据规范](docs/content-schema.md)
- [原型验收清单](docs/prototype-checklist.md)

## 原型边界

- 横屏电脑网页、单机、本地存档。
- 一个地域“槐阴古道”，炼气至筑基。
- 30 个挂机关卡、卡桌战斗和一个 15–25 分钟突破劫境。
- 三套流派：剑意、符咒、御灵。
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

进入 M3：接入配装槽、图鉴、统一升级、免费重置、重复转精华和可安全导入导出的本地存档。
