import { Platform } from "react-native";

const readEnv = (key) => {
  try {
    if (typeof process !== "undefined" && process?.env && process.env[key] != null) {
      return process.env[key];
    }
  } catch (error) {
    console.log("Environment read error:", error?.message || error);
  }
  return undefined;
};

export const REVENUECAT_CONFIG = {
  apiKeys: {
    ios:
      readEnv("EXPO_PUBLIC_REVENUECAT_IOS_KEY") ||
      readEnv("REVENUECAT_IOS_API_KEY") ||
      readEnv("REVENUECAT_API_KEY_IOS") ||
      "",
    android:
      readEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_KEY") ||
      readEnv("REVENUECAT_ANDROID_API_KEY") ||
      readEnv("REVENUECAT_API_KEY_ANDROID") ||
      "",
  },
  entitlementIds: {
    premium: "premium",
  },
  packageIds: {
    premium: "$rc_monthly",
  },
  productIds: {
    premium: "premium_monthly:monthly",
  },
  offeringId: "Default",
};

export const getRevenueCatApiKey = () => {
  const platformKey = Platform.select({
    ios: REVENUECAT_CONFIG.apiKeys.ios,
    android: REVENUECAT_CONFIG.apiKeys.android,
    default: REVENUECAT_CONFIG.apiKeys.android || REVENUECAT_CONFIG.apiKeys.ios,
  });
  return platformKey && platformKey.trim() ? platformKey.trim() : null;
};
