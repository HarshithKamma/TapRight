import { VenueCategory } from '../services/venueCategorization';

export interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  network: 'Visa' | 'Mastercard' | 'American Express' | 'Discover';
  annualFee: number;
  welcomeBonus?: {
    value: number; // in dollars
    requirement: string; // e.g., "Spend $1000 in 3 months"
  };
  rewards: RewardsStructure;
  benefits: string[];
  recommendedFor: VenueCategory[];
  creditScoreRequired: 'Fair' | 'Good' | 'Excellent';
  popularityScore: number; // 0-1 based on market data
  imageUrl?: string;
  applyUrl?: string;
}

export interface RewardsStructure {
  type: 'cashback' | 'points' | 'travel';
  baseRate: number; // percentage or points per dollar
  categoryRates: Record<VenueCategory, number>; // category-specific rates
  specialOffers?: Array<{
    category: VenueCategory;
    rate: number;
    expiration?: Date;
    conditions?: string;
  }>;
  pointsValue?: number; // value per point if points-based
}

// Comprehensive credit card database
export const CREDIT_CARDS: CreditCard[] = [
  // Premium Cashback Cards
  {
    id: 'amex_gold',
    name: 'American Express Gold',
    issuer: 'American Express',
    network: 'American Express',
    annualFee: 325,
    welcomeBonus: {
      value: 250,
      requirement: 'Spend $3,000 in 6 months'
    },
    rewards: {
      type: 'points',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.RESTAURANT]: 0.04,
        [VenueCategory.COFFEE_SHOP]: 0.04,
        [VenueCategory.GROCERY]: 0.04,
        [VenueCategory.GAS_STATION]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.RETAIL_STORE]: 0.01,
        [VenueCategory.BAR]: 0.04,
        [VenueCategory.LIQUOR_STORE]: 0.04,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      pointsValue: 0.006, // 0.6 cents per point
    },
    benefits: [
      '$120 dining credit annually',
      '$100 airline fee credit annually',
      'No foreign transaction fees',
      'Point transfer to travel partners',
      'Purchase protection',
      'Return protection'
    ],
    recommendedFor: [VenueCategory.RESTAURANT, VenueCategory.COFFEE_SHOP, VenueCategory.GROCERY],
    creditScoreRequired: 'Good',
    popularityScore: 0.85,
  },
  {
    id: 'chase_sapphire_preferred',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 95,
    welcomeBonus: {
      value: 200,
      requirement: 'Spend $4,000 in 3 months'
    },
    rewards: {
      type: 'points',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.RESTAURANT]: 0.03,
        [VenueCategory.COFFEE_SHOP]: 0.03,
        [VenueCategory.GAS_STATION]: 0.03,
        [VenueCategory.GROCERY]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.RETAIL_STORE]: 0.01,
        [VenueCategory.BAR]: 0.03,
        [VenueCategory.LIQUOR_STORE]: 0.01,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      pointsValue: 0.0125, // 1.25 cents per point for travel
    },
    benefits: [
      '25% more value when redeeming for travel',
      'No foreign transaction fees',
      'Purchase protection',
      'Trip cancellation insurance',
      'Rental car insurance',
      'Extended warranty'
    ],
    recommendedFor: [VenueCategory.RESTAURANT, VenueCategory.COFFEE_SHOP, VenueCategory.GAS_STATION],
    creditScoreRequired: 'Good',
    popularityScore: 0.90,
  },
  {
    id: 'blue_cash_preferred',
    name: 'Blue Cash Preferred',
    issuer: 'American Express',
    network: 'American Express',
    annualFee: 0,
    welcomeBonus: {
      value: 200,
      requirement: 'Spend $2,000 in 3 months'
    },
    rewards: {
      type: 'cashback',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.GROCERY]: 0.06,
        [VenueCategory.GAS_STATION]: 0.03,
        [VenueCategory.RETAIL_STORE]: 0.06,
        [VenueCategory.RESTAURANT]: 0.01,
        [VenueCategory.COFFEE_SHOP]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.BAR]: 0.01,
        [VenueCategory.LIQUOR_STORE]: 0.01,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
    },
    benefits: [
      'No annual fee',
      'Cash back is automatic',
      'Extended warranty',
      'Purchase protection',
      'Return protection'
    ],
    recommendedFor: [VenueCategory.GROCERY, VenueCategory.GAS_STATION, VenueCategory.RETAIL_STORE],
    creditScoreRequired: 'Good',
    popularityScore: 0.75,
  },

  // No Annual Fee Cards
  {
    id: 'chase_freedom_unlimited',
    name: 'Chase Freedom Unlimited',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 0,
    welcomeBonus: {
      value: 150,
      requirement: 'Spend $500 in 3 months'
    },
    rewards: {
      type: 'points',
      baseRate: 0.015,
      categoryRates: {
        [VenueCategory.GROCERY]: 0.03,
        [VenueCategory.GAS_STATION]: 0.03,
        [VenueCategory.COFFEE_SHOP]: 0.03,
        [VenueCategory.RESTAURANT]: 0.015,
        [VenueCategory.PHARMACY]: 0.015,
        [VenueCategory.RETAIL_STORE]: 0.015,
        [VenueCategory.BAR]: 0.015,
        [VenueCategory.LIQUOR_STORE]: 0.015,
        [VenueCategory.MALL]: 0.015,
        [VenueCategory.ELECTRONICS_STORE]: 0.015,
        [VenueCategory.CLOTHING_STORE]: 0.015,
        [VenueCategory.UNKNOWN]: 0.015,
      },
      pointsValue: 0.01, // 1 cent per point
    },
    benefits: [
      'No annual fee',
      'Cell phone protection',
      'Purchase protection',
      'Extended warranty',
      'No foreign transaction fees'
    ],
    recommendedFor: [VenueCategory.GROCERY, VenueCategory.GAS_STATION, VenueCategory.COFFEE_SHOP],
    creditScoreRequired: 'Good',
    popularityScore: 0.80,
  },
  {
    id: 'discover_it',
    name: 'Discover it Cash Back',
    issuer: 'Discover',
    network: 'Discover',
    annualFee: 0,
    welcomeBonus: {
      value: 50, // Matched at end of first year
      requirement: 'Spend $1,000 in 3 months'
    },
    rewards: {
      type: 'cashback',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.GROCERY]: 0.01,
        [VenueCategory.GAS_STATION]: 0.01,
        [VenueCategory.RESTAURANT]: 0.01,
        [VenueCategory.COFFEE_SHOP]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.RETAIL_STORE]: 0.01,
        [VenueCategory.BAR]: 0.01,
        [VenueCategory.LIQUOR_STORE]: 0.01,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      specialOffers: [
        // Rotating 5% categories (would need to be updated quarterly)
        {
          category: VenueCategory.RESTAURANT,
          rate: 0.05,
          conditions: 'Q1 2024: Restaurants & cafes'
        },
        {
          category: VenueCategory.GROCERY,
          rate: 0.05,
          conditions: 'Q2 2024: Grocery stores'
        }
      ]
    },
    benefits: [
      'No annual fee',
      'Cashback match first year',
      'Free FICO score',
      'Freeze your account instantly',
      'U.S. based customer service'
    ],
    recommendedFor: [VenueCategory.RESTAURANT, VenueCategory.GROCERY, VenueCategory.GAS_STATION],
    creditScoreRequired: 'Good',
    popularityScore: 0.70,
  },

  // Travel Cards
  {
    id: 'chase_sapphire_reserve',
    name: 'Chase Sapphire Reserve',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 550,
    welcomeBonus: {
      value: 300,
      requirement: 'Spend $4,000 in 3 months'
    },
    rewards: {
      type: 'points',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.RESTAURANT]: 0.03,
        [VenueCategory.COFFEE_SHOP]: 0.03,
        [VenueCategory.GAS_STATION]: 0.03,
        [VenueCategory.GROCERY]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.RETAIL_STORE]: 0.01,
        [VenueCategory.BAR]: 0.03,
        [VenueCategory.LIQUOR_STORE]: 0.01,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      pointsValue: 0.015, // 1.5 cents per point for travel
    },
    benefits: [
      '$300 annual travel credit',
      'Priority Pass lounge access',
      'Global Entry application credit',
      'No foreign transaction fees',
      'Trip cancellation insurance',
      'Primary rental car insurance',
      'Purchase protection',
      'Extended warranty'
    ],
    recommendedFor: [VenueCategory.RESTAURANT, VenueCategory.COFFEE_SHOP, VenueCategory.GAS_STATION],
    creditScoreRequired: 'Excellent',
    popularityScore: 0.65,
  },

  // Store Cards
  {
    id: 'amazon_prime',
    name: 'Amazon Prime Rewards Visa',
    issuer: 'Chase',
    network: 'Visa',
    annualFee: 0, // Requires Prime membership ($139/year)
    welcomeBonus: {
      value: 70,
      requirement: 'Amazon Prime membership required'
    },
    rewards: {
      type: 'points',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.RETAIL_STORE]: 0.05, // Amazon & Whole Foods
        [VenueCategory.GROCERY]: 0.05, // Whole Foods
        [VenueCategory.RESTAURANT]: 0.02,
        [VenueCategory.COFFEE_SHOP]: 0.02,
        [VenueCategory.GAS_STATION]: 0.02,
        [VenueCategory.PHARMACY]: 0.02,
        [VenueCategory.BAR]: 0.02,
        [VenueCategory.LIQUOR_STORE]: 0.02,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      pointsValue: 0.01, // 1 cent per point
    },
    benefits: [
      'No annual fee (with Prime)',
      '5% back at Amazon',
      '5% back at Whole Foods',
      '2% back at restaurants, gas stations, and drugstores',
      'No foreign transaction fees',
      'Travel and emergency assistance'
    ],
    recommendedFor: [VenueCategory.RETAIL_STORE, VenueCategory.GROCERY],
    creditScoreRequired: 'Good',
    popularityScore: 0.60,
  },

  // Gas Cards
  {
    id: 'penfed_power_cash',
    name: 'PenFed Power Cash Rewards',
    issuer: 'PenFed',
    network: 'Visa',
    annualFee: 0,
    welcomeBonus: {
      value: 100,
      requirement: 'Spend $1,500 in 3 months'
    },
    rewards: {
      type: 'cashback',
      baseRate: 0.015,
      categoryRates: {
        [VenueCategory.GAS_STATION]: 0.05,
        [VenueCategory.GROCERY]: 0.02,
        [VenueCategory.RESTAURANT]: 0.015,
        [VenueCategory.COFFEE_SHOP]: 0.015,
        [VenueCategory.PHARMACY]: 0.015,
        [VenueCategory.RETAIL_STORE]: 0.015,
        [VenueCategory.BAR]: 0.015,
        [VenueCategory.LIQUOR_STORE]: 0.015,
        [VenueCategory.MALL]: 0.015,
        [VenueCategory.ELECTRONICS_STORE]: 0.015,
        [VenueCategory.CLOTHING_STORE]: 0.015,
        [VenueCategory.UNKNOWN]: 0.015,
      },
    },
    benefits: [
      'No annual fee',
      '5% cash back on gas',
      '2% cash back on groceries',
      '1.5% cash back on all other purchases',
      'No foreign transaction fees',
      'EMV chip technology'
    ],
    recommendedFor: [VenueCategory.GAS_STATION, VenueCategory.GROCERY],
    creditScoreRequired: 'Good',
    popularityScore: 0.50,
  },

  // Student Cards
  {
    id: 'discover_student',
    name: 'Discover it Student Cash Back',
    issuer: 'Discover',
    network: 'Discover',
    annualFee: 0,
    welcomeBonus: {
      value: 20, // Matched at end of first year
      requirement: 'Good grades program: $20 statement credit each year for 10 years'
    },
    rewards: {
      type: 'cashback',
      baseRate: 0.01,
      categoryRates: {
        [VenueCategory.GROCERY]: 0.01,
        [VenueCategory.GAS_STATION]: 0.01,
        [VenueCategory.RESTAURANT]: 0.01,
        [VenueCategory.COFFEE_SHOP]: 0.01,
        [VenueCategory.PHARMACY]: 0.01,
        [VenueCategory.RETAIL_STORE]: 0.01,
        [VenueCategory.BAR]: 0.01,
        [VenueCategory.LIQUOR_STORE]: 0.01,
        [VenueCategory.MALL]: 0.01,
        [VenueCategory.ELECTRONICS_STORE]: 0.01,
        [VenueCategory.CLOTHING_STORE]: 0.01,
        [VenueCategory.UNKNOWN]: 0.01,
      },
      specialOffers: [
        // Rotating 5% categories
        {
          category: VenueCategory.RESTAURANT,
          rate: 0.05,
          conditions: 'Rotating categories'
        }
      ]
    },
    benefits: [
      'No annual fee',
      'Cashback match first year',
      'Good grades reward',
      'Free FICO score',
      'No foreign transaction fees',
      'U.S. based customer service'
    ],
    recommendedFor: [VenueCategory.RESTAURANT, VenueCategory.GROCERY, VenueCategory.GAS_STATION],
    creditScoreRequired: 'Fair',
    popularityScore: 0.40,
  },
];

