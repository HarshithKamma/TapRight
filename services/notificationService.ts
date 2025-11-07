import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService, LocationRecord } from './locationService';
import { venueCategorizationService, VenueInfo, VenueCategory } from './venueCategorization';
import { cardRecommendationService } from './cardRecommendation';
import { CREDIT_CARDS } from '../data/creditCards';

export interface NotificationPreferences {
  enabled: boolean;
  locationRecommendations: boolean;
  weeklyInsights: boolean;
  newCardRecommendations: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  maxNotificationsPerDay: number;
}

export interface NotificationContext {
  userId: string;
  currentLocation?: LocationRecord;
  currentVenue?: VenueInfo;
  userCards: string[]; // Card IDs
  userPreferences: NotificationPreferences;
}

export interface SmartNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  category: 'location' | 'insight' | 'recommendation' | 'system';
  scheduledTime?: Date;
  trigger?: Notifications.NotificationTriggerInput;
}

class NotificationService {
  private preferences: NotificationPreferences = {
    enabled: true,
    locationRecommendations: true,
    weeklyInsights: true,
    newCardRecommendations: true,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
    maxNotificationsPerDay: 5,
  };

  private dailyNotificationCount: number = 0;
  private lastNotificationDate: string = '';

  constructor() {
    this.initializeNotifications();
    this.loadPreferences();
  }

