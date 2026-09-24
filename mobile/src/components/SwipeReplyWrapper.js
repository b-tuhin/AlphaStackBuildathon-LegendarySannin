import React, { useRef } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/whatsapp";

// Minimal WhatsApp-style swipe-right-to-reply gesture wrapper.
export default function SwipeReplyWrapper({ children, onReply }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && g.dx > 0,
      onPanResponderMove: (_, g) => {
        const dx = Math.min(g.dx, 70);
        translateX.setValue(dx);
        iconOpacity.setValue(Math.min(dx / 60, 1));
      },
      onPanResponderRelease: (_, g) => {
        const shouldReply = g.dx > 55;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        if (shouldReply && onReply) onReply();
      },
    })
  ).current;

  return (
    <View>
      <Animated.View style={{ position: "absolute", left: 12, top: "35%", opacity: iconOpacity }}>
        <Ionicons name="arrow-undo" size={20} color={colors.primaryLight} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
