import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationRecord {
  id: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationTrackingConfig {
  enableBackgroundTracking: boolean;
  trackingInterval: number; // milliseconds
  desiredAccuracy: Location.Accuracy;
  showsUserLocation: boolean;
  pausesLocationUpdatesAutomatically: boolean;
  activityType: Location.ActivityType;
}

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking: boolean = false;
  private lastKnownLocation: Location.LocationObject | null = null;
  private config: LocationTrackingConfig;

  constructor() {
    this.config = {
      enableBackgroundTracking: true,
      trackingInterval: 30000, // 30 seconds default
      desiredAccuracy: Location.Accuracy.Balanced,
      showsUserLocation: true,
      pausesLocationUpdatesAutomatically: true,
      activityType: Location.ActivityType.Other,
    };
  }

  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        console.log('Background location permission denied');
        // Still allow foreground tracking
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  // Check if location services are enabled
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled;
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  // Get current location once
  async getCurrentLocation(options?: {
    desiredAccuracy?: Location.Accuracy;
    maximumAge?: number;
    timeout?: number;
  }): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      const isEnabled = await this.isLocationServicesEnabled();
      if (!isEnabled) {
        throw new Error('Location services are disabled');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: options?.desiredAccuracy || this.config.desiredAccuracy,
        maximumAge: options?.maximumAge || 10000, // 10 seconds
        timeout: options?.timeout || 15000, // 15 seconds
      });

      this.lastKnownLocation = location;
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Start location tracking
  async startLocationTracking(config?: Partial<LocationTrackingConfig>): Promise<boolean> {
    try {
      if (this.isTracking) {
        console.log('Location tracking already started');
        return true;
      }

      // Update config if provided
      if (config) {
        this.config = { ...this.config, ...config };
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      const isEnabled = await this.isLocationServicesEnabled();
      if (!isEnabled) {
        throw new Error('Location services are disabled');
      }

      // Start location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.desiredAccuracy,
          timeInterval: this.config.trackingInterval,
          distanceInterval: 10, // 10 meters
          showsUserLocation: this.config.showsUserLocation,
          pausesLocationUpdatesAutomatically: this.config.pausesLocationUpdatesAutomatically,
          activityType: this.config.activityType,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      this.isTracking = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  // Stop location tracking
  async stopLocationTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  // Handle location updates
  private handleLocationUpdate(location: Location.LocationObject): void {
    this.lastKnownLocation = location;

    // Create location record
    const locationRecord: LocationRecord = {
      id: this.generateLocationId(),
      timestamp: new Date(location.timestamp),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude || undefined,
      altitudeAccuracy: location.coords.altitudeAccuracy || undefined,
      heading: location.coords.heading || undefined,
      speed: location.coords.speed || undefined,
    };

    // Store location record
    this.storeLocationRecord(locationRecord);

    // Emit location update event (for other parts of the app)
    this.emitLocationUpdate(locationRecord);
  }

  // Store location record locally
  private async storeLocationRecord(record: LocationRecord): Promise<void> {
    try {
      const existingRecords = await this.getLocationRecords();
      const updatedRecords = [...existingRecords, record];

      // Keep only last 30 days of records to manage storage
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const filteredRecords = updatedRecords.filter(
        r => new Date(r.timestamp) > thirtyDaysAgo
      );

      await AsyncStorage.setItem('locationRecords', JSON.stringify(filteredRecords));
    } catch (error) {
      console.error('Error storing location record:', error);
    }
  }

  // Get stored location records
  async getLocationRecords(): Promise<LocationRecord[]> {
    try {
      const records = await AsyncStorage.getItem('locationRecords');
      if (!records) {
        return [];
      }

      const parsedRecords = JSON.parse(records);
      return parsedRecords.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp),
      }));
    } catch (error) {
      console.error('Error getting location records:', error);
      return [];
    }
  }

  // Get location records within date range
  async getLocationRecordsInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<LocationRecord[]> {
    try {
      const allRecords = await this.getLocationRecords();
      return allRecords.filter(
        record => {
          const recordDate = new Date(record.timestamp);
          return recordDate >= startDate && recordDate <= endDate;
        }
      );
    } catch (error) {
      console.error('Error getting location records in date range:', error);
      return [];
    }
  }

  // Get last known location
  getLastKnownLocation(): Location.LocationObject | null {
    return this.lastKnownLocation;
  }

  // Check if currently tracking
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  // Generate unique location ID
  private generateLocationId(): string {
    return `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Emit location update (simplified event system)
  private emitLocationUpdate(record: LocationRecord): void {
    // In a real implementation, you might use an event emitter
    // For now, we'll store the latest location for other components to check
    AsyncStorage.setItem('lastLocationUpdate', JSON.stringify(record));
  }

  // Get the latest location update
  async getLatestLocationUpdate(): Promise<LocationRecord | null> {
    try {
      const lastUpdate = await AsyncStorage.getItem('lastLocationUpdate');
      if (!lastUpdate) {
        return null;
      }

      const record = JSON.parse(lastUpdate);
      return {
        ...record,
        timestamp: new Date(record.timestamp),
      };
    } catch (error) {
      console.error('Error getting latest location update:', error);
      return null;
    }
  }

  // Clear all location data
  async clearLocationData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('locationRecords');
      await AsyncStorage.removeItem('lastLocationUpdate');
      console.log('Location data cleared');
    } catch (error) {
      console.error('Error clearing location data:', error);
    }
  }

  // Get location tracking statistics
  async getLocationStats(): Promise<{
    totalRecords: number;
    dateRange: { oldest: Date | null; newest: Date | null };
    isTracking: boolean;
  }> {
    try {
      const records = await this.getLocationRecords();
      const totalRecords = records.length;

      let oldest: Date | null = null;
      let newest: Date | null = null;

      if (records.length > 0) {
        const dates = records.map(r => new Date(r.timestamp));
        oldest = new Date(Math.min(...dates.map(d => d.getTime())));
        newest = new Date(Math.max(...dates.map(d => d.getTime())));
      }

      return {
        totalRecords,
        dateRange: { oldest, newest },
        isTracking: this.isTracking,
      };
    } catch (error) {
      console.error('Error getting location stats:', error);
      return {
        totalRecords: 0,
        dateRange: { oldest: null, newest: null },
        isTracking: false,
      };
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;