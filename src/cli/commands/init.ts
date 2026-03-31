/**
 * init 命令实现
 *
 * 在当前目录生成默认的 flashmini 配置文件。
 * 配置文件包含完整的注释说明，帮助用户快速上手。
 *
 * 命令格式：
 * ```bash
 * flashmini init [options]
 * ```
 *
 * 支持的选项：
 * --force  覆盖已有的配置文件
 *
 * 生成的文件：flashmini.config.ts
 * 文件内容来自 templates/flashmini.config.ts 模板。
 */

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../ui/logger'

/**
 * init 命令的 CLI 选项类型
 */
export interface InitCommandOptions {
  /** 是否强制覆盖已有配置文件 */
  force?: boolean
}

/**
 * init 命令处理函数
 *
 * 由 Commander.js 在用户执行 `flashmini init` 时调用。
 * 从内置模板生成配置文件到当前工作目录。
 *
 * @param options - Commander.js 解析后的命令选项
 */
export async function initCommand(options: InitCommandOptions): Promise<void> {
  // 目标文件路径：当前工作目录下的 flashmini.config.ts
  const targetPath = resolve(process.cwd(), 'flashmini.config.ts')

  // ─── 检查文件是否已存在 ────────────────────────────────────────
  if (existsSync(targetPath) && !options.force) {
    logger.warn('配置文件已存在，使用 --force 覆盖')
    return
  }

  // ─── 读取内置模板文件 ──────────────────────────────────────────
  try {
    // 获取模板文件路径（相对于编译后的文件位置）
    const templatePath = resolveTemplatePath()
    let template: string

    try {
      template = readFileSync(templatePath, 'utf-8')
    } catch {
      // 如果模板文件不存在，使用内联的默认模板
      template = getDefaultTemplate()
    }

    // ─── 写入配置文件 ──────────────────────────────────────────
    writeFileSync(targetPath, template, 'utf-8')

    logger.success(`配置文件已生成：${targetPath}`)
    logger.info('请编辑配置文件，填写各平台 AppID 和密钥，然后运行 flashmini upload')
  } catch (err) {
    logger.error(`配置文件生成失败: ${(err as Error).message}`)
    process.exit(1)
  }
}

/**
 * 解析模板文件路径
 *
 * 根据当前文件的位置，计算模板文件的绝对路径。
 * 支持 ESM 和 CJS 两种模块系统。
 *
 * @returns 模板文件的绝对路径
 */
function resolveTemplatePath(): string {
  try {
    // ESM 环境：使用 import.meta.url
    const currentDir = dirname(fileURLToPath(import.meta.url))
    return resolve(currentDir, '../../../templates/flashmini.config.ts')
  } catch {
    // CJS 环境：使用 __dirname
    return resolve(__dirname, '../../../templates/flashmini.config.ts')
  }
}

/**
 * 获取内联的默认配置模板
 *
 * 当模板文件不存在时（如开发环境），使用此内联模板作为后备。
 * 模板内容与 templates/flashmini.config.ts 保持一致。
 *
 * @returns 配置文件模板字符串
 */
function getDefaultTemplate(): string {
  return `// flashmini.config.ts
// 由 flashmini init 自动生成，按需修改
import { defineConfig } from 'flashmini'

export default defineConfig({
  // ─── 基础配置 ────────────────────────────────────────────────
  version: '1.0.0',         // 上传版本号，支持 "auto"（自动读取 package.json）
  description: '',          // 上传备注，支持 "git"（自动读取最近一条 git commit message）

  // ─── 平台配置 ────────────────────────────────────────────────
  // dev 环境下如果缺少真实凭证，会自动降级为模拟上传
  platforms: {
    wechat: {
      enabled: true,
      mock: false,                         // 强制使用模拟上传
      appId: '',                           // 小程序 AppID（dev 环境留空会自动走 mock）
      privateKeyPath: '',                  // 上传密钥路径（dev 环境留空会自动走 mock）
      projectPath: './dist/wechat',        // 构建产物目录
      robot: 1,                            // CI 机器人编号（1-30）
    },

    alipay: {
      enabled: false,
      mock: false,
      appId: '',
      toolId: '',
      privateKey: '',
      privateKeyPath: '',
      projectPath: './dist/alipay',
    },

    baidu: {
      enabled: false,
      mock: false,
      token: '',
      projectPath: './dist/baidu',
    },

    bytedance: {
      enabled: false,
      mock: false,
      email: '',
      password: '',
      token: '',
      projectPath: './dist/bytedance',
    },
  },

  // ─── 通知配置 ────────────────────────────────────────────────
  notify: {
    feishu: {
      enabled: false,
      webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx',
      atUsers: [],
      template: {
        showQrcode: true,
        showChangelog: true,
        showPlatforms: true,
      },
    },

    dingtalk: {
      enabled: false,
      webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx',
      secret: '',
      atMobiles: [],
    },

    webhook: {
      enabled: false,
      url: '',
      method: 'POST',
      headers: {},
      body: '{"text": "{{platforms}} 上传完成，版本 {{version}}"}',
    },
  },

  // ─── 行为配置 ────────────────────────────────────────────────
  options: {
    parallel: true,
    retry: 2,
    retryDelay: 3000,
    continueOnError: false,
  },

  // ─── 插件 ────────────────────────────────────────────────────
  plugins: [],
})
`
}
