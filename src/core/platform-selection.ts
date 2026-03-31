import type { FlashminiConfig } from '../types/config'
import { PlatformFactory } from '../platforms/factory'
import { FlashminiError, ErrorCode } from '../utils/errors'

export function normalizePlatformNames(platforms?: string[]): string[] {
  if (!platforms || platforms.length === 0) {
    return []
  }

  const uniquePlatforms = new Set<string>()

  for (const rawPlatform of platforms) {
    for (const platform of rawPlatform
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)) {
      uniquePlatforms.add(platform)
    }
  }

  return Array.from(uniquePlatforms)
}

export function resolveEnabledPlatforms(
  config: FlashminiConfig,
  requestedPlatforms?: string[],
): string[] {
  const platforms = config.platforms as Record<string, unknown>
  const normalizedPlatforms = normalizePlatformNames(requestedPlatforms)
  const configuredPlatforms = Object.keys(platforms).filter(name => platforms[name])

  if (normalizedPlatforms.length > 0) {
    const supportedPlatforms = new Set(PlatformFactory.getPlatformNames())
    const unsupportedPlatforms = normalizedPlatforms.filter(
      platform => !supportedPlatforms.has(platform),
    )

    if (unsupportedPlatforms.length > 0) {
      throw new FlashminiError(
        `不支持的平台: ${unsupportedPlatforms.join(', ')}。支持的平台: ${PlatformFactory.getPlatformNames().join(', ')}`,
        ErrorCode.PLATFORM_NOT_FOUND,
        unsupportedPlatforms[0],
      )
    }

    const missingConfigPlatforms = normalizedPlatforms.filter(
      platform => !platforms[platform],
    )

    if (missingConfigPlatforms.length > 0) {
      throw new FlashminiError(
        `以下平台缺少配置: ${missingConfigPlatforms.join(', ')}。请先在配置文件中补充对应平台配置。`,
        ErrorCode.CONFIG_INVALID,
      )
    }

    return normalizedPlatforms
  }

  const enabledPlatforms = configuredPlatforms
    .filter(name => (platforms[name] as { enabled?: boolean } | undefined)?.enabled)
    .map(name => name)

  if (enabledPlatforms.length === 0) {
    throw new FlashminiError(
      '未找到已启用的平台，请在配置文件中启用至少一个平台，或通过 --platform 指定已配置的平台。',
      ErrorCode.CONFIG_INVALID,
    )
  }

  return enabledPlatforms
}
