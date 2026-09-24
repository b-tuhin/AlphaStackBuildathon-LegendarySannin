import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { setPassword } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import { passwordStrength } from "../../utils/passwordStrength";

export default function ChangePasswordScreen({ navigation }) {
  const [password, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password);

  const submit = async () => {
    if (password.length < 8) return Alert.alert("Weak password", "Use at least 8 characters.");
    if (password !== confirm) return Alert.alert("Mismatch", "Passwords do not match.");
    setLoading(true);
    try {
      await setPassword(password, confirm);
      const root = navigation.getParent() || navigation;
      root.replace("MainApp");
    } catch (err) {
      Alert.alert("Couldn't save password", err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Choose a new password</Text>
      <Text style={styles.subtitle}>Temporary passwords from SMS or phone signup must be changed before you continue.</Text>
      <PasswordInput value={password} onChangeText={setPw} placeholder="New password" />
      {!!password && <Text style={{ color: strength.color, marginBottom: spacing.sm }}>{strength.label}</Text>}
      <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Confirm password" />
      <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Save password</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  cta: { backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
