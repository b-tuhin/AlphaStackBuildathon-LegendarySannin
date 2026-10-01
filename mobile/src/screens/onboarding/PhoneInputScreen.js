import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { tryReadSimPhone } from "../../utils/simPhone";
import { startPhoneOtp } from "../../api/client";

export default function PhoneInputScreen({ route, navigation }) {
  const tosAccepted = route.params?.tosAccepted === true;
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    (async () => {
      const sim = await tryReadSimPhone();
      if (sim) setPhone((current) => current || (sim.startsWith("91") && sim.length > 10 ? `+${sim}` : sim));
    })();
  }, []);
  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return Alert.alert("Invalid number", "Enter a valid phone number, including the country code.");
    setLoading(true);
    try {
      const { data } = await startPhoneOtp(phone, "signup");
      if (data.mode === "password") navigation.navigate("CreatePassword", { phone, tosAccepted, phoneOtpRequired: false });
      else navigation.navigate("PhoneOtp", { phone, tosAccepted, phoneOtpRequired: true, requestedAt: Date.now() });
    } catch (err) {
      Alert.alert("Couldn't send code", err?.response?.data?.error || err.message || "Try again later.");
    } finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>This becomes your email address. We’ll fill it from your SIM if available — you can still edit it. Include +country code for numbers outside India.</Text>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="+91 98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoFocus autoComplete="tel" textContentType="telephoneNumber" />
      </View>
      <Text style={styles.hint}>Your PhoneMail address will be {phone.replace(/\D/g, "") || "……"}@phonemail.com</Text>
      <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Next</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("PasswordLogin")} style={{ marginTop: spacing.lg }}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  inputRow: { borderBottomWidth: 2, borderBottomColor: colors.primaryLight, paddingBottom: spacing.sm },
  input: { flex: 1, fontSize: 20, color: colors.textPrimary },
  hint: { ...typography.caption, marginTop: spacing.md },
  cta: { backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: colors.primaryLight, fontWeight: "600", textAlign: "center" },
});
