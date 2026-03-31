# Flashmini 面试 Q&A（模拟面试官提问）

> 按照面试官听完项目介绍后的提问逻辑排列
> 每个问题附参考答案，供背诵和理解

---

## 一、架构设计类

### Q1：你说四层架构，为什么这么分？不分行不行？

**A：** 分层是为了职责隔离和依赖方向单向化。不分当然也能跑，但会带来几个问题：第一，平台逻辑和 CLI 逻辑混在一起，我改个命令行参数可能影响到上传逻辑；第二，加新平台或新通知渠道就要改核心代码，违反开闭原则；第三，没法单独测试某一层。分层之后，核心调度层不包含任何平台特定代码，它只负责"什么时候做什么"，具体怎么做全部委托给策略层和插件系统。依赖方向严格向下——CLI 层依赖核心层，核心层依赖策略层和插件层，反过来不可以。

---

### Q2：Context 上下文对象为什么不用全局变量或者单例？

**A：** 三个原因。第一，全局变量的数据流向不可追踪，谁读了谁写了完全不知道，Debug 的时候是噩梦。第二，如果用单例，多次调用 upload() 的话（比如 Node.js API 场景下先上传 dev 再上传 prod），上一次的状态会污染下一次。Context 是在每次 Runner.run() 时 new 出来的，生命周期跟一次上传任务绑定，天然隔离。第三，Context 作为参数传递，在测试的时候可以轻松 mock，不需要去清理全局状态。

---

### Q3：Runner 是怎么编排整个流程的？能不能说一下执行顺序？

**A：** Runner.run() 一共 8 个步骤，严格按顺序执行：

1. 加载插件，调用每个插件的 apply() 方法注册钩子回调
2. 解析版本号（auto 就读 package.json，否则直接用）和描述（git 就读最近一条 commit）
3. 读取 git 信息——分支名、commit hash、最近 5 条日志
4. 执行 beforeAll 钩子——插件可以在这里修改 ctx，比如动态改版本号
5. 获取启用的平台列表（配置 + CLI 参数过滤）
6. 并行或串行上传——每个平台走 beforeUpload → retry(upload) → afterUpload
7. 执行 afterAll 钩子
8. 发送通知

Runner 本身不包含任何平台特定逻辑，它只做两件事：按顺序调钩子，把平台名交给工厂创建上传器。

---

## 二、插件系统类

### Q4：你说参考了 Tapable，具体参考了什么？和 Tapable 有什么区别？

**A：** 参考了 Tapable 的核心思想——用 tap 注册回调，用 call 触发执行。但区别很大：

| 维度 | Tapable | 我的实现 |
|------|---------|---------|
| 钩子类型 | SyncHook / AsyncSeriesHook / AsyncParallelHook / SyncBailHook 等十几种 | 只有串行执行（call）和瀑布流（waterfall）两种 |
| 注册方式 | tap / tapAsync / tapPromise 三种 | 只有 tap 一种，回调可以是同步或 async，统一用 await 处理 |
| 高级能力 | 支持 bail（中断）、loop（循环）、interception（拦截器） | 不支持，不需要 |
| 代码量 | 数千行 | 不到一百行 |
| 依赖 | 会带入 webpack 相关依赖 | 零依赖 |

Tapable 的设计是为了支撑 webpack 那样复杂度的编译流水线，对我这个场景来说太重了。我只需要"在特定时机按顺序执行回调"和"链式修改通知内容"两种能力，自实现完全够用。

---

### Q5：waterfall 和普通的 call 有什么区别？什么场景用 waterfall？

**A：** call 是纯粹的串行执行，每个回调独立运行，不关心返回值。waterfall 的区别是每个回调的返回值会作为下一个回调的输入参数，形成一个"瀑布流"。

我只在 beforeNotify 钩子上用了 waterfall。场景是这样的：通知消息构建好之后，我想让多个插件能链式修改它——插件 A 加一个自定义字段，插件 B 改一下标题。如果用 call，每个插件只能读消息不能改；用 waterfall，每个插件拿到上一个插件处理过的消息，改完返回，下一个插件接着改，最终的结果就是经过所有插件处理后的消息。

---

### Q6：插件加载器是怎么处理三种不同来源的插件的？

**A：** 插件加载器根据 use 字段的格式做判断：

