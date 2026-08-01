// CLI 入口：组装全局选项与各域命令。
// shebang 由 tsup banner 注入；源文件不再重复。

import { Command } from 'commander';
import { config } from './lib/config.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerProfileCommands } from './commands/profile.js';

const program = new Command();

program
  .name('openstarter')
  .description('Command-line interface for openstarter')
  .version('0.1.0')
  // 全局选项：可在任意子命令前使用。verbose 由各命令的 handleError 消费。
  .option('--api-url <url>', '覆盖默认 API 地址')
  .option('--verbose', '显示详细错误堆栈');

// 启动时若提供了 --api-url，覆盖本地配置（影响后续命令的默认 API 地址）。
program.hook('preAction', () => {
  const opts = program.opts();
  if (opts.apiUrl) {
    config.setApiUrl(opts.apiUrl);
  }
});

registerAuthCommands(program);
registerProfileCommands(program);

program.parse();
