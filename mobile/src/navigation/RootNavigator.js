import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";

import LanguageScreen from "../screens/onboarding/LanguageScreen";
import TermsScreen from "../screens/onboarding/TermsScreen";
import PhoneInputScreen from "../screens/onboarding/PhoneInputScreen";
import OtpScreen from "../screens/onboarding/OtpScreen";
import PasswordLoginScreen from "../screens/onboarding/PasswordLoginScreen";

import InboxScreen from "../screens/InboxScreen";
import ChatScreen from "../screens/ChatScreen";
import ComposeScreen from "../screens/ComposeScreen";
import DraftsScreen from "../screens/DraftsScreen";
import SpamScreen from "../screens/SpamScreen";
import TrashScreen from "../screens/TrashScreen";
import ProfileScreen from "../screens/ProfileScreen";

import { colors } from "../theme/whatsapp";
import { getToken } from "../api/client";

const RootStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Onboarding flow: Language -> Terms -> Phone -> OTP (-> password fallback)
function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Language" component={LanguageScreen} />
      <OnboardingStack.Screen name="Terms" component={TermsScreen} />
      <OnboardingStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <OnboardingStack.Screen name="Otp" component={OtpScreen} />
      <OnboardingStack.Screen name="PasswordLogin" component={PasswordLoginScreen} />
    </OnboardingStack.Navigator>
  );
}

// Top-left drawer combines Inbox, Drafts, Spam, Trash (the "unified menu" from the spec)
function DrawerNavigator() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false, drawerActiveTintColor: colors.primary }}>
      <Drawer.Screen name="Inbox" component={InboxScreen} options={{ title: "Inbox & Sent" }} />
      <Drawer.Screen name="Drafts" component={DraftsScreen} />
      <Drawer.Screen name="Spam" component={SpamScreen} />
      <Drawer.Screen name="Trash" component={TrashScreen} />
    </Drawer.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: "#fff" }}>
      <MainStack.Screen name="Drawer" component={DrawerNavigator} options={{ headerShown: false }} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="Compose" component={ComposeScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      setInitialRoute(token ? "MainApp" : "Onboarding");
    })();
  }, []);

  if (!initialRoute) return null; // splash is handled by app.json

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        <RootStack.Screen name="MainApp" component={MainNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
