import { Button } from "@openstarter/ui-web/components/button";
import { QRCodeSVG } from "qrcode.react";

/** 前端渲染微信二维码所需数据（对应结账返回的 qrData + 订单号）。 */
export interface WechatQr {
  amount: number;
  codeUrl: string;
  orderNo: string;
}

const CENTS_PER_UNIT = 100;
const QR_SIZE = 220;
const AMOUNT_FRACTION_DIGITS = 2;

export function WechatQrOverlay({ qr, onClose }: { qr: WechatQr; onClose: () => void }) {
  const amountLabel = `¥${(qr.amount / CENTS_PER_UNIT).toFixed(AMOUNT_FRACTION_DIGITS)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 text-center shadow-lg">
        <h3 className="font-semibold text-lg">Scan to pay with WeChat</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Order {qr.orderNo} · {amountLabel}
        </p>
        <div className="mt-4 flex justify-center">
          <QRCodeSVG size={QR_SIZE} title="WeChat Pay QR code" value={qr.codeUrl} />
        </div>
        <Button className="mt-6 w-full" onClick={onClose} type="button" variant="outline">
          Close
        </Button>
      </div>
    </div>
  );
}
