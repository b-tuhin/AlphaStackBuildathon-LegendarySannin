import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/whatsapp";

const TERMS_URL = "https://phonemail.com/terms.html"; // deep-link to web ToS

export default function TermsScreen({ navigation }) {
  const [agreed, setAgreed] = useState(false);

  const openFullTerms = () => {
    // Opens the full terms page in the device browser as a complement to the
    // in-app summary below.
    Linking.openURL(TERMS_URL).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.title}>Terms &amp; Privacy Policy</Text>

        <Text style={styles.sectionHead}>What PhoneMail is</Text>
        <Text style={styles.body}>
          PhoneMail gives you an email address based on your phone number
          ({"\u003c"}yournumber{"\u003e"}@phonemail.com). You can send and receive email from
          the app or any standard email client.
        </Text>

        <Text style={styles.sectionHead}>Your account</Text>
        <Text style={styles.body}>
          You must be 13 or older to create an account. You are responsible for
          keeping your password secure and for all activity under your account.
        </Text>

        <Text style={styles.sectionHead}>SMS notifications</Text>
        <Text style={styles.body}>
          If you don&apos;t have the app installed (or haven&apos;t granted push
          permissions), PhoneMail may send you an SMS when you receive an email.
          By creating an account you consent to receiving these transactional
          messages. Standard carrier rates may apply.
        </Text>

        <Text style={styles.sectionHead}>Data we collect</Text>
        <Text style={styles.bullet}>• Phone number (your identity &amp; email address)</Text>
        <Text style={styles.bullet}>• Password (stored as a bcrypt hash — never readable)</Text>
        <Text style={styles.bullet}>• Email content (to power your inbox)</Text>
        <Text style={styles.bullet}>• Device push tokens (for push notifications, if granted)</Text>
        <Text style={styles.bullet}>• Login metadata (rate-limiting only; not shared)</Text>

        <Text style={styles.sectionHead}>Data we do NOT collect</Text>
        <Text style={styles.bullet}>• We do not track your location</Text>
        <Text style={styles.bullet}>• We do not sell your data</Text>
        <Text style={styles.bullet}>• We do not serve advertising</Text>

        <Text style={styles.sectionHead}>Third-party services</Text>
        <Text style={styles.body}>
          PhoneMail uses Twilio to deliver SMS. Your phone number is shared with
          Twilio solely for message delivery. See Twilio&apos;s privacy policy at
          twilio.com/legal/privacy.
        </Text>

        <Text style={styles.sectionHead}>Acceptable use</Text>
        <Text style={styles.body}>
          You may not use PhoneMail to send spam, distribute malware, harass others,
          or violate any applicable law.
        </Text>

        <TouchableOpacity onPress={openFullTerms} style={styles.linkRow}>
          <Ionicons name="open-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.link}>Read the full Terms of Service &amp; Privacy Policy</Text>
        </TouchableOpacity>

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
        onPress={() =>
          // Pass tosAccepted flag so CreatePasswordScreen can forward it to /auth/register
          navigation.navigate("PhoneInput", { tosAccepted: true })
        }
      >
        <Text style={styles.ctaText}>Agree and continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  title: { ...typography.title, marginBottom: spacing.md },
  sectionHead: {
    fontSize: 14, fontWeight: "700", color: colors.textPrimary,
    marginTop: spacing.lg, marginBottom: spacing.xs ?? 4,
  },
  body: { ...typography.body, lineHeight: 22, color: colors.textSecondary },
  bullet: { ...typography.body, lineHeight: 22, color: colors.textSecondary, marginLeft: spacing.sm },
  linkRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs ?? 4,
    marginTop: spacing.xl, marginBottom: spacing.md,
  },
  link: { color: colors.primaryLight, fontWeight: "600", fontSize: 14 },
  checkRow: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.lg,
    gap: spacing.sm,
  },
  checkText: { ...typography.body, marginLeft: spacing.sm, flex: 1 },
  cta: {
    backgroundColor: colors.primary, margin: spacing.lg, padding: spacing.md,
    borderRadius: 24, alignItems: "center",
  },
  ctaDisabled: { backgroundColor: colors.chipInactive },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
