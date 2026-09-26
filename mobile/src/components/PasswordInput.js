import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { spacing } from "../theme/whatsapp";

export default function PasswordInput({ value, onChangeText, placeholder = "Password", autoComplete }) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.primaryLight }]}>
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoComplete={autoComplete}
      />
      <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={8}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  input: { flex: 1, fontSize: 18, paddingRight: spacing.sm },
});
