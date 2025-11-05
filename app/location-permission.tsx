import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LocationPermission() {
  const [status, setStatus] = useState<string>('');
  const router = useRouter();

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setStatus('Location access granted!');
        // Navigate to notification demo or home
        setTimeout(() => router.push('/notification-demo'), 1500);
      } else {
        setStatus('Permission denied');
        Alert.alert('Permission Required', 'Location access is needed to suggest the best card at stores.');
      }
    } catch {
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Access</Text>
      <Text style={styles.description}>
        We use your location only to identify stores you visit, so we can suggest which card gives you the best rewards.
      </Text>
      <Text style={styles.privacy}>
        🔒 Your location is never stored or shared. All processing happens on your device.
      </Text>

      <TouchableOpacity style={styles.button} onPress={requestPermission}>
        <Text style={styles.buttonText}>Grant Permission</Text>
      </TouchableOpacity>

      {status !== '' && (
        <Text style={styles.statusText}>{status}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  description: { fontSize: 16, color: '#333', marginBottom: 20, lineHeight: 24 },
  privacy: { fontSize: 14, color: '#666', marginBottom: 40, lineHeight: 22 },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 16 },
  statusText: { marginTop: 20, fontSize: 16, color: '#28a745', textAlign: 'center' },
});