import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { spacing } from "../theme/whatsapp";
import { BASE_URL } from "../api/client";
import {
  getSavedVoiceLang,
  saveVoiceLang,
  speakText,
  stopSpeaking,
  VOICE_LANGUAGES,
} from "../utils/speech";
import { openOrDownloadAttachment } from "../utils/attachment";
import LanguagePickerModal from "./LanguagePickerModal";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ChatBubble({
  message,
  isOwn,
  isGroup = false,
  senderLabel,
  referencedMessage,
  onRetry,
  onOpenTraditionalView,
  onPressQuote,
  canReply = true,
  isHighlighted = false,
  onToggleFavorite,
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";
  const isWaiting = message.status === "waiting_offline";
  const deliveryStatus = message.delivery_status || "sent";

  // ── Text to Speech (TTS) state for received messages ───────────────────────
  const [isSpeaking, setIsSpeaking]               = useState(false);
  const [ttsLang, setTtsLang]                     = useState("en-IN");
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [ttsError, setTtsError]                   = useState("");

  useEffect(() => {
    getSavedVoiceLang().then((l) => setTtsLang(l));
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleTtsError = (err) => {
    setIsSpeaking(false);
    const langObj = VOICE_LANGUAGES.find((l) => l.code === ttsLang);
    const langLabel = langObj ? langObj.name : ttsLang;
    setTtsError(`Couldn't read aloud in ${langLabel}`);
    setTimeout(() => setTtsError(""), 3500);
  };

  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      await stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = message.body_text || message.subject || "";
    if (!textToSpeak.trim()) return;

    setIsSpeaking(true);
    setTtsError("");
    await speakText(textToSpeak, ttsLang, {
      onDone: () => setIsSpeaking(false),
      onError: handleTtsError,
      onStopped: () => setIsSpeaking(false),
    });
  };

  const handleSelectTtsLang = async (code) => {
    setTtsLang(code);
    await saveVoiceLang(code);
    if (isSpeaking) {
      await stopSpeaking();
      setIsSpeaking(false);
      const textToSpeak = message.body_text || message.subject || "";
      if (textToSpeak.trim()) {
        setIsSpeaking(true);
        setTtsError("");
        await speakText(textToSpeak, code, {
          onDone: () => setIsSpeaking(false),
          onError: handleTtsError,
          onStopped: () => setIsSpeaking(false),
        });
      }
    }
  };

  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : (() => {
        try {
          return JSON.parse(message.attachments || "[]");
        } catch {
          return [];
        }
      })();

  const openAttachment = (url, filename) => {
    if (!url) return;
    openOrDownloadAttachment(url, filename);
  };

  // ── Display Name & Avatar Resolution (Requirement 9) ──────────────────────
  const senderDisplayName =
    message.from_name ||
    message.from_display ||
    message.counterpart_name ||
    senderLabel ||
    (message.from_address ? formatPhoneNumber(message.from_address) : "");
  const senderInitials = getAvatarInitials(senderDisplayName);
  const senderAvatarBg = getAvatarColor(message.from_address);

  // ── Long email body handling (>280 chars / 6 lines) (Requirement 6) ────────
  const bodyText = message.body_text || "";
  const isLong = bodyText.length > 280 || bodyText.split("\n").length > 6;
  const displayedText = isLong ? bodyText.slice(0, 240).trim() + "…" : bodyText;

  // ── Check if message is a reply (Requirement 3) ───────────────────────────
  const isReply = Boolean(message.in_reply_to);

  return (
    <View style={[styles.row, isOwn ? styles.rowOut : styles.rowIn]}>
      <View
        style={[
          styles.bubble,
          isOwn
            ? [styles.bubbleOut, { backgroundColor: colors.bubbleOut, borderColor: colors.bubbleBorderOut }]
            : [styles.bubbleIn, { backgroundColor: colors.bubbleIn, borderColor: colors.bubbleBorderIn }],
          isSending && { opacity: 0.75 },
          isHighlighted && {
            borderColor: colors.primaryLight,
            borderWidth: 2,
            backgroundColor: isOwn ? "#DCFCE7" : "#FEF9C3",
          },
        ]}
      >
        {/* Important/Star Badge */}
        {Boolean(message.is_favorite) && (
          <View
            style={[
              styles.starBadge,
              isOwn ? styles.starBadgeLeft : styles.starBadgeRight,
            ]}
          >
            <Ionicons name="star" size={10} color="#d97706" />
          </View>
        )}
        {/* Sender Name & Avatar (Requirement 9) */}
        {!isOwn && Boolean(senderDisplayName) && (
          <View style={styles.senderHeader}>
            <View style={[styles.senderAvatar, { backgroundColor: senderAvatarBg }]}>
              <Text style={styles.senderAvatarText}>{senderInitials}</Text>
            </View>
            <Text style={[styles.sender, { color: colors.accent }]} numberOfLines={1}>
              {senderDisplayName}
            </Text>
          </View>
        )}

        {isOwn && isGroup && Boolean(message.to_display || message.to_address) && (
          <View style={styles.senderHeader}>
            <Ionicons name="people" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.sender, { color: colors.textSecondary, fontSize: 11 }]} numberOfLines={1}>
              To: {message.to_display || message.to_address}
            </Text>
          </View>
        )}

        {/* Non-reply emails display Subject at top of bubble (Requirement 3) */}
        {!isReply && Boolean(message.subject && message.subject.trim() && message.subject !== "(no subject)") && (
          <View style={[styles.subjectWrap, { backgroundColor: colors.quoteBackground }]}>
            <Ionicons name="mail" size={12} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.subjectText, { color: colors.textPrimary }]} numberOfLines={1}>
              {message.subject}
            </Text>
          </View>
        )}

        {/* Reply emails link to original message (Requirement 3) */}
        {isReply && (
          <TouchableOpacity
            style={styles.quoteBlock}
            activeOpacity={0.7}
            onPress={() => onPressQuote && onPressQuote(message.in_reply_to)}
          >
            <View style={styles.quoteBar} />
            <View style={styles.quoteContent}>
              <Text style={styles.quoteSender} numberOfLines={1}>
                {referencedMessage?.from_name ||
                  referencedMessage?.from_display ||
                  referencedMessage?.counterpart_name ||
                  (referencedMessage?.from_address
                    ? referencedMessage.from_address.split("@")[0]
                    : "Original Message")}
              </Text>
              <Text style={styles.quoteSnippet} numberOfLines={2}>
                {referencedMessage?.body_text || referencedMessage?.subject || "Referenced email"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Attachments rendering */}
        {attachments.map((att, idx) => {
          const isImage = (att.contentType || att.mime_type || "").startsWith("image/");
          const previewUrl = att.id ? `/mail/attachments/${att.id}` : att.url;
          const downloadUrl = att.id ? `/mail/attachments/${att.id}/download` : att.url;
          const fullPreviewUrl = previewUrl
            ? previewUrl.startsWith("http")
              ? previewUrl
              : `${BASE_URL}${previewUrl}`
            : null;
          const fullDownloadUrl = downloadUrl
            ? downloadUrl.startsWith("http")
              ? downloadUrl
              : `${BASE_URL}${downloadUrl}`
            : null;

          if (isImage && fullPreviewUrl) {
            return (
              <TouchableOpacity
                key={att.id || idx}
                onPress={() => openAttachment(fullPreviewUrl, att.filename || att.original_name)}
                style={styles.imageAttach}
              >
                <Image
                  source={{ uri: fullPreviewUrl }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={att.id || idx}
              style={styles.fileAttach}
              onPress={() => openAttachment(fullDownloadUrl, att.filename || att.original_name)}
            >
              <Ionicons name="document-text" size={22} color={colors.primaryLight} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {att.filename || att.original_name || "Attachment"}
                </Text>
                <Text style={styles.fileSize}>{formatBytes(att.size)}</Text>
              </View>
              <Ionicons name="download-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}

        {/* Message body text */}
        {Boolean(displayedText) && (
          <TouchableOpacity
            activeOpacity={isLong ? 0.7 : 1}
            onPress={() => {
              if (isLong && onOpenTraditionalView) {
                onOpenTraditionalView(message);
              }
            }}
          >
            <Text style={styles.body}>{displayedText}</Text>
          </TouchableOpacity>
        )}

        {/* Long text "Open as Letter" affordance (Requirement 6) */}
        {isLong && (
          <TouchableOpacity
            style={styles.readMoreBtn}
            onPress={() => onOpenTraditionalView && onOpenTraditionalView(message)}
          >
            <Text style={styles.readMoreText}>{t("openAsLetter")}</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primaryLight} />
          </TouchableOpacity>
        )}

        {/* Read aloud (TTS) for received messages */}
        {!isOwn && (message.body_text || message.subject) ? (
          <View style={styles.ttsContainer}>
            <TouchableOpacity
              style={[styles.ttsBtn, isSpeaking && styles.ttsBtnActive]}
              onPress={handleToggleSpeak}
            >
              <Ionicons
                name={isSpeaking ? "stop-circle" : "volume-high"}
                size={13}
                color={isSpeaking ? "#fff" : colors.primaryLight}
              />
              <Text style={[styles.ttsBtnText, isSpeaking && styles.ttsBtnTextActive]}>
                {isSpeaking ? (t("stopReading") || "Stop") : (t("readAloud") || "Read aloud")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ttsLangBtn}
              onPress={() => setLangPickerVisible(true)}
              title="Voice language"
            >
              <Text style={styles.ttsLangText}>
                {ttsLang.split("-")[0].toUpperCase()}
              </Text>
              <Ionicons name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {Boolean(ttsError) && (
          <View style={{ paddingHorizontal: spacing.sm, paddingBottom: 4 }}>
            <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "500" }}>
              {ttsError}
            </Text>
          </View>
        )}

        {/* Bottom meta row: time + ticks / retry */}
        <View style={styles.metaRow}>
          {isWaiting && (
            <View style={styles.waitingRow}>
              <Ionicons name="time-outline" size={11} color="#E37400" />
              <Text style={styles.waitingText}>{t("waitingOffline")}</Text>
            </View>
          )}

          {isFailed && (
            <TouchableOpacity
              style={styles.retryRow}
              onPress={() => onRetry && onRetry(message)}
            >
              <Ionicons name="alert-circle" size={13} color={colors.danger} />
              <Text style={styles.retryText}>Failed • Tap to retry</Text>
            </TouchableOpacity>
          )}

          {onToggleFavorite && (
            <TouchableOpacity
              onPress={() => onToggleFavorite(message)}
              style={styles.starActionBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={message.is_favorite ? "star" : "star-outline"}
                size={14}
                color={message.is_favorite ? "#f59e0b" : colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          <Text style={styles.time}>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>

          {isOwn && (
            <View style={styles.statusIconWrap}>
              {isSending ? (
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              ) : deliveryStatus === "read" ? (
                <Ionicons name="checkmark-done" size={14} color="#0284C7" />
              ) : deliveryStatus === "delivered" ? (
                <Ionicons name="checkmark-done" size={14} color={colors.textSecondary} />
              ) : (
                <Ionicons name="checkmark" size={13} color={colors.textSecondary} />
              )}
            </View>
          )}
        </View>
      </View>

      <LanguagePickerModal
        visible={langPickerVisible}
        selectedLang={ttsLang}
        onSelect={handleSelectTtsLang}
        onClose={() => setLangPickerVisible(false)}
        title="Select Voice (Read Aloud)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: spacing.md,
  },
  rowOut: {
    justifyContent: "flex-end",
  },
  rowIn: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    // Spike Mail: clean minimal, flat, no heavy shadows
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 0,
  },
  bubbleOut: {
    backgroundColor: colors.bubbleOut,
    borderWidth: 1,
    borderColor: colors.bubbleBorderOut,
  },
  bubbleIn: {
    backgroundColor: colors.bubbleIn,
    borderWidth: 1,
    borderColor: colors.bubbleBorderIn,
  },
  senderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  senderAvatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  sender: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryLight,
  },
  subjectWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 6,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  quoteBlock: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quoteBar: {
    width: 3.5,
    backgroundColor: colors.primaryLight,
  },
  quoteContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quoteSender: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryLight,
    marginBottom: 1,
  },
  quoteSnippet: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryLight,
  },
  imageAttach: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
    width: 220,
    height: 140,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.divider,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  fileAttach: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  fileName: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  fileSize: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 5,
    gap: 4,
  },
  time: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  statusIconWrap: {
    marginLeft: 2,
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 4,
  },
  waitingText: {
    fontSize: 10,
    color: "#E37400",
    fontWeight: "600",
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 6,
  },
  retryText: {
    fontSize: 10.5,
    color: colors.danger,
    fontWeight: "600",
  },
  ttsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  ttsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ttsBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  ttsBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primaryLight,
  },
  ttsBtnTextActive: {
    color: "#FFFFFF",
  },
  ttsLangBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ttsLangText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  starBadge: {
    position: "absolute",
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 3,
  },
  starBadgeRight: {
    right: -6,
  },
  starBadgeLeft: {
    left: -6,
  },
  starActionBtn: {
    marginRight: 6,
    padding: 2,
  },
});
