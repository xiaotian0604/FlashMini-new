import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import type { Context } from '../core/context'
import {
  PLATFORM_DISPLAY_NAMES,
  type PlatformNameType,
  type UploadResult,
} from '../types/platform'
import { FlashminiError, ErrorCode } from '../utils/errors'
import { sleep } from '../utils/retry'

interface MockStrategyOptions {
  env: string
  explicitMock: boolean
  missingFields: string[]
}

interface SimulateUploadOptions {
  platform: PlatformNameType
  projectPath: string
  reason: string
  ctx: Context
}

const MOCK_UPLOAD_DELAYS: Record<PlatformNameType, number[]> = {
  wechat: [140, 220, 380, 180],
  alipay: [160, 260, 420, 200],
  baidu: [150, 240, 360, 170],
  bytedance: [180, 280, 400, 200],
}

const MOCK_PREVIEW_DELAYS: Record<PlatformNameType, number[]> = {
  wechat: [120, 180, 140],
  alipay: [140, 200, 150],
  baidu: [130, 180, 150],
  bytedance: [150, 220, 160],
}

const PLACEHOLDER_VALUES = new Set([
  'wx__________',
  '202100000000',
])

export function hasConfiguredValue(value?: string | null): boolean {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return false
  }

  return !PLACEHOLDER_VALUES.has(normalizedValue)
}

export function shouldUseMockStrategy({
  env,
  explicitMock,
  missingFields,
}: MockStrategyOptions): string | null {
  if (explicitMock) {
    return '配置了 mock: true'
  }

  if (isMockEligibleEnv(env) && missingFields.length > 0) {
    return `dev 环境且缺少真实上传配置：${missingFields.join(' / ')}`
  }

  return null
}

function isMockEligibleEnv(env: string): boolean {
  const normalizedEnv = env.trim().toLowerCase()
  return normalizedEnv === 'dev' || normalizedEnv === 'development'
}

export async function simulateUpload({
  platform,
  projectPath,
  reason,
  ctx,
}: SimulateUploadOptions): Promise<UploadResult> {
  const start = Date.now()

  assertProjectDirectory(platform, projectPath, '模拟上传')
  await runMockDelay(MOCK_UPLOAD_DELAYS[platform])

  return {
    platform,
    success: true,
    mock: true,
    mockReason: reason,
    version: ctx.version,
    qrcodeUrl: buildMockPreviewUrl(platform, ctx),
    duration: Date.now() - start,
  }
}

export async function simulatePreview({
  platform,
  projectPath,
  reason,
  ctx,
}: SimulateUploadOptions): Promise<string> {
  assertProjectDirectory(platform, projectPath, '模拟预览')
  await runMockDelay(MOCK_PREVIEW_DELAYS[platform])

  return buildMockPreviewUrl(platform, ctx, reason)
}

function assertProjectDirectory(
  platform: PlatformNameType,
  projectPath: string,
  action: string,
): void {
  const resolvedProjectPath = resolve(process.cwd(), projectPath)

  if (!existsSync(resolvedProjectPath)) {
    throw new FlashminiError(
      `${PLATFORM_DISPLAY_NAMES[platform]}${action}失败: projectPath 不存在 (${resolvedProjectPath})`,
      ErrorCode.CONFIG_INVALID,
      platform,
    )
  }

  if (!statSync(resolvedProjectPath).isDirectory()) {
    throw new FlashminiError(
      `${PLATFORM_DISPLAY_NAMES[platform]}${action}失败: projectPath 不是目录 (${resolvedProjectPath})`,
      ErrorCode.CONFIG_INVALID,
      platform,
    )
  }
}

async function runMockDelay(delays: number[]): Promise<void> {
  for (const delay of delays) {
    await sleep(delay)
  }
}

function buildMockPreviewUrl(
  platform: PlatformNameType,
  ctx: Context,
  reason?: string,
): string {
  const params = new URLSearchParams({
    platform,
    version: ctx.version || '0.0.0',
    env: ctx.env,
    mock: '1',
    branch: ctx.gitBranch || 'local',
    ts: String(Date.now()),
  })

  if (reason) {
    params.set('reason', reason)
  }

  return `https://mock.flashmini.local/preview?${params.toString()}`
}
