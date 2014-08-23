!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.LiteList=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/*
 * raf.js
 * https://github.com/ngryman/raf.js
 *
 * original requestAnimationFrame polyfill by Erik Möller
 * inspired from paul_irish gist and post
 *
 * Copyright (c) 2013 ngryman
 * Licensed under the MIT license.
 */

(function(window) {
	var lastTime = 0,
		vendors = ['webkit', 'moz'],
		requestAnimationFrame = window.requestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame,
		i = vendors.length;

	// try to un-prefix existing raf
	while (--i >= 0 && !requestAnimationFrame) {
		requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
		cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'];
	}

	// polyfill with setTimeout fallback
	// heavily inspired from @darius gist mod: https://gist.github.com/paulirish/1579671#comment-837945
	if (!requestAnimationFrame || !cancelAnimationFrame) {
		requestAnimationFrame = function(callback) {
			var now = Date.now(), nextTime = Math.max(lastTime + 16, now);
			return setTimeout(function() {
				callback(lastTime = nextTime);
			}, nextTime - now);
		};

		cancelAnimationFrame = clearTimeout;
	}

	// export to window
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
}(window));
},{}],2:[function(_dereq_,module,exports){
var LiteList            = _dereq_("./litelist");
LiteList.RivetsLiteList = _dereq_("./rvlitelist");
LiteList.Scroll         = _dereq_("./scroll");


module.exports = LiteList;
},{"./litelist":3,"./rvlitelist":4,"./scroll":5}],3:[function(_dereq_,module,exports){
var ViewBuffer = _dereq_('./viewbuffer');

/*
 * LiteList
 *
 * opts: {
 *  itemWidth       : Optional - width of each item.  If not provide one item per row is assumed
 *  itemHeight      : Required - height of each item.
 *  margin          : Optional - margin/gutters for the items.  Defaults to: { x: 0, y: 0 };
 *  scrollView      : Required - query selector for the scrollable container
 *  itemsContainer  : Optional - query selector container of the items.  Defaults to the first child of scrollView
 *  delayBind       : Optional - if true will wait for a call to liteList.bind() to attach any handlers
 *
 *  // The next two are required for a vanilla javascript implementation to be functional.  ListList was
 *  // written to work with the Rivets library which provides this functionality as well.  In that case,
 *  // it is optional.  i.e. the LiteList will continue on if these are not provided.
 *  itemTemplate    : Required - DOM node that will be cloned as a template for each item.
 *  dataSource      : Required - Implementation of the dataSource contract (see below for more details).
 * }
 */
function LiteList(opts) {
    this.viewBuffer      = new ViewBuffer();
    this.itemWidth       = opts.itemWidth || 0;
    this.itemHeight      = opts.itemHeight;
    this.margin          = opts.margin || { x: 0, y: 0 };
    this.dataSource      = opts.dataSource || false;
    this.itemTemplate    = opts.itemTemplate || false;
    this.scrollTop       = 0;
    this.dirtyResize     = true;
    this.ticking         = false;
    this.direction       = 0;

    // View Metrics
    this.clientHeight    = 0;
    this.clientWidth     = 0;
    this.rowsPerPage     = 0;
    this.itemsPerRow     = 0;
    this.itemsPerPage    = 0;
    this.maxBuffer       = 0;
    this.height          = 0;

    // internal state
    this._firstVisibleItem = 0;
    this._lastVisibleItem  = 0;

    // Get the container elements
    this.view            = opts.scrollView;
    this.itemsContainer  = opts.itemsContainer || false;

    // If it is a string, it should be a query selector - otherwise we are expecting an element.
    this.view            = (typeof this.view           === 'string' || this.view instanceof String)           ? document.querySelector(this.view)           : this.view;
    this.itemsContainer  = (typeof this.itemsContainer === 'string' || this.itemsContainer instanceof String) ? document.querySelector(opts.itemsContainer) : this.itemsContainer;

    // Keep track of a unique id for viewItems - allows This is passed to
    // datasource providers to aid in tracking.
    this._id = 0;

    // If not passed a page selector, assume it's the first child
    if(!this.itemsContainer) {
        this.itemsContainer = this.view.children[0];
    }

    // _updateView is used in requestAnimationFrame - bind it to this
    this._updateView = this._updateView.bind(this);

    // Invoked as a result of event listeners - bind them to this
    this._scrollHandler = this._scrollHandler.bind(this);
    this._resizeHandler = this._resizeHandler.bind(this);

    // Ensure valid view metrics
    this._calcViewMetrics();

    // bind any event handlers now if not asked to delay
    if(!opts.delayBind) {
        this.bind();
    }

    // If we know about Scroll, attach it now
    this.scroll = LiteList.Scroll ? new LiteList.Scroll(opts.scrollView, this._scrollHandler) : false;

    // Kicks off a layout (dirtyResize defaults to true)
    // This will layout everything nicely filling all columns
    this._calcDocHeight();
    this._requestTick();
}

LiteList.prototype._calcViewMetrics = function calcViewMetrics() {
    this.clientHeight    = this.view.clientHeight;
    this.clientWidth     = this.view.clientWidth;
    this.rowsPerPage     = Math.ceil (this.clientHeight / (this.itemHeight + this.margin.y));
    this.itemsPerRow     = this.itemWidth ? Math.floor(this.clientWidth  / (this.itemWidth  + this.margin.x)) : 1;
    this.itemsPerPage    = this.rowsPerPage * this.itemsPerRow;
    this.maxBuffer       = this.itemsPerPage * 3;
};

LiteList.prototype._calcDocHeight = function calcDocHeight() {
    var row = Math.ceil(this.viewBuffer.data.length/this.itemsPerRow);
    var newHeight = row * this.itemHeight + row * this.margin.y;

    if(newHeight !== this.height) {
        this.itemsContainer.style.height = newHeight + "px";
        this.height = newHeight;
    }
    return this.height;
};

LiteList.prototype._initInViewItem = function _initInViewItem(item) {
    item.id   = this._id++;

    // If we were given an item template, we need to add a clone
    // to the dom
    if(this.itemTemplate) {
        var newNode = this.itemTemplate.cloneNode(true);

        if(newNode instanceof(window.DocumentFragment)) {
            newNode = newNode.childNodes[0];
        }

        this.itemsContainer.appendChild(newNode);
        item.el = newNode;
        if(this.dataSource && this.dataSource.bind) {
            this.dataSource.bind(item.id, newNode);
        }
    }

    return item;
};

LiteList.prototype._syncViewItem = function syncViewItem(viewItem) {
    // If we have a dataSource
    if(this.dataSource && this.dataSource.sync) {
        this.dataSource.sync(viewItem.id, viewItem.el, viewItem.idx, viewItem.data);
    }
};

LiteList.prototype._positionViewItem = function positionViewItem(viewItem, force) {
    var idx  = viewItem.idx;
    var row  = Math.floor(idx/this.itemsPerRow);
    var col  = (idx % this.itemsPerRow);
    var top  = row * this.itemHeight + row * this.margin.y;
    var left = col * this.itemWidth  + col * this.margin.x;

    // Avoid triggering update if the value hasn't changed
    if(force || (viewItem.top  !== top) ) {
        viewItem.top  = top;

        if(viewItem.el) {
            viewItem.el.style.top = top + "px";
        }
    }

    if(force || (viewItem.left !== left)) {
        viewItem.left = left;

        if(viewItem.el) {
            viewItem.el.style.left = left + "px";
        }
    }
};

LiteList.prototype._ensureVisible = function _ensureVisible(done) {
    var percentInViewStart = ((this.scrollTop) / (this.height));
    var percentInViewEnd   = ((this.scrollTop + this.clientHeight) / (this.height));

    var oldStart, newStart, oldEnd, newEnd, i, viewItem;

    if(this.direction < 0) {
        oldEnd = this.viewBuffer.view[this.viewBuffer.tail].idx;
        newEnd = Math.ceil (percentInViewEnd   * this.viewBuffer.data.length);

        for (i = oldEnd; i > newEnd + this.itemsPerRow; --i) {
            viewItem = this.viewBuffer.shift(-1)[0];

            if (viewItem) {
                this._syncViewItem(viewItem);
                this._positionViewItem(viewItem);
            }
        }
    } else if(this.direction > 0) {
        oldStart = this.viewBuffer.view[this.viewBuffer.head].idx;
        newStart = Math.floor(percentInViewStart * this.viewBuffer.data.length);

        for(i = oldStart; i < newStart - this.itemsPerRow; ++i) {
            viewItem = this.viewBuffer.shift(1)[0];

            if(viewItem) {
                this._syncViewItem(viewItem);
                this._positionViewItem(viewItem);
            }
        }
    }

    done();
};

LiteList.prototype._resize = function _resize(done) {
    var newHeight    = this.view.clientHeight;
    var newWidth     = this.view.clientWidth;

    var newRowsPerPage     = Math.ceil (newHeight / (this.itemHeight + this.margin.y));
    var newItemsPerRow     = this.itemWidth ? Math.floor(newWidth  / (this.itemWidth  + this.margin.x)) : 1;

    var removed; //, inViewObj;
    if(newRowsPerPage !== this.rowsPerPage || newItemsPerRow !== this.itemsPerRow) {
        this._calcViewMetrics();
        this._calcDocHeight();

        var percentInView = this._firstVisibleItem / this.viewBuffer.data.length;
        this.scrollTop = this.view.scrollTop = Math.floor(this.height * percentInView);
        var newFirstVisible = Math.floor(this.scrollTop / (this.itemHeight + this.margin.y)) * newItemsPerRow;

        if (this.viewBuffer.view.length > this.maxBuffer) {
            removed = this.viewBuffer.resize(this.maxBuffer);

            if (this.dataSource && this.dataSource.unbind) {
                removed.forEach(function (inViewItem) {
                    this.dataSource.unbind(inViewItem.id, inViewItem.el);
                    this.itemsContainer.removeChild(inViewItem.el);
                }, this);
            }
        } else if (this.viewBuffer.view.length < this.maxBuffer) {
            this.viewBuffer.resize(Math.min(this.maxBuffer, this.viewBuffer.data.length))
                .forEach(function (item) {
                    this._initInViewItem(item);
                }, this);
        }

        var shiftAmt = newFirstVisible - this.viewBuffer.view[this.viewBuffer.head].idx - newItemsPerRow;
        this.viewBuffer.shift(shiftAmt);
        this.viewBuffer.view.forEach(function(item) {
            this._positionViewItem(item);
        }, this);
    }

    done();
};

LiteList.prototype._updateView = function _updateView() {
    var done = function() {
        this._firstVisibleItem = Math.floor(this.scrollTop / (this.itemHeight + this.margin.y)) * this.itemsPerRow;
        this._lastVisibleItem  = Math.ceil ((this.scrollTop + this.clientHeight)/(this.itemHeight + this.margin.y)) * this.itemsPerRow;

        this.dirtyResize = false;
        this.ticking     = false;
        this.direction   = 0;
    }.bind(this);

    if(this.dirtyResize) {
        this._resize(done);
    } else {
        this._ensureVisible(done);
    }
};

LiteList.prototype._requestTick = function requestTick() {
    if(!this.ticking) {
        this.ticking = window.requestAnimationFrame(this._updateView);
    }
};

LiteList.prototype.push = function push() {
    var args    = Array.prototype.slice.call(arguments);

    this.viewBuffer.data.push.apply(this.viewBuffer.data, args);

    var newInView = this.viewBuffer.resize(Math.min(this.maxBuffer, this.viewBuffer.data.length));

    newInView.forEach(function(inViewData) {
        this._initInViewItem(inViewData);
        this._syncViewItem(inViewData);
        this._positionViewItem(inViewData, true);
    }, this);

    this._calcDocHeight();
    this._requestTick();
};

LiteList.prototype.bind = function bind() {
    this.view.addEventListener("scroll", this._scrollHandler);
    window.addEventListener("resize", this._resizeHandler);

    if(this.scroll) { this.scroll.bind(); }
};

LiteList.prototype.unbind = function unbind() {
    this.view.removeEventListener("scroll", this._scrollHandler);
    window.removeEventListener("resize", this._resizeHandler);

    if(this.scroll) { this.scroll.unbind(); }
};

LiteList.prototype.clear = function clear() {
    var callUnbind = (this.dataSource && this.dataSource.unbind);

    this.view.scrollTop = this.scrollTop = 0;

    var itemsInView = this.viewBuffer.clear();

    // If we were given an item template, we need remove any nodes we've added
    if(this.itemTemplate) {
        itemsInView.forEach(function(item) {
            if(item.el)    { this.itemsContainer.removeChild(item.el); }
            if(callUnbind) { this.dataSource.unbind(item.id, item.el); }
        }.bind(this));
    }

    if(this.scroll) { this.scroll.reset(); }
    window.cancelAnimationFrame(this.ticking);
    this.ticking = 0;

    this._calcDocHeight();
};

LiteList.prototype.forEach = function forEach(/*fn, thisArg*/) {
    return this.items.forEach.apply(this.items, arguments);
};

LiteList.prototype.forEachInView = function () {
    this.viewBuffer.forEachInView.apply(this.viewBuffer, arguments);
};


LiteList.prototype.remove = function remove(searchIdx) {
    var result = this.viewBuffer.remove(searchIdx);

    result.newInView.forEach(function(item) {
        this._initInViewItem(item);
        this._syncViewItem(item);
        this._positionViewItem(item);
    }, this);

    if(this.itemTemplate || this.dataSource) {
        result.removed.forEach(function(item) {
            if(this.dataSource && this.dataSource.unbind) {
                this.datasource.unbind(item.id, item.el);
            }

            if(this.itemTemplate) {
                this.itemsContainer.removeChild(item.el);
            }
        }, this);
    }

    result.updated.forEach(function(item) {
        this._positionViewItem(item);
    }, this);

    this._calcDocHeight();
};

LiteList.prototype._scrollHandler = function scrollHandler(/*evt*/) {
    var scrollTop   = this.view.scrollTop;

    if(scrollTop !== this.scrollTop) {
        this.direction  = scrollTop > this.scrollTop ? 1 : -1;
        this.scrollTop  = scrollTop;
        this._requestTick();
    }
};

LiteList.prototype._resizeHandler = function resizeHandler(/*evt*/) {
    this.dirtyResize = true;
    this._requestTick();
};

// Version.
LiteList.VERSION = '0.4.6';


module.exports = LiteList;
},{"./viewbuffer":6}],4:[function(_dereq_,module,exports){
var LiteList = _dereq_('./litelist');
var rivets;

// Just here to simplify the initialization logic.  If
// window doesn't exist, this module is useless anyway
if(typeof window === 'undefined') { window = {}; }

// The build will declare TWEEN as external. However, if it isn't provided by
// browserify, we really want to check to see if it was included directly via
// script tag first.  Only if it isn't will we try a require.  This *should*
// make it easier to bundle/or not and to use with requirejs...
rivets = window.rivets || _dereq_("rivets");


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
    if(this.rvView) {
        this.rvView.unbind();

        // Pending the resolution of rivets#306  and rivets#307- this will be changed to rebind the view if the
        // view already exists.  Until that behavior is fixed, we'll go through the overhead of
        // creating a new view.
        this.rvView = false;
    }

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


},{"./litelist":3,"rivets":"4ZwREV"}],5:[function(_dereq_,module,exports){
// borrowed heavily from [ariya/kinetic](https://github.com/ariya/kinetic)
var TWEEN;

_dereq_("raf.js");

// Just here to simplify the initialization logic.  If
// window doesn't exist, this module is useless anyway
if(typeof window === 'undefined') { window = {}; }

// The build will declare TWEEN as external. However, if it isn't provided by
// browserify, we really want to check to see if it was included directly via
// script tag first.  Only if it isn't will we try a require.  This *should*
// make it easier to bundle/or not and to use with requirejs...
TWEEN = window.TWEEN || _dereq_("tween.js");

function Scroll(viewOrSelector, listener) {
    var view,
        min, max, offset, reference, pressed,
        velocity, frame, timestamp, ticker, tweenTicker,
        amplitude, target, timeConstant, innerHeight;

    var p0 = { y: 0 };
    var t0 = false;

    function ypos(e) {
        // touch event
        if (e.targetTouches && (e.targetTouches.length >= 1)) {
            return e.targetTouches[0].clientY;
        }

        // mouse event
        return e.clientY;
    }

    function scroll(y) {
        offset = (y > max) ? max : (y < min) ? min : y;

        view.scrollTop = offset;
        listener.call(view);
    }

    function track() {
        var now, elapsed, delta, v;

        now = Date.now();
        elapsed = now - timestamp;
        timestamp = now;
        delta = offset - frame;
        frame = offset;

        v = 1000 * delta / (1 + elapsed);
        velocity = 0.8 * v + 0.2 * velocity;
    }

    function tick() {
        TWEEN.update();
    }

    function tap(e) {
        pressed = true;
        reference = ypos(e);

        velocity = amplitude = 0;
        frame = offset;
        timestamp = Date.now();
        clearInterval(ticker);
        ticker = setInterval(track, 100);

        if(t0) {
            t0.stop();
            t0 = false;
        }
    }

    function drag(e) {
        var y, delta;
        if (pressed) {
            y = ypos(e);
            delta = reference - y;
            if (delta > 2 || delta < -2) {
                reference = y;
                scroll(offset + delta);
            }
        }
        e.preventDefault();
    }

    function release(/*e*/) {
        pressed = false;

        clearInterval(ticker);

        // If no velocity yet, track once make sure
        if(velocity === 0) { track(); }

        if (velocity > 10 || velocity < -10) {
            amplitude = 0.8 * velocity;
            target = Math.round(offset + amplitude);
            timestamp = Date.now();

            p0.y = view.scrollTop;
            t0 = new TWEEN.Tween(p0)
                .to({y: target}, timeConstant)
                .easing(TWEEN.Easing.Quintic.Out)
                .onUpdate(function() {
                    scroll(p0.y);
                    tweenTicker = window.requestAnimationFrame(tick);
                })
                .onComplete(function() {
                    scroll(p0.y);
                    t0.stop();
                    t0 = false;
                });

            t0.start();
            tweenTicker = window.requestAnimationFrame(tick);
        }
    }

    view = typeof viewOrSelector === 'string' ? document.querySelector(viewOrSelector) : viewOrSelector;
    this.bind = function attach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.addEventListener('touchstart', tap);
            view.addEventListener('touchmove', drag);
            view.addEventListener('touchend', release);
        }
    };

    this.unbind = function detach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.removeEventListener('touchstart', tap);
            view.removeEventListener('touchmove', drag);
            view.removeEventListener('touchend', release);
        }
    };

    this.reset = function reset() {
        max = parseInt(window.getComputedStyle(view).height, 10) - innerHeight;
        offset = min = 0;
        pressed = false;
        clearInterval(ticker);
        window.cancelAnimationFrame(tweenTicker);
    };

    timeConstant = 2000; // ms

    this.reset();
    this.bind();
}


