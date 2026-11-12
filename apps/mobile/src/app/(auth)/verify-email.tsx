import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Text } from "@openstarter/ui-mobile";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";

/** 轮询间隔（毫秒）：邮件送达 + 用户点击链接的合理检查节奏。 */
const POLL_INTERVAL_MS = 3_000;
/** 轮询上限（毫秒）：约 2 分钟后停止自动检查，改由「继续」按钮手动触发。 */
const POLL_MAX_MS = 120_000;
/** 重发倒计时起始秒数。 */
const RESEND_COUNTDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN_SECONDS);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!email) {
      router.replace("/sign-in");
    }
  }, [email, router]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => clearInterval(timer);
  }, [countdown]);

  /** 有界轮询：验证完成后服务端自动登录（autoSignInAfterVerification），捕捉到会话即返回。 */
  const pollForSession = useCallback(
    function pollForSession() {
      if (pollStartRef.current === null) {
        pollStartRef.current = Date.now();
      }
      if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
        setNotice(t("common.sign.verify_email_not_verified_yet"));
        pollStartRef.current = null;
        return;
      }
      void authClient.getSession().then(({ data }) => {
        if (data?.user) {
          return;
        }
        setTimeout(pollForSession, POLL_INTERVAL_MS);
      });
    },
    [t],
  );

  const handleResend = async () => {
    setNotice("");
    setSending(true);
    const { error: resultError } = await authClient.sendVerificationEmail({ email });
    setSending(false);
    if (resultError) {
      setNotice(resultError.message ?? t("common.sign.verify_email_send_failed"));
      return;
    }
    setCountdown(RESEND_COUNTDOWN_SECONDS);
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {t("common.sign.verify_email_page_title")}
        </Text>
        <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
          {t("common.sign.verify_email_page_description")} {email}
        </Text>

        {notice.length > 0 ? (
          <Text className="text-center text-destructive text-xs dark:text-dark-destructive">
            {notice}
          </Text>
        ) : null}

        <Button
          disabled={sending || countdown > 0 || email.length === 0}
          onPress={() => void handleResend()}
          variant="outline"
        >
          <Text>
            {countdown > 0
              ? t("common.sign.resend_verification_countdown", { seconds: countdown })
              : t("common.sign.resend_verification")}
          </Text>
        </Button>

        <Button onPress={pollForSession}>
          <Text>{t("common.sign.verify_email_continue")}</Text>
        </Button>

        <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
          {t("common.sign.verify_email_tip")}
        </Text>
      </View>
    </Screen>
  );
}
