# CLI 应用实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 openstarter 添加独立的命令行工具，支持设备授权认证和基础 CRUD 操作

**Architecture:** 完全独立的 CLI 应用，通过 HTTP 调用后端 API。使用 Better Auth Device Authorization 进行认证，配置存储在 `~/.openstarter/config.json`。

**Tech Stack:** TypeScript, Commander.js, Conf, Hono RPC Client, tsup

## Global Constraints

- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- 遵循 Biome 代码规范（ultracite 配置）
- 所有命令必须支持 `--json` 输出选项
- CLI 启动时间目标 < 100ms
- 打包后文件大小目标 < 5MB
- 退出码：0=成功, 1=一般错误, 2=认证错误, 3=网络错误, 4=配置错误
- 使用 catalog 版本的依赖（Hono、TypeScript、Node types）

---

## File Structure

### CLI 应用 (`apps/cli/`)

**新建文件：**
- `apps/cli/package.json` - 包配置，定义 bin 入口和依赖
- `apps/cli/tsconfig.json` - TypeScript 配置
- `apps/cli/tsup.config.ts` - 打包配置
- `apps/cli/src/index.ts` - CLI 入口，Commander 程序定义
- `apps/cli/src/types.ts` - 共享类型定义
- `apps/cli/src/lib/config.ts` - 配置管理（读写 ~/.openstarter/）
- `apps/cli/src/lib/errors.ts` - 错误类定义和处理
- `apps/cli/src/lib/output.ts` - 输出格式化（JSON/表格）
- `apps/cli/src/lib/auth-client.ts` - Device Authorization 客户端
- `apps/cli/src/lib/api-client.ts` - Hono RPC API 客户端
- `apps/cli/src/commands/auth.ts` - login, logout, whoami 命令
- `apps/cli/src/commands/profile.ts` - profile, profile:update 命令
- `apps/cli/src/commands/data.ts` - list, get, create 命令
- `apps/cli/src/commands/status.ts` - status, info 命令

### Better Auth 更新 (`packages/auth/`)

**修改文件：**
- `packages/auth/package.json` - 添加 @better-auth/device 依赖
- `packages/auth/src/index.ts` - 添加 deviceAuthorization 插件配置

### API 端点 (`packages/api/`)

**新建文件：**
- `packages/api/src/routes/profile.ts` - 用户资料 API
- `packages/api/src/routes/notes.ts` - 笔记 CRUD API（示例资源）
- `packages/api/src/routes/status.ts` - 系统状态 API

**修改文件：**
- `packages/api/src/index.ts` - 挂载新增的路由

### Web 应用 (`apps/web/`)

**新建文件：**
- `apps/web/src/routes/_auth-pages/device.tsx` - 设备授权验证页面

### Turbo 配置

**修改文件：**
- `turbo.json` - 添加 CLI 构建配置

---

### Task 1: CLI 项目基础设施

**Files:**
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/tsup.config.ts`
- Create: `apps/cli/src/index.ts`
- Create: `apps/cli/.gitignore`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: 无
- Produces: 
  - `apps/cli/` 项目结构
  - `openstarter` 命令入口（未实现命令）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@openstarter/cli",
  "version": "0.1.0",
  "description": "Command-line interface for openstarter",
  "private": true,
  "type": "module",
  "bin": {
    "openstarter": "./dist/index.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "conf": "^13.0.0",
    "hono": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "catalog:"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  minify: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outDir: 'dist',
});
```

- [ ] **Step 4: 创建基础 index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('openstarter')
  .description('Command-line interface for openstarter')
  .version('0.1.0');

program.parse();
```


- [ ] **Step 5: 创建 .gitignore**

```
dist
node_modules
.turbo
```

- [ ] **Step 6: 更新 turbo.json 添加 CLI 构建**

在 `turbo.json` 的 `pipeline` 中添加：

```json
"@openstarter/cli#build": {
  "outputs": ["dist/**"],
  "dependsOn": []
}
```

- [ ] **Step 7: 安装依赖**

Run: `pnpm install`
Expected: 依赖安装成功，生成 node_modules

- [ ] **Step 8: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，生成 `dist/index.js` 文件

- [ ] **Step 9: 测试 CLI 运行**

Run: `node apps/cli/dist/index.js --help`
Expected: 显示帮助信息，包含 version 和 description

- [ ] **Step 10: Commit**

```bash
git add apps/cli turbo.json
git commit -m "feat(cli): add CLI project scaffolding"
```

---

### Task 2: 配置管理和错误处理

**Files:**
- Create: `apps/cli/src/types.ts`
- Create: `apps/cli/src/lib/config.ts`
- Create: `apps/cli/src/lib/errors.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `ConfigManager` 类：`getConfig()`, `setAuth(tokens)`, `clearAuth()`, `isAuthenticated()`, `getApiUrl()`
  - `CliConfig` 接口：配置结构定义
  - 错误类：`AuthError`, `NetworkError`, `ConfigError`, `ApiError`
  - `handleError(error, verbose)` 函数

