// with-firebase-config —— Expo config plugin：声明 Firebase 配置文件位置。
//
// 原生接线全部交给 Expo 默认插件链：@expo/prebuild-config 已无条件挂载
// AndroidConfig.GoogleServices.{withClassPath,withApplyPlugin,withGoogleServicesFile}
// 与 IOSConfig.Google.withGoogleServicesFile。这些 mod 在执行时读取
// config.android/ios.googleServicesFile 字段，幂等地完成 gradle classpath 声明、
// apply plugin、plist 拷贝与 Xcode 资源注册——本插件只写这两个字段作为开关，
// 不再 hand-rolled 任何 gradle/xcode mod。
//
// 配置文件不存在时整个 plugin no-op（console 提示一次）——未使用 Firebase 的
// fork 者 prebuild 行为与从前完全一致。文件存在性在 plugin 内部检测（而非
// app.config.ts 里条件注册），保证 app.config.ts 恒定、无分支。
//
// 另见下方 Podfile 补丁：无论配置文件是否存在，prebuild 都会注入
// `$RNFirebaseDisableSPM = true`（target 块之前）与
// `$RNFirebaseAsStaticFramework = true`（target 内、use_react_native! 之前）。
// @react-native-firebase/* 是本包的直接依赖，原生模块无条件参与 autolinking；但 RNFB v26 起默认走 SPM，而 SPM 与 Expo
// SDK 55 预编译模块的静态链接互斥（`pod install` 直接报错
// "[react-native-firebase] SPM + static linkage is not supported"）。
// 该标记只把 RNFB 切回经典 CocoaPods 静态库模式，与 Expo 默认链兼容；
// 官方 @react-native-firebase/app 插件的 disableSPM 选项做的也是同一件事，
// 但官方插件在缺失 GoogleService 文件时直接抛错，不适合本仓库的 no-op 约定，
// 故在此手写一行注入（锚点/语义与官方实现保持一致）。

const fs = require("node:fs");
const path = require("node:path");

const { withPodfile } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const ANDROID_CONFIG = "google-services.json";
const IOS_CONFIG = "GoogleService-Info.plist";

// Podfile 注入：必须出现在任何 target 块之前，锚定 Expo 生成的 Podfile
// 恒有的 `prepare_react_native_project!`。mergeContents 按 tag 幂等合并，
// 重复 prebuild 不会堆出多行。
const DISABLE_SPM_TAG = "@openstarter/disable-firebase-spm";
const DISABLE_SPM_ANCHOR = /prepare_react_native_project!/;
const DISABLE_SPM_FLAG = "$RNFirebaseDisableSPM = true";

// RNFB 官方静态 framework 模式的第二行：必须在 target 内、use_react_native!
// 之前（见 https://rnfirebase.io 首页 "CocoaPods / static frameworks"）。
// 锚定 Expo 模板恒有的 `use_expo_modules!`（target 内第一行），在其后插入。
const STATIC_FRAMEWORK_TAG = "@openstarter/rnfirebase-as-static-framework";
const STATIC_FRAMEWORK_ANCHOR = /use_expo_modules!/;
const STATIC_FRAMEWORK_FLAG = "$RNFirebaseAsStaticFramework = true";

const setPodfileDisableSPM = (src) =>
  mergeContents({
    src,
    newSrc: DISABLE_SPM_FLAG,
    tag: DISABLE_SPM_TAG,
    anchor: DISABLE_SPM_ANCHOR,
    offset: 1,
    comment: "#",
  }).contents;

const setPodfileStaticFramework = (src) =>
  mergeContents({
    src,
    newSrc: STATIC_FRAMEWORK_FLAG,
    tag: STATIC_FRAMEWORK_TAG,
    anchor: STATIC_FRAMEWORK_ANCHOR,
    offset: 1,
    comment: "#",
  }).contents;

const withPodfileDisableFirebaseSPM = (config) =>
  withPodfile(config, (config) => {
    try {
      config.modResults.contents = setPodfileDisableSPM(config.modResults.contents);
      config.modResults.contents = setPodfileStaticFramework(
        config.modResults.contents,
      );
    } catch (error) {
      console.warn(
        `[with-firebase-config] could not insert ${DISABLE_SPM_FLAG}: ${error.message}`,
      );
    }
    return config;
  });

const withFirebaseConfig = (config) => {
  const projectRoot = path.join(__dirname, "..");
  const hasFirebaseConfig =
    fs.existsSync(path.join(projectRoot, ANDROID_CONFIG)) ||
    fs.existsSync(path.join(projectRoot, IOS_CONFIG));

  let result = config;
  if (!hasFirebaseConfig) {
    console.warn(
      `[with-firebase-config] Neither ${ANDROID_CONFIG} nor ${IOS_CONFIG} found in apps/mobile — skipping Firebase wiring. ` +
        "Copy the *.example templates and fill in your Firebase project values to enable GA mobile.",
    );
  } else {
    result = {
      ...config,
      android: { ...config.android, googleServicesFile: ANDROID_CONFIG },
      ios: { ...config.ios, googleServicesFile: IOS_CONFIG },
    };
  }

  return withPodfileDisableFirebaseSPM(result);
};

module.exports = withFirebaseConfig;
module.exports.setPodfileDisableSPM = setPodfileDisableSPM;
module.exports.setPodfileStaticFramework = setPodfileStaticFramework;
