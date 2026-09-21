import 'react-native-gesture-handler';
import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { StoreProvider } from './src/lib/store';
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
      <StoreProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
          <StatusBar style="dark" />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
