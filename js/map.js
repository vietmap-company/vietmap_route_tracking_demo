/**
 * VietMap Route Tracking Demo - Map Module
 *
 * Handles map initialization and interactions
 */

var MapModule = {
    map: null,
    markers: {
        user: null,
        start: null,
        end: null
    },
    instructionMarkers: [], // Array to store instruction markers
    routeLayerId: 'route-layer',
    routeSourceId: 'route-source',
    imagesLoaded: false,

    // Vehicle/Driver information for popup
    vehicleInfo: {
        licensePlate: '59DB-056.43',
        driverName: 'Nguyễn Văn A',
        driverPhone: '0901234567',
        vehicleType: 'Honda Wave Alpha',
        status: 'Đang giao hàng'
    },

    // Marker icon file paths (moved to assets)
    markerSVGs: {
        userNormal: 'assets/marker-user-normal.svg',
        userDeviated: 'assets/marker-user-deviated.svg',
        start: 'assets/marker-start.svg',
        end: 'assets/marker-end.svg'
    },

    /**
     * Initialize the map
     * @param {Function} callback - Callback after map loads
     */
    init: function(callback) {
        var self = this;

        this.map = new vietmapgl.Map({
            container: 'map',
            style: Config.getStyleUrl(),
            center: Config.MAP.DEFAULT_CENTER,
            zoom: Config.MAP.DEFAULT_ZOOM,
            minZoom: Config.MAP.MIN_ZOOM,
            maxZoom: Config.MAP.MAX_ZOOM
        });

        this.map.addControl(new vietmapgl.NavigationControl(), 'top-right');
        this.map.addControl(new vietmapgl.ScaleControl(), 'bottom-left');

        this.map.on('load', function() {
            Logger.log('Map is ready', 'success');

            // Find first symbol layer to insert route below text labels
            var firstSymbolLayer = null;
            var layers = self.map.getStyle().layers;
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') {
                    firstSymbolLayer = layers[i].id;
                    break;
                }
            }

            // Add source for route
            self.map.addSource(self.routeSourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: []
                    }
                }
            });

            // Add route layer below text labels
            self.map.addLayer({
                id: self.routeLayerId,
                type: 'line',
                source: self.routeSourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': Config.STYLES.ROUTE_LINE.color,
                    'line-width': Config.STYLES.ROUTE_LINE.width,
                    'line-opacity': Config.STYLES.ROUTE_LINE.opacity
                }
            }, firstSymbolLayer); // Insert before first symbol layer

            // Load marker images
            self.loadMarkerImages(function() {
                if (callback) callback();
            });
        });

        // Handle map click
        this.map.on('click', function(e) {
            Logger.log('Click: ' + e.lngLat.lat.toFixed(6) + ', ' + e.lngLat.lng.toFixed(6), 'info');
        });

        // Handle right-click (context menu)
        this.map.on('contextmenu', function(e) {
            e.preventDefault();
            App.showContextMenu(e.point.x, e.point.y, e.lngLat);
        });
    },

    /**
     * Load marker images into map
     */
    loadMarkerImages: function(callback) {
        var self = this;
        var imagesToLoad = [
            { name: 'user-marker-normal', src: this.markerSVGs.userNormal, width: 48, height: 48 },
            { name: 'user-marker-deviated', src: this.markerSVGs.userDeviated, width: 48, height: 48 },
            { name: 'start-marker', src: this.markerSVGs.start, width: 20, height: 20 },
            { name: 'end-marker', src: this.markerSVGs.end, width: 20, height: 20 }
        ];

        var loadedCount = 0;
        var totalImages = imagesToLoad.length;

        imagesToLoad.forEach(function(img) {
            var svgImage = new Image(img.width, img.height);
            svgImage.onload = function() {
                if (!self.map.hasImage(img.name)) {
                    self.map.addImage(img.name, svgImage);
                }
                loadedCount++;
                if (loadedCount === totalImages) {
                    self.imagesLoaded = true;
                    Logger.log('Marker images loaded', 'success');
                    if (callback) callback();
                }
            };
            svgImage.onerror = function() {
                Logger.log('Failed to load image: ' + img.name, 'error');
                loadedCount++;
                if (loadedCount === totalImages) {
                    self.imagesLoaded = true;
                    if (callback) callback();
                }
            };
            svgImage.src = img.src;
        });
    },

    /**
     * Update vehicle/driver information
     * @param {Object} info - Vehicle info object
     */
    setVehicleInfo: function(info) {
        if (info.licensePlate) this.vehicleInfo.licensePlate = info.licensePlate;
        if (info.driverName) this.vehicleInfo.driverName = info.driverName;
        if (info.driverPhone) this.vehicleInfo.driverPhone = info.driverPhone;
        if (info.vehicleType) this.vehicleInfo.vehicleType = info.vehicleType;
        if (info.status) this.vehicleInfo.status = info.status;
    },

    /**
     * Generate popup HTML content for vehicle info
     */
    getVehiclePopupContent: function() {
        var info = this.vehicleInfo;
        return '<div class="vehicle-popup">' +
            '<div class="popup-header">' +
                '<strong>' + info.licensePlate + '</strong>' +
                '<span class="popup-status">' + info.status + '</span>' +
            '</div>' +
            '<div class="popup-body">' +
                '<p><i class="icon-driver"></i> ' + info.driverName + '</p>' +
                '<p><i class="icon-phone"></i> ' + info.driverPhone + '</p>' +
                '<p><i class="icon-vehicle"></i> ' + info.vehicleType + '</p>' +
            '</div>' +
        '</div>';
    },

    /**
     * Set user location marker with heading rotation
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {boolean} deviated - Whether user is off-route
     * @param {number} heading - Heading in degrees (0=North, 90=East)
     */
    setUserMarker: function(lat, lng, deviated, heading) {
        var self = this;
        
        if (!this.imagesLoaded) {
            Logger.log('Images not loaded yet', 'warning');
            return;
        }

        var iconImage = deviated ? 'user-marker-deviated' : 'user-marker-normal';

        if (this.markers.user) {
            // Update existing marker - optimize by only updating coordinates
            var source = this.map.getSource('user-marker-source');
            if (source) {
                var data = source._data;
                data.geometry.coordinates = [lng, lat];
                source.setData(data);

                // Only update icon if deviated status changed
                var currentIcon = this.map.getLayoutProperty('user-marker-layer', 'icon-image');
                if (currentIcon !== iconImage) {
                    this.map.setLayoutProperty('user-marker-layer', 'icon-image', iconImage);
                }

                // Update rotation
                this.map.setLayoutProperty('user-marker-layer', 'icon-rotate', heading || 0);
            }

            // Update popup position
            if (this.markers.user.popup) {
                this.markers.user.popup.setLngLat([lng, lat]);
            }
        } else {
            // Create new marker
            this.map.addSource('user-marker-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                }
            });

            this.map.addLayer({
                id: 'user-marker-layer',
                type: 'symbol',
                source: 'user-marker-source',
                layout: {
                    'icon-image': iconImage,
                    'icon-size': 1.0,
                    'icon-rotate': heading || 0,
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-anchor': 'center'
                }
            });

            // Create popup
            var popup = new vietmapgl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false
            }).setLngLat([lng, lat]).setHTML(this.getVehiclePopupContent());

            // Add click event to toggle popup
            this.map.on('click', 'user-marker-layer', function(e) {
                e.preventDefault();
                if (popup.isOpen()) {
                    popup.remove();
                } else {
                    popup.addTo(self.map);
                }
            });

            // Change cursor on hover
            this.map.on('mouseenter', 'user-marker-layer', function() {
                self.map.getCanvas().style.cursor = 'pointer';
            });

            this.map.on('mouseleave', 'user-marker-layer', function() {
                self.map.getCanvas().style.cursor = '';
            });

            this.markers.user = { popup: popup, coords: [lng, lat] };
        }
    },

    /**
     * Set start point marker
     */
    setStartMarker: function(lat, lng) {
        if (!this.imagesLoaded) return;

        if (this.markers.start) {
            var source = this.map.getSource('start-marker-source');
            if (source) {
                source.setData({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                });
            }
        } else {
            this.map.addSource('start-marker-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                }
            });

            this.map.addLayer({
                id: 'start-marker-layer',
                type: 'symbol',
                source: 'start-marker-source',
                layout: {
                    'icon-image': 'start-marker',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-anchor': 'center'
                }
            });

            this.markers.start = true;
        }
    },

    /**
     * Set end point marker
     */
    setEndMarker: function(lat, lng) {
        if (!this.imagesLoaded) return;

        if (this.markers.end) {
            var source = this.map.getSource('end-marker-source');
            if (source) {
                source.setData({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                });
            }
        } else {
            this.map.addSource('end-marker-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                }
            });

            this.map.addLayer({
                id: 'end-marker-layer',
                type: 'symbol',
                source: 'end-marker-source',
                layout: {
                    'icon-image': 'end-marker',
                    'icon-size': 1.0,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-anchor': 'center'
                }
            });

            this.markers.end = true;
        }
    },

    /**
     * Draw route on map
     * @param {Array} coordinates - Array of coordinates [[lng, lat], ...]
     */
    drawRoute: function(coordinates) {
        if (!this.map.getSource(this.routeSourceId)) return;

        this.map.getSource(this.routeSourceId).setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
    },

    /**
     * Clear route from map
     */
    clearRoute: function() {
        this.drawRoute([]);
        this.clearInstructionMarkers();
    },

    /**
     * Draw instruction markers based on intervals
     * @param {Array} instructions - Array of instruction objects with interval property
     * @param {Array} coordinates - Decoded route coordinates [[lng, lat], ...]
     */
    drawInstructionMarkers: function(instructions, coordinates) {
        var self = this;
        
        // Clear existing instruction markers
        this.clearInstructionMarkers();

        if (!instructions || !coordinates || instructions.length === 0) {
            return;
        }

        console.log('Drawing instruction markers:', instructions.length);

        instructions.forEach(function(instruction, index) {
            // Skip if no interval
            if (!instruction.interval || instruction.interval.length < 2) {
                return;
            }

            var startIndex = instruction.interval[0];
            var endIndex = instruction.interval[1];

            // Use provided street name when available
            var streetName = instruction.street_name || instruction.streetName || '';

            // Validate index
            if (startIndex >= coordinates.length) {
                console.warn('Start index out of bounds:', startIndex, 'for', coordinates.length, 'coordinates');
                return;
            }

            // Get coordinate at start of interval
            var coord = coordinates[startIndex];
            
            // Create marker element
            var el = document.createElement('div');
            el.className = 'instruction-marker';
            el.innerHTML = '<div class="instruction-number">' + (index + 1) + '</div>';

            // Create popup content
            var popupContent = '<div class="instruction-popup">' +
                '<div class="instruction-text"><strong>Bước ' + (index + 1) + ':</strong><br>' + 
                (instruction.text || 'Tiếp tục') + '</div>' +
                (streetName ? '<div class="instruction-text">Đường: ' + streetName + '</div>' : '') +
                '<div class="instruction-details">' +
                    '<span>📏 ' + Utils.formatDistance(instruction.distance) + '</span> ' +
                    '<span>⏱️ ' + Utils.formatDuration(instruction.time) + '</span>' +
                '</div>' +
            '</div>';

            // Create marker
            var marker = new vietmapgl.Marker({ 
                element: el,
                anchor: 'bottom'
            })
                .setLngLat(coord)
                .setPopup(new vietmapgl.Popup({ 
                    offset: 25,
                    closeButton: true
                }).setHTML(popupContent))
                .addTo(self.map);

            // Add click handler to show popup
            el.style.cursor = 'pointer';
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                marker.togglePopup();
            });

            self.instructionMarkers.push(marker);
        });

        console.log('Created', self.instructionMarkers.length, 'instruction markers');
    },

    /**
     * Clear all instruction markers
     */
    clearInstructionMarkers: function() {
        this.instructionMarkers.forEach(function(marker) {
            marker.remove();
        });
        this.instructionMarkers = [];
    },

    /**
     * Fit map to bounds
     * @param {Array} coordinates - Array of coordinates
     */
    fitBounds: function(coordinates) {
        if (!coordinates || coordinates.length === 0) return;

        var bounds = new vietmapgl.LngLatBounds();
        coordinates.forEach(function(coord) {
            bounds.extend(coord);
        });

        this.map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
        });
    },

    /**
     * Move camera to location
     */
    flyTo: function(lat, lng, zoom) {
        this.map.flyTo({
            center: [lng, lat],
            zoom: zoom || this.map.getZoom()
        });
    },

    /**
     * Remove all markers
     */
    clearMarkers: function() {
        // Remove user marker
        if (this.markers.user) {
            if (this.markers.user.popup) this.markers.user.popup.remove();
            if (this.map.getLayer('user-marker-layer')) this.map.removeLayer('user-marker-layer');
            if (this.map.getSource('user-marker-source')) this.map.removeSource('user-marker-source');
            this.markers.user = null;
        }

        // Remove start marker
        if (this.markers.start) {
            if (this.map.getLayer('start-marker-layer')) this.map.removeLayer('start-marker-layer');
            if (this.map.getSource('start-marker-source')) this.map.removeSource('start-marker-source');
            this.markers.start = null;
        }

        // Remove end marker
        if (this.markers.end) {
            if (this.map.getLayer('end-marker-layer')) this.map.removeLayer('end-marker-layer');
            if (this.map.getSource('end-marker-source')) this.map.removeSource('end-marker-source');
            this.markers.end = null;
        }
    }
};
