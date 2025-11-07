import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { notificationService } from '../services/notificationService';
import { VenueCategory } from '../services/venueCategorization';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationSetup() {
  const router = useRouter();
  const [isConfigured, setIsConfigured] = useState(false);
  const [preferences, setPreferences] = useState(notificationService.getPreferences());
  const [isLoading, setIsLoading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    checkNotificationStatus();
    loadNotificationData();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setIsConfigured(status === 'granted');
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const loadNotificationData = () => {
    setPreferences(notificationService.getPreferences());
    setDailyCount(notificationService.getDailyNotificationCount());
  };

  const enableNotifications = async () => {
    try {
      setIsLoading(true);
      const { status } = await Notifications.requestPermissionsAsync();

      if (status === 'granted') {
        setIsConfigured(true);
        Alert.alert('Success!', 'Notifications are now enabled for TapRight');
      } else {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings to receive card recommendations.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      // Try using the notification service first
      const sent = await notificationService.sendTestNotification();
      
      // Also try direct notification for immediate testing in Expo Go
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🧪 Test Notification',
            body: 'This is a test notification from TapRight!',
            data: { type: 'test' },
            sound: true,
          },
          trigger: null, // Send immediately
        });
        
        Alert.alert('✅ Notification Sent!', 'Check your notification center. If you don\'t see it, notifications may not be fully supported in Expo Go.');
        loadNotificationData();
      } catch (directError) {
        if (sent) {
          Alert.alert('Test Sent', 'Check your notifications for the test message!');
        } else {
          Alert.alert('⚠️ Limited Support', 'Notifications have limited support in Expo Go. For full testing, create a development build.');
          console.error('Notification error:', directError);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification. Check console for details.');
      console.error('Notification error:', error);
    }
  };

  const sendLocationTestNotification = async () => {
    try {
      // Mock venue for testing
      const mockVenue = {
        id: 'test_target',
        name: 'Target',
        category: VenueCategory.RETAIL_STORE,
        confidence: 0.9,
        dataSource: 'manual' as const,
        lastVerified: new Date(),
        latitude: 0,
        longitude: 0,
      };

      const sent = await notificationService.sendLocationBasedNotification(mockVenue);
      
      // Also try direct notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💳 Card Suggestion',
            body: 'Use your Best Rewards Card at Target for 5% back!',
            data: {
              type: 'location_recommendation',
              venueId: mockVenue.id,
              venueName: mockVenue.name,
            },
            sound: true,
          },
          trigger: null, // Send immediately
        });
        
        Alert.alert('✅ Notification Sent!', 'Check your notification center for the card suggestion.');
      } catch (directError) {
        if (sent) {
          Alert.alert('Test Sent', 'Check your notifications for the location-based suggestion!');
        } else {
          Alert.alert('⚠️ Limited Support', 'Location notifications may not work fully in Expo Go. Try a development build for full support.');
          console.error('Notification error:', directError);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send location test notification. Check console for details.');
      console.error('Notification error:', error);
    }
  };

  const toggleLocationRecommendations = async (value: boolean) => {
    await notificationService.savePreferences({ locationRecommendations: value });
    setPreferences(prev => ({ ...prev, locationRecommendations: value }));
  };

  const toggleWeeklyInsights = async (value: boolean) => {
    await notificationService.savePreferences({ weeklyInsights: value });
    setPreferences(prev => ({ ...prev, weeklyInsights: value }));
  };

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToDashboard = () => {
    router.replace('/dashboard');
  };

  if (!isConfigured) {
    return (
      <View style={styles.container}>
        <View style={styles.setupContainer}>
          <Text style={styles.title}>Enable Notifications 📱</Text>
          <Text style={styles.subtitle}>
            Get personalized card recommendations when you visit stores, weekly insights about your spending, and money-saving tips.
          </Text>

          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>You'll get:</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>💳</Text>
              <Text style={styles.benefitText}>Best card suggestions at stores</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>📊</Text>
              <Text style={styles.benefitText}>Weekly spending insights</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitText}>Potential savings alerts</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={enableNotifications}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Enabling...' : 'Enable Notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={goToDashboard}>
            <Text style={styles.skipText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={goToSettings} style={styles.settingsButton}>
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>You're All Set! 🎉</Text>
        <Text style={styles.subtitle}>
          TapRight will now send you intelligent notifications to help maximize your credit card rewards.
        </Text>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Notification Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusText}>Active and Ready</Text>
          </View>
          <Text style={styles.statusDetail}>
            Daily notifications sent: {dailyCount}/{preferences.maxNotificationsPerDay}
          </Text>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Location-Based Suggestions</Text>
              <Text style={styles.preferenceDescription}>
                Get notified about the best card when visiting stores
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, preferences.locationRecommendations && styles.toggleActive]}
              onPress={() => toggleLocationRecommendations(!preferences.locationRecommendations)}
            >
              <View style={[
                styles.toggleDot,
                preferences.locationRecommendations && styles.toggleDotActive
              ]} />
            </TouchableOpacity>
          </View>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Weekly Insights</Text>
              <Text style={styles.preferenceDescription}>
                Summary of your spending patterns and savings
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, preferences.weeklyInsights && styles.toggleActive]}
              onPress={() => toggleWeeklyInsights(!preferences.weeklyInsights)}
            >
              <View style={[
                styles.toggleDot,
                preferences.weeklyInsights && styles.toggleDotActive
              ]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notifications</Text>

          <TouchableOpacity style={styles.testButton} onPress={sendTestNotification}>
            <Text style={styles.testButtonText}>🧪 Send Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={sendLocationTestNotification}>
            <Text style={styles.testButtonText}>🏪 Test Location Suggestion</Text>
          </TouchableOpacity>
        </View>

        {/* Quiet Hours Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔕 Quiet Hours</Text>
          <Text style={styles.infoText}>
            Notifications are automatically paused during quiet hours ({preferences.quietHours.start} - {preferences.quietHours.end})
          </Text>
          <TouchableOpacity onPress={goToSettings}>
            <Text style={styles.infoLink}>Adjust in Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} onPress={goToDashboard}>
          <Text style={styles.continueText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
  },
  backText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  settingsButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
  },
  settingsText: {
    fontSize: 16,
  },
  content: {
    padding: 20,
  },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 40, lineHeight: 24 },
  benefitsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  skipButton: {
    padding: 12,
  },
  skipText: { color: '#007AFF', fontSize: 16 },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  statusDetail: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#007AFF',
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    position: 'absolute',
    left: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleDotActive: {
    left: 22,
  },
  testButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  infoLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});