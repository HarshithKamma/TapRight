import { VisitRecord } from './locationDataStorage';
import { VenueCategory } from './venueCategorization';

export interface SpendingEstimate {
  category: VenueCategory;
  estimatedMonthlySpend: number; // in dollars
  confidence: number; // 0-1 confidence in estimate
  averagePerVisit: number;
  visitsPerMonth: number;
  dataSource: 'user_input' | 'national_average' | 'inferred';
}

export interface SpendingProfile {
  totalEstimatedMonthlySpend: number;
  categoryBreakdown: SpendingEstimate[];
  highSpendingCategories: VenueCategory[];
  potentialSavings: {
    category: VenueCategory;
    currentEstimated: number;
    optimizedPotential: number;
    monthlySavings: number;
    recommendedCardType: string;
  }[];
  spendingTrends: {
    category: VenueCategory;
    trend: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
  }[];
}

class SpendCategorizationService {
  // National average spending by category (simplified estimates)
  private readonly NATIONAL_AVERAGES: Record<VenueCategory, { monthly: number; perVisit: number }> = {
    [VenueCategory.RESTAURANT]: { monthly: 250, perVisit: 35 },
    [VenueCategory.GROCERY]: { monthly: 600, perVisit: 120 },
    [VenueCategory.GAS_STATION]: { monthly: 200, perVisit: 50 },
    [VenueCategory.PHARMACY]: { monthly: 80, perVisit: 40 },
    [VenueCategory.COFFEE_SHOP]: { monthly: 60, perVisit: 6 },
    [VenueCategory.BAR]: { monthly: 120, perVisit: 25 },
    [VenueCategory.RETAIL_STORE]: { monthly: 300, perVisit: 80 },
    [VenueCategory.CLOTHING_STORE]: { monthly: 150, perVisit: 100 },
    [VenueCategory.ELECTRONICS_STORE]: { monthly: 100, perVisit: 200 },
    [VenueCategory.MALL]: { monthly: 200, perVisit: 150 },
    [VenueCategory.LIQUOR_STORE]: { monthly: 80, perVisit: 40 },
    [VenueCategory.UNKNOWN]: { monthly: 100, perVisit: 50 },
  };

  // Multipliers for different lifestyle factors
  private readonly LIFESTYLE_MULTIPLIERS = {
    isFoodie: {
      [VenueCategory.RESTAURANT]: 1.5,
      [VenueCategory.COFFEE_SHOP]: 1.3,
      [VenueCategory.BAR]: 1.4,
    },
    isFamilyOriented: {
      [VenueCategory.GROCERY]: 1.3,
      [VenueCategory.RETAIL_STORE]: 1.2,
      [VenueCategory.PHARMACY]: 1.2,
    },
    isBudgetConscious: {
      [VenueCategory.RETAIL_STORE]: 0.8,
      [VenueCategory.RESTAURANT]: 0.7,
      [VenueCategory.COFFEE_SHOP]: 0.8,
    },
    isSocial: {
      [VenueCategory.BAR]: 1.6,
      [VenueCategory.RESTAURANT]: 1.3,
    },
  };

  // Estimate spending based on visit patterns
  async estimateSpendingFromVisits(
    visits: VisitRecord[],
    userPreferences?: {
      isFoodie?: boolean;
      isFamilyOriented?: boolean;
      isBudgetConscious?: boolean;
      isSocial?: boolean;
    }
  ): Promise<SpendingProfile> {
    try {
      const categorizedVisits = this.groupVisitsByCategory(visits);
      const spendingEstimates: SpendingEstimate[] = [];

      // Calculate estimates for each category
      for (const [category, categoryVisits] of Object.entries(categorizedVisits)) {
        const estimate = await this.calculateCategorySpending(
          category as VenueCategory,
          categoryVisits,
          userPreferences
        );
        spendingEstimates.push(estimate);
      }

      // Calculate total and identify high-spending categories
      const totalSpend = spendingEstimates.reduce((sum, est) => sum + est.estimatedMonthlySpend, 0);
      const highSpendingCategories = spendingEstimates
        .sort((a, b) => b.estimatedMonthlySpend - a.estimatedMonthlySpend)
        .slice(0, 3)
        .map(est => est.category);

      // Calculate potential savings with optimized card usage
      const potentialSavings = this.calculatePotentialSavings(spendingEstimates);

      // Analyze spending trends
      const spendingTrends = this.analyzeSpendingTrends(categorizedVisits);

      return {
        totalEstimatedMonthlySpend: totalSpend,
        categoryBreakdown: spendingEstimates,
        highSpendingCategories,
        potentialSavings,
        spendingTrends,
      };
    } catch (error) {
      console.error('Error estimating spending from visits:', error);
      return this.getDefaultSpendingProfile();
    }
  }

