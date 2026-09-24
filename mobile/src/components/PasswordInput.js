import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme/whatsapp";

export default function PasswordInput({ value, onChangeText, placeholder = "Password", autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
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
    borderBottomColor: colors.primaryLight,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  input: { flex: 1, fontSize: 18, paddingRight: spacing.sm },
});
