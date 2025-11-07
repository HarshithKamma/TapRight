import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationRecord } from './locationService';
import { VenueInfo, VenueCategory } from './venueCategorization';

export interface VisitRecord {
  id: string;
  locationRecord: LocationRecord;
  venueInfo: VenueInfo | null;
  arrivalTime: Date;
  departureTime?: Date;
  duration?: number; // in minutes
  confidence: number; // 0-1 confidence that this was a real visit
  visitType: 'confirmed' | 'likely' | 'possible';
}

export interface LocationStorageStats {
  totalVisits: number;
  visitsByCategory: Record<VenueCategory, number>;
  dateRange: { oldest: Date | null; newest: Date | null };
  averageVisitDuration: Record<VenueCategory, number>; // in minutes
  mostVisitedVenues: Array<{
    venue: VenueInfo;
    visitCount: number;
    totalDuration: number;
  }>;
}

class LocationDataStorageService {
  private readonly STORAGE_KEY = 'locationVisitData';
  private readonly RETENTION_DAYS = 35; // 5 weeks for analysis
  private readonly VISIT_THRESHOLD_METERS = 50; // 50 meters threshold for visit detection
  private readonly MIN_VISIT_DURATION_MINUTES = 2; // Minimum duration to count as a visit

  constructor() {
    this.initializeData();
  }

