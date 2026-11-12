import { WebView } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";
import ProtectedRoute from "@/components/ProtectedRoute";
import "./index.scss";

export default function WebViewPage() {
  const router = useRouter();
  const targetUrl = router.params.url || "";

  return (
    <ProtectedRoute>
      <WebView className="webview" src={targetUrl} />
    </ProtectedRoute>
  );
}
