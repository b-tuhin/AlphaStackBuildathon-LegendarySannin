import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { spacing, typography } from "../theme/whatsapp";
import { getEmails, getThreads, updateEmail, updateThread } from "../api/client";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";
import TraditionalEmailModal from "../components/TraditionalEmailModal";

export default function FolderListScreen({ folder, title, emptyLabel, navigation }) {
  const { colors } = useTheme();
  const [emails, setEmails] = useState([]);
  const [selectedModalMsg, setSelectedModalMsg] = useState(null);

  const isThreadFolder = folder === "trash" || folder === "spam";

  const load = useCallback(async () => {
    try {
      if (isThreadFolder) {
        const { data } = await getThreads({ folder });
        setEmails(data);
      } else {
        const { data } = await getEmails({ folder });
        setEmails(data);
      }
    } catch {}
  }, [folder, isThreadFolder]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = async (item) => {
    const isThread = Boolean(item.participant_a || item.participants || item.counterpart);
    if (isThread) {
      await updateThread(item.id, { folder: "home" });
    } else {
      await updateEmail(item.id, { folder: "home" });
    }
    load();
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Inbox");
    }
  };

  const handleItemPress = (item) => {
    if (folder === "drafts") {
      navigation.navigate("Compose", {
        initialTo: item.to_address,
        initialSubject: item.subject,
        initialBody: item.body_text,
        draftId: item.id,
      });
    } else if (item.participant_a || item.participants || item.counterpart) {
      navigation.navigate("Chat", { thread: item, folder });
    } else {
      setSelectedModalMsg(item);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={handleGoBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {folder === "important" && <Ionicons name="star" size={20} color="#f59e0b" />}
          {folder === "spam" && <Ionicons name="alert-circle-outline" size={20} color="#fff" />}
          {folder === "trash" && <Ionicons name="trash-outline" size={20} color="#fff" />}
          {folder === "drafts" && <Ionicons name="document-text-outline" size={20} color="#fff" />}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={emails}
        keyExtractor={(e) => e.id}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{emptyLabel}</Text>
        }
        renderItem={({ item }) => {
          const isThread = Boolean(item.participant_a || item.participants || item.counterpart);
          const counterpart = isThread
            ? item.counterpart
            : (folder === "drafts" ? item.to_address : item.from_address);
          const counterpartName = isThread
            ? (item.counterpart_name || formatPhoneNumber(counterpart))
            : (item.from_name || item.from_display || formatPhoneNumber(counterpart));
          const initials = getAvatarInitials(counterpartName, isThread ? item.is_group : false);
          const avatarBg = getAvatarColor(counterpart);
          const dateStr = item.last_message_at || item.created_at;
          const formattedDate = dateStr
            ? new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
            : "";
          const snippet = isThread
            ? (item.last_message || item.subject || "")
            : (item.body_text || "");

          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card }]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Text style={[styles.subject, { color: colors.textPrimary }]} numberOfLines={1}>
                    {counterpartName}
                  </Text>
                  <Text style={[styles.date, { color: colors.textSecondary }]}>
                    {formattedDate}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {item.has_attachments && (
                    <Ionicons name="attach" size={14} color={colors.textSecondary} style={{ marginRight: 2 }} />
                  )}
                  <Text style={[styles.titleText, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                    {item.subject || "(no subject)"}
                  </Text>
                </View>

                <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                  {snippet}
                </Text>
              </View>

              {folder !== "home" && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    restore(item);
                  }}
                  style={styles.restoreBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  title="Restore to Inbox"
                >
                  <Ionicons name="arrow-undo" size={20} color={colors.accent} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <TraditionalEmailModal
        visible={Boolean(selectedModalMsg)}
        message={selectedModalMsg}
        onClose={() => setSelectedModalMsg(null)}
        onReplyInChat={() => {
          setSelectedModalMsg(null);
          navigation.navigate("Inbox");
        }}
        onReplyTraditional={(msg) => {
          setSelectedModalMsg(null);
          navigation.navigate("Compose", {
            lockedRecipient: {
              email_address: msg.from_address,
              display_name: msg.from_name,
            },
            initialSubject: `Re: ${msg.subject || ""}`,
            inReplyTo: msg.message_id || msg.id,
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    height: 56,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  subject: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  titleText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  date: { fontSize: 11 },
  preview: { fontSize: 12, marginTop: 2 },
  restoreBtn: { padding: spacing.sm, marginLeft: 4 },
  separator: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: "center", marginTop: spacing.xl, fontSize: 14 },
});
