import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { db, getAuthAdapterProvider } from "@openstarter/db/server";
import { EmailTemplate } from "@openstarter/email";
import { sendEmail as deliverEmail, type SendEmailParams } from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n-web/server";
import { getAllConfigs } from "@openstarter/shared/config";
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";
import { betterAuth } from "better-auth/minimal";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import {
  admin,
  anonymous,
  bearer,
  deviceAuthorization,
  emailOTP,
  lastLoginMethod,
  magicLink,
  oneTap,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { MAGIC_LINK_EXPIRES_IN, OTP_EXPIRES_IN, REQUIRE_EMAIL_VERIFICATION } from "./auth.config";
import { authSchema, organizationTeams } from "./auth-database-schema";
import { createAuthEmailCallbacks, createChangeEmailOptions } from "./email-callbacks";
import { env } from "./env";
import { hooks } from "./hooks";
import { getAppUrl, getUrl, isLoopbackAppUrl } from "./lib/utils";
import { ac, ADMIN_ROLES, DEFAULT_ROLE, roles } from "./rbac";
import { AuthProvider, SocialProvider, VerificationType } from "./types";

// better-auth 的邮件回调契约要求返回 Promise<void>，而 @openstarter/email 的 sendEmail 返回
// 结构化 EmailSendResult（R22.3，供程序化调用方判断成败）。此轻量适配器丢弃返回值
// （better-auth 不消费该结果，且投递失败已在 sendEmail 内部经 logger 记录），
// 使既有 7 处邮件回调无需改写即满足返回类型契约——保留发信能力，叠加而非裁剪。
const sendEmail = async (params: SendEmailParams): Promise<void> => {
  await deliverEmail(params);
};

const emailCallbacks = createAuthEmailCallbacks(sendEmail);
const LOGIN_METHOD_BY_PATH = new Map<string, AuthProvider>([
  ["/magic-link/verify", AuthProvider.MAGIC_LINK],
  ["/passkey/verify-authentication", AuthProvider.PASSKEY],
  ["/sign-in/email-otp", AuthProvider.EMAIL_OTP],
  // 匿名登录与 Google One Tap 回调：默认 resolver 不识别这两个路径，
  // 显式映射使 last-used-method cookie 覆盖全部登录入口。
  ["/sign-in/anonymous", AuthProvider.ANONYMOUS],
  ["/one-tap/callback", AuthProvider.GOOGLE],
]) as Map<string, AuthProvider>;

// ─── 运行时配置读取（Runtime config-driven enablement）──────────────────────────
//
// 此前 OAuth provider 与无密码插件是否注册仅由 `env` 决定（client_id/secret 是否齐备），
// admin 后台的 `*_auth_enabled` / `magic_link_enabled` / `email_otp_enabled` 开关只用于前端
// 是否渲染按钮。这导致「开关关闭但 env 已配置」时后端登录通路仍可达，是行为回退。
//
// 下面在模块加载期读取 `getAllConfigs()`（环境变量 + DB 合并，带 1h 缓存），与 `env` **共同**
// 决定是否注册对应 provider / 插件：开关未开启或凭据缺失任一者不满足即跳过注册，
// 使「开关关闭」在后端真正生效（better-auth 对未注册 provider/plugin 的端点返回 404）。
//
// 注意：这是**启动期一次读取 + 单例构造**——与现有 env 驱动语义一致（关闭需重启进程方能解注册）。
// 管理员后台保存配置会失效 `getAllConfigs` 的缓存（见 `shared/config.ts`），
// 但已构造的 better-auth 单例不会重建；运行期切换仍由前端按公开配置决定是否展示按钮兜底。
// 将来如需运行期实时生效，需把 `auth` 改为按请求重建或加守卫中间件拦截已关闭端点。
const runtimeConfigs = await getAllConfigs();
const isEnabled = (key: string): boolean => runtimeConfigs[key] === "true";
const googleEnabled =
  isEnabled("google_auth_enabled") && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const githubEnabled =
  isEnabled("github_auth_enabled") && Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const appleEnabled =
  isEnabled("apple_auth_enabled") && Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);