  // Initialize notification system
  private async initializeNotifications(): Promise<void> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: this.preferences.enabled,
          shouldSetBadge: true,
        }),
      });

      // Listen for notification responses
      Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse.bind(this));
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  // Load user preferences
  private async loadPreferences(): Promise<void> {
    try {
      const prefs = await AsyncStorage.getItem('notificationPreferences');
      if (prefs) {
        this.preferences = { ...this.preferences, ...JSON.parse(prefs) };
      }

      // Load daily count
      const today = new Date().toDateString();
      const count = await AsyncStorage.getItem('dailyNotificationCount');
      const date = await AsyncStorage.getItem('lastNotificationDate');

      if (date === today) {
        this.dailyNotificationCount = parseInt(count || '0', 10);
        this.lastNotificationDate = date;
      } else {
        // Reset count for new day
        this.dailyNotificationCount = 0;
        this.lastNotificationDate = today;
        await AsyncStorage.setItem('dailyNotificationCount', '0');
        await AsyncStorage.setItem('lastNotificationDate', today);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  }

  // Save preferences
  async savePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      this.preferences = { ...this.preferences, ...preferences };
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    }
  }

  // Check if we can send notifications now
  private canSendNotification(): boolean {
    if (!this.preferences.enabled) {
      return false;
    }

    // Check daily limit
    if (this.dailyNotificationCount >= this.preferences.maxNotificationsPerDay) {
      return false;
    }

    // Check quiet hours
    if (this.preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = this.preferences.quietHours;

      if (this.isTimeInRange(currentTime, start, end)) {
        return false;
      }
    }

    return true;
  }

  // Check if time is in range (handles overnight ranges)
  private isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    if (startMinutes <= endMinutes) {
      // Normal range (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 08:00 next day)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  // Convert time string to minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Send notification
  async sendNotification(notification: SmartNotification): Promise<boolean> {
    try {
      if (!this.canSendNotification()) {
        console.log('Cannot send notification - limits or quiet hours');
        return false;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: notification.priority,
        },
        trigger: notification.trigger || null,
        identifier: notification.id,
      });

      // Update daily count
      this.dailyNotificationCount++;
      await AsyncStorage.setItem('dailyNotificationCount', this.dailyNotificationCount.toString());

      console.log(`Notification sent: ${notification.title}`);
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  // Location-based notification
  async sendLocationBasedNotification(
    venue: VenueInfo,
    userCards: string[] = []
  ): Promise<void> {
    try {
      if (!this.preferences.locationRecommendations) {
        return;
      }

      // Find best card for this venue
      const bestCard = this.findBestCardForVenue(venue, userCards);
      const cardName = bestCard?.name || 'a rewards card';

      const notification: SmartNotification = {
        id: `location_${Date.now()}`,
        title: `💳 Card Suggestion`,
        body: `Use your ${cardName} at ${venue.name} for ${this.getRewardsRate(bestCard, venue.category)}% back!`,
        data: {
          type: 'location_recommendation',
          venueId: venue.id,
          venueName: venue.name,
          category: venue.category,
          cardId: bestCard?.id,
        },
        priority: 'high',
        category: 'location',
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Error sending location notification:', error);
    }
  }

  // Weekly insights notification
  async sendWeeklyInsights(spendingData: any, recommendations: any[]): Promise<void> {
    try {
      if (!this.preferences.weeklyInsights) {
        return;
      }

      const totalSpending = spendingData.totalEstimatedMonthlySpend;
      const topCategory = spendingData.highSpendingCategories[0];
      const potentialSavings = recommendations.reduce((sum: number, rec: any) => sum + rec.estimatedSavings, 0);

      const notification: SmartNotification = {
        id: `weekly_${Date.now()}`,
        title: '📊 Your Weekly Insights',
        body: `This week: $${totalSpending.toFixed(0)} spending, ${
          potentialSavings > 0 ? `$${potentialSavings.toFixed(0)} potential savings` : 'check your recommendations'
        }`,
        data: {
          type: 'weekly_insights',
          spending: totalSpending,
          savings: potentialSavings,
        },
        priority: 'normal',
        category: 'insight',
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Error sending weekly insights:', error);
    }
  }

  // New card recommendation notification
  async sendNewCardRecommendation(card: any, reason: string): Promise<void> {
    try {
      if (!this.preferences.newCardRecommendations) {
        return;
      }

      const notification: SmartNotification = {
        id: `card_${Date.now()}`,
        title: `🎯 New Card Recommendation`,
        body: `${reason}: ${card.name} could save you $${card.estimatedSavings}/year`,
        data: {
          type: 'card_recommendation',
          cardId: card.id,
          cardName: card.name,
          savings: card.estimatedSavings,
        },
        priority: 'normal',
        category: 'recommendation',
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Error sending card recommendation:', error);
    }
  }

  // Find best card for venue
  private findBestCardForVenue(venue: VenueInfo, userCards: string[]): any {
    const availableCards = CREDIT_CARDS.filter(card =>
      !userCards.includes(card.id)
    );

    // Sort by rewards rate for this category
    return availableCards
      .sort((a, b) => {
        const aRate = a.rewards.categoryRates[venue.category] || a.rewards.baseRate;
        const bRate = b.rewards.categoryRates[venue.category] || b.rewards.baseRate;
        return bRate - aRate;
      })[0];
  }

  // Get rewards rate for card and category
  private getRewardsRate(card: any, category: VenueCategory): number {
    if (!card) return 0;
    const rate = card.rewards.categoryRates[category] || card.rewards.baseRate;
    return Math.round(rate * 100);
  }

  // Handle notification response
  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { data } = response.notification.request.content;

      switch (data.type) {
        case 'location_recommendation':
          // Navigate to card details or dashboard
          console.log('Location recommendation tapped');
          break;
        case 'weekly_insights':
          // Navigate to insights screen
          console.log('Weekly insights tapped');
          break;
        case 'card_recommendation':
          // Navigate to card details
          console.log('Card recommendation tapped');
          break;
        default:
          console.log('Notification tapped:', data.type);
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

  // Schedule notification for later
  async scheduleNotification(notification: SmartNotification, scheduledTime: Date): Promise<void> {
    try {
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledTime,
      };

      const scheduledNotification = {
        ...notification,
        trigger,
      };

      await this.sendNotification(scheduledNotification);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  // Cancel scheduled notification
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`Notification cancelled: ${notificationId}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Get notification preferences
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // Get daily notification count
  getDailyNotificationCount(): number {
    return this.dailyNotificationCount;
  }

  // Reset daily notification count
  async resetDailyCount(): Promise<void> {
    this.dailyNotificationCount = 0;
    this.lastNotificationDate = new Date().toDateString();
    await AsyncStorage.setItem('dailyNotificationCount', '0');
    await AsyncStorage.setItem('lastNotificationDate', this.lastNotificationDate);
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  // Test notification
  async sendTestNotification(): Promise<void> {
    const notification: SmartNotification = {
      id: `test_${Date.now()}`,
      title: '🧪 Test Notification',
      body: 'This is a test notification from TapRight!',
      data: {
        type: 'test',
      },
      priority: 'normal',
      category: 'system',
    };

    await this.sendNotification(notification);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;