// Helper functions
export function getCardsByCategory(category: VenueCategory): CreditCard[] {
  return CREDIT_CARDS.filter(card =>
    card.recommendedFor.includes(category) ||
    card.rewards.categoryRates[category] > 0.02
  ).sort((a, b) => {
    const aRate = a.rewards.categoryRates[category] || a.rewards.baseRate;
    const bRate = b.rewards.categoryRates[category] || b.rewards.baseRate;
    return bRate - aRate;
  });
}

export function getCardsByIssuer(issuer: string): CreditCard[] {
  return CREDIT_CARDS.filter(card => card.issuer === issuer);
}

export function getNoAnnualFeeCards(): CreditCard[] {
  return CREDIT_CARDS.filter(card => card.annualFee === 0);
}

export function getPremiumCards(): CreditCard[] {
  return CREDIT_CARDS.filter(card => card.annualFee >= 95);
}

export function getCardById(id: string): CreditCard | undefined {
  return CREDIT_CARDS.find(card => card.id === id);
}

export function calculateRewardsValue(
  card: CreditCard,
  spending: Record<VenueCategory, number>
): number {
  let totalValue = 0;

  for (const [category, amount] of Object.entries(spending)) {
    const rate = card.rewards.categoryRates[category as VenueCategory] || card.rewards.baseRate;
    let categoryValue = amount * rate;

    // Apply bonus for special offers
    if (card.rewards.specialOffers) {
      for (const offer of card.rewards.specialOffers) {
        if (offer.category === category as VenueCategory) {
          const offerBonus = amount * (offer.rate - rate);
          categoryValue += offerBonus;
        }
      }
    }

    // Convert points to dollars if needed
    if (card.rewards.type === 'points' && card.rewards.pointsValue) {
      categoryValue *= card.rewards.pointsValue;
    }

    totalValue += categoryValue;
  }

  // Subtract annual fee
  totalValue -= card.annualFee;

  // Add welcome bonus value (amortized over first year)
  if (card.welcomeBonus) {
    totalValue += card.welcomeBonus.value;
  }

  return totalValue;
}

export function compareCards(card1: CreditCard, card2: CreditCard): {
  betterForCategories: VenueCategory[];
  tie: boolean;
  winner: 'card1' | 'card2' | 'tie';
} {
  const betterForCategories: VenueCategory[] = [];
  let card1Wins = 0;
  let card2Wins = 0;

  const allCategories = Object.values(VenueCategory);

  for (const category of allCategories) {
    const card1Rate = card1.rewards.categoryRates[category] || card1.rewards.baseRate;
    const card2Rate = card2.rewards.categoryRates[category] || card2.rewards.baseRate;

    if (card1Rate > card2Rate) {
      betterForCategories.push(category);
      card1Wins++;
    } else if (card2Rate > card1Rate) {
      card2Wins++;
    }
  }

  const tie = card1Wins === card2Wins;
  const winner = tie ? 'tie' : card1Wins > card2Wins ? 'card1' : 'card2';

  return {
    betterForCategories,
    tie,
    winner,
  };
}