- [ ] **Step 1: 创建 types.ts**

```typescript
export interface CliConfig {
  apiUrl: string;
  auth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
```

- [ ] **Step 2: 创建 errors.ts**

```typescript
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleError(error: Error, verbose: boolean): never {
  if (error instanceof AuthError) {
    console.error('❌ 认证错误:', error.message);
    console.error('请运行 `openstarter login` 重新登录');
    process.exit(2);
  }

  if (error instanceof NetworkError) {
    console.error('❌ 网络错误:', error.message);
    console.error('请检查网络连接和 API 地址');
    process.exit(3);
  }

  if (error instanceof ConfigError) {
    console.error('❌ 配置错误:', error.message);
    process.exit(4);
  }

  console.error('❌ 错误:', error.message);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
}
```


- [ ] **Step 3: 创建 config.ts**

```typescript
import Conf from 'conf';
import type { CliConfig, AuthTokens } from '../types.js';

const DEFAULT_API_URL = 'https://app.openstarter.dev';

export class ConfigManager {
  private store: Conf<CliConfig>;

  constructor() {
    this.store = new Conf<CliConfig>({
      projectName: 'openstarter',
      defaults: {
        apiUrl: DEFAULT_API_URL,
      },
    });
  }

  getConfig(): CliConfig {
    return this.store.store;
  }

  getApiUrl(): string {
    return this.store.get('apiUrl', DEFAULT_API_URL);
  }

  setApiUrl(url: string): void {
    this.store.set('apiUrl', url);
  }

  setAuth(tokens: AuthTokens): void {
    this.store.set('auth', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    });
  }

  clearAuth(): void {
    this.store.delete('auth');
  }

  isAuthenticated(): boolean {
    const auth = this.store.get('auth');
    if (!auth) return false;
    return Date.now() < auth.expiresAt;
  }

  getAccessToken(): string | undefined {
    const auth = this.store.get('auth');
    if (!auth || Date.now() >= auth.expiresAt) {
      return undefined;
    }
    return auth.accessToken;
  }
}

export const config = new ConfigManager();
```

- [ ] **Step 4: 测试配置管理**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src
git commit -m "feat(cli): add config manager and error handling"
```

---

### Task 3: 输出格式化工具

**Files:**
- Create: `apps/cli/src/lib/output.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `formatOutput(data: unknown, json: boolean): void`
  - `formatTable(data: Array<Record<string, unknown>>): void`
  - `formatKeyValue(data: Record<string, unknown>): void`

- [ ] **Step 1: 创建 output.ts**

```typescript
export function formatOutput(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    formatHumanReadable(data);
  }
}

function formatHumanReadable(data: unknown): void {
  if (Array.isArray(data)) {
    formatTable(data);
  } else if (typeof data === 'object' && data !== null) {
    formatKeyValue(data as Record<string, unknown>);
  } else {
    console.log(data);
  }
}

export function formatTable(data: Array<Record<string, unknown>>): void {
  if (data.length === 0) {
    console.log('(empty)');
    return;
  }

  const keys = Object.keys(data[0]);
  const columnWidths = keys.map((key) => {
    const maxLength = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? '').length),
    );
    return Math.min(maxLength, 40);
  });

  const header = keys
    .map((key, i) => key.padEnd(columnWidths[i]))
    .join('  ');
  console.log(header);
  console.log(columnWidths.map((w) => '-'.repeat(w)).join('  '));

  for (const row of data) {
    const line = keys
      .map((key, i) => {
        const value = String(row[key] ?? '');
        return value.length > columnWidths[i]
          ? `${value.slice(0, columnWidths[i] - 3)}...`
          : value.padEnd(columnWidths[i]);
      })
      .join('  ');
    console.log(line);
  }
}

export function formatKeyValue(data: Record<string, unknown>): void {
  const maxKeyLength = Math.max(
    ...Object.keys(data).map((key) => key.length),
  );

  for (const [key, value] of Object.entries(data)) {
    const formattedKey = key.padEnd(maxKeyLength);
    console.log(`${formattedKey}: ${value}`);
  }
}
```

