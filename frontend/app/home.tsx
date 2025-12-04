import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
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

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<UserCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  useEffect(() => {
    loadUserData();
    if (Constants.appOwnership !== 'expo') {
      startBackgroundTracking();
    }
    registerForPushNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    try {
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
      Alert.alert('Error', 'Failed to load data');
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

  // Logic to check location and get recommendation
  const checkLocation = async (latitude: number, longitude: number, userId: string) => {
    // 1. Fetch merchants
    const { data: merchants } = await supabase.from('merchants').select('*');
    if (!merchants) return null;

    // 2. Find nearby merchant
    const nearbyMerchant = merchants.find(m => {
      const dist = calculateDistance(latitude, longitude, m.latitude, m.longitude);
      return dist <= (m.radius || 150);
    });

    if (!nearbyMerchant) return { found: false };

    // 3. Fetch user cards to find best one
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
          merchant_name: nearbyMerchant.name,
          message: "Add cards to get rewards!"
        }
      };
    }

    // 4. Find best card
    let bestCard: any = null;
    let maxRate = 0;
    const category = nearbyMerchant.category.toLowerCase();

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
          merchant_name: nearbyMerchant.name,
          message: `Use ${bestCard.name} for ${maxRate}% back!`
        }
      };
    }

    return { found: true, recommendation: { merchant_name: nearbyMerchant.name, message: "Use your preferred card." } };
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

          if (result?.found && result.recommendation && !result.no_cards) {
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
      // In Expo Go / simulator, simulate tracking for demo purposes
      if (Constants.appOwnership === 'expo') {
        setTrackingEnabled(true);
        return;
      }

      // Background tracking only works on native platforms
      if (Platform.OS === 'web') {
        Alert.alert(
          'Background Tracking Unavailable',
          'Background location tracking requires a native mobile device (iOS/Android). Use "Check Current Location" button to test the recommendation feature on web.',
          [{ text: 'OK' }]
        );
        return;
      }

      const { status } = await Location.getBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 120000, // 2 minutes
          distanceInterval: 100, // 100 meters
          foregroundService: {
            notificationTitle: 'TapRight Active',
            notificationBody: 'Finding best card recommendations for you',
          },
        });
        setTrackingEnabled(true);
        Alert.alert('Tracking Started', 'TapRight is now monitoring your location for nearby merchants.');
      } else {
        Alert.alert('Permission Required', 'Background location permission is required for automatic tracking.');
      }
    } catch (error) {
      console.error('Failed to start background tracking:', error);
      Alert.alert('Error', 'Background tracking not supported in Expo Go. Works in development builds only.');
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      if (Constants.appOwnership === 'expo') {
        setTrackingEnabled(false);
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      setTrackingEnabled(false);
    } catch (error) {
      console.warn('Background tracking may not have been running:', error);
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
        Alert.alert('Permission Denied', 'Location permission is required');
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
      Alert.alert('Error', error.message || 'Failed to check location');
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

      // Note: Local notifications don't require Expo Push Token
      // Remote push notifications are not supported in Expo Go SDK 53+
      // Our app uses local notifications triggered by location tracking

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

      Alert.alert(
        `💳 ${rec.merchant_name}`,
        rec.message,
        [{ text: 'Got it!' }]
      );
    } else if (data.throttled) {
      Alert.alert('Already Notified', 'We recently sent a recommendation for this location.');
    } else if (data.no_cards) {
      Alert.alert('No Cards', 'Add cards to your wallet to get recommendations.');
    } else {
      Alert.alert('No Merchants Nearby', 'No nearby merchants found in our database.');
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.trackingButton,
            trackingEnabled && styles.trackingButtonActive,
          ]}
          onPress={toggleTracking}
        >
          <Ionicons
            name={trackingEnabled ? 'location' : 'location-outline'}
            size={20}
            color={trackingEnabled ? 'white' : COLORS.textPrimary}
          />
          <Text style={styles.trackingButtonText}>
            Tracking: {trackingEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <TouchableOpacity style={styles.checkButton} onPress={checkCurrentLocation}>
          <Ionicons name="scan" size={24} color="white" />
          <Text style={styles.checkButtonText}>Check Current Location</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Wallet</Text>
            <TouchableOpacity
              style={styles.manageCardsButton}
              onPress={() => router.push('/card-selection')}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.accent} />
              <Text style={styles.manageCardsText}>Manage Cards</Text>
            </TouchableOpacity>
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No cards in wallet</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/card-selection')}
              >
                <Text style={styles.addButtonText}>Add Cards</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {cards.map((card) => (
                <View key={card.id} style={styles.cardItem}>
                  <View
                    style={[
                      styles.cardColorBar,
                      { backgroundColor: card.card_color },
                    ]}
                  />
                  <View style={styles.cardDetails}>
                    <Text style={styles.cardName}>{card.card_name}</Text>
                    <Text style={styles.cardIssuer}>{card.card_issuer}</Text>
                    <Text style={styles.cardRewards}>
                      {getRewardsSummary(card.rewards)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={COLORS.accent} />
          <Text style={styles.infoText}>
            {Platform.OS === 'web'
              ? '📱 For full location tracking, download the Expo Go app and scan the QR code. Web version allows manual location checks only.'
              : 'TapRight monitors your location in the background and sends local notifications when you\'re near merchants with rewards. Enable tracking above to start receiving recommendations!'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  logoutButton: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 16,
    alignSelf: 'flex-start',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  trackingButtonActive: {
    backgroundColor: COLORS.success,
    shadowOpacity: 0.45,
  },
  trackingButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  checkButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
    marginTop: 28,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  manageCardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  manageCardsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 50,
    marginTop: 18,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  addButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardColorBar: {
    width: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  cardDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  cardIssuer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  cardRewards: {
    fontSize: 14,
    color: COLORS.accentMuted,
    marginTop: 8,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginTop: 28,
    marginBottom: 28,
    padding: 20,
    borderRadius: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  tokenBox: {
    backgroundColor: COLORS.surface,
    marginBottom: 28,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.accentMuted,
    marginLeft: 8,
  },
  tokenLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tokenText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tokenHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
