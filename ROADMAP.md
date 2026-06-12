# CrossFlow 路线图

> 基于 V1.0 代码审计的改进规划。每个阶段有明确目标、任务项、预估工作量和依赖关系。

---

## 总览

```
Phase 1    Phase 2       Phase 3          Phase 4           Phase 5
致命修复    核心逻辑      必备模块          功能拓展           企业特性
───────    ───────      ────────         ────────          ────────
▮▮▮▮▮▮    ▮▮▮▮▮▮       ▮▮▮▮▮▮          ▮▮▮▮▮▮           ▮▮▮▮▮▮
 2-3周      3-4周        4-6周            6-8周             8-12周
```

---

## Phase 1: 致命修复（P0）

**目标：修复阻碍产品可用的核心数据链断裂问题。此阶段必须在其他任何工作之前完成。**

### 1.1 Amazon SKU 拉取链修复

**现状：** `syncAmazonOrders` 调用 `/orders/v0/orders` 返回订单列表，但该 API 不包含行项目级别的 SKU。当前代码硬编码 `sku: ''`，导致所有 Amazon 订单无法匹配商品。

**任务：**
1. 在 `electron/sync/amazon.ts` 的 `fetchOrders` 中，获取订单列表后，对每个订单调用 `/orders/v0/orders/{orderId}/orderItems`
2. orderItems 返回 `OrderItemList`，包含 `SellerSKU`、`ASIN`、`QuantityOrdered`、`ItemPrice` 等字段
3. 用 `SellerSKU` 填充 `order.sku`，用 `ItemPrice.Amount` 修正 `unit_price`/`total_amount`
4. 处理 API 速率限制：SP-API 的 orderItems 端点有严格的 rate limit（通常每分钟 200 次），需实现**令牌桶限流器**或批量请求 + 重试
5. 在 `scheduler.ts` 的 `withRetry` 基础上增加针对 HTTP 429 的特殊处理

**工作量：** 3-5 天
**依赖：** 无
**测试：** 需要 Amazon SP-API 沙箱环境或真实卖家账号

### 1.2 Shopee SKU 拉取链修复

**现状：** `syncShopeeOrders` 调用 `/order/get_order_list` 只返回订单基本信息（order_sn、状态、金额），不包含 SKU。当前代码同样硬编码 `sku: ''`。

**任务：**
1. 获取订单列表后，对每个订单调用 `/api/v2/order/get_order_detail`
2. 从响应的 `item_list[].item_sku` 提取真实 SKU
3. 同样需要处理速率限制，Shopee API 通常限制为每分钟 1000 次

**工作量：** 2-3 天
**依赖：** Phase 1.1（可并行）

### 1.3 Lazada 平台对接

**现状：** Settings 页面有 Lazada 配置字段（appKey/appSecret/accessToken），但 `electron/sync/` 下无对应模块。

**任务：**
1. 新建 `electron/sync/lazada.ts`
2. 对接 Lazada Open Platform API：
   - 认证：使用 appKey + appSecret 签名，accessToken 授权
   - 订单同步：`/orders/get` 获取订单列表
   - 订单详情：`/orders/items/get` 获取行项目 SKU
   - 状态映射：Lazada 状态 → CrossFlow 内部状态
3. 在 `scheduler.ts` 添加 `lazada` case

**工作量：** 3-4 天
**依赖：** 需要 Lazada 开放平台开发者账号

### 1.4 TikTok Shop 真实对接

**现状：** `tiktok.ts` 直接返回 `message: 'TikTok Shop has no public API'`。

**任务：** 调研后选择方案 —
- **方案 A（优先）：** TikTok Shop Partner API — 需申请成为 Partner 并获取授权。可实现订单同步、商品管理
- **方案 B（备选）：** 如果 Partner API 不可用，实现浏览器 Cookie 导入 + 页面数据抓取。用户在应用内置浏览器登录 TikTok Shop，CrossFlow 抓取订单/商品数据

**工作量：** 方案 A 5-7 天，方案 B 3-4 天
**依赖：** TikTok Shop Partner 审核通过

### 1.5 移除泄露的 API Key

**现状：** `tests/ai-adapter.test.ts` 包含硬编码的 DeepSeek API Key。

**任务：**
1. 将 API Key 改为从环境变量读取：`process.env.DEEPSEEK_API_KEY`
2. 创建 `.env.example` 模板，注明需要配置的环境变量
3. 在 `.gitignore` 中确认 `.env` 已被忽略
4. 更新 CI workflow，使用 GitHub Secrets 注入测试 API Key

**工作量：** 0.5 天
**依赖：** 无

