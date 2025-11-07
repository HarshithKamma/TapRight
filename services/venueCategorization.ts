import { LocationRecord } from './locationService';

export enum VenueCategory {
  GAS_STATION = 'gas_station',
  RESTAURANT = 'restaurant',
  BAR = 'bar',
  LIQUOR_STORE = 'liquor_store',
  PHARMACY = 'pharmacy',
  GROCERY = 'grocery',
  COFFEE_SHOP = 'coffee_shop',
  MALL = 'mall',
  RETAIL_STORE = 'retail_store',
  ELECTRONICS_STORE = 'electronics_store',
  CLOTHING_STORE = 'clothing_store',
  UNKNOWN = 'unknown',
}

export interface VenueInfo {
  id: string;
  name: string;
  category: VenueCategory;
  address?: string;
  latitude: number;
  longitude: number;
  confidence: number; // 0-1 confidence level in categorization
  dataSource: 'osm' | 'foursquare' | 'fallback' | 'manual';
  lastVerified: Date;
}

export interface CategorizationResult {
  venue: VenueInfo | null;
  confidence: number;
  alternatives?: VenueInfo[];
}

// Category keywords for fallback categorization
const CATEGORY_KEYWORDS = {
  [VenueCategory.GAS_STATION]: [
    'gas', 'station', 'petrol', 'fuel', 'shell', 'chevron', 'bp', 'exxon',
    'mobil', 'sunoco', ' Speedway', 'wawa', 'circle k', 'kum & go'
  ],
  [VenueCategory.RESTAURANT]: [
    'restaurant', 'diner', 'cafe', 'bistro', 'eatery', 'grill', 'steakhouse',
    'pizza', 'burger', 'taco', 'mcdonald', 'wendy', 'burger king', 'kfc',
    'subway', 'chipotle', 'panera', 'olive garden', 'chili'
  ],
  [VenueCategory.BAR]: [
    'bar', 'pub', 'tavern', 'lounge', 'nightclub', 'saloon', 'brewery',
    'sports bar', 'cocktail', 'wine bar'
  ],
  [VenueCategory.LIQUOR_STORE]: [
    'liquor', 'alcohol', 'wine', 'spirits', 'beverage', 'beverage depot',
    'total wine', 'spec', 'abc store', 'package store'
  ],
  [VenueCategory.PHARMACY]: [
    'pharmacy', 'drugstore', 'medication', 'prescription', 'walgreens',
    'cvs', 'rite aid', 'pharmaca', 'medicine'
  ],
  [VenueCategory.GROCERY]: [
    'grocery', 'supermarket', 'food store', 'market', 'kroger', 'safeway',
    'whole foods', 'trader joe', 'albertson', 'publix', 'food lion'
  ],
  [VenueCategory.COFFEE_SHOP]: [
    'coffee', 'starbucks', 'dunkin', 'caribou', 'peet', 'espresso',
    'café', 'coffee house'
  ],
  [VenueCategory.MALL]: [
    'mall', 'shopping center', 'shopping mall', 'outlet', 'plaza',
    'galleria', 'center'
  ],
  [VenueCategory.RETAIL_STORE]: [
    'store', 'shop', 'retail', 'target', 'walmart', 'costco', 'sam',
    'bj', 'home depot', 'lowe', 'best buy'
  ],
  [VenueCategory.ELECTRONICS_STORE]: [
    'electronics', 'best buy', 'fry', 'micro center', 'radio shack',
    'apple store', 'samsung', 'gamestop', 'electronics store'
  ],
  [VenueCategory.CLOTHING_STORE]: [
    'clothing', 'apparel', 'fashion', 'gap', 'old navy', 'banana republic',
    'nike', 'adidas', 'h&m', 'zara', 'forever 21', 'macys', 'nordstrom',
    'kohl', 'jcpenney'
  ],
};

