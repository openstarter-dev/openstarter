// Keep this file as .mjs: `cloudflare:*` are workerd platform builtins that
// neither vite's `environments.ssr.resolve.builtins` nor rolldown options can
// resolve during `vite build`, so the import must be invisible to static
// analysis in the build path — the specifier is assembled at runtime, rolldown
// keeps it verbatim (dead-code elimination drops the DEV branch because
// import.meta.env.DEV is statically replaced), and workerd resolves it natively
// at runtime. In dev the literal import is transformed by vite into a runner
// call that the cloudflare plugin's module runner handles.
// 保持 .mjs：cloudflare:* 是 workerd 平台内建模块，vite build 时
// environments.ssr.resolve.builtins 与 rolldown 选项都无法解析它，因此 build
// 路径的 import 必须对静态分析不可见——运行时拼接 specifier（import.meta.env.DEV
// 被静态替换后字面量分支被死代码消除），workerd 运行时原生解析；dev 路径的字面
// 量 import 经 vite 转换为 runner 调用，由 cloudflare 插件的 module runner 处理。
// Node 侧两条路径都会失败，返回 undefined（调用方已处理）。
export async function tryGetCloudflareEnv() {
  try {
    if (import.meta.env?.DEV) {
      return (await import("cloudflare:workers")).env;
    }
    const specifier = "cloudflare" + ":workers";
    return (await import(/* @vite-ignore */ specifier)).env;
  } catch {
    return undefined;
  }
}
