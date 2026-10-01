import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { registerAccount, setToken, setRefreshToken, registerDevice } from "../../api/client";
import { Platform } from "react-native";
import PasswordInput from "../../components/PasswordInput";
import { passwordStrength } from "../../utils/passwordStrength";

export default function CreatePasswordScreen({ route, navigation }) {
  const { phone, tosAccepted = false, signupGrant, phoneOtpRequired = true } = route.params;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password);
  const submit = async () => {
    if (password.length < 8) return Alert.alert("Weak password", "Use at least 8 characters.");
    if (password !== confirm) return Alert.alert("Mismatch", "Passwords do not match.");
    if (!tosAccepted || (phoneOtpRequired && !signupGrant)) return Alert.alert("Verification required", "Accept the Terms and verify your phone before creating an account.");
    setLoading(true);
    try {
      const { data } = await registerAccount(phone, password, confirm, true, signupGrant);
      await setToken(data.token);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      await registerDevice(Platform.OS === "ios" ? "ios" : "android", null).catch(() => {});
      setPassword(""); setConfirm("");
      navigation.getParent()?.replace("MainApp");
    } catch (err) {
      Alert.alert("Couldn't create account", err?.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create a password</Text>
      <Text style={styles.subtitle}>You’ll use this with {phone} to sign in.</Text>
      <PasswordInput value={password} onChangeText={setPassword} placeholder="Password" autoComplete="password-new" />
      {!!password && <View style={styles.meterWrap}><View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${strength.percent}%`, backgroundColor: strength.color }]} /></View><Text style={[styles.meterLabel, { color: strength.color }]}>{strength.label}</Text></View>}
      <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Confirm password" autoComplete="password-new" />
      <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Create account</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  meterWrap: { marginTop: -spacing.sm, marginBottom: spacing.md },
  meterTrack: { height: 6, backgroundColor: colors.chipInactive, borderRadius: 4, overflow: "hidden" },
  meterFill: { height: "100%" },
  meterLabel: { fontSize: 12, marginTop: 4 },
  cta: { backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
