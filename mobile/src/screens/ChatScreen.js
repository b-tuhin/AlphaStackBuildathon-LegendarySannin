import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { spacing } from "../theme/whatsapp";
import ChatBubble from "../components/ChatBubble";
import SwipeReplyWrapper from "../components/SwipeReplyWrapper";
import TraditionalEmailModal from "../components/TraditionalEmailModal";
import { getThreadMessages, sendMail, getMe, uploadAttachment, assistDraft, updateEmail, lookupPhone } from "../api/client";
import {
  VOICE_LANGUAGES,
  getSavedVoiceLang,
  saveVoiceLang,
  startVoiceRecognition,
} from "../utils/speech";
import LanguagePickerModal from "../components/LanguagePickerModal";
import { formatPhoneNumber, getAvatarInitials, getAvatarColor } from "../utils/contact";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const OFFLINE_QUEUE_KEY = "phonemail_mobile_chat_queue";

const ASSIST_INTENT_CHIPS = [
  { id: "question", icon: "help-circle-outline", label: "Ask question", intent: "Ask a polite question and request clarification" },
  { id: "request", icon: "document-text-outline", label: "Make request", intent: "Make a polite, formal request for assistance" },
  { id: "followup", icon: "time-outline", label: "Follow up", intent: "Follow up politely on the status of my previous message" },
  { id: "appointment", icon: "calendar-outline", label: "Book slot", intent: "Inquire about available slots to book an appointment" },
];

