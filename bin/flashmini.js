#!/usr/bin/env node

/**
 * Flashmini CLI 可执行入口
 *
 * 这是 npm 包的 bin 入口文件，当用户全局安装或通过 npx 执行时，
 * Node.js 会通过 shebang（#!/usr/bin/env node）直接运行此文件。
 *
 * 此文件仅负责引导加载编译后的 CLI 模块，不包含任何业务逻辑。
 */

// 引入 tsup 编译后的 CLI 入口模块
import('../dist/cli.js')