- 以 `flashmini/plugins/` 开头——内置插件，通过预定义的 Map 直接 import
- 以 `./` 或 `../` 开头——本地文件，resolve 成绝对路径后 dynamic import
- 其他——当做 npm 包名，直接 import(packageName)

导入之后，我用 extractPlugin 函数统一处理导出格式：如果默认导出是函数（工厂函数），就调用它并传入 options；如果是对象且有 name 和 apply 属性，就直接用。最后调 validatePlugin 校验，确保拿到的确实是合法的插件对象。

---

### Q7：如果插件的钩子回调抛了异常，会怎么样？

**A：** 要分情况看。beforeAll 和 afterAll 钩子里如果抛异常，会直接中断整个流程，因为这是全局性的钩子。beforeUpload 和 afterUpload 里如果抛异常，只影响当前平台，是否继续上传其他平台取决于 continueOnError 配置。onError 钩子本身就是用来处理错误的，如果它也抛异常，Runner 会 catch 住但不做额外处理——防止错误处理链路本身出问题导致无限递归。

---

## 三、策略模式 / 工厂模式类

### Q8：为什么用策略模式而不是简单的 if-else？

**A：** 如果用 if-else，代码大概长这样：

```typescript
if (platform === 'wechat') {
  // 50 行微信上传逻辑
} else if (platform === 'alipay') {
  // 50 行支付宝上传逻辑
} else if (platform === 'baidu') {
  // ...
}
```

问题有三个：第一，所有平台逻辑挤在一个函数里，单个文件可能几百行，可读性和可维护性很差。第二，加新平台要改这个函数，违反开闭原则，还有误碰其他平台逻辑的风险。第三，没法单独测试某一个平台的上传逻辑。

用策略模式后，每个平台是一个独立的类文件，有自己的 Zod Schema、自己的 SDK 调用逻辑、自己的单元测试。新增平台就是新增一个文件 + 在工厂注册一行，主流程零修改。

---

### Q9：PlatformFactory 为什么要提供 register 方法？谁会用？

**A：** register 是留给两种场景的：一是用户想支持一个我们没内置的平台，比如快手小程序，他可以自己写一个 KuaishouUploader 然后调 register 注册进来；二是第三方插件——比如有人发布了一个 npm 包 flashmini-platform-kuaishou，他可以在插件的 apply 方法里调用 PlatformFactory.register() 完成注册。这样整个平台扩展能力就彻底开放了。

---

### Q10：每个平台上传器的构造函数里为什么要立即做 Zod 校验？不能等到 upload 的时候再校验吗？

**A：** 可以，但我刻意放在构造时。原因是"fail fast"原则——配置错误越早暴露越好。构造函数在 PlatformFactory.create() 的时候就会被调用，这发生在实际上传之前。如果配置有问题（比如微信 appId 格式不对），在构造时就直接报错了，用户不需要等到真正上传、等了几十秒之后才发现配置写错了。省时间。

---

## 四、配置与类型系统类

### Q11：为什么选 Zod 而不是 Joi 或者 Yup？

**A：** 主要是 Zod 有一个其他校验库没有的杀手级特性——z.infer。它能从 Schema 自动推导出 TypeScript 类型。这意味着我只需要维护一份 Zod Schema，运行时校验规则和 TypeScript 静态类型自动保持一致。如果用 Joi 或 Yup，我需要单独手写一份 TypeScript interface，两边要手动保持同步，这是维护成本也是 bug 来源。

另外 Zod 的 API 设计对 TypeScript 更友好，链式调用有完整的类型推断。

---

### Q12：defineConfig 什么都没做，为什么要搞这个函数？

**A：** 它确实什么都没做，就是一个恒等函数。但它的作用是给配置文件提供类型推断。用户在 flashmini.config.ts 里写 `export default defineConfig({ ... })` 的时候，IDE 能提供完整的自动补全——有哪些字段、每个字段是什么类型、有哪些可选值。如果用户直接 `export default { ... }`，TypeScript 不知道这个对象应该符合什么类型，就没有提示了。

这个技巧在很多前端工具里都能看到：Vite 的 defineConfig、Nuxt 的 defineNuxtConfig、Vitest 的 defineConfig，思路完全一样。

---

### Q13：配置合并的三级优先级具体是怎么实现的？