export default function ChatScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { thread, quickReply, scrollToMessageId } = route.params;
  const [messages, setMessages]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const scrolledTargetRef                 = useRef(null);
  const [subject, setSubject]             = useState("");
  const [text, setText]                   = useState("");
  const [replyingTo, setReplyingTo]       = useState(null); // message object being replied to
  const [selectedModalMsg, setSelectedModalMsg] = useState(null); // message for TraditionalEmailModal
  const [attachments, setAttachments]     = useState([]);
  const [uploading, setUploading]         = useState(false);
  const [myAddress, setMyAddress]         = useState("");
  const [undoToast, setUndoToast]         = useState(null); // { tempId, payload, secondsLeft, timerId }
  const isGroup = Boolean(thread?.is_group);
  const counterpartName = isGroup
    ? (thread?.group_name || thread?.counterpart || t("groupConversation") || "Group")
    : (thread?.counterpart_name || formatPhoneNumber(thread?.counterpart || ""));
  const counterpartInitials = getAvatarInitials(counterpartName, isGroup);
  const counterpartAvatarBg = getAvatarColor(thread?.counterpart || thread?.group_name || "contact");
  const counterpartSubtitle = isGroup
    ? (thread?.participants ? `${thread.participants.split(",").length} participants` : "")
    : (thread?.counterpart ? formatPhoneNumber(thread.counterpart) : "");

  // Contact Profile Modal state (Item 8)
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [contactProfile, setContactProfile]           = useState(null);
  const [contactLoading, setContactLoading]           = useState(false);

  const handlePressContact = async () => {
    // If own profile, route directly to Profile screen
    const rawCounterpart = thread?.counterpart || "";
    if (rawCounterpart && myAddress && rawCounterpart.toLowerCase() === myAddress.toLowerCase()) {
      navigation.navigate("Profile");
      return;
    }

    // Otherwise open contact modal/sheet via lookup
    setContactModalVisible(true);
    setContactLoading(true);
    try {
      const cleanPhone = (thread?.counterpart || "").split("@")[0].replace(/\D/g, "");
      const { data } = await lookupPhone(cleanPhone || thread?.counterpart);
      setContactProfile(data?.user || data);
    } catch {
      setContactProfile({
        display_name: counterpartName,
        phone: (thread?.counterpart || "").split("@")[0],
        email_address: thread?.counterpart,
      });
    } finally {
      setContactLoading(false);
    }
  };

  const [inputHeight, setInputHeight]     = useState(40);
  const listRef                           = useRef(null);
  const textInputRef                      = useRef(null);
  const undoIntervalRef                   = useRef(null);

  useEffect(() => {
    if (!text) {
      setInputHeight(40);
    }
  }, [text]);

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

    baseTextRef.current = text;
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
          setText(currentBase ? currentBase + sep + interimChunk : interimChunk);
        } else if (finalChunk) {
          setText(currentBase);
        }
      },
    });

    if (controller) {
      voiceControllerRef.current = controller;
    }
  };

  const handleSelectLang = async (code) => {
    setVoiceLang(code);
    await saveVoiceLang(code);
    if (isListening) {
      voiceControllerRef.current?.stop();
      setIsListening(false);
    }
  };

  // ── Assisted-Reply State ──────────────────────────────────────────────────
  const [showAssist, setShowAssist] = useState(false);
  const [assisting, setAssisting]   = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);

  const handleAssist = async (chosenIntent) => {
    const rawIntent = (chosenIntent || text || "").trim();
    if (!rawIntent) {
      Alert.alert("Help me write", "Please select an option or type a rough note first.");
      return;
    }
    setAssisting(true);
    try {
      const { data } = await assistDraft({
        threadId: thread?.id,
        intent: rawIntent,
        isNewMessage: !replyingTo,
        currentSubject: subject,
      });
      if (data.subject && !subject.trim() && !replyingTo) {
        setSubject(data.subject);
      }
      if (data.body) {
        setText(data.body);
        setAiAssisted(true);
        setShowAssist(false);
      }
    } catch (err) {
      Alert.alert("Assistant Error", err?.response?.data?.error || err.message || "Failed to generate draft");
    } finally {
      setAssisting(false);
    }
  };

  // ── Spike Mail Clean Minimal Header ─────────────────────────────────────────
  useEffect(() => {
    const titleText = thread.is_group
      ? (thread.group_name || `Group: ${thread.counterpart}`)
      : (thread.counterpart_name || formatPhoneNumber(thread.counterpart));

    navigation.setOptions({
      title: titleText,
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontWeight: "700", fontSize: 16 },
      headerShadowVisible: false,
    });
  }, [thread, navigation, colors]);

  const folder = route?.params?.folder || "home";

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await getThreadMessages(thread.id, { folder });
      setMessages(data);
    } catch (e) {
      console.log("[chat] load error", e.message);
    } finally {
      setLoading(false);
    }
  }, [thread.id, folder]);

  useEffect(() => {
    (async () => {
      try {
        const { data: me } = await getMe();
        setMyAddress(me.email_address);
      } catch {}
      await loadMessages();
    })();
  }, [loadMessages]);

  // If navigated with quickReply, focus input or set reply to last message
  useEffect(() => {
    if (quickReply && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.from_address !== myAddress) {
        setReplyingTo(lastMsg);
      }
      setTimeout(() => textInputRef.current?.focus(), 300);
    }
  }, [quickReply, messages, myAddress]);

  // Jump to specific message when navigated with scrollToMessageId
  useEffect(() => {
    if (!scrollToMessageId || loading || messages.length === 0) return;
    if (scrolledTargetRef.current === scrollToMessageId) return;

    const idx = messages.findIndex((m) => m.id === scrollToMessageId);
    if (idx !== -1) {
      scrolledTargetRef.current = scrollToMessageId;
      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        } catch {
          try {
            listRef.current?.scrollToItem({ item: messages[idx], animated: true, viewPosition: 0.5 });
          } catch {}
        }
        setHighlightedMsgId(scrollToMessageId);
        setTimeout(() => {
          setHighlightedMsgId(null);
        }, 1800);
      }, 250);
    }
  }, [messages, loading, scrollToMessageId]);

  const handleToggleFavoriteMessage = async (msg) => {
    const nextVal = msg.is_favorite ? 0 : 1;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_favorite: nextVal } : m))
    );
    try {
      await updateEmail(msg.id, { is_favorite: nextVal });
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_favorite: msg.is_favorite } : m))
      );
    }
  };

  // ── Single Reply Enforcement (Requirement 5) ──────────────────────────────
  // Map of all message IDs and message_ids that have already received a reply.
  const repliedMessageIds = useMemo(() => {
    const set = new Set();
    messages.forEach((m) => {
      if (m.in_reply_to) {
        set.add(m.in_reply_to);
      }
    });
    return set;
  }, [messages]);

  // Messages dictionary for quote preview lookup (Requirement 3)
  const messagesMap = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      if (m.id) map.set(m.id, m);
      if (m.message_id) map.set(m.message_id, m);
    });
    return map;
  }, [messages]);

  // Inside chat, recipients are locked to thread counterpart(s) (Requirement 8)
  const recipients = thread.is_group
    ? (thread.participants || []).filter((p) => p !== myAddress)
    : [thread.counterpart];

  // ── File picker ───────────────────────────────────────────────────────────
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

  // ── Open Traditional Compose with Locked Recipient (Requirement 7 & 8) ──────
  const handleOpenTraditionalCompose = (replyMsg = null) => {
    const counterpartEmail = thread.counterpart;
    const counterpartDisplayName =
      thread.counterpart_name ||
      (thread.is_group ? thread.counterpart : thread.counterpart.split("@")[0]);

    navigation.navigate("Compose", {
      lockedRecipient: thread.is_group
        ? (thread.participants || []).filter((p) => p !== myAddress).map((p) => ({
            email_address: p,
            display_name: p.split("@")[0],
            phone: p.split("@")[0],
          }))
        : {
            email_address: counterpartEmail,
            display_name: counterpartDisplayName,
            phone: counterpartEmail.split("@")[0],
          },
      initialSubject: replyMsg
        ? (replyMsg.subject?.startsWith("Re:") ? replyMsg.subject : `Re: ${replyMsg.subject || ""}`)
        : undefined,
      inReplyTo: replyMsg ? replyMsg.id : null,
    });
  };

  // ── Dispatch to server ────────────────────────────────────────────────────
  const dispatchSend = async (payload, tempId) => {
    try {
      const { data } = await sendMail(payload);
      if (data.email) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.email : m)));
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "sent", delivery_status: "sent" } : m))
        );
      }
    } catch (err) {
      // Offline or network error -> queue locally and show "Waiting to send"
      const isNetworkErr = !err.response || err.code === "ERR_NETWORK";
      if (isNetworkErr) {
        try {
          const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
          const queue = raw ? JSON.parse(raw) : [];
          queue.push({ id: tempId, payload, threadId: thread.id });
          await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        } catch {}

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "waiting_offline", payload } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed", payload } : m))
        );
      }
    }
  };

  // ── Send Action (Handles Reply vs New Email - Requirement 1 & 4) ───────────
  const send = () => {
    if (!text.trim() && attachments.length === 0) return;

    const currentText = text.trim();
    const currentAttachments = [...attachments];
    const isReply = Boolean(replyingTo);

    const payload = {
      to: recipients,
      // When replying, subject is not sent/needed. When new, use compact subject field.
      subject: isReply ? undefined : (subject.trim() || undefined),
      text: currentText,
      attachments: currentAttachments,
      inReplyTo: isReply ? (replyingTo.id || replyingTo.message_id) : null,
    };

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      thread_id: thread.id,
      from_address: myAddress,
      to_address: recipients.join(", "),
      subject: payload.subject || "",
      body_text: currentText,
      in_reply_to: payload.inReplyTo,
      attachments: currentAttachments,
      has_attachments: currentAttachments.length ? 1 : 0,
      created_at: new Date().toISOString(),
      status: "sending",
      delivery_status: "sent",
      payload,
    };

    // Optimistically render instantly in thread
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    setSubject("");
    setReplyingTo(null);
    setAttachments([]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    // 5-second Undo send countdown
    if (undoToast?.timerId) clearTimeout(undoToast.timerId);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    let count = 5;
    const interval = setInterval(() => {
      count -= 1;
      setUndoToast((cur) => (cur ? { ...cur, secondsLeft: count } : null));
    }, 1000);
    undoIntervalRef.current = interval;

    const timerId = setTimeout(() => {
      clearInterval(interval);
      setUndoToast(null);
      dispatchSend(payload, tempId);
    }, 5000);

    setUndoToast({
      tempId,
      payload,
      draftText: currentText,
      draftSubject: subject,
      draftReplyingTo: replyingTo,
      draftAttachments: currentAttachments,
      secondsLeft: 5,
      timerId,
    });
  };

  const handleUndo = () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);
    clearInterval(undoIntervalRef.current);

    // Remove optimistic message
    setMessages((prev) => prev.filter((m) => m.id !== undoToast.tempId));

    // Restore draft fields
    setText(undoToast.draftText || "");
    if (undoToast.draftSubject) setSubject(undoToast.draftSubject);
    if (undoToast.draftReplyingTo) setReplyingTo(undoToast.draftReplyingTo);
    setAttachments(undoToast.draftAttachments || []);
    setUndoToast(null);
  };

  const handleRetry = (msg) => {
    if (!msg.payload) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "sending" } : m))
    );
    dispatchSend(msg.payload, msg.id);
  };

  // Scroll to original message when tapping quote
  const handlePressQuote = (refId) => {
    if (!refId) return;
    const index = messages.findIndex((m) => m.id === refId || m.message_id === refId);
    if (index >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Dedicated In-Chat Top Bar (§7, §8) */}
        <View style={[styles.topBar, { backgroundColor: colors.card || colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topBarContact}
            activeOpacity={0.7}
            onPress={handlePressContact}
          >
            <View style={[styles.topBarAvatar, { backgroundColor: counterpartAvatarBg }]}>
              <Text style={styles.topBarAvatarText}>{counterpartInitials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.topBarTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {counterpartName}
              </Text>
              {Boolean(counterpartSubtitle) && (
                <Text style={[styles.topBarSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {counterpartSubtitle}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Skeleton loading state */}
        {loading ? (
          <View style={styles.skeletonContainer}>
            <View style={[styles.skeletonBubble, styles.skeletonIn]} />
            <View style={[styles.skeletonBubble, styles.skeletonOut]} />
            <View style={[styles.skeletonBubble, styles.skeletonIn, { width: "70%" }]} />
            <View style={[styles.skeletonBubble, styles.skeletonOut, { width: "50%" }]} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => {
              const isOwn = item.from_address === myAddress;
              const canReply = true;

              return (
                <SwipeReplyWrapper
                  enabled={canReply}
                  onReply={() => {
                    setReplyingTo(item);
                    textInputRef.current?.focus();
                  }}
                >
                  <ChatBubble
                    message={item}
                    isOwn={isOwn}
                    isGroup={thread.is_group}
                    senderLabel={
                      thread.is_group && !isOwn
                        ? item.from_name || item.from_display || item.from_address.split("@")[0]
                        : null
                    }
                    referencedMessage={item.in_reply_to ? messagesMap.get(item.in_reply_to) : null}
                    onRetry={handleRetry}
                    onOpenTraditionalView={(msg) => setSelectedModalMsg(msg)}
                    onPressQuote={handlePressQuote}
                    canReply={canReply}
                    isHighlighted={item.id === highlightedMsgId}
                    onToggleFavorite={handleToggleFavoriteMessage}
                  />
                </SwipeReplyWrapper>
              );
            }}
            contentContainerStyle={{ paddingVertical: spacing.md }}
            onContentSizeChange={() => {
              if (!scrollToMessageId) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        )}

        {/* Attachment chips above input bar */}
        {attachments.length > 0 && (
          <View style={[styles.attachBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {attachments.map((att, idx) => (
              <View key={att.id || idx} style={[styles.attachChip, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
                <Ionicons name="document-attach" size={15} color={colors.primaryLight} />
                <Text style={[styles.attachChipText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {att.filename}
                </Text>
                <TouchableOpacity onPress={() => removeAttachment(idx)}>
                  <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Undo Toast Banner */}
        {undoToast && (
          <View style={styles.undoBanner}>
            <Text style={styles.undoText}>{t("messageSent", undoToast.secondsLeft)}</Text>
            <TouchableOpacity onPress={handleUndo}>
              <Text style={styles.undoBtnText}>{t("undo")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Replying-To Quote Preview Banner (Requirement 4: hides Subject) */}
        {replyingTo && (
          <View style={[styles.replyPreviewBanner, { backgroundColor: colors.bubbleOut, borderTopColor: colors.bubbleBorderOut }]}>
            <View style={[styles.replyPreviewBar, { backgroundColor: colors.primaryLight }]} />
            <View style={styles.replyPreviewContent}>
              <Text style={[styles.replyPreviewSender, { color: colors.primaryLight }]} numberOfLines={1}>
                {t("replyingTo")}{" "}
                {replyingTo.from_name ||
                  replyingTo.from_display ||
                  replyingTo.counterpart_name ||
                  (replyingTo.from_address ? replyingTo.from_address.split("@")[0] : "Sender")}
              </Text>
              <Text style={[styles.replyPreviewSnippet, { color: colors.textSecondary }]} numberOfLines={1}>
                {replyingTo.body_text || replyingTo.subject || "Message"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={styles.cancelReplyBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Compact Subject Field (Requirement 1 & 4: visible for NEW email, hidden for REPLY) */}
        {!replyingTo && (
          <View style={[styles.compactSubjectContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Ionicons name="mail-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.compactSubjectInput, { color: colors.textPrimary }]}
              placeholder={t("subjectOptional")}
              placeholderTextColor={colors.textSecondary}
              value={subject}
              onChangeText={setSubject}
              returnKeyType="next"
              maxLength={120}
            />
            {Boolean(subject) && (
              <TouchableOpacity onPress={() => setSubject("")}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Listening Animation Banner */}
        {isListening && (
          <View style={styles.listeningBanner}>
            <View style={styles.pulseDot} />
            <Text style={styles.listeningText} numberOfLines={1}>
              {t("listeningIn", VOICE_LANGUAGES.find((l) => l.code === voiceLang)?.name || "English")}
            </Text>
            <TouchableOpacity style={styles.stopMicBtn} onPress={toggleVoice}>
              <Text style={styles.stopMicText}>{t("done")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI-Assisted Draft Review Banner */}
        {aiAssisted && (
          <View style={styles.aiReviewBanner}>
            <Ionicons name="sparkles" size={14} color="#137333" />
            <Text style={styles.aiReviewText}>
              {t("aiAssistedDraft")}
            </Text>
            <TouchableOpacity onPress={() => setAiAssisted(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#137333" />
            </TouchableOpacity>
          </View>
        )}

        {/* Help Me Write This Assist Bar */}
        <View style={[styles.assistContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.assistHeaderRow}>
            <TouchableOpacity
              style={[
                styles.assistBtn,
                { backgroundColor: colors.chipInactive, borderColor: colors.border },
                showAssist && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
              ]}
              onPress={() => {
                if (text.trim() && !showAssist) {
                  handleAssist(text);
                } else {
                  setShowAssist((prev) => !prev);
                }
              }}
              disabled={assisting}
            >
              <Ionicons name="sparkles" size={13} color={showAssist ? "#FFFFFF" : colors.primaryLight} />
              <Text style={[styles.assistBtnText, { color: showAssist ? "#FFFFFF" : colors.primaryLight }]}>
                {assisting ? t("drafting") : text.trim() && !showAssist ? t("helpMeRefineThis") : t("helpMeWriteThis")}
              </Text>
              {assisting && <ActivityIndicator size="small" color={showAssist ? "#fff" : colors.primaryLight} style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          </View>

          {showAssist && (
            <View style={styles.assistChipsContainer}>
              {text.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.assistChip, { backgroundColor: colors.bubbleOut, borderColor: colors.bubbleBorderOut }]}
                  onPress={() => handleAssist(text)}
                  disabled={assisting}
                >
                  <Ionicons name="sparkles" size={13} color={colors.primaryLight} style={{ marginRight: 4 }} />
                  <Text style={[styles.assistChipHighlightText, { color: colors.primaryLight }]}>
                    Refine: "{text.length > 22 ? text.slice(0, 22) + "…" : text}"
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

        {/* Spike Mail Minimal Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {/* Attach Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={pickFile}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primaryLight} />
            ) : (
              <Ionicons name="attach" size={22} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Traditional Email Compose Option (Requirement 7: where WhatsApp puts camera) */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleOpenTraditionalCompose(replyingTo)}
            title={t("composeFormalLetter")}
            accessibilityLabel={t("composeFormalLetter")}
          >
            <Ionicons name="mail-outline" size={21} color={colors.primaryLight} />
          </TouchableOpacity>

          {/* Mic Voice-to-Text Button */}
          <TouchableOpacity
            style={[styles.micBtn, isListening && { backgroundColor: colors.danger }]}
            onPress={toggleVoice}
            title={isListening ? "Stop listening" : "Voice-to-text"}
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={20}
              color={isListening ? "#fff" : colors.primaryLight}
            />
          </TouchableOpacity>

          {/* Language Selector Chip */}
          <TouchableOpacity
            style={[styles.langChip, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}
            onPress={() => setLangPickerVisible(true)}
            title="Recognition language"
          >
            <Text style={[styles.langChipText, { color: colors.textSecondary }]}>
              {voiceLang.split("-")[0].toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Message Input Box */}
          <TextInput
            ref={textInputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.chipInactive,
                color: colors.textPrimary,
                borderColor: colors.border,
                height: Math.min(160, Math.max(40, inputHeight)),
              },
            ]}
            placeholder={replyingTo ? t("typeReply") : t("typeMessage")}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            onContentSizeChange={(e) => {
              const h = e.nativeEvent?.contentSize?.height;
              if (h) setInputHeight(Math.max(40, h + 10));
            }}
            multiline
            scrollEnabled={inputHeight >= 160}
          />

          {/* Send Button (Spike minimal blue circle) */}
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primaryLight }]} onPress={send}>
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Traditional Email Modal (Requirement 6) */}
        <TraditionalEmailModal
          visible={Boolean(selectedModalMsg)}
          message={selectedModalMsg}
          onClose={() => setSelectedModalMsg(null)}
          onReplyInChat={(msg) => {
            setReplyingTo(msg);
            setTimeout(() => textInputRef.current?.focus(), 200);
          }}
          onReplyTraditional={(msg) => handleOpenTraditionalCompose(msg)}
          canReply={
            selectedModalMsg
              ? !repliedMessageIds.has(selectedModalMsg.id) &&
                (!selectedModalMsg.message_id || !repliedMessageIds.has(selectedModalMsg.message_id))
              : true
          }
        />

        <LanguagePickerModal
          visible={langPickerVisible}
          selectedLang={voiceLang}
          onSelect={handleSelectLang}
          onClose={() => setLangPickerVisible(false)}
          title="Select Voice-to-Text Language"
        />

        {/* Contact Profile Modal (Item 8) */}
        <Modal
          visible={contactModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setContactModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.contactCard, { backgroundColor: colors.surface || colors.card, borderColor: colors.border }]}>
              {contactLoading ? (
                <ActivityIndicator size="large" color={colors.accent || colors.primaryLight} style={{ marginVertical: 30 }} />
              ) : (
                <>
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <View style={[styles.largeAvatar, { backgroundColor: counterpartAvatarBg }]}>
                      <Text style={styles.largeAvatarText}>{counterpartInitials}</Text>
                    </View>
                    <Text style={[styles.contactModalName, { color: colors.textPrimary }]}>
                      {contactProfile?.display_name || counterpartName}
                    </Text>
                    {Boolean(contactProfile?.phone) && (
                      <Text style={[styles.contactModalPhone, { color: colors.textSecondary }]}>
                        {formatPhoneNumber(contactProfile.phone)}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.contactSection, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                      <Text style={[styles.contactRowText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {contactProfile?.email_address || thread?.counterpart || "No email"}
                      </Text>
                    </View>

                    {Array.isArray(contactProfile?.aliases) && contactProfile.aliases.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>
                          Aliases
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {contactProfile.aliases.map((al) => (
                            <View key={al} style={[styles.aliasBadge, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
                              <Text style={[styles.aliasText, { color: colors.textPrimary }]}>@{al}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.closeModalBtn, { backgroundColor: colors.primaryLight || colors.accent }]}
                    onPress={() => setContactModalVisible(false)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonContainer: {
    flex: 1,
    padding: spacing.md,
    gap: 16,
  },
  skeletonBubble: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  skeletonIn: {
    alignSelf: "flex-start",
    width: "60%",
  },
  skeletonOut: {
    alignSelf: "flex-end",
    width: "55%",
  },
  attachBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing.sm,
    borderTopWidth: 1,
    gap: 6,
  },
  attachChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    maxWidth: 180,
  },
  attachChipText: {
    fontSize: 11.5,
    flexShrink: 1,
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
  replyPreviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  replyPreviewBar: {
    width: 3.5,
    height: "100%",
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  replyPreviewSnippet: {
    fontSize: 12,
  },
  cancelReplyBtn: {
    padding: 4,
  },
  compactSubjectContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  compactSubjectInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    paddingVertical: 3,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderTopWidth: 1,
  },
  iconBtn: {
    padding: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  micBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  langChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginRight: 5,
  },
  langChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxHeight: 160,
    fontSize: 14.5,
    marginRight: spacing.sm,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
    borderTopColor: "#A7F3D0",
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
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: 5,
    paddingBottom: 2,
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
    fontSize: 11.5,
    fontWeight: "700",
  },
  assistChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 6,
    paddingBottom: 4,
  },
  assistChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarContact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  topBarSubtitle: {
    fontSize: 11.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  contactCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  largeAvatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  contactModalName: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  contactModalPhone: {
    fontSize: 13,
    marginTop: 2,
    textAlign: "center",
  },
  contactSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginVertical: 12,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactRowText: {
    fontSize: 13,
    flex: 1,
  },
  aliasBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aliasText: {
    fontSize: 11,
    fontWeight: "600",
  },
  closeModalBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
});
