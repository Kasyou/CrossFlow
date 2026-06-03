# CrossFlow Design Spec

## 产品概述

CrossFlow 是一款面向中国中小型跨境电商企业（1-100人规模）的桌面端工作流工具。核心定位：把中小卖家每天花2-3小时的多平台订单处理+库存核对，压缩到15分钟。

- **产品形态**：Electron + React 桌面客户端
- **技术栈**：Electron 28+ / React 18 + TypeScript / SQLite (better-sqlite3) / Zustand / Ant Design 5 / ECharts
- **定价模式**：开源核心 + 商业授权（基础功能开源免费）
- **首批平台**：Amazon（SP-API）、TikTok Shop、Temu、Shopee + Lazada

## 市场背景与痛点分析

### 关键数据

- 2024年中国跨境ERP市场规模 16.5亿元，预计2029年达46.2亿元（CAGR 24.5%）
- 2025年约30%小卖家计划离场，头部1%卖家吸走64%订单
- 仅20.8%商家实现全渠道ERP连通，67.2%企业使用多个系统但集成不足
- Temu全球市场份额达24%，与亚马逊持平，多平台运营从可选项变为必选项

### 中小卖家五大痛点

| 层级 | 痛点 | 具体表现 |
|------|------|---------|
| 1 | 多平台订单碎片化 | 每天登录4+后台，手动导出合并订单，耗时1小时+ |
| 2 | 库存管理混乱 | 多平台多仓库超卖/断货并存，"库存一锅粥" |
| 3 | 利润算不清 | 各平台佣金/费率不同，算不出单SKU真实利润 |
| 4 | 合规压力 | 税务新规落地，欧盟GPSR/DSA等法规门槛 |
| 5 | 工具不匹配 | 易仓太贵太复杂，店小秘高并发卡顿，缺少"刚好够用"的选择 |

### 市场空白

缺少一款为年GMV 50万-500万美元的中小卖家设计的、价格亲民、开箱即用、覆盖"订单-库存-财务-合规"核心链路的轻量级解决方案。

### 竞品对比

| 维度 | 易仓/马帮 | 店小秘 | CrossFlow |
|------|----------|--------|-----------|
| 形态 | Web SaaS | Web SaaS | 桌面端 |
| 价格 | 1-3.8万/年 | 免费版受限 | 开源免费 |
| 定位 | 中大型/集团 | 中小铺货型 | 中小精品卖家 |
| 复杂度 | 50+模块 | 功能泛 | 聚焦核心，刚好够用 |
| 数据安全 | 云端 | 云端 | 本地存储 |
| 多平台 | 较全 | 70+平台 | 首批4大平台 |

## 目标用户画像

- 团队规模：1-100人
- 年GMV：50万-500万美元
- 运营平台：2-4个（Amazon + TikTok Shop + Temu + Shopee/Lazada）
- SKU数量：50-2000个
- 日均订单：50-500单
- 仓库数量：1-3个（国内仓 + 1-2个海外仓/FBA）
- 核心痛点：多平台切换效率低、库存经常超卖、利润算不清楚

## 核心业务流程

### 跨境中小卖家典型日常

```
08:30 登录Amazon后台 → 看新订单 → 导出
09:00 登录TikTok Shop后台 → 看新订单 → 导出
09:15 登录Temu后台 → 看新订单 → 导出
09:30 登录Shopee后台 → 看新订单 → 导出
      ↑ 光是看订单就花了1小时 ↑

10:00 打开Excel，手动合并4平台订单
10:30 对照库存表，看哪些能发、哪些快断了
11:00 在物流后台逐个打单、发货
11:30 发现有2个SKU快超卖了，赶紧去各平台改库存
      ↑ 每天都在救火 ↑

14:00 又有人退款了，去各平台查是哪笔
15:00 老板问：这周赚了多少？答不上来...
      ↑ 信息滞后，决策靠猜 ↑
```

### CrossFlow优化后

```
08:30 打开CrossFlow → 4平台订单已自动同步 → 一键勾选发货 → 搞定
      库存低于安全线自动告警 → 点"暂停销售"按钮 → 全部平台同步下架
      仪表盘自动刷新 → 今日卖了多少钱/哪个品最赚钱/库存周转 → 一目了然
      ↑ 15分钟完成 ⬆
```

## 功能模块设计

### V1 功能范围：三大核心模块

#### 模块一：多平台订单管理中心

