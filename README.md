# CrossFlow

<p align="center">
  <b>轻量级跨境电商工作流桌面端</b><br/>
  多平台 · 离线优先 · 一键管理
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue">
  <img src="https://img.shields.io/badge/electron-31-9cf">
  <img src="https://img.shields.io/badge/react-18-61dafb">
  <img src="https://img.shields.io/badge/typescript-5.5-blue">
  <img src="https://img.shields.io/badge/tests-126-green">
  <img src="https://img.shields.io/badge/license-MIT-yellow">
</p>

---

## 这是什么

CrossFlow 是一款面向跨境电商卖家的桌面管理工具。它将多平台订单、库存、商品和采购数据汇聚到一个本地应用中，**不依赖云端服务，数据完全掌握在自己手里**。

典型场景：你同时在 Amazon、Shopee、Temu 上卖货，仓库分布在广州、美东 FBA 和德国海外仓。每天需要：

- 汇总各平台订单 → CrossFlow 自动同步 / Excel 导入
- 核对各仓库存 → 统一视图，低于安全线自动预警
- 决定补什么货、补多少 → 智能建议（加权日均销量 × 备货周期 × 1.2 安全系数）
- 合并同地址订单省运费 → 一键合并
- 翻译商品信息 → 内置 AI 翻译
- 管理供应商和采购单 → 收货自动入库
- 监控评价和货运 → 差评预警 + 海运/空运跟踪

---

## 功能

### 经营仪表盘

| 指标 | 说明 |
|------|------|
| 今日销售额 | 各平台汇总，多币种统一换算为 USD，对比昨日 |
| 今日订单数 | 当日总订单量，含环比 |
| SKU 总数 | 活跃在售商品（有库存或有活跃平台链接） |
| 库存周转天数 | 可售库存 ÷ 近 30 天日均销量 |
| 销售趋势图 | 近 30 天每日收入 + 订单数，分平台堆叠 |
| 平台占比饼图 | 各平台收入贡献占比 |
| 库存预警 | 可售量低于安全线的 SKU，按紧急度排序 |
| SKU 利润排行 | 扣减采购成本 + 平台佣金 + 支付手续费 + 其他费用 |

### 订单管理

- **多平台统一视图** — Amazon / Shopee / Temu / TikTok / Lazada
- **状态流转** — pending → matched → shipped → delivered
- **批量发货** — 选中多单一键标记，自动扣减库存
- **智能合并** — 同 SKU + 同地址自动识别可合并订单
- **物流追踪** — 按仓库类型判定国内/国际：国内 ≥7 天、国际 ≥21 天延迟预警
- **Excel 导入** — Temu / TikTok 等无 API 平台
- **状态防回退** — 已发货订单重新同步不会降级为 pending

### 库存管理

- **多仓库统一管理** — 广州仓 / FBA / 海外仓独立视图
- **安全库存预警** — 可售 < 安全线自动标红
- **智能补货建议** — 加权移动平均（近 7 天 50% + 8-14 天 30% + 15-30 天 20%）× 备货周期
- **补货数量校验** — 禁止负库存预留
- **分批收货** — 在途分批到仓，不一次收完
- **操作日志** — 全部库存变动可追溯
- **订单自动联动** — matched 预留库存，shipped 扣减，cancelled/refunded 释放

### 商品管理

- SKU 编码、中英文名称、分类、采购成本、重量
- AI 翻译 — DeepSeek 中文商品名一键转英文
- 平台 SKU 映射 — product_platform 表自动维护各平台 SKU 对应关系

### 采购管理

- 供应商管理 — 名称、联系人、交期、MOQ、付款条款
- 采购单 — 从供应商下单，确认→发货→收货全流程
- 收货自动入库 — purchase order received → 库存 available 自动增加

### 评价管理

- 各平台评价汇总，评分筛选
- 差评自动预警（评分 ≤ 2）
- 预警确认和已读管理

### 货运管理

