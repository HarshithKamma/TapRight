import { VisitRecord } from './locationDataStorage';
import { VenueCategory } from './venueCategorization';

export interface TrendData {
  category: VenueCategory;
  timeFrame: 'week' | 'month' | 'quarter';
  visitCount: number;
  averageVisitsPerWeek: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number; // percentage change from previous period
  seasonality: {
    pattern: 'weekend_high' | 'weekday_high' | 'evening_high' | 'morning_high' | 'uniform';
    confidence: number;
  };
  timeOfDayDistribution: {
    morning: number;    // 6AM - 12PM
    afternoon: number;  // 12PM - 6PM
    evening: number;    // 6PM - 12AM
    night: number;      // 12AM - 6AM
  };
  dayOfWeekDistribution: Record<string, number>; // 'mon', 'tue', etc.
}

export interface UserBehaviorProfile {
  primaryCategories: VenueCategory[];
  secondaryCategories: VenueCategory[];
  routinePatterns: {
    workdayPattern: VenueCategory[];
    weekendPattern: VenueCategory[];
    frequentDestinations: Array<{
      venueName: string;
      category: VenueCategory;
      frequency: number; // visits per week
      averageDuration: number; // minutes
    }>;
  };
  lifestyleIndicators: {
    isHealthConscious: boolean; // Visits gyms, health food stores
    isFoodie: boolean; // Frequent restaurants variety
    isFamilyOriented: boolean; // Visits family-friendly venues
    isProfessional: boolean; // Visits office areas, business venues
    isSocial: boolean; // Frequent bars, social venues
    isBudgetConscious: boolean; // Visits discount stores, deals
  };
  spendingHabits: {
    frequencyOfEatingOut: number; // times per week
    frequencyOfShopping: number; // times per week
    frequencyOfEntertainment: number; // times per week
    preferredShoppingTimes: string[];
  };
}

export interface TrendInsight {
  type: 'new_pattern' | 'increased_frequency' | 'changed_preferences' | 'seasonal_variation';
  title: string;
  description: string;
  category: VenueCategory;
  confidence: number; // 0-1
  actionable: boolean;
  recommendation?: string;
}

class TrendAnalysisService {
  private readonly MIN_DATA_POINTS = 7; // Minimum visits for analysis
  private readonly ANALYSIS_WINDOW_DAYS = 28; // 4 weeks for pattern analysis