**功能列表**：

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 统一订单池 | 4大平台订单自动汇聚，一个界面查看所有来源订单 | P0 |
| 定时自动同步 | 每5-15分钟自动拉取新订单（用户可调间隔） | P0 |
| 一键发货 | 选中订单→匹配物流→打单→回填运单号 | P0 |
| 物流轨迹追踪 | 自动同步物流状态，异常状态（超时未签收/退回）标红 | P1 |
| 智能合并 | 同收件地址+同SKU订单自动提示合并处理 | P1 |
| 退款管理 | 各平台退款单统一归集，按原因分类统计 | P1 |
| 手动导入Excel | 无API的平台（Temu）通过拖入Excel导入订单 | P0 |

**订单状态流转**：
```
待处理 → 已匹配库存 → 已打单 → 已发货 → 已签收
                                     ↘ 退款中 → 已退款
```

#### 模块二：智能库存管理

**功能列表**：

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 多仓库管理 | 自定义仓库（国内仓/FBA/海外仓），每个SKU分仓库记录 | P0 |
| 多平台库存联动 | 任一平台卖出一件，3秒内同步扣减所有平台的可售库存 | P0 |
| 安全库存预警 | 每个SKU设置安全线，低于阈值自动弹窗+系统通知 | P0 |
| 占用/可用/在途分离 | available=可售, reserved=已下单未发货, in_transit=补货中 | P0 |
| 出入库明细 | 每笔库存变动可追溯：时间、数量、原因、操作人 | P1 |
| 智能补货建议 | 基于近30天日均销量 + 物流时效，计算建议补货量和补货时间 | P1 |
| 一键暂停销售 | 库存告急SKU可一键在所有平台设为0库存，暂停接单 | P1 |

**库存数据模型**：
```
Inventory(sku_id, warehouse_id, available, reserved, in_transit, safety_stock)
  - available: 当前可售数量
  - reserved: 已下单未发货占用数量
  - in_transit: 补货在途数量
  - safety_stock: 安全库存阈值（用户自定义）
```

#### 模块三：经营仪表盘

**功能列表**：

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 核心指标卡片 | 今日销售额/订单量/库存周转天数/广告ROI，环比昨日变化 | P0 |
| 近30天销售趋势（分平台） | 折线图，按平台维度拆分，一眼看哪家在掉量 | P0 |
| 库存预警TOP10 | 最紧急的库存问题排序，直接显示建议操作 | P0 |
| SKU利润排行 | 按估算利润排序，列出最赚钱和最亏钱的SKU | P1 |
| 平台销售占比 | 饼图，各平台GMV占比一目了然 | P1 |
| 异常检测提醒 | 突然爆单/暴跌/退款率飙升，主动推送系统通知 | P1 |

**仪表盘数据刷新策略**：打开页面实时刷新，后台每5分钟增量更新，避免频繁全量查询。

### AI辅助能力（V1）

AI不作为核心卖点，而是嵌入为实用辅助功能：

| 功能 | 场景 | 技术方案 |
|------|------|---------|
| 商品标题/描述翻译 | 中文Listing一键翻译为英文/日文/西语 | DeepSeek API（默认），兼容千问/GLM |
| 退款原因智能归类 | 自动将退款原因文本分类为"质量问题/物流问题/买家原因"等 | 本地分类器 + API兜底 |
| 异常检测通知 | "SKU蓝牙耳机近3天退款率异常上升50%，建议检查" | 统计规则 + LLM生成通知文案 |

**AI供应商设计**：统一Adapter层，兼容OpenAI API协议。默认推荐DeepSeek（国内公司、无需翻墙、价格低、微信支付宝充值），也支持千问、智谱GLM。断网场景降级到本地Ollama模型。

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   CrossFlow                          │
│  ┌──────────────────────────────────────────────┐   │
│  │           Renderer Process (React 18)         │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │   │
│  │  │订单管理│ │库存管理│ │仪表盘  │ │设置   │ │   │
│  │  └────────┘ └────────┘ └────────┘ └───────┘ │   │
│  │         Zustand 状态管理  │  Ant Design 5    │   │
│  └──────────────────────────────────────────────┘   │
│                       ↕ IPC                          │
│  ┌──────────────────────────────────────────────┐   │
│  │            Main Process (Node.js)             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ 平台连接器│ │ 数据同步 │ │ 本地存储     │ │   │
│  │  │ Amazon   │ │ 引擎     │ │ SQLite       │ │   │
│  │  │ TikTok   │ │ node-cron│ │ better-      │ │   │
│  │  │ Temu     │ │ 定时调度 │ │ sqlite3      │ │   │
│  │  │ Shopee   │ │          │ │ WAL模式      │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ 系统托盘 │ │ 自动更新 │ │ AI辅助       │ │   │
│  │  │ 常驻后台 │ │ electron │ │ DeepSeek/千问│ │   │
│  │  │ 最小化到 │ │ -updater │ │ /Ollama本地  │ │   │
│  │  │ 托盘运行 │ │          │ │              │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 框架 | Electron 28+ | 成熟稳定，跨平台(Win/Mac/Linux) |
| 前端 | React 18 + TypeScript | 类型安全，生态丰富 |
| 状态管理 | Zustand | 轻量，适合桌面端中等复杂度 |
| UI组件 | Ant Design 5 | 表格/表单能力突出，适合企业工具 |
| 图表 | ECharts + echarts-for-react | 仪表盘可视化 |
| 本地数据库 | SQLite (better-sqlite3) | 零配置，单文件，同步API性能好 |
| 数据同步 | node-cron | 轻量定时任务，无需额外依赖 |
| AI | OpenAI兼容API + Ollama | 多供应商可插拔，默认DeepSeek |
| 打包 | electron-builder | 自动更新支持，跨平台打包 |
| 测试 | Vitest (单元) + Playwright (E2E) | 快 + 可靠 |

