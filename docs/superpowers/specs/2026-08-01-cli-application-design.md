# CLI 应用设计文档

**日期：** 2026-08-01  
**状态：** 已批准  
**版本：** 1.0

## 概述

为 openstarter 项目添加一个独立的命令行工具（CLI），使终端用户能够通过命令行界面使用 SaaS 产品的核心功能。这是一个最小化验证版本（MVP），重点验证架构可行性并提供基础功能。

## 目标

- 为终端用户提供命令行访问产品功能的能力
- 使用 Better Auth Device Authorization 提供安全的认证机制
- 创建独立、可发布的 npm 包，支持全局安装和 npx 运行
- 遵循传统命令行风格，参数驱动，适合脚本化和自动化场景

## 非目标

- 不是开发者工具或项目脚手架工具
- 不直接访问数据库，所有操作通过 API
- 本版本不包含交互式提示（future enhancement）

## 架构设计

### 1. 整体架构

采用**完全独立的 CLI 应用**架构：

- 独立的 `apps/cli` 包，有自己的构建和发布流程
- 通过 HTTP 调用 `@openstarter/api` 的公开端点
- 使用 Better Auth Device Authorization 进行用户认证
- 凭据存储在用户本地配置文件（`~/.openstarter/config.json`）
- 不依赖数据库，完全基于 API 交互

### 2. 依赖关系图

```
apps/cli
  ├─ commander (CLI 框架)
  ├─ conf (配置管理)
  ├─ hono/client (类型安全的 RPC 客户端)
  └─ @openstarter/shared (可选，共享类型)

通过 HTTP 调用
  ↓
packages/api (Hono 后端)
  ├─ Better Auth Device Authorization 端点
  └─ 业务 API 端点

依赖更新
  ↓
packages/auth
  └─ 添加 @better-auth/device 插件

apps/web
  └─ 添加设备验证页面 (/device)
```

### 3. 认证流程（Device Authorization Flow）

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│   CLI   │                    │   API   │                    │ Browser │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                              │                              │
     │  1. POST /api/auth/device/code                             │
     │────────────────────────────>│                              │
     │                              │                              │
     │  2. {device_code, user_code, verification_uri}             │
     │<────────────────────────────│                              │
     │                              │                              │
     │  3. 显示验证 URL 和代码       │                              │
     │  "访问 https://app.example.com/device"                     │
     │  "输入代码: ABCD-1234"       │                              │
     │                              │                              │
     │                              │   4. 用户访问验证页面          │
     │                              │<─────────────────────────────│
     │                              │                              │
     │                              │   5. 用户输入 user_code       │
     │                              │      并授权                   │
     │                              │<─────────────────────────────│
     │                              │                              │
     │  6. 轮询 POST /api/auth/device/token (每 5 秒)             │
     │────────────────────────────>│                              │
     │  (pending...)                │                              │
     │────────────────────────────>│                              │
     │                              │                              │
     │  7. {access_token, refresh_token, expires_in}              │
     │<────────────────────────────│                              │
     │                              │                              │
     │  8. 保存到 ~/.openstarter/config.json                      │
     │                              │                              │
