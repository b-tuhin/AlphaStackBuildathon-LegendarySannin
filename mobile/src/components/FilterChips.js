import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { spacing } from "../theme/whatsapp";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "attachments", label: "Attachments" },
  { key: "favorites", label: "Important" },
];

export default function FilterChips({ active, onChange }) {
  const { colors } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityHint={f.key === "favorites" ? "Conversations with an important message" : undefined}
            style={[
              styles.chip,
              { backgroundColor: colors.chipInactive, borderColor: colors.border },
              isActive && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textPrimary }, isActive && { color: "#FFFFFF", fontWeight: "700" }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: spacing.sm, marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
});
