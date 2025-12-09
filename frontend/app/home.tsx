import React, { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS } from '../constants/Colors';
import { identifyMerchant } from '../lib/mapbox';
import PremiumAlert from '../components/PremiumAlert';

const LOCATION_TASK_NAME = 'background-location-task';

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
    shouldShowAlert: true,
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
    <Pressable onPress={onValueChange}>
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

  useEffect(() => {
    loadUserData();
    registerForPushNotifications();
  }, []);

  const loadUserData = async () => {
    try {
      // Restore tracking state
      const savedTracking = await AsyncStorage.getItem('trackingEnabled');
      if (savedTracking === 'true') {
        setTrackingEnabled(true);
        // We don't automatically restart it here to avoid the popup loop effectively,
        // unless you want it to persist. 
        // Better: Only start if user explicitly turns it on, OR check if already running.
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
          setTrackingEnabled(true);
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
    } catch (error) {
      console.error('Failed to load data:', error);
      showPremiumAlert('Error', 'Failed to load data', 'alert-circle');
    } finally {
      setRefreshing(false);
    }
  };

  // Helper to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Log visit to history
  const logVisit = async (userId: string, merchant: any) => {
    try {
      // 1. Check for recent visit (last 1 hour) to avoid spam
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentVisits } = await supabase
        .from('location_history')
        .select('id')
        .eq('user_id', userId)
        .eq('merchant_name', merchant.name)
        .gte('visited_at', oneHourAgo)
        .limit(1);

      if (recentVisits && recentVisits.length > 0) {
        console.log('Skipping log: Recently visited', merchant.name);
        return;
      }

      // 2. Insert new visit
      const { error } = await supabase
        .from('location_history')
        .insert({
          user_id: userId,
          merchant_name: merchant.name,
          category: merchant.category,
          latitude: merchant.latitude,
          longitude: merchant.longitude,
        });

      if (error) {
        console.error('Supabase insert error:', error);
      } else {
        console.log('✅ Visit logged:', merchant.name);
      }
    } catch (error) {
      console.error('Failed to log visit:', error);
    }
  };

  // Logic to check location and get recommendation
  const checkLocation = async (latitude: number, longitude: number, userId: string) => {
    // 1. Identify Merchant via Mapbox (Dynamic)
    const mapboxMerchant = await identifyMerchant(latitude, longitude);

    if (mapboxMerchant) {
      // Log the visit
      logVisit(userId, mapboxMerchant);

      // Find best card for this dynamic merchant
      return await findBestCardForMerchant(userId, mapboxMerchant);
    }

    return { found: false };
  };

  const findBestCardForMerchant = async (userId: string, merchant: any) => {
    const { data: userCards } = await supabase
      .from('user_cards')
      .select(`
      credit_cards (
        name,
        rewards
      )
    `)
      .eq('user_id', userId);

    if (!userCards || userCards.length === 0) {
      return {
        found: true,
        no_cards: true,
        recommendation: {
          merchant_name: merchant.name,
          message: "Add cards to get rewards!"
        }
      };
    }

    // 4. Find best card
    let bestCard: any = null;
    let maxRate = 0;
    const category = (merchant.category || 'general').toLowerCase();

    userCards.forEach((item: any) => {
      const card = item.credit_cards;
      const rewards = card.rewards || {};
      // Check specific category, then 'everything' or 'general'
      const rate = rewards[category] || rewards['everything'] || rewards['general'] || 1;

      if (rate > maxRate) {
        maxRate = rate;
        bestCard = card;
      }
    });

    if (bestCard) {
      return {
        found: true,
        recommendation: {
          merchant_name: merchant.name,
          message: `Use ${bestCard.name} for ${maxRate}% back!`
        }
      };
    }

    return { found: true, recommendation: { merchant_name: merchant.name, message: "Use your preferred card." } };
  };

  // Define background task
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('Background location error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      const location = locations[0];

      if (location) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const result = await checkLocation(location.coords.latitude, location.coords.longitude, user.id);

          if (result?.found && 'recommendation' in result && !('no_cards' in result)) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `💳 ${result.recommendation.merchant_name}`,
                body: result.recommendation.message,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
              },
              trigger: null,
            });
          }
        } catch (error) {
          console.error('Failed to check location:', error);
        }
      }
    }
  });

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
          timeInterval: 10000, // Check every 10 seconds
          distanceInterval: 50, // Or every 50 meters
        },
        async (location) => {
          console.log('📍 New location update:', location.coords);

          // Debounce: Ignore updates if less than 5 seconds since last notification
          const now = Date.now();
          if (now - lastNotificationTime.current < 5000) {
            console.log('Skipping update: Debounced');
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const result = await checkLocation(location.coords.latitude, location.coords.longitude, user.id);

            // Only update timestamp if we actually found something and notified
            if (result?.found) {
              lastNotificationTime.current = now;
              await handleLocationResponse(result);
            }
          }
        }
      );
      setLocationSubscription(subscription);

      // 2. Start Background Tracking (For when app is closed)
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // 1 minute
          distanceInterval: 100, // 100 meters
          foregroundService: {
            notificationTitle: 'TapRight Active',
            notificationBody: 'Finding best card recommendations for you',
          },
        });
      }

      setTrackingEnabled(true);
      await AsyncStorage.setItem('trackingEnabled', 'true');
      showPremiumAlert('Tracking Started', 'TapRight is now automatically checking your location.', 'location');

    } catch (error: any) {
      console.error('Failed to start tracking:', error);
      showPremiumAlert('Error', error.message || 'Failed to start tracking', 'alert-circle');
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      // Stop foreground subscription
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }

      // Stop background task
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

  const toggleTracking = async () => {
    if (trackingEnabled) {
      await stopBackgroundTracking();
    } else {
      await startBackgroundTracking();
    }
  };

  const checkCurrentLocation = async () => {
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
    }
  };

  const registerForPushNotifications = async () => {
    try {
      // Skip on web platform
      if (Platform.OS === 'web') {
        console.log('Push notifications not available on web');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      console.log('✅ Local notifications enabled');
      console.log('📍 Background tracking will send notifications when near merchants');
      console.log('📍Location getting stored in supabase DB')

    } catch (error: any) {
      console.error('Error setting up notifications:', error);
    }
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

      // Use Premium Alert instead of native Alert
      showPremiumAlert(`💳 ${rec.merchant_name}`, rec.message, 'card');

    } else if (data.throttled) {
      // Optional: Don't show alert for throttled, or show a subtle one
      // showPremiumAlert('Already Notified', 'We recently sent a recommendation for this location.', 'time');
    } else if (data.no_cards) {
      showPremiumAlert('No Cards', 'Add cards to your wallet to get recommendations.', 'wallet');
    } else {
      showPremiumAlert('No Merchant Identified', 'We could not identify a merchant at this location.', 'search');
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

          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/card-selection')}>
            <View style={styles.actionIcon}>
              <Ionicons name="add" size={24} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.actionText}>Add Card</Text>
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
                <View key={card.id} style={styles.cardItem}>
                  <View style={[styles.cardIcon, { backgroundColor: card.card_color || COLORS.surfaceHighlight }]} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{card.card_name}</Text>
                    <Text style={styles.cardIssuer}>{card.card_issuer}</Text>
                  </View>
                  <View style={styles.cardRewardBadge}>
                    <Text style={styles.cardRewardText}>{getRewardsSummary(card.rewards).split(',')[0]}</Text>
                  </View>
                </View>
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
