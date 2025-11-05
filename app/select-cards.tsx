import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CARD_OPTIONS = [
  { id: '1', name: 'American Express' },
  { id: '2', name: 'Discover' },
  { id: '3', name: 'Chase Sapphire' },
  { id: '4', name: 'Apple Card' },
  { id: '5', name: 'Capital One' },
];

export default function SelectCards() {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  const toggleCard = (cardId: string) => {
    setSelected(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleContinue = () => {
    router.push('/mirror-wallet');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Cards</Text>
      <Text style={styles.subtitle}>Pick the cards you use most often</Text>

      <FlatList
        data={CARD_OPTIONS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, selected.includes(item.id) && styles.selectedCard]}
            onPress={() => toggleCard(item.id)}
          >
            <Text style={styles.cardText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {selected.length > 0 && (
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginTop: 40 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  selectedCard: {
    backgroundColor: '#000',
  },
  cardText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 16 },
});
