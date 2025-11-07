import { CreditCard, calculateRewardsValue, CREDIT_CARDS } from '../data/creditCards';
import { VenueCategory } from './venueCategorization';
import { SpendingProfile, SpendingEstimate } from './spendCategorization';
import { UserBehaviorProfile } from './trendAnalysis';

export interface CardRecommendation {
  card: CreditCard;
  score: number; // 0-100 recommendation score
  estimatedRewards: number; // annual rewards value
  estimatedSavings: number; // additional savings vs current cards
  reasoning: string[];
  categoryBreakdown: Record<VenueCategory, {
    spend: number;
    rewards: number;
    rate: number;
  }>;
  pros: string[];
  cons: string[];
  userRating: number; // Based on user profile match
  confidence: number; // 0-1 confidence in recommendation
}

export interface RecommendationContext {
  userSpending: SpendingProfile;
  userBehavior: UserBehaviorProfile;
  currentCards?: CreditCard[];
  preferences?: {
    maxAnnualFee?: number;
    creditScoreRequired?: 'Fair' | 'Good' | 'Excellent';
    preferredIssuers?: string[];
    avoidIssuers?: string[];
    wantsTravelBenefits?: boolean;
    wantsCashBack?: boolean;
  };
}

class CardRecommendationService {
  // Generate personalized card recommendations
  async generateRecommendations(
    context: RecommendationContext,
    count: number = 5
  ): Promise<CardRecommendation[]> {
    try {
      const recommendations: CardRecommendation[] = [];

      // Filter cards based on user preferences
      const eligibleCards = this.filterEligibleCards(CREDIT_CARDS, context);

      // Score each card
      for (const card of eligibleCards) {
        const recommendation = await this.scoreCard(card, context);
        recommendations.push(recommendation);
      }

      // Sort by score and return top recommendations
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, count);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  // Filter cards based on user preferences and eligibility
  private filterEligibleCards(cards: CreditCard[], context: RecommendationContext): CreditCard[] {
    return cards.filter(card => {
      // Credit score requirement
      if (context.preferences?.creditScoreRequired) {
        const scoreLevels = { 'Fair': 1, 'Good': 2, 'Excellent': 3 };
        const cardLevel = scoreLevels[card.creditScoreRequired];
        const userLevel = scoreLevels[context.preferences!.creditScoreRequired];
        if (cardLevel > userLevel) return false;
      }

      // Annual fee preference
      if (context.preferences?.maxAnnualFee !== undefined) {
        if (card.annualFee > context.preferences.maxAnnualFee) return false;
      }

      // Preferred issuers
      if (context.preferences?.preferredIssuers?.length) {
        if (!context.preferences.preferredIssuers.includes(card.issuer)) return false;
      }

      // Issuers to avoid
      if (context.preferences?.avoidIssuers?.length) {
        if (context.preferences.avoidIssuers.includes(card.issuer)) return false;
      }

      // Rewards type preference
      if (context.preferences?.wantsCashBack && card.rewards.type !== 'cashback') {
        return false;
      }

      if (context.preferences?.wantsTravelBenefits && card.rewards.type !== 'travel') {
        return false;
      }

      return true;
    });
  }

  // Score an individual card
  private async scoreCard(card: CreditCard, context: RecommendationContext): Promise<CardRecommendation> {
    // Calculate estimated rewards
    const spending = this.spendingProfileToRecord(context.userSpending);
    const estimatedRewards = calculateRewardsValue(card, spending);

    // Calculate savings vs current cards
    const estimatedSavings = this.calculateSavingsVsCurrent(
      card,
      spending,
      context.currentCards || []
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(card, context);

    // Calculate category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(card, spending);

    // Generate pros and cons
    const pros = this.generatePros(card, context);
    const cons = this.generateCons(card, context);

    // Calculate user rating
    const userRating = this.calculateUserRating(card, context);

    // Calculate overall score
    const score = this.calculateOverallScore({
      estimatedRewards,
      estimatedSavings,
      userRating,
      popularityScore: card.popularityScore,
      annualFee: card.annualFee,
      welcomeBonus: card.welcomeBonus?.value || 0,
    });

    // Calculate confidence
    const confidence = this.calculateConfidence(card, context);

    return {
      card,
      score: Math.round(score),
      estimatedRewards: Math.round(estimatedRewards),
      estimatedSavings: Math.round(estimatedSavings),
      reasoning,
      categoryBreakdown,
      pros,
      cons,
      userRating: Math.round(userRating * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  // Convert spending profile to record format
  private spendingProfileToRecord(profile: SpendingProfile): Record<VenueCategory, number> {
    const record: Record<VenueCategory, number> = {} as any;

    profile.categoryBreakdown.forEach(estimate => {
      record[estimate.category] = estimate.estimatedMonthlySpend * 12; // Annual spending
    });

    // Ensure all categories are present
    Object.values(VenueCategory).forEach(category => {
      if (record[category] === undefined) {
        record[category] = 0;
      }
    });

    return record;
  }

  // Calculate savings compared to current cards
  private calculateSavingsVsCurrent(
    card: CreditCard,
    spending: Record<VenueCategory, number>,
    currentCards: CreditCard[]
  ): number {
    if (currentCards.length === 0) return 0;

    // Find the best current card for each category
    let currentBestRewards = 0;
    for (const currentCard of currentCards) {
      const cardRewards = calculateRewardsValue(currentCard, spending);
      currentBestRewards = Math.max(currentBestRewards, cardRewards);
    }

    const newCardRewards = calculateRewardsValue(card, spending);
    return Math.max(0, newCardRewards - currentBestRewards);
  }

  // Generate reasoning for recommendation
  private generateReasoning(card: CreditCard, context: RecommendationContext): string[] {
    const reasoning: string[] = [];
    const spending = this.spendingProfileToRecord(context.userSpending);
    const topCategories = context.userSpending.highSpendingCategories;

    // Category-specific reasoning
    for (const category of topCategories) {
      const categorySpend = spending[category];
      const categoryRate = card.rewards.categoryRates[category] || card.rewards.baseRate;
      const categoryRewards = categorySpend * categoryRate;

      if (categoryRewards > 100) { // Significant rewards in this category
        reasoning.push(
          `Earn $${Math.round(categoryRewards)} annually on ${this.getCategoryName(category)} with ${Math.round(categoryRate * 100)}% cashback`
        );
      }
    }

    // Welcome bonus reasoning
    if (card.welcomeBonus && card.welcomeBonus.value > 100) {
      reasoning.push(
        `Get $${card.welcomeBonus.value} welcome bonus - ${card.welcomeBonus.requirement}`
      );
    }

    // Annual fee reasoning
    if (card.annualFee === 0) {
      reasoning.push('No annual fee makes this a great choice for everyday spending');
    } else if (estimatedRewards > card.annualFee * 3) {
      reasoning.push(`Annual fee of $${card.annualFee} is easily offset by rewards`);
    }

    // Benefits reasoning
    if (card.rewards.type === 'travel' && context.userBehavior.lifestyleIndicators.isSocial) {
      reasoning.push('Travel rewards and benefits match your social lifestyle');
    }

    if (card.benefits.some(benefit => benefit.includes('dining')) &&
        context.userBehavior.lifestyleIndicators.isFoodie) {
      reasoning.push('Dining benefits perfect for your foodie lifestyle');
    }

    return reasoning;
  }

  // Calculate category breakdown
  private calculateCategoryBreakdown(
    card: CreditCard,
    spending: Record<VenueCategory, number>
  ): CardRecommendation['categoryBreakdown'] {
    const breakdown: CardRecommendation['categoryBreakdown'] = {} as any;

    for (const [category, amount] of Object.entries(spending)) {
      if (amount > 0) {
        const rate = card.rewards.categoryRates[category as VenueCategory] || card.rewards.baseRate;
        let rewards = amount * rate;

        // Convert points to dollars if needed
        if (card.rewards.type === 'points' && card.rewards.pointsValue) {
          rewards *= card.rewards.pointsValue;
        }

        breakdown[category as VenueCategory] = {
          spend: amount,
          rewards: Math.round(rewards),
          rate: Math.round(rate * 1000) / 10, // One decimal place
        };
      }
    }

    return breakdown;
  }

  // Generate pros for the card
  private generatePros(card: CreditCard, context: RecommendationContext): string[] {
    const pros: string[] = [];

    // Rewards pros
    const topCategories = context.userSpending.highSpendingCategories;
    for (const category of topCategories.slice(0, 2)) {
      const rate = card.rewards.categoryRates[category] || card.rewards.baseRate;
      if (rate > 0.03) {
        pros.push(`Excellent ${Math.round(rate * 100)}% rewards on ${this.getCategoryName(category)}`);
      }
    }

    // Fee pros
    if (card.annualFee === 0) {
      pros.push('No annual fee');
    }

    // Welcome bonus pros
    if (card.welcomeBonus && card.welcomeBonus.value > 150) {
      pros.push(`Generous $${card.welcomeBonus.value} welcome bonus`);
    }

    // Benefits pros
    if (card.benefits.some(b => b.includes('no foreign'))) {
      pros.push('No foreign transaction fees');
    }

    if (card.benefits.some(b => b.includes('Purchase protection'))) {
      pros.push('Purchase protection included');
    }

    // Popularity pros
    if (card.popularityScore > 0.8) {
      pros.push('Highly popular and well-regarded card');
    }

    return pros;
  }

  // Generate cons for the card
  private generateCons(card: CreditCard, context: RecommendationContext): string[] {
    const cons: string[] = [];

    // Fee cons
    if (card.annualFee > 100) {
      cons.push(`High annual fee of $${card.annualFee}`);
    }

    // Low rewards cons
    const topCategories = context.userSpending.highSpendingCategories;
    for (const category of topCategories.slice(0, 2)) {
      const rate = card.rewards.categoryRates[category] || card.rewards.baseRate;
      if (rate < 0.02) {
        cons.push(`Low ${Math.round(rate * 100)}% rewards on your top category: ${this.getCategoryName(category)}`);
      }
    }

    // Network cons
    if (card.network === 'American Express') {
      cons.push('Not accepted everywhere (Amex network)');
    } else if (card.network === 'Discover') {
      cons.push('Limited international acceptance');
    }

    // Credit score cons
    if (card.creditScoreRequired === 'Excellent') {
      cons.push('Requires excellent credit');
    }

    return cons;
  }

  // Calculate user rating based on profile match
  private calculateUserRating(card: CreditCard, context: RecommendationContext): number {
    let rating = 0.5; // Base rating

    const userCategories = context.userBehavior.primaryCategories;
    const userLifestyle = context.userBehavior.lifestyleIndicators;

    // Match based on primary categories
    const categoryMatches = userCategories.filter(cat =>
      card.recommendedFor.includes(cat) ||
      (card.rewards.categoryRates[cat] || 0) > 0.03
    );
    rating += categoryMatches.length * 0.15;

    // Match based on lifestyle
    if (userLifestyle.isFoodie && card.benefits.some(b => b.includes('dining'))) {
      rating += 0.1;
    }

    if (userLifestyle.isBudgetConscious && card.annualFee === 0) {
      rating += 0.1;
    }

    if (userLifestyle.isSocial && card.rewards.type === 'travel') {
      rating += 0.1;
    }

    return Math.min(1.0, rating);
  }

  // Calculate overall recommendation score
  private calculateOverallScore(components: {
    estimatedRewards: number;
    estimatedSavings: number;
    userRating: number;
    popularityScore: number;
    annualFee: number;
    welcomeBonus: number;
  }): number {
    let score = 0;

    // Rewards value (40% weight)
    score += Math.min(50, components.estimatedRewards / 10) * 0.4;

    // Additional savings (20% weight)
    score += Math.min(25, components.estimatedSavings / 5) * 0.2;

    // User profile match (20% weight)
    score += components.userRating * 20;

    // Popularity (10% weight)
    score += components.popularityScore * 10;

    // Welcome bonus (5% weight)
    score += Math.min(5, components.welcomeBonus / 20);

    // Penalty for high annual fees
    if (components.annualFee > 100) {
      score -= (components.annualFee - 100) / 50;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Calculate confidence in recommendation
  private calculateConfidence(card: CreditCard, context: RecommendationContext): number {
    let confidence = 0.5; // Base confidence

    // More spending data increases confidence
    const totalSpend = context.userSpending.totalEstimatedMonthlySpend * 12;
    if (totalSpend > 30000) confidence += 0.2;
    else if (totalSpend > 15000) confidence += 0.1;

    // Strong category match increases confidence
    const userCategories = context.userBehavior.primaryCategories;
    const strongMatches = userCategories.filter(cat =>
      card.recommendedFor.includes(cat)
    );
    confidence += strongMatches.length * 0.1;

    // Popular cards increase confidence
    confidence += card.popularityScore * 0.2;

    return Math.min(1.0, confidence);
  }

  // Get category name
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

  // Generate insights about current card usage
  async analyzeCurrentCardUsage(
    currentCards: CreditCard[],
    context: RecommendationContext
  ): Promise<{
    optimizedPotential: number;
    currentRewards: number;
    improvementSuggestions: string[];
    bestCurrentCard: CreditCard | null;
  }> {
    const spending = this.spendingProfileToRecord(context.userSpending);

    // Calculate current rewards
    let currentRewards = 0;
    let bestCurrentCard: CreditCard | null = null;
    let bestCardRewards = 0;

    for (const card of currentCards) {
      const cardRewards = calculateRewardsValue(card, spending);
      currentRewards += cardRewards;

      if (cardRewards > bestCardRewards) {
        bestCardRewards = cardRewards;
        bestCurrentCard = card;
      }
    }

    // Calculate optimized potential with ideal cards
    const optimizedRecommendations = await this.generateRecommendations(context, 3);
    const optimizedPotential = optimizedRecommendations.reduce(
      (sum, rec) => sum + rec.estimatedRewards,
      0
    );

    // Generate improvement suggestions
    const improvementSuggestions: string[] = [];
    const improvementAmount = optimizedPotential - currentRewards;

    if (improvementAmount > 200) {
      improvementSuggestions.push(`You could earn $${Math.round(improvementAmount)} more per year with optimized cards`);
    }

    if (currentCards.length === 0) {
      improvementSuggestions.push('Get your first rewards card to start earning on your spending');
    } else if (currentCards.length === 1 && currentCards[0].rewards.baseRate < 0.015) {
      improvementSuggestions.push('Consider adding a category-specific bonus card for your top spending categories');
    }

    if (!currentCards.some(card => card.annualFee === 0) && improvementAmount < 100) {
      improvementSuggestions.push('A no-annual-fee card might be more cost-effective for your spending level');
    }

    return {
      optimizedPotential: Math.round(optimizedPotential),
      currentRewards: Math.round(currentRewards),
      improvementSuggestions,
      bestCurrentCard,
    };
  }
}

// Export singleton instance
export const cardRecommendationService = new CardRecommendationService();
export default cardRecommendationService;