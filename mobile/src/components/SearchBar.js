import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { spacing } from "../theme/whatsapp";

export default function SearchBar({ value, onChangeText, placeholder = "Search" }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    height: 40,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 15,
  },
});