const magicLinkEnabled = isEnabled("magic_link_enabled");
const emailOtpEnabled = isEnabled("email_otp_enabled");

const magicLinkExpiresIn = runtimeConfigs.magic_link_expires_in
  ? Number(runtimeConfigs.magic_link_expires_in)
  : MAGIC_LINK_EXPIRES_IN;
const otpExpiresIn = runtimeConfigs.email_otp_expires_in
  ? Number(runtimeConfigs.email_otp_expires_in)
  : OTP_EXPIRES_IN;

// ─── 部署面推导（Deployment-derived switches）────────────────────────────────
// 唯一事实源仍是 apps/web/.env 的 `VITE_APP_URL`。与部署环境绑定的开关都从它推导，
// 不再单独读 `NODE_ENV`：Worker 上 `NODE_ENV` 常常缺省，会把生产当开发处理
// （trustedOrigins 放开 localhost、better-auth 生产行为不生效）。
const appUrl = getAppUrl();
const isHttpsAppUrl = appUrl.startsWith("https://");
const allowLocalOrigins = isLoopbackAppUrl(appUrl);

// One Tap 的 audience 必须与客户端拿到的 client id 一致：DB 配置优先（它是公开配置的来源），
// env 仅作兜底。任一缺失或 Google provider 未注册时不挂载插件——否则回调会抛
// BAD_REQUEST: Google client ID is required。
const oneTapClientId = runtimeConfigs.google_client_id || env.GOOGLE_CLIENT_ID;
const oneTapEnabled =
  isEnabled("google_one_tap_enabled") && googleEnabled && Boolean(oneTapClientId);