**A：** 首先，Cosmiconfig 加载配置文件，Zod 校验并填充默认值——这是最低优先级。然后，env.ts 里的 getFlashminiEnvConfig() 读取 FLASHMINI_ 前缀的环境变量，如果存在就覆盖对应字段——这是中间优先级。最后，upload 命令里的 mergeWithCliOptions() 把 CLI 参数（--version、--desc、--no-notify 等）合并进来——这是最高优先级。整个过程就是三层对象浅合并，后者覆盖前者。

---

## 五、通知系统类

### Q14：钉钉的 HmacSHA256 加签具体是怎么做的？

**A：** 钉钉机器人的安全设置有三种：关键词、加签、IP 白名单。我们选的加签，流程是这样：

1. 取当前毫秒级时间戳 timestamp
2. 用 `timestamp + "\n" + secret` 作为签名字符串
3. 用 Node.js 的 crypto.createHmac('sha256', secret) 计算 HMAC 签名
4. 把签名结果 Base64 编码
5. 再 URL 编码
6. 把 timestamp 和 sign 两个参数拼到 Webhook URL 后面

服务端收到请求后用同样的方式算一遍，对比签名是否一致。这样即使 Webhook URL 泄露了，别人不知道 secret 也没法伪造请求。

---

### Q15：通知系统的 beforeNotify 钩子有什么实际用途？

**A：** 举几个真实场景：

1. 有个业务线希望在飞书通知里加一个"构建耗时"字段——他写了一个插件，在 beforeAll 记录开始时间存到 ctx.extra，在 beforeNotify 里把耗时信息塞进消息体
2. 测试环境不想发通知但又想保留通知流程用于调试——插件在 beforeNotify 里把 webhook 改成一个本地 mock 服务的地址
3. 需要根据失败情况动态调整 @的人——平时 @测试同学，如果有平台上传失败就额外 @技术负责人

这些需求如果硬编码在通知模块里会非常混乱，有了 beforeNotify 钩子，用户自己写插件就能搞定。

---

## 六、工程化 / CI 类

### Q16：双调用模式具体怎么实现的？CLI 和 API 的代码是共享的吗？

**A：** 完全共享。核心逻辑在 core/runner.ts，无论 CLI 还是 API 都是创建 Runner 实例然后调 run() 方法。

CLI 入口（cli/index.ts）的职责是用 Commander.js 解析命令行参数，转成 RunOptions 对象，传给 Runner。然后把返回的 Context 渲染成表格或 JSON 输出到终端。

API 入口（src/index.ts 导出的 upload 函数）的职责是接收用户传入的选项对象，加载和校验配置，创建 Runner 并调 run()，然后直接返回 Context 对象。

两者的区别只在"参数怎么来"和"结果怎么呈现"上，核心流程完全一致。这样保证了两种调用方式的行为百分百一致。

打包方面，tsup 配了双入口——index 入口打包给 API 用，cli 入口打包给命令行用。bin/flashmini.js 只有一行 `import('../dist/cli.js')`，纯引导。

---

### Q17：--json 输出模式为什么要做？谁用？

**A：** CI 流水线用。在 CI 环境里，人类不会看终端输出，需要的是结构化数据。比如 GitHub Actions 的后续步骤可能要判断"哪些平台成功了"来决定下一步操作，或者把版本号写到 release note 里。JSON 输出就是给机器解析用的。

另一个好处是配合 `jq` 命令可以在 shell 脚本里灵活提取数据：
```bash
flashmini upload --json | jq '.results[] | select(.success == false) | .platform'
```

---

### Q18：非零退出码是怎么设计的？

**A：** 只要有任何平台上传失败，process.exit(1)。全部成功才是 exit(0)。这样 CI 流水线的 `set -e` 或者 GitHub Actions 的默认行为就能自动感知到上传失败并中止后续步骤。

在 catch 分支里也是 exit(1)，并且如果开了 --json 模式，会在退出前输出 `{ success: false, error: "..." }` 的 JSON，让 CI 能拿到错误信息。

---

### Q19：指数退避重试的 delay 是怎么算的？

**A：** 公式是 `delay * (i + 1)`，其中 i 是从 0 开始的重试次数。默认 delay 是 3000ms，所以：

- 第 1 次重试（i=0）：等 3000ms
- 第 2 次重试（i=1）：等 6000ms
- 第 3 次重试（i=2）：等 9000ms

