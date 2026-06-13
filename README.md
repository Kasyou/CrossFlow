# CrossFlow

<p align="center">
  <b>轻量级跨境电商工作流桌面端</b><br/>
  多平台 · 离线优先 · 一键管理
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="platform">
  <img src="https://img.shields.io/badge/electron-31-9cf" alt="electron">
  <img src="https://img.shields.io/badge/react-18-61dafb" alt="react">
  <img src="https://img.shields.io/badge/typescript-5.5-blue" alt="typescript">
  <img src="https://img.shields.io/badge/test-115%2F115-green" alt="tests">
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="license">
</p>

---

## 这是什么

CrossFlow 是一款面向跨境电商卖家的桌面管理工具。它将多平台订单、库存、商品数据汇聚到一个本地应用中，**不依赖云端服务，数据完全掌握在自己手里**。

典型场景：你同时在 Amazon、Shopee、Temu 上卖货，仓库分布在广州、美东 FBA 和德国海外仓。每天需要：

- 汇总各平台订单 → CrossFlow 自动同步 / Excel 导入
- 核对各仓库存 → 统一视图，低于安全线自动预警
- 决定补什么货、补多少 → 智能建议（日均销量 × 备货周期 × 1.2 安全系数）
- 合并同地址订单省运费 → 一键合并
- 翻译商品信息 → 内置 AI 翻译，中文一键转英文

---

## 功能详解

### 经营仪表盘

实时掌握生意全貌：

| 指标 | 说明 |
|------|------|
| 今日销售额 | 当日各平台汇总收入，对比昨日变化 |
| 今日订单数 | 当日总订单量，含环比 |
| SKU 总数 | 在售商品数量 |
| 库存周转天数 | 当前可售库存 ÷ 近 30 天日均销量，衡量资金效率 |
| 销售趋势图 | 近 30 天每日收入 + 订单数，分平台堆叠 |
| 平台占比饼图 | 各平台收入贡献占比 |
| 库存预警 TOP10 | 可售量低于安全线的 SKU，按紧急度排序 |
| SKU 利润排行 | 近 30 天按估算利润排序的 TOP20 |

### 订单管理

```
全平台订单统一视图
├── 状态筛选    pending → matched → shipped → delivered
├── 批量发货    选中多单 → 一键标记已发货
├── 智能合并    同 SKU + 同地址 → 自动识别可合并订单
├── 物流追踪    基于仓库类型判定国内/国际，逾期自动预警
│               · 国内仓发货：超过 7 天 → 延迟
│               · 海外仓/FBA：超过 21 天 → 延迟
├── Excel 导入  Temu/TikTok 等无 API 平台，解析标准格式表格
└── 分页 & 筛选  平台、SKU、日期范围自由组合
```

### 库存管理

```
多仓库统一管理
├── 仓库概览卡片    广州仓 / FBA美东 / 海外仓 独立展示
├── 库存明细表      SKU × 仓库 维度，可售/已占用/在途 一目了然
├── 安全库存预警    可售 < 安全线 → 红色预警
├── 智能补货建议
│   ┌─────────────────────────────────────────────┐
│   │ 建议补货量 = max(安全库存, 日均销量 × 备货周期 × 1.2) │
│   │              - 当前可售 - 在途库存              │
│   │                                             │
│   │ 紧急度分级：                                  │
│   │ · 紧急 (urgent) — 可售 = 0                   │
│   │ · 高 (high)   — 可售 < 安全线 × 30%         │
│   │ · 普通 (normal) — 其他                       │
│   └─────────────────────────────────────────────┘
├── 一键补货          点击即创建补货单，增加在途数量
├── 到货确认          在途 → 可售
└── 操作日志          全部库存变动可追溯
```

### 商品管理

```
SKU 全生命周期管理
├── 基本信息    SKU 编码、中英文名称、分类、采购成本、重量
├── AI 翻译     输入中文商品名 → DeepSeek 自动翻译为英文
├── 安全库存     每个 SKU 独立设置安全线
└── 批量操作      增删改查
```

### 平台对接

| 平台 | 方式 | 支持范围 |
|------|------|---------|
| **Amazon** | SP-API (OAuth2) | 订单拉取，状态自动映射 |
| **Shopee** | Open API (HMAC-SHA256) | 订单列表同步 |
| **Temu** | Excel 导入 | 标准订单表格解析（中英文列名兼容） |
| **TikTok Shop** | Excel 导入 | 无公开 API，表格导入 |
| **Lazada** | Open Platform API (HMAC-SHA256) | — | ✅ |

