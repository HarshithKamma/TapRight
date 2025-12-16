import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';
import PremiumAlert from '../components/PremiumAlert';
import VisualCard from '../components/VisualCard';
import * as Haptics from 'expo-haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  color: string;
  rewards: { [key: string]: number };
  annual_fee: number;
}

export default function WalletEditorScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams();
  const [userCards, setUserCards] = useState<CreditCard[]>([]);
  const [allCards, setAllCards] = useState<CreditCard[]>([]);

  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Alerts
  const [cardToRemove, setCardToRemove] = useState<CreditCard | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Load All Cards (Reference)
      const { data: allCardsData } = await supabase
        .from('credit_cards')
        .select('*');

      setAllCards(allCardsData || []);

      // 2. Load User's Cards (Actual Wallet)
      const { data: userWalletData, error } = await supabase
        .from('user_cards')
        .select(`
          card_id,
          credit_cards (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Flatten structure
      const wallet = userWalletData.map((item: any) => item.credit_cards);
      setUserCards(wallet);

    } catch (error) {
      console.error('Failed to load wallet:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  // Filter cards for the "Add" modal (exclude ones already owned)
  const getAvailableCards = () => {
    const ownedIds = new Set(userCards.map(c => c.id));
    return allCards.filter(c =>
      !ownedIds.has(c.id) &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.issuer.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const handleAddCard = async (card: CreditCard) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Optimistic Update: Use functional update to prevent race conditions
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserCards(prev => [...prev, card]);
    // setAddModalVisible(false); // REMOVED FOR MULTI-SELECT
    // setSearchQuery(''); // REMOVED: Keep search results for rapid multi-add

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('user_cards')
        .insert({
          user_id: user.id,
          card_id: card.id
        });

      if (error) throw error;
    } catch (error: any) {
      console.error('Failed to add card:', error);
      Alert.alert('Save Failed', error.message || 'Could not save change.');
      // Revert optimization would go here
      loadData();
    }
  };

  const confirmRemove = (card: CreditCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCardToRemove(card);
    setShowRemoveConfirm(true);
  };

  const executeRemove = async () => {
    if (!cardToRemove) return;

    // Optimistic Remove: Use functional update
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserCards(prev => prev.filter(c => c.id !== cardToRemove!.id));
    setShowRemoveConfirm(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('card_id', cardToRemove.id);

      if (error) throw error;
      console.log('Deleted card:', cardToRemove.name);

    } catch (error: any) {
      console.error('Failed to remove card:', error);
      Alert.alert('Error', 'Could not delete card.');
      loadData(); // Revert
    }
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Wallet</Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
            if (onboarding === 'true') {
              router.replace('/home');
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="checkmark" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Wallet List */}
        {userCards.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="card-outline" size={48} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>Your wallet is empty</Text>
            <Text style={styles.emptyText}>
              Add the cards you own to get personalized recommendations when you shop.
            </Text>
            <TouchableOpacity
              style={styles.addFirstCardButton}
              onPress={() => setAddModalVisible(true)}
            >
              <Text style={styles.addFirstCardText}>Add Your First Card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardList}>
            {userCards.map((card) => (
              <View key={card.id} style={styles.walletItemWrapper}>
                <VisualCard
                  name={card.name}
                  issuer={card.issuer}
                  color={card.color}
                  rewards={card.rewards}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmRemove(card)}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Button at bottom of list */}
            <TouchableOpacity
              style={styles.bottomAddButton}
              onPress={() => setAddModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color={'white'} />
              <Text style={styles.bottomAddText}>Add another card</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Card Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Card</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search e.g. 'Sapphire', 'Amex'..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={false}
            />
          </View>

          <ScrollView contentContainerStyle={styles.resultList}>
            {getAvailableCards().map(card => (
              <TouchableOpacity
                key={card.id}
                style={styles.resultItem}
                onPress={() => handleAddCard(card)}
              >
                <View style={[styles.miniCardIcon, { backgroundColor: card.color }]}>
                  <Text style={styles.miniCardText}>{card.issuer[0]}</Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{card.name}</Text>
                  <Text style={styles.resultIssuer}>{card.issuer}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            ))}
            {getAvailableCards().length === 0 && (
              <Text style={styles.noResults}>No matching cards found.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Confirmation Alert */}
      <PremiumAlert
        visible={showRemoveConfirm}
        title="Remove Card?"
        message={`Are you sure you want to remove ${cardToRemove?.name}?`}
        icon="trash"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={executeRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceHighlight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  cardList: {
    gap: 20,
  },
  walletItemWrapper: {
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceHighlight,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  bottomAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: COLORS.textPrimary,
    borderRadius: 16,
    gap: 12,
    marginTop: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bottomAddText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  addFirstCardButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 100,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  addFirstCardText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceHighlight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSoft,
    margin: 20,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  resultList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceHighlight,
  },
  miniCardIcon: {
    width: 40,
    height: 26,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  miniCardText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resultIssuer: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.textSecondary,
    fontSize: 16,
  }
});
