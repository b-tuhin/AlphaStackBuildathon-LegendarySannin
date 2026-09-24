import React, { useState, useEffect, useRef } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/whatsapp";
import ChatBubble from "../components/ChatBubble";
import { getThreadMessages, sendMail, getMe } from "../api/client";

export default function ChatScreen({ route, navigation }) {
  const { thread } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [myAddress, setMyAddress] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: thread.is_group ? `Group: ${thread.counterpart}` : thread.counterpart,
    });
  }, [thread]);

  useEffect(() => {
    (async () => {
      const { data: me } = await getMe();
      setMyAddress(me.email_address);
      const { data } = await getThreadMessages(thread.id);
      setMessages(data);
    })();
  }, [thread.id]);

  const recipients = thread.is_group
    ? thread.participants
    : [thread.counterpart];

  const lastMessage = messages[messages.length - 1];

  const send = async () => {
    if (!text.trim()) return;
    const payload = {
      to: recipients,
      subject: thread.subject || "(no subject)",
      text: text.trim(),
      // Backend enforces single-reply-per-message; only chain in_reply_to for 1:1 threads
      inReplyTo: !thread.is_group && lastMessage ? lastMessage.id : null,
    };
    setText("");
    try {
      await sendMail(payload);
      const { data } = await getThreadMessages(thread.id);
      setMessages(data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.log("[chat] send error", e?.response?.data || e.message);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.container}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              isOwn={item.from_address === myAddress}
              senderLabel={thread.is_group && item.from_address !== myAddress ? item.from_address.split("@")[0] : null}
            />
          )}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", padding: spacing.sm,
    backgroundColor: colors.listBackground, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  input: {
    flex: 1, backgroundColor: colors.chipInactive, borderRadius: 20, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, maxHeight: 100, fontSize: 15, marginRight: spacing.sm,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
});