```

## 项目结构

```
apps/cli/
├── src/
│   ├── index.ts              # CLI 入口，定义 commander 程序
│   ├── commands/             # 命令实现
│   │   ├── auth.ts           # login, logout, whoami
│   │   ├── profile.ts        # profile, profile:update
│   │   ├── data.ts           # list, get, create
│   │   └── status.ts         # status, info
│   ├── lib/
│   │   ├── api-client.ts     # Hono RPC 客户端封装
│   │   ├── auth-client.ts    # Device Authorization 客户端
│   │   ├── config.ts         # 配置管理（~/.openstarter/）
│   │   └── output.ts         # 输出格式化（JSON/表格）
│   └── types.ts              # 共享类型定义
├── package.json
├── tsconfig.json
└── tsup.config.ts            # 打包配置
```

## 命令设计

### 1. 认证命令

#### `openstarter login`
登录到 openstarter 账户。

**选项：**
- `--api-url <url>` - 指定 API 地址（覆盖默认值）

**流程：**
1. 请求设备代码（`POST /api/auth/device/code`）
2. 显示验证 URL 和用户代码
3. 轮询 token 端点（`POST /api/auth/device/token`）
4. 保存 access_token 和 refresh_token 到本地配置
5. 显示成功消息

**示例：**
```bash
$ openstarter login
请访问: https://app.example.com/device
输入代码: ABCD-1234
等待授权...
✓ 登录成功！欢迎，john@example.com
```

#### `openstarter logout`
登出并清除本地凭据。

**流程：**
1. 删除本地配置中的 auth 信息
2. 显示确认消息

**示例：**
```bash
$ openstarter logout
✓ 已登出
```

#### `openstarter whoami`
显示当前登录的用户信息。

**选项：**
- `--json` - 以 JSON 格式输出

**示例：**
```bash
$ openstarter whoami
Logged in as: john@example.com
User ID: usr_abc123
Plan: Pro

$ openstarter whoami --json
{"id":"usr_abc123","email":"john@example.com","plan":"pro"}
```

### 2. 用户信息命令

#### `openstarter profile`
查看个人资料。

**选项：**
- `--json` - 以 JSON 格式输出

**示例：**
```bash
$ openstarter profile
Name: John Doe
Email: john@example.com
Plan: Pro
Created: 2026-01-15
```

#### `openstarter profile:update`
更新个人资料。

**选项：**
- `--name <name>` - 更新显示名称
- `--email <email>` - 更新电子邮件（需要验证）

**示例：**
```bash
$ openstarter profile:update --name "John Smith"
✓ 个人资料已更新
```

### 3. 数据操作命令

> **实现说明：** 以下命令使用通用的"资源"概念作为示例。在实际实现时，应该根据 openstarter 的具体业务模型来定义资源类型。由于 openstarter 是一个 SaaS 启动模板，可以选择以下任一方向：
> 
> 1. 如果用于演示，可以创建一个简单的 "notes" 或 "bookmarks" 资源
> 2. 如果面向实际产品，应该基于产品的核心数据模型（例如：如果是项目管理工具，资源就是 projects；如果是任务工具，资源就是 tasks）
> 
> 下面的命令使用 `list/get/create` 作为通用模式，实现时命令名称应该更具体（如 `notes:list`, `projects:get` 等）。

#### `openstarter list`
列出用户的资源。

**选项：**
- `--limit <n>` - 限制返回数量（默认：10）
- `--json` - 以 JSON 格式输出

**示例：**
```bash
$ openstarter list
ID              Name                Created
res_001         My First Project    2026-07-15
res_002         Demo App            2026-07-20
res_003         Test Project        2026-07-28
```

#### `openstarter get <id>`
获取单个资源的详细信息。

**参数：**
- `<id>` - 资源 ID

**选项：**
- `--json` - 以 JSON 格式输出

**示例：**
```bash
$ openstarter get res_001
ID: res_001
Name: My First Project
Description: A sample project for testing
Created: 2026-07-15
Updated: 2026-07-28
```

#### `openstarter create`
创建新资源。

**选项：**
- `--name <name>` - 资源名称（必需）
- `--description <desc>` - 资源描述（可选）

**示例：**
```bash
$ openstarter create --name "New Project" --description "Test project"
✓ 已创建资源: res_004
```

### 4. 系统状态命令

#### `openstarter status`
检查 API 连接和服务状态。

**选项：**
- `--json` - 以 JSON 格式输出

**示例：**
```bash
$ openstarter status
API: https://api.example.com
Status: ✓ Connected
Latency: 45ms
Version: 1.2.3
Auth: ✓ Authenticated as john@example.com
```

#### `openstarter info`
显示 CLI 版本和配置信息。

**示例：**
```bash
$ openstarter info
CLI Version: 0.1.0
API URL: https://api.example.com
Config: ~/.openstarter/config.json
Logged in: Yes
User: john@example.com
```

### 5. 全局选项

所有命令支持以下全局选项：

- `--api-url <url>` - 覆盖默认 API 地址
- `--json` - 以 JSON 格式输出（默认是人类可读格式）
- `--verbose, -v` - 显示详细日志
- `--help, -h` - 显示帮助信息
- `--version, -V` - 显示版本号

## 技术实现

### 1. 配置管理（`lib/config.ts`）

**使用 `conf` 库管理配置文件。**

**存储位置：** `~/.openstarter/config.json`

**配置结构：**
```typescript
interface CliConfig {
  apiUrl: string;              // API 基础地址
  auth?: {
    accessToken: string;       // 访问令牌
    refreshToken: string;      // 刷新令牌
    expiresAt: number;         // 过期时间戳（毫秒）
  };
}
```

**API 设计：**
```typescript
export class ConfigManager {
  private store: Conf<CliConfig>;

