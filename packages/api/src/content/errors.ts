// packages/api/src/content/errors —— 内容域可识别错误（R14.4/R15.3）。
//
// slug 唯一冲突以专用错误类型抛出（而非裸字符串），使路由层能识别并经 app.onError / respErr
// 转为结构化响应，同时携带冲突的 slug 便于诊断。文章（post）与分类（taxonomy）服务共用此错误，
// 对应设计的 Property 32「slug 唯一冲突被拒」。
//
// 约定沿用既有领域错误的写法（参见 @openstarter/billing 的 PaymentProviderUnavailableError）：
// 继承 Error、设置稳定的 `name`、暴露只读的领域字段。

export class SlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Slug '${slug}' already exists`);
    this.name = "SlugConflictError";
    this.slug = slug;
  }
}