module.exports = Scroll;

},{"raf.js":1,"tween.js":"yazFk1"}],6:[function(_dereq_,module,exports){
"use strict";

/*
 * Circular buffer representing a view on an array of entries.
 */
function ViewBuffer(data, initialSize) {
    this.head = this.tail = -1;
    this.size = 0;
    this.data = data || [];
    this.view = [];

    // Special case here
    if(initialSize) { this.resize(initialSize); }
}

/*
 * Shrink the view buffer
 *
 * @param newSize
 * @param head:     if true, will shrink relative to head.
 *
 * @returns: Array of removed view buffer entries
 */
function _shrink(newSize, head) {
    /*jshint validthis:true */
    var delta = [];
    var view  = this.view;
    var shrinkage = view.length - newSize;
    var spliced;

    if(newSize >= view.length) {
        throw new Error("Unable to shrink to a size larger than the current size");
    }

    while(shrinkage && view.length > 0) {
        spliced = view.splice(head ? this.head : this.tail, 1);
        delta.push(spliced[0]);

        // When shrinking from head, the only time the heads resulting value changes is
        // if head is at the end of the list.  So it is safe to take the modulo of head
        // against the new view length;
        //
        // Tail is then the modulo of head + 1;
        if(head) {
            this.head = this.head % view.length;
            this.tail = (this.head + 1) % view.length;
        } else if(this.tail < this.head) {
            this.tail = this.tail - 1;
            this.head = this.head - 1;

            if(this.tail < 0) { this.tail = view.length - 1; }
        } else if(this.tail > this.head) {
            this.tail = this.tail - 1;
        } else {
            // They are equal when both are zero
            this.head = this.tail = -1;
        }

        --shrinkage;
    }

    if(view.length === 0) {
        this.head = this.tail = -1;
    }

    this.size = view.length;
    return delta;
}

/*
 * Grows the view buffer:  the view buffer will grow in the requested direction
 * as much as it can.  When it reaches a limit, it will try to grow in the opposite
 * direction as well.
 *
 * @param newSize
 * @param head:     if true, will grow relative to head
 *
 * @returns: Array of newly initialized view buffer entries
 */
function _grow(newSize, head) {
    /*jshint validthis:true */
    var delta = [];
    var view   = this.view;
    var data   = this.data;
    var growth = newSize - view.length;
    var newEntry;

    if(newSize > data.length) {
        throw new Error("Unable to grow to a size larger than the current dataset");
    }

    if(growth < 0) {
        throw new Error("Unable to grow to a size smaller than the current size");
    }

    // Nothing to do here, just return an empty delta
    if(growth === 0) {
        return delta;
    }

    while(growth) {
        if(this.head === -1 && this.tail === -1) {
            newEntry = {
                idx:  0,
                data: data[0]
            };

            view.push(newEntry);
            this.head = this.tail = 0;
        }
        else if(head && view[this.head].idx > 0) {
            newEntry = {
                idx:  view[this.head].idx - 1,
                data: data[view[this.head].idx - 1]
            };

            // always safe to add after the tail
            view.splice(this.head, 0, newEntry);

            // Head doesn't change
            this.tail = (this.head - 1 + view.length) % view.length;
        } else if(view[this.tail].idx < data.length - 1) {
            newEntry = {
                idx:  view[this.tail].idx + 1,
                data: data[view[this.tail].idx + 1]
            };

            view.splice(this.tail + 1, 0, newEntry);
            this.tail = this.tail + 1;
            this.head = (this.tail + 1) % view.length;

            // If we can't add anymore at the tail, force this into
            // the head logic which will only grow when the idx > 0
            if(newEntry.idx === data.length - 1) {
                head = true;
            }
        } else if(view[this.tail].idx === data.length - 1) {
            // Special case - if the view is at the end of the list
            // set head to true and loop around without decrementing
            // growth
            head = true;
            continue;
        }

        if(newEntry) { delta.push(newEntry); }
        newEntry = false;
        --growth;
    }

    this.size = view.length;
    return delta;
}

/*
 * Moves the buffer towards the end of the data array
 */
function _shiftRight(count) {
    /*jshint validthis:true */
    var view        = this.view;
    var newInView   = [];
    var curTailIdx;
    var tail = this.tail;
    var head = this.head;

    count = count || 1;

    while(count) {
        curTailIdx  = view[tail].idx;

        // Early return if we are already at the end
        if(curTailIdx === this.data.length - 1) {
            this.tail = tail;
            this.head = head;
            return newInView;
        }

        tail = (tail + 1) % view.length;
        head = (head + 1) % view.length;

        view[tail].idx  = curTailIdx + 1;
        view[tail].data = this.data[curTailIdx + 1];

        newInView.push(view[tail]);

        // Only maintain at most view.length items
        if(newInView.length > view.length) {
            newInView.shift();
        }

        --count;
    }

    this.tail = tail;
    this.head = head;

    return newInView;
}

/*
 * Moves the buffer towards the beginning of the data array
 */
function _shiftLeft(count) {
    /*jshint validthis:true */
    var view        = this.view;
    var newInView   = [];
    var head        = this.head;
    var tail        = this.tail;
    var data        = this.data;
    var curHeadIdx;

    count = count || 1;
    while(count) {
        curHeadIdx  = view[head].idx;

        // Early return if we are already at the beginning
        if(curHeadIdx === 0) {
            this.head = head;
            this.tail = tail;
            return newInView;
        }

        head = (head - 1 + view.length) % view.length;
        tail = (tail - 1 + view.length) % view.length;

        view[head].idx  = curHeadIdx - 1;
        view[head].data = data[curHeadIdx - 1];

        newInView.push(view[head]);

        // Only maintain at most view.length items
        if(newInView.length > view.length) {
            newInView.shift();
        }

        --count;
    }

    this.head = head;
    this.tail = tail;
    return newInView;
}

/*
 * Moves the buffer towards the end (count > 0) or
 * beginning (count < 0) of the data array;
 *
 * @returns array of new data elements in the view buffer
 */
ViewBuffer.prototype.shift = function shift(count) {
    var fn;

    count = count || 1;
    fn    = count > 0 ? _shiftRight : _shiftLeft;

    return fn.call(this, Math.abs(count));
};

/*
 * Resize the view buffer - either growing or shrinking it.
 *
 * @param newSize - the new size of the view buffer
 * @param head    - if true, prefer resizing based on the head rather than the tail
 *
 * @returns       - Array of added or removed items
 */
ViewBuffer.prototype.resize = function resize(newSize, head) {
    if(newSize > this.view.length) {
        return _grow.call(this, newSize, head);
    } else if(newSize < this.view.length) {
        return _shrink.call(this, newSize, head);
    } else {
        return [];
    }
};

/*
 * Resets the view buffer back to zero (data and view)
 *
 * @returns: list of view items;
 */
ViewBuffer.prototype.clear = function clear() {
    var inViewItems = this.view.slice(0); // make a copy

    // Do this in place to be friendly to libraries (Rivets for example)
    // that bind to observe changes
    this.view.splice(0, Number.MAX_VALUE);
    this.data.splice(0, Number.MAX_VALUE);

    this.head = this.tail = -1;
    this.size = 0;

    return inViewItems;
};

/*
 * Locates an item in the view by its index in data if it exists
 *
 * @param idx  - Index in the data array
 *
 * @returns    - Index in the view if it is found or -1 if not
 */
ViewBuffer.prototype.findDataIndexInView = function findDataIndexInView(idx) {
    var view = this.view;
    var len  = view.length;
    for(var i = 0; i < len; ++i) {
        if(view[i].idx === idx) {
            return i;
        }
    }

    return -1;
};

/*
 * Removes an entry from data and adjusts the view if necessary
 *
 * @param idx   - index of the item to be removed
 *
 * @returns {
 *      newInView:   If a data item was moved into the view as a result of removing an item, an array
 *                   containing the newly added item.
 *      removed:     If the view size was modified as a result of the removal, an array containing
 *                   the removed item.
 *      updated:     list of data items that changed positions within the view.
 * }
 */
ViewBuffer.prototype.remove = function remove(idx) {
    //var idxToRemove  = false;
    var head         = this.head;
    var tail         = this.tail;
    var view         = this.view;
    var data         = this.data;
    var viewIdx, from, to, resetViewIdx = false;

    var retVal = {
        newInView: [],
        removed:   [],
        updated:   []
    };

    var added, removed, i;

    idx = +idx; // Make sure it is a number

    // If idx >= the total number of items in the list, throw an error
    if(idx >= this.data.length) {
        throw new Error("index out of bounds");
    }

    // Remove it from items
    this.data.splice(idx, 1);

    // If greater than the tail IDX, it is not in the view and no adjustments
    // are necessary to any view items.
    if(idx > this.view[this.tail].idx) {
        return retVal;
    }

    // If less than the head IDX, it is not in the view, but all view items
    // need to be adjusted back by one to reference the correct data index
    //
    // Need to think about whether anything was really updated here.  Idx is
    // mostly an internal implementation detail and that is all that has been
    // updated in this case.
    if(idx < view[head].idx) {
        view.forEach(function(item) {
            item.idx = item.idx - 1;
            retVal.updated.push(item);
        });

        return retVal;
    }

    from = viewIdx = this.findDataIndexInView(idx);
    if(viewIdx === head) {
        if(head === 0) {
            to = this.tail = tail - 1;
        } else if(head === view.length - 1) {
            this.head = 0;
            resetViewIdx = true; // viewIdx needs to be set at 0 since it was removed from the tail
            to = tail;
        } else {
            to = tail + view.length - 1;
        }
    } else if(viewIdx === tail) {
        // None of these require modifying idx - the loop to update idx will never be entered
        if(tail === view.length - 1) {
            to = this.tail = tail - 1;
        } else if(tail === 0) {
            this.tail = view.length - 2;
            this.head = 0;
            to = -1;
        } else {
            to = this.tail = this.tail - 1;
            this.head = head - 1;
        }
    } else if(viewIdx < head && viewIdx < tail) {
        to = this.tail = tail - 1;
        this.head = head - 1;
    } else if(viewIdx > head && viewIdx < tail) {
        to = this.tail = tail - 1;
    } else if(viewIdx > head && viewIdx > tail) {
        to = tail + view.length - 1;
    }

    this.size = this.size - 1;
    removed = view.splice(viewIdx, 1);

    viewIdx = resetViewIdx ? 0 : viewIdx;
    for(i = viewIdx; i <= to; ++i) {
        --view[i % view.length].idx;
        retVal.updated.push(view[i % view.length]);
    }

    if(data.length > view.length) {
        added = this.resize(view.length + 1);
    }

    retVal.removed.push.apply(retVal.removed, removed);
    retVal.newInView.push.apply(retVal.newInView, added);
    return retVal;
};

/*
 * Iterates through all items currently in the circular buffer starting at the logical
 * first item rather than at the beginning of the view array.  The callback signature
 * is similar to Array.forEach, however both the raw index and the logical index are
 * passed.
 *
 * callback is invoked with four arguments:
 *
 *      the view item
 *      the view items logical index
 *      the view items physical index
 *      the view
 */
ViewBuffer.prototype.forEachInView = function forEachInView(cb, useAsThis) {
    var view  = this.view;
    var len   = view.length;
    var head  = this.head;
    var tail  = this.tail;
    var to    = tail < head ? tail + len : tail;
    var i, curItem, realIdx;

    useAsThis = useAsThis || this;

    for(i = head; i <= to; ++i) {
        realIdx = i % len;
        curItem = view[realIdx];

        cb.call(useAsThis, curItem, i - head, realIdx, view);
    }
};

module.exports = ViewBuffer;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvYnVuZGxlZC5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvbGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3J2bGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3Njcm9sbC5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvdmlld2J1ZmZlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qXG4gKiByYWYuanNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uZ3J5bWFuL3JhZi5qc1xuICpcbiAqIG9yaWdpbmFsIHJlcXVlc3RBbmltYXRpb25GcmFtZSBwb2x5ZmlsbCBieSBFcmlrIE3DtmxsZXJcbiAqIGluc3BpcmVkIGZyb20gcGF1bF9pcmlzaCBnaXN0IGFuZCBwb3N0XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIG5ncnltYW5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuXG4oZnVuY3Rpb24od2luZG93KSB7XG5cdHZhciBsYXN0VGltZSA9IDAsXG5cdFx0dmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddLFxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUsXG5cdFx0aSA9IHZlbmRvcnMubGVuZ3RoO1xuXG5cdC8vIHRyeSB0byB1bi1wcmVmaXggZXhpc3RpbmcgcmFmXG5cdHdoaWxlICgtLWkgPj0gMCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdDYW5jZWxBbmltYXRpb25GcmFtZSddO1xuXHR9XG5cblx0Ly8gcG9seWZpbGwgd2l0aCBzZXRUaW1lb3V0IGZhbGxiYWNrXG5cdC8vIGhlYXZpbHkgaW5zcGlyZWQgZnJvbSBAZGFyaXVzIGdpc3QgbW9kOiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvMTU3OTY3MSNjb21tZW50LTgzNzk0NVxuXHRpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCksIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcblx0XHRcdHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTtcblx0XHRcdH0sIG5leHRUaW1lIC0gbm93KTtcblx0XHR9O1xuXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XG5cdH1cblxuXHQvLyBleHBvcnQgdG8gd2luZG93XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lO1xufSh3aW5kb3cpKTsiLCJ2YXIgTGl0ZUxpc3QgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL2xpdGVsaXN0XCIpO1xuTGl0ZUxpc3QuUml2ZXRzTGl0ZUxpc3QgPSByZXF1aXJlKFwiLi9ydmxpdGVsaXN0XCIpO1xuTGl0ZUxpc3QuU2Nyb2xsICAgICAgICAgPSByZXF1aXJlKFwiLi9zY3JvbGxcIik7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBMaXRlTGlzdDsiLCJ2YXIgVmlld0J1ZmZlciA9IHJlcXVpcmUoJy4vdmlld2J1ZmZlcicpO1xuXG4vKlxuICogTGl0ZUxpc3RcbiAqXG4gKiBvcHRzOiB7XG4gKiAgaXRlbVdpZHRoICAgICAgIDogT3B0aW9uYWwgLSB3aWR0aCBvZiBlYWNoIGl0ZW0uICBJZiBub3QgcHJvdmlkZSBvbmUgaXRlbSBwZXIgcm93IGlzIGFzc3VtZWRcbiAqICBpdGVtSGVpZ2h0ICAgICAgOiBSZXF1aXJlZCAtIGhlaWdodCBvZiBlYWNoIGl0ZW0uXG4gKiAgbWFyZ2luICAgICAgICAgIDogT3B0aW9uYWwgLSBtYXJnaW4vZ3V0dGVycyBmb3IgdGhlIGl0ZW1zLiAgRGVmYXVsdHMgdG86IHsgeDogMCwgeTogMCB9O1xuICogIHNjcm9sbFZpZXcgICAgICA6IFJlcXVpcmVkIC0gcXVlcnkgc2VsZWN0b3IgZm9yIHRoZSBzY3JvbGxhYmxlIGNvbnRhaW5lclxuICogIGl0ZW1zQ29udGFpbmVyICA6IE9wdGlvbmFsIC0gcXVlcnkgc2VsZWN0b3IgY29udGFpbmVyIG9mIHRoZSBpdGVtcy4gIERlZmF1bHRzIHRvIHRoZSBmaXJzdCBjaGlsZCBvZiBzY3JvbGxWaWV3XG4gKiAgZGVsYXlCaW5kICAgICAgIDogT3B0aW9uYWwgLSBpZiB0cnVlIHdpbGwgd2FpdCBmb3IgYSBjYWxsIHRvIGxpdGVMaXN0LmJpbmQoKSB0byBhdHRhY2ggYW55IGhhbmRsZXJzXG4gKlxuICogIC8vIFRoZSBuZXh0IHR3byBhcmUgcmVxdWlyZWQgZm9yIGEgdmFuaWxsYSBqYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIHRvIGJlIGZ1bmN0aW9uYWwuICBMaXN0TGlzdCB3YXNcbiAqICAvLyB3cml0dGVuIHRvIHdvcmsgd2l0aCB0aGUgUml2ZXRzIGxpYnJhcnkgd2hpY2ggcHJvdmlkZXMgdGhpcyBmdW5jdGlvbmFsaXR5IGFzIHdlbGwuICBJbiB0aGF0IGNhc2UsXG4gKiAgLy8gaXQgaXMgb3B0aW9uYWwuICBpLmUuIHRoZSBMaXRlTGlzdCB3aWxsIGNvbnRpbnVlIG9uIGlmIHRoZXNlIGFyZSBub3QgcHJvdmlkZWQuXG4gKiAgaXRlbVRlbXBsYXRlICAgIDogUmVxdWlyZWQgLSBET00gbm9kZSB0aGF0IHdpbGwgYmUgY2xvbmVkIGFzIGEgdGVtcGxhdGUgZm9yIGVhY2ggaXRlbS5cbiAqICBkYXRhU291cmNlICAgICAgOiBSZXF1aXJlZCAtIEltcGxlbWVudGF0aW9uIG9mIHRoZSBkYXRhU291cmNlIGNvbnRyYWN0IChzZWUgYmVsb3cgZm9yIG1vcmUgZGV0YWlscykuXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIExpdGVMaXN0KG9wdHMpIHtcbiAgICB0aGlzLnZpZXdCdWZmZXIgICAgICA9IG5ldyBWaWV3QnVmZmVyKCk7XG4gICAgdGhpcy5pdGVtV2lkdGggICAgICAgPSBvcHRzLml0ZW1XaWR0aCB8fCAwO1xuICAgIHRoaXMuaXRlbUhlaWdodCAgICAgID0gb3B0cy5pdGVtSGVpZ2h0O1xuICAgIHRoaXMubWFyZ2luICAgICAgICAgID0gb3B0cy5tYXJnaW4gfHwgeyB4OiAwLCB5OiAwIH07XG4gICAgdGhpcy5kYXRhU291cmNlICAgICAgPSBvcHRzLmRhdGFTb3VyY2UgfHwgZmFsc2U7XG4gICAgdGhpcy5pdGVtVGVtcGxhdGUgICAgPSBvcHRzLml0ZW1UZW1wbGF0ZSB8fCBmYWxzZTtcbiAgICB0aGlzLnNjcm9sbFRvcCAgICAgICA9IDA7XG4gICAgdGhpcy5kaXJ0eVJlc2l6ZSAgICAgPSB0cnVlO1xuICAgIHRoaXMudGlja2luZyAgICAgICAgID0gZmFsc2U7XG4gICAgdGhpcy5kaXJlY3Rpb24gICAgICAgPSAwO1xuXG4gICAgLy8gVmlldyBNZXRyaWNzXG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSAwO1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gMDtcbiAgICB0aGlzLnJvd3NQZXJQYWdlICAgICA9IDA7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSAwO1xuICAgIHRoaXMuaXRlbXNQZXJQYWdlICAgID0gMDtcbiAgICB0aGlzLm1heEJ1ZmZlciAgICAgICA9IDA7XG4gICAgdGhpcy5oZWlnaHQgICAgICAgICAgPSAwO1xuXG4gICAgLy8gaW50ZXJuYWwgc3RhdGVcbiAgICB0aGlzLl9maXJzdFZpc2libGVJdGVtID0gMDtcbiAgICB0aGlzLl9sYXN0VmlzaWJsZUl0ZW0gID0gMDtcblxuICAgIC8vIEdldCB0aGUgY29udGFpbmVyIGVsZW1lbnRzXG4gICAgdGhpcy52aWV3ICAgICAgICAgICAgPSBvcHRzLnNjcm9sbFZpZXc7XG4gICAgdGhpcy5pdGVtc0NvbnRhaW5lciAgPSBvcHRzLml0ZW1zQ29udGFpbmVyIHx8IGZhbHNlO1xuXG4gICAgLy8gSWYgaXQgaXMgYSBzdHJpbmcsIGl0IHNob3VsZCBiZSBhIHF1ZXJ5IHNlbGVjdG9yIC0gb3RoZXJ3aXNlIHdlIGFyZSBleHBlY3RpbmcgYW4gZWxlbWVudC5cbiAgICB0aGlzLnZpZXcgICAgICAgICAgICA9ICh0eXBlb2YgdGhpcy52aWV3ICAgICAgICAgICA9PT0gJ3N0cmluZycgfHwgdGhpcy52aWV3IGluc3RhbmNlb2YgU3RyaW5nKSAgICAgICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMudmlldykgICAgICAgICAgIDogdGhpcy52aWV3O1xuICAgIHRoaXMuaXRlbXNDb250YWluZXIgID0gKHR5cGVvZiB0aGlzLml0ZW1zQ29udGFpbmVyID09PSAnc3RyaW5nJyB8fCB0aGlzLml0ZW1zQ29udGFpbmVyIGluc3RhbmNlb2YgU3RyaW5nKSA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0cy5pdGVtc0NvbnRhaW5lcikgOiB0aGlzLml0ZW1zQ29udGFpbmVyO1xuXG4gICAgLy8gS2VlcCB0cmFjayBvZiBhIHVuaXF1ZSBpZCBmb3Igdmlld0l0ZW1zIC0gYWxsb3dzIFRoaXMgaXMgcGFzc2VkIHRvXG4gICAgLy8gZGF0YXNvdXJjZSBwcm92aWRlcnMgdG8gYWlkIGluIHRyYWNraW5nLlxuICAgIHRoaXMuX2lkID0gMDtcblxuICAgIC8vIElmIG5vdCBwYXNzZWQgYSBwYWdlIHNlbGVjdG9yLCBhc3N1bWUgaXQncyB0aGUgZmlyc3QgY2hpbGRcbiAgICBpZighdGhpcy5pdGVtc0NvbnRhaW5lcikge1xuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyID0gdGhpcy52aWV3LmNoaWxkcmVuWzBdO1xuICAgIH1cblxuICAgIC8vIF91cGRhdGVWaWV3IGlzIHVzZWQgaW4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIC0gYmluZCBpdCB0byB0aGlzXG4gICAgdGhpcy5fdXBkYXRlVmlldyA9IHRoaXMuX3VwZGF0ZVZpZXcuYmluZCh0aGlzKTtcblxuICAgIC8vIEludm9rZWQgYXMgYSByZXN1bHQgb2YgZXZlbnQgbGlzdGVuZXJzIC0gYmluZCB0aGVtIHRvIHRoaXNcbiAgICB0aGlzLl9zY3JvbGxIYW5kbGVyID0gdGhpcy5fc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX3Jlc2l6ZUhhbmRsZXIgPSB0aGlzLl9yZXNpemVIYW5kbGVyLmJpbmQodGhpcyk7XG5cbiAgICAvLyBFbnN1cmUgdmFsaWQgdmlldyBtZXRyaWNzXG4gICAgdGhpcy5fY2FsY1ZpZXdNZXRyaWNzKCk7XG5cbiAgICAvLyBiaW5kIGFueSBldmVudCBoYW5kbGVycyBub3cgaWYgbm90IGFza2VkIHRvIGRlbGF5XG4gICAgaWYoIW9wdHMuZGVsYXlCaW5kKSB7XG4gICAgICAgIHRoaXMuYmluZCgpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGtub3cgYWJvdXQgU2Nyb2xsLCBhdHRhY2ggaXQgbm93XG4gICAgdGhpcy5zY3JvbGwgPSBMaXRlTGlzdC5TY3JvbGwgPyBuZXcgTGl0ZUxpc3QuU2Nyb2xsKG9wdHMuc2Nyb2xsVmlldywgdGhpcy5fc2Nyb2xsSGFuZGxlcikgOiBmYWxzZTtcblxuICAgIC8vIEtpY2tzIG9mZiBhIGxheW91dCAoZGlydHlSZXNpemUgZGVmYXVsdHMgdG8gdHJ1ZSlcbiAgICAvLyBUaGlzIHdpbGwgbGF5b3V0IGV2ZXJ5dGhpbmcgbmljZWx5IGZpbGxpbmcgYWxsIGNvbHVtbnNcbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn1cblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjVmlld01ldHJpY3MgPSBmdW5jdGlvbiBjYWxjVmlld01ldHJpY3MoKSB7XG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gdGhpcy52aWV3LmNsaWVudFdpZHRoO1xuICAgIHRoaXMucm93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsICh0aGlzLmNsaWVudEhlaWdodCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSk7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IodGhpcy5jbGllbnRXaWR0aCAgLyAodGhpcy5pdGVtV2lkdGggICsgdGhpcy5tYXJnaW4ueCkpIDogMTtcbiAgICB0aGlzLml0ZW1zUGVyUGFnZSAgICA9IHRoaXMucm93c1BlclBhZ2UgKiB0aGlzLml0ZW1zUGVyUm93O1xuICAgIHRoaXMubWF4QnVmZmVyICAgICAgID0gdGhpcy5pdGVtc1BlclBhZ2UgKiAzO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjRG9jSGVpZ2h0ID0gZnVuY3Rpb24gY2FsY0RvY0hlaWdodCgpIHtcbiAgICB2YXIgcm93ID0gTWF0aC5jZWlsKHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aC90aGlzLml0ZW1zUGVyUm93KTtcbiAgICB2YXIgbmV3SGVpZ2h0ID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcblxuICAgIGlmKG5ld0hlaWdodCAhPT0gdGhpcy5oZWlnaHQpIHtcbiAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBuZXdIZWlnaHQgKyBcInB4XCI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gbmV3SGVpZ2h0O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5oZWlnaHQ7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2luaXRJblZpZXdJdGVtID0gZnVuY3Rpb24gX2luaXRJblZpZXdJdGVtKGl0ZW0pIHtcbiAgICBpdGVtLmlkICAgPSB0aGlzLl9pZCsrO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHRvIGFkZCBhIGNsb25lXG4gICAgLy8gdG8gdGhlIGRvbVxuICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlKSB7XG4gICAgICAgIHZhciBuZXdOb2RlID0gdGhpcy5pdGVtVGVtcGxhdGUuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgICAgIGlmKG5ld05vZGUgaW5zdGFuY2VvZih3aW5kb3cuRG9jdW1lbnRGcmFnbWVudCkpIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBuZXdOb2RlLmNoaWxkTm9kZXNbMF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5ld05vZGUpO1xuICAgICAgICBpdGVtLmVsID0gbmV3Tm9kZTtcbiAgICAgICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS5iaW5kKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGFTb3VyY2UuYmluZChpdGVtLmlkLCBuZXdOb2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVtO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9zeW5jVmlld0l0ZW0gPSBmdW5jdGlvbiBzeW5jVmlld0l0ZW0odmlld0l0ZW0pIHtcbiAgICAvLyBJZiB3ZSBoYXZlIGEgZGF0YVNvdXJjZVxuICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2Uuc3luYykge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc3luYyh2aWV3SXRlbS5pZCwgdmlld0l0ZW0uZWwsIHZpZXdJdGVtLmlkeCwgdmlld0l0ZW0uZGF0YSk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvblZpZXdJdGVtID0gZnVuY3Rpb24gcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSwgZm9yY2UpIHtcbiAgICB2YXIgaWR4ICA9IHZpZXdJdGVtLmlkeDtcbiAgICB2YXIgcm93ICA9IE1hdGguZmxvb3IoaWR4L3RoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciBjb2wgID0gKGlkeCAlIHRoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciB0b3AgID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcbiAgICB2YXIgbGVmdCA9IGNvbCAqIHRoaXMuaXRlbVdpZHRoICArIGNvbCAqIHRoaXMubWFyZ2luLng7XG5cbiAgICAvLyBBdm9pZCB0cmlnZ2VyaW5nIHVwZGF0ZSBpZiB0aGUgdmFsdWUgaGFzbid0IGNoYW5nZWRcbiAgICBpZihmb3JjZSB8fCAodmlld0l0ZW0udG9wICAhPT0gdG9wKSApIHtcbiAgICAgICAgdmlld0l0ZW0udG9wICA9IHRvcDtcblxuICAgICAgICBpZih2aWV3SXRlbS5lbCkge1xuICAgICAgICAgICAgdmlld0l0ZW0uZWwuc3R5bGUudG9wID0gdG9wICsgXCJweFwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoZm9yY2UgfHwgKHZpZXdJdGVtLmxlZnQgIT09IGxlZnQpKSB7XG4gICAgICAgIHZpZXdJdGVtLmxlZnQgPSBsZWZ0O1xuXG4gICAgICAgIGlmKHZpZXdJdGVtLmVsKSB7XG4gICAgICAgICAgICB2aWV3SXRlbS5lbC5zdHlsZS5sZWZ0ID0gbGVmdCArIFwicHhcIjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fZW5zdXJlVmlzaWJsZSA9IGZ1bmN0aW9uIF9lbnN1cmVWaXNpYmxlKGRvbmUpIHtcbiAgICB2YXIgcGVyY2VudEluVmlld1N0YXJ0ID0gKCh0aGlzLnNjcm9sbFRvcCkgLyAodGhpcy5oZWlnaHQpKTtcbiAgICB2YXIgcGVyY2VudEluVmlld0VuZCAgID0gKCh0aGlzLnNjcm9sbFRvcCArIHRoaXMuY2xpZW50SGVpZ2h0KSAvICh0aGlzLmhlaWdodCkpO1xuXG4gICAgdmFyIG9sZFN0YXJ0LCBuZXdTdGFydCwgb2xkRW5kLCBuZXdFbmQsIGksIHZpZXdJdGVtO1xuXG4gICAgaWYodGhpcy5kaXJlY3Rpb24gPCAwKSB7XG4gICAgICAgIG9sZEVuZCA9IHRoaXMudmlld0J1ZmZlci52aWV3W3RoaXMudmlld0J1ZmZlci50YWlsXS5pZHg7XG4gICAgICAgIG5ld0VuZCA9IE1hdGguY2VpbCAocGVyY2VudEluVmlld0VuZCAgICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSBvbGRFbmQ7IGkgPiBuZXdFbmQgKyB0aGlzLml0ZW1zUGVyUm93OyAtLWkpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KC0xKVswXTtcblxuICAgICAgICAgICAgaWYgKHZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih0aGlzLmRpcmVjdGlvbiA+IDApIHtcbiAgICAgICAgb2xkU3RhcnQgPSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4O1xuICAgICAgICBuZXdTdGFydCA9IE1hdGguZmxvb3IocGVyY2VudEluVmlld1N0YXJ0ICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IoaSA9IG9sZFN0YXJ0OyBpIDwgbmV3U3RhcnQgLSB0aGlzLml0ZW1zUGVyUm93OyArK2kpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KDEpWzBdO1xuXG4gICAgICAgICAgICBpZih2aWV3SXRlbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkb25lKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Jlc2l6ZSA9IGZ1bmN0aW9uIF9yZXNpemUoZG9uZSkge1xuICAgIHZhciBuZXdIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHZhciBuZXdXaWR0aCAgICAgPSB0aGlzLnZpZXcuY2xpZW50V2lkdGg7XG5cbiAgICB2YXIgbmV3Um93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsIChuZXdIZWlnaHQgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpO1xuICAgIHZhciBuZXdJdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IobmV3V2lkdGggIC8gKHRoaXMuaXRlbVdpZHRoICArIHRoaXMubWFyZ2luLngpKSA6IDE7XG5cbiAgICB2YXIgcmVtb3ZlZDsgLy8sIGluVmlld09iajtcbiAgICBpZihuZXdSb3dzUGVyUGFnZSAhPT0gdGhpcy5yb3dzUGVyUGFnZSB8fCBuZXdJdGVtc1BlclJvdyAhPT0gdGhpcy5pdGVtc1BlclJvdykge1xuICAgICAgICB0aGlzLl9jYWxjVmlld01ldHJpY3MoKTtcbiAgICAgICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuXG4gICAgICAgIHZhciBwZXJjZW50SW5WaWV3ID0gdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSAvIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aDtcbiAgICAgICAgdGhpcy5zY3JvbGxUb3AgPSB0aGlzLnZpZXcuc2Nyb2xsVG9wID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAqIHBlcmNlbnRJblZpZXcpO1xuICAgICAgICB2YXIgbmV3Rmlyc3RWaXNpYmxlID0gTWF0aC5mbG9vcih0aGlzLnNjcm9sbFRvcCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiBuZXdJdGVtc1BlclJvdztcblxuICAgICAgICBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoID4gdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHJlbW92ZWQgPSB0aGlzLnZpZXdCdWZmZXIucmVzaXplKHRoaXMubWF4QnVmZmVyKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uIChpblZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQoaW5WaWV3SXRlbS5pZCwgaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoIDwgdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpXG4gICAgICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2hpZnRBbXQgPSBuZXdGaXJzdFZpc2libGUgLSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4IC0gbmV3SXRlbXNQZXJSb3c7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci5zaGlmdChzaGlmdEFtdCk7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci52aWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZG9uZSgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl91cGRhdGVWaWV3ID0gZnVuY3Rpb24gX3VwZGF0ZVZpZXcoKSB7XG4gICAgdmFyIGRvbmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSA9IE1hdGguZmxvb3IodGhpcy5zY3JvbGxUb3AgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpICogdGhpcy5pdGVtc1BlclJvdztcbiAgICAgICAgdGhpcy5fbGFzdFZpc2libGVJdGVtICA9IE1hdGguY2VpbCAoKHRoaXMuc2Nyb2xsVG9wICsgdGhpcy5jbGllbnRIZWlnaHQpLyh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiB0aGlzLml0ZW1zUGVyUm93O1xuXG4gICAgICAgIHRoaXMuZGlydHlSZXNpemUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50aWNraW5nICAgICA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbiAgID0gMDtcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZih0aGlzLmRpcnR5UmVzaXplKSB7XG4gICAgICAgIHRoaXMuX3Jlc2l6ZShkb25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9lbnN1cmVWaXNpYmxlKGRvbmUpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcmVxdWVzdFRpY2sgPSBmdW5jdGlvbiByZXF1ZXN0VGljaygpIHtcbiAgICBpZighdGhpcy50aWNraW5nKSB7XG4gICAgICAgIHRoaXMudGlja2luZyA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fdXBkYXRlVmlldyk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoKCkge1xuICAgIHZhciBhcmdzICAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIHRoaXMudmlld0J1ZmZlci5kYXRhLnB1c2guYXBwbHkodGhpcy52aWV3QnVmZmVyLmRhdGEsIGFyZ3MpO1xuXG4gICAgdmFyIG5ld0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpO1xuXG4gICAgbmV3SW5WaWV3LmZvckVhY2goZnVuY3Rpb24oaW5WaWV3RGF0YSkge1xuICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpblZpZXdEYXRhKTtcbiAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKGluVmlld0RhdGEpO1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGluVmlld0RhdGEsIHRydWUpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC5iaW5kKCk7IH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC51bmJpbmQoKTsgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKSB7XG4gICAgdmFyIGNhbGxVbmJpbmQgPSAodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpO1xuXG4gICAgdGhpcy52aWV3LnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsVG9wID0gMDtcblxuICAgIHZhciBpdGVtc0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5jbGVhcigpO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHJlbW92ZSBhbnkgbm9kZXMgd2UndmUgYWRkZWRcbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICBpdGVtc0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKGl0ZW0uZWwpICAgIHsgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpdGVtLmVsKTsgfVxuICAgICAgICAgICAgaWYoY2FsbFVuYmluZCkgeyB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpOyB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5zY3JvbGwpIHsgdGhpcy5zY3JvbGwucmVzZXQoKTsgfVxuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnRpY2tpbmcpO1xuICAgIHRoaXMudGlja2luZyA9IDA7XG5cbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2goLypmbiwgdGhpc0FyZyovKSB7XG4gICAgcmV0dXJuIHRoaXMuaXRlbXMuZm9yRWFjaC5hcHBseSh0aGlzLml0ZW1zLCBhcmd1bWVudHMpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmZvckVhY2hJblZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy52aWV3QnVmZmVyLmZvckVhY2hJblZpZXcuYXBwbHkodGhpcy52aWV3QnVmZmVyLCBhcmd1bWVudHMpO1xufTtcblxuXG5MaXRlTGlzdC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKHNlYXJjaElkeCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnZpZXdCdWZmZXIucmVtb3ZlKHNlYXJjaElkeCk7XG5cbiAgICByZXN1bHQubmV3SW5WaWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKGl0ZW0pO1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGl0ZW0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYodGhpcy5pdGVtVGVtcGxhdGUgfHwgdGhpcy5kYXRhU291cmNlKSB7XG4gICAgICAgIHJlc3VsdC5yZW1vdmVkLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFzb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaXRlbS5lbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHJlc3VsdC51cGRhdGVkLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGl0ZW0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9zY3JvbGxIYW5kbGVyID0gZnVuY3Rpb24gc2Nyb2xsSGFuZGxlcigvKmV2dCovKSB7XG4gICAgdmFyIHNjcm9sbFRvcCAgID0gdGhpcy52aWV3LnNjcm9sbFRvcDtcblxuICAgIGlmKHNjcm9sbFRvcCAhPT0gdGhpcy5zY3JvbGxUb3ApIHtcbiAgICAgICAgdGhpcy5kaXJlY3Rpb24gID0gc2Nyb2xsVG9wID4gdGhpcy5zY3JvbGxUb3AgPyAxIDogLTE7XG4gICAgICAgIHRoaXMuc2Nyb2xsVG9wICA9IHNjcm9sbFRvcDtcbiAgICAgICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Jlc2l6ZUhhbmRsZXIgPSBmdW5jdGlvbiByZXNpemVIYW5kbGVyKC8qZXZ0Ki8pIHtcbiAgICB0aGlzLmRpcnR5UmVzaXplID0gdHJ1ZTtcbiAgICB0aGlzLl9yZXF1ZXN0VGljaygpO1xufTtcblxuLy8gVmVyc2lvbi5cbkxpdGVMaXN0LlZFUlNJT04gPSAnMC40LjYnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZUxpc3Q7IiwidmFyIExpdGVMaXN0ID0gcmVxdWlyZSgnLi9saXRlbGlzdCcpO1xudmFyIHJpdmV0cztcblxuLy8gSnVzdCBoZXJlIHRvIHNpbXBsaWZ5IHRoZSBpbml0aWFsaXphdGlvbiBsb2dpYy4gIElmXG4vLyB3aW5kb3cgZG9lc24ndCBleGlzdCwgdGhpcyBtb2R1bGUgaXMgdXNlbGVzcyBhbnl3YXlcbmlmKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7IHdpbmRvdyA9IHt9OyB9XG5cbi8vIFRoZSBidWlsZCB3aWxsIGRlY2xhcmUgVFdFRU4gYXMgZXh0ZXJuYWwuIEhvd2V2ZXIsIGlmIGl0IGlzbid0IHByb3ZpZGVkIGJ5XG4vLyBicm93c2VyaWZ5LCB3ZSByZWFsbHkgd2FudCB0byBjaGVjayB0byBzZWUgaWYgaXQgd2FzIGluY2x1ZGVkIGRpcmVjdGx5IHZpYVxuLy8gc2NyaXB0IHRhZyBmaXJzdC4gIE9ubHkgaWYgaXQgaXNuJ3Qgd2lsbCB3ZSB0cnkgYSByZXF1aXJlLiAgVGhpcyAqc2hvdWxkKlxuLy8gbWFrZSBpdCBlYXNpZXIgdG8gYnVuZGxlL29yIG5vdCBhbmQgdG8gdXNlIHdpdGggcmVxdWlyZWpzLi4uXG5yaXZldHMgPSB3aW5kb3cucml2ZXRzIHx8IHJlcXVpcmUoXCJyaXZldHNcIik7XG5cblxuLypcbiAqIEluIGFkZGl0aW9uIHRvIHRoZSBvcHRpb25zIGRvY3VtZW50ZWQgaW4gTGl0ZUxpc3RcbiAqXG4gKiBvcHRzOiB7XG4gKiAgIHJpdmV0c01vZGVsczogeyAuLi4gfSAgLy8gIEFueSBhZGRpdGlvbmFsIG1vZGVscyB0aGF0IG5lZWQgdG8gYmUgcHJvdmlkZWQgZm9yIHJpdmV0cy5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgVGhlc2Ugd2lsbCBiZSBpbmNsdWRlZCBhbG9uZyB3aXRoIHsgaXRlbXM6IGl0ZW1zSW5WaWV3IH1cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgd2hlbiBjYWxsaW5nIHJpdmV0cy5iaW5kLlxuICogICByaXZldHNPcHRzOiAgIHsgLi4uIH0gIC8vICBBbnkgYWRkaXRpb25hbCByaXZldHMgY29uZmlndXJhdGlvbi4gQmluZGVycyBmb3IgdG9wLCBsZWZ0IGFuZCBoZWlnaHRcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgd2lsbCBiZSBtaXhlZCBpbiBwcmlvciB0byBjYWxsaW5nIHJpdmV0cy5iaW5kXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIFJWTGl0ZUxpc3QoX29wdHMpIHtcbiAgICB2YXIgZGVsYXlCaW5kID0gX29wdHMuZGVsYXlCaW5kO1xuXG4gICAgLy8gRG9uJ3QgbGV0IExpdGVMaXN0IGJpbmQgLSB3ZSdsbCBkbyB0aGF0IGhlcmUgaWYgZGVsYXlCaW5kIGlzbid0IHRydWVcbiAgICAvLyBNYWtlIGEgY29weSBvZiB0aGUgaW5jb21pbmcgb3B0cyBzbyB3ZSBkb24ndCBtb2RpZnkgdGhlIG9yaWdpbmFsIHZlcnNpb24gYW5kXG4gICAgLy8gY2F1c2Ugd2VpcmQgYnVncyBpZiB0aGUgY2FsbGVyIGlzbid0IGV4cGVjdGluZyB0aGUgaW5jb21pbmcgdmFsdWUgdG8gY2hhbmdlLlxuICAgIHZhciBvcHRzID0ge307XG5cbiAgICAvLyBXZSBhcmUgb25seSB0b3VjaGluZyBhIHNpbXBsZSBwcm9wZXJ0eSwgc28gaXQgaXMgb2sgdG8gZHVwbGljYXRlIGFueSBjb21wbGV4XG4gICAgLy8gcHJvcGVydGllcyBoZXJlIHJhdGhlciB0aGFuIGRvaW5nIGEgdHJ1ZSBkZWVwIGNvcHkuXG4gICAgT2JqZWN0LmtleXMoX29wdHMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7IG9wdHNba2V5XSA9IF9vcHRzW2tleV07IH0pO1xuICAgIG9wdHMuZGVsYXlCaW5kID0gdHJ1ZTtcblxuICAgIExpdGVMaXN0LmNhbGwodGhpcywgb3B0cyk7XG5cbiAgICB0aGlzLnJpdmV0c01vZGVscyA9IG9wdHMucml2ZXRzTW9kZWxzIHx8IHt9O1xuICAgIHRoaXMucml2ZXRzT3B0cyAgID0gb3B0cy5yaXZldHNPcHRzICAgfHwge307XG5cbiAgICAvLyBPdmVyd3JpdGUgYW55IGV4aXN0aW5nIHZhbHVlIGluIHRoZSBwcm92aWRlZCBtb2RlbCBpZiBpdCBleGlzdHMuXG4gICAgdGhpcy5yaXZldHNNb2RlbHMuaXRlbXMgICA9IHRoaXMudmlld0J1ZmZlci52aWV3O1xuICAgIHRoaXMucml2ZXRzTW9kZWxzLm1ldHJpY3MgPSB0aGlzLmxpdGVMaXN0O1xuXG4gICAgLy8gdXNlIHByb3ZpZGVkIHJpdmV0c09wdHMgYW5kIGFsbG93IGN1c3RvbSB0b3AsIGxlZnQgYW5kIGhlaWdodCBiaW5kZXJzIGlmIHRoZSBjYWxsZXJcbiAgICAvLyB3YW50cyB0byBhbmQga25vd3Mgd2hhdCB0aGV5IGFyZSBkb2luZy4uLlxuICAgIHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzICAgICAgICA9IHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzIHx8IHt9O1xuICAgIHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLnRvcCAgICA9IHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLnRvcCAgICB8fCBmdW5jdGlvbihlbCwgdmFsKSB7IGVsLnN0eWxlLnRvcCAgICA9IHZhbCArIFwicHhcIjsgfTtcbiAgICB0aGlzLnJpdmV0c09wdHMuYmluZGVycy5sZWZ0ICAgPSB0aGlzLnJpdmV0c09wdHMuYmluZGVycy5sZWZ0ICAgfHwgZnVuY3Rpb24oZWwsIHZhbCkgeyBlbC5zdHlsZS5sZWZ0ICAgPSB2YWwgKyBcInB4XCI7IH07XG4gICAgdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMuaGVpZ2h0ID0gdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMuaGVpZ2h0IHx8IGZ1bmN0aW9uKGVsLCB2YWwpIHsgZWwuc3R5bGUuaGVpZ2h0ID0gdmFsICsgXCJweFwiOyB9O1xuXG4gICAgLy8gSnVzdCB0YWtlIGNhcmUgb2Ygb3Vyc2VsdmVzIGR1cmluZyBjb25zdHJ1Y3Rpb24gc28gd2UgZG9uJ3QgZG91YmxlIGJpbmRcbiAgICBpZighZGVsYXlCaW5kKSB7XG4gICAgICAgIHRoaXMuYmluZCgpO1xuICAgIH1cbn1cblxuLy8gc3ViY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzXG5SVkxpdGVMaXN0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTGl0ZUxpc3QucHJvdG90eXBlKTtcblJWTGl0ZUxpc3QucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUlZMaXRlTGlzdDtcblxuUlZMaXRlTGlzdC5wcm90b3R5cGUudW5iaW5kID0gZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmKHRoaXMucnZWaWV3KSB7XG4gICAgICAgIHRoaXMucnZWaWV3LnVuYmluZCgpO1xuXG4gICAgICAgIC8vIFBlbmRpbmcgdGhlIHJlc29sdXRpb24gb2Ygcml2ZXRzIzMwNiAgYW5kIHJpdmV0cyMzMDctIHRoaXMgd2lsbCBiZSBjaGFuZ2VkIHRvIHJlYmluZCB0aGUgdmlldyBpZiB0aGVcbiAgICAgICAgLy8gdmlldyBhbHJlYWR5IGV4aXN0cy4gIFVudGlsIHRoYXQgYmVoYXZpb3IgaXMgZml4ZWQsIHdlJ2xsIGdvIHRocm91Z2ggdGhlIG92ZXJoZWFkIG9mXG4gICAgICAgIC8vIGNyZWF0aW5nIGEgbmV3IHZpZXcuXG4gICAgICAgIHRoaXMucnZWaWV3ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgTGl0ZUxpc3QucHJvdG90eXBlLnVuYmluZC5jYWxsKHRoaXMpO1xufTtcblxuUlZMaXRlTGlzdC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gUGVuZGluZyB0aGUgcmVzb2x1dGlvbiBvZiByaXZldHMjMzA2IC0gdGhpcyB3aWxsIGJlIGNoYW5nZWQgdG8gcmViaW5kIHRoZSB2aWV3IGlmIHRoZVxuICAgIC8vIHZpZXcgYWxyZWFkeSBleGlzdHMuICBVbnRpbCB0aGF0IGJlaGF2aW9yIGlzIGZpeGVkLCB3ZSdsbCBnbyB0aHJvdWdoIHRoZSBvdmVyaGVhZCBvZlxuICAgIC8vIGNyZWF0aW5nIGEgbmV3IHZpZXcuICBDYWxsZXIgYmV3YXJlLi4uXG4gICAgdGhpcy5ydlZpZXcgPSByaXZldHMuYmluZCh0aGlzLnZpZXcsIHRoaXMucml2ZXRzTW9kZWxzLCB0aGlzLnJpdmV0c09wdHMpO1xuXG4gICAgTGl0ZUxpc3QucHJvdG90eXBlLmJpbmQuY2FsbCh0aGlzKTtcbn07XG5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gUlZMaXRlTGlzdDtcblxuIiwiLy8gYm9ycm93ZWQgaGVhdmlseSBmcm9tIFthcml5YS9raW5ldGljXShodHRwczovL2dpdGh1Yi5jb20vYXJpeWEva2luZXRpYylcbnZhciBUV0VFTjtcblxucmVxdWlyZShcInJhZi5qc1wiKTtcblxuLy8gSnVzdCBoZXJlIHRvIHNpbXBsaWZ5IHRoZSBpbml0aWFsaXphdGlvbiBsb2dpYy4gIElmXG4vLyB3aW5kb3cgZG9lc24ndCBleGlzdCwgdGhpcyBtb2R1bGUgaXMgdXNlbGVzcyBhbnl3YXlcbmlmKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7IHdpbmRvdyA9IHt9OyB9XG5cbi8vIFRoZSBidWlsZCB3aWxsIGRlY2xhcmUgVFdFRU4gYXMgZXh0ZXJuYWwuIEhvd2V2ZXIsIGlmIGl0IGlzbid0IHByb3ZpZGVkIGJ5XG4vLyBicm93c2VyaWZ5LCB3ZSByZWFsbHkgd2FudCB0byBjaGVjayB0byBzZWUgaWYgaXQgd2FzIGluY2x1ZGVkIGRpcmVjdGx5IHZpYVxuLy8gc2NyaXB0IHRhZyBmaXJzdC4gIE9ubHkgaWYgaXQgaXNuJ3Qgd2lsbCB3ZSB0cnkgYSByZXF1aXJlLiAgVGhpcyAqc2hvdWxkKlxuLy8gbWFrZSBpdCBlYXNpZXIgdG8gYnVuZGxlL29yIG5vdCBhbmQgdG8gdXNlIHdpdGggcmVxdWlyZWpzLi4uXG5UV0VFTiA9IHdpbmRvdy5UV0VFTiB8fCByZXF1aXJlKFwidHdlZW4uanNcIik7XG5cbmZ1bmN0aW9uIFNjcm9sbCh2aWV3T3JTZWxlY3RvciwgbGlzdGVuZXIpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgbWluLCBtYXgsIG9mZnNldCwgcmVmZXJlbmNlLCBwcmVzc2VkLFxuICAgICAgICB2ZWxvY2l0eSwgZnJhbWUsIHRpbWVzdGFtcCwgdGlja2VyLCB0d2VlblRpY2tlcixcbiAgICAgICAgYW1wbGl0dWRlLCB0YXJnZXQsIHRpbWVDb25zdGFudCwgaW5uZXJIZWlnaHQ7XG5cbiAgICB2YXIgcDAgPSB7IHk6IDAgfTtcbiAgICB2YXIgdDAgPSBmYWxzZTtcblxuICAgIGZ1bmN0aW9uIHlwb3MoZSkge1xuICAgICAgICAvLyB0b3VjaCBldmVudFxuICAgICAgICBpZiAoZS50YXJnZXRUb3VjaGVzICYmIChlLnRhcmdldFRvdWNoZXMubGVuZ3RoID49IDEpKSB7XG4gICAgICAgICAgICByZXR1cm4gZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3VzZSBldmVudFxuICAgICAgICByZXR1cm4gZS5jbGllbnRZO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbCh5KSB7XG4gICAgICAgIG9mZnNldCA9ICh5ID4gbWF4KSA/IG1heCA6ICh5IDwgbWluKSA/IG1pbiA6IHk7XG5cbiAgICAgICAgdmlldy5zY3JvbGxUb3AgPSBvZmZzZXQ7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodmlldyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhY2soKSB7XG4gICAgICAgIHZhciBub3csIGVsYXBzZWQsIGRlbHRhLCB2O1xuXG4gICAgICAgIG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIGVsYXBzZWQgPSBub3cgLSB0aW1lc3RhbXA7XG4gICAgICAgIHRpbWVzdGFtcCA9IG5vdztcbiAgICAgICAgZGVsdGEgPSBvZmZzZXQgLSBmcmFtZTtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG5cbiAgICAgICAgdiA9IDEwMDAgKiBkZWx0YSAvICgxICsgZWxhcHNlZCk7XG4gICAgICAgIHZlbG9jaXR5ID0gMC44ICogdiArIDAuMiAqIHZlbG9jaXR5O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRpY2soKSB7XG4gICAgICAgIFRXRUVOLnVwZGF0ZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRhcChlKSB7XG4gICAgICAgIHByZXNzZWQgPSB0cnVlO1xuICAgICAgICByZWZlcmVuY2UgPSB5cG9zKGUpO1xuXG4gICAgICAgIHZlbG9jaXR5ID0gYW1wbGl0dWRlID0gMDtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG4gICAgICAgIHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcbiAgICAgICAgdGlja2VyID0gc2V0SW50ZXJ2YWwodHJhY2ssIDEwMCk7XG5cbiAgICAgICAgaWYodDApIHtcbiAgICAgICAgICAgIHQwLnN0b3AoKTtcbiAgICAgICAgICAgIHQwID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkcmFnKGUpIHtcbiAgICAgICAgdmFyIHksIGRlbHRhO1xuICAgICAgICBpZiAocHJlc3NlZCkge1xuICAgICAgICAgICAgeSA9IHlwb3MoZSk7XG4gICAgICAgICAgICBkZWx0YSA9IHJlZmVyZW5jZSAtIHk7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAyIHx8IGRlbHRhIDwgLTIpIHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2UgPSB5O1xuICAgICAgICAgICAgICAgIHNjcm9sbChvZmZzZXQgKyBkZWx0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbGVhc2UoLyplKi8pIHtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcblxuICAgICAgICAvLyBJZiBubyB2ZWxvY2l0eSB5ZXQsIHRyYWNrIG9uY2UgbWFrZSBzdXJlXG4gICAgICAgIGlmKHZlbG9jaXR5ID09PSAwKSB7IHRyYWNrKCk7IH1cblxuICAgICAgICBpZiAodmVsb2NpdHkgPiAxMCB8fCB2ZWxvY2l0eSA8IC0xMCkge1xuICAgICAgICAgICAgYW1wbGl0dWRlID0gMC44ICogdmVsb2NpdHk7XG4gICAgICAgICAgICB0YXJnZXQgPSBNYXRoLnJvdW5kKG9mZnNldCArIGFtcGxpdHVkZSk7XG4gICAgICAgICAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgICAgICBwMC55ID0gdmlldy5zY3JvbGxUb3A7XG4gICAgICAgICAgICB0MCA9IG5ldyBUV0VFTi5Ud2VlbihwMClcbiAgICAgICAgICAgICAgICAudG8oe3k6IHRhcmdldH0sIHRpbWVDb25zdGFudClcbiAgICAgICAgICAgICAgICAuZWFzaW5nKFRXRUVOLkVhc2luZy5RdWludGljLk91dClcbiAgICAgICAgICAgICAgICAub25VcGRhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgdHdlZW5UaWNrZXIgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uQ29tcGxldGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgdDAuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICB0MCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0MC5zdGFydCgpO1xuICAgICAgICAgICAgdHdlZW5UaWNrZXIgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmlldyA9IHR5cGVvZiB2aWV3T3JTZWxlY3RvciA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHZpZXdPclNlbGVjdG9yKSA6IHZpZXdPclNlbGVjdG9yO1xuICAgIHRoaXMuYmluZCA9IGZ1bmN0aW9uIGF0dGFjaCgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmlldy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGFwKTtcbiAgICAgICAgICAgIHZpZXcuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgZHJhZyk7XG4gICAgICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgcmVsZWFzZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy51bmJpbmQgPSBmdW5jdGlvbiBkZXRhY2goKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRhcCk7XG4gICAgICAgICAgICB2aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICAgICAgdmlldy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHJlbGVhc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMucmVzZXQgPSBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgbWF4ID0gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUodmlldykuaGVpZ2h0LCAxMCkgLSBpbm5lckhlaWdodDtcbiAgICAgICAgb2Zmc2V0ID0gbWluID0gMDtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICBjbGVhckludGVydmFsKHRpY2tlcik7XG4gICAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSh0d2VlblRpY2tlcik7XG4gICAgfTtcblxuICAgIHRpbWVDb25zdGFudCA9IDIwMDA7IC8vIG1zXG5cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5iaW5kKCk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBTY3JvbGw7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLypcbiAqIENpcmN1bGFyIGJ1ZmZlciByZXByZXNlbnRpbmcgYSB2aWV3IG9uIGFuIGFycmF5IG9mIGVudHJpZXMuXG4gKi9cbmZ1bmN0aW9uIFZpZXdCdWZmZXIoZGF0YSwgaW5pdGlhbFNpemUpIHtcbiAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB0aGlzLnNpemUgPSAwO1xuICAgIHRoaXMuZGF0YSA9IGRhdGEgfHwgW107XG4gICAgdGhpcy52aWV3ID0gW107XG5cbiAgICAvLyBTcGVjaWFsIGNhc2UgaGVyZVxuICAgIGlmKGluaXRpYWxTaXplKSB7IHRoaXMucmVzaXplKGluaXRpYWxTaXplKTsgfVxufVxuXG4vKlxuICogU2hyaW5rIHRoZSB2aWV3IGJ1ZmZlclxuICpcbiAqIEBwYXJhbSBuZXdTaXplXG4gKiBAcGFyYW0gaGVhZDogICAgIGlmIHRydWUsIHdpbGwgc2hyaW5rIHJlbGF0aXZlIHRvIGhlYWQuXG4gKlxuICogQHJldHVybnM6IEFycmF5IG9mIHJlbW92ZWQgdmlldyBidWZmZXIgZW50cmllc1xuICovXG5mdW5jdGlvbiBfc2hyaW5rKG5ld1NpemUsIGhlYWQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciBkZWx0YSA9IFtdO1xuICAgIHZhciB2aWV3ICA9IHRoaXMudmlldztcbiAgICB2YXIgc2hyaW5rYWdlID0gdmlldy5sZW5ndGggLSBuZXdTaXplO1xuICAgIHZhciBzcGxpY2VkO1xuXG4gICAgaWYobmV3U2l6ZSA+PSB2aWV3Lmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gc2hyaW5rIHRvIGEgc2l6ZSBsYXJnZXIgdGhhbiB0aGUgY3VycmVudCBzaXplXCIpO1xuICAgIH1cblxuICAgIHdoaWxlKHNocmlua2FnZSAmJiB2aWV3Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3BsaWNlZCA9IHZpZXcuc3BsaWNlKGhlYWQgPyB0aGlzLmhlYWQgOiB0aGlzLnRhaWwsIDEpO1xuICAgICAgICBkZWx0YS5wdXNoKHNwbGljZWRbMF0pO1xuXG4gICAgICAgIC8vIFdoZW4gc2hyaW5raW5nIGZyb20gaGVhZCwgdGhlIG9ubHkgdGltZSB0aGUgaGVhZHMgcmVzdWx0aW5nIHZhbHVlIGNoYW5nZXMgaXNcbiAgICAgICAgLy8gaWYgaGVhZCBpcyBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0LiAgU28gaXQgaXMgc2FmZSB0byB0YWtlIHRoZSBtb2R1bG8gb2YgaGVhZFxuICAgICAgICAvLyBhZ2FpbnN0IHRoZSBuZXcgdmlldyBsZW5ndGg7XG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRhaWwgaXMgdGhlbiB0aGUgbW9kdWxvIG9mIGhlYWQgKyAxO1xuICAgICAgICBpZihoZWFkKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLmhlYWQgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9ICh0aGlzLmhlYWQgKyAxKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB9IGVsc2UgaWYodGhpcy50YWlsIDwgdGhpcy5oZWFkKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgLSAxO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkIC0gMTtcblxuICAgICAgICAgICAgaWYodGhpcy50YWlsIDwgMCkgeyB0aGlzLnRhaWwgPSB2aWV3Lmxlbmd0aCAtIDE7IH1cbiAgICAgICAgfSBlbHNlIGlmKHRoaXMudGFpbCA+IHRoaXMuaGVhZCkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsIC0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZXkgYXJlIGVxdWFsIHdoZW4gYm90aCBhcmUgemVyb1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAtLXNocmlua2FnZTtcbiAgICB9XG5cbiAgICBpZih2aWV3Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB9XG5cbiAgICB0aGlzLnNpemUgPSB2aWV3Lmxlbmd0aDtcbiAgICByZXR1cm4gZGVsdGE7XG59XG5cbi8qXG4gKiBHcm93cyB0aGUgdmlldyBidWZmZXI6ICB0aGUgdmlldyBidWZmZXIgd2lsbCBncm93IGluIHRoZSByZXF1ZXN0ZWQgZGlyZWN0aW9uXG4gKiBhcyBtdWNoIGFzIGl0IGNhbi4gIFdoZW4gaXQgcmVhY2hlcyBhIGxpbWl0LCBpdCB3aWxsIHRyeSB0byBncm93IGluIHRoZSBvcHBvc2l0ZVxuICogZGlyZWN0aW9uIGFzIHdlbGwuXG4gKlxuICogQHBhcmFtIG5ld1NpemVcbiAqIEBwYXJhbSBoZWFkOiAgICAgaWYgdHJ1ZSwgd2lsbCBncm93IHJlbGF0aXZlIHRvIGhlYWRcbiAqXG4gKiBAcmV0dXJuczogQXJyYXkgb2YgbmV3bHkgaW5pdGlhbGl6ZWQgdmlldyBidWZmZXIgZW50cmllc1xuICovXG5mdW5jdGlvbiBfZ3JvdyhuZXdTaXplLCBoZWFkKSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgZGVsdGEgPSBbXTtcbiAgICB2YXIgdmlldyAgID0gdGhpcy52aWV3O1xuICAgIHZhciBkYXRhICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIGdyb3d0aCA9IG5ld1NpemUgLSB2aWV3Lmxlbmd0aDtcbiAgICB2YXIgbmV3RW50cnk7XG5cbiAgICBpZihuZXdTaXplID4gZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGdyb3cgdG8gYSBzaXplIGxhcmdlciB0aGFuIHRoZSBjdXJyZW50IGRhdGFzZXRcIik7XG4gICAgfVxuXG4gICAgaWYoZ3Jvd3RoIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZ3JvdyB0byBhIHNpemUgc21hbGxlciB0aGFuIHRoZSBjdXJyZW50IHNpemVcIik7XG4gICAgfVxuXG4gICAgLy8gTm90aGluZyB0byBkbyBoZXJlLCBqdXN0IHJldHVybiBhbiBlbXB0eSBkZWx0YVxuICAgIGlmKGdyb3d0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZGVsdGE7XG4gICAgfVxuXG4gICAgd2hpbGUoZ3Jvd3RoKSB7XG4gICAgICAgIGlmKHRoaXMuaGVhZCA9PT0gLTEgJiYgdGhpcy50YWlsID09PSAtMSkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgMCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhWzBdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2aWV3LnB1c2gobmV3RW50cnkpO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGhlYWQgJiYgdmlld1t0aGlzLmhlYWRdLmlkeCA+IDApIHtcbiAgICAgICAgICAgIG5ld0VudHJ5ID0ge1xuICAgICAgICAgICAgICAgIGlkeDogIHZpZXdbdGhpcy5oZWFkXS5pZHggLSAxLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFbdmlld1t0aGlzLmhlYWRdLmlkeCAtIDFdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBhbHdheXMgc2FmZSB0byBhZGQgYWZ0ZXIgdGhlIHRhaWxcbiAgICAgICAgICAgIHZpZXcuc3BsaWNlKHRoaXMuaGVhZCwgMCwgbmV3RW50cnkpO1xuXG4gICAgICAgICAgICAvLyBIZWFkIGRvZXNuJ3QgY2hhbmdlXG4gICAgICAgICAgICB0aGlzLnRhaWwgPSAodGhpcy5oZWFkIC0gMSArIHZpZXcubGVuZ3RoKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB9IGVsc2UgaWYodmlld1t0aGlzLnRhaWxdLmlkeCA8IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgdmlld1t0aGlzLnRhaWxdLmlkeCArIDEsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVt2aWV3W3RoaXMudGFpbF0uaWR4ICsgMV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZpZXcuc3BsaWNlKHRoaXMudGFpbCArIDEsIDAsIG5ld0VudHJ5KTtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbCArIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSAodGhpcy50YWlsICsgMSkgJSB2aWV3Lmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gSWYgd2UgY2FuJ3QgYWRkIGFueW1vcmUgYXQgdGhlIHRhaWwsIGZvcmNlIHRoaXMgaW50b1xuICAgICAgICAgICAgLy8gdGhlIGhlYWQgbG9naWMgd2hpY2ggd2lsbCBvbmx5IGdyb3cgd2hlbiB0aGUgaWR4ID4gMFxuICAgICAgICAgICAgaWYobmV3RW50cnkuaWR4ID09PSBkYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICBoZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmKHZpZXdbdGhpcy50YWlsXS5pZHggPT09IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIC0gaWYgdGhlIHZpZXcgaXMgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgLy8gc2V0IGhlYWQgdG8gdHJ1ZSBhbmQgbG9vcCBhcm91bmQgd2l0aG91dCBkZWNyZW1lbnRpbmdcbiAgICAgICAgICAgIC8vIGdyb3d0aFxuICAgICAgICAgICAgaGVhZCA9IHRydWU7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG5ld0VudHJ5KSB7IGRlbHRhLnB1c2gobmV3RW50cnkpOyB9XG4gICAgICAgIG5ld0VudHJ5ID0gZmFsc2U7XG4gICAgICAgIC0tZ3Jvd3RoO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHZpZXcubGVuZ3RoO1xuICAgIHJldHVybiBkZWx0YTtcbn1cblxuLypcbiAqIE1vdmVzIHRoZSBidWZmZXIgdG93YXJkcyB0aGUgZW5kIG9mIHRoZSBkYXRhIGFycmF5XG4gKi9cbmZ1bmN0aW9uIF9zaGlmdFJpZ2h0KGNvdW50KSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgdmlldyAgICAgICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIG5ld0luVmlldyAgID0gW107XG4gICAgdmFyIGN1clRhaWxJZHg7XG4gICAgdmFyIHRhaWwgPSB0aGlzLnRhaWw7XG4gICAgdmFyIGhlYWQgPSB0aGlzLmhlYWQ7XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG5cbiAgICB3aGlsZShjb3VudCkge1xuICAgICAgICBjdXJUYWlsSWR4ICA9IHZpZXdbdGFpbF0uaWR4O1xuXG4gICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiB3ZSBhcmUgYWxyZWFkeSBhdCB0aGUgZW5kXG4gICAgICAgIGlmKGN1clRhaWxJZHggPT09IHRoaXMuZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gaGVhZDtcbiAgICAgICAgICAgIHJldHVybiBuZXdJblZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICB0YWlsID0gKHRhaWwgKyAxKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICBoZWFkID0gKGhlYWQgKyAxKSAlIHZpZXcubGVuZ3RoO1xuXG4gICAgICAgIHZpZXdbdGFpbF0uaWR4ICA9IGN1clRhaWxJZHggKyAxO1xuICAgICAgICB2aWV3W3RhaWxdLmRhdGEgPSB0aGlzLmRhdGFbY3VyVGFpbElkeCArIDFdO1xuXG4gICAgICAgIG5ld0luVmlldy5wdXNoKHZpZXdbdGFpbF0pO1xuXG4gICAgICAgIC8vIE9ubHkgbWFpbnRhaW4gYXQgbW9zdCB2aWV3Lmxlbmd0aCBpdGVtc1xuICAgICAgICBpZihuZXdJblZpZXcubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5ld0luVmlldy5zaGlmdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLS1jb3VudDtcbiAgICB9XG5cbiAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG5cbiAgICByZXR1cm4gbmV3SW5WaWV3O1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGRhdGEgYXJyYXlcbiAqL1xuZnVuY3Rpb24gX3NoaWZ0TGVmdChjb3VudCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIHZpZXcgICAgICAgID0gdGhpcy52aWV3O1xuICAgIHZhciBuZXdJblZpZXcgICA9IFtdO1xuICAgIHZhciBoZWFkICAgICAgICA9IHRoaXMuaGVhZDtcbiAgICB2YXIgdGFpbCAgICAgICAgPSB0aGlzLnRhaWw7XG4gICAgdmFyIGRhdGEgICAgICAgID0gdGhpcy5kYXRhO1xuICAgIHZhciBjdXJIZWFkSWR4O1xuXG4gICAgY291bnQgPSBjb3VudCB8fCAxO1xuICAgIHdoaWxlKGNvdW50KSB7XG4gICAgICAgIGN1ckhlYWRJZHggID0gdmlld1toZWFkXS5pZHg7XG5cbiAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHdlIGFyZSBhbHJlYWR5IGF0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgaWYoY3VySGVhZElkeCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gaGVhZDtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgICAgICAgICByZXR1cm4gbmV3SW5WaWV3O1xuICAgICAgICB9XG5cbiAgICAgICAgaGVhZCA9IChoZWFkIC0gMSArIHZpZXcubGVuZ3RoKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB0YWlsID0gKHRhaWwgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG5cbiAgICAgICAgdmlld1toZWFkXS5pZHggID0gY3VySGVhZElkeCAtIDE7XG4gICAgICAgIHZpZXdbaGVhZF0uZGF0YSA9IGRhdGFbY3VySGVhZElkeCAtIDFdO1xuXG4gICAgICAgIG5ld0luVmlldy5wdXNoKHZpZXdbaGVhZF0pO1xuXG4gICAgICAgIC8vIE9ubHkgbWFpbnRhaW4gYXQgbW9zdCB2aWV3Lmxlbmd0aCBpdGVtc1xuICAgICAgICBpZihuZXdJblZpZXcubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5ld0luVmlldy5zaGlmdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLS1jb3VudDtcbiAgICB9XG5cbiAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgcmV0dXJuIG5ld0luVmlldztcbn1cblxuLypcbiAqIE1vdmVzIHRoZSBidWZmZXIgdG93YXJkcyB0aGUgZW5kIChjb3VudCA+IDApIG9yXG4gKiBiZWdpbm5pbmcgKGNvdW50IDwgMCkgb2YgdGhlIGRhdGEgYXJyYXk7XG4gKlxuICogQHJldHVybnMgYXJyYXkgb2YgbmV3IGRhdGEgZWxlbWVudHMgaW4gdGhlIHZpZXcgYnVmZmVyXG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24gc2hpZnQoY291bnQpIHtcbiAgICB2YXIgZm47XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG4gICAgZm4gICAgPSBjb3VudCA+IDAgPyBfc2hpZnRSaWdodCA6IF9zaGlmdExlZnQ7XG5cbiAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBNYXRoLmFicyhjb3VudCkpO1xufTtcblxuLypcbiAqIFJlc2l6ZSB0aGUgdmlldyBidWZmZXIgLSBlaXRoZXIgZ3Jvd2luZyBvciBzaHJpbmtpbmcgaXQuXG4gKlxuICogQHBhcmFtIG5ld1NpemUgLSB0aGUgbmV3IHNpemUgb2YgdGhlIHZpZXcgYnVmZmVyXG4gKiBAcGFyYW0gaGVhZCAgICAtIGlmIHRydWUsIHByZWZlciByZXNpemluZyBiYXNlZCBvbiB0aGUgaGVhZCByYXRoZXIgdGhhbiB0aGUgdGFpbFxuICpcbiAqIEByZXR1cm5zICAgICAgIC0gQXJyYXkgb2YgYWRkZWQgb3IgcmVtb3ZlZCBpdGVtc1xuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUobmV3U2l6ZSwgaGVhZCkge1xuICAgIGlmKG5ld1NpemUgPiB0aGlzLnZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBfZ3Jvdy5jYWxsKHRoaXMsIG5ld1NpemUsIGhlYWQpO1xuICAgIH0gZWxzZSBpZihuZXdTaXplIDwgdGhpcy52aWV3Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gX3Nocmluay5jYWxsKHRoaXMsIG5ld1NpemUsIGhlYWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG59O1xuXG4vKlxuICogUmVzZXRzIHRoZSB2aWV3IGJ1ZmZlciBiYWNrIHRvIHplcm8gKGRhdGEgYW5kIHZpZXcpXG4gKlxuICogQHJldHVybnM6IGxpc3Qgb2YgdmlldyBpdGVtcztcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiBjbGVhcigpIHtcbiAgICB2YXIgaW5WaWV3SXRlbXMgPSB0aGlzLnZpZXcuc2xpY2UoMCk7IC8vIG1ha2UgYSBjb3B5XG5cbiAgICAvLyBEbyB0aGlzIGluIHBsYWNlIHRvIGJlIGZyaWVuZGx5IHRvIGxpYnJhcmllcyAoUml2ZXRzIGZvciBleGFtcGxlKVxuICAgIC8vIHRoYXQgYmluZCB0byBvYnNlcnZlIGNoYW5nZXNcbiAgICB0aGlzLnZpZXcuc3BsaWNlKDAsIE51bWJlci5NQVhfVkFMVUUpO1xuICAgIHRoaXMuZGF0YS5zcGxpY2UoMCwgTnVtYmVyLk1BWF9WQUxVRSk7XG5cbiAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB0aGlzLnNpemUgPSAwO1xuXG4gICAgcmV0dXJuIGluVmlld0l0ZW1zO1xufTtcblxuLypcbiAqIExvY2F0ZXMgYW4gaXRlbSBpbiB0aGUgdmlldyBieSBpdHMgaW5kZXggaW4gZGF0YSBpZiBpdCBleGlzdHNcbiAqXG4gKiBAcGFyYW0gaWR4ICAtIEluZGV4IGluIHRoZSBkYXRhIGFycmF5XG4gKlxuICogQHJldHVybnMgICAgLSBJbmRleCBpbiB0aGUgdmlldyBpZiBpdCBpcyBmb3VuZCBvciAtMSBpZiBub3RcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuZmluZERhdGFJbmRleEluVmlldyA9IGZ1bmN0aW9uIGZpbmREYXRhSW5kZXhJblZpZXcoaWR4KSB7XG4gICAgdmFyIHZpZXcgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGxlbiAgPSB2aWV3Lmxlbmd0aDtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgaWYodmlld1tpXS5pZHggPT09IGlkeCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gLTE7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhbiBlbnRyeSBmcm9tIGRhdGEgYW5kIGFkanVzdHMgdGhlIHZpZXcgaWYgbmVjZXNzYXJ5XG4gKlxuICogQHBhcmFtIGlkeCAgIC0gaW5kZXggb2YgdGhlIGl0ZW0gdG8gYmUgcmVtb3ZlZFxuICpcbiAqIEByZXR1cm5zIHtcbiAqICAgICAgbmV3SW5WaWV3OiAgIElmIGEgZGF0YSBpdGVtIHdhcyBtb3ZlZCBpbnRvIHRoZSB2aWV3IGFzIGEgcmVzdWx0IG9mIHJlbW92aW5nIGFuIGl0ZW0sIGFuIGFycmF5XG4gKiAgICAgICAgICAgICAgICAgICBjb250YWluaW5nIHRoZSBuZXdseSBhZGRlZCBpdGVtLlxuICogICAgICByZW1vdmVkOiAgICAgSWYgdGhlIHZpZXcgc2l6ZSB3YXMgbW9kaWZpZWQgYXMgYSByZXN1bHQgb2YgdGhlIHJlbW92YWwsIGFuIGFycmF5IGNvbnRhaW5pbmdcbiAqICAgICAgICAgICAgICAgICAgIHRoZSByZW1vdmVkIGl0ZW0uXG4gKiAgICAgIHVwZGF0ZWQ6ICAgICBsaXN0IG9mIGRhdGEgaXRlbXMgdGhhdCBjaGFuZ2VkIHBvc2l0aW9ucyB3aXRoaW4gdGhlIHZpZXcuXG4gKiB9XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZShpZHgpIHtcbiAgICAvL3ZhciBpZHhUb1JlbW92ZSAgPSBmYWxzZTtcbiAgICB2YXIgaGVhZCAgICAgICAgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICAgICAgICAgPSB0aGlzLnRhaWw7XG4gICAgdmFyIHZpZXcgICAgICAgICA9IHRoaXMudmlldztcbiAgICB2YXIgZGF0YSAgICAgICAgID0gdGhpcy5kYXRhO1xuICAgIHZhciB2aWV3SWR4LCBmcm9tLCB0bywgcmVzZXRWaWV3SWR4ID0gZmFsc2U7XG5cbiAgICB2YXIgcmV0VmFsID0ge1xuICAgICAgICBuZXdJblZpZXc6IFtdLFxuICAgICAgICByZW1vdmVkOiAgIFtdLFxuICAgICAgICB1cGRhdGVkOiAgIFtdXG4gICAgfTtcblxuICAgIHZhciBhZGRlZCwgcmVtb3ZlZCwgaTtcblxuICAgIGlkeCA9ICtpZHg7IC8vIE1ha2Ugc3VyZSBpdCBpcyBhIG51bWJlclxuXG4gICAgLy8gSWYgaWR4ID49IHRoZSB0b3RhbCBudW1iZXIgb2YgaXRlbXMgaW4gdGhlIGxpc3QsIHRocm93IGFuIGVycm9yXG4gICAgaWYoaWR4ID49IHRoaXMuZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5kZXggb3V0IG9mIGJvdW5kc1wiKTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgaXQgZnJvbSBpdGVtc1xuICAgIHRoaXMuZGF0YS5zcGxpY2UoaWR4LCAxKTtcblxuICAgIC8vIElmIGdyZWF0ZXIgdGhhbiB0aGUgdGFpbCBJRFgsIGl0IGlzIG5vdCBpbiB0aGUgdmlldyBhbmQgbm8gYWRqdXN0bWVudHNcbiAgICAvLyBhcmUgbmVjZXNzYXJ5IHRvIGFueSB2aWV3IGl0ZW1zLlxuICAgIGlmKGlkeCA+IHRoaXMudmlld1t0aGlzLnRhaWxdLmlkeCkge1xuICAgICAgICByZXR1cm4gcmV0VmFsO1xuICAgIH1cblxuICAgIC8vIElmIGxlc3MgdGhhbiB0aGUgaGVhZCBJRFgsIGl0IGlzIG5vdCBpbiB0aGUgdmlldywgYnV0IGFsbCB2aWV3IGl0ZW1zXG4gICAgLy8gbmVlZCB0byBiZSBhZGp1c3RlZCBiYWNrIGJ5IG9uZSB0byByZWZlcmVuY2UgdGhlIGNvcnJlY3QgZGF0YSBpbmRleFxuICAgIC8vXG4gICAgLy8gTmVlZCB0byB0aGluayBhYm91dCB3aGV0aGVyIGFueXRoaW5nIHdhcyByZWFsbHkgdXBkYXRlZCBoZXJlLiAgSWR4IGlzXG4gICAgLy8gbW9zdGx5IGFuIGludGVybmFsIGltcGxlbWVudGF0aW9uIGRldGFpbCBhbmQgdGhhdCBpcyBhbGwgdGhhdCBoYXMgYmVlblxuICAgIC8vIHVwZGF0ZWQgaW4gdGhpcyBjYXNlLlxuICAgIGlmKGlkeCA8IHZpZXdbaGVhZF0uaWR4KSB7XG4gICAgICAgIHZpZXcuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICBpdGVtLmlkeCA9IGl0ZW0uaWR4IC0gMTtcbiAgICAgICAgICAgIHJldFZhbC51cGRhdGVkLnB1c2goaXRlbSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXRWYWw7XG4gICAgfVxuXG4gICAgZnJvbSA9IHZpZXdJZHggPSB0aGlzLmZpbmREYXRhSW5kZXhJblZpZXcoaWR4KTtcbiAgICBpZih2aWV3SWR4ID09PSBoZWFkKSB7XG4gICAgICAgIGlmKGhlYWQgPT09IDApIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIH0gZWxzZSBpZihoZWFkID09PSB2aWV3Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IDA7XG4gICAgICAgICAgICByZXNldFZpZXdJZHggPSB0cnVlOyAvLyB2aWV3SWR4IG5lZWRzIHRvIGJlIHNldCBhdCAwIHNpbmNlIGl0IHdhcyByZW1vdmVkIGZyb20gdGhlIHRhaWxcbiAgICAgICAgICAgIHRvID0gdGFpbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvID0gdGFpbCArIHZpZXcubGVuZ3RoIC0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih2aWV3SWR4ID09PSB0YWlsKSB7XG4gICAgICAgIC8vIE5vbmUgb2YgdGhlc2UgcmVxdWlyZSBtb2RpZnlpbmcgaWR4IC0gdGhlIGxvb3AgdG8gdXBkYXRlIGlkeCB3aWxsIG5ldmVyIGJlIGVudGVyZWRcbiAgICAgICAgaWYodGFpbCA9PT0gdmlldy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgICAgICB9IGVsc2UgaWYodGFpbCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdmlldy5sZW5ndGggLSAyO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gMDtcbiAgICAgICAgICAgIHRvID0gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRoaXMudGFpbCAtIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkIC0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih2aWV3SWR4IDwgaGVhZCAmJiB2aWV3SWR4IDwgdGFpbCkge1xuICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgICAgICB0aGlzLmhlYWQgPSBoZWFkIC0gMTtcbiAgICB9IGVsc2UgaWYodmlld0lkeCA+IGhlYWQgJiYgdmlld0lkeCA8IHRhaWwpIHtcbiAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICB9IGVsc2UgaWYodmlld0lkeCA+IGhlYWQgJiYgdmlld0lkeCA+IHRhaWwpIHtcbiAgICAgICAgdG8gPSB0YWlsICsgdmlldy5sZW5ndGggLSAxO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHRoaXMuc2l6ZSAtIDE7XG4gICAgcmVtb3ZlZCA9IHZpZXcuc3BsaWNlKHZpZXdJZHgsIDEpO1xuXG4gICAgdmlld0lkeCA9IHJlc2V0Vmlld0lkeCA/IDAgOiB2aWV3SWR4O1xuICAgIGZvcihpID0gdmlld0lkeDsgaSA8PSB0bzsgKytpKSB7XG4gICAgICAgIC0tdmlld1tpICUgdmlldy5sZW5ndGhdLmlkeDtcbiAgICAgICAgcmV0VmFsLnVwZGF0ZWQucHVzaCh2aWV3W2kgJSB2aWV3Lmxlbmd0aF0pO1xuICAgIH1cblxuICAgIGlmKGRhdGEubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgYWRkZWQgPSB0aGlzLnJlc2l6ZSh2aWV3Lmxlbmd0aCArIDEpO1xuICAgIH1cblxuICAgIHJldFZhbC5yZW1vdmVkLnB1c2guYXBwbHkocmV0VmFsLnJlbW92ZWQsIHJlbW92ZWQpO1xuICAgIHJldFZhbC5uZXdJblZpZXcucHVzaC5hcHBseShyZXRWYWwubmV3SW5WaWV3LCBhZGRlZCk7XG4gICAgcmV0dXJuIHJldFZhbDtcbn07XG5cbi8qXG4gKiBJdGVyYXRlcyB0aHJvdWdoIGFsbCBpdGVtcyBjdXJyZW50bHkgaW4gdGhlIGNpcmN1bGFyIGJ1ZmZlciBzdGFydGluZyBhdCB0aGUgbG9naWNhbFxuICogZmlyc3QgaXRlbSByYXRoZXIgdGhhbiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSB2aWV3IGFycmF5LiAgVGhlIGNhbGxiYWNrIHNpZ25hdHVyZVxuICogaXMgc2ltaWxhciB0byBBcnJheS5mb3JFYWNoLCBob3dldmVyIGJvdGggdGhlIHJhdyBpbmRleCBhbmQgdGhlIGxvZ2ljYWwgaW5kZXggYXJlXG4gKiBwYXNzZWQuXG4gKlxuICogY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIGZvdXIgYXJndW1lbnRzOlxuICpcbiAqICAgICAgdGhlIHZpZXcgaXRlbVxuICogICAgICB0aGUgdmlldyBpdGVtcyBsb2dpY2FsIGluZGV4XG4gKiAgICAgIHRoZSB2aWV3IGl0ZW1zIHBoeXNpY2FsIGluZGV4XG4gKiAgICAgIHRoZSB2aWV3XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLmZvckVhY2hJblZpZXcgPSBmdW5jdGlvbiBmb3JFYWNoSW5WaWV3KGNiLCB1c2VBc1RoaXMpIHtcbiAgICB2YXIgdmlldyAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGxlbiAgID0gdmlldy5sZW5ndGg7XG4gICAgdmFyIGhlYWQgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICA9IHRoaXMudGFpbDtcbiAgICB2YXIgdG8gICAgPSB0YWlsIDwgaGVhZCA/IHRhaWwgKyBsZW4gOiB0YWlsO1xuICAgIHZhciBpLCBjdXJJdGVtLCByZWFsSWR4O1xuXG4gICAgdXNlQXNUaGlzID0gdXNlQXNUaGlzIHx8IHRoaXM7XG5cbiAgICBmb3IoaSA9IGhlYWQ7IGkgPD0gdG87ICsraSkge1xuICAgICAgICByZWFsSWR4ID0gaSAlIGxlbjtcbiAgICAgICAgY3VySXRlbSA9IHZpZXdbcmVhbElkeF07XG5cbiAgICAgICAgY2IuY2FsbCh1c2VBc1RoaXMsIGN1ckl0ZW0sIGkgLSBoZWFkLCByZWFsSWR4LCB2aWV3KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXdCdWZmZXI7XG4iXX0=
(2)
});
