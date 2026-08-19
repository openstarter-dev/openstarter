// defineAppConfig 是 Taro 提供的全局函数，无需 import
export default defineAppConfig({
  pages: ["pages/index/index", "pages/login/index", "pages/profile/index", "pages/webview/index"],
  window: {
    navigationBarTitleText: "openstarter",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f8f8f8",
  },
});
