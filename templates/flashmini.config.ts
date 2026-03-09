// flashmini.config.ts
// 由 flashmini init 自动生成，按需修改
// 文档：https://github.com/flashmini/flashmini
import { defineConfig } from 'flashmini'

export default defineConfig({
  // ─── 基础配置 ────────────────────────────────────────────────
  // 上传版本号
  // - 字符串：直接使用指定的版本号（如 '1.0.0'）
  // - 'auto'：自动读取项目 package.json 中的 version 字段
  version: '1.0.0',

  // 上传备注/描述
  // - 字符串：直接使用指定的描述
  // - 'git'：自动读取最近一条 git commit message
  description: '',

  // ─── 平台配置 ────────────────────────────────────────────────
  // 每个平台独立配置，enabled 为 true 时才会上传到该平台
  platforms: {
    // 微信小程序
    wechat: {
      enabled: true,
      appId: 'wx__________',               // 小程序 AppID（在微信公众平台获取）
      privateKeyPath: './keys/wechat.key', // 上传密钥路径（在微信公众平台下载）
      projectPath: './dist/wechat',        // 构建产物目录
      robot: 1,                            // CI 机器人编号（1-30）
    },

    // 支付宝小程序
    alipay: {
      enabled: false,
      appId: '202100000000',               // 支付宝小程序 AppID
      toolId: '',                          // 支付宝开放平台工具 ID
      privateKey: '',                      // 私钥字符串（或使用 privateKeyPath）
      projectPath: './dist/alipay',
    },

    // 百度智能小程序
    baidu: {
      enabled: false,
      token: '',                           // 百度智能小程序上传 token
      projectPath: './dist/baidu',
    },

    // 字节跳动小程序
    bytedance: {
      enabled: false,
      email: '',                           // 字节跳动开发者邮箱
      password: '',                        // 开发者密码（或使用 token）
      projectPath: './dist/bytedance',
    },
  },

  // ─── 通知配置 ────────────────────────────────────────────────
  // 上传完成后自动发送通知，支持多个渠道同时启用
  notify: {
    // 飞书机器人通知（富文本卡片）
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

    // 钉钉机器人通知（ActionCard）
    dingtalk: {
      enabled: false,
      webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx',
      secret: '',             // 加签密钥（可选，用于安全验证）
      atMobiles: [],          // @的手机号列表
    },

    // 通用 Webhook（支持自定义 JSON 模板）
    // 可用模板变量：{{version}} {{platforms}} {{timestamp}} {{changelog}}
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
    parallel: true,           // 多平台是否并行上传（false 则串行）
    retry: 2,                 // 上传失败自动重试次数（0 表示不重试）
    retryDelay: 3000,         // 重试间隔（ms），实际间隔按指数退避递增
    continueOnError: false,   // 某个平台失败后是否继续上传其他平台
  },

  // ─── 插件 ────────────────────────────────────────────────────
  // 插件可以在上传生命周期的各个阶段注入自定义逻辑
  plugins: [
    // 示例：内置插件 - 自动从 git log 提取变更日志
    // { use: 'flashmini/plugins/git-log' },

    // 示例：内置插件 - 上传成功后自动递增版本号
    // { use: 'flashmini/plugins/version-bump', options: { type: 'patch', commit: true } },

    // 示例：自定义插件
    // {
    //   use: './scripts/my-plugin.ts',
    //   options: { key: 'value' }
    // },
  ],
})