- [ ] **Step 2: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/lib/output.ts
git commit -m "feat(cli): add output formatting utilities"
```

---

### Task 4: Better Auth Device Authorization 配置

**Files:**
- Modify: `packages/auth/package.json`
- Modify: `packages/auth/src/index.ts`

**Interfaces:**
- Consumes: 现有的 Better Auth 配置
- Produces:
  - Device Authorization 端点：`POST /api/auth/device/code`, `POST /api/auth/device/token`
  - Better Auth 插件配置：`deviceAuthorization`

- [ ] **Step 1: 检查 Better Auth 版本**

Run: `cat packages/auth/package.json | grep better-auth`
Expected: 查看当前 better-auth 版本（应为 1.6.11 或更高）

- [ ] **Step 2: 添加 Device Authorization 依赖**

在 `packages/auth/package.json` 的 `dependencies` 中添加：

```json
"@better-auth/device": "catalog:"
```

更新 pnpm-workspace.yaml 的 catalog（如果尚未包含）：

```yaml
'@better-auth/device': 1.6.11
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`
Expected: 依赖安装成功

- [ ] **Step 4: 读取现有 Better Auth 配置**

Run: `cat packages/auth/src/index.ts | head -50`
Expected: 查看当前 betterAuth 配置结构

- [ ] **Step 5: 添加 Device Authorization 插件**

在 `packages/auth/src/index.ts` 中导入插件并添加配置：

在文件顶部添加导入：
```typescript
import { deviceAuthorization } from '@better-auth/device';
```

在 `plugins` 数组中添加：
```typescript
deviceAuthorization({
  userCodeLength: 8,
  deviceCodeLength: 32,
  expiresIn: 600,
  interval: 5,
}),
```

- [ ] **Step 6: 测试构建**

Run: `pnpm --filter @openstarter/auth build`
Expected: 构建成功，无类型错误

- [ ] **Step 7: 测试类型检查**

Run: `pnpm check-types`
Expected: 所有包类型检查通过

- [ ] **Step 8: Commit**

```bash
git add packages/auth pnpm-workspace.yaml
git commit -m "feat(auth): add Better Auth Device Authorization plugin"
```

---

### Task 5: Device Authorization 认证客户端

**Files:**
- Create: `apps/cli/src/lib/auth-client.ts`

**Interfaces:**
- Consumes:
  - `DeviceCodeResponse`, `TokenResponse` from `../types.js`
  - `NetworkError` from `./errors.js`
- Produces:
  - `deviceLogin(apiUrl: string): Promise<TokenResponse>`
  - `requestDeviceCode(apiUrl: string): Promise<DeviceCodeResponse>`
  - `pollForToken(apiUrl, deviceCode, interval, expiresIn): Promise<TokenResponse>`

- [ ] **Step 1: 创建 auth-client.ts**

```typescript
import type { DeviceCodeResponse, TokenResponse } from '../types.js';
import { NetworkError } from './errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestDeviceCode(
  apiUrl: string,
): Promise<DeviceCodeResponse> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/device/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to request device code: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new NetworkError(`无法连接到 API: ${error.message}`);
    }
    throw error;
  }
}

