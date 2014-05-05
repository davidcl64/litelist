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
    this.itemsInView     = [];
    this.items           = [];
    this.itemWidth       = opts.itemWidth || 0;
    this.itemHeight      = opts.itemHeight;
    this.margin          = opts.margin || { x: 0, y: 0 };
    this.dataSource      = opts.dataSource || false;
    this.itemTemplate    = opts.itemTemplate || false;
    this.scrollTop       = 0;
    this.dirtyResize     = true;
    this.ticking         = false;

    // View Metrics
    this.clientHeight    = 0;
    this.clientWidth     = 0;
    this.rowsPerPage     = 0;
    this.itemsPerRow     = 0;
    this.itemsPerPage    = 0;
    this.maxBuffer       = 0;

    // Get the container elements
    this.view            = opts.scrollView;
    this.itemsContainer  = opts.itemsContainer || false;

    // If it is a string, it should be a query selector - otherwise we are expecting an element.
    this.view            = (typeof this.view           === 'string' || this.view instanceof String)           ? document.querySelector(this.view)           : this.view;
    this.itemsContainer  = (typeof this.itemsContainer === 'string' || this.itemsContainer instanceof String) ? document.querySelector(opts.itemsContainer) : this.itemsContainer;

    // Keep track of a unique id for viewItems - allows This is passed to
    // datasource providers to aid in tracking.
    this._id = 0;

    // Keeps track of the old first visible portion of the list
    this._oldStart = 0;
    this._oldEnd   = 0;

    // If not passed a page selector, assume it's the first child
    if(!this.itemsContainer) {
        this.itemsContainer = this.view.children[0];
    }

    // _ensureVisible is used in requestAnimationFrame - bind it to this
    this._ensureVisible = this._ensureVisible.bind(this);

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

LiteList.prototype._createInViewObj = function createInViewObj(item, idx) {
    var row = Math.floor(idx/this.itemsPerRow);
    var col = (idx % this.itemsPerRow);

    var newViewObj = {
        id:   this._id++,
        top:  row * this.itemHeight + row * this.margin.y,
        left: col * this.itemWidth  + col * this.margin.x,
        idx:  idx,
        item: item
    };

    // If we were given an item template, we need to add a clone
    // to the dom
    if(this.itemTemplate) {
        var newNode = this.itemTemplate.cloneNode(true);

        if(newNode instanceof(window.DocumentFragment)) {
            newNode = newNode.childNodes[0];
        }

        this.itemsContainer.appendChild(newNode);
        newViewObj.el = newNode;
        if(this.dataSource && this.dataSource.bind) {
            this.dataSource.bind(newViewObj.id, newNode);
        }
    }

    return newViewObj;
};

LiteList.prototype._calcViewMetrics = function calcViewMetrics() {
    this.clientHeight    = this.view.clientHeight;
    this.clientWidth     = this.view.clientWidth;
    this.rowsPerPage     = Math.ceil (this.clientHeight / (this.itemHeight + this.margin.y));
    this.itemsPerRow     = this.itemWidth ? Math.floor(this.clientWidth  / (this.itemWidth  + this.margin.x)) : 1;
    this.itemsPerPage    = this.rowsPerPage * this.itemsPerRow;
    this.maxBuffer       = this.itemsPerPage * 3;
};

LiteList.prototype._calcDocHeight = function calcDocHeight() {
    var row = Math.ceil(this.items.length/this.itemsPerRow);
    var newHeight = row * this.itemHeight + row * this.margin.y;

    if(newHeight !== this.itemsInView.height) {
        this.itemsContainer.style.height = newHeight + "px";
        this.itemsInView.height = newHeight;
    }
    return this.itemsInView.height;
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

    // this is ok for just an instance check
    if(force || (viewItem.item !== this.items[idx])) {
        viewItem.item = this.items[idx];

        // If we have a dataSource
        if(this.dataSource && this.dataSource.sync) {
            this.dataSource.sync(viewItem.id, viewItem.el, idx, this.items[idx]);
        }
    }
};