### 平台对接策略

| 平台 | 对接方式 | 说明 |
|------|---------|------|
| Amazon | SP-API（官方） | 全球站点统一API，订单/库存/物流全覆盖 |
| Shopee/Lazada | Open Platform API | 官方开放平台，覆盖东南亚+拉美 |
| TikTok Shop | Cookie模拟 + Excel兜底 | 无公开API，Electron内嵌webview登录拉取；失败降级手动导入 |
| Temu | Excel导入为主 | 全托管模式下卖家只管备货，导出订单Excel拖入即用 |

### 项目目录结构

```
CrossFlow/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 入口，窗口管理
│   ├── tray.ts               # 系统托盘（常驻后台定时同步）
│   ├── ipc-handlers.ts       # IPC通信处理
│   ├── sync/                 # 数据同步引擎
│   │   ├── scheduler.ts      # 定时任务调度
│   │   ├── amazon.ts         # Amazon SP-API连接器
│   │   ├── shopee.ts         # Shopee API连接器
│   │   ├── tiktok.ts         # TikTok数据拉取
│   │   └── temu.ts           # Temu Excel导入解析
│   ├── db/                   # 数据库层
│   │   ├── connection.ts     # SQLite连接管理
│   │   ├── migrations/       # 数据库迁移脚本
│   │   └── repositories/     # 数据访问层（每张表一个repository）
│   └── ai/                   # AI辅助
│       ├── adapter.ts        # 多供应商统一适配
│       └── prompts.ts        # 提示词模板
│
├── src/                       # React 渲染进程
│   ├── App.tsx
│   ├── pages/
│   │   ├── Orders/           # 订单管理页
│   │   ├── Inventory/        # 库存管理页
│   │   ├── Dashboard/        # 经营仪表盘
│   │   └── Settings/         # 设置（平台授权/AI配置/同步策略）
│   ├── components/           # 共享组件（订单表格/库存卡片/图表等）
│   ├── stores/               # Zustand stores
│   ├── hooks/                # 自定义hooks
│   └── types/                # TypeScript类型定义
│
├── resources/                 # 图标/安装包资源
├── package.json
├── electron-builder.yml      # 打包配置
├── tsconfig.json
└── README.md
```

## 数据模型

### 核心表结构

