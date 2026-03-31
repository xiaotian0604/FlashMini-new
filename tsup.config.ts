/**
 * tsup 打包配置
 *
 * tsup 基于 esbuild，提供零配置的 TypeScript 打包能力。
 * 同时输出 ESM 和 CJS 两种格式，确保在不同模块系统下都能正常使用。
 *
 * - entry: 定义多入口，分别打包库入口和 CLI 入口
 * - format: 同时生成 ESM(.js) 和 CJS(.cjs) 格式
 * - dts: 自动生成 .d.ts 类型声明文件
 * - splitting: 启用代码分割，共享模块不会被重复打包
 * - clean: 每次构建前清空 dist 目录
 * - shims: 注入兼容代码，确保 ESM/CJS 互转正常
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  // 多入口打包：库入口 + CLI 入口
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    'plugins/git-log': 'src/plugins/built-in/git-log.ts',
    'plugins/version-bump': 'src/plugins/built-in/version-bump.ts',
  },
  // 同时输出 ESM 和 CJS 格式
  format: ['esm', 'cjs'],
  // 生成 TypeScript 类型声明文件（.d.ts）
  dts: true,
  // 代码分割：多入口共享的模块只打包一次
  splitting: true,
  // 构建前清空输出目录
  clean: true,
  // 注入 ESM/CJS 兼容 shim（如 __dirname、import.meta.url 等）
  shims: true,
})
