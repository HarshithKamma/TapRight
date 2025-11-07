import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { cardRecommendationService, CardRecommendation } from '../services/cardRecommendation';
import { spendCategorizationService, SpendingProfile } from '../services/spendCategorization';
import { trendAnalysisService, UserBehaviorProfile } from '../services/trendAnalysis';
import { CREDIT_CARDS, getCardById } from '../data/creditCards';
import { VenueCategory } from '../services/venueCategorization';

export default function CardRecommendations() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<CardRecommendation[]>([]);
  const [spendingProfile, setSpendingProfile] = useState<SpendingProfile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'rewards' | 'fee'>('score');

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);

      // Mock data - in real app, this would come from actual user data
      const mockSpending: SpendingProfile = {
        totalEstimatedMonthlySpend: 2500,
        categoryBreakdown: [
          { category: VenueCategory.RESTAURANT, estimatedMonthlySpend: 400, confidence: 0.8, averagePerVisit: 35, visitsPerMonth: 11, dataSource: 'inferred' },
          { category: VenueCategory.GROCERY, estimatedMonthlySpend: 600, confidence: 0.9, averagePerVisit: 120, visitsPerMonth: 5, dataSource: 'inferred' },
          { category: VenueCategory.GAS_STATION, estimatedMonthlySpend: 200, confidence: 0.8, averagePerVisit: 50, visitsPerMonth: 4, dataSource: 'inferred' },
          { category: VenueCategory.COFFEE_SHOP, estimatedMonthlySpend: 80, confidence: 0.7, averagePerVisit: 6, visitsPerMonth: 13, dataSource: 'inferred' },
        ],
        highSpendingCategories: [VenueCategory.GROCERY, VenueCategory.RESTAURANT, VenueCategory.GAS_STATION],
        potentialSavings: [],
        spendingTrends: [],
      };

      const mockBehavior: UserBehaviorProfile = {
        primaryCategories: [VenueCategory.RESTAURANT, VenueCategory.GROCERY, VenueCategory.COFFEE_SHOP],
        secondaryCategories: [VenueCategory.GAS_STATION, VenueCategory.RETAIL_STORE],
        routinePatterns: {
          workdayPattern: [VenueCategory.COFFEE_SHOP, VenueCategory.RESTAURANT],
          weekendPattern: [VenueCategory.GROCERY, VenueCategory.RESTAURANT],
          frequentDestinations: [],
        },
        lifestyleIndicators: {
          isFoodie: true,
          isFamilyOriented: false,
          isBudgetConscious: false,
          isProfessional: false,
          isSocial: true,
          isHealthConscious: false,
        },
        spendingHabits: {
          frequencyOfEatingOut: 8,
          frequencyOfShopping: 2,
          frequencyOfEntertainment: 6,
          preferredShoppingTimes: ['Afternoon', 'Evening'],
        },
      };

      setSpendingProfile(mockSpending);

      // Generate recommendations
      const context = {
        userSpending: mockSpending,
        userBehavior: mockBehavior,
        currentCards: [],
        preferences: {
          maxAnnualFee: 200,
          creditScoreRequired: 'Good' as const,
        },
      };

      const cardRecommendations = await cardRecommendationService.generateRecommendations(context, 10);
      setRecommendations(cardRecommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      Alert.alert('Error', 'Failed to load card recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedRecommendations = () => {
    let filtered = recommendations;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = recommendations.filter(rec =>
        rec.card.recommendedFor.includes(selectedCategory) ||
        (rec.card.rewards.categoryRates[selectedCategory] || 0) > 0.02
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rewards':
          return b.estimatedRewards - a.estimatedRewards;
        case 'fee':
          return a.card.annualFee - b.card.annualFee;
        default:
          return b.score - a.score;
      }
    });
  };

  const getCategoryName = (category: VenueCategory): string => {
    const names: Record<VenueCategory, string> = {
      [VenueCategory.GAS_STATION]: 'Gas Stations',
      [VenueCategory.RESTAURANT]: 'Restaurants',
      [VenueCategory.BAR]: 'Bars',
      [VenueCategory.LIQUOR_STORE]: 'Liquor Stores',
      [VenueCategory.PHARMACY]: 'Pharmacies',
      [VenueCategory.GROCERY]: 'Grocery Stores',
      [VenueCategory.COFFEE_SHOP]: 'Coffee Shops',
      [VenueCategory.MALL]: 'Malls',
      [VenueCategory.RETAIL_STORE]: 'Retail Stores',
      [VenueCategory.ELECTRONICS_STORE]: 'Electronics',
      [VenueCategory.CLOTHING_STORE]: 'Clothing',
      [VenueCategory.UNKNOWN]: 'Other',
    };
    return names[category] || 'Unknown';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleCardPress = (cardId: string) => {
    router.push(`/card-details/${cardId}`);
  };

  const handleApply = (card: any) => {
    Alert.alert(
      'Apply for Card',
      `Would you like to apply for the ${card.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Learn More',
          onPress: () => handleCardPress(card.id),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding your perfect cards...</Text>
        </View>
      </View>
    );
  }

  const filteredRecs = filteredAndSortedRecommendations();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Recommendations</Text>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsButton}>
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterPill, selectedCategory === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>
              All Cards
            </Text>
          </TouchableOpacity>
          {spendingProfile?.highSpendingCategories.map(category => (
            <TouchableOpacity
              key={category}
              style={[styles.filterPill, selectedCategory === category && styles.filterPillActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.filterText, selectedCategory === category && styles.filterTextActive]}>
                {getCategoryName(category)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'score' && styles.sortButtonActive]}
          onPress={() => setSortBy('score')}
        >
          <Text style={[styles.sortText, sortBy === 'score' && styles.sortTextActive]}>Best Match</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'rewards' && styles.sortButtonActive]}
          onPress={() => setSortBy('rewards')}
        >
          <Text style={[styles.sortText, sortBy === 'rewards' && styles.sortTextActive]}>Rewards</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'fee' && styles.sortButtonActive]}
          onPress={() => setSortBy('fee')}
        >
          <Text style={[styles.sortText, sortBy === 'fee' && styles.sortTextActive]}>Lowest Fee</Text>
        </TouchableOpacity>
      </View>

      {/* Recommendations List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredRecs.length > 0 ? (
          filteredRecs.map((recommendation) => (
            <View key={recommendation.card.id} style={styles.cardRecommendation}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{recommendation.card.name}</Text>
                  <Text style={styles.cardIssuer}>{recommendation.card.issuer}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{recommendation.score}% Match</Text>
                </View>
              </View>

              {/* Key Metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{formatCurrency(recommendation.estimatedRewards)}</Text>
                  <Text style={styles.metricLabel}>Annual Rewards</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{formatCurrency(recommendation.card.annualFee)}</Text>
                  <Text style={styles.metricLabel}>Annual Fee</Text>
                </View>
                {recommendation.estimatedSavings > 0 && (
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, styles.savingsValue]}>
                      +{formatCurrency(recommendation.estimatedSavings)}
                    </Text>
                    <Text style={styles.metricLabel}>Extra Savings</Text>
                  </View>
                )}
              </View>

              {/* Top Categories */}
              <View style={styles.categoriesSection}>
                <Text style={styles.categoriesLabel}>Top Reward Categories:</Text>
                <View style={styles.categoriesList}>
                  {Object.entries(recommendation.categoryBreakdown)
                    .filter(([_, data]) => data.spend > 0)
                    .sort(([_, a], [__, b]) => b.rewards - a.rewards)
                    .slice(0, 3)
                    .map(([category, data]) => (
                      <View key={category} style={styles.categoryItem}>
                        <Text style={styles.categoryName}>{getCategoryName(category as VenueCategory)}</Text>
                        <Text style={styles.categoryRate}>{data.rate}%</Text>
                      </View>
                    ))}
                </View>
              </View>

              {/* Why Recommended */}
              <View style={styles.reasoningSection}>
                <Text style={styles.reasoningTitle}>Why this card?</Text>
                {recommendation.reasoning.slice(0, 2).map((reason, index) => (
                  <Text key={index} style={styles.reasoningText}>• {reason}</Text>
                ))}
              </View>

              {/* Pros and Cons */}
              <View style={styles.prosConsSection}>
                <View style={styles.prosColumn}>
                  <Text style={styles.prosConsTitle}>Pros</Text>
                  {recommendation.pros.slice(0, 2).map((pro, index) => (
                    <Text key={index} style={styles.proText}>✓ {pro}</Text>
                  ))}
                </View>
                <View style={styles.consColumn}>
                  <Text style={styles.prosConsTitle}>Cons</Text>
                  {recommendation.cons.slice(0, 2).map((con, index) => (
                    <Text key={index} style={styles.conText}>✗ {con}</Text>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.learnMoreButton}
                  onPress={() => handleCardPress(recommendation.card.id)}
                >
                  <Text style={styles.learnMoreText}>Learn More</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => handleApply(recommendation.card)}
                >
                  <Text style={styles.applyText}>Apply Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No cards found matching your criteria</Text>
            <TouchableOpacity style={styles.resetButton} onPress={() => setSelectedCategory('all')}>
              <Text style={styles.resetText}>Show All Cards</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  settingsButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
  },
  settingsText: {
    fontSize: 16,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sortTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cardRecommendation: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  cardIssuer: {
    fontSize: 14,
    color: '#666',
  },
  scoreBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  savingsValue: {
    color: '#28a745',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  categoriesSection: {
    marginBottom: 16,
  },
  categoriesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  categoriesList: {
    gap: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryName: {
    fontSize: 14,
    color: '#666',
  },
  categoryRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  reasoningSection: {
    marginBottom: 16,
  },
  reasoningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  prosConsSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  prosColumn: {
    flex: 1,
    marginRight: 12,
  },
  consColumn: {
    flex: 1,
  },
  prosConsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  proText: {
    fontSize: 12,
    color: '#28a745',
    marginBottom: 4,
    lineHeight: 16,
  },
  conText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 4,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  learnMoreButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  learnMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  applyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});