这是线性退避。严格的指数退避应该是 `delay * 2^i`（3s、6s、12s），但在上传场景下线性退避已经够用了，而且等待时间增长更可预测。如果面试官问到这个差异，我会说这是在简单性和理论最优之间的权衡。

---

## 七、深挖细节类

### Q20：并行上传和串行上传的取舍是什么？

**A：** 并行的好处是快——4 个平台各需要 10 秒，并行只要 10 秒，串行要 40 秒。默认开启并行。

但并行也有问题：第一，如果某个平台的 SDK 对系统资源占用很高（比如需要大量内存做代码编译），并行可能导致 OOM；第二，某些 CI 环境网络带宽有限，并行上传多个大包可能都变慢；第三，调试的时候串行更容易看清楚日志顺序。

所以我把它做成了可配置项。生产环境默认并行追求速度，调试或者资源紧张的时候切成串行。

并行的实现是 Promise.all，串行是 for...of + await。

---

### Q21：continueOnError 选项的使用场景是什么？

**A：** 默认是 false，即某个平台上传失败后立即停止，不上传其他平台。这是因为大多数情况下，如果微信上传失败了（可能是密钥过期、网络问题），其他平台大概率也会有问题，继续上传只是浪费时间。

但有一个场景需要设成 true：某个平台临时出了问题（比如支付宝的 CI 服务在维护），但其他平台是好的，你还是希望把能上传的先上传了。这时候设 continueOnError: true，它会把所有平台都试一遍，最后在结果里告诉你哪些成功哪些失败。

---

### Q22：你怎么保证各平台 SDK 不互相影响？比如微信 SDK 出 bug 不会影响支付宝上传。

**A：** 两个层面的隔离。第一，代码层面，每个平台的 SDK 是在各自的上传器里动态 import 的——`const ci = await import('miniprogram-ci')`。不使用某个平台的时候，它的 SDK 根本不会被加载，更不会影响其他平台。第二，运行时层面，每个平台的 upload 是独立的 async 函数调用，即使某个平台的 SDK 内部抛了异常，也只会被 uploadOne 的 try-catch 捕获，不会扩散到其他平台。

---

### Q23：如果让你加一个新平台，比如快手小程序，你要改哪些代码？

**A：** 改动非常少：

1. 新建 `src/platforms/kuaishou/schema.ts`——定义快手的 Zod 配置 Schema
2. 新建 `src/platforms/kuaishou/index.ts`——继承 BaseUploader，实现 upload、preview、validateConfig
3. 在 `src/platforms/factory.ts` 的 PLATFORM_MAP 里加一行 `kuaishou: KuaishouUploader`
4. 在 `src/core/config/schema.ts` 的 platforms 对象里加一个 `kuaishou: KuaishouSchema.optional()`

就这四步。Runner、插件系统、通知系统、CLI 层，一行都不用改。这就是策略模式 + 工厂模式带来的扩展性。

---

### Q24：项目里有没有遇到循环依赖的问题？怎么避免的？

**A：** 有意识地避免过。关键措施是两个：

第一，严格的单向依赖——上层可以依赖下层，下层不能反过来依赖上层。比如 Runner 可以 import Context，但 Context 不能 import Runner。

第二，类型系统独立——所有的 interface 和 type 都放在 types/ 目录下，其他模块 import type 只引入类型不引入值。TypeScript 的 import type 在编译后会被完全擦除，不产生运行时依赖。

有一个潜在的循环点是 env.ts 里的 resolveDescription() 需要调 git.ts 的 getLastCommitMessage()。我用了延迟 import（`const { getLastCommitMessage } = await import('./git')`）来打破编译期的循环依赖。

---

## 八、综合 / 开放性问题

### Q25：这个项目你觉得最有技术含量的是哪一部分？

**A：** 我觉得是插件系统的设计。它不是简单的事件监听，而是一套完整的生命周期管理机制——要定义哪些钩子、钩子在什么时候触发、钩子之间的执行顺序、钩子里能做什么不能做什么、瀑布流钩子和普通钩子的区别、插件的加载和初始化流程。这些决策每一个都需要权衡，做多了增加复杂度，做少了不够用。最终的结果是 6 个钩子 + 2 种执行模式 + 不到一百行代码，我觉得这个平衡找得比较好。

---

### Q26：如果重新做这个项目，你会有什么不同的设计？

**A：** 几个方面：

