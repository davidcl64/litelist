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

    this.rivetsModels = opts.rivetsModels || {};
    this.rivetsOpts   = opts.rivetsOpts   || {};

    this.unbind = function unbind() {
        if(this.rvView) { this.rvView.unbind(); }

        this.liteList.unbind();
    };

    function _bind() {
        this.rvView = rivets.bind(this.liteList.itemsContainer, this.rivetsModels, this.rivetsOpts);
    }

    this.bind = function bind() {
        _bind.call(this);
        this.liteList.bind();
    };

    this.push = function() {
        this.liteList.push.apply(this.liteList, arguments);
    };

    // Overwrite any existing value in the provided model if it exists.
    this.rivetsModels.items = this.itemsInView;

    // use provided rivetsOpts and allow custom top, left and height binders if the caller
    // wants to and knows what they are doing...
    this.rivetsOpts.binders        = this.rivetsOpts.binders || {};
    this.rivetsOpts.binders.top    = this.rivetsOpts.binders.top    || function(el, val) { el.style.top    = val + "px"; };
    this.rivetsOpts.binders.left   = this.rivetsOpts.binders.left   || function(el, val) { el.style.left   = val + "px"; };
    this.rivetsOpts.binders.height = this.rivetsOpts.binders.height || function(el, val) { el.style.height = val + "px"; };

    // Just take care of ourselves during construction so we don't double bind
    if(!opts.delayBind) {
        _bind.call(this);
    }
}

module.exports = RVLiteList;

