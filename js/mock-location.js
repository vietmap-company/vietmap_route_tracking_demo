/**
 * VietMap Route Tracking Demo - Mock Location Module
 *
 * Simulates user movement along the route
 */

var MockLocationModule = {
    isRunning: false,
    intervalId: null,
    currentPosition: null,
    currentRouteIndex: 0,
    speedMultiplier: 5,
    simulateDeviation: false,
    deviationActive: false,
    deviationStartIndex: -1,

    // Callbacks
    onPositionUpdate: null,
    onDeviation: null,
    onArrival: null,

    /**
     * Initialize module
     * @param {Object} options - Configuration options
     */
    init: function(options) {
        options = options || {};
        this.onPositionUpdate = options.onPositionUpdate || function() {};
        this.onDeviation = options.onDeviation || function() {};
        this.onArrival = options.onArrival || function() {};
    },

    /**
     * Start simulation
     * @param {number} startLat - Starting latitude
     * @param {number} startLng - Starting longitude
     */
    start: function(startLat, startLng) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.currentPosition = { lat: startLat, lng: startLng };
        this.currentRouteIndex = 0;
        this.deviationActive = false;
        this.deviationStartIndex = -1;

        Logger.log('Simulation started', 'success');
        this.tick();
    },

    /**
     * Stop simulation
     */
    stop: function() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }

        Logger.log('Simulation stopped', 'info');
    },

    /**
     * Set simulation speed
     * @param {number} multiplier - Speed multiplier (1-10)
     */
    setSpeed: function(multiplier) {
        this.speedMultiplier = Math.max(1, Math.min(10, multiplier));
    },

    /**
     * Enable/disable deviation simulation
     */
    setSimulateDeviation: function(enabled) {
        this.simulateDeviation = enabled;
    },

    /**
     * Process each position update tick
     */
    tick: function() {
        var self = this;

        if (!this.isRunning) return;

        var routeCoords = RoutingModule.getRouteCoordinates();

        if (!routeCoords || routeCoords.length === 0) {
            this.scheduleNextTick();
            return;
        }

        // Calculate new position
        var newPosition = this.calculateNextPosition(routeCoords);

        if (newPosition) {
            this.currentPosition = newPosition;

            // Check deviation
            var deviation = RoutingModule.checkDeviation(newPosition.lat, newPosition.lng);

            // Call position update callback
            this.onPositionUpdate(newPosition.lat, newPosition.lng, deviation.deviated);

            // Check if arrived at destination
            if (RoutingModule.hasArrived(newPosition.lat, newPosition.lng, 30)) {
                this.stop();
                this.onArrival();
                return;
            }

            // Handle deviation
            if (deviation.deviated && !this.deviationActive) {
                this.deviationActive = true;
                Logger.log('Deviation detected: ' + Math.round(deviation.distance) + 'm', 'warning');
                this.onDeviation(newPosition.lat, newPosition.lng);
            }
        }

        this.scheduleNextTick();
    },

    /**
     * Schedule next update tick
     */
    scheduleNextTick: function() {
        var self = this;
        var interval = Config.SIMULATION.UPDATE_INTERVAL / this.speedMultiplier;

        this.intervalId = setTimeout(function() {
            self.tick();
        }, interval);
    },

    /**
     * Calculate next position
     * @param {Array} routeCoords - Array of route coordinates
     * @returns {Object|null} {lat, lng}
     */
    calculateNextPosition: function(routeCoords) {
        // If simulating deviation
        if (this.simulateDeviation && this.shouldStartDeviation()) {
            return this.calculateDeviatedPosition(routeCoords);
        }

        // Move along route
        if (this.currentRouteIndex >= routeCoords.length - 1) {
            // Reached end of route
            var lastCoord = routeCoords[routeCoords.length - 1];
            return { lat: lastCoord[1], lng: lastCoord[0] };
        }

        // Find next point on route
        var moveDistance = Config.SIMULATION.BASE_MOVE_DISTANCE * this.speedMultiplier;
        var currentCoord = routeCoords[this.currentRouteIndex];
        var nextCoord = routeCoords[this.currentRouteIndex + 1];

        var distToNext = Utils.calculateDistance(
            this.currentPosition.lat, this.currentPosition.lng,
            nextCoord[1], nextCoord[0]
        );

        if (distToNext < moveDistance) {
            // Move to next segment
            this.currentRouteIndex++;
            return { lat: nextCoord[1], lng: nextCoord[0] };
        }

        // Move partial segment
        var newPoint = Utils.getPointAtDistance(
            this.currentPosition.lat, this.currentPosition.lng,
            nextCoord[1], nextCoord[0],
            moveDistance
        );

        return newPoint;
    },

    /**
     * Check if should start deviation
     */
    shouldStartDeviation: function() {
        // Only start deviation between 30% and 70% of route
        var routeCoords = RoutingModule.getRouteCoordinates();
        var progress = this.currentRouteIndex / routeCoords.length;

        if (progress > 0.3 && progress < 0.7 && !this.deviationActive && this.deviationStartIndex < 0) {
            // 20% chance to start deviation
            if (Math.random() < 0.2) {
                this.deviationStartIndex = this.currentRouteIndex;
                Logger.log('Starting route deviation simulation', 'warning');
                return true;
            }
        }

        return this.deviationStartIndex > 0 &&
               this.currentRouteIndex < this.deviationStartIndex + 5;
    },

    /**
     * Calculate deviated position
     */
    calculateDeviatedPosition: function(routeCoords) {
        if (this.currentRouteIndex >= routeCoords.length - 1) {
            return null;
        }

        var currentCoord = routeCoords[this.currentRouteIndex];

        // Move off-route
        var deviatedPos = Utils.addRandomOffset(
            currentCoord[1],
            currentCoord[0],
            Config.SIMULATION.MAX_DEVIATION
        );

        // Still increment index to move along route direction
        var moveDistance = Config.SIMULATION.BASE_MOVE_DISTANCE * this.speedMultiplier;
        var nextCoord = routeCoords[this.currentRouteIndex + 1];
        var distToNext = Utils.calculateDistance(
            currentCoord[1], currentCoord[0],
            nextCoord[1], nextCoord[0]
        );

        if (distToNext < moveDistance * 2) {
            this.currentRouteIndex++;
        }

        return deviatedPos;
    },

    /**
     * Reset when new route is available
     */
    resetRoute: function() {
        this.currentRouteIndex = 0;
        this.deviationActive = false;
        this.deviationStartIndex = -1;

        // Find nearest point on new route
        if (this.currentPosition) {
            var nearest = Utils.findNearestPointOnRoute(
                RoutingModule.getRouteCoordinates(),
                this.currentPosition.lat,
                this.currentPosition.lng
            );
            this.currentRouteIndex = nearest.index;
        }
    },

    /**
     * Get current position
     */
    getCurrentPosition: function() {
        return this.currentPosition;
    }
};
