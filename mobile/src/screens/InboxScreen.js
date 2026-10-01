import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { spacing, typography } from "../theme/whatsapp";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import SwipeReplyWrapper from "../components/SwipeReplyWrapper";
import { getThreads, updateThread } from "../api/client";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";

// Skeleton loader for thread rows
const SkeletonRow = ({ colors }) => (
  <View style={[styles.row, { backgroundColor: colors.card }]}>
    <View style={[styles.avatar, { backgroundColor: colors.chipInactive }]} />
    <View style={{ flex: 1 }}>
      <View style={[styles.rowTop, { marginBottom: 8 }]}>
        <View style={{ height: 14, width: "40%", backgroundColor: colors.chipInactive, borderRadius: 4 }} />
        <View style={{ height: 10, width: "15%", backgroundColor: colors.chipInactive, borderRadius: 4 }} />
      </View>
      <View style={{ height: 12, width: "70%", backgroundColor: colors.chipInactive, borderRadius: 4 }} />
    </View>
  </View>
);

// Unified Inbox + Sent, chat-style: every sender/group is a single thread.
export default function InboxScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [threads, setThreads]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState("");
  const [filter, setFilter]         = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getThreads({
        q: query || undefined,
        filter: filter === "all" ? undefined : filter,
      });
      setThreads(data);
    } catch (e) {
      console.log("[inbox] load error", e.message);
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sortedThreads = React.useMemo(() => {
    return [...threads].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (aPinned === 1) {
        const nameA = String(a.counterpart_name || a.counterpart || a.group_name || "").toLowerCase();
        const nameB = String(b.counterpart_name || b.counterpart || b.group_name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });
  }, [threads]);

  const handleTogglePin = async (item) => {
    const isPinned = Boolean(item.pinned);
    try {
      await updateThread(item.id, { pinned: isPinned ? 0 : 1 });
      load();
    } catch (err) {
      console.log("[inbox] toggle pin error", err.message);
    }
  };

  const handleLongPress = (item) => {
    const isPinned = Boolean(item.pinned);
    const counterpartName = item.is_group
      ? (item.group_name || item.counterpart || t("groupConversation"))
      : (item.counterpart_name || formatPhoneNumber(item.counterpart || ""));

    Alert.alert(
      counterpartName,
      undefined,
      [
        {
          text: isPinned ? (t("unpin") || "Unpin") : (t("pin") || "Pin"),
          onPress: () => handleTogglePin(item),
        },
        { text: t("cancel") || "Cancel", style: "cancel" },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isGroup = Boolean(item.is_group);
    const counterpartName = isGroup
      ? (item.group_name || item.counterpart || t("groupConversation"))
      : (item.counterpart_name || formatPhoneNumber(item.counterpart || ""));
    const initials = getAvatarInitials(counterpartName, isGroup);
    const avatarBg = getAvatarColor(item.counterpart || item.group_name);
    const isUnread = item.unread_count > 0;

    return (
      <SwipeReplyWrapper onReply={() => navigation.navigate("Chat", { thread: item, quickReply: true })}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate("Chat", { thread: item })}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.rowTop}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing.sm }}>
                {isGroup && (
                  <Ionicons name="people" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.name,
                    { color: colors.textPrimary, fontWeight: isUnread ? "700" : "600", marginRight: 0 },
                  ]}
                  numberOfLines={1}
                >
                  {counterpartName}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {Boolean(item.pinned) && (
                  <Ionicons name="pin" size={13} color={colors.accent} style={{ marginRight: 4, transform: [{ rotate: "45deg" }] }} />
                )}
                <Text style={[styles.time, { color: colors.textSecondary }]}>
                  {new Date(item.last_message_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </Text>
              </View>
            </View>
            <View style={styles.rowBottom}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing.sm }}>
                {item.has_attachments && (
                  <Ionicons name="attach" size={14} color={colors.textSecondary} style={{ marginRight: 2 }} />
                )}
                <Text
                  style={[
                    styles.preview,
                    { color: isUnread ? colors.textPrimary : colors.textSecondary, fontWeight: isUnread ? "600" : "400", marginRight: 0 },
                  ]}
                  numberOfLines={1}
                >
                  {item.last_message || item.subject || t("newConversation")}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.badgeText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </SwipeReplyWrapper>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer?.()} style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("appName")}</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <SearchBar value={query} onChangeText={setQuery} placeholder={t("searchPlaceholder")} />
      <FilterChips active={filter} onChange={setFilter} />

      {loading && threads.length === 0 ? (
        <View style={{ flex: 1 }}>
          <SkeletonRow colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <SkeletonRow colors={colors} />
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          <SkeletonRow colors={colors} />
        </View>
      ) : (
        <FlatList
          data={sortedThreads}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primaryLight]}
              tintColor={colors.primaryLight}
            />
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {filter === "favorites"
                ? t("noFavorites")
                : t("noConversations")}
            </Text>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate("Compose")}
      >
        <Ionicons name="chatbox-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
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
  menuBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  row: { flexDirection: "row", padding: spacing.md, alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 15, flex: 1, marginRight: spacing.sm },
  time: { fontSize: 11 },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  preview: { fontSize: 13, flex: 1, marginRight: spacing.sm },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  empty: { textAlign: "center", marginTop: spacing.xl },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
