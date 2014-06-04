var hash = require('./hash');
var plansmap = require('./plansmap');
var search = require('./search');
var sidebar = require('./sidebar');

var currentPlan,
    currentLot = {},
    planOutline,
    lotsLayer,
    defaultZoom = 12,
    defaultCenter = [40.739974, -73.946228],
    userMarker;

var urbanreviewer = {
    sql_api_base: 'http://urbanreviewer.cartodb.com/api/v2/sql',

    addPlanContent: function ($location, borough, planName) {
        $.get('plans/' + borough + '/' + planName, function (content) {
            $location.append(content);
        });
    },

    clearPlanOutline: function (map) {
        if (planOutline) {
            planOutline.clearLayers();
        }
    },

    addPlanOutline: function (map, planName, options) {
        options = options || {};
        if (planOutline) {
            planOutline.clearLayers();
        }
        else {
            planOutline = L.geoJson(null, {
                style: function (feature) {
                    return {
                        color: '#f00',
                        dashArray: '10 10 1 10',
                        fill: false,
                        stroke: true
                    };
                }
            }).addTo(map);
        }
        var sql = "SELECT ST_Buffer(ST_ConvexHull(ST_Union(l.the_geom)), 0.0001) AS the_geom " + 
                  "FROM lots l LEFT JOIN plans p ON p.cartodb_id = l.plan_id " +
                  "WHERE p.name = '" + planName + "'";
        $.get(urbanreviewer.sql_api_base + "?q=" + sql + '&format=GeoJSON', function (data) {
            planOutline.addData(data);
            
            if (options.zoomToPlan === true) {
                map.fitBounds(planOutline.getBounds(), {
                    padding: [25, 25]            
                });
            }
        });
    },

    loadPlanInformation: function (data) {

        var template = JST['handlebars_templates/plan.hbs'];
        templateContent = template(data);
        sidebar.open('#right-pane', templateContent);

        // If we don't have borough, get it first
        if (data.borough) {
            urbanreviewer.addPlanContent($('#right-pane #plan-details'),
                                         data.borough, data.plan_name);
        }
        else {
            var sql = "SELECT * FROM plans WHERE name = '" + data.plan_name + "'";
            $.get(urbanreviewer.sql_api_base + '?q=' + sql, function (results) {
                data = results.rows[0];
                urbanreviewer.addPlanContent($('#right-pane #plan-details'),
                                             data.borough, data.name);
            });
        }

        var sql = 
            "SELECT p.borough AS borough, l.block AS block, l.lot AS lot " +
            "FROM lots l LEFT OUTER JOIN plans p ON l.plan_id=p.cartodb_id " +
            "WHERE p.name='" + data.plan_name + "' " +
            "ORDER BY l.block, l.lot";
        $.get(urbanreviewer.sql_api_base + "?q=" + sql, function (data) {
            var lots_template = JST['handlebars_templates/lots.hbs'];
            var content = lots_template(data);
            $('#lots-content').append(content);
            $('.lot-count').text(data.rows.length);
        });

        $('#right-pane .panel-toggle').click(function () {
            sidebar.close('#right-pane');
        });
    }
};

$(document).ready(function () {

    /*
     * Initialize map
     */
    var parsedHash = hash.parseHash(window.location.hash),
        zoom = parsedHash.zoom || defaultZoom,
        center = parsedHash.center || defaultCenter;
    currentPlan = parsedHash.plan;

    map = plansmap.init('map');

    if (currentPlan) {
        // If there's a plan selected already, set the active area so we can
        // zoom to it appropriately
        plansmap.setActiveArea(map, { area: 'left' });
    }
    else {
        plansmap.setActiveArea(map, { area: 'full' });
    }

    map
        .setView(center, zoom)
        .on('moveend', function () {
            window.location.hash = hash.formatHash(map, currentPlan);
        });

    if (currentPlan) {
        $('#search-container').hide();
        urbanreviewer.loadPlanInformation({ plan_name: currentPlan });
        urbanreviewer.addPlanOutline(map, currentPlan);
    }

    map
        .on('planlotclick', function (data) {
            currentPlan = data.plan_name;
            window.location.hash = hash.formatHash(map, currentPlan);
            urbanreviewer.loadPlanInformation(data);
            urbanreviewer.addPlanOutline(map, currentPlan, { zoomToPlan: true });
        })
        .on('planlotover', function (data) {
            if (currentPlan && data.plan_name === currentPlan) {
                if (data.block !== currentLot.block || data.lot !== currentLot.lot) {
                    currentLot = {
                        block: data.block,
                        lot: data.lot
                    };
                    map.openPopup('block: ' + data.block + ', lot: ' + data.lot,
                                  data.latlng);
                }
            }
        })
        .on('planlotout', function (data) {
            currentLot = {};
            map.closePopup();  
        });


    /*
     * Initialize sidebar
     */
    $('#right-pane').on('open', function () {
        $('#date-range-picker-container').hide();
        $('#search-container').hide();
        plansmap.setActiveArea(map, { area: 'left' });
    });

    $('#right-pane').on('close', function () {
        $('#date-range-picker-container').show();
        $('#search-container').show();
        plansmap.setActiveArea(map, { area: 'full' });

        currentPlan = null;
        window.location.hash = hash.formatHash(map, currentPlan);
        urbanreviewer.clearPlanOutline(map);
    });


    /*
     * Listen for popstate
     */
    $(window).on('popstate', function (e) {
        var parsedHash = hash.parseHash(window.location.hash),
            previousPlan = currentPlan;
        map.setView(parsedHash.center, parsedHash.zoom);
        currentPlan = parsedHash.plan;
        if (currentPlan && currentPlan !== previousPlan) {
            urbanreviewer.loadPlanInformation({ plan_name: currentPlan });
            urbanreviewer.addPlanOutline(map, currentPlan);
        }
    });


    /*
     * Initialize search
     */
    search.init('#search');
    $('#search').on('resultfound', function (e, results) {
        if (userMarker) {
            map.removeLayer(userMarker);
        }
        userMarker = L.userMarker(results.latlng, {
            smallIcon: true                        
        }).addTo(map);
        map.setView(results.latlng, 16);
    });


    /*
     * Initialize dateRangeSlider
     */
    $('#date-range-picker').dateRangeSlider({
        arrows: false,
        defaultValues: {
            min: new Date(1940, 0, 1),
            max: new Date(2014, 0, 1)
        },
        bounds: {
            min: new Date(1940, 0, 1),
            max: new Date(2014, 0, 1)
        },
        formatter: function (value) {
            return value.getFullYear();
        },
        step: {
            years: 1
        }
    })
    .bind('valuesChanged', function (e, data) {
        plansmap.filterLotsLayer({
            start: data.values.min.getFullYear(), 
            end: data.values.max.getFullYear()
        });
    });

});
