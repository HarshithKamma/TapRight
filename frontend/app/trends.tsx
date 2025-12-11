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

            // 2. Calculate Category Counts
            const categoryCounts: { [key: string]: number } = {};
            historyData?.forEach((visit: any) => {
                const cat = visit.category || 'general';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });

            const sortedTrends = Object.entries(categoryCounts)
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count);

            setTrends(sortedTrends);

            // 3. Fetch User's Current Cards
            const { data: userCardsData } = await supabase
                .from('user_cards')
                .select('card_id')
                .eq('user_id', user.id);

            const userCardIds = new Set((userCardsData || []).map((item: any) => item.card_id));

            // 4. Fetch All Available Cards
            const { data: allCards } = await supabase
                .from('credit_cards')
                .select('*');

            if (!allCards) return;

            // 5. Generate Recommendations
            // Identify target categories (Top 3, EXCLUDING 'general')
            const targetCategories = sortedTrends
                .filter(t => t.category !== 'general')
                .slice(0, 3)
                .map(t => t.category);

            let potentialRecs: RecommendedCard[] = [];

            allCards.forEach((card: any) => {
                if (userCardIds.has(card.id)) return; // Skip owned cards

                const rewards = card.rewards || {};

                // A. Check for High Specific Matches in Target Categories
                targetCategories.forEach(cat => {
                    const specificRate = getSpecificRewardRate(rewards, cat);
                    // Threshold: Recommend if rate is significantly high (> 2%)
                    if (specificRate > 2) {
                        potentialRecs.push({
                            id: card.id,
                            name: card.name,
                            issuer: card.issuer,
                            color: card.color,
                            rewards: card.rewards,
                            matchRate: specificRate,
                            matchCategory: capitalize(cat)
                        });
                    }
                });

                // B. Check for High Base Rate (Fallback)
                // If a card offers >= 2% on everything, it's a solid recommendation
                const baseRate = rewards['everything'] || rewards['general'] || 0;
                if (baseRate >= 2) {
                    potentialRecs.push({
                        id: card.id,
                        name: card.name,
                        issuer: card.issuer,
                        color: card.color,
                        rewards: card.rewards,
                        matchRate: baseRate,
                        matchCategory: 'Everything' // Explicit label
                    });
                }
            });

            // Deduplicate: Keep the instance with the highest match rate for each card
            const uniqueRecs = new Map<string, RecommendedCard>();
            potentialRecs.forEach(rec => {
                const existing = uniqueRecs.get(rec.id);
                // If new one is better, or same card but "Specific" category vs "Everything", prefer specific
                if (!existing) {
                    uniqueRecs.set(rec.id, rec);
                } else {
                    if (rec.matchRate > existing.matchRate) {
                        uniqueRecs.set(rec.id, rec);
                    } else if (rec.matchRate === existing.matchRate && rec.matchCategory !== 'Everything') {
                        // Prefer "3% on Dining" over "3% on Everything" for clarity context if rates equal?
                        // Actually, "Everything" is stronger usually, but "Dining" explains WHY we picked it based on trends.
                        // Let's stick to highest rate.
                        uniqueRecs.set(rec.id, rec);
                    }
                }
            });

            const finalRecs = Array.from(uniqueRecs.values())
                .sort((a, b) => b.matchRate - a.matchRate)
                .slice(0, 3); // Top 3 recommendations

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
                    <Text style={styles.sectionSubtitle}>Based on your visit history (last 30 days)</Text>

                    {trends.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No location history yet.</Text>
                            <Text style={styles.emptySubText}>Enable background tracking on the home screen to start gathering insights.</Text>
                        </View>
                    ) : (
                        <View style={styles.trendsList}>
                            {trends.map((trend, index) => (
                                <View key={index} style={styles.trendItem}>
                                    <View style={styles.trendInfo}>
                                        <Text style={styles.trendName}>{capitalize(trend.category)}</Text>
                                        <Text style={styles.trendCount}>{trend.count} visits</Text>
                                    </View>
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressFill, { width: `${Math.min((trend.count / trends[0].count) * 100, 100)}%` }]} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Recommendations Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Smart Recommendations</Text>
                    <Text style={styles.sectionSubtitle}>Cards you don't own that match your habits</Text>

                    {recommendations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="card-outline" size={48} color={COLORS.textSecondary} />
                            <Text style={styles.emptyText}>No recommendations currently.</Text>
                            {trends.length > 0 ? (
                                <Text style={styles.emptySubText}>Your current wallet already covers your top categories well!</Text>
                            ) : (
                                <Text style={styles.emptySubText}>Visit more places to get personalized suggestions.</Text>
                            )}
                        </View>
                    ) : (
                        recommendations.map(card => (
                            <View key={card.id} style={styles.cardItem}>
                                <View style={[styles.cardColor, { backgroundColor: card.color }]} />
                                <View style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardName}>{card.name}</Text>
                                        <View style={styles.matchBadge}>
                                            <Ionicons name="trending-up" size={14} color={COLORS.accent} />
                                            <Text style={styles.matchText}>
                                                {card.matchRate}% on {card.matchCategory}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardIssuer}>{card.issuer}</Text>
                                </View>
                                <View style={styles.cardAction}>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                                </View>
                            </View>
                        ))
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
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    progressBar: {
        height: 6,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: 3,
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
    }
});