### 系统功能

- **数据备份** — 设置备份目录，每 24 小时自动备份 SQLite 数据库
- **系统托盘** — 关闭窗口最小化到托盘，后台持续同步
- **同步调度** — 每个平台独立配置同步开关和间隔（默认 15 分钟）
- **错误边界** — 页面异常不会导致白屏，Sidebar/Header 保持可用

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Electron 31                       │
│                                                     │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  主进程 (Main) │  │      渲染进程 (Renderer)       │ │
│  │              │  │                              │ │
│  │  ipc-handlers│  │  React 18 + Ant Design 5     │ │
│  │  sync/       │◄─┤  Zustand Stores (9)          │ │
│  │  db/         │  │  ECharts                     │ │
│  │  ai/         │  │  React Router (Hash)          │ │
│  │  tray/       │  │                              │ │
│  └──────┬───────┘  └──────────────────────────────┘ │
│         │                                           │
│  ┌──────▼───────┐                                   │
│  │   sql.js      │  WebAssembly SQLite              │
│  │   (WASM)      │  零依赖 · 本地文件存储              │
│  └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

### 数据流

```
平台 API / Excel → sync 模块 → Repository 层 → sql.js (WASM)
                                                  │
用户操作 → React 组件 → Zustand Store → IPC → Handler → Repository ─┘
                                                  │
渲染层 ← IPC 响应 ←┘                               │
```

### 数据库设计

```
platform ──┐                  warehouse
           │                      │
product ───┤                      │
           │                      │
           ├── product_platform    ├── inventory ─── inventory_log
           │
order ─────┘

sync_log (独立)
```

核心约束：`order.platform_id + platform_order_id` 唯一，保证同平台订单不会重复导入。

### 安全设计

| 措施 | 说明 |
|------|------|
| `contextIsolation: true` | 渲染进程无法直接访问 Node.js API |
| `nodeIntegration: false` | 彻底隔离主进程和渲染进程 |
| Preload 最小暴露 | 仅暴露 `invoke(channel, ...args)` 和 `on(channel, callback)` |
| IPC 白名单 | 所有通道定义在 `shared/ipc-channels.ts`，不存在运行时字符串拼接 |
| electron-store 加密 | API Key 等敏感数据加密存储，密钥集中管理 |

---

## 项目结构