  getConfig(): CliConfig;
  setAuth(tokens: AuthTokens): void;
  clearAuth(): void;
  isAuthenticated(): boolean;
  getApiUrl(): string;
  setApiUrl(url: string): void;
}
```

### 2. API 客户端（`lib/api-client.ts`）

**使用 Hono RPC client 实现类型安全的 API 调用。**

```typescript
import { hc } from 'hono/client';
import type { AppType } from '@openstarter/api';

export function createApiClient(config: CliConfig) {
  const client = hc<AppType>(config.apiUrl, {
    headers: config.auth 
      ? { Authorization: `Bearer ${config.auth.accessToken}` }
      : {},
  });

  return {
    // 包装所有 API 调用
    // 自动处理错误（401、网络错误等）
    async request<T>(fn: (client: typeof client) => Promise<T>): Promise<T> {
      try {
        return await fn(client);
      } catch (error) {
        // 统一错误处理
        handleApiError(error);
      }
    }
  };
}
```

**错误处理：**
- 401 Unauthorized → 清除本地 token，提示用户重新登录
- 403 Forbidden → 显示权限不足消息
- 404 Not Found → 显示资源不存在
- 网络错误 → 提示检查网络连接和 API URL
- 5xx 错误 → 提示服务器错误，稍后重试

### 3. 认证客户端（`lib/auth-client.ts`）

**实现 Device Authorization Flow。**

```typescript
interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function deviceLogin(apiUrl: string): Promise<TokenResponse> {
  // 1. 请求 device code
  const deviceCodeResponse = await requestDeviceCode(apiUrl);
  
  // 2. 显示给用户
  console.log(`请访问: ${deviceCodeResponse.verification_uri}`);
  console.log(`输入代码: ${deviceCodeResponse.user_code}`);
  console.log('\n等待授权...');
  
  // 3. 轮询 token 端点
  const tokens = await pollForToken(
    apiUrl,
    deviceCodeResponse.device_code,
    deviceCodeResponse.interval,
    deviceCodeResponse.expires_in
  );
  
  return tokens;
}

async function pollForToken(
  apiUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number
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
        continue; // 继续轮询
      }
      
      throw new Error(error.error_description || error.error);
    } catch (error) {
      // 处理网络错误，继续轮询
      if (error.message !== 'authorization_pending') {
        console.error('轮询错误:', error);
      }
    }
  }

  throw new Error('授权超时');
}
```

### 4. 输出格式化（`lib/output.ts`）

**提供两种输出格式：人类可读和 JSON。**

```typescript
export function formatOutput(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    // 格式化为表格或友好的文本输出
    formatHumanReadable(data);
  }
}