  // Initialize storage if needed
  private async initializeData(): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!existingData) {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error initializing location storage:', error);
    }
  }

  // Add a new location record and try to detect visits
  async addLocationRecord(
    locationRecord: LocationRecord,
    venueInfo: VenueInfo | null
  ): Promise<VisitRecord | null> {
    try {
      const visits = await this.getAllVisits();
      const newVisit = await this.detectVisit(locationRecord, venueInfo, visits);

      if (newVisit) {
        const updatedVisits = [...visits, newVisit];
        await this.saveVisits(updatedVisits);
        return newVisit;
      }

      return null;
    } catch (error) {
      console.error('Error adding location record:', error);
      return null;
    }
  }

  // Detect if a location record represents a visit
  private async detectVisit(
    locationRecord: LocationRecord,
    venueInfo: VenueInfo | null,
    existingVisits: VisitRecord[]
  ): Promise<VisitRecord | null> {
    const locationTime = new Date(locationRecord.timestamp);

    // Check if we're near an existing recent visit
    const recentVisit = this.findNearbyRecentVisit(
      locationRecord,
      existingVisits,
      this.VISIT_THRESHOLD_METERS,
      30 * 60 * 1000 // 30 minutes
    );

    if (recentVisit) {
      // Update existing visit
      recentVisit.departureTime = locationTime;
      if (recentVisit.arrivalTime) {
        recentVisit.duration = (locationTime.getTime() - recentVisit.arrivalTime.getTime()) / (1000 * 60);
      }
      return recentVisit;
    }

    // Check if this could be a new visit
    const isLikelyVisit = await this.isLikelyNewVisit(locationRecord, venueInfo);

    if (isLikelyVisit) {
      return {
        id: this.generateVisitId(),
        locationRecord,
        venueInfo,
        arrivalTime: locationTime,
        confidence: this.calculateVisitConfidence(locationRecord, venueInfo),
        visitType: venueInfo ? 'confirmed' : 'likely',
      };
    }

    return null;
  }

  // Find nearby recent visit
  private findNearbyRecentVisit(
    locationRecord: LocationRecord,
    visits: VisitRecord[],
    thresholdMeters: number,
    timeThresholdMs: number
  ): VisitRecord | null {
    const locationTime = new Date(locationRecord.timestamp);

    for (const visit of visits) {
      const timeDiff = Math.abs(locationTime.getTime() - visit.arrivalTime.getTime());

      if (timeDiff <= timeThresholdMs) {
        const distance = this.calculateDistance(
          locationRecord.latitude,
          locationRecord.longitude,
          visit.locationRecord.latitude,
          visit.locationRecord.longitude
        );

        if (distance <= thresholdMeters) {
          return visit;
        }
      }
    }

    return null;
  }

  // Check if this is likely a new visit
  private async isLikelyNewVisit(
    locationRecord: LocationRecord,
    venueInfo: VenueInfo | null
  ): Promise<boolean> {
    // If we have venue info, it's more likely to be a visit
    if (venueInfo && venueInfo.confidence > 0.6) {
      return true;
    }

    // Check if user has been in this area for a while
    const recentRecords = await this.getRecentLocationRecords(
      locationRecord.timestamp,
      5 * 60 * 1000 // 5 minutes
    );

    if (recentRecords.length >= 2) {
      // If we have multiple records in the same area, it's likely a visit
      const variance = this.calculateLocationVariance(recentRecords);
      return variance < 100; // Low variance means staying in one place
    }

    return false;
  }

  // Calculate visit confidence
  private calculateVisitConfidence(
    locationRecord: LocationRecord,
    venueInfo: VenueInfo | null
  ): number {
    let confidence = 0.5; // Base confidence

    if (venueInfo) {
      confidence += venueInfo.confidence * 0.3;

      // Higher confidence for certain categories
      if ([
        VenueCategory.RESTAURANT,
        VenueCategory.GROCERY,
        VenueCategory.GAS_STATION,
        VenueCategory.PHARMACY,
        VenueCategory.RETAIL_STORE
      ].includes(venueInfo.category)) {
        confidence += 0.1;
      }
    }

    // Consider location accuracy
    if (locationRecord.accuracy && locationRecord.accuracy < 20) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Get all visits
  async getAllVisits(): Promise<VisitRecord[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return [];
      }

      const visits = JSON.parse(data);
      return visits.map((visit: any) => ({
        ...visit,
        arrivalTime: new Date(visit.arrivalTime),
        departureTime: visit.departureTime ? new Date(visit.departureTime) : undefined,
        locationRecord: {
          ...visit.locationRecord,
          timestamp: new Date(visit.locationRecord.timestamp),
        },
        venueInfo: visit.venueInfo ? {
          ...visit.venueInfo,
          lastVerified: new Date(visit.venueInfo.lastVerified),
        } : null,
      }));
    } catch (error) {
      console.error('Error getting all visits:', error);
      return [];
    }
  }

  // Get visits within date range
  async getVisitsInDateRange(startDate: Date, endDate: Date): Promise<VisitRecord[]> {
    try {
      const allVisits = await this.getAllVisits();
      return allVisits.filter(visit => {
        const visitTime = new Date(visit.arrivalTime);
        return visitTime >= startDate && visitTime <= endDate;
      });
    } catch (error) {
      console.error('Error getting visits in date range:', error);
      return [];
    }
  }

  // Get recent location records
  async getRecentLocationRecords(
    beforeTime: Date | string,
    timeWindowMs: number
  ): Promise<LocationRecord[]> {
    try {
      const allVisits = await this.getAllVisits();
      const beforeDate = new Date(beforeTime);
      const cutoffTime = new Date(beforeDate.getTime() - timeWindowMs);

      return allVisits
        .filter(visit => {
          const visitTime = new Date(visit.arrivalTime);
          return visitTime >= cutoffTime && visitTime <= beforeDate;
        })
        .map(visit => visit.locationRecord);
    } catch (error) {
      console.error('Error getting recent location records:', error);
      return [];
    }
  }

  // Get visits by category
  async getVisitsByCategory(category: VenueCategory): Promise<VisitRecord[]> {
    try {
      const allVisits = await this.getAllVisits();
      return allVisits.filter(visit =>
        visit.venueInfo && visit.venueInfo.category === category
      );
    } catch (error) {
      console.error('Error getting visits by category:', error);
      return [];
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<LocationStorageStats> {
    try {
      const visits = await this.getAllVisits();
      const cleanedVisits = await this.cleanOldData(visits);

      // Calculate stats
      const visitsByCategory: Record<VenueCategory, number> = {} as any;
      const totalDurationByCategory: Record<VenueCategory, number> = {} as any;
      const venueVisitCounts = new Map<string, { venue: VenueInfo; count: number; duration: number }>();

      let oldest: Date | null = null;
      let newest: Date | null = null;

      cleanedVisits.forEach(visit => {
        // Date range
        const visitTime = new Date(visit.arrivalTime);
        if (!oldest || visitTime < oldest) oldest = visitTime;
        if (!newest || visitTime > newest) newest = visitTime;

        // Category stats
        if (visit.venueInfo) {
          const category = visit.venueInfo.category;
          visitsByCategory[category] = (visitsByCategory[category] || 0) + 1;

          const duration = visit.duration || 0;
          totalDurationByCategory[category] = (totalDurationByCategory[category] || 0) + duration;

          // Venue-specific stats
          const venueKey = visit.venueInfo.id;
          const existing = venueVisitCounts.get(venueKey);
          if (existing) {
            existing.count += 1;
            existing.duration += duration;
          } else {
            venueVisitCounts.set(venueKey, {
              venue: visit.venueInfo,
              count: 1,
              duration,
            });
          }
        }
      });

      // Calculate average durations
      const averageVisitDuration: Record<VenueCategory, number> = {} as any;
      Object.keys(visitsByCategory).forEach(category => {
        const categoryKey = category as VenueCategory;
        const totalVisits = visitsByCategory[categoryKey];
        const totalDuration = totalDurationByCategory[categoryKey] || 0;
        averageVisitDuration[categoryKey] = totalVisits > 0 ? totalDuration / totalVisits : 0;
      });

      // Get most visited venues
      const mostVisitedVenues = Array.from(venueVisitCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalVisits: cleanedVisits.length,
        visitsByCategory,
        dateRange: { oldest, newest },
        averageVisitDuration,
        mostVisitedVenues,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalVisits: 0,
        visitsByCategory: {} as any,
        dateRange: { oldest: null, newest: null },
        averageVisitDuration: {} as any,
        mostVisitedVenues: [],
      };
    }
  }

  // Clean old data based on retention policy
  async cleanOldData(visits?: VisitRecord[]): Promise<VisitRecord[]> {
    try {
      const allVisits = visits || await this.getAllVisits();
      const cutoffDate = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const filteredVisits = allVisits.filter(visit => {
        const visitTime = new Date(visit.arrivalTime);
        return visitTime >= cutoffDate;
      });

      if (filteredVisits.length < allVisits.length) {
        await this.saveVisits(filteredVisits);
        console.log(`Cleaned ${allVisits.length - filteredVisits.length} old visit records`);
      }

      return filteredVisits;
    } catch (error) {
      console.error('Error cleaning old data:', error);
      return visits || [];
    }
  }

  // Save visits to storage
  private async saveVisits(visits: VisitRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(visits));
    } catch (error) {
      console.error('Error saving visits:', error);
    }
  }

  // Update visit information
  async updateVisit(visitId: string, updates: Partial<VisitRecord>): Promise<boolean> {
    try {
      const visits = await this.getAllVisits();
      const visitIndex = visits.findIndex(v => v.id === visitId);

      if (visitIndex >= 0) {
        visits[visitIndex] = { ...visits[visitIndex], ...updates };
        await this.saveVisits(visits);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating visit:', error);
      return false;
    }
  }

  // Delete a visit
  async deleteVisit(visitId: string): Promise<boolean> {
    try {
      const visits = await this.getAllVisits();
      const filteredVisits = visits.filter(v => v.id !== visitId);

      if (filteredVisits.length < visits.length) {
        await this.saveVisits(filteredVisits);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error deleting visit:', error);
      return false;
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await this.initializeData();
      console.log('All location visit data cleared');
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  // Export data for backup
  async exportData(): Promise<string> {
    try {
      const visits = await this.getAllVisits();
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        version: '1.0',
        visits,
      }, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // Import data from backup
  async importData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.visits || !Array.isArray(data.visits)) {
        throw new Error('Invalid data format');
      }

      // Validate and transform visit data
      const validVisits: VisitRecord[] = data.visits
        .filter((visit: any) => visit.id && visit.arrivalTime && visit.locationRecord)
        .map((visit: any) => ({
          ...visit,
          arrivalTime: new Date(visit.arrivalTime),
          departureTime: visit.departureTime ? new Date(visit.departureTime) : undefined,
          locationRecord: {
            ...visit.locationRecord,
            timestamp: new Date(visit.locationRecord.timestamp),
          },
          venueInfo: visit.venueInfo ? {
            ...visit.venueInfo,
            lastVerified: new Date(visit.venueInfo.lastVerified),
          } : null,
        }));

      await this.saveVisits(validVisits);
      console.log(`Imported ${validVisits.length} visit records`);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // Utility: Calculate distance between two points (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Convert degrees to radians
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Calculate location variance
  private calculateLocationVariance(records: LocationRecord[]): number {
    if (records.length < 2) return 0;

    const latitudes = records.map(r => r.latitude);
    const longitudes = records.map(r => r.longitude);

    const latMean = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
    const lonMean = longitudes.reduce((sum, lon) => sum + lon, 0) / longitudes.length;

    const latVariance = latitudes.reduce((sum, lat) => sum + Math.pow(lat - latMean, 2), 0) / latitudes.length;
    const lonVariance = longitudes.reduce((sum, lon) => sum + Math.pow(lon - lonMean, 2), 0) / longitudes.length;

    return Math.sqrt(latVariance + lonVariance);
  }

  // Generate unique visit ID
  private generateVisitId(): string {
    return `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const locationDataStorageService = new LocationDataStorageService();
export default locationDataStorageService;