1. **钩子类型安全**——现在 HookManager 的 tap 和 call 参数类型是 any，如果能做到 tap('beforeUpload', fn) 的时候自动推断 fn 的参数类型是 (ctx: Context, platform: string)，体验会更好。可以参考 mitt 或者 hookable 的泛型写法。
2. **插件 options 类型推断**——目前插件 options 是 Record<string, unknown>，用户拿到后要自己断言类型。可以通过泛型让每个插件声明自己的 options 类型。
3. **平台 SDK 抽象层**——目前百度和字节是通过 execFileSync 调 CLI 命令的，如果它们有 Node.js SDK，应该优先用 SDK，因为 CLI 调用没法拿到结构化的返回值。
4. **配置热更新**——现在配置文件是启动时读一次的。如果要支持 watch 模式（文件变了自动重新上传），需要引入配置监听机制。

---

### Q27：你怎么测试这个项目的？平台 SDK 怎么 mock？

**A：** 分三层测试：

1. **单元测试**——测 HookManager 的 tap/call/waterfall 逻辑、测 Zod Schema 的校验规则（给各种非法配置，验证报错信息是否正确）、测 retry 函数的重试行为。这些不涉及外部依赖，直接测。

2. **平台上传器测试**——用 vitest 的 vi.mock() 把各平台 SDK mock 掉。比如测微信上传器，mock `miniprogram-ci`，让它的 upload 方法返回预设结果，然后验证 WechatUploader.upload() 是否正确组装了参数、是否正确返回了 UploadResult。

3. **集成测试**——创建一个完整的配置对象，用 mock 过的 SDK 跑一遍 Runner.run()，验证整个流程从头到尾是否正确——钩子是否按顺序触发、Context 是否正确填充、通知是否正确发送。

---

### Q28：这个项目的包体积你说控制在 500KB 以内，怎么做到的？

**A：** 几个关键决策：

1. **不用 axios**——Node 18 原生 fetch 够用了，省掉 axios 及其依赖大概 400KB
2. **不用 Tapable**——自己实现不到 100 行搞定
3. **不用 dotenv**——Cosmiconfig 已经覆盖了配置读取能力
4. **平台 SDK 不打进包里**——它们是 peerDependency 或者动态 import，用户按需安装
5. **tsup 基于 esbuild**——tree shaking 和代码压缩效果很好，构建产物很小
6. **chalk、ora、commander 这些本身就很轻量**——这是我选型时就考虑过的

---

### Q29：你提到的 tsup 双格式打包是什么意思？为什么要同时出 ESM 和 CJS？

**A：** ESM 是 import/export 语法，CJS 是 require/module.exports 语法。Node.js 生态正在从 CJS 向 ESM 过渡，但很多项目还在用 CJS。同时输出两种格式确保不管用户的项目是 ESM 还是 CJS 都能正常引用。

package.json 的 exports 字段做了分流：
```json
{
  "import": "./dist/index.js",      // ESM
  "require": "./dist/index.cjs",    // CJS
  "types": "./dist/index.d.ts"      // 类型声明
}
```

Node.js 会根据调用方的模块系统自动选择加载哪个文件。tsup 的 shims 选项会注入兼容代码，确保 ESM 里用到的 import.meta.url 和 CJS 里用到的 __dirname 互不冲突。

---

### Q30：项目做完之后有没有收到过什么用户反馈？做了哪些迭代优化？

**A：** （这个问题需要你结合自己的真实情况回答，以下是参考方向）

收到的反馈主要有几类：
1. 最初版本没有 --dry-run 模式，用户在调试配置的时候必须真的上传一次才知道配置对不对，后来加了 dry-run，只走完前面的流程但跳过实际上传步骤
2. 有团队提出想在 CI 里只上传指定平台而不是所有已启用的平台——加了 --platform 参数支持逗号分隔
3. 飞书通知一开始只是纯文本，后来改成了富文本卡片，信息密度和视觉效果都好很多
4. 错误信息一开始不够友好——比如微信密钥错误时 SDK 报的是英文错误码，后来我在 FlashminiError 里做了映射，翻译成中文提示

---

*以上问题覆盖了架构设计、设计模式、类型系统、工程化、CI/CD、性能优化等面试高频方向。建议结合项目介绍文档一起准备，做到每个答案都能自然地联系到具体代码和设计决策。*
