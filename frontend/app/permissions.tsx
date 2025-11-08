import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

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
          'Location permission is required for TapWise to work properly.'
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
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <View style={styles.content}>
          <Ionicons name="shield-checkmark" size={80} color="white" />
          <Text style={styles.title}>Permissions Required</Text>
          <Text style={styles.subtitle}>
            TapWise needs these permissions to provide smart recommendations
          </Text>

          <View style={styles.permissionsList}>
            <TouchableOpacity
              style={[
                styles.permissionItem,
                locationGranted && styles.permissionItemGranted,
              ]}
              onPress={requestLocationPermission}
            >
              <Ionicons
                name={locationGranted ? 'checkmark-circle' : 'location'}
                size={40}
                color={locationGranted ? '#4ade80' : 'white'}
              />
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Location Access</Text>
                <Text style={styles.permissionDescription}>
                  Detect merchants near you
                </Text>
              </View>
              {!locationGranted && (
                <Ionicons name="chevron-forward" size={24} color="white" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.permissionItem,
                notificationGranted && styles.permissionItemGranted,
              ]}
              onPress={requestNotificationPermission}
            >
              <Ionicons
                name={notificationGranted ? 'checkmark-circle' : 'notifications'}
                size={40}
                color={notificationGranted ? '#4ade80' : 'white'}
              />
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>Notifications</Text>
                <Text style={styles.permissionDescription}>
                  Receive card recommendations
                </Text>
              </View>
              {!notificationGranted && (
                <Ionicons name="chevron-forward" size={24} color="white" />
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
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionsList: {
    width: '100%',
    marginTop: 40,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  permissionItemGranted: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  permissionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  continueButton: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  continueButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