export async function pollForToken(
  apiUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  const startTime = Date.now();
  const timeout = expiresIn * 1000;

  while (Date.now() - startTime < timeout) {
    await sleep(interval * 1000);

    try {
      const response = await fetch(`${apiUrl}/api/auth/device/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });

      if (response.ok) {
        return await response.json();
      }

      const error = await response.json();
      if (error.error === 'authorization_pending') {
        continue;
      }

      throw new Error(error.error_description || error.error);
    } catch (error) {
      if (error instanceof Error && error.message === 'authorization_pending') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('授权超时，请重试');
}

export async function deviceLogin(apiUrl: string): Promise<TokenResponse> {
  const deviceCodeResponse = await requestDeviceCode(apiUrl);

  console.log('\n请访问:', deviceCodeResponse.verification_uri);
  console.log('输入代码:', deviceCodeResponse.user_code);
  console.log('\n等待授权...\n');

  const tokens = await pollForToken(
    apiUrl,
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval,
    deviceCodeResponse.expires_in,
  );

  return tokens;
}
```


- [ ] **Step 2: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/lib/auth-client.ts
git commit -m "feat(cli): add device authorization client"
```

---

### Task 6: API 客户端封装

**Files:**
- Create: `apps/cli/src/lib/api-client.ts`

**Interfaces:**
- Consumes:
  - `config.getApiUrl()`, `config.getAccessToken()` from `./config.js`
  - `AuthError`, `NetworkError`, `ApiError` from `./errors.js`
- Produces:
  - `createApiClient()` - 返回 Hono RPC 客户端
  - `handleApiError(error)` - API 错误处理

- [ ] **Step 1: 创建 api-client.ts**

```typescript
import { hc } from 'hono/client';
import { config } from './config.js';
import { AuthError, NetworkError, ApiError } from './errors.js';

export function createApiClient() {
  const apiUrl = config.getApiUrl();
  const token = config.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 注意：这里暂时返回基础 fetch 包装，
  // 在后续任务中我们会添加具体的 API 类型
  return {
    apiUrl,
    headers,
    async fetch(path: string, options?: RequestInit) {
      try {
        const response = await fetch(`${apiUrl}${path}`, {
          ...options,
          headers: {
            ...headers,
            ...options?.headers,
          },
        });

        return response;
      } catch (error) {
        if (error instanceof Error) {
          throw new NetworkError(`网络请求失败: ${error.message}`);
        }
        throw error;
      }
    },
  };
}

export function handleApiError(response: Response): never {
  const { status } = response;

  if (status === 401) {
    config.clearAuth();
    throw new AuthError('认证已过期，请重新登录');
  }

  if (status === 403) {
    throw new ApiError('权限不足', status);
  }

  if (status === 404) {
    throw new ApiError('资源不存在', status);
  }

  if (status === 422) {
    throw new ApiError('验证错误', status);
  }

  if (status === 429) {
    throw new ApiError('请求过于频繁，请稍后重试', status);
  }

  if (status >= 500) {
    throw new ApiError('服务器错误，请稍后重试', status);
  }

  throw new ApiError(`API 错误: ${response.statusText}`, status);
}
```

- [ ] **Step 2: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/lib/api-client.ts
git commit -m "feat(cli): add API client wrapper"
```

---

### Task 7: 认证命令实现

**Files:**
- Create: `apps/cli/src/commands/auth.ts`
- Modify: `apps/cli/src/index.ts`

**Interfaces:**
- Consumes:
  - `deviceLogin(apiUrl)` from `../lib/auth-client.js`
  - `config.setAuth(tokens)`, `config.clearAuth()`, `config.getApiUrl()` from `../lib/config.js`
  - `createApiClient()`, `handleApiError()` from `../lib/api-client.js`
  - `formatOutput(data, json)` from `../lib/output.js`
  - `handleError(error, verbose)` from `../lib/errors.js`
- Produces:
  - `login` 命令：设备授权登录
  - `logout` 命令：清除本地凭据
  - `whoami` 命令：显示当前用户

- [ ] **Step 1: 创建 auth.ts**

```typescript
import { Command } from 'commander';
import { deviceLogin } from '../lib/auth-client.js';
import { config } from '../lib/config.js';
import { createApiClient, handleApiError } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError, AuthError } from '../lib/errors.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('登录到 openstarter 账户')
    .option('--api-url <url>', '指定 API 地址')
    .action(async (options) => {
      try {
        const apiUrl = options.apiUrl || config.getApiUrl();
        if (options.apiUrl) {
          config.setApiUrl(apiUrl);
        }

        const tokens = await deviceLogin(apiUrl);
        config.setAuth({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
        });

        console.log('\n✓ 登录成功！');
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command('logout')
    .description('登出并清除本地凭据')
    .action(() => {
      try {
        config.clearAuth();
        console.log('✓ 已登出');
      } catch (error) {
        handleError(error as Error, false);
      }
    });

  program
    .command('whoami')
    .description('显示当前登录的用户信息')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        const client = createApiClient();
        const response = await client.fetch('/api/profile');

        if (!response.ok) {
          handleApiError(response);
        }

        const data = await response.json();
        formatOutput(data, options.json);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });
}
```


- [ ] **Step 2: 更新 index.ts 注册命令**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';

const program = new Command();

program
  .name('openstarter')
  .description('Command-line interface for openstarter')
  .version('0.1.0');

registerAuthCommands(program);

program.parse();
```

- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: 测试帮助命令**

Run: `node apps/cli/dist/index.js --help`
Expected: 显示 login, logout, whoami 命令

- [ ] **Step 5: 测试登出命令**

Run: `node apps/cli/dist/index.js logout`
Expected: 显示 "✓ 已登出"

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src
git commit -m "feat(cli): add auth commands (login, logout, whoami)"
```

---

### Task 8: API Profile 端点

**Files:**
- Create: `packages/api/src/routes/profile.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Consumes:
  - Better Auth session 中间件
  - 数据库访问（通过 `@openstarter/db`）
- Produces:
  - `GET /api/profile` - 获取当前用户资料
  - `PATCH /api/profile` - 更新用户资料

- [ ] **Step 1: 检查现有 API 结构**

Run: `cat packages/api/src/index.ts | head -30`
Expected: 查看 Hono app 的初始化和路由挂载方式

- [ ] **Step 2: 创建 profile.ts**

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '@openstarter/auth';

const app = new Hono();

// 获取当前用户资料
app.get('/', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    createdAt: session.user.createdAt,
  });
});

// 更新用户资料
const updateSchema = z.object({
  name: z.string().optional(),
});

app.patch('/', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const validation = updateSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: 'Validation error', details: validation.error }, 422);
  }

  // 注意：这里需要根据实际的数据库操作来更新用户
  // 暂时返回成功消息，实际实现需要调用数据库更新
  const { name } = validation.data;

  return c.json({
    id: session.user.id,
    email: session.user.email,
    name: name || session.user.name,
    createdAt: session.user.createdAt,
  });
});

export default app;
```


- [ ] **Step 3: 挂载 profile 路由**

在 `packages/api/src/index.ts` 中添加导入和路由：

```typescript
import profile from './routes/profile.js';

// 在现有路由后添加
app.route('/api/profile', profile);
```

- [ ] **Step 4: 测试构建**

Run: `pnpm --filter @openstarter/api build`
Expected: 构建成功，无类型错误

- [ ] **Step 5: 测试类型检查**

Run: `pnpm check-types`
Expected: 所有包类型检查通过

- [ ] **Step 6: Commit**

```bash
git add packages/api/src
git commit -m "feat(api): add profile endpoints"
```

---

### Task 9: 设备授权验证页面

**Files:**
- Create: `apps/web/src/routes/_auth-pages/device.tsx`

**Interfaces:**
- Consumes:
  - Better Auth Device Authorization API
  - TanStack Router
- Produces:
  - `/device` 页面 - 用户输入设备代码并授权

- [ ] **Step 1: 创建 device.tsx**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { auth } from '@openstarter/auth/client';

export const Route = createFileRoute('/_auth-pages/device')({
  component: DeviceAuthPage,
});

function DeviceAuthPage() {
  const [userCode, setUserCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证设备代码
      const response = await fetch('/api/auth/device/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: userCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '验证失败');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-6 rounded-lg border p-8 text-center">
          <div className="text-6xl">✓</div>
          <h1 className="text-2xl font-bold">授权成功！</h1>
          <p className="text-muted-foreground">
            您可以关闭此页面并返回终端继续操作。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">设备授权</h1>
          <p className="text-muted-foreground">
            请输入命令行终端显示的授权码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="userCode" className="block text-sm font-medium">
              授权码
            </label>
            <input
              id="userCode"
              type="text"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              placeholder="ABCD-1234"
              className="mt-1 block w-full rounded-md border px-3 py-2"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '验证中...' : '授权'}
          </button>
        </form>
      </div>
    </div>
  );
}
```


- [ ] **Step 2: 测试构建**

Run: `pnpm --filter web build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: 测试开发服务器**

Run: `pnpm --filter web dev`
Expected: 启动成功，访问 http://localhost:3000/device 可以看到页面

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_auth-pages/device.tsx
git commit -m "feat(web): add device authorization page"
```

---

### Task 10: Profile 命令实现

**Files:**
- Create: `apps/cli/src/commands/profile.ts`
- Modify: `apps/cli/src/index.ts`

**Interfaces:**
- Consumes:
  - `config.isAuthenticated()` from `../lib/config.js`
  - `createApiClient()`, `handleApiError()` from `../lib/api-client.js`
  - `formatOutput()` from `../lib/output.js`
  - `handleError()`, `AuthError` from `../lib/errors.js`
- Produces:
  - `profile` 命令：查看个人资料
  - `profile:update` 命令：更新个人资料

- [ ] **Step 1: 创建 profile.ts**

```typescript
import { Command } from 'commander';
import { config } from '../lib/config.js';
import { createApiClient, handleApiError } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError, AuthError } from '../lib/errors.js';

export function registerProfileCommands(program: Command): void {
  program
    .command('profile')
    .description('查看个人资料')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        const client = createApiClient();
        const response = await client.fetch('/api/profile');

        if (!response.ok) {
          handleApiError(response);
        }

        const data = await response.json();
        formatOutput(data, options.json);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });

  program
    .command('profile:update')
    .description('更新个人资料')
    .option('--name <name>', '更新显示名称')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        if (!options.name) {
          throw new Error('请至少提供一个更新选项 (--name)');
        }

        const client = createApiClient();
        const response = await client.fetch('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({ name: options.name }),
        });

        if (!response.ok) {
          handleApiError(response);
        }

        console.log('✓ 个人资料已更新');
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });
}
```

- [ ] **Step 2: 更新 index.ts 注册命令**

在 `apps/cli/src/index.ts` 中添加导入和注册：

```typescript
import { registerProfileCommands } from './commands/profile.js';

