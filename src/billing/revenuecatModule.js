import PurchasesModule from "react-native-purchases";

let Purchases = null;
let PurchasesLogLevel = null;

export const attachRevenueCatModule = (maybeModule) => {
  if (!maybeModule) return null;
  const resolved = maybeModule?.default || maybeModule;
  if (!resolved) return null;
  if (Purchases === resolved) {
    return resolved;
  }
  Purchases = resolved;
  PurchasesLogLevel =
    resolved?.LOG_LEVEL || resolved?.LogLevel || resolved?.LOG_LEVELS || PurchasesLogLevel;
  return resolved;
};

export const resolveRevenueCatModule = () => {
  const resolved = PurchasesModule?.default || PurchasesModule;
  if (!resolved) return null;
  if (resolved.configure || resolved.purchasePackage || resolved.purchaseProduct) {
    return resolved;
  }
  return null;
};

attachRevenueCatModule(resolveRevenueCatModule());

if (!Purchases) {
  console.log("RevenueCat SDK unavailable: purchases features are disabled by default.");
}

export const getPurchases = () => Purchases;
export const getPurchasesLogLevel = () => PurchasesLogLevel;
