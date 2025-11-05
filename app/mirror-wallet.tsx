import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MOCK_SELECTED_CARDS = [
  { id: '1', name: 'American Express', color: '#006FCF' },
  { id: '2', name: 'Discover', color: '#FF6000' },
  { id: '3', name: 'Chase Sapphire', color: '#003366' },
];

export default function MirrorWallet() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Mirror Wallet</Text>
      <Text style={styles.subtitle}>Visual cards only — no sensitive data stored</Text>

      <ScrollView style={styles.cardList} showsVerticalScrollIndicator={false}>
        {MOCK_SELECTED_CARDS.map(card => (
          <View key={card.id} style={[styles.card, { backgroundColor: card.color }]}>
            <Text style={styles.cardName}>{card.name}</Text>
            <Text style={styles.cardHolder}>John Doe</Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/location-permission')}>
        <Text style={styles.buttonText}>Enable Location Access</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: '700', marginTop: 40 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 30 },
  cardList: { flex: 1 },
  card: {
    height: 200,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardName: { fontSize: 20, fontWeight: '600', color: '#fff' },
  cardHolder: { fontSize: 16, color: '#fff', opacity: 0.8 },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 16 },
});