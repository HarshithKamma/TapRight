import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationDemo() {
  const router = useRouter();

  const sendTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'TapRight Recommendation 💳',
        body: 'Use your Amex Gold for 5% cashback at Target!',
      },
      trigger: null, // Send immediately
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You&#39;re All Set! 🎉</Text>
      <Text style={styles.subtitle}>
        TapRight will notify you when you&#39;re near a store, suggesting the best card for maximum rewards.
      </Text>

      <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
        <Text style={styles.buttonText}>Test Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/mirror-wallet')}>
        <Text style={styles.linkText}>Back to Mirror Wallet</Text>
      </TouchableOpacity>
    </View>
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