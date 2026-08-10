import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { cn } from "@openstarter/ui-web/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { checkout } from "@/modules/checkout/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  PRICING_TIERS,
  type PricingCheckout,
  type PricingTier,
} from "@/lib/marketing/pricing";

import { type WechatQr, WechatQrOverlay } from "./wechat-qr-overlay";

function formatPrice(price: number | "custom"): string {
  if (price === "custom") {
    return "Custom";
  }
  if (price === 0) {
    return "Free";
  }
  return `$${price}/mo`;
}

function TierCard({
  tier,
  pending,
  onCheckout,
}: {
  tier: PricingTier;
  pending: boolean;
  onCheckout: (checkout: PricingCheckout) => void;
}) {
  const Icon = tier.icon;
  const { cta } = tier;
  return (
    <Card className={cn(tier.highlight && "ring-2 ring-primary")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Icon aria-hidden="true" className="size-5 text-primary" />
          {tier.highlight ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
              Most popular
            </span>
          ) : null}
        </div>
        <CardTitle className="mt-2 text-lg">{tier.name}</CardTitle>
        <CardDescription>{tier.description}</CardDescription>
        <div className="mt-2 font-bold text-2xl">
          {formatPrice(tier.priceMonthly)}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2">
          {tier.features.map((feature) => (
            <li className="flex items-center gap-2" key={feature}>
              <Check aria-hidden="true" className="size-4 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {cta.kind === "link" ? (
          <Button
            className="w-full"
            render={<Link to={cta.to} />}
            variant={tier.highlight ? "default" : "outline"}
          >
            {cta.label}
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => onCheckout(cta.checkout)}
            type="button"
            variant={tier.highlight ? "default" : "outline"}
          >
            {cta.label}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function PricingSection() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [wechatQr, setWechatQr] = useState<WechatQr | null>(null);

  const checkoutMutation = useMutation({
    ...checkout.mutations.create(),
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: (data: {
      checkoutUrl?: string;
      orderNo?: string;
      qrData?: { amount: number; codeUrl: string };
    }) => {
      // 微信 Native 渠道：渲染二维码扫码支付；其余渠道：跳转结账链接（R10.3）。
      if (data.qrData?.codeUrl) {
        setWechatQr({
          amount: data.qrData.amount,
          codeUrl: data.qrData.codeUrl,
          orderNo: data.orderNo!,
        });
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      toast.error("Checkout failed");
    },
  });

  function handleCheckout(checkout: PricingCheckout) {
    // 未登录用户发起结账 → 重定向到登录页（R10.2）。
    if (!session?.user) {
      navigate({ to: "/login" });
      return;
    }
    checkoutMutation.mutate(checkout);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-20" id="pricing">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="mt-2 text-muted-foreground">
          Start free. Upgrade when you grow.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            onCheckout={handleCheckout}
            pending={checkoutMutation.isPending}
            tier={tier}
          />
        ))}
      </div>
      {wechatQr ? (
        <WechatQrOverlay onClose={() => setWechatQr(null)} qr={wechatQr} />
      ) : null}
    </section>
  );
}