- 海运 / 空运 / 铁路 / 卡车运输单管理
- 集装箱号 / 提单号追踪
- 预计到港日期管理

### 平台对接

| 平台 | 对接方式 | SKU 来源 | 状态 |
|------|---------|---------|------|
| **Amazon** | SP-API OAuth2 | orderItems API（多 item 支持） | ✅ 11 个 marketplace |
| **Shopee** | Open API HMAC-SHA256 | get_order_detail（多 item 支持） | ✅ 9 个国家 |
| **Lazada** | Open Platform API | order items API | ✅ 6 个国家 |
| **TikTok Shop** | Partner API / Cookie 双策略 | Partner API item 提取 | ✅ 8 个站点 |
| **Temu** | Excel 导入 | Excel 列解析 | ✅ |

### 系统功能

- **多用户认证** — pbkdf2 密码哈希，admin/operator/cs/warehouse 四角色 RBAC
- **数据备份** — 内存快照导出（无 I/O 竞争），原子 rename 写盘
- **系统托盘** — 关闭窗口最小化到托盘，托盘菜单触发真实同步
- **同步调度** — 每个平台独立配置间隔（默认15分钟），并发锁防重复
- **错误边界** — 页面异常不白屏，Sidebar/Header 保持可用
- **API 密钥保护** — OS 级密钥链加密（safeStorage），不返回明文到渲染进程
- **CSV 导出** — 订单/库存/利润报表导出，UTF-8 BOM + 公式注入防护

---

## 技术架构

```
┌─────────────────────────────────────────┐
│              Electron 31                 │
│                                         │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ 主进程    │  │   渲染进程             │ │
│  │          │  │                      │ │
│  │ 62 IPC   │  │ React 18 + Antd 5    │ │
│  │ 5 sync   │◄─┤ 10 页面 + 9 Store     │ │
│  │ 9 repo   │  │ ECharts              │ │
│  │ auth     │  │                      │ │
│  └────┬─────┘  └──────────────────────┘ │
│       │                                 │
│  ┌────▼─────┐                           │
│  │  sql.js   │  WASM SQLite · 25 张表    │
│  └──────────┘                           │
└─────────────────────────────────────────┘
```

### 数据库（9 个迁移，25 张表）

```
platform ── fee_config
platform ── order ── order_item ── order_cost
platform ── product_platform ── product
product ── inventory ── inventory_log
product ── supplier ── purchase_order ── purchase_order_item
product ── product_review ── review_alert
warehouse ── inventory
user ── audit_log
freight_shipment ── freight_shipment_item
currency ── exchange_rate_log
```

---

## 项目结构

