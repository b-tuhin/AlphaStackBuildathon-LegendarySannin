import React, { useRef } from "react";
import { Animated, PanResponder, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/whatsapp";

/**
 * Minimal swipe-right-to-reply gesture wrapper styled for Spike Mail.
 * If enabled is false (e.g. message has already been replied to),
 * gesture tracking and reply affordance icon are completely disabled.
 */
export default function SwipeReplyWrapper({ children, onReply, enabled = true }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => enabled && Math.abs(g.dx) > 12 && g.dx > 0,
      onPanResponderMove: (_, g) => {
        if (!enabled) return;
        const dx = Math.min(g.dx, 75);
        translateX.setValue(dx);
        iconOpacity.setValue(Math.min(dx / 60, 1));
      },
      onPanResponderRelease: (_, g) => {
        if (!enabled) return;
        const shouldReply = g.dx > 55;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        if (shouldReply && onReply) onReply();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!enabled) {
    return <View>{children}</View>;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.replyIconContainer, { opacity: iconOpacity }]}>
        <View style={styles.replyIconCircle}>
          <Ionicons name="arrow-undo" size={16} color={colors.primaryLight} />
        </View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  replyIconContainer: {
    position: "absolute",
    left: 14,
    top: "32%",
    zIndex: 1,
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
});
