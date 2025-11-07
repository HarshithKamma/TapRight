import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { locationService } from '../services/locationService';
import { locationDataStorageService } from '../services/locationDataStorage';
import { venueCategorizationService } from '../services/venueCategorization';

export default function Settings() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Settings states
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [backgroundLocation, setBackgroundLocation] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationRecommendations, setLocationRecommendations] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(true);
  const [dataRetentionDays, setDataRetentionDays] = useState(30);
  const [batteryOptimization, setBatteryOptimization] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load location settings
      const locationStatus = await Location.getForegroundPermissionsAsync();
      setLocationEnabled(locationStatus.status === 'granted');

      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      setBackgroundLocation(backgroundStatus.status === 'granted');

      // Load notification settings
      const notificationStatus = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(notificationStatus.status === 'granted');

      // Load app preferences
      const prefs = await AsyncStorage.getItem('appSettings');
      if (prefs) {
        const settings = JSON.parse(prefs);
        setLocationRecommendations(settings.locationRecommendations ?? true);
        setWeeklyInsights(settings.weeklyInsights ?? true);
        setDataRetentionDays(settings.dataRetentionDays ?? 30);
        setBatteryOptimization(settings.batteryOptimization ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Partial<typeof settings>) => {
    try {
      const currentSettings = {
        locationRecommendations,
        weeklyInsights,
        dataRetentionDays,
        batteryOptimization,
        ...newSettings,
      };

      await AsyncStorage.setItem('appSettings', JSON.stringify(currentSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleLocationToggle = async (value: boolean) => {
    if (!value) {
      // Turning off location - stop tracking
      await locationService.stopLocationTracking();
      setLocationEnabled(false);
      setBackgroundLocation(false);
      return;
    }

    try {
      const granted = await locationService.requestPermissions();
      if (granted) {
        setLocationEnabled(true);
        await locationService.startLocationTracking({
          enableBackgroundTracking: backgroundLocation,
          trackingInterval: batteryOptimization ? 60000 : 30000, // 1 min vs 30 sec
        });
      } else {
        Alert.alert('Permission Required', 'Location access is needed for personalized recommendations');
      }
    } catch (error) {
      console.error('Error enabling location:', error);
      Alert.alert('Error', 'Failed to enable location tracking');
    }
  };

  const handleBackgroundLocationToggle = async (value: boolean) => {
    if (!locationEnabled) {
      Alert.alert('Location Required', 'Please enable location tracking first');
      return;
    }

    try {
      if (value) {
        const granted = await Location.requestBackgroundPermissionsAsync();
        if (granted) {
          setBackgroundLocation(true);
          await locationService.startLocationTracking({
            enableBackgroundTracking: true,
            trackingInterval: batteryOptimization ? 60000 : 30000,
          });
        } else {
          Alert.alert('Permission Required', 'Background location access is needed for continuous tracking');
        }
      } else {
        setBackgroundLocation(false);
        await locationService.startLocationTracking({
          enableBackgroundTracking: false,
          trackingInterval: batteryOptimization ? 60000 : 30000,
        });
      }
    } catch (error) {
      console.error('Error toggling background location:', error);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotificationsEnabled(status === 'granted');

        if (status === 'granted') {
          // Configure notification handler
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
        }
      } else {
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };

  const handleBatteryOptimizationToggle = async (value: boolean) => {
    setBatteryOptimization(value);
    await saveSettings({ batteryOptimization: value });

    // Update location tracking interval if location is enabled
    if (locationEnabled) {
      await locationService.startLocationTracking({
        enableBackgroundTracking: backgroundLocation,
        trackingInterval: value ? 60000 : 30000,
      });
    }
  };

  const handleClearLocationData = () => {
    Alert.alert(
      'Clear Location Data',
      'This will permanently delete all your location history and insights. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await locationService.clearLocationData();
              await locationDataStorageService.clearAllData();
              await venueCategorizationService.clearCache();
              Alert.alert('Success', 'All location data has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear location data');
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      const data = await locationDataStorageService.exportData();
      // In a real app, you would share this data via file sharing
      Alert.alert('Export Complete', 'Your data has been prepared for export');
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all user data
              await locationService.clearLocationData();
              await locationDataStorageService.clearAllData();
              await venueCategorizationService.clearCache();
              await AsyncStorage.removeItem('appSettings');
              await AsyncStorage.removeItem('venueCache');

              // Logout user
              await logout();
              Alert.alert('Account Deleted', 'Your account has been permanently deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.settingButton} onPress={() => router.push('/profile')}>
          <Text style={styles.settingButtonText}>Edit Profile</Text>
          <Text style={styles.settingButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Location Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Tracking</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Location Tracking</Text>
            <Text style={styles.settingDescription}>
              Track your visits to provide personalized card recommendations
            </Text>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={handleLocationToggle}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Background Tracking</Text>
            <Text style={styles.settingDescription}>
              Continue tracking when app is closed
            </Text>
          </View>
          <Switch
            value={backgroundLocation}
            onValueChange={handleBackgroundLocationToggle}
            disabled={!locationEnabled}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Battery Optimization</Text>
            <Text style={styles.settingDescription}>
              Reduce tracking frequency to save battery
            </Text>
          </View>
          <Switch
            value={batteryOptimization}
            onValueChange={handleBatteryOptimizationToggle}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive card recommendations and insights
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Location-Based Suggestions</Text>
            <Text style={styles.settingDescription}>
              Get notified about the best card when visiting stores
            </Text>
          </View>
          <Switch
            value={locationRecommendations}
            onValueChange={(value) => {
              setLocationRecommendations(value);
              saveSettings({ locationRecommendations: value });
            }}
            disabled={!notificationsEnabled || !locationEnabled}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Weekly Insights</Text>
            <Text style={styles.settingDescription}>
              Summary of your spending patterns and card recommendations
            </Text>
          </View>
          <Switch
            value={weeklyInsights}
            onValueChange={(value) => {
              setWeeklyInsights(value);
              saveSettings({ weeklyInsights: value });
            }}
            disabled={!notificationsEnabled}
            trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          />
        </View>
      </View>

      {/* Privacy Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Data Retention</Text>
            <Text style={styles.settingDescription}>
              Keep location data for {dataRetentionDays} days
            </Text>
          </View>
          <View style={styles.retionButtons}>
            {[30, 60, 90].map(days => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.retionButton,
                  dataRetentionDays === days && styles.retionButtonActive,
                ]}
                onPress={() => {
                  setDataRetentionDays(days);
                  saveSettings({ dataRetentionDays: days });
                }}
              >
                <Text style={[
                  styles.retionButtonText,
                  dataRetentionDays === days && styles.retionButtonTextActive,
                ]}>
                  {days}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
          <Text style={styles.actionButtonText}>Export My Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleClearLocationData}>
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Clear Location Data</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <TouchableOpacity style={styles.settingButton} onPress={() => router.push('/help')}>
          <Text style={styles.settingButtonText}>Help & Support</Text>
          <Text style={styles.settingButtonArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={() => router.push('/privacy')}>
          <Text style={styles.settingButtonText}>Privacy Policy</Text>
          <Text style={styles.settingButtonArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={() => router.push('/terms')}>
          <Text style={styles.settingButtonText}>Terms of Service</Text>
          <Text style={styles.settingButtonArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>TapRight Version 1.0.0</Text>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
          <Text style={styles.actionButtonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleDeleteAccount}>
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  placeholder: {
    width: 32,
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  userInfo: {
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
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  settingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingButtonText: {
    fontSize: 16,
    color: '#000',
  },
  settingButtonArrow: {
    fontSize: 16,
    color: '#666',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  retionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  retionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  retionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  retionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  retionButtonTextActive: {
    color: '#fff',
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  dangerButtonText: {
    color: '#dc3545',
  },
  versionInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
  },
});