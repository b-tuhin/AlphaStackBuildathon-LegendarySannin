import React, { useEffect, useState } from "react";
import { SafeAreaView, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { checkPhoneOtp, startPhoneOtp } from "../../api/client";

export default function PhoneOtpScreen({ route, navigation }) {
  const { phone, tosAccepted = false } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil((60000 - (Date.now() - (route.params.requestedAt || Date.now()))) / 1000)));
  useEffect(() => {
    if (!seconds) return undefined;
    const timer = setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const verify = async () => {
    if (code.length < 4) return Alert.alert("Enter code", "Type the verification code sent by SMS.");
    setLoading(true);
    try {
      const { data } = await checkPhoneOtp(phone, code, "signup");
      if (!data.signupGrant) throw new Error("Phone verification did not return a signup grant.");
      navigation.replace("CreatePassword", { phone, tosAccepted: tosAccepted === true, signupGrant: data.signupGrant });
    } catch (err) {
      Alert.alert("Code not accepted", err?.response?.data?.error || err.message || "Check the code and try again.");
    } finally { setLoading(false); }
  };
  const resend = async () => {
    setLoading(true);
    try { await startPhoneOtp(phone, "signup"); setSeconds(60); setCode(""); }
    catch (err) { Alert.alert("Couldn't resend code", err?.response?.data?.error || err.message); }
    finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Enter your verification code</Text>
      <Text style={styles.subtitle}>We sent a one-time code to {phone}. Your device may offer to autofill it.</Text>
      <TextInput style={styles.code} placeholder="6-digit code" keyboardType="number-pad" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 10))} maxLength={10} textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus />
      <TouchableOpacity style={styles.cta} onPress={verify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Next</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={resend} disabled={loading || seconds > 0} style={styles.resend}>
        <Text style={styles.link}>{seconds ? `Resend code in ${seconds}s` : "Resend code"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.resend}><Text style={styles.link}>Change phone number</Text></TouchableOpacity>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  code: { borderBottomWidth: 2, borderBottomColor: colors.primaryLight, fontSize: 24, letterSpacing: 5, paddingVertical: spacing.md, color: colors.textPrimary },
  cta: { backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resend: { alignItems: "center", marginTop: spacing.lg },
  link: { color: colors.primaryLight, fontWeight: "600" },
});
