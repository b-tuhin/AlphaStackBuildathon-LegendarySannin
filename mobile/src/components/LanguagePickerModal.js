import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { spacing } from "../theme/whatsapp";
import { VOICE_LANGUAGES } from "../utils/speech";

export default function LanguagePickerModal({
  visible,
  selectedLang,
  onSelect,
  onClose,
  title,
  data,
  showCode = true,
}) {
  const { colors } = useTheme();
  const listData = data || VOICE_LANGUAGES;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title || "Select Voice Language"}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={listData}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected = item.code === selectedLang;
              return (
                <TouchableOpacity
                  style={[
                    styles.item,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.bubbleOut },
                  ]}
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemText, { color: colors.textPrimary }, isSelected && { fontWeight: "700", color: colors.primaryLight }]}>
                      {item.label}
                    </Text>
                    {showCode && Boolean(item.code) && (
                      <Text style={[styles.itemCode, { color: colors.textSecondary }]}>{item.code}</Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryLight} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    fontSize: 15,
  },
  itemCode: {
    fontSize: 12,
    marginTop: 2,
  },
});
