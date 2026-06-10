# CrossFlow

轻量级跨境电商工作流桌面端。基于 Electron + React + sql.js 构建，支持多平台订单管理、库存追踪、智能补货建议和 AI 翻译。

## 功能

- **经营仪表盘** — 销售额、订单量、SKU 数量、库存周转天数实时概览，销售趋势图 + 平台占比饼图 + SKU 利润排行
- **订单管理** — 多平台订单统一视图，状态筛选，批量发货，同地址订单智能合并，物流跟踪
- **库存管理** — 多仓库库存概览，安全库存预警，补货建议（基于日均销量 × 备货周期），库存流水日志
- **商品管理** — SKU 信息管理，分类维护，AI 翻译（中文商品名 → 英文）
- **平台对接** — Amazon SP-API / Shopee / TikTok Shop / Temu / Lazada，支持 Excel 订单导入
- **设置** — 平台授权配置，同步开关与间隔，数据库自动备份

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 31 |
| 前端 | React 18 + TypeScript 5 + Ant Design 5 |
| 状态管理 | Zustand |
| 图表 | ECharts |
| 数据库 | sql.js (WebAssembly SQLite) |
| 构建 | electron-vite + Vite 5 |
| 测试 | Vitest + React Testing Library + Playwright |
| 代码规范 | ESLint + TypeScript strict |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Vite dev server + Electron）
npm run dev

# 运行单元测试
npm test

# 运行 E2E 测试（需要 Vite dev server）
npm run test:e2e

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 生产构建
npm run build
```

## 项目结构

```
CrossFlow/
├── electron/              # Electron 主进程
│   ├── db/                #   数据库连接 & 迁移 & 仓储层
│   ├── sync/              #   平台同步模块 (Amazon/Shopee/Temu/TikTok)
│   ├── ai/                #   AI 翻译适配器
│   ├── main.ts            #   主进程入口
│   ├── ipc-handlers.ts    #   IPC 处理器
│   ├── preload.ts         #   Preload 脚本
│   ├── store.ts           #   electron-store 单例
│   └── tray.ts            #   系统托盘
├── src/                   # 渲染进程 (React)
│   ├── components/        #   通用组件 & 业务组件
│   ├── pages/             #   页面 (Dashboard/Orders/Inventory/Products/Settings)
│   ├── stores/            #   Zustand 状态管理
│   ├── hooks/             #   自定义 Hooks
│   ├── shared/            #   共享常量 (IPC 通道定义)
│   └── types/             #   TypeScript 类型定义
├── tests/                 # 测试
│   ├── e2e/               #   Playwright E2E 测试 (27 用例)
│   ├── *.test.ts          #   Vitest 单元测试 (115 用例)
│   └── setup-global.ts    #   测试全局配置
├── .github/workflows/     # CI/CD (GitHub Actions)
├── electron.vite.config.ts
└── package.json
```

## 平台对接状态

| 平台 | API 同步 | Excel 导入 | 状态 |
|------|---------|-----------|------|
| Amazon | SP-API (OAuth) | — | ✅ |
| Shopee | Open API (HMAC) | — | ✅ |
| Temu | — | Excel 解析 | ✅ |
| TikTok Shop | 无公开 API | Excel 解析 | ⚠️ 需授权 |
| Lazada | — | — | 🔜 计划中 |

## 开发说明

- **跨平台** — 支持 Windows / macOS / Linux
- **离线优先** — sql.js 在渲染进程内运行，无需额外数据库服务
- **安全** — `contextIsolation: true`，`nodeIntegration: false`，preload 暴露最小 API
- **IPC 模式** — 所有通道定义集中在 `src/shared/ipc-channels.ts`，主进程和渲染进程统一引用

## License

MIT