  // Calculate spending for a specific category
  private async calculateCategorySpending(
    category: VenueCategory,
    visits: VisitRecord[],
    userPreferences?: any
  ): Promise<SpendingEstimate> {
    const nationalAverage = this.NATIONAL_AVERAGES[category];
    if (!nationalAverage) {
      return {
        category,
        estimatedMonthlySpend: 0,
        confidence: 0,
        averagePerVisit: 0,
        visitsPerMonth: 0,
        dataSource: 'national_average',
      };
    }

    // Calculate visit frequency
    const visitsPerMonth = this.calculateVisitsPerMonth(visits);
    const averageDuration = this.calculateAverageVisitDuration(visits);

    // Base estimate on national averages adjusted for visit patterns
    let estimatedMonthlySpend = nationalAverage.monthly;
    let averagePerVisit = nationalAverage.perVisit;
    let confidence = 0.5;
    let dataSource: SpendingEstimate['dataSource'] = 'national_average';

    // If we have actual visit data, use it to refine estimates
    if (visits.length >= 3) {
      // Adjust based on visit frequency compared to national average
      const nationalVisitsPerMonth = nationalAverage.monthly / nationalAverage.perVisit;
      const visitRatio = visitsPerMonth / nationalVisitsPerMonth;

      // Confidence increases with more data points
      confidence = Math.min(0.9, 0.3 + (visits.length / 20));

      // Adjust spending based on visit patterns
      if (visitRatio > 1.5) {
        // User visits more frequently than average
        estimatedMonthlySpend = nationalAverage.monthly * (0.8 + visitRatio * 0.2);
        dataSource = 'inferred';
      } else if (visitRatio < 0.5) {
        // User visits less frequently than average
        estimatedMonthlySpend = nationalAverage.monthly * visitRatio;
        dataSource = 'inferred';
      }

      // Adjust based on visit duration (longer visits might mean higher spending)
      if (averageDuration > 30 && category === VenueCategory.RESTAURANT) {
        estimatedMonthlySpend *= 1.2;
        averagePerVisit *= 1.2;
      }

      // Apply lifestyle multipliers
      if (userPreferences) {
        for (const [lifestyle, categories] of Object.entries(this.LIFESTYLE_MULTIPLIERS)) {
          if (userPreferences[lifestyle] && categories[category]) {
            estimatedMonthlySpend *= categories[category];
            averagePerVisit *= categories[category];
          }
        }
      }

      // Update average per visit based on our estimates
      if (visitsPerMonth > 0) {
        averagePerVisit = estimatedMonthlySpend / visitsPerMonth;
      }
    }

    return {
      category,
      estimatedMonthlySpend: Math.round(estimatedMonthlySpend),
      confidence: Math.round(confidence * 100) / 100,
      averagePerVisit: Math.round(averagePerVisit),
      visitsPerMonth: Math.round(visitsPerMonth * 10) / 10,
      dataSource,
    };
  }

