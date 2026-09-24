import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { login, setToken } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";

export default function PasswordLoginScreen({ route, navigation }) {
  const [phone, setPhone] = useState(route.params?.phone || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return Alert.alert("Invalid number", "Enter a valid phone number.");
    setLoading(true);
    try {
      const { data } = await login(digits, password);
      await setToken(data.token);
      if (data.mustChangePassword) navigation.replace("ChangePassword");
      else navigation.getParent()?.replace("MainApp");
    } catch (err) {
      Alert.alert("Login failed", err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use your phone number and password.</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.prefix}>+</Text>
        <TextInput
          style={styles.phoneInput}
          placeholder="Phone number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>
      <PasswordInput value={password} onChangeText={setPassword} autoComplete="password" />
      <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword", { phone })}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Sign in</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("PhoneInput")} style={{ marginTop: spacing.lg }}>
        <Text style={styles.link}>New here? Create an account</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground, padding: spacing.lg },
  title: { ...typography.title, marginTop: spacing.xl },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xl },
  phoneRow: {
    flexDirection: "row", alignItems: "center", borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight, paddingBottom: spacing.sm, marginBottom: spacing.lg,
  },
  prefix: { fontSize: 20, marginRight: spacing.sm, color: colors.textPrimary },
  phoneInput: { flex: 1, fontSize: 20, color: colors.textPrimary },
  link: { color: colors.primaryLight, fontWeight: "600", textAlign: "center", marginBottom: spacing.md },
  cta: { backgroundColor: colors.primary, marginTop: spacing.md, padding: spacing.md, borderRadius: 24, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
