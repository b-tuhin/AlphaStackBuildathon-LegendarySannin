import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { verifyOtp, requestOtp, setToken } from "../../api/client";

// Auto-verifies once 6 digits are entered — no separate "submit" tap needed.
export default function OtpScreen({ route, navigation }) {
  const { phone, devCode } = route.params;
  const [code, setCode] = useState(devCode || "");
  const [loading, setLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (code.length === 6) submit(code);
  }, [code]);

  const submit = async (otp) => {
    setLoading(true);
    try {
      const { data } = await verifyOtp(phone, otp);
      await setToken(data.token);
      navigation.getParent()?.replace("MainApp");
    } catch (err) {
      const fb = err?.response?.data?.fallbackToPassword;
      if (fb) setNeedsPassword(true);
      Alert.alert("Verification failed", err?.response?.data?.error || err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    const { data } = await requestOtp(phone);
    if (data.devCode) Alert.alert("Dev OTP", `Code: ${data.devCode}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to +{phone}</Text>

      <TextInput
        ref={inputRef}
        style={styles.otpInput}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        autoFocus
        placeholder="••••••"
      />

      {loading && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}

      <TouchableOpacity onPress={resend} style={{ marginTop: spacing.lg }}>
        <Text style={styles.link}>Resend code</Text>
      </TouchableOpacity>

      {needsPassword && (
        <TouchableOpacity onPress={() => navigation.replace("PasswordLogin", { phone })} style={{ marginTop: spacing.sm }}>
          <Text style={styles.link}>Use password instead</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  otpInput: {
    fontSize: 32, letterSpacing: 12, textAlign: "center", borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight, paddingBottom: spacing.sm,
  },
  link: { color: colors.primaryLight, fontWeight: "600", textAlign: "center" },
});