```
CrossFlow/
├── electron/                    # Electron 主进程 (43 源文件)
│   ├── db/
│   │   ├── connection.ts        #   sql.js 连接 + PreparedStatement 封装
│   │   ├── migrations/         #   数据库迁移 001-009
│   │   ├── repositories/       #   仓储层 (9 repo)
│   │   ├── matching.ts          #   SKU 匹配引擎
│   │   ├── profit-calculator.ts #   利润计算（共享）
│   │   ├── dashboard-metrics.ts #   仪表盘指标
│   │   └── safe-columns.ts      #   UPDATE 字段白名单
│   ├── sync/
│   │   ├── scheduler.ts         #   定时调度 + 并发锁
│   │   ├── amazon.ts            #   Amazon SP-API（分页 + 限流）
│   │   ├── shopee.ts            #   Shopee Open API（分页 + 限流）
│   │   ├── lazada.ts            #   Lazada Open Platform
│   │   ├── tiktok.ts            #   TikTok Partner API + Cookie
│   │   ├── temu.ts              #   Temu Excel 解析
│   │   ├── tracking.ts          #   物流追踪（仓库类型判定）
│   │   ├── tracking-real.ts     #   真实物流 API（17TRACK/AfterShip）
│   │   ├── exchange-rate.ts     #   汇率同步
│   │   └── rate-limiter.ts      #   令牌桶限流器
│   ├── ai/                      #   AI 翻译适配器
│   ├── auth.ts                  #   认证（pbkdf2 + RBAC）
│   ├── secrets.ts               #   OS 密钥链（safeStorage）
│   ├── export.ts                #   CSV 导出
│   ├── store.ts                 #   electron-store 单例
│   ├── main.ts                  #   主进程入口
│   ├── ipc-handlers.ts          #   62 个 IPC 处理器
│   ├── preload.ts               #   Preload
│   └── tray.ts                  #   系统托盘
│
├── src/                         # 渲染进程 (45 源文件)
│   ├── pages/                   #   10 页面
│   │   ├── Onboarding/          #     快速入门
│   │   ├── Dashboard/           #     经营仪表盘
│   │   ├── Orders/              #     订单管理
│   │   ├── Inventory/           #     库存管理
│   │   ├── Products/            #     商品管理
│   │   ├── Procurement/         #     采购管理
│   │   ├── Freight/             #     货运管理
│   │   └── Reviews/             #     评价管理
│   ├── components/              #   组件
│   │   ├── dashboard/           #     MetricCard, SalesChart, PlatformPie, etc.
│   │   ├── inventory/           #     InventoryTable, StockAlert, WarehouseCard
│   │   ├── order/               #     OrderTable, OrderStatusTag
│   │   ├── layout/              #     Header, Sidebar
│   │   └── shared/              #     ErrorBoundary, ImportExcel
│   ├── stores/                  #   9 个 Zustand Store（含 loading/error 状态）
│   ├── hooks/                   #   useIpc, usePolling
│   ├── shared/                  #   IPC 常量 (62 通道) + getApi
│   └── types/                   #   TypeScript 类型
│
├── tests/                       # 11 个测试文件
│   ├── sync-modules.test.ts     #   同步模块 (16)
│   ├── product-platform-warehouse.test.ts  # 仓储层 (33)
│   ├── order-repo.test.ts       #   订单仓储 (15)
│   ├── inventory.test.ts        #   库存逻辑 (8)
│   ├── ai-adapter.test.ts       #   AI 适配器 (4 mock + 6 live)
│   ├── stores.test.ts           #   Zustand Store (14)
│   ├── hooks.test.ts            #   React Hooks (11)
│   ├── components.test.ts       #   React 组件 (7)
│   ├── repository-tests.test.ts #   Repository 集成 (8)
│   ├── full-flow.test.ts        #   全流程集成
│   └── e2e/comprehensive.spec.ts #  Playwright E2E (27)
│
├── .github/workflows/ci.yml     # CI: type-check + lint + test + build
├── electron.vite.config.ts
├── vite.e2e.config.ts
├── electron-builder.yml
└── package.json
```

---

## 快速开始

> Node.js >= 18

```bash
git clone git@github.com:Kasyou/CrossFlow.git
cd CrossFlow
npm install
npm run dev        # Electron 开发模式
```

### 命令

```bash
npm run dev           # Vite + Electron 开发
npm run build         # 生产构建
npm test              # 单元测试 (126 用例)
npm run test:e2e      # Playwright E2E (27 用例)
npm run type-check    # tsc --noEmit
npm run lint          # ESLint
npm run ci            # type-check + lint + test
```

---

## 常见问题

**Q: 为什么用 sql.js？**

sql.js 是纯 WebAssembly，零原生依赖，`npm install` 即用。better-sqlite3 需要编译原生模块且 Electron 打包复杂。

**Q: 数据库存在哪里？**

`%APPDATA%/crossflow.db` (Windows) 或 `~/Library/Application Support/crossflow.db` (macOS)。

**Q: API Key 安全吗？**

平台授权信息通过 Electron `safeStorage`（Windows DPAPI / macOS Keychain / Linux libsecret）加密。AI API Key 不返回明文到渲染进程。

---

## License

MIT © CrossFlow
