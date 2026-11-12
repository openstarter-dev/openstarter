import type { ExpoConfig } from "expo/config";

const BUNDLE_IDENTIFIER = "dev.openstarter.app";

const config: ExpoConfig = {
  android: {
    package: BUNDLE_IDENTIFIER,
  },
  ios: {
    bundleIdentifier: BUNDLE_IDENTIFIER,
    supportsTablet: true,
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
    },
  },
  name: "OpenStarter",
  orientation: "portrait",
  runtimeVersion: {
    policy: "appVersion",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-image",
    "expo-video",
    "expo-sharing",
  ],
  scheme: "openstarter",
  slug: "openstarter",
  userInterfaceStyle: "automatic",
  version: "0.1.0",
  extra: {
  },
};

export default config;
