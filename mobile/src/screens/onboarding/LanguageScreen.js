import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/whatsapp";

const LANGUAGES = ["English", "हिन्दी", "தமிழ்", "తెలుగు", "বাংলা", "मराठी", "ਪੰਜਾਬੀ", "ગુજરાતી"];

export default function LanguageScreen({ navigation }) {
  const [selected, setSelected] = useState("English");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubble-ellipses" size={56} color={colors.primary} />
        <Text style={styles.title}>Choose your language</Text>
        <Text style={styles.subtitle}>You can change this later in Settings</Text>
      </View>

      <FlatList
        data={LANGUAGES}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
            <Text style={styles.rowText}>{item}</Text>
            {selected === item && <Ionicons name="checkmark-circle" size={22} color={colors.primaryLight} />}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate("Terms")}>
        <Text style={styles.ctaText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: { alignItems: "center", paddingVertical: spacing.xl },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowText: { ...typography.body },
  cta: {
    backgroundColor: colors.primary, margin: spacing.lg, padding: spacing.md,
    borderRadius: 24, alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
