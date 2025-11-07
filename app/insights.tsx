import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VisitRecord } from '../services/locationDataStorage';
import { trendAnalysisService, TrendData, TrendInsight } from '../services/trendAnalysis';
import { spendCategorizationService, SpendingProfile } from '../services/spendCategorization';
import { VenueCategory } from '../services/venueCategorization';

const { width } = Dimensions.get('window');
const chartWidth = width - 64; // Account for padding

interface ChartBar {
  category: VenueCategory;
  value: number;
  label: string;
  color: string;
}

export default function Insights() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [spendingProfile, setSpendingProfile] = useState<SpendingProfile | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [insights, setInsights] = useState<TrendInsight[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month'>('month');

  useEffect(() => {
    loadInsightsData();
  }, []);

  const loadInsightsData = async () => {
    try {
      setIsLoading(true);

      // Load visits data
      // In a real app, this would come from the location service
      const mockVisits: VisitRecord[] = []; // This would be populated from actual data
      setVisits(mockVisits);

      if (mockVisits.length > 0) {
        // Load spending profile
        const spending = await spendCategorizationService.estimateSpendingFromVisits(mockVisits);
        setSpendingProfile(spending);

        // Analyze trends
        const trends: TrendData[] = [];
        for (const category of Object.values(VenueCategory)) {
          if (category === VenueCategory.UNKNOWN) continue;

          const trend = await trendAnalysisService.analyzeCategoryTrend(category, mockVisits);
          if (trend) {
            trends.push(trend);
          }
        }
        setTrendData(trends);

        // Generate insights
        const generatedInsights = await trendAnalysisService.generateTrendInsights(mockVisits);
        setInsights(generatedInsights);
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setIsLoading(false);
    }
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

  const getCategoryColor = (category: VenueCategory): string => {
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
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const createSpendingChart = (): ChartBar[] => {
    if (!spendingProfile) return [];

    return spendingProfile.categoryBreakdown
      .filter(cat => cat.estimatedMonthlySpend > 0)
      .sort((a, b) => b.estimatedMonthlySpend - a.estimatedMonthlySpend)
      .slice(0, 6)
      .map(cat => ({
        category: cat.category,
        value: cat.estimatedMonthlySpend,
        label: getCategoryName(cat.category).split(' ')[0], // Short label
        color: getCategoryColor(cat.category),
      }));
  };

  const createFrequencyChart = (): ChartBar[] => {
    return trendData
      .filter(trend => trend.visitCount > 0)
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 6)
      .map(trend => ({
        category: trend.category,
        value: trend.visitCount,
        label: getCategoryName(trend.category).split(' ')[0],
        color: getCategoryColor(trend.category),
      }));
  };

  const ChartBar = ({ item, maxValue, type }: { item: ChartBar; maxValue: number; type: 'spending' | 'frequency' }) => {
    const barWidth = (item.value / maxValue) * (chartWidth - 80); // 80 for label space
    const displayValue = type === 'spending' ? formatCurrency(item.value) : item.value.toString();

    return (
      <View style={styles.chartBarContainer}>
        <Text style={[styles.chartLabel, { width: 60 }]}>{item.label}</Text>
        <View style={styles.chartBarWrapper}>
          <View
            style={[
              styles.chartBar,
              {
                width: barWidth,
                backgroundColor: item.color,
              },
            ]}
          />
          <Text style={styles.chartValue}>{displayValue}</Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Analyzing your patterns...</Text>
        </View>
      </View>
    );
  }

  const spendingChart = createSpendingChart();
  const frequencyChart = createFrequencyChart();
  const maxSpending = Math.max(...spendingChart.map(item => item.value), 1);
  const maxFrequency = Math.max(...frequencyChart.map(item => item.value), 1);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Insights</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Timeframe Selector */}
      <View style={styles.timeframeContainer}>
        <TouchableOpacity
          style={[styles.timeframeButton, selectedTimeframe === 'week' && styles.timeframeButtonActive]}
          onPress={() => setSelectedTimeframe('week')}
        >
          <Text style={[styles.timeframeText, selectedTimeframe === 'week' && styles.timeframeTextActive]}>
            Last Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.timeframeButton, selectedTimeframe === 'month' && styles.timeframeButtonActive]}
          onPress={() => setSelectedTimeframe('month')}
        >
          <Text style={[styles.timeframeText, selectedTimeframe === 'month' && styles.timeframeTextActive]}>
            Last Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Spending by Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending by Category</Text>
        {spendingChart.length > 0 ? (
          <View style={styles.chartContainer}>
            {spendingChart.map((item, index) => (
              <ChartBar key={index} item={item} maxValue={maxSpending} type="spending" />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No spending data available</Text>
            <Text style={styles.emptySubtext}>Start tracking locations to see insights</Text>
          </View>
        )}
      </View>

      {/* Visit Frequency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visit Frequency</Text>
        {frequencyChart.length > 0 ? (
          <View style={styles.chartContainer}>
            {frequencyChart.map((item, index) => (
              <ChartBar key={index} item={item} maxValue={maxFrequency} type="frequency" />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No visit data available</Text>
            <Text style={styles.emptySubtext}>Enable location tracking to see patterns</Text>
          </View>
        )}
      </View>

      {/* Trends Analysis */}
      {trendData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trend Analysis</Text>
          <View style={styles.trendsContainer}>
            {trendData.slice(0, 4).map((trend, index) => (
              <View key={index} style={styles.trendCard}>
                <View style={styles.trendHeader}>
                  <Text style={styles.trendCategory}>{getCategoryName(trend.category)}</Text>
                  <View style={[
                    styles.trendIndicator,
                    trend.trendDirection === 'increasing' && styles.trendUp,
                    trend.trendDirection === 'decreasing' && styles.trendDown,
                  ]}>
                    <Text style={styles.trendIndicatorText}>
                      {trend.trendDirection === 'increasing' ? '↗' :
                       trend.trendDirection === 'decreasing' ? '↘' : '→'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.trendDetail}>
                  {trend.averageVisitsPerWeek.toFixed(1)} visits/week
                </Text>
                {trend.seasonality.confidence > 0.3 && (
                  <Text style={styles.trendPattern}>
                    Most active: {trend.seasonality.pattern.replace('_', ' ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Insights</Text>
          <View style={styles.insightsContainer}>
            {insights.slice(0, 3).map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <View style={[styles.confidenceDot, { backgroundColor: `rgba(0, 122, 255, ${insight.confidence})` }]} />
                </View>
                <Text style={styles.insightDescription}>{insight.description}</Text>
                {insight.recommendation && (
                  <Text style={styles.insightRecommendation}>💡 {insight.recommendation}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Potential Savings */}
      {spendingProfile && spendingProfile.potentialSavings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Potential Savings</Text>
          <View style={styles.savingsContainer}>
            {spendingProfile.potentialSavings.slice(0, 3).map((saving, index) => (
              <View key={index} style={styles.savingCard}>
                <Text style={styles.savingCategory}>{getCategoryName(saving.category)}</Text>
                <Text style={styles.savingAmount}>Save {formatCurrency(saving.monthlySavings)}/month</Text>
                <Text style={styles.savingRecommendation}>{saving.recommendedCardType}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/card-recommendations')}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={styles.actionText}>Find Better Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionText}>Adjust Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/dashboard')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
  placeholder: {
    width: 32,
  },
  timeframeContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: '#007AFF',
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  timeframeTextActive: {
    color: '#fff',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  chartBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  chartBar: {
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  chartValue: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  trendsContainer: {
    gap: 12,
  },
  trendCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  trendIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  trendUp: {
    backgroundColor: '#d4edda',
  },
  trendDown: {
    backgroundColor: '#f8d7da',
  },
  trendIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trendDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  trendPattern: {
    fontSize: 12,
    color: '#007AFF',
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  confidenceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  insightDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  insightRecommendation: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  savingsContainer: {
    gap: 12,
  },
  savingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  savingCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  savingAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
    marginBottom: 4,
  },
  savingRecommendation: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
    fontWeight: '600',
  },
});