// 在 registerAuthCommands(program) 后添加
registerProfileCommands(program);
```


- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: 测试帮助命令**

Run: `node apps/cli/dist/index.js --help`
Expected: 显示 profile 和 profile:update 命令

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src
git commit -m "feat(cli): add profile commands"
```

---

### Task 11: Notes API 端点（示例数据资源）

**Files:**
- Create: `packages/api/src/routes/notes.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Consumes:
  - Better Auth session
  - 内存存储（简化实现，生产环境应使用数据库）
- Produces:
  - `GET /api/notes` - 列出笔记
  - `GET /api/notes/:id` - 获取单个笔记
  - `POST /api/notes` - 创建笔记

- [ ] **Step 1: 创建 notes.ts**

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '@openstarter/auth';

const app = new Hono();

// 简单的内存存储（示例，生产环境应使用数据库）
interface Note {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const notes: Note[] = [];
let noteIdCounter = 1;

// 列出笔记
app.get('/', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = Number(c.req.query('limit')) || 10;
  const userNotes = notes
    .filter((note) => note.userId === session.user.id)
    .slice(0, limit);

  return c.json(userNotes);
});

// 获取单个笔记
app.get('/:id', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const note = notes.find(
    (n) => n.id === c.req.param('id') && n.userId === session.user.id,
  );

  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
  }

  return c.json(note);
});

// 创建笔记
const createSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

app.post('/', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const validation = createSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: 'Validation error', details: validation.error }, 422);
  }

  const { name, description } = validation.data;
  const now = new Date().toISOString();
  const note: Note = {
    id: `note_${noteIdCounter++}`,
    userId: session.user.id,
    name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
  };

  notes.push(note);

  return c.json(note, 201);
});

export default app;
```


