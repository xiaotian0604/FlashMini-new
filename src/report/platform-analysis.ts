import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import type {
  AlipayConfig,
  BaiduConfig,
  BytedanceConfig,
  WechatConfig,
} from '../types/config'
import {
  PLATFORM_DISPLAY_NAMES,
  type PlatformNameType,
} from '../types/platform'
import { hasConfiguredValue, shouldUseMockStrategy } from '../platforms/mock'
import type { PlatformPlanItem } from '../types/report'

export function analyzePlatformPlan(
  platform: PlatformNameType,
  rawConfig: unknown,
  env: string,
  dryRun: boolean,
): PlatformPlanItem {
  const displayName = PLATFORM_DISPLAY_NAMES[platform]
  const issues: string[] = []
  const warnings: string[] = []

  if (!rawConfig) {
    return {
      platform,
      displayName,
      enabled: false,
      mode: dryRun ? 'dry-run' : 'real',
      issues: ['平台配置不存在'],
      warnings,
    }
  }

  const config = rawConfig as Record<string, unknown>
  const projectPath = typeof config.projectPath === 'string' ? config.projectPath : undefined
  const missingFields = getMissingFields(platform, rawConfig)
  const mockReason = shouldUseMockStrategy({
    env,
    explicitMock: config.mock === true,
    missingFields,
  })

  if (!projectPath) {
    issues.push('未配置 projectPath')
  } else {
    const resolvedPath = resolve(process.cwd(), projectPath)
    if (!existsSync(resolvedPath)) {
      issues.push(`projectPath 不存在: ${resolvedPath}`)
    } else if (!statSync(resolvedPath).isDirectory()) {
      issues.push(`projectPath 不是目录: ${resolvedPath}`)
    }
  }

  if (!mockReason && missingFields.length > 0) {
    issues.push(`缺少真实上传配置: ${missingFields.join(', ')}`)
  }

  if (mockReason) {
    warnings.push(mockReason)
  }

  return {
    platform,
    displayName,
    enabled: true,
    mode: dryRun ? 'dry-run' : mockReason ? 'mock' : 'real',
    projectPath,
    reason: mockReason || undefined,
    issues,
    warnings,
  }
}

function getMissingFields(platform: PlatformNameType, rawConfig: unknown): string[] {
  switch (platform) {
    case 'wechat':
      return getWechatMissingFields(rawConfig as WechatConfig)
    case 'alipay':
      return getAlipayMissingFields(rawConfig as AlipayConfig)
    case 'baidu':
      return getBaiduMissingFields(rawConfig as BaiduConfig)
    case 'bytedance':
      return getBytedanceMissingFields(rawConfig as BytedanceConfig)
  }
}

function getWechatMissingFields(config: WechatConfig): string[] {
  const missingFields: string[] = []
  const appId = config.appId.trim()

  if (!hasConfiguredValue(appId) || /^wx_+$/.test(appId)) {
    missingFields.push('appId')
  }

  if (!hasConfiguredValue(config.privateKeyPath)) {
    missingFields.push('privateKeyPath')
  }

  return missingFields
}

function getAlipayMissingFields(config: AlipayConfig): string[] {
  const missingFields: string[] = []

  if (!hasConfiguredValue(config.appId)) {
    missingFields.push('appId')
  }

  if (!hasConfiguredValue(config.privateKey) && !hasConfiguredValue(config.privateKeyPath)) {
    missingFields.push('privateKey/privateKeyPath')
  }

  return missingFields
}

function getBaiduMissingFields(config: BaiduConfig): string[] {
  return hasConfiguredValue(config.token) ? [] : ['token']
}

function getBytedanceMissingFields(config: BytedanceConfig): string[] {
  if (hasConfiguredValue(config.token)) {
    return []
  }

  if (hasConfiguredValue(config.email) && hasConfiguredValue(config.password)) {
    return []
  }

  return ['token 或 email/password']
}
