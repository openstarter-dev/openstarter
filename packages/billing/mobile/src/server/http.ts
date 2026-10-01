// server 子树专用 HTTP 错误（上游 @workspace/shared 的本地替代；spec §5）。
// 接线 api 路由时由挂载方转成响应（对齐 router.ts fail-closed 三段式）。
export const HttpStatusCode = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];

export class HttpException extends Error {
  readonly status: HttpStatusCode;
  readonly body: { code: string };

  constructor(status: HttpStatusCode, body: { code: string }) {
    super(body.code);
    this.name = "HttpException";
    this.status = status;
    this.body = body;
  }
}
