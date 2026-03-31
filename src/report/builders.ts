import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import type { Context } from '../core/context'
import type { FlashminiConfig } from '../types/config'
import {
  PLATFORM_DISPLAY_NAMES,
  type PlatformNameType,
  type UploadResult,
} from '../types/platform'
import {
  REPORT_SCHEMA_VERSION,
  type DoctorCheck,
  type DoctorReport,
  type ErrorReport,
  type NotificationPlanItem,
  type PlanReport,
  type PlatformPlanItem,
  type UploadReport,
} from '../types/report'
import { FlashminiError } from '../utils/errors'
import { analyzePlatformPlan } from './platform-analysis'

interface BuildPlanOptions {
  config: FlashminiConfig
  configPath?: string
  env: string
  version: string
  description: string
  platforms: string[]
  dryRun?: boolean
}

interface BuildDoctorOptions extends BuildPlanOptions {}

interface BuildUploadOptions {
  ctx: Context
  configPath?: string
  dryRun?: boolean
}

export function buildPlanReport(options: BuildPlanOptions): PlanReport {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    command: 'plan',
    configPath: options.configPath,
    env: options.env,
    version: options.version,
    description: options.description,
    options: {
      parallel: options.config.options.parallel,
      retry: options.config.options.retry,
      retryDelay: options.config.options.retryDelay,
      continueOnError: options.config.options.continueOnError,
    },
    platforms: options.platforms.map(platform =>
      analyzePlatformPlan(
        platform as PlatformNameType,
        (options.config.platforms as Record<string, unknown>)[platform],
        options.env,
        Boolean(options.dryRun),
      )),
    notifications: buildNotificationPlan(options.config),
  }
}

export function buildDoctorReport(options: BuildDoctorOptions): DoctorReport {
  const platforms = options.platforms.map(platform =>
    analyzePlatformPlan(
      platform as PlatformNameType,
      (options.config.platforms as Record<string, unknown>)[platform],
      options.env,
      false,
    ))
  const notifications = buildNotificationPlan(options.config)
  const checks = buildDoctorChecks(options, platforms, notifications)

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    command: 'doctor',
    configPath: options.configPath,
    env: options.env,
    status: getDoctorStatus(checks),
    version: options.version,
    description: options.description,
    checks,
    platforms,
    notifications,
  }
}

export function buildUploadReport(options: BuildUploadOptions): UploadReport {
  const { ctx, configPath } = options
  const results = ctx.results.map(serializeUploadResult)
  const mockCount = results.filter(result => result.mock).length

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    command: 'upload',
    configPath,
    env: ctx.env,
    success: ctx.failedPlatforms.length === 0,
    dryRun: Boolean(options.dryRun),
    version: ctx.version,
    description: ctx.description,
    duration: ctx.duration,
    summary: {
      total: results.length,
      successCount: ctx.successCount,
      failureCount: ctx.failedPlatforms.length,
      mockCount,
    },
    results,
  }
}

export function buildErrorReport(
  targetCommand: 'upload' | 'plan' | 'doctor',
  error: unknown,
  configPath?: string,
): ErrorReport {
  const normalizedError = error instanceof FlashminiError
    ? error
    : new Error(String(error))

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    command: 'error',
    configPath,
    targetCommand,
    success: false,
    error: {
      message: normalizedError.message,
      code: normalizedError instanceof FlashminiError ? normalizedError.code : undefined,
      platform: normalizedError instanceof FlashminiError ? normalizedError.platform : undefined,
    },
  }
}

export function writeJsonReport(filepath: string, report: object): string {
  const targetPath = resolve(process.cwd(), filepath)
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, JSON.stringify(report, null, 2), 'utf-8')
  return targetPath
}

function serializeUploadResult(result: UploadResult) {
  return {
    platform: result.platform,
    success: result.success,
    mock: Boolean(result.mock),
    version: result.version,
    duration: result.duration,
    qrcodeUrl: result.qrcodeUrl,
    mockReason: result.mockReason,
    error: result.error
      ? {
        message: result.error.message,
        code: result.error instanceof FlashminiError ? result.error.code : undefined,
      }
      : undefined,
  }
}

function buildNotificationPlan(config: FlashminiConfig): NotificationPlanItem[] {
  return [
    { channel: 'feishu', enabled: config.notify.feishu.enabled },
    { channel: 'dingtalk', enabled: config.notify.dingtalk.enabled },
    { channel: 'webhook', enabled: config.notify.webhook.enabled },
  ]
}

function buildDoctorChecks(
  options: BuildDoctorOptions,
  platforms: PlatformPlanItem[],
  notifications: NotificationPlanItem[],
): DoctorCheck[] {
  const checks: DoctorCheck[] = []

  checks.push({
    id: 'node-version',
    title: 'Node.js 版本',
    status: getCurrentNodeMajorVersion() >= 18 ? 'pass' : 'fail',
    message: `当前版本 ${process.versions.node}，项目要求 >= 18`,
  })

  checks.push({
    id: 'platform-selection',
    title: '平台选择',
    status: platforms.length > 0 ? 'pass' : 'fail',
    message: platforms.length > 0
      ? `本次检查 ${platforms.length} 个平台`
      : '未找到需要执行检查的平台',
  })

  for (const platform of platforms) {
    const status = platform.issues.length > 0
      ? 'fail'
      : platform.mode === 'mock'
        ? 'warn'
        : 'pass'

    checks.push({
      id: `platform:${platform.platform}`,
      title: platform.displayName,
      status,
      message: platform.issues[0]
        || platform.reason
        || `将执行${platform.mode === 'real' ? '真实上传' : '模拟上传'}`,
    })
  }

  checks.push({
    id: 'notifications',
    title: '通知配置',
    status: notifications.some(notification => notification.enabled) ? 'pass' : 'warn',
    message: notifications.some(notification => notification.enabled)
      ? `已启用 ${notifications.filter(notification => notification.enabled).map(notification => notification.channel).join(', ')}`
      : '未启用任何通知渠道',
  })

  checks.push({
    id: 'version-resolution',
    title: '版本与备注',
    status: 'pass',
    message: `version=${options.version}，description=${options.description || '空'}`,
  })

  return checks
}

function getDoctorStatus(checks: DoctorCheck[]): 'pass' | 'warn' | 'fail' {
  if (checks.some(check => check.status === 'fail')) {
    return 'fail'
  }

  if (checks.some(check => check.status === 'warn')) {
    return 'warn'
  }

  return 'pass'
}

function getCurrentNodeMajorVersion(): number {
  return Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
}
