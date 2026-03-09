# Flashmini — 多平台小程序上传 CLI 架构文档

> CLI Tool · Node.js · TypeScript · Plugin Architecture · Strategy Pattern
>
> 定位：0-1 自研 CLI 工具，支持微信/支付宝/百度/字节小程序一键上传，插件化扩展，CI/CD 友好

---

## 📄 简历描述

**Flashmini 多平台小程序上传 CLI（负责人，0-1 搭建）**

- **关键词**：CLI 工具、Node.js、TypeScript、插件架构、工程化、自动化上传、CI/CD、多平台发布、配置化、通知集成
- **项目简介**：自研命令行工具，支持微信、支付宝、百度、字节等多平台小程序一键上传，提供类 Tapable 插件系统、多渠道通知集成与 CI/CD 流水线支持，已作为内部 npm 包发布，接入多条业务线。
- **技术栈**：Node.js · TypeScript · Zod · Commander.js · Cosmiconfig · Tapable · Chalk · Ora
- **技术亮点**：
  - **插件系统**：设计类 Tapable 钩子机制（beforeUpload / afterUpload / onError 等生命周期），用户可通过插件在任意阶段插入自定义逻辑，核心代码与业务逻辑完全解耦。
  - **策略模式**：每个平台封装为独立上传策略（UploadStrategy），通过工厂函数按平台名实例化，新增平台只需新增一个策略文件，主流程零修改。
  - **运行时类型安全**：全量使用 Zod 做配置文件 Schema 校验，错误信息精确到字段级别，杜绝配置错误导致的上传失败。
  - **通知集成**：上传完成后自动推送飞书/钉钉富文本消息（含版本号、二维码、变更日志），支持 @指定人，通知渠道同样插件化可扩展。
  - **双调用模式**：同时支持 CLI（`flashmini upload`）和 Node.js API（`import { upload } from 'flashmini'`）两种调用方式，CI 场景与代码集成场景均覆盖。

---

## 目录

