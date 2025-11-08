import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  color: string;
  rewards: { [key: string]: number };
  annual_fee: number;
}

export default function CardSelectionScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [initialCards, setInitialCards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCardsAndUserWallet();
  }, []);

  const loadCardsAndUserWallet = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Load all available cards
      const cardsResponse = await axios.get(`${BACKEND_URL}/api/cards`);
      setCards(cardsResponse.data);
      
      // Load user's current wallet
      const userCardsResponse = await axios.get(`${BACKEND_URL}/api/user-cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Pre-select user's current cards
      const userCardIds = new Set(userCardsResponse.data.map((card: any) => card.card_id));
      setSelectedCards(userCardIds);
      setInitialCards(userCardIds);
    } catch (error) {
      Alert.alert('Error', 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleContinue = async () => {
    if (selectedCards.size === 0) {
      Alert.alert('Select Cards', 'Please select at least one credit card');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Find cards to add (newly selected)
      const cardsToAdd = Array.from(selectedCards).filter(
        cardId => !initialCards.has(cardId)
      );
      
      // Find cards to remove (deselected)
      const cardsToRemove = Array.from(initialCards).filter(
        cardId => !selectedCards.has(cardId)
      );
      
      // Add new cards
      for (const cardId of cardsToAdd) {
        try {
          await axios.post(
            `${BACKEND_URL}/api/user-cards?card_id=${cardId}`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        } catch (error: any) {
          // Skip if already exists
          if (error.response?.status !== 400) {
            throw error;
          }
        }
      }
      
      // Remove deselected cards
      for (const cardId of cardsToRemove) {
        await axios.delete(
          `${BACKEND_URL}/api/user-cards/${cardId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      Alert.alert('Success', 'Wallet updated successfully!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save cards');
    } finally {
      setSubmitting(false);
    }
  };

  const getRewardsSummary = (rewards: { [key: string]: number }) => {
    const entries = Object.entries(rewards);
    if (entries.length === 1 && rewards.everything) {
      return `${rewards.everything}% on Everything`;
    }
    return entries
      .slice(0, 2)
      .map(([key, value]) => `${value}% ${key}`)
      .join(', ');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Your Cards</Text>
        <Text style={styles.subtitle}>
          Select or deselect to add/remove cards
        </Text>
        <Text style={styles.badge}>{selectedCards.size} Selected</Text>
      </LinearGradient>

      <ScrollView style={styles.cardList} contentContainerStyle={styles.cardListContent}>
        {cards.map((card) => {
          const isSelected = selectedCards.has(card.id);
          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.cardItem,
                isSelected && styles.cardItemSelected,
              ]}
              onPress={() => toggleCard(card.id)}
            >
              <View
                style={[
                  styles.cardColorIndicator,
                  { backgroundColor: card.color },
                ]}
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardIssuer}>{card.issuer}</Text>
                <Text style={styles.cardRewards}>
                  {getRewardsSummary(card.rewards)}
                </Text>
                {card.annual_fee > 0 && (
                  <Text style={styles.cardFee}>${card.annual_fee} annual fee</Text>
                )}
              </View>
              <View style={styles.checkboxContainer}>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={32} color="#667eea" />
                )}
                {!isSelected && (
                  <Ionicons name="ellipse-outline" size={32} color="#ccc" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedCards.size === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={submitting || selectedCards.size === 0}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.continueButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
  },
  badge: {
    fontSize: 14,
    color: 'white',
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  cardList: {
    flex: 1,
  },
  cardListContent: {
    padding: 16,
  },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardItemSelected: {
    borderColor: '#667eea',
  },
  cardColorIndicator: {
    width: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  cardInfo: {
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
    marginTop: 8,
    fontWeight: '600',
  },
  cardFee: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginLeft: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  continueButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
