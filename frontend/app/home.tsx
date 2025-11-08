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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
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
  }),
});

// Define background location task
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
        const token = await AsyncStorage.getItem('token');
        const user = await AsyncStorage.getItem('user');
        
        if (!token || !user) return;
        
        const userData = JSON.parse(user);
        
        const response = await axios.post(
          `${BACKEND_URL}/api/location/check`,
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            user_id: userData.id,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.found && response.data.recommendation) {
          const rec = response.data.recommendation;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `💳 ${rec.merchant_name}`,
              body: rec.message,
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

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string>('');

  useEffect(() => {
    loadUserData();
    startBackgroundTracking();
    registerForPushNotifications();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('token');
      
      if (!userStr || !token) {
        router.replace('/');
        return;
      }

      const userData = JSON.parse(userStr);
      setUser(userData);

      const response = await axios.get(`${BACKEND_URL}/api/user-cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCards(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startBackgroundTracking = async () => {
    try {
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
            notificationTitle: 'TapWise Active',
            notificationBody: 'Finding best card recommendations for you',
          },
        });
        setTrackingEnabled(true);
        Alert.alert('Tracking Started', 'TapWise is now monitoring your location for nearby merchants.');
      } else {
        Alert.alert('Permission Required', 'Background location permission is required for automatic tracking.');
      }
    } catch (error) {
      console.error('Failed to start background tracking:', error);
      Alert.alert('Error', 'Failed to start background tracking. This feature requires a real mobile device.');
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setTrackingEnabled(false);
    } catch (error) {
      console.error('Failed to stop background tracking:', error);
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
      } catch (locError) {
        // Fallback for web or simulator - use sample location
        Alert.alert(
          'Location Unavailable',
          'Using sample location (Starbucks Downtown) for testing. This feature works on real devices.',
          [
            {
              text: 'Use Sample Location',
              onPress: async () => {
                const token = await AsyncStorage.getItem('token');
                const response = await axios.post(
                  `${BACKEND_URL}/api/location/check`,
                  {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    user_id: user?.id,
                  },
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );
                handleLocationResponse(response.data);
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const token = await AsyncStorage.getItem('token');

      const response = await axios.post(
        `${BACKEND_URL}/api/location/check`,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          user_id: user?.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      handleLocationResponse(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check location');
    }
  };

  const registerForPushNotifications = async () => {
    try {
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

      // Get the Expo Push Token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // This will be auto-detected in Expo Go
      });
      
      const token = tokenData.data;
      setExpoPushToken(token);
      
      // Log to console for easy copying
      console.log('📱 EXPO PUSH TOKEN:', token);
      console.log('🔗 Test notifications at: https://expo.dev/notifications');
      console.log('Copy this token and paste it into the Expo notification tool');
      
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  };

  const handleLocationResponse = (data: any) => {
    if (data.found && data.recommendation) {
      const rec = data.recommendation;
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
    if (entries.length === 1 && rewards.everything) {
      return `${rewards.everything}% on Everything`;
    }
    return entries
      .map(([key, value]) => `${value}% ${key}`)
      .join(', ');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="white" />
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
            color="white"
          />
          <Text style={styles.trackingButtonText}>
            Tracking: {trackingEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

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
              <Ionicons name="settings-outline" size={20} color="#667eea" />
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
          <Ionicons name="information-circle" size={24} color="#667eea" />
          <Text style={styles.infoText}>
            {Platform.OS === 'web'
              ? '📱 For full location tracking, download the Expo Go app and scan the QR code. Web version allows manual location checks only.'
              : 'TapWise monitors your location in the background and sends notifications when you\'re near merchants with rewards.'}
          </Text>
        </View>

        {expoPushToken && Platform.OS !== 'web' && (
          <View style={styles.tokenBox}>
            <View style={styles.tokenHeader}>
              <Ionicons name="notifications" size={20} color="#667eea" />
              <Text style={styles.tokenTitle}>Test Notifications</Text>
            </View>
            <Text style={styles.tokenLabel}>Your Expo Push Token:</Text>
            <TouchableOpacity
              style={styles.tokenContainer}
              onPress={() => {
                Alert.alert(
                  'Push Token',
                  expoPushToken,
                  [
                    { text: 'OK' },
                    {
                      text: 'View in Console',
                      onPress: () => console.log('EXPO PUSH TOKEN:', expoPushToken),
                    },
                  ]
                );
              }}
            >
              <Text style={styles.tokenText} numberOfLines={1} ellipsizeMode="middle">
                {expoPushToken}
              </Text>
              <Ionicons name="copy-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <Text style={styles.tokenHint}>
              Tap to view • Check console logs • Test at expo.dev/notifications
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
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
    color: 'white',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  trackingButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
  },
  trackingButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  checkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
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
    color: '#333',
  },
  sectionBadge: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  manageCardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  manageCardsText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardColorBar: {
    width: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardIssuer: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardRewards: {
    fontSize: 14,
    color: '#667eea',
    marginTop: 6,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e0e7ff',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#4338ca',
    lineHeight: 20,
  },
  tokenBox: {
    backgroundColor: '#f0f9ff',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginLeft: 8,
  },
  tokenLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tokenText: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tokenHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
});
