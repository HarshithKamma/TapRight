const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface MapboxFeature {
    id: string;
    text: string; // Name of the place (e.g., "Starbucks")
    place_name: string; // Full address
    properties: {
        category?: string;
        maki?: string; // Icon name
    };
    context?: any[];
}

export const identifyMerchant = async (latitude: number, longitude: number) => {
    if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('Mapbox Access Token is missing');
        return null;
    }

    try {
        // Use Mapbox Geocoding with reverseMode=score to prioritize POIs by relevance
        const poiUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=poi&limit=10&reverseMode=score&access_token=${MAPBOX_ACCESS_TOKEN}`;
        console.log('🔍 Querying Mapbox at:', `${latitude.toFixed(5)},${longitude.toFixed(5)}`);

        const poiResponse = await fetch(poiUrl);
        console.log('📡 Mapbox response status:', poiResponse.status);

        const poiData: any = await poiResponse.json();

        // Debug: log raw response
        if (poiData.message) {
            console.log('⚠️ Mapbox API error:', poiData.message);
        }
        console.log('📦 Mapbox features count:', poiData.features?.length || 0);

        if (poiData.features && poiData.features.length > 0) {
            console.log(`📍 Found ${poiData.features.length} POIs nearby:`);

            // Log all POIs with their distances for debugging
            const poisWithDistance = poiData.features.map((feature: any) => {
                const poiLat = feature.center[1];
                const poiLon = feature.center[0];
                const distance = getDistanceInMeters(latitude, longitude, poiLat, poiLon);
                return { feature, distance };
            });

            // Sort by distance
            poisWithDistance.sort((a: any, b: any) => a.distance - b.distance);

            // Log top 3 for debugging
            poisWithDistance.slice(0, 3).forEach((item: any, i: number) => {
                console.log(`   ${i + 1}. ${item.feature.text} - ${Math.round(item.distance)}m (${item.feature.properties.category || 'no category'})`);
            });

            // Find closest POI within 500 meters (increased from 100m)
            const closest = poisWithDistance.find((item: any) => item.distance < 500);

            if (closest) {
                console.log('✅ Using:', closest.feature.text, '| Distance:', Math.round(closest.distance) + 'm');
                return {
                    name: closest.feature.text,
                    category: mapCategory(closest.feature.properties.category || closest.feature.properties.maki || ''),
                    raw_category: closest.feature.properties.category,
                    address: closest.feature.place_name,
                    latitude: closest.feature.center[1],
                    longitude: closest.feature.center[0],
                };
            } else {
                console.log('❌ All POIs are more than 500m away');
            }
        } else {
            console.log('❌ Mapbox returned no POIs');
        }

        return null;
    } catch (error) {
        console.log('Mapbox API request failed:', error);
        return null;
    }
};

// Calculate distance between two coordinates in meters using Haversine formula
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Map Mapbox categories to TapRight categories
const mapCategory = (mapboxCategory: string): string => {
    const cat = mapboxCategory.toLowerCase();

    if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('bar') || cat.includes('food') || cat.includes('coffee')) {
        return 'dining';
    }
    if (cat.includes('grocery') || cat.includes('supermarket') || cat.includes('bakery')) {
        return 'groceries';
    }
    if (cat.includes('gas') || cat.includes('fuel') || cat.includes('station')) {
        return 'gas';
    }
    if (cat.includes('hotel') || cat.includes('airport') || cat.includes('travel')) {
        return 'travel';
    }

    return 'general'; // Default fallback
};
