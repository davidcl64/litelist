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
function RVLiteList(_opts) {
    var delayBind = _opts.delayBind;

    // Don't let LiteList bind - we'll do that here if delayBind isn't true
    // Make a copy of the incoming opts so we don't modify the original version and
    // cause weird bugs if the caller isn't expecting the incoming value to change.
    var opts = {};

    // We are only touching a simple property, so it is ok to duplicate any complex
    // properties here rather than doing a true deep copy.
    Object.keys(_opts).forEach(function(key) { opts[key] = _opts[key]; });
    opts.delayBind = true;

    LiteList.call(this, opts);

    this.rivetsModels = opts.rivetsModels || {};
    this.rivetsOpts   = opts.rivetsOpts   || {};

    // Overwrite any existing value in the provided model if it exists.
    this.rivetsModels.items   = this.viewBuffer.view;
    this.rivetsModels.metrics = this.liteList;

    // use provided rivetsOpts and allow custom top, left and height binders if the caller
    // wants to and knows what they are doing...
    this.rivetsOpts.binders        = this.rivetsOpts.binders || {};
    this.rivetsOpts.binders.top    = this.rivetsOpts.binders.top    || function(el, val) { el.style.top    = val + "px"; };
    this.rivetsOpts.binders.left   = this.rivetsOpts.binders.left   || function(el, val) { el.style.left   = val + "px"; };
    this.rivetsOpts.binders.height = this.rivetsOpts.binders.height || function(el, val) { el.style.height = val + "px"; };

    // Just take care of ourselves during construction so we don't double bind
    if(!delayBind) {
        this.bind();
    }
}

// subclass extends superclass
RVLiteList.prototype = Object.create(LiteList.prototype);
RVLiteList.prototype.constructor = RVLiteList;

RVLiteList.prototype.unbind = function unbind() {
    if(this.rvView) { this.rvView.unbind(); }

    LiteList.prototype.unbind.call(this);
};

RVLiteList.prototype.bind = function bind() {
    // Pending the resolution of rivets#306 - this will be changed to rebind the view if the
    // view already exists.  Until that behavior is fixed, we'll go through the overhead of
    // creating a new view.  Caller beware...
    this.rvView = rivets.bind(this.view, this.rivetsModels, this.rivetsOpts);

    LiteList.prototype.bind.call(this);
};




module.exports = RVLiteList;

