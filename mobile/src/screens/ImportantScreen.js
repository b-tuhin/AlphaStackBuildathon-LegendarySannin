import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { spacing, typography } from "../theme/whatsapp";
import { getImportantMessages, updateEmail } from "../api/client";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";

export default function ImportantScreen({ navigation }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getImportantMessages();
      setMessages(data || []);
    } catch (e) {
      console.error("[ImportantScreen] load error", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Inbox");
    }
  };

  const handleItemPress = (item) => {
    if (item.thread) {
      navigation.navigate("Chat", {
        thread: item.thread,
        scrollToMessageId: item.id,
      });
    }
  };

  const handleUnstar = async (item) => {
    try {
      await updateEmail(item.id, { is_favorite: 0 });
      setMessages((prev) => prev.filter((m) => m.id !== item.id));
    } catch (e) {
      console.error("[ImportantScreen] unstar error", e?.message);
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
          <Ionicons name="star" size={20} color="#f59e0b" />
          <Text style={styles.headerTitle}>Important Messages</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primaryLight]} />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star" size={48} color="#f59e0b" style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No important messages yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Tap the star on any message to save it here for quick access.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const counterpart = item.is_group
            ? item.counterpart_name || "Group"
            : item.from_name || item.from_display || item.counterpart_name || formatPhoneNumber(item.from_address || item.counterpart || "");

          const initials = getAvatarInitials(counterpart);
          const avatarBg = getAvatarColor(item.from_address || item.counterpart || "contact");
          const dateStr = new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" });
          const snippet = item.body_text || (item.body_html ? item.body_html.replace(/<[^>]+>/g, "") : item.subject || "");

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
                <View style={styles.topRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                    {item.is_group && (
                      <Ionicons name="people" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.nameText, { color: colors.textPrimary, flex: 1, marginRight: 0 }]} numberOfLines={1}>
                      {counterpart}
                    </Text>
                  </View>
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                    {dateStr}
                  </Text>
                </View>

                {Boolean(item.subject) && item.subject !== "(no subject)" && (
                  <View style={styles.subjectBadgeWrap}>
                    <Text style={[styles.subjectBadgeText, { color: colors.primaryLight, backgroundColor: colors.chipInactive }]} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  </View>
                )}

                <Text style={[styles.snippetText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {snippet}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleUnstar(item)}
                style={styles.starBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="star" size={20} color="#f59e0b" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  separator: { height: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 11,
  },
  subjectBadgeWrap: {
    flexDirection: "row",
    marginBottom: 2,
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  snippetText: {
    fontSize: 13,
  },
  starBtn: {
    marginLeft: 10,
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
});