LiteList.prototype.__ensureVisible = function _ensureVisible() {
    var percentInViewStart = ((this.scrollTop) / (this.itemsInView.height));
    var percentInViewEnd   = ((this.scrollTop + this.clientHeight) / (this.itemsInView.height));

    if(percentInViewStart < 0) { percentInViewStart = 0; }
    var newStart = Math.floor(percentInViewStart * this.items.length);
    var newEnd   = Math.ceil (percentInViewEnd   * this.items.length);
    var i;
    var viewItem;
    var newIdx;

    this._firstVisibleItem = Math.floor(this.scrollTop / (this.itemHeight + this.margin.y)) * this.itemsPerRow;
    this._lastVisibleItem  = Math.ceil ((this.scrollTop + this.clientHeight)/(this.itemHeight + this.margin.y)) * this.itemsPerRow;

    if(this.direction < 0) {
        for (i = this._oldEnd; i > newEnd + this.itemsPerRow; --i) {
            viewItem = this.itemsInView[i % this.itemsInView.length];

            newIdx = i - this.itemsInView.length;

            if (newIdx >= 0) {
                viewItem.idx = newIdx;
                this._positionViewItem(viewItem);
            }
        }
        this._oldEnd = i;
        this._oldStart   = Math.max(this._oldEnd - this.itemsInView.length, 0);
    } else {
        for(i = this._oldStart; i < newStart - this.itemsPerRow; ++i) {
            viewItem = this.itemsInView[i % this.itemsInView.length];

            newIdx = i + this.itemsInView.length;
            if(newIdx < this.items.length) {
                viewItem.idx = newIdx;
                this._positionViewItem(viewItem);
            }
        }
        this._oldStart   = i === 0 ? 0 : i - 1;
        this._oldEnd     = Math.min(this._oldStart + this.itemsInView.length, this.items.length - 1);
    }

    this.dirtyResize = false;
    this.ticking     = false;
};

LiteList.prototype._ensureVisible = function ensureVisible() {
    if(this.dirtyResize) {
        var newHeight    = this.view.clientHeight;
        var newWidth     = this.view.clientWidth;

        var newRowsPerPage     = Math.ceil (newHeight / (this.itemHeight + this.margin.y));
        var newItemsPerRow     = this.itemWidth ? Math.floor(newWidth  / (this.itemWidth  + this.margin.x)) : 1;

        var i, removed, inViewObj;
        if(newRowsPerPage !== this.rowsPerPage || newItemsPerRow !== this.itemsPerRow) {
            this._calcViewMetrics();
            this._calcDocHeight();

            if(this.itemsInView.length > this.maxBuffer) {
                removed = this.itemsInView.splice(0, this.itemsInView.length - this.maxBuffer);

                if(this.dataSource && this.dataSource.unbind) {
                    removed.forEach(function(inViewItem) {
                        this.dataSource.unbind(inViewItem.id, inViewItem.el);
                        this.itemsContainer.removeChild(inViewItem.el);
                    }.bind(this));
                }
            } else if(this.itemsInView.length < this.maxBuffer) {
                var newItems = [-1, 0];
                for(i = this.itemsInView.length; i < this.maxBuffer; ++i) {
                    inViewObj = this._createInViewObj({}, 0);
                    newItems.push(inViewObj);
                    this._positionViewItem(inViewObj, true);
                }

                this.itemsInView.splice.apply(this.itemsInView, newItems);
            }

            for(i = 0; i < this.itemsInView.length; ++i) {
                this.itemsInView[i].idx = i;
                this._positionViewItem(this.itemsInView[i]);
            }

            this._oldStart = 0;
        }
    }

    this.__ensureVisible();
};

LiteList.prototype._requestTick = function requestTick() {
    if(!this.ticking) {
        window.requestAnimationFrame(this._ensureVisible);
    }
    this.ticking = true;
};

LiteList.prototype.push = function push() {
    var args    = Array.prototype.slice.call(arguments);
    var i       = 0;
    var argsIdx = this.items.length;
    var inViewObj;
    var needsReset = false;
    var maxIdx  = this.itemsLength;

    if(this.itemsInView.length >= this.maxBuffer) {
        maxIdx = this.itemsInView.reduce(function(prev, cur) {
            return prev.idx > cur.idx ? prev : cur;
        }, this.itemsInView[0] || {idx: 0}).idx;

        if(maxIdx === this.items.length - 1) { needsReset = true; }
    }

    this.items.push.apply(this.items, args);
    while(this.itemsInView.length < this.maxBuffer && i < args.length) {
        inViewObj = this._createInViewObj(args[i], argsIdx);
        this.itemsInView.push(inViewObj);
        this._positionViewItem(inViewObj, true);

        i = i + 1;
        argsIdx = argsIdx + 1;
    }

    // Nuclear option for now.  This can be optimized for difference use cases:
    // - at end of list/end of list visible
    // - end of list not visible
    // - remove from DOM/display: none then render/replace?
    if(needsReset) {
        for(i = 0; i < this.itemsInView.length; ++i) {
            this.itemsInView[i].idx = i;
            this._positionViewItem(this.itemsInView[i]);
        }
        this._oldStart = 0;
    }

    this._calcDocHeight();
    this._requestTick();
};

