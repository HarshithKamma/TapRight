import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { notificationService } from '../services/notificationService';

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
      await notificationService.sendTestNotification();
      Alert.alert('Test Sent', 'Check your notifications for the test message!');
      loadNotificationData(); // Reload to update daily count
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const sendLocationTestNotification = async () => {
    try {
      // Mock venue for testing
      const mockVenue = {
        id: 'test_target',
        name: 'Target',
        category: 'retail_store' as any,
        confidence: 0.9,
        dataSource: 'manual' as const,
        lastVerified: new Date(),
        latitude: 0,
        longitude: 0,
      };

      await notificationService.sendLocationBasedNotification(mockVenue);
      Alert.alert('Test Sent', 'Check your notifications for the location-based suggestion!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send location test notification');
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
  container: { flex: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 15 },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 40, lineHeight: 24 },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkButton: { marginTop: 10 },
  linkText: { color: '#007AFF', fontSize: 16 },
});