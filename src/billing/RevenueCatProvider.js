import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { REVENUECAT_CONFIG, getRevenueCatApiKey } from "./revenuecatConfig";
import {
  notifyPurchaseOutcome,
  resolveRevenueCatPackage,
  shouldTreatAsCancellation,
} from "./revenuecatHelpers";
import { getPurchases, getPurchasesLogLevel } from "./revenuecatModule";

export const defaultRevenueCatState = {
  ready: false,
  loading: false,
  activeAction: null,
  activeTargetId: null,
  offerings: null,
  packages: { premium: null },
  premiumPriceString: "",
  purchasePackage: async () => ({ success: false, error: new Error("Purchases unavailable") }),
  restorePurchases: async () => ({ success: false, error: new Error("Purchases unavailable") }),
  refreshOfferings: async () => null,
  premiumActive: false,
  activeEntitlementIds: [],
  customerInfo: null,
  lastError: null,
};

export const RevenueCatContext = createContext(defaultRevenueCatState);

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}

export function usePremiumPurchaseFlow(successTitle, successMessage) {
  const { packages, purchasePackage } = useRevenueCat();
  return useCallback(async () => {
    const fallbackTarget = REVENUECAT_CONFIG.packageIds.premium || REVENUECAT_CONFIG.productIds.premium;
    const outcome = await purchasePackage(packages?.premium || fallbackTarget);
    notifyPurchaseOutcome(outcome, { successTitle, successMessage });
    return outcome;
  }, [packages?.premium, purchasePackage, successTitle, successMessage]);
}