  // Calculate potential savings with optimized card usage
  private calculatePotentialSavings(spendingEstimates: SpendingEstimate[]) {
    return spendingEstimates
      .filter(est => est.estimatedMonthlySpend > 50) // Only meaningful spending
      .map(estimate => {
        const optimizedRate = this.getOptimizedRewardsRate(estimate.category);
        const currentRate = 0.015; // Assume 1.5% cashback baseline
        const monthlySavings = estimate.estimatedMonthlySpend * (optimizedRate - currentRate);

        return {
          category: estimate.category,
          currentEstimated: estimate.estimatedMonthlySpend,
          optimizedPotential: estimate.estimatedMonthlySpend * (1 + optimizedRate),
          monthlySavings: Math.round(monthlySavings),
          recommendedCardType: this.getRecommendedCardType(estimate.category),
        };
      })
      .filter(savings => savings.monthlySavings > 5) // Only meaningful savings
      .sort((a, b) => b.monthlySavings - a.monthlySavings)
      .slice(0, 5);
  }

  // Get optimized rewards rate for category
  private getOptimizedRewardsRate(category: VenueCategory): number {
    const optimizedRates: Partial<Record<VenueCategory, number>> = {
      [VenueCategory.RESTAURANT]: 0.04, // 4% with dining cards
      [VenueCategory.GROCERY]: 0.06,   // 6% with grocery cards
      [VenueCategory.GAS_STATION]: 0.05, // 5% with gas cards
      [VenueCategory.COFFEE_SHOP]: 0.03, // 3% with some cards
      [VenueCategory.RETAIL_STORE]: 0.02, // 2% with shopping cards
      [VenueCategory.PHARMACY]: 0.03,    // 3% with some cards
    };

    return optimizedRates[category] || 0.02; // Default 2%
  }

  // Get recommended card type for category
  private getRecommendedCardType(category: VenueCategory): string {
    const recommendations: Partial<Record<VenueCategory, string>> = {
      [VenueCategory.RESTAURANT]: 'Dining Rewards Card',
      [VenueCategory.GROCERY]: 'Grocery Rewards Card',
      [VenueCategory.GAS_STATION]: 'Gas Rewards Card',
      [VenueCategory.COFFEE_SHOP]: 'Dining or General Travel Card',
      [VenueCategory.RETAIL_STORE]: 'Shopping Rewards Card',
      [VenueCategory.PHARMACY]: 'Health & Wellness Card',
      [VenueCategory.TRAVEL]: 'Travel Rewards Card',
      [VenueCategory.CLOTHING_STORE]: 'Shopping or General Cashback Card',
    };

    return recommendations[category] || 'General Cashback Card';
  }

  // Analyze spending trends
  private analyzeSpendingTrends(categorizedVisits: Record<VenueCategory, VisitRecord[]>) {
    const trends: SpendingProfile['spendingTrends'] = [];

    for (const [category, visits] of Object.entries(categorizedVisits)) {
      if (visits.length < 6) continue;

      const trend = this.calculateSpendingTrend(visits);
      trends.push({
        category: category as VenueCategory,
        trend: trend.direction,
        percentageChange: trend.percentageChange,
      });
    }

    return trends;
  }

  // Calculate spending trend for a category
  private calculateSpendingTrend(visits: VisitRecord[]): { direction: 'increasing' | 'decreasing' | 'stable'; percentageChange: number } {
    const sortedVisits = visits.sort((a, b) =>
      new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
    );

    const midpoint = Math.floor(sortedVisits.length / 2);
    const firstHalf = sortedVisits.slice(0, midpoint);
    const secondHalf = sortedVisits.slice(midpoint);

    const firstHalfFrequency = firstHalf.length / this.getDaysSpan(firstHalf);
    const secondHalfFrequency = secondHalf.length / this.getDaysSpan(secondHalf);

    const percentageChange = firstHalfFrequency > 0
      ? ((secondHalfFrequency - firstHalfFrequency) / firstHalfFrequency) * 100
      : 0;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (percentageChange > 20) direction = 'increasing';
    else if (percentageChange < -20) direction = 'decreasing';

    return {
      direction,
      percentageChange: Math.round(Math.abs(percentageChange)),
    };
  }

  // Helper methods
  private groupVisitsByCategory(visits: VisitRecord[]): Record<VenueCategory, VisitRecord[]> {
    const grouped: Record<VenueCategory, VisitRecord[]> = {} as any;

    visits.forEach(visit => {
      if (visit.venueInfo) {
        const category = visit.venueInfo.category;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(visit);
      }
    });

    return grouped;
  }

