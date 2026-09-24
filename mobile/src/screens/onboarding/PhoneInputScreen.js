import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { requestOtp } from "../../api/client";

export default function PhoneInputScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return Alert.alert("Invalid number", "Enter a valid phone number.");
    setLoading(true);
    try {
      const { data } = await requestOtp(digits);
      navigation.navigate("Otp", { phone: digits, devCode: data.devCode });
    } catch (err) {
      Alert.alert("Couldn't send OTP", err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>
        PhoneMail needs to verify your phone number. This becomes your email address.
      </Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>+</Text>
        <TextInput
          style={styles.input}
          placeholder="91 98765 43210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />
      </View>
      <Text style={styles.hint}>Your PhoneMail address will be {phone.replace(/[^\d]/g, "") || "……"}@phonemail.com</Text>

      <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Next</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  inputRow: {
    flexDirection: "row", alignItems: "center", borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight, paddingBottom: spacing.sm,
  },
  prefix: { fontSize: 20, marginRight: spacing.sm, color: colors.textPrimary },
  input: { flex: 1, fontSize: 20, color: colors.textPrimary },
  hint: { ...typography.caption, marginTop: spacing.md },
  cta: {
    backgroundColor: colors.primary, marginTop: spacing.xl, padding: spacing.md,
    borderRadius: 24, alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
