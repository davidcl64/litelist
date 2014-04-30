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


/*
 * In addition to the options documented in LiteList
 *
 * opts: {
 *   rivetsModels: { ... }  //  Any additional models that need to be provided for rivets.
 *                          //  These will be included along with { items: itemsInView }
 *                          //  when calling rivets.bind.
 *   rivetsOpts:   { ... }  //  Any additional rivets configuration. Binders for top, left and height
 *                          //  will be mixed in prior to calling rivets.bind
 * }
 */
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

    var rivetsModels = opts.rivetsModels || {};
    var rivetsOpts   = opts.rivetsOpts   || {};

    // Overwrite any existing value in the provided model if it exists.
    rivetsModels.items = this.itemsInView;

    // use provided rivetsOpts and allow custom top, left and height binders if the caller
    // wants to and knows what they are doing...
    rivetsOpts.binders        = rivetsOpts.binders || {};
    rivetsOpts.binders.top    = rivetsOpts.binders.top    || function(el, val) { el.style.top    = val + "px"; };
    rivetsOpts.binders.left   = rivetsOpts.binders.left   || function(el, val) { el.style.left   = val + "px"; };
    rivetsOpts.binders.height = rivetsOpts.binders.height || function(el, val) { el.style.height = val + "px"; };

    this.rvView = rivets.bind(this.liteList.itemsContainer, rivetsModels, rivetsOpts);
}

module.exports = RVLiteList;

