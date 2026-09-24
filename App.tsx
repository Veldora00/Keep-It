import 'react-native-gesture-handler';
import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { StoreProvider, useStore } from './src/lib/store';
import { AuthProvider, useAuth } from './src/lib/auth';
import AuthScreen from './src/screens/AuthScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import GoalOnboardingScreen from './src/screens/GoalOnboardingScreen';
import DailyCheckIn from './src/components/DailyCheckIn';
import SubscriptionRecheck from './src/components/SubscriptionRecheck';
import { GlobalAlertHost } from './src/lib/alert';
import { colors } from './src/theme/theme';
import HomeScreen from './src/screens/HomeScreen';
import SavedScreen from './src/screens/SavedScreen';
import ForecastScreen from './src/screens/ForecastScreen';
import ToolsScreen from './src/screens/ToolsScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '◐',
  Saved: '▦',
  Forecast: '↗',
  Tools: '≡',
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <AppGate />
          <GlobalAlertHost />
          <StatusBar style="dark" />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppGate() {
  const { session, initializing, passwordRecovery } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paperWarm }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // A recovery-link session is only for setting a new password — don't drop
  // the user straight into the app with it.
  if (passwordRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <StoreProvider>
      <AuthedApp />
    </StoreProvider>
  );
}

// Split out so it can read the store — gates on the goal question being
// answered before anything else in the app renders, so every screen after
// this point has a goal to point its copy at.
function AuthedApp() {
  const { ready, goal } = useStore();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paperWarm }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!goal) {
    return <GoalOnboardingScreen />;
  }

  return (
    <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.accentDeep,
            tabBarInactiveTintColor: colors.inkFaint,
            tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
            tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Saved" component={SavedScreen} />
          <Tab.Screen name="Forecast" component={ForecastScreen} />
          <Tab.Screen name="Tools" component={ToolsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <DailyCheckIn />
      <SubscriptionRecheck />
    </>
  );
}
