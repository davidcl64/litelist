var LiteList = require('./litelist');
var rivets;

// Just here to simplify the initialization logic.  If
// window doesn't exist, this module is useless anyway
if(typeof window === 'undefined') { window = {}; }

// The build will declare TWEEN as external. However, if it isn't provided by
// browserify, we really want to check to see if it was included directly via
// script tag first.  Only if it isn't will we try a require.  This *should*
// make it easier to bundle/or not and to use with requirejs...
rivets = window.rivets || require("rivets");


function RVLiteList(opts) {
    this.liteList    = new LiteList(opts);
    this.itemsInView = this.liteList.itemsInView;

    this.unbind = function unbind() {
        if(this.rvView) { this.rvView.unbind(); }

        this.liteList.unbind();
    };

    this.push = function() {
        this.liteList.push.apply(this.liteList, arguments);
    };

    this.rvView = rivets.bind(document.querySelector(opts.itemsContainer), {items: this.itemsInView}, {
        binders: {
            top:    function(el, val) { el.style.top    = val + "px"; },
            left:   function(el, val) { el.style.left   = val + "px"; },
            height: function(el, val) { el.style.height = val + "px"; }
        }
    });
}

module.exports = RVLiteList;

