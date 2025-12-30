/**
 * VietMap Route Tracking Demo - Configuration
 *
 * Contains application configuration settings
 */

var Config = {
    // VietMap API Keys - Replace with your API keys
    // Register at: https://maps.vietmap.vn/console/register
    API_KEYS: {
        // API key for Map Tiles/Styles
        TILEMAP: 'YOUR_TILEMAP_API_KEY',
        // API key for Routing API
        ROUTE: 'YOUR_ROUTE_API_KEY'
    },

    // Map Settings
    MAP: {
        // Default location (Ho Chi Minh City)
        DEFAULT_CENTER: [106.7009, 10.7769],
        DEFAULT_ZOOM: 13,
        MIN_ZOOM: 5,
        MAX_ZOOM: 18
    },

    // Routing Settings
    ROUTING: {
        // API endpoint
        API_URL: 'https://maps.vietmap.vn/api/route',
        API_VERSION: '1.1',

        // Default vehicle: car, bike, foot, motorcycle
        DEFAULT_VEHICLE: 'motorcycle',

        // Maximum deviation distance before rerouting (meters)
        REROUTE_THRESHOLD: 30,

        // Minimum time between reroute requests (ms)
        REROUTE_COOLDOWN: 3000
    },

    // Simulation Settings
    SIMULATION: {
        // Position update interval (ms)
        UPDATE_INTERVAL: 1000,

        // Distance moved per update (meters)
        BASE_MOVE_DISTANCE: 10,

        // Maximum deviation when simulating off-route (meters)
        MAX_DEVIATION: 50
    },

    // Style URLs
    STYLES: {
        MAP_STYLE: 'https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=',

        // Route line style
        ROUTE_LINE: {
            color: '#1a73e8',
            width: 5,
            opacity: 0.8
        },

        // Alternative route style
        ALT_ROUTE_LINE: {
            color: '#999999',
            width: 4,
            opacity: 0.5
        }
    }
};

// Generate style URL with Tilemap API key
Config.getStyleUrl = function() {
    return this.STYLES.MAP_STYLE + this.API_KEYS.TILEMAP;
};

// Generate routing URL with Route API key
Config.getRouteUrl = function(startLat, startLng, endLat, endLng, vehicle) {
    var params = new URLSearchParams({
        'api-version': this.ROUTING.API_VERSION,
        'apikey': this.API_KEYS.ROUTE,
        'vehicle': vehicle || this.ROUTING.DEFAULT_VEHICLE
    });

    return this.ROUTING.API_URL + '?' + params.toString() +
           '&point=' + startLat + ',' + startLng +
           '&point=' + endLat + ',' + endLng;
};