function formatHumanReadable(data: unknown): void {
  // 根据数据类型选择合适的显示方式
  // - 对象：键值对形式
  // - 数组：表格形式
  // - 简单值：直接输出
}
```

### 5. 打包配置（`tsup.config.ts`）

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

### 6. package.json 配置

```json
{
  "name": "@openstarter/cli",
  "version": "0.1.0",
  "description": "Command-line interface for openstarter",
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
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 后端支持

### 1. Better Auth 配置更新（`packages/auth`）

**添加 Device Authorization 插件：**

```typescript
// packages/auth/src/index.ts
import { betterAuth } from "better-auth";
import { deviceAuthorization } from "@better-auth/device";

export const auth = betterAuth({
  database: /* ... */,
  secret: /* ... */,
  
  plugins: [
    deviceAuthorization({
      userCodeLength: 8,          // ABCD-1234 格式
      deviceCodeLength: 32,       // 内部设备代码长度
      expiresIn: 600,             // 10 分钟过期
      interval: 5,                // 轮询间隔 5 秒
    }),
    // ... 其他现有插件
  ],
});
```

**自动提供的端点：**
- `POST /api/auth/device/code` - 请求设备代码
- `POST /api/auth/device/token` - 轮询获取 token
- `GET /api/auth/device/verify` - 验证页面数据 API

### 2. Web 应用更新（`apps/web`）

**添加设备验证页面：**

```typescript
// apps/web/src/routes/_auth-pages/device.tsx
export default function DeviceVerificationPage() {
  // 1. 显示输入框让用户输入 user_code
  // 2. 调用 Better Auth 验证 API
  // 3. 如果有效，显示授权确认
  // 4. 用户确认后完成授权流程
  // 5. 显示成功消息
}
```

### 3. API 端点更新（`packages/api`）

**需要添加的业务端点：**

```typescript
// packages/api/src/routes/profile.ts
app.get('/api/profile', async (c) => {
  // 获取当前用户资料
});

app.patch('/api/profile', async (c) => {
  // 更新用户资料
});

// packages/api/src/routes/resources.ts
app.get('/api/resources', async (c) => {
  // 列出用户的资源（分页）
});

app.get('/api/resources/:id', async (c) => {
  // 获取单个资源详情
});

app.post('/api/resources', async (c) => {
  // 创建新资源
});

// packages/api/src/routes/status.ts
app.get('/api/status', async (c) => {
  // 系统状态和健康检查
});
```

**认证中间件：**

所有需要认证的端点使用 Better Auth 中间件：

```typescript
import { authMiddleware } from '@openstarter/auth';

app.use('/api/profile', authMiddleware);
app.use('/api/resources/*', authMiddleware);
```

## 错误处理

### 1. CLI 错误处理

**退出码规范：**
- `0` - 成功
- `1` - 一般错误
- `2` - 认证错误（未登录、token 过期）
- `3` - 网络错误（无法连接 API）
- `4` - 配置错误（无效的配置或参数）

**错误消息格式：**

```typescript
function handleError(error: Error, verbose: boolean): never {
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
  
  // 一般错误
  console.error('❌ 错误:', error.message);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
}
```

### 2. API 错误映射

| HTTP 状态码 | 错误类型 | CLI 处理 |
|------------|---------|---------|
| 401 | Unauthorized | 清除本地 token，提示重新登录 |
| 403 | Forbidden | 显示权限不足消息 |
| 404 | Not Found | 显示资源不存在 |
| 422 | Validation Error | 显示验证错误详情 |
| 429 | Rate Limit | 显示速率限制消息，建议稍后重试 |
| 5xx | Server Error | 显示服务器错误，建议稍后重试 |
| Network | Connection Failed | 检查网络连接和 API URL |

## 开发流程

### 1. 本地开发

```bash
# 进入 CLI 目录
cd apps/cli

# 安装依赖
pnpm install

# 开发模式（watch）
pnpm dev

# 构建
pnpm build

# 创建全局链接用于测试
pnpm link --global

# 测试命令
openstarter --help
openstarter login --api-url http://localhost:3000
openstarter whoami
```

### 2. 测试流程

```bash
# 1. 启动本地 web 服务器
pnpm --filter web dev

# 2. 在另一个终端测试 CLI
openstarter login --api-url http://localhost:3000
openstarter whoami
openstarter profile
openstarter list
openstarter create --name "Test"
openstarter status
```

### 3. 发布流程

```bash
# 1. 构建
pnpm --filter @openstarter/cli build

# 2. 版本管理
cd apps/cli
npm version patch  # 或 minor/major

# 3. 发布到 npm
pnpm publish

# 4. 提交 git
git add .
git commit -m "chore(cli): release v0.1.0"
git push
```

### 4. 使用方式

**全局安装：**
```bash
npm install -g @openstarter/cli
openstarter login
openstarter whoami
```

**npx 运行（无需安装）：**
```bash
npx @openstarter/cli login
npx @openstarter/cli whoami
```

## 实现顺序

建议按以下顺序实现：

### 阶段 1：基础设施
1. 创建 `apps/cli` 项目结构
2. 配置 `tsup` 和 `package.json`
3. 实现配置管理（`lib/config.ts`）
4. 实现基础 commander 框架（`src/index.ts`）

### 阶段 2：认证功能
1. 在 `packages/auth` 添加 Device Authorization 插件
2. 在 `apps/web` 添加设备验证页面
3. 实现认证客户端（`lib/auth-client.ts`）
4. 实现 `login`、`logout`、`whoami` 命令

### 阶段 3：API 集成
1. 实现 API 客户端（`lib/api-client.ts`）
2. 在 `packages/api` 添加业务端点
3. 实现用户信息命令（`profile`、`profile:update`）

### 阶段 4：数据操作
1. 实现数据操作命令（`list`、`get`、`create`）
2. 实现输出格式化（`lib/output.ts`）

### 阶段 5：系统功能
1. 实现系统状态命令（`status`、`info`）
2. 完善错误处理
3. 添加 `--json`、`--verbose` 等全局选项

### 阶段 6：测试和发布
1. 本地测试所有命令
2. 编写 README 文档
3. 发布到 npm
4. 更新主项目 README

## 未来增强

本设计是最小化验证版本，未来可以考虑：

1. **交互式模式** - 使用 `@clack/prompts` 提供更友好的交互体验
2. **更多命令** - 根据产品功能扩展命令集
3. **配置文件支持** - 支持项目级配置文件（`.openstarter.json`）
4. **Shell 补全** - 提供 bash/zsh 自动补全脚本
5. **彩色输出** - 使用 `chalk` 美化输出
6. **进度条** - 长时间操作显示进度
7. **批量操作** - 支持批量创建、更新、删除
8. **导入/导出** - 数据导入导出功能
9. **插件系统** - 允许第三方扩展命令
10. **离线模式** - 缓存部分数据以支持离线查询

## 依赖更新

### 新增依赖
- `apps/cli`: `commander`, `conf`, `hono/client`
- `packages/auth`: `@better-auth/device`（如果尚未包含）

### 版本要求
- Node.js >= 18.0.0
- TypeScript >= 5.0.0

## 成功标准

实现完成后，应该能够：

1. ✅ 用户可以通过 `npm install -g @openstarter/cli` 全局安装
2. ✅ 用户可以通过 `npx @openstarter/cli` 直接运行
3. ✅ 用户可以完成完整的登录流程（设备授权）
4. ✅ 用户可以查看和更新个人资料
5. ✅ 用户可以执行基本的数据操作（列出、查看、创建）
6. ✅ 用户可以检查系统状态和连接性
7. ✅ 所有命令都有清晰的错误消息
8. ✅ 支持 `--json` 输出用于脚本集成
9. ✅ CLI 启动时间 < 100ms（性能要求）
10. ✅ 打包后的文件大小 < 5MB（合理范围）

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| Better Auth Device Authorization 插件兼容性问题 | 高 | 在实现前验证插件与当前 Better Auth 版本兼容 |
| 用户不理解设备授权流程 | 中 | 提供清晰的提示信息和文档说明 |
| API 端点设计不当导致频繁调整 | 中 | 先设计 API 接口，获得反馈后再实现 |
| 配置文件损坏导致 CLI 无法使用 | 低 | 添加配置文件验证和修复机制 |
| 跨平台兼容性问题（Windows/Mac/Linux） | 低 | 使用 Node.js 标准 API，避免平台特定代码 |

## 参考资料

- [Better Auth Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization)
- [OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [Commander.js 文档](https://github.com/tj/commander.js)
- [Hono RPC 文档](https://hono.dev/guides/rpc)
- [Conf 配置管理](https://github.com/sindresorhus/conf)
