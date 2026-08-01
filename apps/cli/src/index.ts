// CLI 入口：组装全局选项与各域命令。
// shebang 由 tsup banner 注入；源文件不再重复。

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerDataCommands } from "./commands/data.js";
import { registerProfileCommands } from "./commands/profile.js";
import { registerStatusCommands } from "./commands/status.js";
import { config } from "./lib/config.js";

const program = new Command();

program
  .name("openstarter")
  .description("Command-line interface for openstarter")
  .version("0.1.0")
  .option("--api-url <url>", "覆盖默认 API 地址")
  .option("--verbose", "显示详细错误堆栈");

program.hook("preAction", () => {
  const opts = program.opts();
  if (opts.apiUrl) {
    config.setApiUrl(opts.apiUrl);
  }
});

registerAuthCommands(program);
registerProfileCommands(program);
registerDataCommands(program);
registerStatusCommands(program);

program.parse();