  private calculateVisitsPerMonth(visits: VisitRecord[]): number {
    if (visits.length === 0) return 0;

    const timeSpan = this.getDaysSpan(visits);
    const visitsPerDay = visits.length / timeSpan;
    return visitsPerDay * 30.44; // Average days in month
  }

  private calculateAverageVisitDuration(visits: VisitRecord[]): number {
    const visitsWithDuration = visits.filter(v => v.duration !== undefined);
    if (visitsWithDuration.length === 0) return 0;

    const totalDuration = visitsWithDuration.reduce((sum, v) => sum + (v.duration || 0), 0);
    return totalDuration / visitsWithDuration.length;
  }

  private getDaysSpan(visits: VisitRecord[]): number {
    if (visits.length === 0) return 1;
    const dates = visits.map(v => new Date(v.arrivalTime).getTime());
    return (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
  }

  private getDefaultSpendingProfile(): SpendingProfile {
    return {
      totalEstimatedMonthlySpend: 0,
      categoryBreakdown: [],
      highSpendingCategories: [],
      potentialSavings: [],
      spendingTrends: [],
    };
  }

  // Update spending estimates with user input
  async updateSpendingWithUserInput(
    currentProfile: SpendingProfile,
    userInputs: Partial<Record<VenueCategory, number>>
  ): Promise<SpendingProfile> {
    try {
      const updatedBreakdown = currentProfile.categoryBreakdown.map(estimate => {
        const userInput = userInputs[estimate.category];
        if (userInput && userInput > 0) {
          return {
            ...estimate,
            estimatedMonthlySpend: userInput,
            confidence: 1.0, // User input has highest confidence
            dataSource: 'user_input' as const,
            averagePerVisit: userInput / Math.max(estimate.visitsPerMonth, 1),
          };
        }
        return estimate;
      });

      // Recalculate totals and savings
      const totalSpend = updatedBreakdown.reduce((sum, est) => sum + est.estimatedMonthlySpend, 0);
      const highSpendingCategories = updatedBreakdown
        .sort((a, b) => b.estimatedMonthlySpend - a.estimatedMonthlySpend)
        .slice(0, 3)
        .map(est => est.category);

      const potentialSavings = this.calculatePotentialSavings(updatedBreakdown);

      return {
        ...currentProfile,
        totalEstimatedMonthlySpend: totalSpend,
        categoryBreakdown: updatedBreakdown,
        highSpendingCategories,
        potentialSavings,
      };
    } catch (error) {
      console.error('Error updating spending with user input:', error);
      return currentProfile;
    }
  }

  // Get spending insights
  getSpendingInsights(profile: SpendingProfile): string[] {
    const insights: string[] = [];

    // High spending category insights
    if (profile.highSpendingCategories.length > 0) {
      const topCategory = profile.highSpendingCategories[0];
      insights.push(`Your highest spending category is ${this.getCategoryName(topCategory)} with ${profile.categoryBreakdown.find(e => e.category === topCategory)?.estimatedMonthlySpend || 0}/month`);
    }

    // Savings potential insights
    if (profile.potentialSavings.length > 0) {
      const topSavings = profile.potentialSavings[0];
      insights.push(`You could save $${topSavings.monthlySavings}/month with a ${topSavings.recommendedCardType}`);
    }

    // Trend insights
    const increasingTrends = profile.spendingTrends.filter(t => t.trend === 'increasing');
    if (increasingTrends.length > 0) {
      insights.push(`Your spending is increasing in ${increasingTrends.length} categories`);
    }

    return insights;
  }

  private getCategoryName(category: VenueCategory): string {
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
      [VenueCategory.ELECTRONICS_STORE]: 'Electronics Stores',
      [VenueCategory.CLOTHING_STORE]: 'Clothing Stores',
      [VenueCategory.UNKNOWN]: 'Other',
    };
    return names[category] || 'Unknown';
  }
}

// Export singleton instance
export const spendCategorizationService = new SpendCategorizationService();
export default spendCategorizationService;