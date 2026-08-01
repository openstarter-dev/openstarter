/**
 * Status 命令：status / info。
 * status 探活 /api/status 并展示连接/延迟/认证状态；info 展示 CLI 本地版本与配置。
 * status 端点公开（不要求登录），但展示是否已登录以辅助诊断。
 */

import { Command } from 'commander';
import { config } from '../lib/config.js';
import { createApiClient } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

interface StatusView {
  readonly status: 'ok';
  readonly timestamp: string;
  readonly version: string;
}

const CLI_VERSION = '0.1.0';

export function registerStatusCommands(program: Command): void {
  program
    .command('status')
    .description('检查 API 连接和服务状态')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        const apiUrl = config.getApiUrl();
        const isAuthenticated = config.isAuthenticated();
        const client = createApiClient();

        const startTime = Date.now();
        const statusData = await client.request<StatusView>('/api/status');
        const latency = Date.now() - startTime;

        const result = {
          api: apiUrl,
          status: statusData.status === 'ok' ? '✓ Connected' : '✗ Error',
          latency: `${latency}ms`,
          version: statusData.version,
          authenticated: isAuthenticated ? '✓' : '✗',
        };

        formatOutput(result, options.json);
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command('info')
    .description('显示 CLI 版本和配置信息')
    .action(() => {
      try {
        const apiUrl = config.getApiUrl();
        const isAuthenticated = config.isAuthenticated();

        const info = {
          'CLI Version': CLI_VERSION,
          'API URL': apiUrl,
          Config: '~/.openstarter/config.json',
          'Logged in': isAuthenticated ? 'Yes' : 'No',
        };

        formatOutput(info, false);
      } catch (error) {
        handleError(error as Error, false);
      }
    });
}
