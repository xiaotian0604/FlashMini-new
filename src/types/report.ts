import type { ErrorCode } from '../utils/errors'
import type { PlatformNameType } from './platform'

export const REPORT_SCHEMA_VERSION = '1.0.0'

export interface ReportBase {
  schemaVersion: typeof REPORT_SCHEMA_VERSION
  generatedAt: string
  command: 'upload' | 'plan' | 'doctor' | 'error'
  configPath?: string
}

export interface PlatformPlanItem {
  platform: string
  displayName: string
  mode: 'real' | 'mock' | 'dry-run'
  enabled: boolean
  projectPath?: string
  reason?: string
  issues: string[]
  warnings: string[]
}

export interface NotificationPlanItem {
  channel: 'feishu' | 'dingtalk' | 'webhook'
  enabled: boolean
}

export interface PlanReport extends ReportBase {
  command: 'plan'
  env: string
  version: string
  description: string
  options: {
    parallel: boolean
    retry: number
    retryDelay: number
    continueOnError: boolean
  }
  platforms: PlatformPlanItem[]
  notifications: NotificationPlanItem[]
}

export interface UploadResultReportItem {
  platform: string
  success: boolean
  mock: boolean
  version: string
  duration: number
  qrcodeUrl?: string
  mockReason?: string
  error?: {
    message: string
    code?: ErrorCode
  }
}

export interface UploadReport extends ReportBase {
  command: 'upload'
  env: string
  success: boolean
  dryRun: boolean
  version: string
  description: string
  duration: number
  summary: {
    total: number
    successCount: number
    failureCount: number
    mockCount: number
  }
  results: UploadResultReportItem[]
}

export interface DoctorCheck {
  id: string
  title: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export interface DoctorReport extends ReportBase {
  command: 'doctor'
  env: string
  status: 'pass' | 'warn' | 'fail'
  version: string
  description: string
  checks: DoctorCheck[]
  platforms: PlatformPlanItem[]
  notifications: NotificationPlanItem[]
}

export interface ErrorReport extends ReportBase {
  command: 'error'
  targetCommand: 'upload' | 'plan' | 'doctor'
  success: false
  error: {
    message: string
    code?: ErrorCode
    platform?: PlatformNameType | string
  }
}
