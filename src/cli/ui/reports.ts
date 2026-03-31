import Table from 'cli-table3'
import chalk from 'chalk'
import type {
  DoctorReport,
  PlanReport,
  PlatformPlanItem,
} from '../../types/report'

export function printPlanReport(report: PlanReport): void {
  console.log()
  console.log(chalk.bold('执行计划'))
  console.log(chalk.gray(`  环境: ${report.env}`))
  console.log(chalk.gray(`  版本: ${report.version}`))
  console.log(chalk.gray(`  备注: ${report.description || '空'}`))
  console.log()

  const table = new Table({
    head: [
      chalk.white.bold('平台'),
      chalk.white.bold('模式'),
      chalk.white.bold('projectPath'),
      chalk.white.bold('说明'),
    ],
    style: { head: [], border: [] },
  })

  for (const platform of report.platforms) {
    table.push([
      platform.displayName,
      formatPlatformMode(platform),
      platform.projectPath || '-',
      platform.reason || platform.issues[0] || '-',
    ])
  }

  console.log(table.toString())
  console.log()
  console.log(
    chalk.gray(
      `  选项: ${report.options.parallel ? '并行' : '串行'} / retry=${report.options.retry} / continueOnError=${report.options.continueOnError}`,
    ),
  )
  console.log(
    chalk.gray(
      `  通知: ${report.notifications.filter(item => item.enabled).map(item => item.channel).join(', ') || '无'}`,
    ),
  )
  console.log()
}

export function printDoctorReport(report: DoctorReport): void {
  console.log()
  console.log(chalk.bold('环境诊断'))
  console.log(chalk.gray(`  状态: ${formatDoctorStatus(report.status)}`))
  console.log(chalk.gray(`  环境: ${report.env}`))
  console.log()

  const checkTable = new Table({
    head: [
      chalk.white.bold('检查项'),
      chalk.white.bold('状态'),
      chalk.white.bold('说明'),
    ],
    style: { head: [], border: [] },
  })

  for (const check of report.checks) {
    checkTable.push([
      check.title,
      formatCheckStatus(check.status),
      check.message,
    ])
  }

  console.log(checkTable.toString())

  if (report.platforms.length > 0) {
    console.log()
    const platformTable = new Table({
      head: [
        chalk.white.bold('平台'),
        chalk.white.bold('模式'),
        chalk.white.bold('问题'),
      ],
      style: { head: [], border: [] },
    })

    for (const platform of report.platforms) {
      platformTable.push([
        platform.displayName,
        formatPlatformMode(platform),
        platform.issues[0] || platform.reason || '-',
      ])
    }

    console.log(platformTable.toString())
  }

  console.log()
}

function formatPlatformMode(platform: PlatformPlanItem): string {
  switch (platform.mode) {
    case 'mock':
      return chalk.cyan('mock')
    case 'dry-run':
      return chalk.blue('dry-run')
    default:
      return chalk.green('real')
  }
}

function formatCheckStatus(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass':
      return chalk.green('pass')
    case 'warn':
      return chalk.yellow('warn')
    case 'fail':
      return chalk.red('fail')
  }
}

function formatDoctorStatus(status: 'pass' | 'warn' | 'fail'): string {
  return formatCheckStatus(status)
}
