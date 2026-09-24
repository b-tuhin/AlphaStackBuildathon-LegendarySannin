import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { colors, spacing } from "../theme/whatsapp";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "attachments", label: "Attachments" },
  { key: "favorites", label: "Favorites" },
];

export default function FilterChips({ active, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: spacing.sm, marginBottom: spacing.xs },
  chip: {
    backgroundColor: colors.chipInactive, paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: 16, marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.chipActive },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
});