  // Analyze trends for a specific category
  async analyzeCategoryTrend(
    category: VenueCategory,
    visits: VisitRecord[]
  ): Promise<TrendData | null> {
    try {
      const categoryVisits = visits.filter(v => v.venueInfo?.category === category);

      if (categoryVisits.length < this.MIN_DATA_POINTS) {
        return null;
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Time-based filtering
      const weekVisits = categoryVisits.filter(v => new Date(v.arrivalTime) >= oneWeekAgo);
      const monthVisits = categoryVisits.filter(v => new Date(v.arrivalTime) >= oneMonthAgo);

      // Calculate basic metrics
      const visitCount = weekVisits.length;
      const averageVisitsPerWeek = monthVisits.length / 4.3; // Average weeks in month

      // Trend analysis
      const trendDirection = this.calculateTrendDirection(categoryVisits);
      const trendPercentage = this.calculateTrendPercentage(categoryVisits);

      // Seasonality analysis
      const seasonality = this.analyzeSeasonality(categoryVisits);

      // Time and day distribution
      const timeOfDayDistribution = this.calculateTimeOfDayDistribution(categoryVisits);
      const dayOfWeekDistribution = this.calculateDayOfWeekDistribution(categoryVisits);

      return {
        category,
        timeFrame: 'week',
        visitCount,
        averageVisitsPerWeek,
        trendDirection,
        trendPercentage,
        seasonality,
        timeOfDayDistribution,
        dayOfWeekDistribution,
      };
    } catch (error) {
      console.error(`Error analyzing trend for ${category}:`, error);
      return null;
    }
  }

  // Analyze overall user behavior profile
  async analyzeUserBehavior(visits: VisitRecord[]): Promise<UserBehaviorProfile> {
    try {
      if (visits.length < this.MIN_DATA_POINTS) {
        return this.getDefaultBehaviorProfile();
      }

      // Categorize visits
      const categorizedVisits = visits.filter(v => v.venueInfo);
      const categoryVisits = this.groupByCategory(categorizedVisits);

      // Identify primary and secondary categories
      const sortedCategories = Object.entries(categoryVisits)
        .sort(([,a], [,b]) => b.length - a.length)
        .map(([category]) => category as VenueCategory);

      const primaryCategories = sortedCategories.slice(0, 3);
      const secondaryCategories = sortedCategories.slice(3, 6);

      // Analyze routine patterns
      const routinePatterns = this.analyzeRoutinePatterns(categorizedVisits);

      // Detect lifestyle indicators
      const lifestyleIndicators = this.detectLifestyleIndicators(categoryVisits);

      // Analyze spending habits
      const spendingHabits = this.analyzeSpendingHabits(categoryVisits);

      return {
        primaryCategories,
        secondaryCategories,
        routinePatterns,
        lifestyleIndicators,
        spendingHabits,
      };
    } catch (error) {
      console.error('Error analyzing user behavior:', error);
      return this.getDefaultBehaviorProfile();
    }
  }

  // Generate trend insights
  async generateTrendInsights(visits: VisitRecord[]): Promise<TrendInsight[]> {
    try {
      const insights: TrendInsight[] = [];
      const categorizedVisits = visits.filter(v => v.venueInfo);
      const categoryVisits = this.groupByCategory(categorizedVisits);

      // Analyze each category for insights
      for (const [category, categoryVisits] of Object.entries(categoryVisits)) {
        if (categoryVisits.length < 3) continue; // Skip categories with insufficient data

        const categoryInsights = this.generateCategoryInsights(
          category as VenueCategory,
          categoryVisits
        );
        insights.push(...categoryInsights);
      }

      // Sort by confidence and return top insights
      return insights
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Top 10 insights
    } catch (error) {
      console.error('Error generating trend insights:', error);
      return [];
    }
  }

  // Calculate trend direction
  private calculateTrendDirection(visits: VisitRecord[]): 'increasing' | 'decreasing' | 'stable' {
    if (visits.length < 6) return 'stable';

    const sortedVisits = visits.sort((a, b) =>
      new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
    );

    const midpoint = Math.floor(sortedVisits.length / 2);
    const firstHalf = sortedVisits.slice(0, midpoint);
    const secondHalf = sortedVisits.slice(midpoint);

    const firstHalfFreq = firstHalf.length / this.getDaysSpan(firstHalf);
    const secondHalfFreq = secondHalf.length / this.getDaysSpan(secondHalf);

    const changePercentage = ((secondHalfFreq - firstHalfFreq) / firstHalfFreq) * 100;

    if (changePercentage > 20) return 'increasing';
    if (changePercentage < -20) return 'decreasing';
    return 'stable';
  }

  // Calculate trend percentage
  private calculateTrendPercentage(visits: VisitRecord[]): number {
    if (visits.length < 6) return 0;

    const sortedVisits = visits.sort((a, b) =>
      new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
    );

    const midpoint = Math.floor(sortedVisits.length / 2);
    const firstHalf = sortedVisits.slice(0, midpoint);
    const secondHalf = sortedVisits.slice(midpoint);

    const firstHalfFreq = firstHalf.length / this.getDaysSpan(firstHalf);
    const secondHalfFreq = secondHalf.length / this.getDaysSpan(secondHalf);

    if (firstHalfFreq === 0) return 0;
    return ((secondHalfFreq - firstHalfFreq) / firstHalfFreq) * 100;
  }

  // Analyze seasonality patterns
  private analyzeSeasonality(visits: VisitRecord[]): { pattern: string; confidence: number } {
    if (visits.length < 10) {
      return { pattern: 'uniform', confidence: 0 };
    }

    // Weekend vs Weekday analysis
    const weekendVisits = visits.filter(v => {
      const day = new Date(v.arrivalTime).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });

    const weekdayVisits = visits.filter(v => {
      const day = new Date(v.arrivalTime).getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });

    const weekendRatio = weekendVisits.length / visits.length;
    const weekdayRatio = weekdayVisits.length / visits.length;

    // Time of day analysis
    const timeDistribution = this.calculateTimeOfDayDistribution(visits);
    const { morning, afternoon, evening, night } = timeDistribution;

    let pattern = 'uniform';
    let confidence = 0;

    if (weekendRatio > 0.6) {
      pattern = 'weekend_high';
      confidence = Math.min(0.9, weekendRatio - 0.5);
    } else if (weekdayRatio > 0.7) {
      pattern = 'weekday_high';
      confidence = Math.min(0.9, weekdayRatio - 0.5);
    } else if (evening > 0.4) {
      pattern = 'evening_high';
      confidence = Math.min(0.9, evening - 0.2);
    } else if (morning > 0.4) {
      pattern = 'morning_high';
      confidence = Math.min(0.9, morning - 0.2);
    }

    return { pattern, confidence: Math.max(0, confidence) };
  }

  // Calculate time of day distribution
  private calculateTimeOfDayDistribution(visits: VisitRecord[]) {
    let morning = 0, afternoon = 0, evening = 0, night = 0;

    visits.forEach(visit => {
      const hour = new Date(visit.arrivalTime).getHours();

      if (hour >= 6 && hour < 12) morning++;
      else if (hour >= 12 && hour < 18) afternoon++;
      else if (hour >= 18 && hour < 24) evening++;
      else night++;
    });

    const total = visits.length;
    return {
      morning: total > 0 ? morning / total : 0,
      afternoon: total > 0 ? afternoon / total : 0,
      evening: total > 0 ? evening / total : 0,
      night: total > 0 ? night / total : 0,
    };
  }

  // Calculate day of week distribution
  private calculateDayOfWeekDistribution(visits: VisitRecord[]): Record<string, number> {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const distribution: Record<string, number> = {};

    dayNames.forEach(day => {
      distribution[day] = 0;
    });

    visits.forEach(visit => {
      const dayIndex = new Date(visit.arrivalTime).getDay();
      distribution[dayNames[dayIndex]]++;
    });

    const total = visits.length;
    dayNames.forEach(day => {
      distribution[day] = total > 0 ? distribution[day] / total : 0;
    });

    return distribution;
  }

  // Group visits by category
  private groupByCategory(visits: VisitRecord[]): Record<VenueCategory, VisitRecord[]> {
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

  // Analyze routine patterns
  private analyzeRoutinePatterns(visits: VisitRecord[]) {
    const workdayVisits = visits.filter(v => {
      const day = new Date(v.arrivalTime).getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });

    const weekendVisits = visits.filter(v => {
      const day = new Date(v.arrivalTime).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });

    const workdayCategories = this.getTopCategories(workdayVisits, 3);
    const weekendCategories = this.getTopCategories(weekendVisits, 3);

    // Identify frequent destinations
    const venueFrequency = new Map<string, { venue: any; count: number; totalDuration: number }>();

    visits.forEach(visit => {
      if (visit.venueInfo) {
        const key = visit.venueInfo.id;
        const existing = venueFrequency.get(key);
        const duration = visit.duration || 0;

        if (existing) {
          existing.count += 1;
          existing.totalDuration += duration;
        } else {
          venueFrequency.set(key, {
            venue: visit.venueInfo,
            count: 1,
            totalDuration: duration,
          });
        }
      }
    });

    const frequentDestinations = Array.from(venueFrequency.values())
      .map(item => ({
        venueName: item.venue.name,
        category: item.venue.category,
        frequency: item.count / 4.3, // visits per week
        averageDuration: item.totalDuration / item.count, // minutes
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    return {
      workdayPattern: workdayCategories,
      weekendPattern: weekendCategories,
      frequentDestinations,
    };
  }

  // Detect lifestyle indicators
  private detectLifestyleIndicators(categoryVisits: Record<VenueCategory, VisitRecord[]>) {
    const totalVisits = Object.values(categoryVisits).reduce((sum, visits) => sum + visits.length, 0);

    const indicators = {
      isHealthConscious: this.calculateCategoryScore(
        [VenueCategory.PHARMACY, VenueCategory.GROCERY],
        categoryVisits,
        totalVisits
      ) > 0.15,
      isFoodie: this.calculateCategoryScore(
        [VenueCategory.RESTAURANT, VenueCategory.COFFEE_SHOP, VenueCategory.BAR],
        categoryVisits,
        totalVisits
      ) > 0.3,
      isFamilyOriented: this.calculateCategoryScore(
        [VenueCategory.GROCERY, VenueCategory.RETAIL_STORE, VenueCategory.MALL],
        categoryVisits,
        totalVisits
      ) > 0.4,
      isProfessional: false, // Would need office/workplace detection
      isSocial: this.calculateCategoryScore(
        [VenueCategory.BAR, VenueCategory.RESTAURANT],
        categoryVisits,
        totalVisits
      ) > 0.25,
      isBudgetConscious: this.calculateCategoryScore(
        [VenueCategory.GROCERY],
        categoryVisits,
        totalVisits
      ) > 0.2,
    };

    return indicators;
  }

  // Analyze spending habits
  private analyzeSpendingHabits(categoryVisits: Record<VenueCategory, VisitRecord[]>) {
    const totalVisits = Object.values(categoryVisits).reduce((sum, visits) => sum + visits.length, 0);
    const weeksOfData = 4.3; // Average weeks in a month

    const frequencyOfEatingOut = (
      (categoryVisits[VenueCategory.RESTAURANT]?.length || 0) +
      (categoryVisits[VenueCategory.BAR]?.length || 0)
    ) / weeksOfData;

    const frequencyOfShopping = (
      (categoryVisits[VenueCategory.RETAIL_STORE]?.length || 0) +
      (categoryVisits[VenueCategory.CLOTHING_STORE]?.length || 0) +
      (categoryVisits[VenueCategory.ELECTRONICS_STORE]?.length || 0)
    ) / weeksOfData;

    const frequencyOfEntertainment = (
      (categoryVisits[VenueCategory.BAR]?.length || 0) +
      (categoryVisits[VenueCategory.COFFEE_SHOP]?.length || 0)
    ) / weeksOfData;

    // Determine preferred shopping times
    const allVisits = Object.values(categoryVisits).flat();
    const preferredShoppingTimes = this.getPreferredTimes(allVisits);

    return {
      frequencyOfEatingOut,
      frequencyOfShopping,
      frequencyOfEntertainment,
      preferredShoppingTimes,
    };
  }

  // Generate insights for a specific category
  private generateCategoryInsights(
    category: VenueCategory,
    visits: VisitRecord[]
  ): TrendInsight[] {
    const insights: TrendInsight[] = [];

    // Recent pattern changes
    const recentTrend = this.analyzeRecentTrend(visits);
    if (recentTrend.change > 30) {
      insights.push({
        type: 'increased_frequency',
        title: `More visits to ${this.getCategoryName(category)}`,
        description: `You've been visiting ${this.getCategoryName(category)} venues ${recentTrend.change}% more frequently lately.`,
        category,
        confidence: Math.min(0.9, recentTrend.change / 100),
        actionable: true,
        recommendation: `Consider using a card that offers bonus rewards for ${this.getCategoryName(category)} purchases.`,
      });
    }

    // New venues discovery
    const uniqueVenues = new Set(visits.map(v => v.venueInfo?.name).filter(Boolean));
    if (uniqueVenues.size > 5) {
      insights.push({
        type: 'new_pattern',
        title: `Exploring new ${this.getCategoryName(category)} venues`,
        description: `You've visited ${uniqueVenues.size} different ${this.getCategoryName(category)} venues recently.`,
        category,
        confidence: 0.7,
        actionable: true,
        recommendation: 'A flexible rewards card might serve you better than a category-specific one.',
      });
    }

    return insights;
  }

  // Helper methods
  private getDaysSpan(visits: VisitRecord[]): number {
    if (visits.length === 0) return 1;
    const dates = visits.map(v => new Date(v.arrivalTime).getTime());
    return (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
  }

  private getTopCategories(visits: VisitRecord[], count: number): VenueCategory[] {
    const categoryCounts = this.groupByCategory(visits);
    return Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, count)
      .map(([category]) => category as VenueCategory);
  }

  private calculateCategoryScore(
    categories: VenueCategory[],
    categoryVisits: Record<VenueCategory, VisitRecord[]>,
    totalVisits: number
  ): number {
    const categoryCount = categories.reduce(
      (sum, cat) => sum + (categoryVisits[cat]?.length || 0),
      0
    );
    return totalVisits > 0 ? categoryCount / totalVisits : 0;
  }

  private getPreferredTimes(visits: VisitRecord[]): string[] {
    const timeDistribution = this.calculateTimeOfDayDistribution(visits);
    const { morning, afternoon, evening, night } = timeDistribution;

    const times: string[] = [];
    if (morning > 0.3) times.push('Morning');
    if (afternoon > 0.3) times.push('Afternoon');
    if (evening > 0.3) times.push('Evening');
    if (night > 0.3) times.push('Night');

    return times.length > 0 ? times : ['Flexible'];
  }

  private analyzeRecentTrend(visits: VisitRecord[]): { change: number; direction: string } {
    if (visits.length < 6) return { change: 0, direction: 'stable' };

    const sortedVisits = visits.sort((a, b) =>
      new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
    );

    const recentVisits = sortedVisits.slice(-Math.floor(sortedVisits.length / 3));
    const olderVisits = sortedVisits.slice(0, Math.floor(sortedVisits.length / 3));

    const recentFreq = recentVisits.length / this.getDaysSpan(recentVisits);
    const olderFreq = olderVisits.length / this.getDaysSpan(olderVisits);

    const change = olderFreq > 0 ? ((recentFreq - olderFreq) / olderFreq) * 100 : 0;
    const direction = change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';

    return { change: Math.abs(change), direction };
  }

  private getCategoryName(category: VenueCategory): string {
    const names: Record<VenueCategory, string> = {
      [VenueCategory.GAS_STATION]: 'Gas Station',
      [VenueCategory.RESTAURANT]: 'Restaurant',
      [VenueCategory.BAR]: 'Bar',
      [VenueCategory.LIQUOR_STORE]: 'Liquor Store',
      [VenueCategory.PHARMACY]: 'Pharmacy',
      [VenueCategory.GROCERY]: 'Grocery',
      [VenueCategory.COFFEE_SHOP]: 'Coffee Shop',
      [VenueCategory.MALL]: 'Mall',
      [VenueCategory.RETAIL_STORE]: 'Retail Store',
      [VenueCategory.ELECTRONICS_STORE]: 'Electronics Store',
      [VenueCategory.CLOTHING_STORE]: 'Clothing Store',
      [VenueCategory.UNKNOWN]: 'Unknown',
    };
    return names[category] || 'Unknown';
  }

  private getDefaultBehaviorProfile(): UserBehaviorProfile {
    return {
      primaryCategories: [],
      secondaryCategories: [],
      routinePatterns: {
        workdayPattern: [],
        weekendPattern: [],
        frequentDestinations: [],
      },
      lifestyleIndicators: {
        isHealthConscious: false,
        isFoodie: false,
        isFamilyOriented: false,
        isProfessional: false,
        isSocial: false,
        isBudgetConscious: false,
      },
      spendingHabits: {
        frequencyOfEatingOut: 0,
        frequencyOfShopping: 0,
        frequencyOfEntertainment: 0,
        preferredShoppingTimes: [],
      },
    };
  }
}

// Export singleton instance
export const trendAnalysisService = new TrendAnalysisService();
export default trendAnalysisService;