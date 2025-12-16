import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';

interface CategoryTrend {
    category: string;
    count: number;
}

interface RecommendedCard {
    id: string;
    name: string;
    issuer: string;
    color: string;
    rewards: { [key: string]: number };
    matchRate: number;
    matchCategory: string;
}

import DonutChart, { getCategoryColor } from '../components/DonutChart';
import VisualCard from '../components/VisualCard';

// Helper to map category to icon
const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('dining') || cat.includes('restaurant')) return 'restaurant';
    if (cat.includes('grocery') || cat.includes('market')) return 'cart';
    if (cat.includes('travel') || cat.includes('flight')) return 'airplane';
    if (cat.includes('gas') || cat.includes('fuel')) return 'car';
    if (cat.includes('shopping')) return 'bag-handle';
    if (cat.includes('entertainment') || cat.includes('movie')) return 'film';
    return 'pricetag';
};

export default function TrendsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [trends, setTrends] = useState<CategoryTrend[]>([]);
    const [recommendations, setRecommendations] = useState<RecommendedCard[]>([]);

    useEffect(() => {
        loadTrendsAndRecommendations();
    }, []);

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Helper to get specific reward rate without fallback, handling aliases
    const getSpecificRewardRate = (rewards: any, category: string): number => {
        const cat = category.toLowerCase();
        // Aliases map
        const aliases: { [key: string]: string[] } = {
            'groceries': ['groceries', 'grocery', 'supermarket'],
            'dining': ['dining', 'restaurant', 'restaurants', 'food'],
            'gas': ['gas', 'fuel', 'station', 'gas_station'],
            'travel': ['travel', 'flights', 'hotels', 'transit'],
        };

        if (rewards[cat]) return rewards[cat];

        if (aliases[cat]) {
            for (const alias of aliases[cat]) {
                if (rewards[alias]) return rewards[alias];
            }
        }
        return 0;
    };

    const loadTrendsAndRecommendations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Location History (Last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: historyData, error: historyError } = await supabase
                .from('location_history')
                .select('category')
                .eq('user_id', user.id)
                .gte('visited_at', thirtyDaysAgo.toISOString());

            if (historyError) throw historyError;

            // 2. Fetch User Profile for Financial Context
            const { data: profileData } = await supabase
                .from('profiles')
                .select('monthly_rent, monthly_expenses, card_payments, car_payments')
                .eq('id', user.id)
                .single();

            // Calculate estimated monthly spend
            let totalMonthlySpend = 0;
            if (profileData) {
                totalMonthlySpend = (profileData.monthly_rent || 0) +
                    (profileData.monthly_expenses || 0) +
                    (profileData.card_payments || 0) +
                    (profileData.car_payments || 0);
            }

            // 3. Calculate Category Counts
            const categoryCounts: { [key: string]: number } = {};
            historyData?.forEach((visit: any) => {
                const cat = visit.category || 'general';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });

            const sortedTrends = Object.entries(categoryCounts)
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count);

            setTrends(sortedTrends);

            // 4. Fetch User's Current Cards
            const { data: userCardsData } = await supabase
                .from('user_cards')
                .select('card_id')
                .eq('user_id', user.id);

            const userCardIds = new Set((userCardsData || []).map((item: any) => item.card_id));

            // 5. Fetch All Available Cards
            const { data: allCards } = await supabase
                .from('credit_cards')
                .select('*');

            if (!allCards) return;

            // 6. Generate Recommendations (Diversity Prioritized)
            const targetCategories = sortedTrends
                .filter(t => t.category !== 'general')
                .slice(0, 3)
                .map(t => t.category);

            let finalRecs: RecommendedCard[] = [];
            const recommendedCardIds = new Set<string>();

            // Strategy 0: Bilt for Renters (Priority)
            // If user pays significant rent (> $1000) and doesn't own Bilt, recommend it first.
            if (profileData && (profileData.monthly_rent || 0) > 1000) {
                const biltCard = allCards.find((c: any) =>
                    c.name.toLowerCase().includes('bilt') ||
                    c.issuer.toLowerCase().includes('wells fargo') && c.name.toLowerCase().includes('rent')
                );

                if (biltCard && !userCardIds.has(biltCard.id)) {
                    finalRecs.push({
                        id: biltCard.id,
                        name: biltCard.name,
                        issuer: biltCard.issuer,
                        color: biltCard.color,
                        rewards: biltCard.rewards,
                        matchRate: 1, // 1% on Rent (points are valuable, but strictly it's 1x)
                        matchCategory: 'Rent'
                    });
                    recommendedCardIds.add(biltCard.id);
                }
            }

            // Strategy 1: Find the single best card for each Top Category
            targetCategories.forEach(cat => {
                if (finalRecs.length >= 3) return;

                let bestCard: any = null;
                let bestRate = 0;

                allCards.forEach((card: any) => {
                    if (userCardIds.has(card.id)) return;
                    if (recommendedCardIds.has(card.id)) return; // Don't recommend same card twice

                    // Financial Guards
                    if (card.annual_fee > 100 && totalMonthlySpend > 0 && totalMonthlySpend < 2000) return;
                    if (card.annual_fee > 0 && totalMonthlySpend > 0 && totalMonthlySpend < 800) return;

                    const rate = getSpecificRewardRate(card.rewards || {}, cat);
                    if (rate > 2 && rate > bestRate) {
                        bestRate = rate;
                        bestCard = card;
                    }
                });

                if (bestCard) {
                    finalRecs.push({
                        id: bestCard.id,
                        name: bestCard.name,
                        issuer: bestCard.issuer,
                        color: bestCard.color,
                        rewards: bestCard.rewards,
                        matchRate: bestRate,
                        matchCategory: capitalize(cat)
                    });
                    recommendedCardIds.add(bestCard.id);
                }
            });

            // Strategy 2: Fill remaining slots with "Everything" cards (Catch-all)
            if (finalRecs.length < 3) {
                allCards.forEach((card: any) => {
                    if (finalRecs.length >= 3) return;
                    if (userCardIds.has(card.id)) return;
                    if (recommendedCardIds.has(card.id)) return;

                    // Financial Guards
                    if (card.annual_fee > 100 && totalMonthlySpend > 0 && totalMonthlySpend < 2000) return;
                    if (card.annual_fee > 0 && totalMonthlySpend > 0 && totalMonthlySpend < 800) return;

                    const baseRate = card.rewards?.['everything'] || card.rewards?.['general'] || 0;
                    if (baseRate >= 2) {
                        finalRecs.push({
                            id: card.id,
                            name: card.name,
                            issuer: card.issuer,
                            color: card.color,
                            rewards: card.rewards,
                            matchRate: baseRate,
                            matchCategory: 'Everything'
                        });
                        recommendedCardIds.add(card.id);
                    }
                });
            }

            setRecommendations(finalRecs);

        } catch (error) {
            console.error('Error loading trends:', error);
            Alert.alert('Error', 'Failed to load recommendations');
        } finally {
            setLoading(false);
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
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Spending Insights</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Trends Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Where You Shop</Text>
                    <Text style={styles.sectionSubtitle}>Last 30 Days Activity</Text>

                    {trends.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No location history yet.</Text>
                            <Text style={styles.emptySubText}>Enable background tracking to start.</Text>
                        </View>
                    ) : (
                        <>
                            <DonutChart data={trends} />

                            <View style={styles.trendsGrid}>
                                {trends.map((trend, index) => {
                                    const color = getCategoryColor(trend.category);
                                    const icon = getCategoryIcon(trend.category);

                                    return (
                                        <View key={index} style={[styles.trendCard, { borderColor: color }]}>
                                            <View style={styles.trendHeader}>
                                                <View style={[styles.iconBox, { backgroundColor: color }]}>
                                                    <Ionicons name={icon as any} size={14} color="white" />
                                                </View>
                                                <Text style={styles.trendCount}>{trend.count}</Text>
                                            </View>
                                            <Text style={styles.trendName}>{capitalize(trend.category)}</Text>
                                            <View style={styles.progressBar}>
                                                <View style={[styles.progressFill, {
                                                    width: `${Math.min((trend.count / trends[0].count) * 100, 100)}%`,
                                                    backgroundColor: color
                                                }]} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </>
                    )}
                </View>

                {/* Recommendations Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Smart Recommendations</Text>
                    <Text style={styles.sectionSubtitle}>Cards that match your habits</Text>

                    {recommendations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="card-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>No recommendations.</Text>
                        </View>
                    ) : (
                        <View style={styles.recommendationList}>
                            {recommendations.map(card => (
                                <View key={card.id}>
                                    <View style={styles.matchTag}>
                                        <Ionicons name="trending-up" size={14} color="white" />
                                        <Text style={styles.matchTagText}>
                                            Match: {card.matchCategory} ({card.matchRate}%)
                                        </Text>
                                    </View>
                                    <VisualCard
                                        name={card.name}
                                        issuer={card.issuer}
                                        color={card.color}
                                        rewards={card.rewards}
                                        scale={0.95}
                                        highlightCategory={card.matchCategory}
                                    />
                                </View>
                            ))}
                        </View>
                    )}
                </View>

            </ScrollView>
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
        paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: COLORS.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
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
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        padding: 24,
        gap: 32,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    emptyState: {
        padding: 24,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
        borderStyle: 'dashed',
        gap: 8,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    trendsList: {
        gap: 12,
    },
    trendItem: {
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
    },
    trendInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    trendName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    trendCount: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    progressBar: {
        height: 4,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 12,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    cardItem: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 12,
        alignItems: 'center',
    },
    cardColor: {
        width: 8,
        height: '100%',
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    cardName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    cardIssuer: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    matchBadge: {
        backgroundColor: COLORS.surfaceSoft,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    matchText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    cardAction: {
        paddingRight: 16,
    },
    trendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16,
    },
    trendCard: {
        width: '48%',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    trendHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recommendationList: {
        gap: 24,
    },
    matchTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.success,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        marginBottom: -12, // Overlap the card slightly
        marginLeft: 12,
        zIndex: 10,
        gap: 6,
        borderWidth: 2,
        borderColor: COLORS.background, // Stroke effect
    },
    matchTagText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    }
});
