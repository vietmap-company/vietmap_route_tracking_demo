/**
 * VietMap Route Tracking Demo - Utility Functions
 *
 * Common utility functions used across the application
 */

var Utils = {
    /**
     * Calculate distance between 2 points (Haversine formula)
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lng1 - Longitude of point 1
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lng2 - Longitude of point 2
     * @returns {number} Distance in meters
     */
    calculateDistance: function(lat1, lng1, lat2, lng2) {
        var R = 6371000; // Earth radius (meters)
        var dLat = this.toRad(lat2 - lat1);
        var dLng = this.toRad(lng2 - lng1);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);

        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    /**
     * Convert degrees to radians
     */
    toRad: function(deg) {
        return deg * (Math.PI / 180);
    },

    /**
     * Convert radians to degrees
     */
    toDeg: function(rad) {
        return rad * (180 / Math.PI);
    },

    /**
     * Calculate bearing/heading between two points
     * @param {number} lat1 - Start latitude
     * @param {number} lng1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lng2 - End longitude
     * @returns {number} Bearing in degrees (0-360, 0=North, 90=East)
     */
    calculateBearing: function(lat1, lng1, lat2, lng2) {
        var dLng = this.toRad(lng2 - lng1);
        var lat1Rad = this.toRad(lat1);
        var lat2Rad = this.toRad(lat2);

        var y = Math.sin(dLng) * Math.cos(lat2Rad);
        var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

        var bearing = this.toDeg(Math.atan2(y, x));

        // Normalize to 0-360
        return (bearing + 360) % 360;
    },

    /**
     * Calculate point on a line from point A to point B at a given distance
     * @param {number} lat1 - Start point latitude
     * @param {number} lng1 - Start point longitude
     * @param {number} lat2 - End point latitude
     * @param {number} lng2 - End point longitude
     * @param {number} distance - Distance from start point (meters)
     * @returns {Object} New point coordinates {lat, lng}
     */
    getPointAtDistance: function(lat1, lng1, lat2, lng2, distance) {
        var totalDistance = this.calculateDistance(lat1, lng1, lat2, lng2);
        if (totalDistance === 0) return { lat: lat1, lng: lng1 };

        var ratio = distance / totalDistance;
        if (ratio > 1) ratio = 1;

        return {
            lat: lat1 + (lat2 - lat1) * ratio,
            lng: lng1 + (lng2 - lng1) * ratio
        };
    },

    /**
     * Find nearest point on route from current position
     * @param {Array} routeCoords - Array of route coordinates [[lng, lat], ...]
     * @param {number} lat - Current latitude
     * @param {number} lng - Current longitude
     * @returns {Object} {index, distance, point}
     */
    findNearestPointOnRoute: function(routeCoords, lat, lng) {
        var minDistance = Infinity;
        var nearestIndex = 0;
        var nearestPoint = null;

        for (var i = 0; i < routeCoords.length; i++) {
            var coord = routeCoords[i];
            var dist = this.calculateDistance(lat, lng, coord[1], coord[0]);

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
                nearestPoint = { lat: coord[1], lng: coord[0] };
            }
        }

        return {
            index: nearestIndex,
            distance: minDistance,
            point: nearestPoint
        };
    },

    /**
     * Calculate distance from point to line segment
     * @param {number} px - Point longitude
     * @param {number} py - Point latitude
     * @param {number} x1 - Line start longitude
     * @param {number} y1 - Line start latitude
     * @param {number} x2 - Line end longitude
     * @param {number} y2 - Line end latitude
     * @returns {number} Distance (meters)
     */
    pointToLineDistance: function(px, py, x1, y1, x2, y2) {
        var A = px - x1;
        var B = py - y1;
        var C = x2 - x1;
        var D = y2 - y1;

        var dot = A * C + B * D;
        var lenSq = C * C + D * D;
        var param = lenSq !== 0 ? dot / lenSq : -1;

        var xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return this.calculateDistance(py, px, yy, xx);
    },

    /**
     * Calculate shortest distance from point to route
     * @param {Array} routeCoords - Array of route coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {number} Distance (meters)
     */
    distanceToRoute: function(routeCoords, lat, lng) {
        var minDist = Infinity;

        for (var i = 0; i < routeCoords.length - 1; i++) {
            var dist = this.pointToLineDistance(
                lng, lat,
                routeCoords[i][0], routeCoords[i][1],
                routeCoords[i + 1][0], routeCoords[i + 1][1]
            );

            if (dist < minDist) {
                minDist = dist;
            }
        }

        return minDist;
    },

    /**
     * Format distance for display
     * @param {number} meters - Distance in meters
     * @returns {string} Formatted string
     */
    formatDistance: function(meters) {
        if (meters < 1000) {
            return Math.round(meters) + ' m';
        }
        return (meters / 1000).toFixed(2) + ' km';
    },

    /**
     * Format duration for display
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted string
     */
    formatDuration: function(ms) {
        var seconds = Math.floor(ms / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);

        if (hours > 0) {
            minutes = minutes % 60;
            return hours + 'h ' + minutes + 'm';
        }

        if (minutes > 0) {
            seconds = seconds % 60;
            return minutes + 'm ' + seconds + 's';
        }

        return seconds + 's';
    },

    /**
     * Get current time in HH:MM:SS format
     */
    getCurrentTime: function() {
        var now = new Date();
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        var seconds = String(now.getSeconds()).padStart(2, '0');
        return hours + ':' + minutes + ':' + seconds;
    },

    /**
     * Parse coordinates from input string
     * @param {string} str - String in format "lat, lng"
     * @returns {Object|null} {lat, lng} or null if invalid
     */
    parseCoordinates: function(str) {
        if (!str) return null;

        var parts = str.split(',').map(function(s) {
            return parseFloat(s.trim());
        });

        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            return null;
        }

        return {
            lat: parts[0],
            lng: parts[1]
        };
    },

    /**
     * Add random offset to coordinates (for deviation simulation)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} maxMeters - Maximum offset distance
     * @returns {Object} {lat, lng}
     */
    addRandomOffset: function(lat, lng, maxMeters) {
        // Convert meters to degrees (approximate)
        var latOffset = (Math.random() - 0.5) * 2 * (maxMeters / 111000);
        var lngOffset = (Math.random() - 0.5) * 2 * (maxMeters / (111000 * Math.cos(this.toRad(lat))));

        return {
            lat: lat + latOffset,
            lng: lng + lngOffset
        };
    }
};
