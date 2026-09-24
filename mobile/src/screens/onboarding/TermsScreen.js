import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/whatsapp";

export default function TermsScreen({ navigation }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.title}>Terms & Privacy Policy</Text>
        <Text style={styles.body}>
          PhoneMail uses your phone number as your email address (yournumber@phonemail.com).
          By continuing you agree that we may send you an OTP via SMS or an automated call to
          verify your number, that messages sent to your PhoneMail address may trigger an SMS
          notification if you don't have the app installed, and that your phone number will be
          visible to people you message. Read the full Terms of Service and Privacy Policy on
          our website before proceeding.
        </Text>

        <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
          <Ionicons
            name={agreed ? "checkbox" : "square-outline"}
            size={22}
            color={colors.primary}
          />
          <Text style={styles.checkText}>
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, !agreed && styles.ctaDisabled]}
        disabled={!agreed}
        onPress={() => navigation.navigate("PhoneInput")}
      >
        <Text style={styles.ctaText}>Agree and continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  title: { ...typography.title, marginBottom: spacing.md },
  body: { ...typography.body, lineHeight: 22, color: colors.textSecondary },
  checkRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  checkText: { ...typography.body, marginLeft: spacing.sm, flex: 1 },
  cta: {
    backgroundColor: colors.primary, margin: spacing.lg, padding: spacing.md,
    borderRadius: 24, alignItems: "center",
  },
  ctaDisabled: { backgroundColor: colors.chipInactive },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
