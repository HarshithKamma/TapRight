import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { identifyMerchant } from './mapbox';

export const LOCATION_TASK_NAME = 'background-location-task';

// Configure notification handler (can be called multiple times safely, but good to have here)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Helper to log visit
export const logVisit = async (userId: string, merchant: any) => {
    try {
        // 1. Check for recent visit (last 1 hour) to avoid spam
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentVisits } = await supabase
            .from('location_history')
            .select('id')
            .eq('user_id', userId)
            .eq('merchant_name', merchant.name)
            .gte('visited_at', oneHourAgo)
            .limit(1);

        if (recentVisits && recentVisits.length > 0) {
            console.log('Skipping log: Recently visited', merchant.name);
            return;
        }

        // 2. Insert new visit
        const { error } = await supabase
            .from('location_history')
            .insert({
                user_id: userId,
                merchant_name: merchant.name,
                category: merchant.category,
                latitude: merchant.latitude,
                longitude: merchant.longitude,
            });

        if (error) {
            console.error('Supabase insert error:', error);
        } else {
            console.log('✅ Visit logged:', merchant.name);
        }
    } catch (error) {
        console.error('Failed to log visit:', error);
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
                message: "Add cards to get rewards!"
            }
        };
    }

    // Find best card
    let bestCard: any = null;
    let maxRate = 0;
    const category = (merchant.category || 'general').toLowerCase();

    userCards.forEach((item: any) => {
        const card = item.credit_cards;
        const rewards = card.rewards || {};
        // Check specific category, then 'everything' or 'general'
        const rate = rewards[category] || rewards['everything'] || rewards['general'] || 1;

        if (rate > maxRate) {
            maxRate = rate;
            bestCard = card;
        }
    });

    if (bestCard) {
        return {
            found: true,
            recommendation: {
                merchant_name: merchant.name,
                message: `Use ${bestCard.name} for ${maxRate}% back!`
            }
        };
    }

    return { found: true, recommendation: { merchant_name: merchant.name, message: "Use your preferred card." } };
};

// Logic to check location and get recommendation
export const checkLocation = async (latitude: number, longitude: number, userId: string) => {
    // 1. Identify Merchant via Mapbox (Dynamic)
    const mapboxMerchant = await identifyMerchant(latitude, longitude);

    if (mapboxMerchant) {
        // Log the visit
        await logVisit(userId, mapboxMerchant);

        // Find best card for this dynamic merchant
        return await findBestCardForMerchant(userId, mapboxMerchant);
    }

    return { found: false };
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