1. [整体设计思路](#1-整体设计思路)
2. [项目结构](#2-项目结构)
3. [技术选型](#3-技术选型)
4. [配置文件设计](#4-配置文件设计)
5. [核心模块详解](#5-核心模块详解)
6. [插件系统](#6-插件系统)
7. [平台策略层](#7-平台策略层)
8. [通知系统](#8-通知系统)
9. [CLI 层](#9-cli-层)
10. [类型系统](#10-类型系统)
11. [错误处理](#11-错误处理)
12. [开发与发布](#12-开发与发布)
13. [设计模式总结](#13-设计模式总结)

---

## 1. 整体设计思路

### 核心原则

```
轻量        不引入不必要的依赖，核心包体积 < 500KB
可扩展      插件系统支持任意业务逻辑注入，平台策略可独立新增
类型安全    TypeScript 静态类型 + Zod 运行时校验双保险
用户友好    配置可读性强，错误提示精准，CLI 输出美观
CI 友好     非零退出码、JSON 输出模式、环境变量支持
```

### 架构分层

```
┌─────────────────────────────────────────────┐
│              CLI / API 入口层                │
│   commander.js 解析参数  |  export API       │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│               核心调度层 (Core)              │
│   读取配置 → 校验 → 执行生命周期钩子 → 分发  │
└──────┬──────────────────────┬───────────────┘
       │                      │
┌──────▼──────┐      ┌────────▼────────────────┐
│  插件系统    │      │      平台策略层          │
│  Hook 钩子  │      │  WeChat / Alipay /       │
│  生命周期   │      │  Baidu / ByteDance ...   │
└─────────────┘      └────────┬────────────────┘
                              │
                    ┌─────────▼──────────────────┐
                    │        通知系统             │
                    │  Feishu / DingTalk /        │
                    │  Webhook / Email ...        │
                    └────────────────────────────┘
```

---

## 2. 项目结构

```
flashmini/
├── src/
│   ├── index.ts                    # 包入口：同时导出 CLI 和 Node.js API
│   │
│   ├── cli/                        # CLI 层（用户界面）
│   │   ├── index.ts                # Commander.js 入口，注册所有命令
│   │   ├── commands/
│   │   │   ├── upload.ts           # flashmini upload 命令实现
│   │   │   ├── init.ts             # flashmini init 命令（生成默认配置文件）
│   │   │   └── preview.ts          # flashmini preview 命令（预览二维码）
│   │   └── ui/
│   │       ├── spinner.ts          # ora 封装（loading 状态展示）
│   │       ├── logger.ts           # chalk 封装（统一日志输出样式）
│   │       └── summary.ts          # 上传结果汇总表格输出
│   │
│   ├── core/                       # 核心调度层
│   │   ├── runner.ts               # 主流程编排：配置读取 → 校验 → 钩子 → 上传 → 通知
│   │   ├── config/
│   │   │   ├── loader.ts           # cosmiconfig 读取配置文件
│   │   │   ├── schema.ts           # Zod Schema 定义（配置校验）
│   │   │   └── defaults.ts         # 默认配置值
│   │   └── context.ts              # 贯穿整个生命周期的上下文对象（Context）
│   │
│   ├── plugins/                    # 插件系统
│   │   ├── hook-manager.ts         # 钩子管理器（类 Tapable 实现）
│   │   ├── hooks.ts                # 所有钩子定义（beforeUpload / afterUpload 等）
│   │   ├── plugin-loader.ts        # 加载并初始化用户插件
│   │   └── built-in/               # 内置插件
│   │       ├── version-bump.ts     # 自动递增版本号插件
│   │       └── git-log.ts          # 自动提取 git log 作为上传备注插件
│   │
│   ├── platforms/                  # 平台策略层
│   │   ├── factory.ts              # 平台工厂函数（按名称实例化对应策略）
│   │   ├── base.ts                 # 抽象基类 BaseUploader（定义接口契约）
│   │   ├── wechat/
│   │   │   ├── index.ts            # 微信上传策略（封装 miniprogram-ci）
│   │   │   └── schema.ts           # 微信平台专属配置 Zod Schema
│   │   ├── alipay/
│   │   │   ├── index.ts            # 支付宝上传策略（封装 minidev-tool）
│   │   │   └── schema.ts
│   │   ├── baidu/
│   │   │   ├── index.ts            # 百度上传策略（封装 swan-toolkit）
│   │   │   └── schema.ts
│   │   └── bytedance/
│   │       ├── index.ts            # 字节上传策略（封装 @microprogram/upload）
│   │       └── schema.ts
│   │
│   ├── notifiers/                  # 通知系统
│   │   ├── factory.ts              # 通知器工厂
│   │   ├── base.ts                 # 抽象基类 BaseNotifier
│   │   ├── feishu/
│   │   │   ├── index.ts            # 飞书机器人通知（富文本卡片）
│   │   │   └── template.ts         # 消息模板构建
│   │   ├── dingtalk/
│   │   │   ├── index.ts            # 钉钉机器人通知（ActionCard）
│   │   │   └── template.ts
│   │   └── webhook/
│   │       └── index.ts            # 通用 Webhook（自定义 JSON 模板）
│   │
│   ├── utils/
│   │   ├── git.ts                  # git 工具（获取 log、branch、commit hash）
│   │   ├── qrcode.ts               # 二维码生成（terminal 输出 + base64 图片）
│   │   ├── retry.ts                # 带退避的重试工具函数
│   │   └── env.ts                  # 环境变量读取与合并工具
│   │
│   └── types/
│       ├── config.ts               # 配置文件类型（从 Zod Schema infer）
│       ├── platform.ts             # 平台相关类型
│       ├── plugin.ts               # 插件接口类型
│       └── index.ts                # 统一导出
│
├── templates/
│   └── flashmini.config.ts         # init 命令生成的默认配置文件模板
│
├── bin/
│   └── flashmini.js                # CLI 可执行入口（#!/usr/bin/env node）
│
├── test/
│   ├── unit/
│   │   ├── config.test.ts          # 配置解析测试
│   │   ├── hook-manager.test.ts    # 插件钩子测试
│   │   └── platforms/              # 各平台上传逻辑单测（mock CI SDK）
│   └── integration/
│       └── upload.test.ts          # 完整上传流程集成测试
│
├── package.json
├── tsconfig.json
├── tsup.config.ts                  # tsup 打包配置
└── README.md
```

---

## 3. 技术选型

| 职责 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js >= 18 | 原生 fetch、原生 ESM、无需 polyfill |
| 语言 | TypeScript 5.x | 严格类型，类型从 Zod Schema 自动推导 |
| CLI 框架 | Commander.js | 轻量成熟，API 简洁，类型支持好 |
| 配置读取 | Cosmiconfig | 自动查找 `.flashminirc` / `flashmini.config.ts` 等多种格式 |
| 配置校验 | Zod | 运行时类型校验，错误信息精准到字段，类型自动推导 |
| 插件钩子 | 自实现（参考 Tapable） | Tapable 本身依赖 webpack，自实现轻量版足够 |
| 终端输出 | Chalk + Ora + cli-table3 | 颜色、loading、表格，用户体验标配 |
| 打包 | tsup | 基于 esbuild，零配置，同时输出 ESM/CJS |
| 测试 | Vitest | 速度快，配置简单，和 TypeScript 天然契合 |
| 二维码 | qrcode | 支持 terminal 输出和 base64，通知消息里嵌图 |
| HTTP | 原生 fetch (Node 18+) | 无需 axios，减少依赖 |

### 为什么不用 xxx

| 放弃的选项 | 原因 |
|-----------|------|
| Yargs | API 较繁琐，Commander 更简洁 |
| dotenv | Cosmiconfig 已覆盖，无需额外引入 |
| axios | Node 18 原生 fetch 已够用 |
| Tapable | 是 webpack 的内部包，引入会带入大量不必要依赖 |
| Jest | Vitest 在纯 TypeScript 项目中配置更简单，速度更快 |

---

## 4. 配置文件设计

### 4.1 init 命令自动生成

执行 `flashmini init` 时，在项目根目录生成 `flashmini.config.ts`，内容为完整注释的默认配置：

```typescript
// flashmini.config.ts
// 由 flashmini init 自动生成，按需修改
import { defineConfig } from 'flashmini'

export default defineConfig({
  // ─── 基础配置 ────────────────────────────────────────────────
  version: '1.0.0',         // 上传版本号，支持 "auto"（自动读取 package.json）
  description: '',          // 上传备注，支持 "git"（自动读取最近一条 git commit message）

  // ─── 平台配置 ────────────────────────────────────────────────
  platforms: {
    wechat: {
      enabled: true,
      appId: 'wx__________',               // 小程序 AppID
      privateKeyPath: './keys/wechat.key', // 上传密钥路径
      projectPath: './dist/wechat',        // 构建产物目录
      robot: 1,                            // CI 机器人编号（1-30）
    },

    alipay: {
      enabled: false,
      appId: '202100000000',
      toolId: '',            // 支付宝开放平台工具 ID
      privateKey: '',        // 或使用 privateKeyPath
      projectPath: './dist/alipay',
    },

    baidu: {
      enabled: false,
      token: '',             // 百度智能小程序上传 token
      projectPath: './dist/baidu',
    },

    bytedance: {
      enabled: false,
      email: '',             // 字节跳动开发者邮箱
      password: '',          // 或使用 token
      projectPath: './dist/bytedance',
    },
  },

  // ─── 通知配置 ────────────────────────────────────────────────
  notify: {
    // 飞书机器人
    feishu: {
      enabled: false,
      webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx',
      // 上传完成后 @的人（填飞书 open_id）
      atUsers: [],
      // 消息模板中展示的信息
      template: {
        showQrcode: true,     // 是否展示体验二维码
        showChangelog: true,  // 是否展示变更日志
        showPlatforms: true,  // 是否展示上传平台列表
      },
    },

    // 钉钉机器人
    dingtalk: {
      enabled: false,
      webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx',
      secret: '',             // 加签密钥（可选）
      atMobiles: [],          // @的手机号列表
    },

    // 通用 Webhook（支持自定义模板）
    webhook: {
      enabled: false,
      url: '',
      method: 'POST',
      headers: {},
      // 模板变量：{{version}} {{platforms}} {{timestamp}} {{changelog}}
      body: '{"text": "{{platforms}} 上传完成，版本 {{version}}"}',
    },
  },

  // ─── 行为配置 ────────────────────────────────────────────────
  options: {
    parallel: true,           // 多平台是否并行上传（false 则串行）
    retry: 2,                 // 上传失败自动重试次数
    retryDelay: 3000,         // 重试间隔（ms）
    continueOnError: false,   // 某个平台失败后是否继续上传其他平台
  },

  // ─── 插件 ────────────────────────────────────────────────────
  plugins: [
    // 示例：内置插件 - 自动从 git log 提取变更日志
    // { use: 'flashmini/plugins/git-log' },

    // 示例：自定义插件
    // {
    //   use: './scripts/my-plugin.ts',
    //   options: { key: 'value' }
    // },
  ],
})
```

### 4.2 多环境配置

支持通过 `--env` 参数覆盖配置，或使用环境专属配置文件：

```typescript
// flashmini.config.ts — 多环境写法
import { defineConfig } from 'flashmini'

const env = process.env.FLASH_ENV || 'prod'

export default defineConfig({
  version: 'auto',
  description: 'git',

  platforms: {
    wechat: {
      enabled: true,
      appId: env === 'prod' ? 'wx_prod_appid' : 'wx_test_appid',
      privateKeyPath: `./keys/wechat-${env}.key`,
      projectPath: './dist/wechat',
    },
  },

  notify: {
    feishu: {
      enabled: env === 'prod', // 只在生产环境发送通知
      webhook: process.env.FEISHU_WEBHOOK || '',
    },
  },
})
```

### 4.3 Cosmiconfig 查找顺序

`flashmini` 按以下顺序查找配置，找到第一个即停止：

```
flashmini.config.ts       ← 推荐（有 TypeScript 类型提示）
flashmini.config.js
flashmini.config.mjs
.flashminirc.ts
.flashminirc.json
package.json 的 "flashmini" 字段
```

### 4.4 Zod Schema 校验

```typescript
// core/config/schema.ts
import { z } from 'zod'

const WechatSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().startsWith('wx', { message: '微信 AppID 必须以 wx 开头' }),
  privateKeyPath: z.string(),
  projectPath: z.string(),
  robot: z.number().int().min(1).max(30).default(1),
})

const NotifyFeishuSchema = z.object({
  enabled: z.boolean().default(false),
  webhook: z.string().url({ message: '飞书 Webhook 必须是合法 URL' }),
  atUsers: z.array(z.string()).default([]),
  template: z.object({
    showQrcode: z.boolean().default(true),
    showChangelog: z.boolean().default(true),
    showPlatforms: z.boolean().default(true),
  }).default({}),
}).optional()

export const ConfigSchema = z.object({
  version: z.union([z.string(), z.literal('auto')]).default('auto'),
  description: z.union([z.string(), z.literal('git')]).default('git'),
  platforms: z.object({
    wechat: WechatSchema.optional(),
    alipay: AlipaySchema.optional(),
    baidu: BaiduSchema.optional(),
    bytedance: BytedanceSchema.optional(),
  }),
  notify: z.object({
    feishu: NotifyFeishuSchema,
    dingtalk: NotifyDingtalkSchema,
    webhook: NotifyWebhookSchema,
  }).default({}),
  options: z.object({
    parallel: z.boolean().default(true),
    retry: z.number().int().min(0).max(5).default(2),
    retryDelay: z.number().default(3000),
    continueOnError: z.boolean().default(false),
  }).default({}),
  plugins: z.array(PluginConfigSchema).default([]),
})

// 类型从 Schema 自动推导，无需手写
export type FlashminiConfig = z.infer<typeof ConfigSchema>
```

---

## 5. 核心模块详解

### 5.1 Context — 上下文对象

贯穿整个上传流程，所有模块通过 Context 共享状态，避免全局变量：

```typescript
// core/context.ts
export interface UploadResult {
  platform: string
  success: boolean
  version: string
  qrcodeUrl?: string    // 体验版二维码
  error?: Error
  duration: number      // 上传耗时（ms）
}

export class Context {
  readonly config: FlashminiConfig
  readonly env: string
  readonly startTime: number

  // 运行时填充的数据
  version: string = ''
  description: string = ''
  gitBranch: string = ''
  gitCommit: string = ''
  changelog: string[] = []
  results: UploadResult[] = []

  // 插件可写入的自定义数据
  extra: Record<string, unknown> = {}

  constructor(config: FlashminiConfig, env: string) {
    this.config = config
    this.env = env
    this.startTime = Date.now()
  }

  get duration() {
    return Date.now() - this.startTime
  }

  get successCount() {
    return this.results.filter(r => r.success).length
  }

  get failedPlatforms() {
    return this.results.filter(r => !r.success).map(r => r.platform)
  }
}
```

### 5.2 Runner — 主流程编排

```typescript
// core/runner.ts
export class Runner {
  private hookManager: HookManager
  private config: FlashminiConfig

  constructor(config: FlashminiConfig) {
    this.config = config
    this.hookManager = new HookManager()
  }

  async run(options: RunOptions): Promise<Context> {
    const ctx = new Context(this.config, options.env)

    // 1. 加载插件，注册钩子
    await loadPlugins(this.config.plugins, this.hookManager)

    // 2. 解析版本号和描述
    ctx.version = await resolveVersion(this.config.version)
    ctx.description = await resolveDescription(this.config.description)

    // 3. 读取 git 信息
    ctx.gitBranch = await getGitBranch()
    ctx.gitCommit = await getGitCommit()
    ctx.changelog = await getGitLog(5)

    // 4. 执行 beforeAll 钩子（插件可在此修改 ctx）
    await this.hookManager.call('beforeAll', ctx)

    // 5. 获取启用的平台列表
    const enabledPlatforms = getEnabledPlatforms(this.config.platforms, options.platforms)

    // 6. 并行或串行上传
    if (this.config.options.parallel) {
      await this.uploadParallel(enabledPlatforms, ctx)
    } else {
      await this.uploadSerial(enabledPlatforms, ctx)
    }

    // 7. 执行 afterAll 钩子
    await this.hookManager.call('afterAll', ctx)

    // 8. 发送通知
    if (ctx.successCount > 0 || this.config.options.continueOnError) {
      await sendNotifications(this.config.notify, ctx)
    }

    return ctx
  }

  private async uploadOne(platformName: string, ctx: Context): Promise<void> {
    const uploader = PlatformFactory.create(platformName, this.config.platforms[platformName])

    await this.hookManager.call('beforeUpload', ctx, platformName)

    const result = await retry(
      () => uploader.upload(ctx),
      this.config.options.retry,
      this.config.options.retryDelay,
    )

    ctx.results.push(result)
    await this.hookManager.call('afterUpload', ctx, result)
  }

  private async uploadParallel(platforms: string[], ctx: Context) {
    const tasks = platforms.map(p => this.uploadOne(p, ctx).catch(err => {
      ctx.results.push({ platform: p, success: false, error: err, version: ctx.version, duration: 0 })
      if (!this.config.options.continueOnError) throw err
    }))
    await Promise.all(tasks)
  }

  private async uploadSerial(platforms: string[], ctx: Context) {
    for (const platform of platforms) {
      await this.uploadOne(platform, ctx)
    }
  }
}
```

---

## 6. 插件系统

### 6.1 钩子设计

```typescript
// plugins/hooks.ts

// 所有生命周期钩子定义
export interface Hooks {
  // 所有平台上传开始前
  beforeAll: (ctx: Context) => Promisable<void>
  // 单个平台上传开始前
  beforeUpload: (ctx: Context, platform: string) => Promisable<void>
  // 单个平台上传完成后
  afterUpload: (ctx: Context, result: UploadResult) => Promisable<void>
  // 所有平台上传完成后（含失败）
  afterAll: (ctx: Context) => Promisable<void>
  // 上传出错时
  onError: (ctx: Context, error: Error, platform: string) => Promisable<void>
  // 通知发送前（可修改通知内容）
  beforeNotify: (ctx: Context, message: NotifyMessage) => Promisable<NotifyMessage>
}

type Promisable<T> = T | Promise<T>
```

### 6.2 HookManager 实现

```typescript
// plugins/hook-manager.ts
type HookFn = (...args: any[]) => Promisable<any>

export class HookManager {
  private hooks: Map<string, HookFn[]> = new Map()

  // 注册钩子（插件调用）
  tap(hookName: string, fn: HookFn): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, [])
    }
    this.hooks.get(hookName)!.push(fn)
  }

  // 串行执行所有注册的钩子（按注册顺序）
  async call(hookName: string, ...args: any[]): Promise<void> {
    const fns = this.hooks.get(hookName) ?? []
    for (const fn of fns) {
      await fn(...args)
    }
  }

  // 瀑布流钩子：每个钩子的返回值传给下一个（用于 beforeNotify）
  async waterfall<T>(hookName: string, initial: T, ...args: any[]): Promise<T> {
    const fns = this.hooks.get(hookName) ?? []
    let value = initial
    for (const fn of fns) {
      value = await fn(value, ...args) ?? value
    }
    return value
  }
}
```

### 6.3 插件接口

```typescript
// types/plugin.ts
export interface Plugin {
  name: string                          // 插件名称（用于日志和调试）
  apply(hooks: HookManager): void       // 注册钩子的入口
}

// 插件配置（配置文件中使用）
export interface PluginConfig {
  use: string                           // 插件路径或包名
  options?: Record<string, unknown>     // 插件选项
}
```

### 6.4 内置插件示例

```typescript
// plugins/built-in/git-log.ts
// 自动读取 git log 作为上传描述

import type { Plugin } from '../../types/plugin'
import { getGitLog } from '../../utils/git'

export const GitLogPlugin: Plugin = {
  name: 'flashmini:git-log',

  apply(hooks) {
    hooks.tap('beforeAll', async (ctx) => {
      // 读取最近 5 条 commit，格式化为 changelog
      const logs = await getGitLog(5)
      ctx.changelog = logs
      // 如果描述是默认的空字符串，用最近一条 commit 填充
      if (!ctx.description) {
        ctx.description = logs[0] || 'no description'
      }
    })
  },
}
```

```typescript
// plugins/built-in/version-bump.ts
// 上传成功后自动递增 package.json 版本号

import { Plugin } from '../../types/plugin'
import { execSync } from 'child_process'

interface Options {
  type: 'patch' | 'minor' | 'major'   // 递增类型
  commit: boolean                       // 是否自动 git commit
}

export function createVersionBumpPlugin(options: Partial<Options> = {}): Plugin {
  const opts: Options = { type: 'patch', commit: false, ...options }

  return {
    name: 'flashmini:version-bump',
    apply(hooks) {
      hooks.tap('afterAll', async (ctx) => {
        if (ctx.failedPlatforms.length > 0) return // 有失败则不递增

        execSync(`npm version ${opts.type} --no-git-tag-version`)

        if (opts.commit) {
          execSync(`git add package.json`)
          execSync(`git commit -m "chore: bump version to ${ctx.version}"`)
        }
      })
    },
  }
}
```

### 6.5 用户自定义插件示例

```typescript
// 项目内自定义插件：scripts/upload-notify.ts
import type { Plugin } from 'flashmini'

export default {
  name: 'my-custom-notify',
  apply(hooks) {
    // 上传前打印平台信息
    hooks.tap('beforeUpload', (ctx, platform) => {
      console.log(`开始上传 ${platform}，版本 ${ctx.version}`)
    })

    // 上传完成后写入日志文件
    hooks.tap('afterAll', async (ctx) => {
      const log = {
        time: new Date().toISOString(),
        version: ctx.version,
        results: ctx.results,
      }
      await fs.writeFile('./upload-history.json', JSON.stringify(log, null, 2))
    })
  },
} satisfies Plugin
```

---

## 7. 平台策略层

### 7.1 抽象基类

```typescript
// platforms/base.ts
export abstract class BaseUploader {
  protected config: unknown

  constructor(config: unknown) {
    this.config = config
  }

  // 子类必须实现
  abstract upload(ctx: Context): Promise<UploadResult>
  abstract preview(ctx: Context): Promise<string>  // 返回二维码 URL

  // 公共方法：验证配置（Zod 校验）
  abstract validateConfig(): void

  // 公共方法：格式化平台名（用于日志）
  abstract get platformName(): string
}
```

### 7.2 平台工厂

```typescript
// platforms/factory.ts — 工厂模式
import { WechatUploader } from './wechat'
import { AlipayUploader } from './alipay'
import { BaiduUploader } from './baidu'
import { BytedanceUploader } from './bytedance'

// 平台注册表：新增平台只需在这里注册，主流程零修改
const PLATFORM_MAP: Record<string, new (config: any) => BaseUploader> = {
  wechat:    WechatUploader,
  alipay:    AlipayUploader,
  baidu:     BaiduUploader,
  bytedance: BytedanceUploader,
}

export class PlatformFactory {
  static create(platform: string, config: unknown): BaseUploader {
    const Uploader = PLATFORM_MAP[platform]
    if (!Uploader) {
      throw new Error(`不支持的平台: ${platform}。支持的平台: ${Object.keys(PLATFORM_MAP).join(', ')}`)
    }
    return new Uploader(config)
  }

  // 允许外部注册自定义平台（扩展点）
  static register(name: string, uploader: new (config: any) => BaseUploader): void {
    if (PLATFORM_MAP[name]) {
      throw new Error(`平台 ${name} 已存在，请使用不同的名称`)
    }
    PLATFORM_MAP[name] = uploader
  }
}
```

### 7.3 微信平台实现示例

```typescript
// platforms/wechat/index.ts
import * as ci from 'miniprogram-ci'
import { z } from 'zod'
import { WechatSchema } from './schema'
import type { BaseUploader } from '../base'

export class WechatUploader extends BaseUploader {
  private config: z.infer<typeof WechatSchema>

  constructor(rawConfig: unknown) {
    super(rawConfig)
    // 构造时立即校验，配置错误提前暴露
    this.config = WechatSchema.parse(rawConfig)
  }

  get platformName() { return '微信小程序' }

  async upload(ctx: Context): Promise<UploadResult> {
    const start = Date.now()

    const project = new ci.Project({
      appid: this.config.appId,
      type: 'miniProgram',
      projectPath: this.config.projectPath,
      privateKeyPath: this.config.privateKeyPath,
      ignores: ['node_modules/**/*'],
    })

    await ci.upload({
      project,
      version: ctx.version,
      desc: ctx.description,
      robot: this.config.robot,
      onProgressUpdate: () => {},  // 静默上传进度
    })

    return {
      platform: 'wechat',
      success: true,
      version: ctx.version,
      duration: Date.now() - start,
    }
  }

  async preview(ctx: Context): Promise<string> {
    // 生成体验版二维码，返回 base64
    const project = new ci.Project({ /* ... */ })
    const result = await ci.preview({ project, version: ctx.version, desc: '' })
    return result.qrcodeImageBuffer.toString('base64')
  }

  validateConfig() {
    WechatSchema.parse(this.config)
  }
}
```

---

## 8. 通知系统

### 8.1 飞书通知实现

```typescript
// notifiers/feishu/index.ts
export class FeishuNotifier extends BaseNotifier {
  async send(ctx: Context): Promise<void> {
    const message = this.buildCard(ctx)

    // 支持 beforeNotify 钩子修改消息内容
    const finalMessage = await this.hookManager.waterfall('beforeNotify', message, ctx)

    const response = await fetch(this.config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalMessage),
    })

    if (!response.ok) {
      throw new Error(`飞书通知发送失败: ${response.status}`)
    }
  }

  // 构建飞书富文本卡片
  private buildCard(ctx: Context) {
    const successPlatforms = ctx.results.filter(r => r.success).map(r => r.platform)
    const failedPlatforms = ctx.failedPlatforms

    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: { content: `🚀 小程序上传完成 v${ctx.version}`, tag: 'plain_text' },
          template: failedPlatforms.length > 0 ? 'orange' : 'green',
        },
        elements: [
          // 基本信息
          {
            tag: 'div',
            fields: [
              { is_short: true, text: { content: `**分支**：${ctx.gitBranch}`, tag: 'lark_md' } },
              { is_short: true, text: { content: `**提交**：${ctx.gitCommit.slice(0, 7)}`, tag: 'lark_md' } },
            ],
          },
          // 平台状态
          {
            tag: 'div',
            text: {
              content: [
                successPlatforms.map(p => `✅ ${p}`).join('  '),
                failedPlatforms.map(p => `❌ ${p}`).join('  '),
              ].filter(Boolean).join('\n'),
              tag: 'lark_md',
            },
          },
          // 变更日志
          ...(this.config.template?.showChangelog && ctx.changelog.length > 0 ? [{
            tag: 'div',
            text: {
              content: `**变更日志**\n${ctx.changelog.map(l => `• ${l}`).join('\n')}`,
              tag: 'lark_md',
            },
          }] : []),
          // @相关人
          ...(this.config.atUsers.length > 0 ? [{
            tag: 'div',
            text: {
              content: this.config.atUsers.map(id => `<at id=${id}></at>`).join(' '),
              tag: 'lark_md',
            },
          }] : []),
        ],
      },
    }
  }
}
```

---

## 9. CLI 层

### 9.1 命令注册

```typescript
// cli/index.ts
import { Command } from 'commander'
import { version } from '../../package.json'

const program = new Command()

program
  .name('flashmini')
  .description('多平台小程序一键上传工具')
  .version(version, '-v, --version')

// flashmini upload
program
  .command('upload')
  .description('上传小程序到指定平台')
  .option('-p, --platform <platforms>', '指定平台，逗号分隔（wechat,alipay）')
  .option('-e, --env <env>', '环境（dev/test/prod）', 'prod')
  .option('--version <version>', '覆盖配置文件中的版本号')
  .option('--desc <desc>', '覆盖上传备注')
  .option('--no-notify', '禁用上传通知')
  .option('--json', '以 JSON 格式输出结果（CI 场景）')
  .option('--dry-run', '试运行，不实际上传')
  .action(uploadCommand)

// flashmini init
program
  .command('init')
  .description('在当前目录生成默认配置文件')
  .option('--force', '覆盖已有配置文件')
  .action(initCommand)

// flashmini preview
program
  .command('preview')
  .description('生成小程序体验版二维码')
  .option('-p, --platform <platform>', '平台（默认 wechat）', 'wechat')
  .action(previewCommand)

program.parse()
```

### 9.2 upload 命令实现

```typescript
// cli/commands/upload.ts
export async function uploadCommand(options: UploadOptions) {
  // 1. 加载配置
  const raw = await loadConfig()
  if (!raw) {
    logger.error('未找到配置文件，请先运行 flashmini init')
    process.exit(1)
  }

  // 2. Zod 校验
  const result = ConfigSchema.safeParse(raw)
  if (!result.success) {
    logger.error('配置文件校验失败：')
    result.error.errors.forEach(e => {
      logger.error(`  ${e.path.join('.')} — ${e.message}`)
    })
    process.exit(1)
  }

  // 3. CLI 参数覆盖配置
  const config = mergeWithCliOptions(result.data, options)

  // 4. 运行
  const spinner = ora('准备上传...').start()

  try {
    const runner = new Runner(config)
    const ctx = await runner.run({
      env: options.env,
      platforms: options.platform?.split(','),
      dryRun: options.dryRun,
    })

    spinner.stop()

    // 5. 输出结果
    if (options.json) {
      // CI 场景：JSON 输出
      console.log(JSON.stringify({ success: true, results: ctx.results }))
    } else {
      // 交互场景：美观表格
      printSummary(ctx)
    }

    // 有失败平台则非零退出（CI 可感知失败）
    if (ctx.failedPlatforms.length > 0) {
      process.exit(1)
    }
  } catch (err) {
    spinner.fail('上传失败')
    logger.error(err instanceof Error ? err.message : String(err))

    if (options.json) {
      console.log(JSON.stringify({ success: false, error: String(err) }))
    }

    process.exit(1)
  }
}
```

### 9.3 init 命令实现

```typescript
// cli/commands/init.ts
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { readFileSync } from 'fs'

export async function initCommand(options: { force?: boolean }) {
  const targetPath = resolve(process.cwd(), 'flashmini.config.ts')

  if (existsSync(targetPath) && !options.force) {
    logger.warn('配置文件已存在，使用 --force 覆盖')
    return
  }

  // 读取内置模板文件
  const template = readFileSync(
    resolve(__dirname, '../../templates/flashmini.config.ts'),
    'utf-8'
  )

  writeFileSync(targetPath, template, 'utf-8')
  logger.success(`✅ 配置文件已生成：${targetPath}`)
  logger.info('请编辑配置文件，填写各平台 AppID 和密钥，然后运行 flashmini upload')
}
```

### 9.4 终端输出效果

```
$ flashmini upload --platform wechat,alipay

  ⠸ 正在上传微信小程序...
  ✔ 微信小程序上传成功 (8.3s)
  ⠸ 正在上传支付宝小程序...
  ✔ 支付宝小程序上传成功 (12.1s)

  ┌──────────────┬─────────┬──────────┬────────┐
  │ 平台         │ 状态    │ 版本     │ 耗时   │
  ├──────────────┼─────────┼──────────┼────────┤
  │ 微信小程序   │ ✅ 成功  │ 1.2.3    │ 8.3s  │
  │ 支付宝小程序 │ ✅ 成功  │ 1.2.3    │ 12.1s │
  └──────────────┴─────────┴──────────┴────────┘

  📨 飞书通知已发送
  ⏱  总耗时：12.4s（并行上传）
```

---

## 10. 类型系统

```typescript
// types/index.ts — 统一对外导出

export type { FlashminiConfig } from './config'     // 配置文件类型
export type { Plugin, PluginConfig } from './plugin' // 插件类型
export type { UploadResult } from './platform'       // 上传结果类型
export type { Context } from '../core/context'       // 上下文类型

// defineConfig 辅助函数：提供配置文件类型推断
export function defineConfig(config: FlashminiConfig): FlashminiConfig {
  return config
}
```

---

## 11. 错误处理

### 错误分层

```typescript
// 自定义错误类型，携带结构化信息
export class FlashminiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly platform?: string,
  ) {
    super(message)
    this.name = 'FlashminiError'
  }
}

export enum ErrorCode {
  CONFIG_NOT_FOUND    = 'CONFIG_NOT_FOUND',    // 配置文件未找到
  CONFIG_INVALID      = 'CONFIG_INVALID',      // 配置校验失败
  PLATFORM_NOT_FOUND  = 'PLATFORM_NOT_FOUND',  // 平台不支持
  UPLOAD_FAILED       = 'UPLOAD_FAILED',       // 上传失败（平台 SDK 报错）
  NETWORK_ERROR       = 'NETWORK_ERROR',       // 网络错误（通知发送失败）
  AUTH_ERROR          = 'AUTH_ERROR',          // 鉴权失败（密钥错误）
}
```

### 重试工具

```typescript
// utils/retry.ts
export async function retry<T>(
  fn: () => Promise<T>,
  times: number,
  delay: number,
): Promise<T> {
  let lastError: Error

  for (let i = 0; i <= times; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (i < times) {
        logger.warn(`第 ${i + 1} 次重试，等待 ${delay}ms...`)
        await sleep(delay * (i + 1)) // 指数退避
      }
    }
  }

  throw lastError!
}
```

---

## 12. 开发与发布

### package.json 关键配置

```json
{
  "name": "flashmini",
  "version": "1.0.0",
  "description": "多平台小程序上传 CLI 工具",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "flashmini": "./bin/flashmini.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./plugins/*": "./dist/plugins/built-in/*.js"
  },
  "files": ["dist", "bin", "templates"],
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "prepublishOnly": "pnpm build && pnpm test"
  }
}
```

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,           // 生成类型声明文件
  splitting: true,     // 代码分割（共享模块不重复打包）
  clean: true,
  shims: true,         // 兼容 ESM/CJS 互转
})
```

### CI/CD 使用示例

```yaml
# .github/workflows/upload.yml
- name: 上传小程序
  run: npx flashmini upload --platform wechat --env prod --json
  env:
    FEISHU_WEBHOOK: ${{ secrets.FEISHU_WEBHOOK }}
    WECHAT_PRIVATE_KEY: ${{ secrets.WECHAT_PRIVATE_KEY }}
```

### Node.js API 使用

```typescript
// 在代码中调用（非 CLI 场景）
import { upload } from 'flashmini'

const ctx = await upload({
  config: './flashmini.config.ts',
  platforms: ['wechat'],
  env: 'prod',
})

console.log(ctx.results)
// [{ platform: 'wechat', success: true, version: '1.2.3', duration: 8300 }]
```

---

## 13. 设计模式总结

| 模式 | 应用位置 | 解决的问题 |
|------|---------|-----------|
| **策略模式** | `platforms/` 各平台上传器 | 每个平台是独立策略，新增平台不修改主流程 |
| **工厂模式** | `platforms/factory.ts` `notifiers/factory.ts` | 按名称创建实例，调用方不关心具体类 |
| **观察者模式** | `plugins/hook-manager.ts` | 生命周期钩子，解耦核心逻辑与扩展逻辑 |
| **模板方法模式** | `platforms/base.ts` `notifiers/base.ts` | 定义上传/通知流程骨架，子类实现具体步骤 |
| **上下文对象模式** | `core/context.ts` | 贯穿整个流程传递状态，替代全局变量 |
| **插件模式** | `plugins/` 整个目录 | 业务逻辑与核心逻辑完全隔离，开闭原则 |

---

*v1.0.0 · 2026-03 · Flashmini Team*
