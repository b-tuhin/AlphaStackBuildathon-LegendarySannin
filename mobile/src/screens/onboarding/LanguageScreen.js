import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme/whatsapp";
import { useI18n } from "../../i18n/I18nContext";

export default function LanguageScreen({ navigation }) {
  const { t, lang, setLang, supportedLanguages } = useI18n();

  const handleSelect = (item) => {
    setLang(item.code);
  };

  const handleContinue = () => {
    navigation.navigate("Terms");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubble-ellipses" size={56} color={colors.primary} />
        <Text style={styles.title}>{t("chooseLanguage")}</Text>
        <Text style={styles.subtitle}>{t("changeLanguageLater")}</Text>
      </View>

      <FlatList
        data={supportedLanguages}
        keyExtractor={(item) => item.code}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => {
          const isSelected = item.code === lang;
          return (
            <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
              <Text style={[styles.rowText, isSelected && { fontWeight: "700", color: colors.primary }]}>
                {item.label}
              </Text>
              {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primaryLight} />}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.8}>
        <Text style={styles.ctaText}>{t("continue")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: { alignItems: "center", paddingVertical: spacing.xl },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowText: { ...typography.body },
  cta: {
    backgroundColor: colors.primary, margin: spacing.lg, padding: spacing.md,
    borderRadius: 24, alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
