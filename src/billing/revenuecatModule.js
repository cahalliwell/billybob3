let Purchases = null;
let PurchasesLogLevel = null;

const getGlobalObject = () => {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof global !== "undefined") return global;
  if (typeof window !== "undefined") return window;
  if (typeof self !== "undefined") return self;
  return {};
};

const globalRef = getGlobalObject();

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
  const candidates = [
    globalRef?.RevenueCatPurchases,
    globalRef?.RevenueCat?.Purchases,
    globalRef?.RevenueCat?.PurchasesModule,
    globalRef?.ExpoModules?.RevenueCatPurchases,
    globalRef?.ExpoModules?.RevenueCatPurchasesModule,
    globalRef?.ExpoModulesProxy?.RevenueCatPurchases,
    globalRef?.NativeModules?.RevenueCatPurchases,
    globalRef?.expo?.modulesProxy?.RevenueCatPurchases,
  ];

  for (const candidate of candidates) {
    const resolved = candidate?.default || candidate;
    if (resolved && (resolved.configure || resolved.purchasePackage || resolved.purchaseProduct)) {
      return resolved;
    }
  }

  return null;
};

attachRevenueCatModule(resolveRevenueCatModule());

if (globalRef && !globalRef.__setRevenueCatPurchasesModule) {
  Object.defineProperty(globalRef, "__setRevenueCatPurchasesModule", {
    value: (moduleCandidate) => attachRevenueCatModule(moduleCandidate),
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

if (!Purchases) {
  console.log("RevenueCat SDK unavailable: purchases features are disabled by default.");
}

export const getPurchases = () => Purchases;
export const getPurchasesLogLevel = () => PurchasesLogLevel;