### Phase 1 交付物清单

- [ ] Amazon 订单带着真实 SKU 进入数据库
- [ ] Shopee 订单带着真实 SKU 进入数据库
- [ ] Lazada 平台可配置、可同步
- [ ] TikTok Shop 有可用数据源（API 或抓取）
- [ ] 仓库代码无硬编码密钥
- [ ] 新增测试覆盖 Phase 1 变更

---

## Phase 2: 核心逻辑修复（P1）

**目标：修复业务逻辑缺陷，补齐基础功能闭环。**

### 2.1 利润计算修正

**现状：** `dashboard:skuProfit` 的 SQL 为 `SUM(total_amount) - COUNT(*) * cost_price`，仅扣减采购成本。无平台佣金、支付手续费、物流成本等。

**任务：**
1. 新增数据库表 `fee_config`：
   ```sql
   CREATE TABLE fee_config (
     id TEXT PRIMARY KEY,
     platform_id TEXT REFERENCES platform(id),
     fee_type TEXT CHECK(fee_type IN ('commission','payment','logistics','ads','other')),
     rate REAL DEFAULT 0,          -- 百分比费率
     fixed_amount REAL DEFAULT 0,  -- 固定金额
     currency TEXT DEFAULT 'USD'
   );
   ```
2. 新增数据库表 `order_cost`：
   ```sql
   CREATE TABLE order_cost (
     id TEXT PRIMARY KEY,
     order_id TEXT REFERENCES "order"(id),
     cost_type TEXT,
     amount REAL,
     currency TEXT DEFAULT 'USD',
     note TEXT
   );
   ```
3. 修改利润计算 SQL：`total_amount - purchase_cost - commission - payment_fee - logistics_cost`
4. Dashboard 利润卡片展示：毛利 vs 净利润，含各项费用明细

**工作量：** 3-4 天
**依赖：** 无

### 2.2 库存-平台同步

**现状：** inventory 表纯本地手动维护，不与任何平台同步。`reserve()`/`release()` 实现了但从未被 IPC handler 调用。

**任务：**
1. 在 `ipc-handlers.ts` 中订单状态变更时自动触发库存操作：
   - `pending → matched`：保留库存（调用 `InventoryRepo.reserve`）
   - `cancelled/refunded`：释放库存（调用 `InventoryRepo.release`）
   - `shipped`：扣减可售、减保留（调用现有的 UPDATE 已部分实现）
2. Amazon FBA 库存同步：
   - 新增 `syncAmazonInventory`，调用 SP-API Reports API
   - 请求 `GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA` 报告类型
3. Shopee 库存同步：
   - 调用 `/api/v2/product/get_model_list` 获取商品库存
   - 映射到 CrossFlow 的本地 inventory 表

**工作量：** 5-7 天
**依赖：** Phase 1.1、1.2（Amazon/Shopee API 能力）

### 2.3 订单合并二次校验

**现状：** 合并取第一个订单累加数量，SQL GROUP BY 已过滤了同 SKU + 同地址，但合并前缺少二次校验。

**任务：**
1. 在 `ipc-handlers.ts` 的 `orders:merge` handler 中，合并前逐订单验证：
   - 所有订单确实是同一 SKU
   - 所有订单确实是同一收货地址（完全匹配或语义匹配）
   - 所有订单状态均为 `pending`（不能合并已发货订单）
   - 合并数量不超过合理上限
2. 合并后保留被合并订单的原始 ID 列表，以便追溯

**工作量：** 1 天
**依赖：** 无

### 2.4 数据库迁移框架

**现状：** 只有一个 `001_initial.ts`，无版本管理的增量迁移机制。

**任务：**
1. 新增 `_migrations` 表记录已执行的迁移版本号
2. 实现 `runMigrations()` 读取 `migrations/` 目录，按版本号排序，跳过已执行的
3. 后续新增表/改表只需新建 `002_xxx.ts`、`003_xxx.ts`

**工作量：** 1-2 天
**依赖：** 无

### 2.5 补货建议算法增强

**现状：** 仅基于 30 天日均销量 × 固定 lead_time。未考虑季节性、促销、MOQ。

**任务：**
1. 引入加权移动平均替代简单平均，近期权重更高
2. 新增 `supplier` 表的 `lead_time_days` 和 `moq` 字段作为实际备货参数
3. 促销影响：设置标记日期，排除异常大促期间的销量数据
4. UI 修改：建议补货量拆分为"常规补货"和"安全缓冲"两部分展示

**工作量：** 2-3 天
**依赖：** Phase 2.4（supplier 表在 Phase 4 但 lead_time/moq 可先加在 product 表）

