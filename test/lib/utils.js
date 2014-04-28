
var array = {
    fill: function(fillFn) {
        var len = this.length;
        var i;

        for(i = 0; i < len; ++i) {
            this[i] = fillFn.call(this, i);
        }

        return this;
    }
};

module.exports.array = array;