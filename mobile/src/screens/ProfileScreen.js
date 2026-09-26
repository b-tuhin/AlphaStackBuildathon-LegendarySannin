import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Switch,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { spacing, typography } from "../theme/whatsapp";
import { getMe, updateMe, addAlias, clearToken, clearRefreshToken } from "../api/client";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";
import LanguagePickerModal from "../components/LanguagePickerModal";

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, lang, langLabel, setLang, supportedLanguages } = useI18n();

  const [me, setMe] = useState(null);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [langModalVisible, setLangModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getMe();
        setMe(data);
        setName(data.display_name || "");
      } catch {}
    })();
  }, []);

  const saveName = async () => {
    try {
      await updateMe(name);
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.error || err.message);
    }
  };

  const submitAlias = async () => {
    if (!alias.trim()) return;
    try {
      const { data } = await addAlias(alias.trim().toLowerCase());
      setMe({ ...me, aliases: data.aliases });
      setAlias("");
      Alert.alert("Success", "Alias added successfully.");
    } catch (e) {
      Alert.alert("Couldn't add alias", e?.response?.data?.error || e.message);
    }
  };

  const handleSelectLanguage = (langCode) => {
    setLang(langCode);
  };

  const logout = async () => {
    Alert.alert(t("logOut"), t("logOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logOut"),
        style: "destructive",
        onPress: async () => {
          await clearToken();
          await clearRefreshToken();
          // Reset navigation safely to Onboarding
          const root = navigation.getParent()?.getParent() || navigation.getParent() || navigation;
          root.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });
        },
      },
    ]);
  };

  if (!me) return null;

  const displayName = name || me.phone;
  const initials = getAvatarInitials(displayName);
  const avatarBg = getAvatarColor(me.phone || me.email_address);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("profileSettings")}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.phoneText, { color: colors.textPrimary }]}>
            {formatPhoneNumber(me.phone)}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {me.email_address}
          </Text>
        </View>

        {/* Display Name Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("displayName")}</Text>
          <View style={[styles.inputRow, { borderBottomColor: colors.divider }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder={t("yourName")}
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity onPress={saveName} style={styles.saveBtn}>
              <Text style={[styles.link, { color: colors.accent }]}>{t("save")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alias IDs Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("aliasIds")}</Text>
          {(me.aliases || []).map((a) => (
            <Text key={a} style={[styles.aliasItem, { color: colors.textPrimary }]}>
              • {a}@phonemail.com
            </Text>
          ))}
          <View style={[styles.inputRow, { borderBottomColor: colors.divider, marginTop: 8 }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={alias}
              onChangeText={setAlias}
              placeholder={t("newAlias")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={submitAlias} style={styles.saveBtn}>
              <Text style={[styles.link, { color: colors.accent }]}>{t("add")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Preference Section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("language")}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("appLanguage")}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{langLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Appearance Section: Dark / Light Mode Switch */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("appearance")}</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("darkMode")}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {isDark ? t("darkThemeActive") : t("lightThemeActive")}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.chipInactive, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          style={[styles.logout, { borderColor: colors.danger }]}
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>{t("logOut")}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Picker Modal */}
      <LanguagePickerModal
        visible={langModalVisible}
        selectedLang={lang}
        onSelect={handleSelectLanguage}
        onClose={() => setLangModalVisible(false)}
        title={t("chooseLanguage")}
        data={supportedLanguages}
        showCode={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    height: 56,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  avatarWrap: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  phoneText: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  email: { fontSize: 14, marginTop: 2 },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: spacing.xs },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: spacing.xs,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 6 },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  link: { fontWeight: "700", fontSize: 14 },
  aliasItem: { fontSize: 14, marginVertical: 3 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  settingTitle: { fontSize: 15, fontWeight: "600" },
  logout: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { fontWeight: "700", fontSize: 15 },
});
