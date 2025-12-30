/**
 * VietMap Route Tracking Demo - Routing Module
 *
 * Handles route finding and route updates
 */

var RoutingModule = {
    currentRoute: null,
    startPoint: null,
    endPoint: null,
    routeCoordinates: [],
    lastRerouteTime: 0,
    currentVehicle: 'motorcycle',

    /**
     * Find route between 2 points. Make sure to call this API in your server side to protect your API key.
     * @param {number} startLat - Start point latitude
     * @param {number} startLng - Start point longitude
     * @param {number} endLat - End point latitude
     * @param {number} endLng - End point longitude
     * @param {string} vehicle - Vehicle type (motorcycle, car, bike, foot)
     * @param {Function} callback - Callback(error, routeData)
     */
    findRoute: function(startLat, startLng, endLat, endLng, vehicle, callback) {
        var self = this;

        // Store current vehicle for rerouting
        this.currentVehicle = vehicle || Config.ROUTING.DEFAULT_VEHICLE;

        var url = Config.getRouteUrl(startLat, startLng, endLat, endLng, this.currentVehicle);

        Logger.log('Finding route...', 'info');

        fetch(url)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                // Log response for debugging
                console.log('Route API response:', data);

                // Check for success - API returns "OK" (uppercase)
                if (data.code !== 'OK' || !data.paths || data.paths.length === 0) {
                    throw new Error('Route not found');
                }

                var route = data.paths[0];
                self.currentRoute = route;
                self.startPoint = { lat: startLat, lng: startLng };
                self.endPoint = { lat: endLat, lng: endLng };

                // Process coordinates - handle different response formats
                if (route.points) {
                    if (route.points.coordinates) {
                        // GeoJSON format: [[lng, lat], ...]
                        self.routeCoordinates = route.points.coordinates;
                    } else if (Array.isArray(route.points)) {
                        // Array format: [[lat, lng], ...] - need to swap to [lng, lat]
                        self.routeCoordinates = route.points.map(function(p) {
                            return [p[1], p[0]];
                        });
                    } else if (typeof route.points === 'string') {
                        // Encoded polyline - decode it
                        self.routeCoordinates = self.decodePolyline(route.points);
                    } else {
                        self.routeCoordinates = [];
                    }
                } else {
                    self.routeCoordinates = [];
                }

                Logger.log('Route found: ' + Utils.formatDistance(route.distance), 'success');

                callback(null, {
                    distance: route.distance,
                    duration: route.time,
                    coordinates: self.routeCoordinates,
                    instructions: route.instructions || []
                });
            })
            .catch(function(error) {
                Logger.log('Route error: ' + error.message, 'error');
                callback(error, null);
            });
    },

    /**
     * Reroute from current position. Make sure to call this API in your server side to protect your API key.
     * @param {number} currentLat - Current latitude
     * @param {number} currentLng - Current longitude
     * @param {Function} callback - Callback(error, routeData)
     */
    reroute: function(currentLat, currentLng, callback) {
        var now = Date.now();

        // Check cooldown
        if (now - this.lastRerouteTime < Config.ROUTING.REROUTE_COOLDOWN) {
            Logger.log('Reroute cooldown active', 'warning');
            return;
        }

        if (!this.endPoint) {
            Logger.log('No destination set', 'error');
            return;
        }

        this.lastRerouteTime = now;
        Logger.log('Rerouting...', 'warning');

        this.findRoute(currentLat, currentLng, this.endPoint.lat, this.endPoint.lng, this.currentVehicle, callback);
    },

    /**
     * Check if user is off-route
     * @param {number} lat - Current latitude
     * @param {number} lng - Current longitude
     * @returns {Object} {deviated, distance}
     */
    checkDeviation: function(lat, lng) {
        if (!this.routeCoordinates || this.routeCoordinates.length === 0) {
            return { deviated: false, distance: 0 };
        }

        var distance = Utils.distanceToRoute(this.routeCoordinates, lat, lng);
        var deviated = distance > Config.ROUTING.REROUTE_THRESHOLD;

        return {
            deviated: deviated,
            distance: distance
        };
    },

    /**
     * Calculate remaining distance to destination
     * @param {number} lat - Current latitude
     * @param {number} lng - Current longitude
     * @returns {number} Distance (meters)
     */
    getRemainingDistance: function(lat, lng) {
        if (!this.endPoint) return 0;
        return Utils.calculateDistance(lat, lng, this.endPoint.lat, this.endPoint.lng);
    },

    /**
     * Check if arrived at destination
     * @param {number} lat - Current latitude
     * @param {number} lng - Current longitude
     * @param {number} threshold - Distance threshold (meters)
     * @returns {boolean}
     */
    hasArrived: function(lat, lng, threshold) {
        threshold = threshold || 20; // Default 20 meters
        return this.getRemainingDistance(lat, lng) < threshold;
    },

    /**
     * Get current route coordinates
     */
    getRouteCoordinates: function() {
        return this.routeCoordinates;
    },

    /**
     * Reset routing state
     */
    reset: function() {
        this.currentRoute = null;
        this.startPoint = null;
        this.endPoint = null;
        this.routeCoordinates = [];
        this.lastRerouteTime = 0;
        this.currentVehicle = 'motorcycle';
    },

    /**
     * Decode Google Polyline Algorithm (precision 5)
     * @param {string} encoded - Encoded polyline string
     * @returns {Array} Array of [lng, lat] coordinates
     */
    decodePolyline: function(encoded) {
        var coordinates = [];
        var index = 0;
        var lat = 0;
        var lng = 0;

        while (index < encoded.length) {
            var b;
            var shift = 0;
            var result = 0;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            // Return as [lng, lat] for Mapbox/VietMap GL format
            coordinates.push([lng / 1e5, lat / 1e5]);
        }

        return coordinates;
    }
};
