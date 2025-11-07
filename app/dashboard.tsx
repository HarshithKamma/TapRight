import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { locationService } from '../services/locationService';
import { locationDataStorageService } from '../services/locationDataStorage';
import { spendCategorizationService, SpendingProfile } from '../services/spendCategorization';
import { trendAnalysisService, UserBehaviorProfile } from '../services/trendAnalysis';
import { cardRecommendationService, CardRecommendation } from '../services/cardRecommendation';
import { VenueCategory } from '../services/venueCategorization';

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [spendingProfile, setSpendingProfile] = useState<SpendingProfile | null>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehaviorProfile | null>(null);
  const [recommendations, setRecommendations] = useState<CardRecommendation[]>([]);
  const [locationStats, setLocationStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load location data
      const visits = await locationDataStorageService.getAllVisits();
      const stats = await locationDataStorageService.getStorageStats();
      setLocationStats(stats);

      if (visits.length > 0) {
        // Analyze spending patterns
        const spendingData = await spendCategorizationService.estimateSpendingFromVisits(visits);
        setSpendingProfile(spendingData);

        // Analyze user behavior
        const behaviorData = await trendAnalysisService.analyzeUserBehavior(visits);
        setUserBehavior(behaviorData);

        // Generate card recommendations
        const context = {
          userSpending: spendingData,
          userBehavior: behaviorData,
          currentCards: [],
          preferences: {
            maxAnnualFee: 100,
            creditScoreRequired: 'Good' as const,
          },
        };

        const cardRecommendations = await cardRecommendationService.generateRecommendations(context, 3);
        setRecommendations(cardRecommendations);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCategoryName = (category: VenueCategory): string => {
    const names: Record<VenueCategory, string> = {
      [VenueCategory.GAS_STATION]: 'Gas',
      [VenueCategory.RESTAURANT]: 'Restaurants',
      [VenueCategory.BAR]: 'Bars',
      [VenueCategory.LIQUOR_STORE]: 'Liquor',
      [VenueCategory.PHARMACY]: 'Pharmacy',
      [VenueCategory.GROCERY]: 'Grocery',
      [VenueCategory.COFFEE_SHOP]: 'Coffee',
      [VenueCategory.MALL]: 'Malls',
      [VenueCategory.RETAIL_STORE]: 'Retail',
      [VenueCategory.ELECTRONICS_STORE]: 'Electronics',
      [VenueCategory.CLOTHING_STORE]: 'Clothing',
      [VenueCategory.UNKNOWN]: 'Other',
    };
    return names[category] || 'Unknown';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Your Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{locationStats?.totalVisits || 0}</Text>
            <Text style={styles.statLabel}>Total Visits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{spendingProfile?.categoryBreakdown.length || 0}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{recommendations.length}</Text>
            <Text style={styles.statLabel}>Recommendations</Text>
          </View>
        </View>
      </View>

      {/* Spending Overview */}
      {spendingProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Spending</Text>
          <View style={styles.spendingOverview}>
            <Text style={styles.totalSpending}>
              {formatCurrency(spendingProfile.totalEstimatedMonthlySpend)}
            </Text>
            <Text style={styles.spendingLabel}>Estimated monthly spend</Text>
          </View>

          {/* Top Categories */}
          <View style={styles.categoriesContainer}>
            {spendingProfile.highSpendingCategories.slice(0, 3).map((category, index) => {
              const categoryData = spendingProfile.categoryBreakdown.find(c => c.category === category);
              return (
                <View key={category} style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category) }]} />
                  <Text style={styles.categoryName}>{getCategoryName(category)}</Text>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(categoryData?.estimatedMonthlySpend || 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Top Recommendations */}
      {recommendations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended Cards</Text>
            <TouchableOpacity
              onPress={() => router.push('/card-recommendations')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recommendations.slice(0, 2).map((recommendation) => (
            <View key={recommendation.card.id} style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <Text style={styles.cardName}>{recommendation.card.name}</Text>
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreText}>{recommendation.score}</Text>
                </View>
              </View>

              <Text style={styles.rewardsText}>
                {formatCurrency(recommendation.estimatedRewards)} estimated annual rewards
              </Text>

              {recommendation.estimatedSavings > 0 && (
                <Text style={styles.savingsText}>
                  Save {formatCurrency(recommendation.estimatedSavings)} vs current cards
                </Text>
              )}

              <View style={styles.recommendationFooter}>
                <Text style={styles.annualFeeText}>
                  {recommendation.card.annualFee === 0 ? 'No annual fee' : `${formatCurrency(recommendation.card.annualFee)} annual fee`}
                </Text>
                <TouchableOpacity
                  style={styles.learnMoreButton}
                  onPress={() => router.push(`/card-details/${recommendation.card.id}`)}
                >
                  <Text style={styles.learnMoreText}>Learn More</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/insights')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>View Insights</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/mirror-wallet')}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={styles.actionText}>My Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Tracking Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Tracking</Text>
        <View style={styles.locationStatus}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusText}>Active</Text>
          </View>
          <Text style={styles.locationDetail}>
            Tracking {locationStats?.totalVisits || 0} visits across {locationStats?.dateRange?.oldest ? new Date(locationStats.dateRange.oldest).toLocaleDateString() : 'recent days'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Helper function for category colors
function getCategoryColor(category: VenueCategory): string {
  const colors: Record<VenueCategory, string> = {
    [VenueCategory.GAS_STATION]: '#FF6B6B',
    [VenueCategory.RESTAURANT]: '#4ECDC4',
    [VenueCategory.BAR]: '#45B7D1',
    [VenueCategory.LIQUOR_STORE]: '#96CEB4',
    [VenueCategory.PHARMACY]: '#FFEAA7',
    [VenueCategory.GROCERY]: '#DDA0DD',
    [VenueCategory.COFFEE_SHOP]: '#98D8C8',
    [VenueCategory.MALL]: '#FFB6C1',
    [VenueCategory.RETAIL_STORE]: '#87CEEB',
    [VenueCategory.ELECTRONICS_STORE]: '#F0E68C',
    [VenueCategory.CLOTHING_STORE]: '#FFA07A',
    [VenueCategory.UNKNOWN]: '#B0B0B0',
  };
  return colors[category] || '#B0B0B0';
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
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  seeAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    margin: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  spendingOverview: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalSpending: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  spendingLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  recommendationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  scoreContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rewardsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  savingsText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  annualFeeText: {
    fontSize: 12,
    color: '#666',
  },
  learnMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  learnMoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  locationStatus: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  locationDetail: {
    fontSize: 12,
    color: '#666',
  },
});