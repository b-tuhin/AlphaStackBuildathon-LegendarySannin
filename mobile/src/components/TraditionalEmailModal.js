import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { spacing } from "../theme/whatsapp";
import { BASE_URL } from "../api/client";
import { getAvatarInitials, getAvatarColor, formatPhoneNumber } from "../utils/contact";
import { openOrDownloadAttachment } from "../utils/attachment";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function TraditionalEmailModal({
  visible,
  message,
  onClose,
  onReplyInChat,
  onReplyTraditional,
  canReply = true,
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!message) return null;

  const senderRaw =
    message.from_name ||
    message.from_display ||
    message.counterpart_name ||
    (message.from_address ? message.from_address.split("@")[0] : "Unknown");

  const senderName = formatPhoneNumber(senderRaw);
  const avatarInitials = getAvatarInitials(senderName);
  const avatarBg = getAvatarColor(message.from_address || senderName);

  const formattedDate = message.created_at
    ? new Date(message.created_at).toLocaleString([], {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header Bar */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t("emailDetails")}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Subject */}
          <Text style={[styles.subject, { color: colors.textPrimary }]}>
            {message.subject || "(No Subject)"}
          </Text>

          {/* Meta Header Card */}
          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarText}>
                {avatarInitials}
              </Text>
            </View>

            <View style={styles.metaDetails}>
              <View style={styles.senderRow}>
                <Text style={[styles.senderName, { color: colors.textPrimary }]} numberOfLines={1}>{senderName}</Text>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formattedDate}</Text>
              </View>

              <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
                {t("fromLabel")}: {message.from_address}
              </Text>
              <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
                {t("toLabel")}: {message.to_address}
              </Text>
            </View>
          </View>

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <View style={styles.attachmentSection}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                {typeof t("attachmentsCount") === "function" ? t("attachmentsCount")(attachments.length) : `Attachments (${attachments.length})`}
              </Text>
              {attachments.map((att, idx) => {
                const downloadUrl = att.id ? `/mail/attachments/${att.id}/download` : att.url;
                const fullDownloadUrl = downloadUrl
                  ? downloadUrl.startsWith("http")
                    ? downloadUrl
                    : `${BASE_URL}${downloadUrl}`
                  : null;

                return (
                  <TouchableOpacity
                    key={att.id || idx}
                    style={[styles.attachmentItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => openAttachment(fullDownloadUrl, att.filename || att.original_name)}
                  >
                    <Ionicons name="document-attach-outline" size={20} color={colors.primaryLight} />
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {att.filename || att.original_name || "Attachment"}
                      </Text>
                      <Text style={[styles.attachmentSize, { color: colors.textSecondary }]}>{formatBytes(att.size)}</Text>
                    </View>
                    <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Full Email Body */}
          <View style={styles.bodyContainer}>
            <Text style={[styles.bodyText, { color: colors.textPrimary }]} selectable>
              {message.body_text || (message.body_html ? message.body_html.replace(/<[^>]+>/g, "") : "(No message body)")}
            </Text>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {canReply ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}
                onPress={() => {
                  onClose();
                  if (onReplyInChat) onReplyInChat(message);
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryLight} />
                <Text style={[styles.actionBtnSecondaryText, { color: colors.primaryLight }]}>{t("conversationReply")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: colors.primaryLight }]}
                onPress={() => {
                  onClose();
                  if (onReplyTraditional) onReplyTraditional(message);
                }}
              >
                <Ionicons name="mail-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>{t("formalReply")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.repliedNotice}>
              <Ionicons name="checkmark-circle" size={16} color={colors.textSecondary} />
              <Text style={[styles.repliedNoticeText, { color: colors.textSecondary }]}>
                {t("alreadyReplied")}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  subject: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  metaCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  metaDetails: {
    flex: 1,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  senderName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 11,
  },
  addressText: {
    fontSize: 12,
    marginTop: 1,
  },
  attachmentSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: 6,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: "600",
  },
  attachmentSize: {
    fontSize: 11,
  },
  bodyContainer: {
    paddingVertical: spacing.sm,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    borderTopWidth: 1,
    padding: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnPrimary: {},
  actionBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  repliedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  repliedNoticeText: {
    fontSize: 13,
    fontStyle: "italic",
  },
});
