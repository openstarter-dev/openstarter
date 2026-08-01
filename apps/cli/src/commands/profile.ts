/**
 * Profile 命令：profile / profile:update。
 * 消费 packages/api 的 /api/profile（GET 读取、PATCH 更新显示名），信封由 api-client 解包。
 */

import { Command } from 'commander';
import { createApiClient, requireAuthOrThrow } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

interface ProfileView {
  readonly createdAt?: string;
  readonly email: string;
  readonly id: string;
  readonly name?: string;
}

export function registerProfileCommands(program: Command): void {
  program
    .command('profile')
    .description('查看个人资料')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        const profile = await client.request<ProfileView>('/api/profile');
        formatOutput(profile, options.json);
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command('profile:update')
    .description('更新个人资料')
    .requiredOption('--name <name>', '更新显示名称')
    .action(async (options) => {
      try {
        requireAuthOrThrow();
        const client = createApiClient();
        await client.request<ProfileView>('/api/profile', {
          body: JSON.stringify({ name: options.name }),
          method: 'PATCH',
        });
        console.log('✓ 个人资料已更新');
      } catch (error) {
        handleError(error as Error, false);
      }
    });
}
