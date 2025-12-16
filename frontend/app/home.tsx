import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS } from '../constants/Colors';
import { LOCATION_TASK_NAME, checkLocation } from '../lib/location-task';
import PremiumAlert from '../components/PremiumAlert';
import * as Haptics from 'expo-haptics';
import VisualCard from '../components/VisualCard';

interface UserCard {
  id: string;
  card_name: string;
  card_issuer: string;
  card_color: string;
  rewards: { [key: string]: number };
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Custom Animated Switch Component
const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: () => void }) => {
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22], // Move from left (2) to right (22)
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.surfaceHighlight, COLORS.success], // Grey to Green
  });

  return (
    <Pressable onPress={() => {
      Haptics.selectionAsync();
      onValueChange();
    }}>
      <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<UserCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const lastNotificationTime = useRef<number>(0);
  const notificationsRegistered = useRef<boolean>(false);
  const isScanning = useRef<boolean>(false);

  // Check system state for tracking
  useEffect(() => {
    TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME).then(isRegistered => {
      setTrackingEnabled(isRegistered);
    });
  }, []);

  // Premium Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    icon: 'notifications' as keyof typeof Ionicons.glyphMap,
    confirmText: 'Got it!',
    onConfirm: () => setAlertVisible(false),
  });

  const showPremiumAlert = (title: string, message: string, icon: keyof typeof Ionicons.glyphMap = 'notifications') => {
    setAlertConfig({
      title,
      message,
      icon,
      confirmText: 'Got it!',
      onConfirm: () => setAlertVisible(false),
    });
    setAlertVisible(true);
  };

  const handleLocationResponse = async (data: any) => {
    if (data.found && data.recommendation) {
      const rec = data.recommendation;

      if (Platform.OS !== 'web') {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `💳 ${rec.merchant_name}`,
              body: rec.message,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        } catch (error) {
          console.error('Failed to schedule notification:', error);
        }
      }
      // Notification only - no popup

    } else if (data.throttled) {
      // Skip - already notified recently
    } else if (data.no_cards) {
      // Only show popup for important errors that need user action
      showPremiumAlert('No Cards', 'Add cards to your wallet to get recommendations.', 'wallet');
    }
  };

  const checkCurrentLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Prevent duplicate scans
    if (isScanning.current) {
      return;
    }
    isScanning.current = true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showPremiumAlert('Permission Denied', 'Location permission is required', 'warning');
        return;
      }

      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        // Fallback for simulator
        location = { coords: { latitude: 37.7749, longitude: -122.4194 } };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const result = await checkLocation(location.coords.latitude, location.coords.longitude, user.id);
      await handleLocationResponse(result);

    } catch (error: any) {
      showPremiumAlert('Error', error.message || 'Failed to check location', 'alert-circle');
    } finally {
      isScanning.current = false;
    }
  };

  const startBackgroundTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showPremiumAlert('Permission Denied', 'Location permission is required for tracking.', 'warning');
        return;
      }

      // 1. Start Foreground Tracking (Automatic while app is open)
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 50,
        },
        async (location) => {
          console.log('📍 New location update:', location.coords);
          const now = Date.now();
          if (now - lastNotificationTime.current < 5000) {
            console.log('Skipping update: Debounced');
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const result = await checkLocation(location.coords.latitude, location.coords.longitude, user.id);
            if (result?.found) {
              lastNotificationTime.current = now;
              await handleLocationResponse(result);
            }
          }
        }
      );
      setLocationSubscription(subscription);

      // 2. Start Background Tracking
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 25,
          foregroundService: {
            notificationTitle: 'TapRight Active',
            notificationBody: 'Finding best card recommendations for you',
          },
        });
      }

      setTrackingEnabled(true);
      await AsyncStorage.setItem('trackingEnabled', 'true');

      // Explicitly trigger a check immediately to ensure "Instant" feel
      await checkCurrentLocation();

    } catch (error: any) {
      console.error('Failed to start tracking:', error);
      showPremiumAlert('Error', error.message || 'Failed to start tracking', 'alert-circle');
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      setTrackingEnabled(false);
      await AsyncStorage.setItem('trackingEnabled', 'false');
    } catch (error) {
      console.warn('Error stopping tracking:', error);
    }
  };

  const registerForPushNotifications = async () => {
    if (notificationsRegistered.current) return;
    try {
      if (Platform.OS === 'web') return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      notificationsRegistered.current = true;
    } catch (error: any) {
      console.error('Error setting up notifications:', error);
    }
  };

  const loadUserData = async () => {
    try {
      // Default to TRUE if not set (first launch) or explicitly true
      const savedTracking = await AsyncStorage.getItem('trackingEnabled');
      if (savedTracking === 'true' || savedTracking === null) {
        setTrackingEnabled(true);
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

        // Auto-start if missing
        if (!isRegistered) {
          // We can safely call this because functions are hoisted/defined in scope
          startBackgroundTracking();
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/');
        return;
      }

      setUser({
        id: user.id,
        name: user.user_metadata?.full_name || 'User',
        email: user.email || '',
      });

      const { data: userCards, error } = await supabase
        .from('user_cards')
        .select(`
          id,
          credit_cards (
            id,
            name,
            issuer,
            color,
            rewards
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedCards = userCards.map((item: any) => ({
        id: item.credit_cards.id,
        card_name: item.credit_cards.name,
        card_issuer: item.credit_cards.issuer,
        card_color: item.credit_cards.color,
        rewards: item.credit_cards.rewards,
      }));

      setCards(formattedCards);

      // Trigger instant check on load
      checkCurrentLocation();

    } catch (error) {
      console.error('Failed to load data:', error);
      showPremiumAlert('Error', 'Failed to load data', 'alert-circle');
    } finally {
      setRefreshing(false);
    }
  };

  // Effects
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const toggleTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (trackingEnabled) {
      await stopBackgroundTracking();
    } else {
      await startBackgroundTracking();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await stopBackgroundTracking();
    await AsyncStorage.clear();
    router.replace('/');
  };

  const getRewardsSummary = (rewards: { [key: string]: number }) => {
    const entries = Object.entries(rewards);
    if (entries.length === 1 && 'everything' in rewards) {
      return `${rewards.everything}% on Everything`;
    }
    return entries
      .map(([key, value]) => `${value}% ${key}`)
      .join(', ');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good evening,</Text>
          <Text style={styles.userName}>{user?.name.split(' ')[0] || 'User'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={32} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: trackingEnabled ? COLORS.success : COLORS.surfaceHighlight }]}>
              <Ionicons name={trackingEnabled ? "radio" : "radio-outline"} size={18} color={trackingEnabled ? "white" : COLORS.textSecondary} />
            </View>
            <Text style={styles.statusTitle}>Background Tracking</Text>
            <CustomSwitch value={trackingEnabled} onValueChange={toggleTracking} />
          </View>
          <Text style={styles.statusText}>
            {trackingEnabled
              ? "TapRight is monitoring your location for rewards."
              : "Enable tracking to get automatic card recommendations."}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={checkCurrentLocation}>
            <View style={styles.actionIcon}>
              <Ionicons name="scan" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.actionText}>Scan Location</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/trends');
          }}>
            <View style={styles.actionIcon}>
              <Ionicons name="stats-chart" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.actionText}>Insights</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/card-selection');
          }}>
            <View style={styles.actionIcon}>
              <Ionicons
                name={cards.length > 0 ? "wallet-outline" : "add"}
                size={24}
                color={COLORS.textPrimary}
              />
            </View>
            <Text style={styles.actionText}>
              {cards.length > 0 ? "Manage Cards" : "Add Card"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Wallet</Text>

          {cards.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color={COLORS.surfaceHighlight} />
              <Text style={styles.emptyStateText}>No cards added yet.</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Future: Open card details
                  }}
                >
                  <VisualCard
                    name={card.card_name}
                    issuer={card.card_issuer}
                    color={card.card_color}
                    rewards={card.rewards}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Premium Alert Component */}
      <PremiumAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertVisible(false)}
        cancelText="Close" // Optional, or hide cancel button if not needed for simple alerts
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.surfaceHighlight,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceHighlight,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.surfaceHighlight,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  cardList: {
    gap: 12,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceHighlight,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 26,
    borderRadius: 6,
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardIssuer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardRewardBadge: {
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cardRewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 2,
  },
});
