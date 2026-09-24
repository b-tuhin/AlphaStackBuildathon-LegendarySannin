import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, typography } from "../theme/whatsapp";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import SwipeReplyWrapper from "../components/SwipeReplyWrapper";
import { getThreads } from "../api/client";

// Unified Inbox + Sent, chat-style: every sender/group is a single thread.
export default function InboxScreen({ navigation }) {
  const [threads, setThreads] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getThreads({ q: query || undefined, filter: filter === "all" ? undefined : filter });
      setThreads(data);
    } catch (e) {
      console.log("[inbox] load error", e.message);
    }
  }, [query, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <SwipeReplyWrapper onReply={() => navigation.navigate("Chat", { thread: item, quickReply: true })}>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("Chat", { thread: item })}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.is_group ? "G" : (item.counterpart || "?").charAt(0)).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.is_group ? `Group: ${item.counterpart}` : item.counterpart}
            </Text>
            <Text style={styles.time}>{new Date(item.last_message_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.preview} numberOfLines={1}>
              {item.has_attachments ? "📎 " : ""}{item.last_message || item.subject || "New conversation"}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeReplyWrapper>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer?.()} style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PhoneMail</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, number or subject" />
      <FilterChips active={filter} onChange={setFilter} />

      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet. Tap + to compose.</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("Compose")}>
        <Ionicons name="chatbox-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: {
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: spacing.md, height: 56,
  },
  menuBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  row: { flexDirection: "row", padding: spacing.md, alignItems: "center" },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginRight: spacing.md,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  name: { ...typography.body, fontWeight: "600", flex: 1, marginRight: spacing.sm },
  time: { ...typography.caption },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  preview: { ...typography.caption, flex: 1, marginRight: spacing.sm },
  badge: { backgroundColor: colors.unreadBadge, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: { height: 1, backgroundColor: colors.divider, marginLeft: 76 },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textSecondary },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", elevation: 4,
  },
});
