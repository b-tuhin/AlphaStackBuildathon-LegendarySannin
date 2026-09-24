import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/whatsapp";
import { getMe, updateMe, addAlias, clearToken } from "../api/client";

export default function ProfileScreen({ navigation }) {
  const [me, setMe] = useState(null);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await getMe();
      setMe(data);
      setName(data.display_name || "");
    })();
  }, []);

  const saveName = async () => {
    await updateMe(name);
    Alert.alert("Saved");
  };

  const submitAlias = async () => {
    if (!alias) return;
    try {
      const { data } = await addAlias(alias);
      setMe({ ...me, aliases: data.aliases });
      setAlias("");
    } catch (e) {
      Alert.alert("Couldn't add alias", e?.response?.data?.error || e.message);
    }
  };

  const logout = async () => {
    await clearToken();
    navigation.getParent()?.getParent()?.replace("Onboarding");
  };

  if (!me) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.avatarWrap}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(name || me.phone).charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.email}>{me.email_address}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Display name</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />
          <TouchableOpacity onPress={saveName}><Text style={styles.link}>Save</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Alias IDs</Text>
        {me.aliases.map((a) => (
          <Text key={a} style={styles.aliasItem}>• {a}@phonemail.com</Text>
        ))}
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={alias} onChangeText={setAlias} placeholder="new-alias" autoCapitalize="none" />
          <TouchableOpacity onPress={submitAlias}><Text style={styles.link}>Add</Text></TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: {
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: spacing.md, height: 56,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  avatarWrap: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  email: { ...typography.body, marginTop: spacing.sm, color: colors.textSecondary },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  label: { ...typography.caption, marginBottom: spacing.xs, textTransform: "uppercase" },
  inputRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: spacing.xs },
  input: { flex: 1, fontSize: 16, paddingVertical: 4 },
  link: { color: colors.primaryLight, fontWeight: "600" },
  aliasItem: { ...typography.body, marginBottom: 4 },
  logout: { margin: spacing.lg, padding: spacing.md, borderRadius: 24, borderWidth: 1, borderColor: colors.danger, alignItems: "center" },
  logoutText: { color: colors.danger, fontWeight: "600" },
});
