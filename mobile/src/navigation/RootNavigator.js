import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";

import LanguageScreen from "../screens/onboarding/LanguageScreen";
import TermsScreen from "../screens/onboarding/TermsScreen";
import PhoneInputScreen from "../screens/onboarding/PhoneInputScreen";
import PhoneOtpScreen from "../screens/onboarding/PhoneOtpScreen";
import CreatePasswordScreen from "../screens/onboarding/CreatePasswordScreen";
import PasswordLoginScreen from "../screens/onboarding/PasswordLoginScreen";
import ForgotPasswordScreen from "../screens/onboarding/ForgotPasswordScreen";
import ChangePasswordScreen from "../screens/onboarding/ChangePasswordScreen";

import InboxScreen from "../screens/InboxScreen";
import ChatScreen from "../screens/ChatScreen";
import ComposeScreen from "../screens/ComposeScreen";
import ImportantScreen from "../screens/ImportantScreen";
import DraftsScreen from "../screens/DraftsScreen";
import SpamScreen from "../screens/SpamScreen";
import TrashScreen from "../screens/TrashScreen";
import ProfileScreen from "../screens/ProfileScreen";

import { useTheme } from "../theme/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  refreshSession,
  getMe,
} from "../api/client";

const RootStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Language -> Terms -> Phone -> Create password; returning users: phone + password login
function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Language" component={LanguageScreen} />
      <OnboardingStack.Screen name="Terms" component={TermsScreen} />
      <OnboardingStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <OnboardingStack.Screen name="PhoneOtp" component={PhoneOtpScreen} />
      <OnboardingStack.Screen name="CreatePassword" component={CreatePasswordScreen} />
      <OnboardingStack.Screen name="PasswordLogin" component={PasswordLoginScreen} />
      <OnboardingStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <OnboardingStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </OnboardingStack.Navigator>
  );
}

function DrawerNavigator() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.textSecondary,
        drawerStyle: { backgroundColor: colors.surface || colors.card },
        edgeWidth: 24,
        swipeEdgeWidth: 24,
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: t("folderHome"),
          drawerIcon: ({ color, size }) => <Ionicons name="mail-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Important"
        component={ImportantScreen}
        options={{
          title: t("folderImportant"),
          drawerIcon: ({ size }) => <Ionicons name="star" size={size} color="#f59e0b" />,
        }}
      />
      <Drawer.Screen
        name="Drafts"
        component={DraftsScreen}
        options={{
          title: t("folderDrafts"),
          drawerIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Spam"
        component={SpamScreen}
        options={{
          title: t("folderSpam"),
          drawerIcon: ({ color, size }) => <Ionicons name="alert-circle-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Trash"
        component={TrashScreen}
        options={{
          title: t("folderTrash"),
          drawerIcon: ({ color, size }) => <Ionicons name="trash-outline" size={size} color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}

function MainNavigator() {
  const { colors } = useTheme();
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
      }}
    >
      <MainStack.Screen name="Drawer" component={DrawerNavigator} options={{ headerShown: false }} />
      <MainStack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="Compose" component={ComposeScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      // 1. Check for stored refresh token in secure storage.
      // If no stored refresh token exists, there is nothing to unlock:
      // the biometric prompt MUST NOT appear.
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) {
        setInitialRoute("Onboarding");
        return;
      }

      // 2. Check biometric hardware availability and enrollment
      let hasBiometrics = false;
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        hasBiometrics = hasHardware && isEnrolled;
      } catch {
        hasBiometrics = false;
      }

      if (hasBiometrics) {
        // 3. Prompt for biometric authentication before unlocking session
        try {
          const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock PhoneMail",
            fallbackLabel: "Use Password",
            cancelLabel: "Cancel",
          });

          if (!authResult.success) {
            // User cancelled or biometric failed — require manual password login
            setInitialRoute("Onboarding");
            return;
          }
        } catch {
          setInitialRoute("Onboarding");
          return;
        }
      }

      // 4. Exchange the valid refresh token for a fresh access token
      try {
        const { data } = await refreshSession(storedRefreshToken);
        await setToken(data.token);
        if (data.refreshToken) {
          await setRefreshToken(data.refreshToken);
        }
        setInitialRoute(data.mustChangePassword ? "ForcePassword" : "MainApp");
      } catch (err) {
        // Token was revoked or expired on the server — clear invalid session
        await clearRefreshToken();
        await clearToken();
        setInitialRoute("Onboarding");
      }
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        <RootStack.Screen name="ForcePassword" component={ChangePasswordScreen} />
        <RootStack.Screen name="MainApp" component={MainNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
