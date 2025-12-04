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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load all available cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('credit_cards')
        .select('*');

      if (cardsError) throw cardsError;
      setCards(cardsData || []);

      // Load user's current wallet
      const { data: userCardsData, error: userCardsError } = await supabase
        .from('user_cards')
        .select('card_id')
        .eq('user_id', user.id);

      if (userCardsError) throw userCardsError;

      // Pre-select user's current cards
      const userCardIds = new Set<string>((userCardsData || []).map((item: any) => item.card_id));
      setSelectedCards(userCardIds);
      setInitialCards(userCardIds);
    } catch (error) {
      console.error('Failed to load cards:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Find cards to add (newly selected)
      const cardsToAdd = Array.from(selectedCards).filter(
        cardId => !initialCards.has(cardId)
      );

      // Find cards to remove (deselected)
      const cardsToRemove = Array.from(initialCards).filter(
        cardId => !selectedCards.has(cardId)
      );

      // Add new cards
      if (cardsToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('user_cards')
          .insert(
            cardsToAdd.map(cardId => ({
              user_id: user.id,
              card_id: cardId
            }))
          );
        if (addError) throw addError;
      }

      // Remove deselected cards
      if (cardsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('user_cards')
          .delete()
          .in('card_id', cardsToRemove)
          .eq('user_id', user.id);
        if (removeError) throw removeError;
      }

      Alert.alert('Success', 'Wallet updated successfully!');
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save cards');
    } finally {
      setSubmitting(false);
    }
  };

  const getRewardsSummary = (rewards: { [key: string]: number }) => {
    const entries = Object.entries(rewards);
    if (entries.length === 1 && 'everything' in rewards) {
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
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Your Cards</Text>
        <Text style={styles.subtitle}>
          You just tell TapRight what cards you own and that’s it
        </Text>
        <Text style={styles.badge}>{selectedCards.size} Selected</Text>
      </View>

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
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={32} color={COLORS.textSecondary} />
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
            <ActivityIndicator color={COLORS.textPrimary} />
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
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSoft,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  badge: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardList: {
    flex: 1,
  },
  cardListContent: {
    padding: 20,
  },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardItemSelected: {
    borderColor: COLORS.accent,
    shadowOpacity: 0.5,
  },
  cardColorIndicator: {
    width: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  cardIssuer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  cardRewards: {
    fontSize: 14,
    color: COLORS.accentMuted,
    marginTop: 10,
    fontWeight: '600',
  },
  cardFee: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginLeft: 12,
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  continueButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
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
});
