import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme/whatsapp";

export default function ChatBubble({ message, isOwn, senderLabel }) {
  return (
    <View style={[styles.row, isOwn ? styles.rowOut : styles.rowIn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOut : styles.bubbleIn]}>
        {!isOwn && senderLabel ? <Text style={styles.sender}>{senderLabel}</Text> : null}
        {message.subject ? <Text style={styles.subject}>{message.subject}</Text> : null}
        <Text style={styles.body}>{message.body_text}</Text>
        <Text style={styles.time}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 3, paddingHorizontal: spacing.md },
  rowOut: { justifyContent: "flex-end" },
  rowIn: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 8, padding: spacing.sm, elevation: 1 },
  bubbleOut: { backgroundColor: colors.bubbleOut, borderTopRightRadius: 0 },
  bubbleIn: { backgroundColor: colors.bubbleIn, borderTopLeftRadius: 0 },
  sender: { fontSize: 12, fontWeight: "700", color: colors.primaryLight, marginBottom: 2 },
  subject: { fontWeight: "700", fontSize: 14, marginBottom: 2, color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  time: { fontSize: 10, color: colors.textSecondary, alignSelf: "flex-end", marginTop: 4 },
});