- [ ] **Step 2: 挂载 notes 路由**

在 `packages/api/src/index.ts` 中添加：

```typescript
import notes from './routes/notes.js';

// 在现有路由后添加
app.route('/api/notes', notes);
```

- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/api build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: Commit**

```bash
git add packages/api/src
git commit -m "feat(api): add notes CRUD endpoints"
```

---

### Task 12: Data 命令实现

**Files:**
- Create: `apps/cli/src/commands/data.ts`
- Modify: `apps/cli/src/index.ts`

**Interfaces:**
- Consumes:
  - `config.isAuthenticated()` from `../lib/config.js`
  - `createApiClient()`, `handleApiError()` from `../lib/api-client.js`
  - `formatOutput()` from `../lib/output.js`
  - `handleError()`, `AuthError` from `../lib/errors.js`
- Produces:
  - `list` 命令：列出笔记
  - `get <id>` 命令：获取单个笔记
  - `create` 命令：创建笔记

- [ ] **Step 1: 创建 data.ts**

```typescript
import { Command } from 'commander';
import { config } from '../lib/config.js';
import { createApiClient, handleApiError } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError, AuthError } from '../lib/errors.js';

export function registerDataCommands(program: Command): void {
  program
    .command('list')
    .description('列出笔记')
    .option('--limit <n>', '限制返回数量', '10')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        const client = createApiClient();
        const url = `/api/notes?limit=${options.limit}`;
        const response = await client.fetch(url);

        if (!response.ok) {
          handleApiError(response);
        }

        const data = await response.json();
        formatOutput(data, options.json);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });

  program
    .command('get')
    .description('获取单个笔记')
    .argument('<id>', '笔记 ID')
    .option('--json', '以 JSON 格式输出')
    .action(async (id, options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        const client = createApiClient();
        const response = await client.fetch(`/api/notes/${id}`);

        if (!response.ok) {
          handleApiError(response);
        }

        const data = await response.json();
        formatOutput(data, options.json);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });

  program
    .command('create')
    .description('创建新笔记')
    .requiredOption('--name <name>', '笔记名称')
    .option('--description <desc>', '笔记描述')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          throw new AuthError('未登录，请先运行 openstarter login');
        }

        const client = createApiClient();
        const response = await client.fetch('/api/notes', {
          method: 'POST',
          body: JSON.stringify({
            name: options.name,
            description: options.description,
          }),
        });

        if (!response.ok) {
          handleApiError(response);
        }

        const data = await response.json();
        console.log(`✓ 已创建笔记: ${data.id}`);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });
}
```


- [ ] **Step 2: 更新 index.ts 注册命令**

在 `apps/cli/src/index.ts` 中添加：

```typescript
import { registerDataCommands } from './commands/data.js';

// 在现有命令注册后添加
registerDataCommands(program);
```

- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: 测试帮助命令**

Run: `node apps/cli/dist/index.js --help`
Expected: 显示 list, get, create 命令

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src
git commit -m "feat(cli): add data commands (list, get, create)"
```

---

### Task 13: Status API 端点

**Files:**
- Create: `packages/api/src/routes/status.ts`
- Modify: `packages/api/src/index.ts`

**Interfaces:**
- Consumes: 无（公开端点）
- Produces:
  - `GET /api/status` - 系统状态信息

- [ ] **Step 1: 创建 status.ts**

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  return c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

export default app;
```

- [ ] **Step 2: 挂载 status 路由**

在 `packages/api/src/index.ts` 中添加：

```typescript
import status from './routes/status.js';

// 在现有路由后添加
app.route('/api/status', status);
```

- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/api build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: Commit**

```bash
git add packages/api/src
git commit -m "feat(api): add status endpoint"
```

---

### Task 14: Status 命令实现

**Files:**
- Create: `apps/cli/src/commands/status.ts`
- Modify: `apps/cli/src/index.ts`

**Interfaces:**
- Consumes:
  - `config.getApiUrl()`, `config.isAuthenticated()` from `../lib/config.js`
  - `createApiClient()`, `handleApiError()` from `../lib/api-client.js`
  - `formatOutput()` from `../lib/output.js`
  - `handleError()` from `../lib/errors.js`
- Produces:
  - `status` 命令：检查 API 连接和服务状态
  - `info` 命令：显示 CLI 版本和配置

- [ ] **Step 1: 创建 status.ts**

