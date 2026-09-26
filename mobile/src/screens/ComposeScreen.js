import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../theme/ThemeContext";
import { spacing } from "../theme/whatsapp";
import { lookupPhone, getFamiliarRecipients, sendMail, uploadAttachment, assistDraft } from "../api/client";
import {
  VOICE_LANGUAGES,
  getSavedVoiceLang,
  saveVoiceLang,
  startVoiceRecognition,
} from "../utils/speech";
import LanguagePickerModal from "../components/LanguagePickerModal";
import { formatPhoneNumber } from "../utils/contact";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ASSIST_INTENT_CHIPS = [
  { id: "question", icon: "help-circle-outline", label: "Ask question", intent: "Ask a polite question and request clarification" },
  { id: "request", icon: "document-text-outline", label: "Make request", intent: "Make a polite, formal request for assistance" },
  { id: "followup", icon: "time-outline", label: "Follow up", intent: "Follow up politely on the status of my previous message" },
  { id: "appointment", icon: "calendar-outline", label: "Book slot", intent: "Inquire about available slots to book an appointment" },
];

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ComposeScreen({ route, navigation }) {
  const { colors } = useTheme();
  const lockedRecipient = route?.params?.lockedRecipient;
  const initialSubject = route?.params?.initialSubject;
  const initialBody = route?.params?.initialBody || "";
  const initialTo = route?.params?.initialTo || "";
  const inReplyTo = route?.params?.inReplyTo;
  const isLocked = Boolean(lockedRecipient);

  const [phoneQuery, setPhoneQuery]   = useState("");
  const [searching, setSearching]     = useState(false);
  const [recipients, setRecipients]   = useState(() => {
    if (lockedRecipient) {
      if (Array.isArray(lockedRecipient)) return lockedRecipient;
      return [
        {
          phone: lockedRecipient.phone || lockedRecipient.email_address,
          email_address: lockedRecipient.email_address,
          display_name: lockedRecipient.display_name,
        },
      ];
    }
    if (initialTo) {
      return [
        {
          phone: initialTo,
          email_address: initialTo,
          display_name: formatPhoneNumber(initialTo),
        },
      ];
    }
    return [];
  });
  const [subject, setSubject]         = useState(initialSubject || "");
  const [body, setBody]               = useState(initialBody || "");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [undoToast, setUndoToast]     = useState(null); // { secondsLeft, timerId }
  const undoIntervalRef               = useRef(null);

  // ── Familiar Recipients Autocomplete ─────────────────────────────────────
  const [familiarList, setFamiliarList] = useState([]);
  const [showFamiliarDropdown, setShowFamiliarDropdown] = useState(false);

  useEffect(() => {
    getFamiliarRecipients()
      .then(({ data }) => {
        if (Array.isArray(data)) setFamiliarList(data);
      })
      .catch(() => {});
  }, []);

  const filteredFamiliar = React.useMemo(() => {
    const q = phoneQuery.trim().toLowerCase();
    const existingPhones = new Set(recipients.map((r) => r.phone));
    const available = familiarList.filter((c) => !existingPhones.has(c.phone));
    if (!q) return available.slice(0, 5);
    return available
      .filter((c) =>
        (c.display_name && c.display_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email_address && c.email_address.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [familiarList, phoneQuery, recipients]);

  const addFamiliarRecipient = (contact) => {
    if (recipients.some((r) => r.phone === contact.phone)) {
      Alert.alert("Already added");
    } else {
      setRecipients([...recipients, contact]);
    }
    setPhoneQuery("");
    setShowFamiliarDropdown(false);
  };

  // ── Voice-to-Text State ───────────────────────────────────────────────────
  const [voiceLang, setVoiceLang]                 = useState("en-IN");
  const [isListening, setIsListening]             = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const voiceControllerRef                        = useRef(null);
  const baseTextRef                               = useRef("");

  useEffect(() => {
    getSavedVoiceLang().then((l) => setVoiceLang(l));
    return () => {
      voiceControllerRef.current?.stop();
    };
  }, []);

  const toggleVoice = async () => {
    if (isListening) {
      voiceControllerRef.current?.stop();
      setIsListening(false);
      return;
    }

    baseTextRef.current = body;
    const controller = await startVoiceRecognition({
      lang: voiceLang,
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onError: () => setIsListening(false),
      onResult: (result) => {
        const finalChunk = typeof result === "object"
          ? (result.finalTranscript || (result.isFinal ? result.transcript : "") || "").trim()
          : "";
        const interimChunk = typeof result === "object"
          ? (result.interimTranscript || (!result.isFinal ? result.transcript : "") || "").trim()
          : (typeof result === "string" ? result.trim() : "");

        if (finalChunk) {
          const base = baseTextRef.current;
          const sep = base && !base.endsWith(" ") && !base.endsWith("\n") ? " " : "";
          baseTextRef.current = base ? base + sep + finalChunk : finalChunk;
        }

        const currentBase = baseTextRef.current;
        if (interimChunk) {
          const sep = currentBase && !currentBase.endsWith(" ") && !currentBase.endsWith("\n") ? " " : "";
          setBody(currentBase ? currentBase + sep + interimChunk : interimChunk);
        } else if (finalChunk) {
          setBody(currentBase);
        }
      },
    });

    if (controller) {
      voiceControllerRef.current = controller;
    }
  };

  // ── Assisted-Reply State ──────────────────────────────────────────────────
  const [showAssist, setShowAssist] = useState(false);
  const [assisting, setAssisting]   = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);

  const handleAssist = async (chosenIntent) => {
    const rawIntent = (chosenIntent || body || "").trim();
    if (!rawIntent) {
      Alert.alert("Help me write", "Please select a suggestion or enter a rough note first.");
      return;
    }
    setAssisting(true);
    try {
      const { data } = await assistDraft({
        intent: rawIntent,
        isNewMessage: !inReplyTo,
        currentSubject: subject,
      });
      if (data.subject && !subject.trim() && !inReplyTo) {
        setSubject(data.subject);
      }
      if (data.body) {
        setBody(data.body);
        setAiAssisted(true);
        setShowAssist(false);
      }
    } catch (err) {
      Alert.alert("Assistant Error", err?.response?.data?.error || err.message || "Failed to generate draft");
    } finally {
      setAssisting(false);
    }
  };

  const search = async () => {
    if (isLocked) return;
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

  const removeRecipient = (phone) => {
    if (isLocked) return;
    setRecipients(recipients.filter((r) => r.phone !== phone));
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || !res.assets.length) return;
      const file = res.assets[0];

      if (file.size && file.size > MAX_SIZE_BYTES) {
        return Alert.alert(
          "File too large",
          `"${file.name}" exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
        );
      }

      setUploading(true);
      const { data } = await uploadAttachment({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
      });

      setAttachments((prev) => [...prev, data]);
    } catch (err) {
      Alert.alert("Upload failed", err?.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const executeSend = async (payload) => {
    setSending(true);
    try {
      await sendMail(payload);
      navigation.goBack();
    } catch (e) {
      const errData = e?.response?.data;
      const msg = errData?.unregistered?.length
        ? `${errData.error}:\n${errData.unregistered.join(", ")}`
        : (errData?.error || e.message);
      Alert.alert("Couldn't send", msg);
    } finally {
      setSending(false);
    }
  };

  const handleSendPress = () => {
    if (recipients.length === 0) return Alert.alert("Add at least one recipient");
    if (!body.trim() && attachments.length === 0) return Alert.alert("Message is empty");

    const payload = {
      to: recipients.length > 1 ? recipients.map((r) => r.email_address) : recipients[0].email_address,
      subject: subject || "(no subject)",
      text: body.trim(),
      attachments,
      inReplyTo: inReplyTo || null,
    };

    // 5-second Undo send window
    let count = 5;
    const interval = setInterval(() => {
      count -= 1;
      setUndoToast((cur) => (cur ? { ...cur, secondsLeft: count } : null));
    }, 1000);
    undoIntervalRef.current = interval;

    const timerId = setTimeout(() => {
      clearInterval(interval);
      setUndoToast(null);
      executeSend(payload);
    }, 5000);

    setUndoToast({ secondsLeft: 5, timerId });
  };

  const handleUndo = () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);
    clearInterval(undoIntervalRef.current);
    setUndoToast(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Spike Mail Clean Minimal Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {inReplyTo ? "Reply" : isLocked ? "New email" : recipients.length > 1 ? "New group" : "New message"}
        </Text>

        <TouchableOpacity
          style={[styles.sendHeaderBtn, (sending || uploading || Boolean(undoToast)) && { opacity: 0.5 }]}
          onPress={handleSendPress}
          disabled={sending || uploading || Boolean(undoToast)}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.sendHeaderBtnText}>Send</Text>
              <Ionicons name="send" size={14} color="#fff" style={{ marginLeft: 4 }} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Undo Toast */}
      {undoToast && (
        <View style={styles.undoBanner}>
          <Text style={styles.undoText}>Message sent ({undoToast.secondsLeft}s)</Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text style={styles.undoBtnText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recipients Row: Locked vs Unlocked (Requirement 8) */}
      {isLocked ? (
        <View style={[styles.lockedRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>To:</Text>
          <View style={[styles.lockedPill, { backgroundColor: colors.bubbleOut, borderColor: colors.bubbleBorderOut }]}>
            <Text style={[styles.lockedPillText, { color: colors.primaryLight }]}>
              {recipients[0]?.display_name || recipients[0]?.email_address || "Recipient"}
            </Text>
            <Ionicons name="lock-closed" size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.searchRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search phone number to add"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phoneQuery}
              onChangeText={(text) => {
                setPhoneQuery(text);
                setShowFamiliarDropdown(true);
              }}
              onFocus={() => setShowFamiliarDropdown(true)}
              onSubmitEditing={search}
            />
            <TouchableOpacity onPress={search} disabled={searching}>
              {searching ? (
                <ActivityIndicator />
              ) : (
                <Ionicons name="person-add" size={22} color={colors.primaryLight} />
              )}
            </TouchableOpacity>
          </View>

          {/* Familiar recipients suggestions list */}
          {showFamiliarDropdown && filteredFamiliar.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.suggestionsHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.suggestionsHeaderText, { color: colors.textSecondary }]}>
                  Recent contacts
                </Text>
                <TouchableOpacity onPress={() => setShowFamiliarDropdown(false)}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {filteredFamiliar.map((contact) => (
                <TouchableOpacity
                  key={contact.phone || contact.email_address}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => addFamiliarRecipient(contact)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionName, { color: colors.textPrimary }]}>
                      {contact.display_name}
                    </Text>
                    <Text style={[styles.suggestionPhone, { color: colors.textSecondary }]}>
                      {contact.phone || contact.email_address}
                    </Text>
                  </View>
                  <Text style={[styles.suggestionAdd, { color: colors.primaryLight }]}>+ Add</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {recipients.length > 0 && (
            <FlatList
              horizontal
              data={recipients}
              keyExtractor={(r) => r.phone || r.email_address}
              contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
              renderItem={({ item }) => (
                <View style={[styles.pill, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
                  <Text style={[styles.pillText, { color: colors.textPrimary }]}>{item.display_name || item.phone}</Text>
                  <TouchableOpacity onPress={() => removeRecipient(item.phone)}>
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* Subject Input */}
      <View style={[styles.fieldRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.subjectInput, { color: colors.textPrimary }]}
          placeholder="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Attached Files List */}
      {attachments.length > 0 && (
        <View style={[styles.attachRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {attachments.map((att, idx) => (
            <View key={att.id || idx} style={[styles.attachChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="document-attach" size={15} color={colors.primaryLight} />
              <Text style={[styles.attachChipText, { color: colors.textPrimary }]} numberOfLines={1}>
                {att.filename} ({formatBytes(att.size)})
              </Text>
              <TouchableOpacity onPress={() => removeAttachment(idx)}>
                <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Listening Animation Indicator */}
      {isListening && (
        <View style={styles.listeningBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.listeningText} numberOfLines={1}>
            Listening in {VOICE_LANGUAGES.find((l) => l.code === voiceLang)?.name || "English"}… Speak now
          </Text>
          <TouchableOpacity style={styles.stopMicBtn} onPress={toggleVoice}>
            <Text style={styles.stopMicText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI-Assisted Draft Review Banner */}
      {aiAssisted && (
        <View style={styles.aiReviewBanner}>
          <Ionicons name="sparkles" size={14} color="#137333" />
          <Text style={styles.aiReviewText}>
            AI-assisted draft — please review before sending
          </Text>
          <TouchableOpacity onPress={() => setAiAssisted(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#137333" />
          </TouchableOpacity>
        </View>
      )}

      {/* Help Me Write This Assist Bar */}
      <View style={[styles.assistContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.assistHeaderRow}>
          <TouchableOpacity
            style={[
              styles.assistBtn,
              { backgroundColor: colors.chipInactive, borderColor: colors.border },
              showAssist && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
            ]}
            onPress={() => {
              if (body.trim() && !showAssist) {
                handleAssist(body);
              } else {
                setShowAssist((prev) => !prev);
              }
            }}
            disabled={assisting}
          >
            <Ionicons name="sparkles" size={13} color={showAssist ? "#FFFFFF" : colors.primaryLight} />
            <Text style={[styles.assistBtnText, { color: showAssist ? "#FFFFFF" : colors.primaryLight }]}>
              {assisting ? "Drafting…" : body.trim() && !showAssist ? "Help me refine this" : "Help me write this"}
            </Text>
            {assisting && <ActivityIndicator size="small" color={showAssist ? "#fff" : colors.primaryLight} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        </View>

        {showAssist && (
          <View style={styles.assistChipsContainer}>
            {body.trim().length > 0 && (
              <TouchableOpacity
                style={[styles.assistChip, { backgroundColor: colors.bubbleOut, borderColor: colors.bubbleBorderOut }]}
                onPress={() => handleAssist(body)}
                disabled={assisting}
              >
                <Ionicons name="sparkles" size={13} color={colors.primaryLight} style={{ marginRight: 4 }} />
                <Text style={[styles.assistChipHighlightText, { color: colors.primaryLight }]}>
                  Refine: "{body.length > 22 ? body.slice(0, 22) + "…" : body}"
                </Text>
              </TouchableOpacity>
            )}
            {ASSIST_INTENT_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={[styles.assistChip, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}
                onPress={() => handleAssist(chip.intent)}
                disabled={assisting}
              >
                <Ionicons name={chip.icon} size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.assistChipText, { color: colors.textPrimary }]}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Message Body Input */}
      <TextInput
        style={[styles.bodyInput, { color: colors.textPrimary, backgroundColor: colors.card }]}
        placeholder="Write your email here…"
        placeholderTextColor={colors.textSecondary}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />

      {/* Bottom Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={pickFile}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          ) : (
            <Ionicons name="attach" size={22} color={colors.textSecondary} />
          )}
          <Text style={[styles.attachButtonText, { color: colors.textSecondary }]}>
            {uploading ? " Uploading…" : " Attach"}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.voiceBtn,
              { backgroundColor: colors.chipInactive, borderColor: colors.border },
              isListening && { backgroundColor: colors.danger, borderColor: colors.danger },
            ]}
            onPress={toggleVoice}
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={18}
              color={isListening ? "#fff" : colors.primaryLight}
            />
            <Text style={[styles.voiceBtnText, { color: isListening ? "#fff" : colors.primaryLight }]}>
              {isListening ? "Listening…" : "Voice"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.langBtn, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}
            onPress={() => setLangPickerVisible(true)}
          >
            <Ionicons name="globe-outline" size={12} color={colors.primaryLight} />
            <Text style={[styles.langBtnText, { color: colors.primaryLight }]}>
              {voiceLang.split("-")[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LanguagePickerModal
        visible={langPickerVisible}
        selectedLang={voiceLang}
        onSelect={(code) => {
          setVoiceLang(code);
          saveVoiceLang(code);
          if (isListening) {
            voiceControllerRef.current?.stop();
            setIsListening(false);
          }
        }}
        onClose={() => setLangPickerVisible(false)}
        title="Select Voice-to-Text Language"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sendHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  sendHeaderBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  undoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  undoText: {
    color: "#fff",
    fontSize: 13.5,
  },
  undoBtnText: {
    color: "#38BDF8",
    fontWeight: "700",
    fontSize: 13.5,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockedPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
  },
  suggestionsBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    marginHorizontal: spacing.md,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: spacing.xs,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  suggestionName: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  suggestionPhone: {
    fontSize: 11.5,
    marginTop: 1,
  },
  suggestionAdd: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    gap: 4,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  fieldRow: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  subjectInput: {
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 6,
  },
  attachRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
  },
  attachChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    maxWidth: 220,
  },
  attachChipText: {
    fontSize: 11.5,
    flexShrink: 1,
  },
  bodyInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.md,
  },
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  attachButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  listeningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderTopWidth: 1,
    borderTopColor: "#FECACA",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#EF4444",
  },
  listeningText: {
    flex: 1,
    fontSize: 12.5,
    color: "#EF4444",
    fontWeight: "600",
  },
  stopMicBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  stopMicText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "700",
  },
  aiReviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 8,
  },
  aiReviewText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    fontWeight: "600",
  },
  assistContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  assistHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  assistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assistBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  assistChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  assistChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
  },
  assistChipText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  assistChipHighlightText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
});
