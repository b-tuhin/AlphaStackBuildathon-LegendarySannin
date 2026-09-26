import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { tryReadSimPhone } from "../../utils/simPhone";

export default function PhoneInputScreen({ route, navigation }) {
  const tosAccepted = route.params?.tosAccepted ?? false;
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      const sim = await tryReadSimPhone();
      if (sim) setPhone((current) => current || sim);
    })();
  }, []);

  const submit = () => {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 7) return Alert.alert("Invalid number", "Enter a valid phone number.");
    navigation.navigate("CreatePassword", { phone: digits, tosAccepted });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>
        This becomes your email address. We'll fill it from your SIM if you allow it — you can still edit it.
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

      <TouchableOpacity style={styles.cta} onPress={submit}>
        <Text style={styles.ctaText}>Next</Text>
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
  link: { color: colors.primaryLight, fontWeight: "600", textAlign: "center" },
});