```typescript
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../lib/config.js';
import { createApiClient, handleApiError } from '../lib/api-client.js';
import { formatOutput } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPackageVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

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
        const response = await client.fetch('/api/status');
        const latency = Date.now() - startTime;

        if (!response.ok) {
          handleApiError(response);
        }

        const statusData = await response.json();

        const result = {
          api: apiUrl,
          status: statusData.status === 'ok' ? '✓ Connected' : '✗ Error',
          latency: `${latency}ms`,
          version: statusData.version,
          authenticated: isAuthenticated ? '✓' : '✗',
        };

        formatOutput(result, options.json);
      } catch (error) {
        handleError(error as Error, options.verbose || false);
      }
    });

  program
    .command('info')
    .description('显示 CLI 版本和配置信息')
    .action(() => {
      try {
        const version = getPackageVersion();
        const apiUrl = config.getApiUrl();
        const isAuthenticated = config.isAuthenticated();

        const info = {
          'CLI Version': version,
          'API URL': apiUrl,
          'Config': '~/.openstarter/config.json',
          'Logged in': isAuthenticated ? 'Yes' : 'No',
        };

        formatOutput(info, false);
      } catch (error) {
        handleError(error as Error, false);
      }
    });
}
```


- [ ] **Step 2: 更新 index.ts 注册命令**

在 `apps/cli/src/index.ts` 中添加：

```typescript
import { registerStatusCommands } from './commands/status.js';

// 在现有命令注册后添加
registerStatusCommands(program);
```

- [ ] **Step 3: 测试构建**

Run: `pnpm --filter @openstarter/cli build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: 测试 info 命令**

Run: `node apps/cli/dist/index.js info`
Expected: 显示 CLI 版本和配置信息

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src
git commit -m "feat(cli): add status and info commands"
```

---

### Task 15: 端到端集成测试

**Files:**
- 无新文件

**Interfaces:**
- Consumes: 所有已实现的功能
- Produces: 验证完整的 CLI 工作流程

- [ ] **Step 1: 启动 web 开发服务器**

Run: `pnpm --filter web dev`
Expected: 服务器启动在 http://localhost:3000

- [ ] **Step 2: 创建测试用户（如果需要）**

Run: `pnpm seed:admin` 或在浏览器注册测试用户
Expected: 测试用户创建成功

- [ ] **Step 3: 测试 status 命令（无需认证）**

Run: `node apps/cli/dist/index.js status --api-url http://localhost:3000`
Expected: 显示 API 连接状态

- [ ] **Step 4: 测试 login 命令**

Run: `node apps/cli/dist/index.js login --api-url http://localhost:3000`
Expected: 
- 显示验证 URL 和用户代码
- 在浏览器访问 http://localhost:3000/device
- 输入显示的代码并授权
- CLI 显示 "✓ 登录成功！"

- [ ] **Step 5: 测试 whoami 命令**

Run: `node apps/cli/dist/index.js whoami`
Expected: 显示当前用户信息

- [ ] **Step 6: 测试 profile 命令**

Run: `node apps/cli/dist/index.js profile`
Expected: 显示用户资料

- [ ] **Step 7: 测试 create 命令**

Run: `node apps/cli/dist/index.js create --name "Test Note" --description "Testing CLI"`
Expected: 显示 "✓ 已创建笔记: note_1"

- [ ] **Step 8: 测试 list 命令**

Run: `node apps/cli/dist/index.js list`
Expected: 显示笔记列表，包含刚创建的笔记

- [ ] **Step 9: 测试 get 命令**

Run: `node apps/cli/dist/index.js get note_1`
Expected: 显示笔记详情

- [ ] **Step 10: 测试 JSON 输出**

Run: `node apps/cli/dist/index.js list --json`
Expected: JSON 格式的笔记列表

- [ ] **Step 11: 测试 logout 命令**

Run: `node apps/cli/dist/index.js logout`
Expected: 显示 "✓ 已登出"

- [ ] **Step 12: 验证登出后无法访问需认证的命令**

Run: `node apps/cli/dist/index.js whoami`
Expected: 错误提示 "未登录，请先运行 openstarter login"，退出码 2

- [ ] **Step 13: 记录测试结果**

创建测试日志文件记录所有测试结果
Expected: 所有测试通过

---

### Task 16: CLI README 文档

**Files:**
- Create: `apps/cli/README.md`

**Interfaces:**
- Consumes: 无
- Produces: CLI 使用文档

- [ ] **Step 1: 创建 README.md**

