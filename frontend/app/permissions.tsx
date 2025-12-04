import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { COLORS } from '../constants/Colors';



export default function PermissionsScreen() {
  const router = useRouter();
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);

  const requestLocationPermission = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required for TapRight to work properly.'
        );
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Permission',
          'Background location helps us send timely recommendations even when the app is closed.'
        );
      }

      setLocationGranted(true);
    } catch (error) {
      console.error('Failed to request location permission:', error);
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Notification permission is required to send you card recommendations.'
        );
        return;
      }

      setNotificationGranted(true);
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      Alert.alert('Error', 'Failed to request notification permission');
    }
  };

  const handleContinue = () => {
    if (!locationGranted) {
      Alert.alert('Location Required', 'Please grant location permission to continue.');
      return;
    }
    if (!notificationGranted) {
      Alert.alert('Notifications Required', 'Please grant notification permission to continue.');
      return;
    }
    router.replace('/home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.gradient}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={64} color={COLORS.accentMuted} />
        </View>
        <Text style={styles.title}>Permissions Required</Text>
        <Text style={styles.subtitle}>
          TapRight needs these permissions to provide smart recommendations
        </Text>

        <View style={styles.permissionsList}>
          <TouchableOpacity
            style={[
              styles.permissionItem,
              locationGranted && styles.permissionItemGranted,
            ]}
            onPress={requestLocationPermission}
          >
            <View style={styles.permissionIconBadge}>
              <Ionicons
                name={locationGranted ? 'checkmark-circle' : 'location'}
                size={32}
                color={locationGranted ? COLORS.success : COLORS.textSecondary}
              />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Location Access</Text>
              <Text style={styles.permissionDescription}>
                Detect merchants near you
              </Text>
            </View>
            {!locationGranted && (
              <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.permissionItem,
              notificationGranted && styles.permissionItemGranted,
            ]}
            onPress={requestNotificationPermission}
          >
            <View style={styles.permissionIconBadge}>
              <Ionicons
                name={notificationGranted ? 'checkmark-circle' : 'notifications'}
                size={32}
                color={notificationGranted ? COLORS.success : COLORS.textSecondary}
              />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Notifications</Text>
              <Text style={styles.permissionDescription}>
                Receive card recommendations
              </Text>
            </View>
            {!notificationGranted && (
              <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!locationGranted || !notificationGranted) &&
            styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!locationGranted || !notificationGranted}
        >
          <Text style={styles.continueButtonText}>Continue to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    margin: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionsList: {
    width: '100%',
    marginTop: 36,
    gap: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  permissionItemGranted: {
    borderColor: COLORS.success,
    shadowOpacity: 0.45,
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  permissionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  continueButton: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.surfaceHighlight,
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  permissionIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    marginRight: 16,
  },
});
