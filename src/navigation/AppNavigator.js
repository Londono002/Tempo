/**
 * AppNavigator.js — Navegación por pestañas inferiores con soporte de tema.
 */

import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen       from '../screens/HomeScreen';
import TimerScreen      from '../screens/TimerScreen';
import HistoryScreen    from '../screens/HistoryScreen';
import ActivitiesScreen from '../screens/ActivitiesScreen';

import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize } from '../theme/typography';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Inicio',       label: 'Inicio',      iconOff: 'home-outline',          iconOn: 'home',          component: HomeScreen       },
  { name: 'Temporizador', label: 'Ahora',        iconOff: 'timer-outline',         iconOn: 'timer',         component: TimerScreen      },
  { name: 'Historial',    label: 'Historial',    iconOff: 'calendar-outline',      iconOn: 'calendar',      component: HistoryScreen    },
  { name: 'Actividades',  label: 'Actividades',  iconOff: 'color-palette-outline', iconOn: 'color-palette', component: ActivitiesScreen },
];

export default function AppNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const defaultBottomPadding = Platform.OS === 'ios' ? 20 : 8;
  const bottomPadding = Math.max(insets.bottom, defaultBottomPadding);
  const baseTabBarHeight = Platform.OS === 'ios' ? 84 : 64;
  const tabBarHeight = baseTabBarHeight + bottomPadding - defaultBottomPadding;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find(t => t.name === route.name);
        return {
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? tab.iconOn : tab.iconOff} size={size} color={color} />
          ),
          tabBarActiveTintColor:   colors.tab.active,
          tabBarInactiveTintColor: colors.tab.inactive,
          tabBarStyle: {
            backgroundColor: colors.tab.background,
            borderTopColor:  colors.tab.border,
            borderTopWidth:  1,
            paddingBottom:   bottomPadding,
            paddingTop:      8,
            height:          tabBarHeight,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.semibold,
            fontSize:   10,
          },
          headerStyle: {
            backgroundColor: colors.background.screen,
            shadowColor:     'transparent',
            elevation:       0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontFamily: fonts.bold,
            fontSize:   fontSize.lg,
            color:      colors.text.primary,
          },
          headerShadowVisible: false,
          headerTitleAlign:    'left',
        };
      }}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label, title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}
