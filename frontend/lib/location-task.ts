import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { identifyMerchant } from './google-places';

export const LOCATION_TASK_NAME = 'background-location-task';

// Global lock to prevent concurrent location checks
let isCheckingLocation = false;

// Configure notification handler (can be called multiple times safely, but good to have here)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Helper to log visit
export const logVisit = async (userId: string, merchant: any): Promise<boolean> => {
    try {
        // Check if recently visited (within last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: recentVisit } = await supabase
            .from('location_history')
            .select('id')
            .eq('user_id', userId)
            .eq('merchant_name', merchant.name)
            .gte('visited_at', thirtyMinutesAgo)
            .limit(1);

        if (recentVisit && recentVisit.length > 0) {
            console.log('Skipping log: Recently visited', merchant.name);
            return false; // Skipped
        }

        const { error } = await supabase.from('location_history').insert({
            user_id: userId,
            merchant_name: merchant.name,
            category: merchant.category,
            latitude: merchant.latitude,
            longitude: merchant.longitude,
            visited_at: new Date().toISOString(),
        });
        if (error) {
            console.error('Supabase insert error:', error.message);
            return false;
        } else {
            console.log('✅ Visit logged:', merchant.name);
            return true; // Logged successfully
        }
    } catch (error) {
        console.error('Failed to log visit:', error);
        return false;
    }
};

// Helper: Find best card
export const findBestCardForMerchant = async (userId: string, merchant: any) => {
    const { data: userCards } = await supabase
        .from('user_cards')
        .select(`
    credit_cards (
      name,
      rewards
    )
  `)
        .eq('user_id', userId);

    if (!userCards || userCards.length === 0) {
        return {
            found: true,
            no_cards: true,
            recommendation: {
                merchant_name: merchant.name,
                message: "Add cards to your wallet to get recommendations.",
            },
        };
    }

    let bestCard = null;
    let bestRate = 0;
    const categoryKey = merchant.category?.toLowerCase() || 'general';

    for (const uc of userCards) {
        const card = (uc as any).credit_cards;
        if (!card?.rewards) continue;

        const rewards = card.rewards;
        let rate = 0;

        // Check for category match
        if (rewards[categoryKey]) {
            rate = parseFloat(rewards[categoryKey]);
        } else if (rewards['everything']) {
            rate = parseFloat(rewards['everything']);
        } else if (rewards['general']) {
            rate = parseFloat(rewards['general']);
        }

        if (rate > bestRate) {
            bestRate = rate;
            bestCard = card;
        }
    }

    if (bestCard) {
        const rewardText = bestRate < 10 ? `${bestRate}% back` : `${bestRate}x points`;
        return {
            found: true,
            recommendation: {
                merchant_name: merchant.name,
                category: merchant.category,
                recommended_card: bestCard.name,
                reward_rate: rewardText,
                message: `Use ${bestCard.name} for ${rewardText}!`,
            },
        };
    }

    return { found: true, recommendation: { merchant_name: merchant.name, message: "Use your preferred card." } };
};

// Logic to check location and get recommendation
export const checkLocation = async (latitude: number, longitude: number, userId: string) => {
    // Prevent concurrent checks
    if (isCheckingLocation) {
        console.log('⏳ Location check already in progress, skipping...');
        return { found: false };
    }

    isCheckingLocation = true;

    try {
        // 1. Identify Merchant via Google Places (Dynamic)
        const merchant = await identifyMerchant(latitude, longitude);

        if (merchant) {
            // Log the visit - returns true if new visit, false if skipped
            const isNewVisit = await logVisit(userId, merchant);

            if (!isNewVisit) {
                return { found: false }; // Don't notify if recently visited
            }

            // Find best card for this dynamic merchant
            return await findBestCardForMerchant(userId, merchant);
        }

        return { found: false };
    } finally {
        isCheckingLocation = false;
    }
};

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error('Background location error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        const location = locations[0];

        if (location) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const result = await checkLocation(location.coords.latitude, location.coords.longitude, user.id);

                if (result?.found && 'recommendation' in result && !('no_cards' in result)) {
                    // Explicit check for undefined before accessing properties
                    const recommendation = (result as any).recommendation;
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `💳 ${recommendation.merchant_name}`,
                            body: recommendation.message,
                            sound: true,
                            priority: Notifications.AndroidNotificationPriority.HIGH,
                        },
                        trigger: null,
                    });
                }
            } catch (error) {
                console.error('Failed to check location:', error);
            }
        }
    }
});
