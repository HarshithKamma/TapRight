// Google Places API for merchant identification
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

interface PlaceResult {
    name: string;
    category: string;
    raw_category: string;
    address: string;
    latitude: number;
    longitude: number;
}

// Calculate distance between two coordinates in meters (Haversine formula)
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const identifyMerchant = async (latitude: number, longitude: number): Promise<PlaceResult | null> => {
    if (!GOOGLE_PLACES_API_KEY) {
        console.warn('Google Places API Key is missing');
        return null;
    }

    try {
        // Use Google Places Nearby Search API
        const radius = 200; // Search within 200 meters for demo
        const url = `https://places.googleapis.com/v1/places:searchNearby`;

        console.log('🔍 Querying Google Places at:', `${latitude.toFixed(5)},${longitude.toFixed(5)}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.primaryType'
            },
            body: JSON.stringify({
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: latitude,
                            longitude: longitude
                        },
                        radius: 80 // Precise radius (80m)
                    }
                },
                includedTypes: [
                    // Dining
                    "restaurant", "cafe", "coffee_shop", "bar", "fast_food_restaurant", "bakery", "ice_cream_shop", "sandwich_shop", "steak_house",
                    // Shopping
                    "supermarket", "grocery_store", "convenience_store", "clothing_store", "department_store", "electronics_store", "pharmacy", "drugstore", "shopping_mall", "store", "home_goods_store", "jewelry_store", "shoe_store", "furniture_store", "liquor_store", "gift_shop",
                    // Services/Ent
                    "gas_station", "gym", "spa", "bowling_alley",
                    // Travel
                    "hotel", "motel"
                ],
                maxResultCount: 20
            })
        });

        console.log('📡 Google Places response status:', response.status);

        const data: any = await response.json();

        if (data.error) {
            console.log('⚠️ Google Places API error:', data.error.message);
            return null;
        }

        if (data.places && data.places.length > 0) {
            console.log(`📍 Found ${data.places.length} places nearby:`);

            // Calculate distance to each place and sort by distance (closest first)
            const placesWithDistance = data.places.map((place: any) => {
                const placeLat = place.location?.latitude || latitude;
                const placeLon = place.location?.longitude || longitude;
                const distance = getDistanceInMeters(latitude, longitude, placeLat, placeLon);
                return { place, distance };
            }).sort((a: any, b: any) => a.distance - b.distance);

            // Log first 5 places with distances for debugging
            placesWithDistance.slice(0, 5).forEach((item: any, i: number) => {
                console.log(`   ${i + 1}. ${item.place.displayName?.text || 'Unknown'} - ${Math.round(item.distance)}m (${item.place.primaryType || 'no type'})`);
            });

            // Skip types that aren't useful for card recommendations
            const skipTypes = ['historical_landmark', 'landmark', 'park', 'transit_station',
                'bus_station', 'subway_station', 'train_station', 'parking',
                'point_of_interest', 'establishment', 'place_of_worship', 'church',
                'mosque', 'synagogue', 'temple', 'school', 'university', 'library',
                'museum', 'cemetery', 'government', 'courthouse', 'embassy',
                'locality', 'neighborhood', 'route', 'street_address', 'atm'];

            // Pick the CLOSEST place that's not a skip type
            let selectedItem = null;

            for (const item of placesWithDistance) {
                const placeType = item.place.primaryType || item.place.types?.[0] || '';

                // Skip if it's a skip type
                if (skipTypes.some(skip => placeType.toLowerCase().includes(skip))) {
                    continue;
                }

                // Select this place (it's the closest valid one)
                selectedItem = item;
                break;
            }

            // Fallback to the absolute closest if all are skip types
            if (!selectedItem && placesWithDistance.length > 0) {
                selectedItem = placesWithDistance[0];
            }

            if (selectedItem) {
                const selectedPlace = selectedItem.place;
                const category = mapCategory(selectedPlace.primaryType || selectedPlace.types?.[0] || '');
                console.log('✅ Using:', selectedPlace.displayName?.text, `(${Math.round(selectedItem.distance)}m)`, '| Category:', category);

                return {
                    name: selectedPlace.displayName?.text || 'Unknown Place',
                    category: category,
                    raw_category: selectedPlace.primaryType || selectedPlace.types?.[0] || '',
                    address: selectedPlace.formattedAddress || '',
                    latitude: selectedPlace.location?.latitude || latitude,
                    longitude: selectedPlace.location?.longitude || longitude,
                };
            }
        }

        console.log('❌ No places found nearby');
        return null;
    } catch (error: any) {
        console.log('Google Places API request failed:', error.message);
        return null;
    }
};

// Map Google Places types to TapRight categories
const mapCategory = (googleType: string): string => {
    const type = googleType.toLowerCase();

    // Dining (includes coffee shops like Dunkin, Starbucks)
    if (type.includes('restaurant') || type.includes('cafe') || type.includes('coffee') ||
        type.includes('bar') || type.includes('food') || type.includes('bakery') ||
        type.includes('meal') || type.includes('pizza') || type.includes('fast_food') ||
        type.includes('donut') || type.includes('doughnut') || type.includes('ice_cream')) {
        return 'dining';
    }

    // Groceries
    if (type.includes('grocery') || type.includes('supermarket') || type.includes('convenience') ||
        type.includes('market') || type.includes('food_store')) {
        return 'groceries';
    }

    // Gas
    if (type.includes('gas') || type.includes('fuel') || type.includes('petrol') ||
        type.includes('charging_station')) {
        return 'gas';
    }

    // Travel
    if (type.includes('hotel') || type.includes('airport') || type.includes('travel') ||
        type.includes('lodging') || type.includes('motel') || type.includes('resort')) {
        return 'travel';
    }

    // Shopping
    if (type.includes('store') || type.includes('shop') || type.includes('mall') ||
        type.includes('retail') || type.includes('pharmacy') || type.includes('drugstore')) {
        return 'shopping';
    }

    // Entertainment
    if (type.includes('theater') || type.includes('cinema') || type.includes('movie') ||
        type.includes('bowling') || type.includes('skating') || type.includes('rink') ||
        type.includes('amusement') || type.includes('entertainment') || type.includes('sports') ||
        type.includes('gym') || type.includes('fitness')) {
        return 'entertainment';
    }

    return 'general';
};
