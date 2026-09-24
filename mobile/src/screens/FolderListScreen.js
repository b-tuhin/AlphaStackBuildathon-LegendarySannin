import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, typography } from "../theme/whatsapp";
import { getEmails, updateEmail } from "../api/client";

// Generic folder view reused by Drafts / Spam / Trash.
export default function FolderListScreen({ folder, title, emptyLabel, navigation }) {
  const [emails, setEmails] = useState([]);

  const load = useCallback(async () => {
    const { data } = await getEmails({ folder });
    setEmails(data);
  }, [folder]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = async (id) => {
    await updateEmail(id, { folder: "home" });
    load();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={emails}
        keyExtractor={(e) => e.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>{emptyLabel}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subject} numberOfLines={1}>{item.subject || "(no subject)"}</Text>
              <Text style={styles.preview} numberOfLines={1}>{item.to_address}: {item.body_text}</Text>
            </View>
            {folder !== "home" && (
              <TouchableOpacity onPress={() => restore(item.id)} style={styles.restoreBtn}>
                <Ionicons name="arrow-undo" size={18} color={colors.primaryLight} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: {
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: spacing.md, height: 56,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  subject: { ...typography.body, fontWeight: "600" },
  preview: { ...typography.caption, marginTop: 2 },
  restoreBtn: { padding: spacing.sm },
  separator: { height: 1, backgroundColor: colors.divider },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textSecondary },
});
