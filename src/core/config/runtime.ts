import { ConfigSchema } from './schema'
import { loadConfig, loadConfigFromFile } from './loader'
import type { FlashminiConfig } from '../../types/config'
import { FlashminiError, ErrorCode } from '../../utils/errors'

export interface ResolvedConfig {
  config: FlashminiConfig
  filepath: string
}

export interface ExecutionOverrides {
  version?: string
  desc?: string
  notify?: boolean
}

export async function loadValidatedConfig(configPath?: string): Promise<ResolvedConfig> {
  let raw

  try {
    raw = configPath
      ? await loadConfigFromFile(configPath)
      : await loadConfig()
  } catch (error) {
    throw new FlashminiError(
      `配置文件加载失败: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.CONFIG_INVALID,
    )
  }

  if (!raw) {
    throw new FlashminiError(
      '未找到配置文件，请先运行 flashmini init 或指定 config 路径',
      ErrorCode.CONFIG_NOT_FOUND,
    )
  }

  const result = ConfigSchema.safeParse(raw.config)

  if (!result.success) {
    const errors = result.error.errors
      .map(error => `${error.path.join('.')}: ${error.message}`)
      .join('\n')

    throw new FlashminiError(
      `配置校验失败:\n${errors}`,
      ErrorCode.CONFIG_INVALID,
    )
  }

  return {
    config: result.data,
    filepath: raw.filepath,
  }
}

export function applyExecutionOverrides(
  config: FlashminiConfig,
  overrides: ExecutionOverrides = {},
): FlashminiConfig {
  const merged: FlashminiConfig = {
    ...config,
    notify: {
      ...config.notify,
      feishu: { ...config.notify.feishu },
      dingtalk: { ...config.notify.dingtalk },
      webhook: { ...config.notify.webhook },
    },
  }

  if (overrides.version) {
    merged.version = overrides.version
  }

  if (overrides.desc) {
    merged.description = overrides.desc
  }

  if (overrides.notify === false) {
    merged.notify.feishu.enabled = false
    merged.notify.dingtalk.enabled = false
    merged.notify.webhook.enabled = false
  }

  return merged
}