LiteList.prototype.bind = function bind() {
    this.view.addEventListener("scroll", this._scrollHandler);
    window.addEventListener("resize", this._resizeHandler);
};

LiteList.prototype.unbind = function unbind() {
    this.view.removeEventListener("scroll", this._scrollHandler);
    window.removeEventListener("resize", this._resizeHandler);

    if(this.scroll) { this.scroll.unbind(); }
};

LiteList.prototype.clear = function clear() {
    var callUnbind = (this.dataSource && this.dataSource.unbind);

    this.view.scrollTop = this.scrollTop = 0;
    this._oldStart = this._oldEnd = 0;

    // If we were given an item template, we need remove any nodes we've added
    if(this.itemTemplate) {
        this.itemsInView.forEach(function(item) {
            if(item.el)    { this.itemsContainer.removeChild(item.el); }
            if(callUnbind) { this.dataSource.unbind(item.id, item.el); }
        }.bind(this));
    }

    this.itemsInView.splice(0, Number.MAX_VALUE);
    this.items      .splice(0, Number.MAX_VALUE);

    this._calcDocHeight();
};

LiteList.prototype.forEach = function forEach(/*fn, thisArg*/) {
    return this.items.forEach.apply(arguments);
};

LiteList.prototype.remove = function remove(searchIdx) {
    var idxToRemove = false;

    // If searchIdx >= the total number of items in the list, throw an error
    if(searchIdx >= this.items.length) {
        throw new Error("index out of bounds");
    }

    // Remove it from items
    this.items.splice(searchIdx, 1);

    this.itemsInView.forEach(function(val, idx) {
        if(val.idx >= searchIdx) {

            // If it is the last item in the list, the view buffer
            // entry needs to move back to the front of the current
            // buffer
            if(val.idx >= this.items.length) {
                val.idx = val.idx - this.itemsInView.length;

                // If less than zero, that means the view buffer needs
                // to shrink.
                if(val.idx < 0) {
                    val = false;
                    idxToRemove = idx;
                }
            }

            if(val) {
                this._positionViewItem(val, true);
            }
        }
    }, this);

    // Shrink the view buffer if necessary.
    if(idxToRemove) {
        var item = this.itemsInView[idxToRemove];

        // If we are managing the dom, need to remove the actual element
        if(this.itemTemplate) {
            if(this.dataSource && this.dataSource.unbind) {
                this.dataSource.unbind(item.id, item.el);
            }

            this.itemsContainer.removeChild(item.el);
        }

        this.itemsInView.splice(idxToRemove,1);
    }

    // Update doc height
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
LiteList.VERSION = '0.3.0';


module.exports = LiteList;
},{}],4:[function(_dereq_,module,exports){
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
        this.rvView = rivets.bind(this.liteList.view, this.rivetsModels, this.rivetsOpts);
    }

    this.bind = function bind() {
        _bind.call(this);
        this.liteList.bind();
    };

    this.push = function() {
        this.liteList.push.apply(this.liteList, arguments);
    };

    this.clear = function() {
        this.liteList.clear();
    };

    this.forEach = function() {
        this.liteList.forEach.apply(this.liteList, arguments);
    };

    this.remove = function() {
        this.liteList.remove.apply(this.liteList, arguments);
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


},{"./litelist":3,"rivets":"4ZwREV"}],5:[function(_dereq_,module,exports){
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

function Scroll(viewSelector, listener) {
    var view,
        min, max, offset, reference, pressed,
        velocity, frame, timestamp, ticker,
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

        e.preventDefault();
        e.stopPropagation();
        return false;
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
        e.stopPropagation();
        return false;
    }

    function release(e) {
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
                    window.requestAnimationFrame(tick);
                })
                .onComplete(function() {
                    scroll(p0.y);
                    t0.stop();
                    t0 = false;
                });

            t0.start();
            window.requestAnimationFrame(tick);
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    view = document.querySelector(viewSelector);
    if (typeof window.ontouchstart !== 'undefined') {
        view.addEventListener('touchstart', tap);
        view.addEventListener('touchmove', drag);
        view.addEventListener('touchend', release);
    }

    this.unbind = function detach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.removeEventListener('touchstart', tap);
            view.removeEventListener('touchmove', drag);
            view.removeEventListener('touchend', release);
        }
    };

    max = parseInt(window.getComputedStyle(view).height, 10) - innerHeight;
    offset = min = 0;
    pressed = false;
    timeConstant = 2000; // ms
}


module.exports = Scroll;

},{"raf.js":1,"tween.js":"yazFk1"}]},{},[2])
(2)
});