```
CrossFlow/
├── electron/                    # Electron 主进程 (20 源文件)
│   ├── db/                      #   数据库层
│   │   ├── connection.ts        #     sql.js 连接管理、PreparedStatement 封装
│   │   ├── migrations/         #     数据库迁移 (DDL)
│   │   └── repositories/       #     仓储层 (Order/Product/Inventory/Platform/Warehouse/SyncLog)
│   ├── sync/                    #   平台同步模块
│   │   ├── scheduler.ts         #     定时调度 (node-cron)
│   │   ├── amazon.ts            #     Amazon SP-API
│   │   ├── shopee.ts            #     Shopee Open API (HMAC 签名)
│   │   ├── temu.ts              #     Temu Excel 解析
│   │   ├── tiktok.ts            #     TikTok Shop
│   │   └── tracking.ts          #     物流追踪
│   ├── ai/                      #   AI 翻译适配器
│   ├── main.ts                  #   主进程入口
│   ├── ipc-handlers.ts          #   全部 IPC 处理器 (30+)
│   ├── preload.ts               #   Preload 脚本
│   ├── store.ts                 #   electron-store 单例
│   └── tray.ts                  #   系统托盘
│
├── src/                         # 渲染进程 (36 源文件)
│   ├── pages/                   #   页面
│   │   ├── Dashboard/           #     经营仪表盘
│   │   ├── Orders/              #     订单管理
│   │   ├── Inventory/           #     库存管理
│   │   ├── Products/            #     商品管理
│   │   ├── Settings/            #     设置
│   │   └── Onboarding/          #     快速入门
│   ├── components/              #   组件
│   │   ├── dashboard/           #     仪表盘组件 (MetricCard/SalesChart/PlatformPie/StockAlert/SkuProfitRank)
│   │   ├── inventory/           #     库存组件 (InventoryTable/StockAlert/WarehouseCard)
│   │   ├── order/               #     订单组件 (OrderTable/OrderStatusTag)
│   │   ├── layout/              #     布局 (Header/Sidebar)
│   │   └── shared/              #     共享组件 (ErrorBoundary/ImportExcel)
│   ├── stores/                  #   Zustand 状态管理
│   │   ├── dashboard-store.ts   #     仪表盘数据
│   │   ├── order-store.ts       #     订单数据
│   │   ├── inventory-store.ts   #     库存数据
│   │   ├── product-store.ts     #     商品数据
│   │   ├── warehouse-store.ts   #     仓库数据
│   │   ├── platform-store.ts    #     平台配置
│   │   └── settings-store.ts    #     应用设置
│   ├── hooks/                   #   自定义 Hooks (useIpc/usePolling)
│   ├── shared/                  #   共享常量 (IPC 通道定义)
│   └── types/                   #   TypeScript 类型
│
├── tests/                       # 测试
│   ├── inventory.test.ts        #   库存业务逻辑 (8)
│   ├── order-repo.test.ts       #   订单仓储测试 (15)
│   ├── product-platform-warehouse.test.ts  # 产品/平台/仓库 (33)
│   ├── ai-adapter.test.ts       #   AI 适配器 — 真实 API 调用 (6)
│   ├── sync-modules.test.ts     #   同步模块 + Bug 检测 (16)
│   ├── stores.test.ts           #   Zustand 状态管理 (14)
│   ├── hooks.test.ts            #   React Hooks (11)
│   ├── components.test.ts       #   React 组件 (7)
│   ├── e2e/                     #   Playwright E2E (27)
│   └── setup-global.ts          #   全局测试环境
│
├── .github/workflows/ci.yml     # CI/CD
├── electron.vite.config.ts
└── package.json
```

---

## 快速开始

> 需要 Node.js >= 18

```bash
# 1. 克隆仓库
git clone git@github.com:Kasyou/CrossFlow.git
cd CrossFlow

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

### 常用命令

```bash
npm run dev           # Vite + Electron 开发模式
npm run build         # 生产构建 (electron-vite + electron-builder)
npm test              # 单元测试 (Vitest, 115 用例)
npm run test:e2e      # E2E 测试 (Playwright, 27 用例)
npm run type-check    # TypeScript 类型检查 (tsc --noEmit)
npm run lint          # ESLint 代码检查
npm run lint:fix      # ESLint 自动修复
npm run ci            # 完整质量门禁 (type-check + lint + test)
```

---

## 测试覆盖

| 层级 | 文件 | 用例数 | 环境 |
|------|------|--------|------|
| 数据库 + 库存逻辑 | `inventory.test.ts` | 8 | node (sql.js WASM) |
| 订单仓储 | `order-repo.test.ts` | 15 | node (sql.js WASM) |
| 产品/平台/仓库 | `product-platform-warehouse.test.ts` | 33 | node (sql.js WASM) |
| AI 适配器 | `ai-adapter.test.ts` | 6 | node (真实 API) |
| 同步模块 | `sync-modules.test.ts` | 16 | node (Mock) |
| Zustand Stores | `stores.test.ts` | 14 | jsdom |
| React Hooks | `hooks.test.ts` | 11 | jsdom |
| React 组件 | `components.test.ts` | 7 | jsdom |
| E2E 全流程 | `e2e/comprehensive.spec.ts` | 27 | Playwright |
| **合计** | **9 文件** | **142** | |

---

## 常见问题

**Q: 为什么用 sql.js 而不是 better-sqlite3？**

better-sqlite3 需要编译原生模块，在 Electron + Vite 环境配置复杂且跨平台打包容易出问题。sql.js 是纯 WebAssembly，零原生依赖，npm install 即用。

**Q: 数据库存在哪里？**

`%APPDATA%/Electron/crossflow.db`（Windows）或 `~/Library/Application Support/Electron/crossflow.db`（macOS）。支持通过设置界面配置自动备份。

**Q: API Key 安全吗？**

平台授权信息和 AI API Key 通过 `electron-store` 加密存储，密钥不出现在源码中。Electron 主进程和渲染进程隔离，外部脚本无法访问。

---

## License

MIT © CrossFlow
