var jsurl = require('jsurl');
var querystring = require('querystring');

function formatPlan(plan) {
    if (plan) {
        return encodeURIComponent(plan).replace(/%20/g, '+');
    }
    return plan;
}

function parsePlan(plan) {
    if (plan) {
        return decodeURIComponent(plan.replace(/\+/g, '%20'));
    }
    return plan;
}

module.exports = {

    /*
     * Parse hash for the map. Based on OSM's parseHash.
     */
    parseHash: function(hash) {
        var args = {};

        var i = hash.indexOf('#');
        if (i < 0) {
            return args;
        }

        hash = querystring.parse(hash.substr(i + 1));

        var map = (hash.map || '').split('/'),
            zoom = parseInt(map[0], 10),
            lat = parseFloat(map[1]),
            lon = parseFloat(map[2]);

        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lon)) {
            args.center = new L.LatLng(lat, lon);
            args.zoom = zoom;
        }

        args.page = hash.page;
        args.plan = parsePlan(hash.plan);
        args.filters = jsurl.parse(hash.filters);
        args.highlights = jsurl.parse(hash.highlights);
        args.sidebar = hash.sidebar;

        return args;
    },

    /*
     * Format hash for the map. Based on OSM's formatHash.
     */
    formatHash: function(options) {
        var center = options.map.getCenter(),
            zoom = options.map.getZoom();
        center = center.wrap();

        var precision = 4,
            hash = '#map=' + zoom +
                '/' + center.lat.toFixed(precision) +
                '/' + center.lng.toFixed(precision);

        if (options.planName) {
            hash += '&plan=' + formatPlan(options.planName);
        }

        if (options.page) {
            hash += '&page=' + options.page;
        }

        if (options.filters && _.size(options.filters) > 0) {
            hash += '&filters=' + jsurl.stringify(options.filters);
        }

        if (options.highlights && _.size(options.highlights) > 0) {
            hash += '&highlights=' + jsurl.stringify(options.highlights);
        }

        if (options.sidebar) {
            hash += '&sidebar=' + options.sidebar;
        }

        return hash;
    }

};