class VenueCategorizationService {
  private cache: Map<string, VenueInfo> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.loadCacheFromStorage();
  }

  // Categorize venue based on location
  async categorizeVenue(
    latitude: number,
    longitude: number,
    options?: {
      radius?: number; // search radius in meters
      includeConfidence?: boolean;
    }
  ): Promise<CategorizationResult> {
    const radius = options?.radius || 100; // 100 meters default
    const includeConfidence = options?.includeConfidence ?? true;

    // Check cache first
    const cacheKey = this.generateCacheKey(latitude, longitude, radius);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Try multiple data sources in order
      let venueInfo: VenueInfo | null = null;

      // 1. Try OpenStreetMap (free)
      venueInfo = await this.getVenueFromOpenStreetMap(latitude, longitude, radius);

      // 2. Try Foursquare (free tier)
      if (!venueInfo) {
        venueInfo = await this.getVenueFromFoursquare(latitude, longitude, radius);
      }

      // 3. Use fallback categorization based on coordinates
      if (!venueInfo) {
        venueInfo = await this.getVenueFromFallback(latitude, longitude);
      }

      const result: CategorizationResult = {
        venue: venueInfo,
        confidence: venueInfo?.confidence || 0.1,
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error categorizing venue:', error);
      return {
        venue: null,
        confidence: 0,
      };
    }
  }

  // Get venue from OpenStreetMap (Nominatim API)
  private async getVenueFromOpenStreetMap(
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<VenueInfo | null> {
    try {
      const query = `
        [out:json][timeout:15];
        (
          node["name"](around:${radius},${latitude},${longitude});
          way["name"](around:${radius},${latitude},${longitude});
          relation["name"](around:${radius},${latitude},${longitude});
        );
        out tags;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error('OSM API request failed');
      }

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const element = data.elements[0];
        const tags = element.tags || {};

        const category = this.categorizeFromTags(tags);
        const confidence = this.calculateConfidence(tags, category);

        return {
          id: element.id.toString(),
          name: tags.name || 'Unknown Venue',
          category,
          address: this.formatAddress(tags),
          latitude: element.lat || element.center?.lat || latitude,
          longitude: element.lon || element.center?.lon || longitude,
          confidence,
          dataSource: 'osm',
          lastVerified: new Date(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching from OpenStreetMap:', error);
      return null;
    }
  }

  // Get venue from Foursquare (simplified implementation)
  private async getVenueFromFoursquare(
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<VenueInfo | null> {
    // Note: This is a simplified implementation
    // In production, you would use Foursquare API with proper authentication
    try {
      // For demo purposes, we'll skip Foursquare integration
      // as it requires API keys and more complex setup
      return null;
    } catch (error) {
      console.error('Error fetching from Foursquare:', error);
      return null;
    }
  }

  // Fallback categorization based on reverse geocoding
  private async getVenueFromFallback(
    latitude: number,
    longitude: number
  ): Promise<VenueInfo | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TapRight/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = await response.json();
      const address = data.address || {};

      // Extract venue name from address components
      const venueName = address.building || address.amenity || address.shop ||
                      address.tourism || 'Unknown Location';

      const category = this.categorizeFromAddress(address);
      const confidence = this.calculateFallbackConfidence(address, category);

      return {
        id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: venueName,
        category,
        address: data.display_name,
        latitude,
        longitude,
        confidence,
        dataSource: 'fallback',
        lastVerified: new Date(),
      };
    } catch (error) {
      console.error('Error in fallback categorization:', error);
      return {
        id: `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Unknown Location',
        category: VenueCategory.UNKNOWN,
        latitude,
        longitude,
        confidence: 0.1,
        dataSource: 'fallback',
        lastVerified: new Date(),
      };
    }
  }

  // Categorize based on OSM tags
  private categorizeFromTags(tags: any): VenueCategory {
    const shop = tags.shop;
    const amenity = tags.amenity;
    const tourism = tags.tourism;
    const building = tags.building;

    // Check specific tags
    if (shop) {
      const shopLower = shop.toLowerCase();
      if (shopLower.includes('supermarket') || shopLower.includes('grocery')) {
        return VenueCategory.GROCERY;
      }
      if (shopLower.includes('clothes') || shopLower.includes('fashion')) {
        return VenueCategory.CLOTHING_STORE;
      }
      if (shopLower.includes('electronics') || shopLower.includes('computer')) {
        return VenueCategory.ELECTRONICS_STORE;
      }
      if (shopLower.includes('alcohol') || shopLower.includes('beverages')) {
        return VenueCategory.LIQUOR_STORE;
      }
      if (shopLower.includes('coffee')) {
        return VenueCategory.COFFEE_SHOP;
      }
    }

    if (amenity) {
      const amenityLower = amenity.toLowerCase();
      if (amenityLower.includes('restaurant') || amenityLower.includes('food')) {
        return VenueCategory.RESTAURANT;
      }
      if (amenityLower.includes('bar') || amenityLower.includes('pub')) {
        return VenueCategory.BAR;
      }
      if (amenityLower.includes('pharmacy')) {
        return VenueCategory.PHARMACY;
      }
      if (amenityLower.includes('fuel') || amenityLower.includes('gas_station')) {
        return VenueCategory.GAS_STATION;
      }
      if (amenityLower.includes('cafe')) {
        return VenueCategory.COFFEE_SHOP;
      }
    }

    // Fallback to keyword matching on all tags
    const allTags = Object.values(tags).join(' ').toLowerCase();
    return this.categorizeByKeywords(allTags);
  }

  // Categorize based on address components
  private categorizeFromAddress(address: any): VenueCategory {
    const allComponents = Object.values(address).join(' ').toLowerCase();
    return this.categorizeByKeywords(allComponents);
  }

  // Categorize using keyword matching
  private categorizeByKeywords(text: string): VenueCategory {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return category as VenueCategory;
        }
      }
    }
    return VenueCategory.UNKNOWN;
  }

  // Calculate confidence score for OSM data
  private calculateConfidence(tags: any, category: VenueCategory): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if we have specific category tags
    if (tags.shop || tags.amenity || tags.tourism) {
      confidence += 0.2;
    }

    // Higher confidence if we have a name
    if (tags.name) {
      confidence += 0.2;
    }

    // Lower confidence if category is unknown
    if (category === VenueCategory.UNKNOWN) {
      confidence -= 0.3;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Calculate confidence for fallback categorization
  private calculateFallbackConfidence(address: any, category: VenueCategory): number {
    let confidence = 0.3; // Lower base confidence for fallback

    if (address.road || address.building) {
      confidence += 0.1;
    }

    if (category !== VenueCategory.UNKNOWN) {
      confidence += 0.2;
    }

    return Math.max(0.1, Math.min(0.7, confidence));
  }

  // Format address from OSM tags
  private formatAddress(tags: any): string | undefined {
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'],
      tags['addr:state'],
      tags['addr:postcode']
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  // Generate cache key
  private generateCacheKey(latitude: number, longitude: number, radius: number): string {
    // Round coordinates to create cache buckets
    const latRounded = Math.round(latitude * 10000) / 10000;
    const lonRounded = Math.round(longitude * 10000) / 10000;
    return `${latRounded},${lonRounded},${radius}`;
  }

  // Get cached result
  private getCachedResult(cacheKey: string): CategorizationResult | null {
    const cached = this.cache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (cached && expiry && expiry > new Date()) {
      return { venue: cached, confidence: cached.confidence };
    }

    // Remove expired cache entry
    if (cached && expiry) {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }

    return null;
  }

  // Cache result
  private cacheResult(cacheKey: string, result: CategorizationResult): void {
    if (result.venue) {
      this.cache.set(cacheKey, result.venue);
      this.cacheExpiry.set(cacheKey, new Date(Date.now() + this.CACHE_DURATION));

      // Also save to persistent storage
      this.saveCacheToStorage();
    }
  }

  // Load cache from storage
  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cachedData = await AsyncStorage.getItem('venueCache');
      if (cachedData) {
        const { venues, expiry } = JSON.parse(cachedData);

        this.cache = new Map(Object.entries(venues));
        this.cacheExpiry = new Map(Object.entries(expiry).map(([k, v]) => [k, new Date(v)]));

        // Clean expired entries
        this.cleanExpiredCache();
      }
    } catch (error) {
      console.error('Error loading venue cache:', error);
    }
  }

  // Save cache to storage
  private async saveCacheToStorage(): Promise<void> {
    try {
      const venues = Object.fromEntries(this.cache);
      const expiry = Object.fromEntries(this.cacheExpiry);

      await AsyncStorage.setItem('venueCache', JSON.stringify({
        venues,
        expiry,
      }));
    } catch (error) {
      console.error('Error saving venue cache:', error);
    }
  }

  // Clean expired cache entries
  private cleanExpiredCache(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    }
  }

  // Get all known venues
  async getKnownVenues(): Promise<VenueInfo[]> {
    return Array.from(this.cache.values());
  }

  // Update venue category manually (for user corrections)
  async updateVenueCategory(
    venueId: string,
    newCategory: VenueCategory
  ): Promise<boolean> {
    try {
      // Find and update the venue in cache
      for (const [key, venue] of this.cache.entries()) {
        if (venue.id === venueId) {
          venue.category = newCategory;
          venue.confidence = 1.0; // Manual updates have highest confidence
          venue.dataSource = 'manual';
          venue.lastVerified = new Date();

          await this.saveCacheToStorage();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error updating venue category:', error);
      return false;
    }
  }

  // Clear cache
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheExpiry.clear();
    await AsyncStorage.removeItem('venueCache');
  }
}

// Export singleton instance
export const venueCategorizationService = new VenueCategorizationService();
export default venueCategorizationService;