import {
  applyExecutionOverrides,
  loadValidatedConfig,
} from '../../core/config/runtime'
import { resolveEnabledPlatforms } from '../../core/platform-selection'
import { resolveDescription, resolveVersion } from '../../utils/env'
import {
  buildErrorReport,
  buildPlanReport,
  writeJsonReport,
} from '../../report/builders'
import { printPlanReport } from '../ui/reports'
import { logger } from '../ui/logger'

export interface PlanCommandOptions {
  platform?: string
  env: string
  version?: string
  desc?: string
  notify: boolean
  json?: boolean
  dryRun?: boolean
  config?: string
  report?: string
}

export async function planCommand(options: PlanCommandOptions): Promise<void> {
  let configPath: string | undefined

  try {
    const resolved = await loadValidatedConfig(options.config)
    configPath = resolved.filepath

    const config = applyExecutionOverrides(resolved.config, {
      version: options.version,
      desc: options.desc,
      notify: options.notify,
    })
    const version = await resolveVersion(config.version)
    const description = await resolveDescription(config.description)
    const platforms = resolveEnabledPlatforms(config, options.platform?.split(','))

    const report = buildPlanReport({
      config,
      configPath,
      env: options.env,
      version,
      description,
      platforms,
      dryRun: options.dryRun,
    })

    if (options.report) {
      const reportPath = writeJsonReport(options.report, report)
      if (!options.json) {
        logger.info(`报告已写入: ${reportPath}`)
      }
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printPlanReport(report)
    }
  } catch (err) {
    const errorReport = buildErrorReport('plan', err, configPath)

    if (!options.json) {
      logger.error(errorReport.error.message)
    }

    if (options.report) {
      const reportPath = writeJsonReport(options.report, errorReport)
      if (!options.json) {
        logger.info(`报告已写入: ${reportPath}`)
      }
    }

    if (options.json) {
      console.log(JSON.stringify(errorReport, null, 2))
    }

    process.exit(1)
  }
}