export const auth = betterAuth({
  // 显式声明账户关联策略：只允许「provider 邮箱已验证 + 本地邮箱已验证」的隐式关联，
  // 不额外信任任何第三方 provider（trustedProviders 为空是默认值，此处写死以表达意图）。
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [],
    },
  },
  advanced: {
    cookiePrefix: "openstarter",
    // 跨站 state cookie（移动端深链回跳等）只在 https 下启用；http 本地调试保持默认
    // lax + 非 secure，否则浏览器会直接丢弃该 cookie，OAuth/Magic Link 回调丢 state。
    cookies: {
      state: {
        attributes: isHttpsAppUrl ? { sameSite: "none", secure: true } : {},
      },
    },
  },
  appName: "OpenStarter",
  // 显式传入而非依赖 better-auth 内部的 `BETTER_AUTH_URL` 嗅探：唯一事实源是
  // apps/web/.env 的 `VITE_APP_URL`（Worker 上由 wrangler vars 注入 process.env）。
  // 显式设置还能把 trustedOrigins 钉在真实域名上——baseURL 为空时 better-auth 会用
  // 请求自身推导可信来源，CSRF 原点校验形同放开。
  baseURL: appUrl,
  database: drizzleAdapter(db(), {
    provider: getAuthAdapterProvider(),
    schema: authSchema,
  }),
  databaseHooks: {
    user: hooks.user,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: emailCallbacks.sendResetPassword,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    // 由后台开关控制（默认发送，显式关闭才停）：开关此前只影响前端展示，改不到发信行为。
    sendOnSignUp: runtimeConfigs.email_verification_enabled !== "false",
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
  },
  logger: {
    log: (level, ...args) => logger[level](...args),
  },
  plugins: [
    // Magic Link 与 Email OTP 插件按 `*_enabled` 开关条件注册——开关关闭时插件不挂载，
    // 对应端点（/sign-in/magic-link、/sign-in/email-otp）随之不存在，避免「开关关闭后端仍可登录」。
    ...(magicLinkEnabled
      ? [
          magicLink({
            expiresIn: magicLinkExpiresIn,
            sendMagicLink: async ({ email, url }, ctx) =>
              sendEmail({
                locale: getLocaleFromRequest(ctx?.request),
                template: EmailTemplate.MAGIC_LINK,
                to: email,
                variables: {
                  url: getUrl({
                    request: ctx?.request,
                    type: VerificationType.MAGIC_LINK,
                    url,
                  }).toString(),
                },
              }),
          }),
        ]
      : []),
    ...(emailOtpEnabled
      ? [
          emailOTP({
            expiresIn: otpExpiresIn,
            sendVerificationOTP({ email, otp, type }, ctx) {
              if (type !== "sign-in") {
                /* Handle other types if you want to use OTP verification
                for other purposes (e.g. change email, delete account, etc.) */
                return Promise.resolve();
              }

              return sendEmail({
                locale: getLocaleFromRequest(ctx?.request),
                template: EmailTemplate.SIGN_IN_OTP,
                to: email,
                variables: {
                  otp,
                  url: getUrl({ request: ctx?.request }).toString(),
                },
              });
            },
          }),
        ]
      : []),
    passkey(),
    twoFactor(),
    anonymous(),
    // 用户/会话/封禁/冒充/角色管理全部交给 better-auth：`user.role` 是角色唯一载体
    // （支持逗号分隔多角色），代码内权限表（rbac/permissions.ts）与 `adminRoles` 共用
    // 同一组常量，避免后台授权与插件判定各说各话。
    admin({ adminRoles: [...ADMIN_ROLES], defaultRole: DEFAULT_ROLE }),
    organization({
      ac,
      organizationHooks: hooks.organization,
      roles,
      sendInvitationEmail: (
        { invitation, inviter, organization: invitedOrganization },
        request,
      ) => {
        const url = getUrl({
          request,
        });
        url.searchParams.set("invitationId", invitation.id);
        url.searchParams.set("email", invitation.email);

        return sendEmail({
          locale: getLocaleFromRequest(request),
          template: EmailTemplate.ORGANIZATION_INVITATION,
          to: invitation.email,
          variables: {
            inviter: inviter.user.name,
            organization: invitedOrganization.name,
            url: url.toString(),
          },
        });
      },
      teams: organizationTeams,
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => LOGIN_METHOD_BY_PATH.get(ctx.path) ?? null,
    }),
    // One Tap 依赖 socialProviders.google 提供 audience，故与 Google 登录同条件注册；
    // 关闭时不挂载，端点 404（此前无条件挂载会在回调时抛 "Google client ID is required"）。
    ...(oneTapEnabled && oneTapClientId ? [oneTap({ clientId: oneTapClientId })] : []),
    expo(),
    // 设备授权（RFC 8628）：CLI 登录经 POST /api/auth/device/code 取码 → 浏览器 /device 页输入
    // user_code 并 approve → CLI 轮询 /api/auth/device/token 拿会话 token（即 access_token，
    // 带 `.` 签名，满足下方 bearer requireSignature:true）。deviceCode 模型经 authSchema 注入。
    deviceAuthorization({
      deviceCodeLength: 32,
      expiresIn: "10m",
      interval: "5s",
      userCodeLength: 8,
      // better-auth 1.6.11 的 deviceAuthorizationOptionsSchema 将 `schema` 声明为
      // `z.custom(() => true)` 而未加 `.optional()`/`.default()`，导致缺省调用时
      // `parse(options)` 抛 ZodError(path:["schema"], expected "nonoptional")。
      // 插件内部 `mergeSchema(schema, options?.schema)` 对 falsy 入参直接返回默认 schema，
      // 故该字段本应是可选——传入 `{}` 满足校验且不重映射任何字段（drizzle 侧
      // authSchema.deviceCode 仍是规范的数据库模型，经顶层 drizzleAdapter 注入）。
      schema: {},
    }),
    // Bearer 转发（浏览器插件端会话桥接，见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md
    // §3.2/§4）：插件把 web 端的会话 cookie 值原样作为 Authorization: Bearer 头转发；
    // requireSignature: true 拒绝未签名的裸 token，正常路径（真实会话 cookie 值本就带签名）不受影响。
    bearer({ requireSignature: true }),
    // 负责把 Set-Cookie 转发给 TanStack Start 的收尾插件，必须是数组最后一项。
    tanstackStartCookies(),
  ],
  // 显式开启限流：better-auth 默认仅在 `NODE_ENV === "production"` 时生效，而 Worker 里
  // NODE_ENV 常常缺省，生产将完全没有频率限制（登录 / OTP / Magic Link / 匿名登录可被爆破）。
  // 注意默认 `storage: "memory"` 在 Workers 上按 isolate 独立计数；需要跨实例严格限流时，
  // 接入 secondaryStorage（KV/Upstash）并改为 storage: "secondary-storage"。
  rateLimit: {
    // 仅测试环境关闭：property test 会在同一 IP 上高并发打认证端点，限流会造成偶发失败。
    enabled: env.NODE_ENV !== NodeEnv.TEST,
    max: 100,
    window: 60,
  },
  session: {
    cookieCache: {
      enabled: true,
      // 采样自 cookie 的会话最多缓存 60s：5 分钟会让「注销会话 / 封禁 / 删号」在当前浏览器
      // 延迟 5 分钟生效，60s 在命中率与撤销时效之间取平衡。
      maxAge: 60,
    },
  },
  // 条件注册：仅当对应 OAuth 的 admin 开关开启且 env client id/secret 都齐备时才注册该 provider。
  // 开关关闭即解注册（端点 404），凭据缺失亦跳过，避免给 Better-Auth 传空字符串触发未配置告警。
  // 使用对象字面量 + 条件 spread，保留 Better-Auth 对 socialProviders 键集合的静态推断。
  socialProviders: {
    ...(googleEnabled
      ? {
          [SocialProvider.GOOGLE]: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(githubEnabled
      ? {
          [SocialProvider.GITHUB]: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(appleEnabled
      ? {
          [SocialProvider.APPLE]: {
            appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  trustedOrigins: [
    // 移动端深链回跳（Expo Router scheme，见 apps/mobile/app.config.ts）。
    // 与 expoClient({ scheme: "openstarter" }) 及 cookiePrefix 保持同名。
    "openstarter://",
    /* Needed only for Apple ID authentication */
    "https://appleid.apple.com",
    // 浏览器扩展页面自身的 origin：扩展以 Bearer 桥接会话，但请求带 credentials 时
    // 仍会走 origin 校验，需要显式信任。未配置 EXTENSION_ORIGIN 时退化为前缀匹配
    // （开发期 / 多构建 ID 可用）；发布后建议钉到具体扩展 ID，避免信任任意扩展。
    env.EXTENSION_ORIGIN || "chrome-extension://",
    // 本地调试来源只在 baseURL 本身是 loopback 时放开——不能用 NODE_ENV 判断：
    // auth env 预设把缺省的 NODE_ENV 兜底成 "development"，Worker 上会恒为真，
    // 生产也会信任 localhost。非 loopback 的来源（含局域网 IP）由 baseURL 自身
    // 的 origin 自动进入白名单（better-auth 会把 baseURL 的 origin 追加进去）。
    ...(allowLocalOrigins ? ["http://localhost*", "https://localhost*"] : []),
  ],
  user: {
    changeEmail: createChangeEmailOptions(emailCallbacks.sendChangeEmailConfirmation),
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: emailCallbacks.sendDeleteAccountVerification,
      ...hooks.deleteUser,
    },
  },
});

/**
 * Factory accessor for the configured better-auth instance.
 *
 * Returns the module singleton so `packages/api`'s session middleware and
 * better-auth handler mount cheaply (no per-request re-initialization). This
 * preserves the documented `createAuth` contract consumed by `@openstarter/api`.
 */
export const createAuth = () => auth;

export type AuthErrorCode = keyof typeof auth.$ERROR_CODES;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
export type Invitation = typeof auth.$Infer.Invitation;
export type Organization = typeof auth.$Infer.Organization;
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization;
export type Member = typeof auth.$Infer.Member;
export type Permissions = NonNullable<
  NonNullable<Parameters<typeof auth.api.hasPermission>[0]>["body"]["permissions"]
>;