```markdown
# @openstarter/cli

Command-line interface for openstarter.

## Installation

**Global installation:**

\`\`\`bash
npm install -g @openstarter/cli
\`\`\`

**Or use with npx (no installation required):**

\`\`\`bash
npx @openstarter/cli <command>
\`\`\`

## Quick Start

\`\`\`bash
# Login to your account
openstarter login

# View your profile
openstarter whoami

# List notes
openstarter list

# Create a new note
openstarter create --name "My First Note"

# Check API status
openstarter status
\`\`\`

## Commands

### Authentication

- \`openstarter login\` - Login using device authorization
- \`openstarter logout\` - Logout and clear credentials
- \`openstarter whoami\` - Show current user info

### Profile

- \`openstarter profile\` - View your profile
- \`openstarter profile:update --name <name>\` - Update your profile

### Data Operations

- \`openstarter list [--limit <n>]\` - List notes
- \`openstarter get <id>\` - Get note details
- \`openstarter create --name <name> [--description <desc>]\` - Create a note

### System

- \`openstarter status\` - Check API connection
- \`openstarter info\` - Show CLI version and config

## Global Options

- \`--api-url <url>\` - Override default API URL
- \`--json\` - Output in JSON format
- \`--verbose, -v\` - Show detailed logs
- \`--help, -h\` - Show help
- \`--version, -V\` - Show version

## Configuration

Configuration is stored in \`~/.openstarter/config.json\`.

Default API URL: \`https://app.openstarter.dev\`

## Authentication Flow

The CLI uses OAuth 2.0 Device Authorization Grant:

1. Run \`openstarter login\`
2. Visit the displayed URL in your browser
3. Enter the code shown in terminal
4. Authorize the device
5. CLI automatically completes login

## Examples

\`\`\`bash
# Login to a local dev server
openstarter login --api-url http://localhost:3000

# Create a note and get JSON output
openstarter create --name "Important" --description "Remember this" --json

# List with custom limit
openstarter list --limit 5

# Check status in JSON format
openstarter status --json
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Link for local testing
pnpm link --global
\`\`\`

## Exit Codes

- \`0\` - Success
- \`1\` - General error
- \`2\` - Authentication error
- \`3\` - Network error
- \`4\` - Configuration error

## License

MIT
\`\`\`


- [ ] **Step 2: Commit**

```bash
git add apps/cli/README.md
git commit -m "docs(cli): add CLI README"
```

---

### Task 17: 主项目 README 更新

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 现有 README 结构
- Produces: 添加 CLI 信息到主项目文档

- [ ] **Step 1: 读取现有 README**

Run: `cat README.md | grep -A 20 "What's in the box"`
Expected: 查看现有功能列表结构

- [ ] **Step 2: 更新功能列表**

在 "What's in the box" 表格中的 Desktop 行后添加：

```markdown
| CLI          | Terminal-based command-line interface with device auth  |
```

- [ ] **Step 3: 更新可用脚本部分**

在 "Available scripts" 部分添加：

```markdown
- `pnpm dev:cli` — develop the CLI in watch mode
- `pnpm build:cli` — build the CLI for distribution
```

- [ ] **Step 4: 添加 CLI 快速开始说明（可选）**

在适当位置添加：

```markdown
### CLI

Install globally or use with npx:

\`\`\`bash
npm install -g @openstarter/cli
openstarter login
openstarter whoami
\`\`\`

See [apps/cli/README.md](./apps/cli/README.md) for full documentation.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add CLI to main README"
```

---

### Task 18: 最终验证和清理

**Files:**
- 无新文件

**Interfaces:**
- Consumes: 所有已实现的功能
- Produces: 验证项目整体质量

- [ ] **Step 1: 运行全局类型检查**

Run: `pnpm check-types`
Expected: 所有包类型检查通过，无错误

- [ ] **Step 2: 运行 Biome 代码检查**

Run: `pnpm ultracite:check`
Expected: 代码符合 ultracite 规范，无错误

- [ ] **Step 3: 构建所有包**

Run: `pnpm build`
Expected: 所有包构建成功

- [ ] **Step 4: 测试 CLI 打包体积**

Run: `du -sh apps/cli/dist`
Expected: 打包后体积 < 5MB

- [ ] **Step 5: 测试 CLI 启动时间**

Run: `time node apps/cli/dist/index.js --version`
Expected: 启动时间 < 100ms

- [ ] **Step 6: 验证所有命令帮助文本**

Run: `node apps/cli/dist/index.js --help`
Expected: 所有命令都有清晰的描述

- [ ] **Step 7: 创建 Git tag（可选）**

Run: `git tag -a cli-v0.1.0 -m "CLI MVP release"`
Expected: Tag 创建成功

- [ ] **Step 8: 最终 Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification for CLI v0.1.0"
```

---

## 实现完成检查清单

完成所有任务后，验证以下成功标准：

- [ ] 用户可以通过 `npm install -g @openstarter/cli` 全局安装（本地测试用 `pnpm link`）
- [ ] 用户可以通过 `npx @openstarter/cli` 直接运行
- [ ] 用户可以完成完整的登录流程（设备授权）
- [ ] 用户可以查看和更新个人资料
- [ ] 用户可以执行基本的数据操作（列出、查看、创建）
- [ ] 用户可以检查系统状态和连接性
- [ ] 所有命令都有清晰的错误消息
- [ ] 支持 `--json` 输出用于脚本集成
- [ ] CLI 启动时间 < 100ms
- [ ] 打包后的文件大小 < 5MB
- [ ] 代码通过 Biome 检查
- [ ] 所有包类型检查通过

