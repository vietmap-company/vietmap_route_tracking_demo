# Changelog

## 2026-01-16
- Moved all marker and popup SVG icons into `assets/` and updated map loading to use external SVG files.
- Added street name display in instruction popups when available from routing instructions.
- Tweaked instruction marker hover transitions to avoid lag while panning the map and switched instruction markers to numeric badges instead of icons.
- Instruction rendering links:
	- Instruction markers creation, popup content: [js/map.js#L398-L475](js/map.js#L398-L475)
	- Clearing instruction markers before redraw: [js/map.js#L477-L485](js/map.js#L477-L485)
	- Instruction marker styling and transition tweaks: [css/styles.css#L454-L479](css/styles.css#L454-L479)
	- Instruction popup styling: [css/styles.css#L481-L513](css/styles.css#L481-L513)
