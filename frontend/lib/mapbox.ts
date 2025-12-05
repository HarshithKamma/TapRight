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
        // 1. Try to find a POI (Point of Interest) first
        // This ensures we get "Chevron" instead of "Mason St" if both are valid
        // limit=5 allows us to find the POI even if it's slightly further than the street center
        const poiUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=poi&limit=5&access_token=${MAPBOX_ACCESS_TOKEN}`;
        console.log('🔍 Querying Mapbox (POI):', `${longitude},${latitude}`);

        const poiResponse = await fetch(poiUrl);
        const poiData: any = await poiResponse.json();

        if (poiData.features && poiData.features.length > 0) {
            const feature = poiData.features[0];
            console.log('✅ Mapbox found POI:', feature.text, '| Category:', feature.properties.category);
            return {
                name: feature.text,
                category: mapCategory(feature.properties.category || feature.properties.maki || ''),
                raw_category: feature.properties.category,
                address: feature.place_name,
                latitude: feature.center[1],
                longitude: feature.center[0],
            };
        }

        // 2. Fallback to Address if no POI found
        const addressUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=address&limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
        console.log('🔍 Querying Mapbox (Address):', `${longitude},${latitude}`);

        const addressResponse = await fetch(addressUrl);
        const addressData: any = await addressResponse.json();

        if (addressData.features && addressData.features.length > 0) {
            const feature = addressData.features[0];
            console.log('✅ Mapbox found Address:', feature.text);
            return {
                name: feature.text,
                category: 'general', // Addresses are always general
                raw_category: 'address',
                address: feature.place_name,
                latitude: feature.center[1],
                longitude: feature.center[0],
            };
        }

        console.log('❌ Mapbox found no features');
        return null;
    } catch (error) {
        // Log quietly to avoid spamming the bridge during network issues
        console.log('Mapbox API request failed (likely network issue)');
        return null;
    }
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