### 2.6 Shopee 签名空字符串防御

**现状：** `tests/sync-modules.test.ts:199-211` 检测到 sign 可能为空的边界情况。如果 partnerKey 为空或 HMAC 计算失败，签名变成空字符串。

**任务：**
1. 在 `shopee.ts` 的 `signShopeeRequest` 中增加防御：如果 partnerKey 为空或非字符串，抛出明确错误
2. 在 `syncShopeeOrders` 中，sign 计算后验证其结果非空

**工作量：** 0.5 天
**依赖：** 无

### Phase 2 交付物清单

- [ ] 利润计算包含平台佣金、支付费、物流费
- [ ] 订单状态变更自动触发库存预留/释放
- [ ] Amazon FBA + Shopee 库存可同步
- [ ] 订单合并有二次校验
- [ ] 数据库迁移有版本管理
- [ ] 补货建议考虑近期趋势和 MOQ
- [ ] Shopee 签名防御完善

---

## Phase 3: 必备模块补齐（P2）

**目标：补齐跨境电商 ERP 的核心功能模块。**

### 3.1 物流履约与真实追踪

**任务：**
1. **真实物流追踪：**
   - 新建 `electron/sync/tracking-real.ts`，集成第三方 API（17TRACK / AfterShip / 快递100）
   - 轮询 tracking_number 状态，更新 order 表的 `status` 和物流详情
   - 替换当前基于天数的简单逾期判定逻辑
2. **物流打单（基础版）：**
   - 集成 1-2 个主要跨境物流商（云途/燕文/递四方），对接打单 API
   - 新增"发货"操作流程：选择订单 → 选择物流商 → 选择渠道 → 自动获取面单 → 打印 → tracking_number 自动回填
3. **仓库判定增强：**
   - 修复 DHL 在国内仓发货被误判为国际件的问题（已知 bug）

**工作量：** 8-12 天
**依赖：** Phase 1（需要正确的 SKU 和订单数据）

### 3.2 财务对账模块

**任务：**
1. **多币种支持：**
   - 新增 `currency` 表（code, name, symbol, exchange_rate）
   - 新建 `electron/sync/exchange-rate.ts`，对接汇率 API（如 exchangerate-api.com）
   - 订单、利润报表支持币种切换
2. **平台费用对账：**
   - 新建 `electron/sync/amazon-finance.ts`，解析 Amazon Settlement Report
   - 新建 `electron/sync/shopee-finance.ts`，对账 Shopee 账单
   - 费用自动匹配到订单级别
3. **财务报表：**
   - 新增 Dashboard 财务 Tab：收入/成本/费用/利润趋势
   - 按平台、按时间维度的利润拆解

**工作量：** 10-15 天
**依赖：** Phase 2.1（利润计算修正）、汇率 API 账号

### 3.3 平台多站点覆盖

**任务：**
1. **Amazon 多站点：**
   - 当前硬编码 `MarketplaceIds=ATVPDKIKX0DER`（美国站）
   - 支持配置：欧洲（A1PA6795UKMFR9）、日本（A1VC38T7YXB528）、澳洲（A39IBJ37TRP1C6）等
   - 每个站点使用对应的 endpoint（`sellingpartnerapi-eu.amazon.com` 等）
2. **Shopee 多站点：**
   - 配置化 endpoint：台湾（shopee.tw）、印尼（shopee.co.id）、泰国（shopee.co.th）等
3. **Lazada 多站点：**
   - 新加坡、马来西亚、印尼、泰国、菲律宾、越南

**工作量：** 5-7 天
**依赖：** Phase 1.1、1.2、1.3

### Phase 3 交付物清单

- [ ] 真实物流追踪 API 已对接，自动更新运输状态
- [ ] 支持云途/燕文打单和自动获取跟踪号
- [ ] 多币种结算 + 汇率自动更新
- [ ] Amazon Settlement Report 自动对账
- [ ] Dashboard 有完整的财务利润分析
- [ ] Amazon 支持美/欧/日/澳多站点
- [ ] Shopee 支持台/印/泰/越多站点

---

## Phase 4: 功能拓展（P2 continued）

### 4.1 采购供应链模块

**任务：**
1. 新增表 `supplier`（name, contact, lead_time_days, moq, payment_terms）
2. 新增表 `purchase_order` 及 `purchase_order_item`
3. 新增页面 "采购管理"：
   - 供应商列表管理
   - 采购单生成（可基于补货建议一键生成）
   - 采购入库（到货后更新 inventory）
   - 采购成本与订单利润关联

