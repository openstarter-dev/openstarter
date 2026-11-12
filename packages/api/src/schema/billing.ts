// packages/api/src/schema/billing —— billing 域入参校验（modules/billing 路由复用）。
//
// 结账入参只接受产品引用与支付渠道：价格/货币/积分/订阅周期一律由服务端
// 产品目录（modules/billing/products）按 productId 解析 —— 客户端传金额一律
// 忽略，杜绝「客户端改价」漏洞。
import { z } from "zod";

export const checkoutBody = z.object({
  productId: z.string().min(1),
  provider: z.string().min(1).optional(),
});
