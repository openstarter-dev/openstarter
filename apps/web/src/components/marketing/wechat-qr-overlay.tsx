// 微信支付二维码浮层（R10.3）：结账返回微信 Native 渠道的 qrData 时，
// 将 `codeUrl`（weixin://...）本地渲染为二维码供用户扫码支付（不外发第三方）。
// 金额固定为人民币最小单位（分），以 ¥ 展示。

import { Button } from "@openstarter/ui/components/button";
import { QRCodeSVG } from "qrcode.react";

/** 前端渲染微信二维码所需数据（对应结账返回的 qrData + 订单号）。 */
export type WechatQr = {
  codeUrl: string;
  amount: number;
  orderNo: string;
};

const CENTS_PER_UNIT = 100;
const QR_SIZE = 220;
const AMOUNT_FRACTION_DIGITS = 2;

export function WechatQrOverlay({
  qr,
  onClose,
}: {
  qr: WechatQr;
  onClose: () => void;
}) {
  const amountLabel = `¥${(qr.amount / CENTS_PER_UNIT).toFixed(AMOUNT_FRACTION_DIGITS)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 text-center shadow-lg">
        <h3 className="font-semibold text-lg">Scan to pay with WeChat</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Order {qr.orderNo} · {amountLabel}
        </p>
        <div className="mt-4 flex justify-center">
          <QRCodeSVG
            size={QR_SIZE}
            title="WeChat Pay QR code"
            value={qr.codeUrl}
          />
        </div>
        <Button
          className="mt-6 w-full"
          onClick={onClose}
          type="button"
          variant="outline"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
