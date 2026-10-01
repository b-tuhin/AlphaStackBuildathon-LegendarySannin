import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { requestPasswordReset, confirmPasswordReset } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import { passwordStrength } from "../../utils/passwordStrength";

export default function ForgotPasswordScreen({ route, navigation }) {
  const [phone, setPhone] = useState(route.params?.phone || "");
  const [step, setStep] = useState("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password);

  const requestCode = async () => {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return Alert.alert("Invalid number", "Enter a valid phone number.");
    setLoading(true);
    try {
      await requestPasswordReset(phone);
      Alert.alert("Check your messages", "If that number has an account, we sent a reset code by SMS.");
      setStep("confirm");
    } catch (err) {
      Alert.alert("Couldn't send code", err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (password.length < 8) return Alert.alert("Weak password", "Use at least 8 characters.");
    if (password !== confirm) return Alert.alert("Mismatch", "Passwords do not match.");
    setLoading(true);
    try {
      const digits = phone.replace(/[^\d]/g, "");
      await confirmPasswordReset(phone, code, password, confirm);
      Alert.alert("Password updated", "Sign in with your new password.");
          navigation.replace("PasswordLogin", { phone });
    } catch (err) {
      Alert.alert("Reset failed", err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      {step === "request" ? (
        <>
          <Text style={styles.subtitle}>We'll send a reset code by SMS.</Text>
          <View style={styles.phoneRow}>
              <TextInput
              style={styles.phoneInput}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <TouchableOpacity style={styles.cta} onPress={requestCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Send code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Enter the code sent to {phone} and choose a new password.</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
          <PasswordInput value={password} onChangeText={setPassword} placeholder="New password" />
          {!!password && <Text style={{ color: strength.color, marginBottom: spacing.sm }}>{strength.label}</Text>}
          <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Confirm password" />
          <TouchableOpacity style={styles.cta} onPress={confirmReset} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Set new password</Text>}
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  phoneRow: {
    flexDirection: "row", alignItems: "center", borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight, paddingBottom: spacing.sm,
  },
  prefix: { fontSize: 20, marginRight: spacing.sm, color: colors.textPrimary },
  phoneInput: { flex: 1, fontSize: 20, color: colors.textPrimary },
  codeInput: { borderBottomWidth: 2, borderBottomColor: colors.primaryLight, fontSize: 22, letterSpacing: 4, marginBottom: spacing.lg },
  cta: { backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
