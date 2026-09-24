import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme/whatsapp";

export default function SearchBar({ value, onChangeText, placeholder = "Search" }) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.chipInactive,
    borderRadius: 10, paddingHorizontal: spacing.md, marginHorizontal: spacing.md,
    marginTop: spacing.sm, height: 40,
  },
  input: { flex: 1, marginLeft: spacing.sm, fontSize: 15, color: colors.textPrimary },
});
