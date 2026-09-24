import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/whatsapp";
import { lookupPhone, sendMail } from "../api/client";

// Search a phone number to start a chat. Adding 2+ recipients here creates a
// group chat; subsequent replies from a group stay in that group thread, while
// a single recipient stays a 1-on-1 chat.
export default function ComposeScreen({ navigation }) {
  const [phoneQuery, setPhoneQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [recipients, setRecipients] = useState([]); // [{ phone, email_address, display_name }]
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const search = async () => {
    const digits = phoneQuery.replace(/[^\d]/g, "");
    if (digits.length < 7) return;
    setSearching(true);
    try {
      const { data } = await lookupPhone(digits);
      if (recipients.some((r) => r.phone === data.phone)) {
        Alert.alert("Already added");
      } else {
        setRecipients([...recipients, data]);
      }
      setPhoneQuery("");
    } catch (e) {
      Alert.alert("Not found", "No PhoneMail user with that number.");
    } finally {
      setSearching(false);
    }
  };

  const removeRecipient = (phone) => setRecipients(recipients.filter((r) => r.phone !== phone));

  const send = async () => {
    if (recipients.length === 0) return Alert.alert("Add at least one recipient");
    if (!body.trim()) return Alert.alert("Message is empty");
    setSending(true);
    try {
      await sendMail({
        to: recipients.length > 1 ? recipients.map((r) => r.email_address) : recipients[0].email_address,
        subject: subject || "(no subject)",
        text: body.trim(),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't send", e?.response?.data?.error || e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {recipients.length > 1 ? "New group" : "New message"}
        </Text>
        <TouchableOpacity onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={22} color="#fff" />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search phone number to add"
          keyboardType="phone-pad"
          value={phoneQuery}
          onChangeText={setPhoneQuery}
          onSubmitEditing={search}
        />
        <TouchableOpacity onPress={search} disabled={searching}>
          {searching ? <ActivityIndicator /> : <Ionicons name="person-add" size={22} color={colors.primaryLight} />}
        </TouchableOpacity>
      </View>

      {recipients.length > 0 && (
        <FlatList
          horizontal
          data={recipients}
          keyExtractor={(r) => r.phone}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          renderItem={({ item }) => (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{item.display_name || item.phone}</Text>
              <TouchableOpacity onPress={() => removeRecipient(item.phone)}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TextInput
        style={styles.subjectInput}
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
      />
      <TextInput
        style={styles.bodyInput}
        placeholder="Message"
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.listBackground },
  header: {
    backgroundColor: colors.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: spacing.md, height: 56,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  searchRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  searchInput: { flex: 1, fontSize: 15, marginRight: spacing.sm },
  pill: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.chipInactive,
    borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: 6, marginRight: spacing.sm, gap: 6,
  },
  pillText: { fontSize: 13, marginRight: 4, color: colors.textPrimary },
  subjectInput: { fontSize: 16, fontWeight: "600", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  bodyInput: { flex: 1, fontSize: 15, padding: spacing.md },
});
