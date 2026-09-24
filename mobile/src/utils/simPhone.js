import { Platform, PermissionsAndroid, NativeModules } from "react-native";

function digits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

/** Best-effort SIM number. Requires READ_PHONE_NUMBERS on Android; Expo Go usually cannot read it. */
export async function tryReadSimPhone() {
  if (Platform.OS !== "android") return "";
  try {
    const permission =
      PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS || PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;
    const result = await PermissionsAndroid.request(permission, {
      title: "Use your SIM number",
      message: "PhoneMail can fill your phone number from the SIM so you don't have to type it.",
      buttonPositive: "Allow",
      buttonNegative: "Skip",
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) return "";

    const candidates = [
      NativeModules.TelephonyModule,
      NativeModules.RNSimData,
      NativeModules.RNDeviceInfo,
    ];
    for (const mod of candidates) {
      if (!mod) continue;
      if (typeof mod.getLine1Number === "function") return digits(await mod.getLine1Number());
      if (typeof mod.getPhoneNumber === "function") return digits(await mod.getPhoneNumber());
      if (typeof mod.getSimSerialNumber === "function" && typeof mod.getPhoneNumberSync === "function") {
        return digits(mod.getPhoneNumberSync());
      }
    }
  } catch {
    return "";
  }
  return "";
}