```sql
-- 平台配置
CREATE TABLE platform (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,          -- amazon / tiktok / temu / shopee / lazada
  name TEXT NOT NULL,
  auth_data TEXT,              -- JSON: API凭证或Cookie
  sync_enabled INTEGER DEFAULT 1,
  sync_interval INTEGER DEFAULT 900  -- 同步间隔（秒），默认15分钟
);

-- 仓库
CREATE TABLE warehouse (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- 广州仓 / FBA美东 / 海外仓LA
  type TEXT NOT NULL,          -- domestic / fba / overseas
  country TEXT,                -- 所在国家
  is_default INTEGER DEFAULT 0
);

-- 商品（以SKU为唯一标识）
CREATE TABLE product (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,                -- 英文标题
  image_url TEXT,              -- 主图本地路径
  category TEXT,
  cost_price REAL,             -- 采购成本(人民币)
  weight_kg REAL,              -- 重量
  safety_stock INTEGER DEFAULT 10,  -- 全局安全库存
  created_at TEXT DEFAULT (datetime('now'))
);

-- 商品在各平台的映射
CREATE TABLE product_platform (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id),
  platform_id TEXT REFERENCES platform(id),
  platform_sku TEXT,           -- 平台端的SKU ID
  platform_pid TEXT,           -- 平台端的商品ID(ASIN等)
  selling_price REAL,          -- 售价(原币)
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active', -- active / paused / deleted
  UNIQUE(product_id, platform_id)
);

-- 库存快照（SKU + 仓库维度）
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id),
  warehouse_id TEXT REFERENCES warehouse(id),
  available INTEGER DEFAULT 0,  -- 可售数量
  reserved INTEGER DEFAULT 0,   -- 已占用(已下单未发货)
  in_transit INTEGER DEFAULT 0, -- 在途(已采购未到仓)
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(product_id, warehouse_id)
);

-- 库存变动记录（可追溯）
CREATE TABLE inventory_log (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES product(id),
  warehouse_id TEXT REFERENCES warehouse(id),
  change_type TEXT NOT NULL,   -- order_reserve / order_release / restock / adjust / return
  quantity INTEGER NOT NULL,   -- 正数=增加, 负数=减少
  available_after INTEGER,     -- 变动后可售数
  reserved_after INTEGER,      -- 变动后占用数
  reference_id TEXT,           -- 关联订单号或入库单号
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 订单
CREATE TABLE "order" (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  platform_order_id TEXT NOT NULL,  -- 平台原始订单号
  product_id TEXT REFERENCES product(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL,                  -- 单价(原币)
  currency TEXT DEFAULT 'USD',
  total_amount REAL,                -- 总金额(原币)
  buyer_name TEXT,
  shipping_address TEXT,            -- JSON: 收件地址
  logistics_provider TEXT,          -- 物流商
  tracking_number TEXT,             -- 运单号
  status TEXT DEFAULT 'pending',    -- pending / matched / shipped / delivered / refunding / refunded
  platform_status TEXT,             -- 平台端原始状态
  order_time TEXT,                  -- 下单时间
  shipped_time TEXT,                -- 发货时间
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform_id, platform_order_id)
);

-- 同步日志（排查问题时用）
CREATE TABLE sync_log (
  id TEXT PRIMARY KEY,
  platform_id TEXT REFERENCES platform(id),
  sync_type TEXT,              -- order / inventory / product
  status TEXT,                 -- success / partial / failed
  message TEXT,
  records_count INTEGER,
  started_at TEXT,
  finished_at TEXT
);
```

## 非功能需求

### 性能
- SQLite WAL模式，支持并发读写
- 订单列表虚拟滚动（antd Table内置），万级数据不卡
- 仪表盘图表增量刷新，避免全量重渲染
- 数据同步放在主进程，不阻塞UI

### 安全
- 所有数据存储在用户本地，不上传任何云端
- 平台API密钥/Cookie使用操作系统密钥链存储（electron-store + safeStorage加密）
- AI调用仅传文本内容，不传订单号/客户姓名等敏感字段
- 开源源代码接受社区审计

### 可靠性
- 数据同步失败自动重试3次，间隔递增（1min/5min/15min）
- 数据库每日自动备份到用户指定目录
- 异常退出后重启自动恢复未完成操作
- sync_log表记录每次同步结果，方便排查

### 可用性
- 首页引导式设置：选择平台→授权→设置仓库→开始使用，4步完成
- 系统托盘常驻，最小化到托盘后台定时同步
- 库存告警/异常检测通过系统原生通知推送
- 支持中/英文界面切换

### 兼容性
- Windows 10+（主力平台）、macOS 12+（后续适配）
- 安装包大小目标 < 200MB
- 离线可用（未联网时使用本地缓存数据，联网后自动同步）

## V1 明确不做

以下功能明确不在 V1 范围，以保持产品聚焦：

- 选品分析/竞品监控（属于售前，暂不覆盖）
- 广告管理/优化
- 客服/CRM系统
- 采购/供应链管理
- 多用户权限/团队协作
- 移动端
- 独立站（Shopify等）对接（首批聚焦平台电商）
- 财务合规/税务申报
- 社区插件市场

这些功能根据用户反馈在后续版本中考虑。

## 版本规划

| 版本 | 内容 | 目标 |
|------|------|------|
| V1.0 MVP | 订单管理 + 库存管理 + 仪表盘，3大模块 | 验证核心价值，获取种子用户 |
| V1.1 | AI辅助完善（智能翻译/异常检测）、物流追踪 | 增强日常使用体验 |
| V1.2 | 更多平台对接（Ozon/Mercado Libre等小众市场） | 扩大用户覆盖面 |
| V2.0 | 业财一体化、利润核算 | 覆盖完整经营链路 |
