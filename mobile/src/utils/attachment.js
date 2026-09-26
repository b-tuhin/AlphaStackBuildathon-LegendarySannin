import { Alert, Linking } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { BASE_URL } from "../api/client";

/**
 * Downloads an attachment to the local device cache and opens it with system share/preview.
 * Surfaces visible error Alerts on failure instead of silently swallowing errors.
 */
export async function openOrDownloadAttachment(url, filename) {
  if (!url) return;

  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const safeFilename = filename || url.split("/").pop() || "attachment";
  const localTargetUri = `${FileSystem.cacheDirectory}${Date.now()}_${safeFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try {
    const downloadRes = await FileSystem.downloadAsync(fullUrl, localTargetUri);
    if (!downloadRes || !downloadRes.uri) {
      throw new Error("Download returned no local file URI");
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(downloadRes.uri, {
        dialogTitle: `Open ${safeFilename}`,
        mimeType: downloadRes.mimeType || undefined,
        UTI: downloadRes.mimeType || undefined,
      });
    } else {
      const canOpen = await Linking.canOpenURL(downloadRes.uri);
      if (canOpen) {
        await Linking.openURL(downloadRes.uri);
      } else {
        await Linking.openURL(fullUrl);
      }
    }
  } catch (err) {
    console.error("[Attachment] open/download error:", err);
    Alert.alert(
      "Attachment Error",
      `Unable to open "${safeFilename}": ${err?.message || "Check your internet connection or try again."}`
    );
  }
}
