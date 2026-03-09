/**
 * 微信小程序平台专属配置 Schema
 *
 * 从全局 Schema 中重新导出微信平台的 Zod Schema，
 * 供微信上传器在构造时进行配置校验。
 *
 * 单独文件的好处：
 * 1. 平台模块可以独立引用自己的 Schema，无需导入整个配置 Schema
 * 2. 未来如果微信平台需要额外的校验规则，可以在此扩展
 */

export { WechatSchema } from '../../core/config/schema'