export function useRevenueCatController(appUserID, authReady) {
  const [isConfigured, setConfigured] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [busyState, setBusyState] = useState({ busy: false, action: null, targetId: null });
  const configureKeyRef = useRef(null);
  const configuringRef = useRef(false);
  const currentUserRef = useRef(null);
  const revenueCatApiKey = useMemo(() => getRevenueCatApiKey(), []);

  useEffect(() => {
    const Purchases = getPurchases();
    const PurchasesLogLevel = getPurchasesLogLevel();
    if (!Purchases || !revenueCatApiKey) {
      return;
    }
    if (configureKeyRef.current === revenueCatApiKey || configuringRef.current) {
      return;
    }
    configuringRef.current = true;
    let cancelled = false;

    const configure = async () => {
      try {
        if (Purchases.setLogLevel && PurchasesLogLevel?.WARN != null) {
          Purchases.setLogLevel(PurchasesLogLevel.WARN);
        }
        await Purchases.configure({ apiKey: revenueCatApiKey });
        if (cancelled) return;
        configureKeyRef.current = revenueCatApiKey;
        setConfigured(true);
        setLastError(null);
        try {
          const info = await Purchases.getCustomerInfo();
          if (!cancelled) {
            setCustomerInfo(info);
          }
        } catch (infoError) {
          if (!cancelled) {
            setLastError(infoError);
          }
        }
        try {
          const nextOfferings = await Purchases.getOfferings();
          if (!cancelled) {
            setOfferings(nextOfferings);
          }
        } catch (offeringsError) {
          if (!cancelled) {
            setLastError(offeringsError);
          }
        }
      } catch (error) {
        console.log("RevenueCat configure error:", error?.message || error);
        if (!cancelled) {
          configureKeyRef.current = null;
          setConfigured(false);
          setLastError(error);
        }
      } finally {
        configuringRef.current = false;
      }
    };

    configure();

    const listener = Purchases.addCustomerInfoUpdateListener?.((info) => {
      setCustomerInfo(info);
    });

    return () => {
      cancelled = true;
      if (listener?.remove) {
        listener.remove();
      } else if (typeof listener === "function") {
        listener();
      }
    };
  }, [revenueCatApiKey]);

  useEffect(() => {
    const Purchases = getPurchases();
    if (!Purchases || !isConfigured || !authReady) {
      return;
    }
    if (appUserID && currentUserRef.current === appUserID) {
      return;
    }
    if (!appUserID && !currentUserRef.current) {
      return;
    }

    let cancelled = false;

    const syncIdentity = async () => {
      try {
        if (appUserID) {
          const result = await Purchases.logIn(appUserID);
          if (cancelled) return;
          currentUserRef.current = appUserID;
          const info = result?.customerInfo || result;
          if (info) {
            setCustomerInfo(info);
          }
        } else {
          const info = await Purchases.logOut();
          if (cancelled) return;
          currentUserRef.current = null;
          setCustomerInfo(info);
        }
        setLastError(null);
      } catch (error) {
        console.log("RevenueCat identity sync error:", error?.message || error);
        if (!cancelled) {
          setLastError(error);
        }
      }
    };

    syncIdentity();

    return () => {
      cancelled = true;
    };
  }, [appUserID, authReady, isConfigured]);

  useEffect(() => {
    const Purchases = getPurchases();
    if (!Purchases || !isConfigured) {
      return;
    }
    if (offerings) {
      return;
    }
    let cancelled = false;

    const loadOfferings = async () => {
      try {
        const nextOfferings = await Purchases.getOfferings();
        if (!cancelled) {
          setOfferings(nextOfferings);
        }
      } catch (error) {
        if (!cancelled) {
          setLastError(error);
        }
      }
    };

    loadOfferings();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, offerings]);

  useEffect(() => {
    if (!customerInfo || !appUserID) return;
    const normalizedAppUser = customerInfo?.appUserID || customerInfo?.originalAppUserId;
    if (normalizedAppUser && normalizedAppUser !== appUserID) {
      console.warn(
        "RevenueCat alias mismatch detected",
        normalizedAppUser,
        "expected",
        appUserID
      );
    }
  }, [customerInfo, appUserID]);

  const refreshOfferings = useCallback(async () => {
    const Purchases = getPurchases();
    if (!Purchases || !isConfigured) {
      return null;
    }
    try {
      const nextOfferings = await Purchases.getOfferings();
      setOfferings(nextOfferings);
      setLastError(null);
      return nextOfferings;
    } catch (error) {
      console.log("RevenueCat offerings error:", error?.message || error);
      setLastError(error);
      throw error;
    }
  }, [isConfigured]);

  const purchasePackage = useCallback(
    async (target) => {
      const Purchases = getPurchases();
      if (!Purchases || !isConfigured) {
        const error = new Error("Purchases not ready. Please try again shortly.");
        setLastError(error);
        return { success: false, error };
      }
      const fallbackTarget =
        typeof target === "string"
          ? target
          : REVENUECAT_CONFIG.packageIds.premium || REVENUECAT_CONFIG.productIds.premium;
      const resolved =
        resolveRevenueCatPackage(target, offerings) ||
        resolveRevenueCatPackage(fallbackTarget, offerings) ||
        resolveRevenueCatPackage(REVENUECAT_CONFIG.packageIds.premium, offerings) ||
        resolveRevenueCatPackage(REVENUECAT_CONFIG.productIds.premium, offerings) ||
        resolveRevenueCatPackage(target, { current: null, all: {} });
      const targetId =
        resolved?.identifier ||
        resolved?.packageIdentifier ||
        resolved?.product?.identifier ||
        (typeof target === "string" ? target : fallbackTarget);
      if (!resolved) {
        const error = new Error("Purchase options are unavailable. Please refresh and try again.");
        setLastError(error);
        return { success: false, error };
      }
      setBusyState({ busy: true, action: "purchase", targetId });
      try {
        const result = await Purchases.purchasePackage(resolved);
        const info = result?.customerInfo || result;
        if (info) {
          setCustomerInfo(info);
        }
        setLastError(null);
        return { success: true, result };
      } catch (error) {
        if (shouldTreatAsCancellation(error)) {
          return { success: false, cancelled: true };
        }
        console.log("RevenueCat purchase error:", error?.message || error);
        setLastError(error);
        return { success: false, error };
      } finally {
        setBusyState({ busy: false, action: null, targetId: null });
      }
    },
    [isConfigured, offerings]
  );

  const restorePurchases = useCallback(async () => {
    const Purchases = getPurchases();
    if (!Purchases || !isConfigured) {
      const error = new Error("Restore unavailable. Please try again later.");
      setLastError(error);
      return { success: false, error };
    }
    setBusyState({ busy: true, action: "restore", targetId: null });
    try {
      const info = await Purchases.restorePurchases();
      if (info) {
        setCustomerInfo(info);
      }
      setLastError(null);
      return { success: true, result: info };
    } catch (error) {
      console.log("RevenueCat restore error:", error?.message || error);
      setLastError(error);
      return { success: false, error };
    } finally {
      setBusyState({ busy: false, action: null, targetId: null });
    }
  }, [isConfigured]);

  const activeEntitlementIds = useMemo(() => {
    const active = customerInfo?.entitlements?.active || {};
    return Object.keys(active);
  }, [customerInfo?.entitlements?.active]);

  const activeEntitlements = useMemo(() => new Set(activeEntitlementIds), [activeEntitlementIds]);

  const premiumPackage = useMemo(
    () =>
      resolveRevenueCatPackage(REVENUECAT_CONFIG.packageIds.premium, offerings) ||
      resolveRevenueCatPackage(REVENUECAT_CONFIG.productIds.premium, offerings),
    [offerings]
  );
  const contextValue = useMemo(
    () => ({
      ready: isConfigured,
      loading: busyState.busy,
      activeAction: busyState.action,
      activeTargetId: busyState.targetId,
      offerings,
      packages: { premium: premiumPackage },
      premiumPriceString: premiumPackage?.product?.priceString || "",
      purchasePackage,
      restorePurchases,
      refreshOfferings,
      premiumActive: activeEntitlements.has(REVENUECAT_CONFIG.entitlementIds.premium),
      activeEntitlementIds,
      customerInfo,
      lastError,
    }),
    [
      isConfigured,
      busyState.busy,
      busyState.action,
      busyState.targetId,
      offerings,
      premiumPackage,
      purchasePackage,
      restorePurchases,
      refreshOfferings,
      activeEntitlements,
      activeEntitlementIds,
      customerInfo,
      lastError,
    ]
  );

  return contextValue;
}