**工作量：** 8-10 天
**依赖：** Phase 2.5（补货算法）

### 4.2 买家消息聚合

**任务：**
1. Amazon Buyer-Seller Messaging API 接入
2. Shopee Chat API 接入
3. 统一消息页面：多平台消息汇聚，支持 AI 回复建议

**工作量：** 5-7 天
**依赖：** Phase 2.4（AI 增强）

### 4.3 评价管理

**任务：**
1. 对接 Amazon Product Review API / Shopee 评价接口
2. 差评监控：评分 < 3 自动预警
3. 评价趋势图表

**工作量：** 3-4 天
**依赖：** 无

### 4.4 广告投放分析

**任务：**
1. Amazon Advertising API 接入（SP-API Ads）
2. ACoS / ROAS 计算
3. 广告花费 vs 广告订单收入对比

**工作量：** 5-7 天
**依赖：** Phase 1.1（SP-API 基础能力）

### 4.5 杂项修复

- **autoLaunch 生效：** `main.ts` 中调用 `app.setLoginItemSettings({ openAtLogin: settings.autoLaunch })`（0.5 天）
- **AI 场景扩展：** 客服回复建议、Listing 标题优化、销量预测（3-5 天）

### Phase 4 交付物清单

- [ ] 供应商管理和采购单生成
- [ ] 多平台消息聚合 + AI 回复建议
- [ ] 评价监控和差评预警
- [ ] 广告 ACoS/ROAS 分析
- [ ] autoLaunch 开机启动生效
- [ ] AI 使用场景增加

---

## Phase 5: 企业特性（远期）

### 5.1 多用户与权限管理

- 用户注册/登录（本地账号或 OAuth）
- RBAC 角色：管理员、运营、客服、仓库
- 操作日志审计

### 5.2 头程物流跟踪

- 海运/空运/铁路货运状态追踪
- 集装箱/提单号管理
- 预计到港时间与库存计划联动

### 5.3 数据导出与 BI

- 自定义报表生成器
- CSV/Excel 一键导出
- Grafana 或内置图表的高级分析

### 5.4 移动端

- React Native 或 PWA 移动版本
- 库存查询、订单审批、预警推送

---

## 工作量估算总览

| 阶段 | 内容 | 预估工作量 | 优先级 |
|------|------|-----------|--------|
| **Phase 1** | 致命修复（SKU/平台/密钥） | 2-3 周 | 🔴 P0 |
| **Phase 2** | 核心逻辑（利润/库存/迁移/补货） | 3-4 周 | 🟠 P1 |
| **Phase 3** | 必备模块（物流/财务/多站点） | 4-6 周 | 🟡 P2 |
| **Phase 4** | 功能拓展（采购/消息/评价/广告） | 6-8 周 | 🟢 P2 |
| **Phase 5** | 企业特性（多用户/头程/BI/移动端） | 8-12 周 | 🔵 远期 |
| **合计** | | **23-33 周** | |

---

## 依赖关系图

```
Phase 1 ──────────────────────────────────────────────────────┐
  ├── 1.1 Amazon SKU ────┬── 2.2 库存同步 ──── 3.3 多站点     │
  ├── 1.2 Shopee SKU ────┘                                     │
  ├── 1.3 Lazada ──────── 3.1 物流履约 ──── 4.1 采购管理       │
  ├── 1.4 TikTok Shop     3.2 财务对账 ──── 5.2 头程物流       │
  └── 1.5 API Key 移除    3.3 多站点 ────── 4.2 消息聚合       │
                                                               │
Phase 2 ──────────────────────────────────────────────────     │
  ├── 2.1 利润计算 ─────── 3.2 财务对账                         │
  ├── 2.2 库存同步 ─────── 3.1 物流履约                         │
  ├── 2.3 订单合并校验                                          │
  ├── 2.4 迁移框架 ─────── 2.5 补货 ──── 4.1 采购               │
  └── 2.5 补货算法 ─────── 4.1 采购管理                         │
                                                               │
Phase 3-4 可适度并行                                             │
```

---

## 建议的下一步行动

1. **立即执行 Phase 1.1 + 1.2**（Amazon/Shopee SKU 拉取），因为数据链断裂是当前最严重的 bug
2. **并行执行 Phase 1.5**（移除 API Key），工作量极小但安全影响大
3. **Phase 1.3 + 1.4** 可根据是否有 Lazada/TikTok 开发者账号决定优先级
4. **Phase 2 全部** 可以在 Phase 1 完成后启动，因为大部分无外部依赖
5. **Phase 3 开始前** 需要注册物流 API（17TRACK/快递100）和汇率 API 账号
