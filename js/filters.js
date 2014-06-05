module.exports = {

    init: function (options) {
        options = options || {};

        if (options.mayors && options.dateRange) {
            $(options.mayors).change(function () {
                var mayor = $(this).find(':selected');
                $(options.dateRange).dateRangeSlider(
                    'values',
                    new Date(parseInt(mayor.data('start')), 0, 1),
                    new Date(parseInt(mayor.data('end')), 0, 1)
                );
            });
        }
    }

};