import { Alert } from "react-native";

export const collectAllPackages = (offerings) => {
  if (!offerings) return [];
  const all = [];
  const current = offerings.current;
  if (current?.availablePackages?.length) {
    all.push(...current.availablePackages);
  }
  const others = offerings.all || {};
  Object.values(others).forEach((offering) => {
    if (offering?.availablePackages?.length) {
      offering.availablePackages.forEach((pkg) => all.push(pkg));
    }
  });
  return all;
};

export const resolveRevenueCatPackage = (packageOrId, offerings) => {
  if (!packageOrId) return null;
  if (packageOrId?.identifier && packageOrId?.product) {
    return packageOrId;
  }
  const identifier =
    typeof packageOrId === "string"
      ? packageOrId
      : packageOrId?.identifier || packageOrId?.packageIdentifier || packageOrId?.product?.identifier;
  if (!identifier) return null;
  const allPackages = collectAllPackages(offerings);
  if (!allPackages.length) return null;
  return (
    allPackages.find((pkg) => {
      const identifiers = [pkg?.identifier, pkg?.packageIdentifier, pkg?.product?.identifier].filter(Boolean);
      return identifiers.some((value) => value === identifier);
    }) || null
  );
};

export const shouldTreatAsCancellation = (error) => {
  if (!error) return false;
  const code = error?.code;
  const message = String(error?.message || "").toLowerCase();
  return (
    Boolean(error?.userCancelled) ||
    code === "PURCHASE_CANCELLED" ||
    code === "USER_CANCELLED" ||
    code === "CANCELLED_PURCHASE" ||
    message.includes("cancel")
  );
};

export const notifyPurchaseOutcome = (outcome, messages = {}) => {
  if (!outcome) return;
  if (outcome.success) {
    Alert.alert(
      messages.successTitle || "Premium unlocked",
      messages.successMessage || "Your Premium access is now active across all devices."
    );
  } else if (outcome.error && !outcome.cancelled) {
    Alert.alert(
      messages.errorTitle || "Purchase not completed",
      outcome.error?.message || messages.errorMessage || "Please try again."
    );
  }
};

export const notifyRestoreOutcome = (outcome) => {
  if (!outcome) return;
  if (outcome.success) {
    Alert.alert("Purchases restored", "Your active purchases are now synced on this device.");
  } else if (outcome.error) {
    Alert.alert("Restore failed", outcome.error?.message || "Please try again.");
  }
};
