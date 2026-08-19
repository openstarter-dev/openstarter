import { WebView } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";
import ProtectedRoute from "@/components/ProtectedRoute";
import "./index.scss";

export default function WebViewPage() {
  const router = useRouter();
  // URL 从路由参数获取，如 /pages/webview/index?url=https://example.com
  const targetUrl = router.params.url || "";

  return (
    <ProtectedRoute>
      <WebView className="webview" src={targetUrl} />
    </ProtectedRoute>
  );
}
