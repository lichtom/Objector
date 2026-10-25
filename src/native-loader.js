/**
 * Native Runtime Loader
 *
 * Loads the Win32 native addon for creating real OS-native windows.
 * Falls back gracefully if the addon is not available.
 */

var _nativeAddon = null;
var _loaded = false;

function _tryLoad() {
    if (_loaded) return _nativeAddon;
    _loaded = true;

    try {
        // Try to load the prebuilt addon
        var path = require('path');
        var addonPath = path.join(__dirname, '..', 'native', 'app-runtime',
                                  'build', 'Release', 'app_runtime.node');
        _nativeAddon = require(addonPath);
        console.log('[NativeRuntime] Addon loaded successfully');
    } catch (e) {
        try {
            // Try node-gyp default location
            _nativeAddon = require('../../native/app-runtime/build/Release/app_runtime.node');
            console.log('[NativeRuntime] Addon loaded from fallback path');
        } catch (e2) {
            console.warn('[NativeRuntime] Native addon not available:', e.message);
            _nativeAddon = null;
        }
    }

    return _nativeAddon;
}

/**
 * Get the native addon, or null if not available.
 */
function getAddon() {
    return _tryLoad();
}

/**
 * Check if native runtime is available.
 */
function isAvailable() {
    var addon = _tryLoad();
    return addon !== null;
}

/**
 * Initialize the native runtime with an event handler.
 * @param {Function} eventHandler - Called with (windowId, ctrlId, eventType, data)
 */
function init(eventHandler) {
    var addon = _tryLoad();
    if (!addon) return false;
    return addon.init(eventHandler);
}

module.exports = {
    getAddon: getAddon,
    isAvailable: isAvailable,
    init: init
};
