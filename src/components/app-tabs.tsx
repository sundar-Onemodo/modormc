import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface CustomTabButtonProps extends TabTriggerSlotProps {
  label: string;
  iconName: string;
  family: 'ion' | 'mci';
}

function CustomTabButton({
  label,
  iconName,
  family,
  isFocused,
  ...props
}: CustomTabButtonProps) {
  const activeColor = '#FFFFFF';
  const inactiveColor = 'rgba(255, 255, 255, 0.7)';

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabItem,
        pressed && styles.tabItemPressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}>
      {/* Active pill background container (matching user image 2) */}
      <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
        {family === 'ion' ? (
          <Ionicons
            name={iconName as any}
            size={22}
            color={isFocused ? activeColor : inactiveColor}
          />
        ) : (
          <MaterialCommunityIcons
            name={iconName as any}
            size={22}
            color={isFocused ? activeColor : inactiveColor}
          />
        )}
      </View>
      <Text
        style={[
          styles.tabLabel,
          isFocused ? styles.activeTabLabel : styles.inactiveTabLabel,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={styles.container}>
      <Tabs>
        <TabSlot style={styles.tabSlot} />
        
        {/* Bottom Tab Bar with #2563EB background (matching user instruction) */}
        <TabList style={[styles.tabBar, { paddingBottom: bottomPadding }]}>
          {/* 1. Home */}
          <TabTrigger name="index" href="/" asChild>
            <CustomTabButton
              label="Home"
              iconName="home-outline"
              family="ion"
            />
          </TabTrigger>

          {/* 2. Leads */}
          <TabTrigger name="leads" href="/leads" asChild>
            <CustomTabButton
              label="Leads"
              iconName="account-multiple-outline"
              family="mci"
            />
          </TabTrigger>

          {/* 3. Follow ups */}
          <TabTrigger name="followups" href="/followups" asChild>
            <CustomTabButton
              label="Follow ups"
              iconName="calendar-check-outline"
              family="mci"
            />
          </TabTrigger>

          {/* 4. Orders */}
          <TabTrigger name="orders" href="/orders" asChild>
            <CustomTabButton
              label="Orders"
              iconName="clipboard-text-outline"
              family="mci"
            />
          </TabTrigger>

          {/* 5. More */}
          <TabTrigger name="more" href="/more" asChild>
            <CustomTabButton
              label="More"
              iconName="menu-outline"
              family="ion"
            />
          </TabTrigger>
        </TabList>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabSlot: {
    flex: 1,
    height: '100%',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#2563EB', // Explicitly requested by user: #2563EB
    paddingTop: 8,
    borderTopWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabItemPressed: {
    opacity: 0.85,
  },
  iconContainer: {
    width: 48,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)', // Subtle white card/pill matching Image 2
  },
  tabLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  activeTabLabel: {
    color: '#FFFFFF', // Active tab is white as requested
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});
