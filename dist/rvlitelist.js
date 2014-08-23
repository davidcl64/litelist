!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.RivetsLiteList=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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
},{"./viewbuffer":3}],2:[function(_dereq_,module,exports){
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


},{"./litelist":1,"rivets":"4ZwREV"}],3:[function(_dereq_,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvbGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3J2bGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3ZpZXdidWZmZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgVmlld0J1ZmZlciA9IHJlcXVpcmUoJy4vdmlld2J1ZmZlcicpO1xuXG4vKlxuICogTGl0ZUxpc3RcbiAqXG4gKiBvcHRzOiB7XG4gKiAgaXRlbVdpZHRoICAgICAgIDogT3B0aW9uYWwgLSB3aWR0aCBvZiBlYWNoIGl0ZW0uICBJZiBub3QgcHJvdmlkZSBvbmUgaXRlbSBwZXIgcm93IGlzIGFzc3VtZWRcbiAqICBpdGVtSGVpZ2h0ICAgICAgOiBSZXF1aXJlZCAtIGhlaWdodCBvZiBlYWNoIGl0ZW0uXG4gKiAgbWFyZ2luICAgICAgICAgIDogT3B0aW9uYWwgLSBtYXJnaW4vZ3V0dGVycyBmb3IgdGhlIGl0ZW1zLiAgRGVmYXVsdHMgdG86IHsgeDogMCwgeTogMCB9O1xuICogIHNjcm9sbFZpZXcgICAgICA6IFJlcXVpcmVkIC0gcXVlcnkgc2VsZWN0b3IgZm9yIHRoZSBzY3JvbGxhYmxlIGNvbnRhaW5lclxuICogIGl0ZW1zQ29udGFpbmVyICA6IE9wdGlvbmFsIC0gcXVlcnkgc2VsZWN0b3IgY29udGFpbmVyIG9mIHRoZSBpdGVtcy4gIERlZmF1bHRzIHRvIHRoZSBmaXJzdCBjaGlsZCBvZiBzY3JvbGxWaWV3XG4gKiAgZGVsYXlCaW5kICAgICAgIDogT3B0aW9uYWwgLSBpZiB0cnVlIHdpbGwgd2FpdCBmb3IgYSBjYWxsIHRvIGxpdGVMaXN0LmJpbmQoKSB0byBhdHRhY2ggYW55IGhhbmRsZXJzXG4gKlxuICogIC8vIFRoZSBuZXh0IHR3byBhcmUgcmVxdWlyZWQgZm9yIGEgdmFuaWxsYSBqYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIHRvIGJlIGZ1bmN0aW9uYWwuICBMaXN0TGlzdCB3YXNcbiAqICAvLyB3cml0dGVuIHRvIHdvcmsgd2l0aCB0aGUgUml2ZXRzIGxpYnJhcnkgd2hpY2ggcHJvdmlkZXMgdGhpcyBmdW5jdGlvbmFsaXR5IGFzIHdlbGwuICBJbiB0aGF0IGNhc2UsXG4gKiAgLy8gaXQgaXMgb3B0aW9uYWwuICBpLmUuIHRoZSBMaXRlTGlzdCB3aWxsIGNvbnRpbnVlIG9uIGlmIHRoZXNlIGFyZSBub3QgcHJvdmlkZWQuXG4gKiAgaXRlbVRlbXBsYXRlICAgIDogUmVxdWlyZWQgLSBET00gbm9kZSB0aGF0IHdpbGwgYmUgY2xvbmVkIGFzIGEgdGVtcGxhdGUgZm9yIGVhY2ggaXRlbS5cbiAqICBkYXRhU291cmNlICAgICAgOiBSZXF1aXJlZCAtIEltcGxlbWVudGF0aW9uIG9mIHRoZSBkYXRhU291cmNlIGNvbnRyYWN0IChzZWUgYmVsb3cgZm9yIG1vcmUgZGV0YWlscykuXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIExpdGVMaXN0KG9wdHMpIHtcbiAgICB0aGlzLnZpZXdCdWZmZXIgICAgICA9IG5ldyBWaWV3QnVmZmVyKCk7XG4gICAgdGhpcy5pdGVtV2lkdGggICAgICAgPSBvcHRzLml0ZW1XaWR0aCB8fCAwO1xuICAgIHRoaXMuaXRlbUhlaWdodCAgICAgID0gb3B0cy5pdGVtSGVpZ2h0O1xuICAgIHRoaXMubWFyZ2luICAgICAgICAgID0gb3B0cy5tYXJnaW4gfHwgeyB4OiAwLCB5OiAwIH07XG4gICAgdGhpcy5kYXRhU291cmNlICAgICAgPSBvcHRzLmRhdGFTb3VyY2UgfHwgZmFsc2U7XG4gICAgdGhpcy5pdGVtVGVtcGxhdGUgICAgPSBvcHRzLml0ZW1UZW1wbGF0ZSB8fCBmYWxzZTtcbiAgICB0aGlzLnNjcm9sbFRvcCAgICAgICA9IDA7XG4gICAgdGhpcy5kaXJ0eVJlc2l6ZSAgICAgPSB0cnVlO1xuICAgIHRoaXMudGlja2luZyAgICAgICAgID0gZmFsc2U7XG4gICAgdGhpcy5kaXJlY3Rpb24gICAgICAgPSAwO1xuXG4gICAgLy8gVmlldyBNZXRyaWNzXG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSAwO1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gMDtcbiAgICB0aGlzLnJvd3NQZXJQYWdlICAgICA9IDA7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSAwO1xuICAgIHRoaXMuaXRlbXNQZXJQYWdlICAgID0gMDtcbiAgICB0aGlzLm1heEJ1ZmZlciAgICAgICA9IDA7XG4gICAgdGhpcy5oZWlnaHQgICAgICAgICAgPSAwO1xuXG4gICAgLy8gaW50ZXJuYWwgc3RhdGVcbiAgICB0aGlzLl9maXJzdFZpc2libGVJdGVtID0gMDtcbiAgICB0aGlzLl9sYXN0VmlzaWJsZUl0ZW0gID0gMDtcblxuICAgIC8vIEdldCB0aGUgY29udGFpbmVyIGVsZW1lbnRzXG4gICAgdGhpcy52aWV3ICAgICAgICAgICAgPSBvcHRzLnNjcm9sbFZpZXc7XG4gICAgdGhpcy5pdGVtc0NvbnRhaW5lciAgPSBvcHRzLml0ZW1zQ29udGFpbmVyIHx8IGZhbHNlO1xuXG4gICAgLy8gSWYgaXQgaXMgYSBzdHJpbmcsIGl0IHNob3VsZCBiZSBhIHF1ZXJ5IHNlbGVjdG9yIC0gb3RoZXJ3aXNlIHdlIGFyZSBleHBlY3RpbmcgYW4gZWxlbWVudC5cbiAgICB0aGlzLnZpZXcgICAgICAgICAgICA9ICh0eXBlb2YgdGhpcy52aWV3ICAgICAgICAgICA9PT0gJ3N0cmluZycgfHwgdGhpcy52aWV3IGluc3RhbmNlb2YgU3RyaW5nKSAgICAgICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMudmlldykgICAgICAgICAgIDogdGhpcy52aWV3O1xuICAgIHRoaXMuaXRlbXNDb250YWluZXIgID0gKHR5cGVvZiB0aGlzLml0ZW1zQ29udGFpbmVyID09PSAnc3RyaW5nJyB8fCB0aGlzLml0ZW1zQ29udGFpbmVyIGluc3RhbmNlb2YgU3RyaW5nKSA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0cy5pdGVtc0NvbnRhaW5lcikgOiB0aGlzLml0ZW1zQ29udGFpbmVyO1xuXG4gICAgLy8gS2VlcCB0cmFjayBvZiBhIHVuaXF1ZSBpZCBmb3Igdmlld0l0ZW1zIC0gYWxsb3dzIFRoaXMgaXMgcGFzc2VkIHRvXG4gICAgLy8gZGF0YXNvdXJjZSBwcm92aWRlcnMgdG8gYWlkIGluIHRyYWNraW5nLlxuICAgIHRoaXMuX2lkID0gMDtcblxuICAgIC8vIElmIG5vdCBwYXNzZWQgYSBwYWdlIHNlbGVjdG9yLCBhc3N1bWUgaXQncyB0aGUgZmlyc3QgY2hpbGRcbiAgICBpZighdGhpcy5pdGVtc0NvbnRhaW5lcikge1xuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyID0gdGhpcy52aWV3LmNoaWxkcmVuWzBdO1xuICAgIH1cblxuICAgIC8vIF91cGRhdGVWaWV3IGlzIHVzZWQgaW4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIC0gYmluZCBpdCB0byB0aGlzXG4gICAgdGhpcy5fdXBkYXRlVmlldyA9IHRoaXMuX3VwZGF0ZVZpZXcuYmluZCh0aGlzKTtcblxuICAgIC8vIEludm9rZWQgYXMgYSByZXN1bHQgb2YgZXZlbnQgbGlzdGVuZXJzIC0gYmluZCB0aGVtIHRvIHRoaXNcbiAgICB0aGlzLl9zY3JvbGxIYW5kbGVyID0gdGhpcy5fc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX3Jlc2l6ZUhhbmRsZXIgPSB0aGlzLl9yZXNpemVIYW5kbGVyLmJpbmQodGhpcyk7XG5cbiAgICAvLyBFbnN1cmUgdmFsaWQgdmlldyBtZXRyaWNzXG4gICAgdGhpcy5fY2FsY1ZpZXdNZXRyaWNzKCk7XG5cbiAgICAvLyBiaW5kIGFueSBldmVudCBoYW5kbGVycyBub3cgaWYgbm90IGFza2VkIHRvIGRlbGF5XG4gICAgaWYoIW9wdHMuZGVsYXlCaW5kKSB7XG4gICAgICAgIHRoaXMuYmluZCgpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGtub3cgYWJvdXQgU2Nyb2xsLCBhdHRhY2ggaXQgbm93XG4gICAgdGhpcy5zY3JvbGwgPSBMaXRlTGlzdC5TY3JvbGwgPyBuZXcgTGl0ZUxpc3QuU2Nyb2xsKG9wdHMuc2Nyb2xsVmlldywgdGhpcy5fc2Nyb2xsSGFuZGxlcikgOiBmYWxzZTtcblxuICAgIC8vIEtpY2tzIG9mZiBhIGxheW91dCAoZGlydHlSZXNpemUgZGVmYXVsdHMgdG8gdHJ1ZSlcbiAgICAvLyBUaGlzIHdpbGwgbGF5b3V0IGV2ZXJ5dGhpbmcgbmljZWx5IGZpbGxpbmcgYWxsIGNvbHVtbnNcbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn1cblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjVmlld01ldHJpY3MgPSBmdW5jdGlvbiBjYWxjVmlld01ldHJpY3MoKSB7XG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gdGhpcy52aWV3LmNsaWVudFdpZHRoO1xuICAgIHRoaXMucm93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsICh0aGlzLmNsaWVudEhlaWdodCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSk7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IodGhpcy5jbGllbnRXaWR0aCAgLyAodGhpcy5pdGVtV2lkdGggICsgdGhpcy5tYXJnaW4ueCkpIDogMTtcbiAgICB0aGlzLml0ZW1zUGVyUGFnZSAgICA9IHRoaXMucm93c1BlclBhZ2UgKiB0aGlzLml0ZW1zUGVyUm93O1xuICAgIHRoaXMubWF4QnVmZmVyICAgICAgID0gdGhpcy5pdGVtc1BlclBhZ2UgKiAzO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjRG9jSGVpZ2h0ID0gZnVuY3Rpb24gY2FsY0RvY0hlaWdodCgpIHtcbiAgICB2YXIgcm93ID0gTWF0aC5jZWlsKHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aC90aGlzLml0ZW1zUGVyUm93KTtcbiAgICB2YXIgbmV3SGVpZ2h0ID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcblxuICAgIGlmKG5ld0hlaWdodCAhPT0gdGhpcy5oZWlnaHQpIHtcbiAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBuZXdIZWlnaHQgKyBcInB4XCI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gbmV3SGVpZ2h0O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5oZWlnaHQ7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2luaXRJblZpZXdJdGVtID0gZnVuY3Rpb24gX2luaXRJblZpZXdJdGVtKGl0ZW0pIHtcbiAgICBpdGVtLmlkICAgPSB0aGlzLl9pZCsrO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHRvIGFkZCBhIGNsb25lXG4gICAgLy8gdG8gdGhlIGRvbVxuICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlKSB7XG4gICAgICAgIHZhciBuZXdOb2RlID0gdGhpcy5pdGVtVGVtcGxhdGUuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgICAgIGlmKG5ld05vZGUgaW5zdGFuY2VvZih3aW5kb3cuRG9jdW1lbnRGcmFnbWVudCkpIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBuZXdOb2RlLmNoaWxkTm9kZXNbMF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5ld05vZGUpO1xuICAgICAgICBpdGVtLmVsID0gbmV3Tm9kZTtcbiAgICAgICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS5iaW5kKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGFTb3VyY2UuYmluZChpdGVtLmlkLCBuZXdOb2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVtO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9zeW5jVmlld0l0ZW0gPSBmdW5jdGlvbiBzeW5jVmlld0l0ZW0odmlld0l0ZW0pIHtcbiAgICAvLyBJZiB3ZSBoYXZlIGEgZGF0YVNvdXJjZVxuICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2Uuc3luYykge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc3luYyh2aWV3SXRlbS5pZCwgdmlld0l0ZW0uZWwsIHZpZXdJdGVtLmlkeCwgdmlld0l0ZW0uZGF0YSk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvblZpZXdJdGVtID0gZnVuY3Rpb24gcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSwgZm9yY2UpIHtcbiAgICB2YXIgaWR4ICA9IHZpZXdJdGVtLmlkeDtcbiAgICB2YXIgcm93ICA9IE1hdGguZmxvb3IoaWR4L3RoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciBjb2wgID0gKGlkeCAlIHRoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciB0b3AgID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcbiAgICB2YXIgbGVmdCA9IGNvbCAqIHRoaXMuaXRlbVdpZHRoICArIGNvbCAqIHRoaXMubWFyZ2luLng7XG5cbiAgICAvLyBBdm9pZCB0cmlnZ2VyaW5nIHVwZGF0ZSBpZiB0aGUgdmFsdWUgaGFzbid0IGNoYW5nZWRcbiAgICBpZihmb3JjZSB8fCAodmlld0l0ZW0udG9wICAhPT0gdG9wKSApIHtcbiAgICAgICAgdmlld0l0ZW0udG9wICA9IHRvcDtcblxuICAgICAgICBpZih2aWV3SXRlbS5lbCkge1xuICAgICAgICAgICAgdmlld0l0ZW0uZWwuc3R5bGUudG9wID0gdG9wICsgXCJweFwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoZm9yY2UgfHwgKHZpZXdJdGVtLmxlZnQgIT09IGxlZnQpKSB7XG4gICAgICAgIHZpZXdJdGVtLmxlZnQgPSBsZWZ0O1xuXG4gICAgICAgIGlmKHZpZXdJdGVtLmVsKSB7XG4gICAgICAgICAgICB2aWV3SXRlbS5lbC5zdHlsZS5sZWZ0ID0gbGVmdCArIFwicHhcIjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fZW5zdXJlVmlzaWJsZSA9IGZ1bmN0aW9uIF9lbnN1cmVWaXNpYmxlKGRvbmUpIHtcbiAgICB2YXIgcGVyY2VudEluVmlld1N0YXJ0ID0gKCh0aGlzLnNjcm9sbFRvcCkgLyAodGhpcy5oZWlnaHQpKTtcbiAgICB2YXIgcGVyY2VudEluVmlld0VuZCAgID0gKCh0aGlzLnNjcm9sbFRvcCArIHRoaXMuY2xpZW50SGVpZ2h0KSAvICh0aGlzLmhlaWdodCkpO1xuXG4gICAgdmFyIG9sZFN0YXJ0LCBuZXdTdGFydCwgb2xkRW5kLCBuZXdFbmQsIGksIHZpZXdJdGVtO1xuXG4gICAgaWYodGhpcy5kaXJlY3Rpb24gPCAwKSB7XG4gICAgICAgIG9sZEVuZCA9IHRoaXMudmlld0J1ZmZlci52aWV3W3RoaXMudmlld0J1ZmZlci50YWlsXS5pZHg7XG4gICAgICAgIG5ld0VuZCA9IE1hdGguY2VpbCAocGVyY2VudEluVmlld0VuZCAgICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSBvbGRFbmQ7IGkgPiBuZXdFbmQgKyB0aGlzLml0ZW1zUGVyUm93OyAtLWkpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KC0xKVswXTtcblxuICAgICAgICAgICAgaWYgKHZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih0aGlzLmRpcmVjdGlvbiA+IDApIHtcbiAgICAgICAgb2xkU3RhcnQgPSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4O1xuICAgICAgICBuZXdTdGFydCA9IE1hdGguZmxvb3IocGVyY2VudEluVmlld1N0YXJ0ICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IoaSA9IG9sZFN0YXJ0OyBpIDwgbmV3U3RhcnQgLSB0aGlzLml0ZW1zUGVyUm93OyArK2kpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KDEpWzBdO1xuXG4gICAgICAgICAgICBpZih2aWV3SXRlbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkb25lKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Jlc2l6ZSA9IGZ1bmN0aW9uIF9yZXNpemUoZG9uZSkge1xuICAgIHZhciBuZXdIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHZhciBuZXdXaWR0aCAgICAgPSB0aGlzLnZpZXcuY2xpZW50V2lkdGg7XG5cbiAgICB2YXIgbmV3Um93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsIChuZXdIZWlnaHQgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpO1xuICAgIHZhciBuZXdJdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IobmV3V2lkdGggIC8gKHRoaXMuaXRlbVdpZHRoICArIHRoaXMubWFyZ2luLngpKSA6IDE7XG5cbiAgICB2YXIgcmVtb3ZlZDsgLy8sIGluVmlld09iajtcbiAgICBpZihuZXdSb3dzUGVyUGFnZSAhPT0gdGhpcy5yb3dzUGVyUGFnZSB8fCBuZXdJdGVtc1BlclJvdyAhPT0gdGhpcy5pdGVtc1BlclJvdykge1xuICAgICAgICB0aGlzLl9jYWxjVmlld01ldHJpY3MoKTtcbiAgICAgICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuXG4gICAgICAgIHZhciBwZXJjZW50SW5WaWV3ID0gdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSAvIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aDtcbiAgICAgICAgdGhpcy5zY3JvbGxUb3AgPSB0aGlzLnZpZXcuc2Nyb2xsVG9wID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAqIHBlcmNlbnRJblZpZXcpO1xuICAgICAgICB2YXIgbmV3Rmlyc3RWaXNpYmxlID0gTWF0aC5mbG9vcih0aGlzLnNjcm9sbFRvcCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiBuZXdJdGVtc1BlclJvdztcblxuICAgICAgICBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoID4gdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHJlbW92ZWQgPSB0aGlzLnZpZXdCdWZmZXIucmVzaXplKHRoaXMubWF4QnVmZmVyKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uIChpblZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQoaW5WaWV3SXRlbS5pZCwgaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoIDwgdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpXG4gICAgICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2hpZnRBbXQgPSBuZXdGaXJzdFZpc2libGUgLSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4IC0gbmV3SXRlbXNQZXJSb3c7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci5zaGlmdChzaGlmdEFtdCk7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci52aWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZG9uZSgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl91cGRhdGVWaWV3ID0gZnVuY3Rpb24gX3VwZGF0ZVZpZXcoKSB7XG4gICAgdmFyIGRvbmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSA9IE1hdGguZmxvb3IodGhpcy5zY3JvbGxUb3AgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpICogdGhpcy5pdGVtc1BlclJvdztcbiAgICAgICAgdGhpcy5fbGFzdFZpc2libGVJdGVtICA9IE1hdGguY2VpbCAoKHRoaXMuc2Nyb2xsVG9wICsgdGhpcy5jbGllbnRIZWlnaHQpLyh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiB0aGlzLml0ZW1zUGVyUm93O1xuXG4gICAgICAgIHRoaXMuZGlydHlSZXNpemUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50aWNraW5nICAgICA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbiAgID0gMDtcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZih0aGlzLmRpcnR5UmVzaXplKSB7XG4gICAgICAgIHRoaXMuX3Jlc2l6ZShkb25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9lbnN1cmVWaXNpYmxlKGRvbmUpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcmVxdWVzdFRpY2sgPSBmdW5jdGlvbiByZXF1ZXN0VGljaygpIHtcbiAgICBpZighdGhpcy50aWNraW5nKSB7XG4gICAgICAgIHRoaXMudGlja2luZyA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fdXBkYXRlVmlldyk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoKCkge1xuICAgIHZhciBhcmdzICAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIHRoaXMudmlld0J1ZmZlci5kYXRhLnB1c2guYXBwbHkodGhpcy52aWV3QnVmZmVyLmRhdGEsIGFyZ3MpO1xuXG4gICAgdmFyIG5ld0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpO1xuXG4gICAgbmV3SW5WaWV3LmZvckVhY2goZnVuY3Rpb24oaW5WaWV3RGF0YSkge1xuICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpblZpZXdEYXRhKTtcbiAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKGluVmlld0RhdGEpO1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGluVmlld0RhdGEsIHRydWUpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC5iaW5kKCk7IH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC51bmJpbmQoKTsgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKSB7XG4gICAgdmFyIGNhbGxVbmJpbmQgPSAodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpO1xuXG4gICAgdGhpcy52aWV3LnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsVG9wID0gMDtcblxuICAgIHZhciBpdGVtc0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5jbGVhcigpO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHJlbW92ZSBhbnkgbm9kZXMgd2UndmUgYWRkZWRcbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICBpdGVtc0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKGl0ZW0uZWwpICAgIHsgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpdGVtLmVsKTsgfVxuICAgICAgICAgICAgaWYoY2FsbFVuYmluZCkgeyB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpOyB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5zY3JvbGwpIHsgdGhpcy5zY3JvbGwucmVzZXQoKTsgfVxuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLnRpY2tpbmcpO1xuICAgIHRoaXMudGlja2luZyA9IDA7XG5cbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2goLypmbiwgdGhpc0FyZyovKSB7XG4gICAgcmV0dXJuIHRoaXMuaXRlbXMuZm9yRWFjaC5hcHBseSh0aGlzLml0ZW1zLCBhcmd1bWVudHMpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmZvckVhY2hJblZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy52aWV3QnVmZmVyLmZvckVhY2hJblZpZXcuYXBwbHkodGhpcy52aWV3QnVmZmVyLCBhcmd1bWVudHMpO1xufTtcblxuXG5MaXRlTGlzdC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKHNlYXJjaElkeCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnZpZXdCdWZmZXIucmVtb3ZlKHNlYXJjaElkeCk7XG5cbiAgICByZXN1bHQubmV3SW5WaWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKGl0ZW0pO1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGl0ZW0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYodGhpcy5pdGVtVGVtcGxhdGUgfHwgdGhpcy5kYXRhU291cmNlKSB7XG4gICAgICAgIHJlc3VsdC5yZW1vdmVkLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFzb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaXRlbS5lbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHJlc3VsdC51cGRhdGVkLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGl0ZW0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9zY3JvbGxIYW5kbGVyID0gZnVuY3Rpb24gc2Nyb2xsSGFuZGxlcigvKmV2dCovKSB7XG4gICAgdmFyIHNjcm9sbFRvcCAgID0gdGhpcy52aWV3LnNjcm9sbFRvcDtcblxuICAgIGlmKHNjcm9sbFRvcCAhPT0gdGhpcy5zY3JvbGxUb3ApIHtcbiAgICAgICAgdGhpcy5kaXJlY3Rpb24gID0gc2Nyb2xsVG9wID4gdGhpcy5zY3JvbGxUb3AgPyAxIDogLTE7XG4gICAgICAgIHRoaXMuc2Nyb2xsVG9wICA9IHNjcm9sbFRvcDtcbiAgICAgICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Jlc2l6ZUhhbmRsZXIgPSBmdW5jdGlvbiByZXNpemVIYW5kbGVyKC8qZXZ0Ki8pIHtcbiAgICB0aGlzLmRpcnR5UmVzaXplID0gdHJ1ZTtcbiAgICB0aGlzLl9yZXF1ZXN0VGljaygpO1xufTtcblxuLy8gVmVyc2lvbi5cbkxpdGVMaXN0LlZFUlNJT04gPSAnMC40LjYnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZUxpc3Q7IiwidmFyIExpdGVMaXN0ID0gcmVxdWlyZSgnLi9saXRlbGlzdCcpO1xudmFyIHJpdmV0cztcblxuLy8gSnVzdCBoZXJlIHRvIHNpbXBsaWZ5IHRoZSBpbml0aWFsaXphdGlvbiBsb2dpYy4gIElmXG4vLyB3aW5kb3cgZG9lc24ndCBleGlzdCwgdGhpcyBtb2R1bGUgaXMgdXNlbGVzcyBhbnl3YXlcbmlmKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7IHdpbmRvdyA9IHt9OyB9XG5cbi8vIFRoZSBidWlsZCB3aWxsIGRlY2xhcmUgVFdFRU4gYXMgZXh0ZXJuYWwuIEhvd2V2ZXIsIGlmIGl0IGlzbid0IHByb3ZpZGVkIGJ5XG4vLyBicm93c2VyaWZ5LCB3ZSByZWFsbHkgd2FudCB0byBjaGVjayB0byBzZWUgaWYgaXQgd2FzIGluY2x1ZGVkIGRpcmVjdGx5IHZpYVxuLy8gc2NyaXB0IHRhZyBmaXJzdC4gIE9ubHkgaWYgaXQgaXNuJ3Qgd2lsbCB3ZSB0cnkgYSByZXF1aXJlLiAgVGhpcyAqc2hvdWxkKlxuLy8gbWFrZSBpdCBlYXNpZXIgdG8gYnVuZGxlL29yIG5vdCBhbmQgdG8gdXNlIHdpdGggcmVxdWlyZWpzLi4uXG5yaXZldHMgPSB3aW5kb3cucml2ZXRzIHx8IHJlcXVpcmUoXCJyaXZldHNcIik7XG5cblxuLypcbiAqIEluIGFkZGl0aW9uIHRvIHRoZSBvcHRpb25zIGRvY3VtZW50ZWQgaW4gTGl0ZUxpc3RcbiAqXG4gKiBvcHRzOiB7XG4gKiAgIHJpdmV0c01vZGVsczogeyAuLi4gfSAgLy8gIEFueSBhZGRpdGlvbmFsIG1vZGVscyB0aGF0IG5lZWQgdG8gYmUgcHJvdmlkZWQgZm9yIHJpdmV0cy5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgVGhlc2Ugd2lsbCBiZSBpbmNsdWRlZCBhbG9uZyB3aXRoIHsgaXRlbXM6IGl0ZW1zSW5WaWV3IH1cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgd2hlbiBjYWxsaW5nIHJpdmV0cy5iaW5kLlxuICogICByaXZldHNPcHRzOiAgIHsgLi4uIH0gIC8vICBBbnkgYWRkaXRpb25hbCByaXZldHMgY29uZmlndXJhdGlvbi4gQmluZGVycyBmb3IgdG9wLCBsZWZ0IGFuZCBoZWlnaHRcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgd2lsbCBiZSBtaXhlZCBpbiBwcmlvciB0byBjYWxsaW5nIHJpdmV0cy5iaW5kXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIFJWTGl0ZUxpc3QoX29wdHMpIHtcbiAgICB2YXIgZGVsYXlCaW5kID0gX29wdHMuZGVsYXlCaW5kO1xuXG4gICAgLy8gRG9uJ3QgbGV0IExpdGVMaXN0IGJpbmQgLSB3ZSdsbCBkbyB0aGF0IGhlcmUgaWYgZGVsYXlCaW5kIGlzbid0IHRydWVcbiAgICAvLyBNYWtlIGEgY29weSBvZiB0aGUgaW5jb21pbmcgb3B0cyBzbyB3ZSBkb24ndCBtb2RpZnkgdGhlIG9yaWdpbmFsIHZlcnNpb24gYW5kXG4gICAgLy8gY2F1c2Ugd2VpcmQgYnVncyBpZiB0aGUgY2FsbGVyIGlzbid0IGV4cGVjdGluZyB0aGUgaW5jb21pbmcgdmFsdWUgdG8gY2hhbmdlLlxuICAgIHZhciBvcHRzID0ge307XG5cbiAgICAvLyBXZSBhcmUgb25seSB0b3VjaGluZyBhIHNpbXBsZSBwcm9wZXJ0eSwgc28gaXQgaXMgb2sgdG8gZHVwbGljYXRlIGFueSBjb21wbGV4XG4gICAgLy8gcHJvcGVydGllcyBoZXJlIHJhdGhlciB0aGFuIGRvaW5nIGEgdHJ1ZSBkZWVwIGNvcHkuXG4gICAgT2JqZWN0LmtleXMoX29wdHMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7IG9wdHNba2V5XSA9IF9vcHRzW2tleV07IH0pO1xuICAgIG9wdHMuZGVsYXlCaW5kID0gdHJ1ZTtcblxuICAgIExpdGVMaXN0LmNhbGwodGhpcywgb3B0cyk7XG5cbiAgICB0aGlzLnJpdmV0c01vZGVscyA9IG9wdHMucml2ZXRzTW9kZWxzIHx8IHt9O1xuICAgIHRoaXMucml2ZXRzT3B0cyAgID0gb3B0cy5yaXZldHNPcHRzICAgfHwge307XG5cbiAgICAvLyBPdmVyd3JpdGUgYW55IGV4aXN0aW5nIHZhbHVlIGluIHRoZSBwcm92aWRlZCBtb2RlbCBpZiBpdCBleGlzdHMuXG4gICAgdGhpcy5yaXZldHNNb2RlbHMuaXRlbXMgICA9IHRoaXMudmlld0J1ZmZlci52aWV3O1xuICAgIHRoaXMucml2ZXRzTW9kZWxzLm1ldHJpY3MgPSB0aGlzLmxpdGVMaXN0O1xuXG4gICAgLy8gdXNlIHByb3ZpZGVkIHJpdmV0c09wdHMgYW5kIGFsbG93IGN1c3RvbSB0b3AsIGxlZnQgYW5kIGhlaWdodCBiaW5kZXJzIGlmIHRoZSBjYWxsZXJcbiAgICAvLyB3YW50cyB0byBhbmQga25vd3Mgd2hhdCB0aGV5IGFyZSBkb2luZy4uLlxuICAgIHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzICAgICAgICA9IHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzIHx8IHt9O1xuICAgIHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLnRvcCAgICA9IHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLnRvcCAgICB8fCBmdW5jdGlvbihlbCwgdmFsKSB7IGVsLnN0eWxlLnRvcCAgICA9IHZhbCArIFwicHhcIjsgfTtcbiAgICB0aGlzLnJpdmV0c09wdHMuYmluZGVycy5sZWZ0ICAgPSB0aGlzLnJpdmV0c09wdHMuYmluZGVycy5sZWZ0ICAgfHwgZnVuY3Rpb24oZWwsIHZhbCkgeyBlbC5zdHlsZS5sZWZ0ICAgPSB2YWwgKyBcInB4XCI7IH07XG4gICAgdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMuaGVpZ2h0ID0gdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMuaGVpZ2h0IHx8IGZ1bmN0aW9uKGVsLCB2YWwpIHsgZWwuc3R5bGUuaGVpZ2h0ID0gdmFsICsgXCJweFwiOyB9O1xuXG4gICAgLy8gSnVzdCB0YWtlIGNhcmUgb2Ygb3Vyc2VsdmVzIGR1cmluZyBjb25zdHJ1Y3Rpb24gc28gd2UgZG9uJ3QgZG91YmxlIGJpbmRcbiAgICBpZighZGVsYXlCaW5kKSB7XG4gICAgICAgIHRoaXMuYmluZCgpO1xuICAgIH1cbn1cblxuLy8gc3ViY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzXG5SVkxpdGVMaXN0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoTGl0ZUxpc3QucHJvdG90eXBlKTtcblJWTGl0ZUxpc3QucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUlZMaXRlTGlzdDtcblxuUlZMaXRlTGlzdC5wcm90b3R5cGUudW5iaW5kID0gZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmKHRoaXMucnZWaWV3KSB7XG4gICAgICAgIHRoaXMucnZWaWV3LnVuYmluZCgpO1xuXG4gICAgICAgIC8vIFBlbmRpbmcgdGhlIHJlc29sdXRpb24gb2Ygcml2ZXRzIzMwNiAgYW5kIHJpdmV0cyMzMDctIHRoaXMgd2lsbCBiZSBjaGFuZ2VkIHRvIHJlYmluZCB0aGUgdmlldyBpZiB0aGVcbiAgICAgICAgLy8gdmlldyBhbHJlYWR5IGV4aXN0cy4gIFVudGlsIHRoYXQgYmVoYXZpb3IgaXMgZml4ZWQsIHdlJ2xsIGdvIHRocm91Z2ggdGhlIG92ZXJoZWFkIG9mXG4gICAgICAgIC8vIGNyZWF0aW5nIGEgbmV3IHZpZXcuXG4gICAgICAgIHRoaXMucnZWaWV3ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgTGl0ZUxpc3QucHJvdG90eXBlLnVuYmluZC5jYWxsKHRoaXMpO1xufTtcblxuUlZMaXRlTGlzdC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gUGVuZGluZyB0aGUgcmVzb2x1dGlvbiBvZiByaXZldHMjMzA2IC0gdGhpcyB3aWxsIGJlIGNoYW5nZWQgdG8gcmViaW5kIHRoZSB2aWV3IGlmIHRoZVxuICAgIC8vIHZpZXcgYWxyZWFkeSBleGlzdHMuICBVbnRpbCB0aGF0IGJlaGF2aW9yIGlzIGZpeGVkLCB3ZSdsbCBnbyB0aHJvdWdoIHRoZSBvdmVyaGVhZCBvZlxuICAgIC8vIGNyZWF0aW5nIGEgbmV3IHZpZXcuICBDYWxsZXIgYmV3YXJlLi4uXG4gICAgdGhpcy5ydlZpZXcgPSByaXZldHMuYmluZCh0aGlzLnZpZXcsIHRoaXMucml2ZXRzTW9kZWxzLCB0aGlzLnJpdmV0c09wdHMpO1xuXG4gICAgTGl0ZUxpc3QucHJvdG90eXBlLmJpbmQuY2FsbCh0aGlzKTtcbn07XG5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gUlZMaXRlTGlzdDtcblxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qXG4gKiBDaXJjdWxhciBidWZmZXIgcmVwcmVzZW50aW5nIGEgdmlldyBvbiBhbiBhcnJheSBvZiBlbnRyaWVzLlxuICovXG5mdW5jdGlvbiBWaWV3QnVmZmVyKGRhdGEsIGluaXRpYWxTaXplKSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gLTE7XG4gICAgdGhpcy5zaXplID0gMDtcbiAgICB0aGlzLmRhdGEgPSBkYXRhIHx8IFtdO1xuICAgIHRoaXMudmlldyA9IFtdO1xuXG4gICAgLy8gU3BlY2lhbCBjYXNlIGhlcmVcbiAgICBpZihpbml0aWFsU2l6ZSkgeyB0aGlzLnJlc2l6ZShpbml0aWFsU2l6ZSk7IH1cbn1cblxuLypcbiAqIFNocmluayB0aGUgdmlldyBidWZmZXJcbiAqXG4gKiBAcGFyYW0gbmV3U2l6ZVxuICogQHBhcmFtIGhlYWQ6ICAgICBpZiB0cnVlLCB3aWxsIHNocmluayByZWxhdGl2ZSB0byBoZWFkLlxuICpcbiAqIEByZXR1cm5zOiBBcnJheSBvZiByZW1vdmVkIHZpZXcgYnVmZmVyIGVudHJpZXNcbiAqL1xuZnVuY3Rpb24gX3NocmluayhuZXdTaXplLCBoZWFkKSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgZGVsdGEgPSBbXTtcbiAgICB2YXIgdmlldyAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIHNocmlua2FnZSA9IHZpZXcubGVuZ3RoIC0gbmV3U2l6ZTtcbiAgICB2YXIgc3BsaWNlZDtcblxuICAgIGlmKG5ld1NpemUgPj0gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHNocmluayB0byBhIHNpemUgbGFyZ2VyIHRoYW4gdGhlIGN1cnJlbnQgc2l6ZVwiKTtcbiAgICB9XG5cbiAgICB3aGlsZShzaHJpbmthZ2UgJiYgdmlldy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHNwbGljZWQgPSB2aWV3LnNwbGljZShoZWFkID8gdGhpcy5oZWFkIDogdGhpcy50YWlsLCAxKTtcbiAgICAgICAgZGVsdGEucHVzaChzcGxpY2VkWzBdKTtcblxuICAgICAgICAvLyBXaGVuIHNocmlua2luZyBmcm9tIGhlYWQsIHRoZSBvbmx5IHRpbWUgdGhlIGhlYWRzIHJlc3VsdGluZyB2YWx1ZSBjaGFuZ2VzIGlzXG4gICAgICAgIC8vIGlmIGhlYWQgaXMgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdC4gIFNvIGl0IGlzIHNhZmUgdG8gdGFrZSB0aGUgbW9kdWxvIG9mIGhlYWRcbiAgICAgICAgLy8gYWdhaW5zdCB0aGUgbmV3IHZpZXcgbGVuZ3RoO1xuICAgICAgICAvL1xuICAgICAgICAvLyBUYWlsIGlzIHRoZW4gdGhlIG1vZHVsbyBvZiBoZWFkICsgMTtcbiAgICAgICAgaWYoaGVhZCkge1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkICUgdmlldy5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSAodGhpcy5oZWFkICsgMSkgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgfSBlbHNlIGlmKHRoaXMudGFpbCA8IHRoaXMuaGVhZCkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsIC0gMTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IHRoaXMuaGVhZCAtIDE7XG5cbiAgICAgICAgICAgIGlmKHRoaXMudGFpbCA8IDApIHsgdGhpcy50YWlsID0gdmlldy5sZW5ndGggLSAxOyB9XG4gICAgICAgIH0gZWxzZSBpZih0aGlzLnRhaWwgPiB0aGlzLmhlYWQpIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbCAtIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGV5IGFyZSBlcXVhbCB3aGVuIGJvdGggYXJlIHplcm9cbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLS1zaHJpbmthZ2U7XG4gICAgfVxuXG4gICAgaWYodmlldy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gLTE7XG4gICAgfVxuXG4gICAgdGhpcy5zaXplID0gdmlldy5sZW5ndGg7XG4gICAgcmV0dXJuIGRlbHRhO1xufVxuXG4vKlxuICogR3Jvd3MgdGhlIHZpZXcgYnVmZmVyOiAgdGhlIHZpZXcgYnVmZmVyIHdpbGwgZ3JvdyBpbiB0aGUgcmVxdWVzdGVkIGRpcmVjdGlvblxuICogYXMgbXVjaCBhcyBpdCBjYW4uICBXaGVuIGl0IHJlYWNoZXMgYSBsaW1pdCwgaXQgd2lsbCB0cnkgdG8gZ3JvdyBpbiB0aGUgb3Bwb3NpdGVcbiAqIGRpcmVjdGlvbiBhcyB3ZWxsLlxuICpcbiAqIEBwYXJhbSBuZXdTaXplXG4gKiBAcGFyYW0gaGVhZDogICAgIGlmIHRydWUsIHdpbGwgZ3JvdyByZWxhdGl2ZSB0byBoZWFkXG4gKlxuICogQHJldHVybnM6IEFycmF5IG9mIG5ld2x5IGluaXRpYWxpemVkIHZpZXcgYnVmZmVyIGVudHJpZXNcbiAqL1xuZnVuY3Rpb24gX2dyb3cobmV3U2l6ZSwgaGVhZCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIGRlbHRhID0gW107XG4gICAgdmFyIHZpZXcgICA9IHRoaXMudmlldztcbiAgICB2YXIgZGF0YSAgID0gdGhpcy5kYXRhO1xuICAgIHZhciBncm93dGggPSBuZXdTaXplIC0gdmlldy5sZW5ndGg7XG4gICAgdmFyIG5ld0VudHJ5O1xuXG4gICAgaWYobmV3U2l6ZSA+IGRhdGEubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBncm93IHRvIGEgc2l6ZSBsYXJnZXIgdGhhbiB0aGUgY3VycmVudCBkYXRhc2V0XCIpO1xuICAgIH1cblxuICAgIGlmKGdyb3d0aCA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGdyb3cgdG8gYSBzaXplIHNtYWxsZXIgdGhhbiB0aGUgY3VycmVudCBzaXplXCIpO1xuICAgIH1cblxuICAgIC8vIE5vdGhpbmcgdG8gZG8gaGVyZSwganVzdCByZXR1cm4gYW4gZW1wdHkgZGVsdGFcbiAgICBpZihncm93dGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGRlbHRhO1xuICAgIH1cblxuICAgIHdoaWxlKGdyb3d0aCkge1xuICAgICAgICBpZih0aGlzLmhlYWQgPT09IC0xICYmIHRoaXMudGFpbCA9PT0gLTEpIHtcbiAgICAgICAgICAgIG5ld0VudHJ5ID0ge1xuICAgICAgICAgICAgICAgIGlkeDogIDAsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVswXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmlldy5wdXNoKG5ld0VudHJ5KTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihoZWFkICYmIHZpZXdbdGhpcy5oZWFkXS5pZHggPiAwKSB7XG4gICAgICAgICAgICBuZXdFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICBpZHg6ICB2aWV3W3RoaXMuaGVhZF0uaWR4IC0gMSxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhW3ZpZXdbdGhpcy5oZWFkXS5pZHggLSAxXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gYWx3YXlzIHNhZmUgdG8gYWRkIGFmdGVyIHRoZSB0YWlsXG4gICAgICAgICAgICB2aWV3LnNwbGljZSh0aGlzLmhlYWQsIDAsIG5ld0VudHJ5KTtcblxuICAgICAgICAgICAgLy8gSGVhZCBkb2Vzbid0IGNoYW5nZVxuICAgICAgICAgICAgdGhpcy50YWlsID0gKHRoaXMuaGVhZCAtIDEgKyB2aWV3Lmxlbmd0aCkgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgfSBlbHNlIGlmKHZpZXdbdGhpcy50YWlsXS5pZHggPCBkYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIG5ld0VudHJ5ID0ge1xuICAgICAgICAgICAgICAgIGlkeDogIHZpZXdbdGhpcy50YWlsXS5pZHggKyAxLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFbdmlld1t0aGlzLnRhaWxdLmlkeCArIDFdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2aWV3LnNwbGljZSh0aGlzLnRhaWwgKyAxLCAwLCBuZXdFbnRyeSk7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgKyAxO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gKHRoaXMudGFpbCArIDEpICUgdmlldy5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIElmIHdlIGNhbid0IGFkZCBhbnltb3JlIGF0IHRoZSB0YWlsLCBmb3JjZSB0aGlzIGludG9cbiAgICAgICAgICAgIC8vIHRoZSBoZWFkIGxvZ2ljIHdoaWNoIHdpbGwgb25seSBncm93IHdoZW4gdGhlIGlkeCA+IDBcbiAgICAgICAgICAgIGlmKG5ld0VudHJ5LmlkeCA9PT0gZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgaGVhZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZih2aWV3W3RoaXMudGFpbF0uaWR4ID09PSBkYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIC8vIFNwZWNpYWwgY2FzZSAtIGlmIHRoZSB2aWV3IGlzIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAgICAgICAgIC8vIHNldCBoZWFkIHRvIHRydWUgYW5kIGxvb3AgYXJvdW5kIHdpdGhvdXQgZGVjcmVtZW50aW5nXG4gICAgICAgICAgICAvLyBncm93dGhcbiAgICAgICAgICAgIGhlYWQgPSB0cnVlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihuZXdFbnRyeSkgeyBkZWx0YS5wdXNoKG5ld0VudHJ5KTsgfVxuICAgICAgICBuZXdFbnRyeSA9IGZhbHNlO1xuICAgICAgICAtLWdyb3d0aDtcbiAgICB9XG5cbiAgICB0aGlzLnNpemUgPSB2aWV3Lmxlbmd0aDtcbiAgICByZXR1cm4gZGVsdGE7XG59XG5cbi8qXG4gKiBNb3ZlcyB0aGUgYnVmZmVyIHRvd2FyZHMgdGhlIGVuZCBvZiB0aGUgZGF0YSBhcnJheVxuICovXG5mdW5jdGlvbiBfc2hpZnRSaWdodChjb3VudCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIHZpZXcgICAgICAgID0gdGhpcy52aWV3O1xuICAgIHZhciBuZXdJblZpZXcgICA9IFtdO1xuICAgIHZhciBjdXJUYWlsSWR4O1xuICAgIHZhciB0YWlsID0gdGhpcy50YWlsO1xuICAgIHZhciBoZWFkID0gdGhpcy5oZWFkO1xuXG4gICAgY291bnQgPSBjb3VudCB8fCAxO1xuXG4gICAgd2hpbGUoY291bnQpIHtcbiAgICAgICAgY3VyVGFpbElkeCAgPSB2aWV3W3RhaWxdLmlkeDtcblxuICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgd2UgYXJlIGFscmVhZHkgYXQgdGhlIGVuZFxuICAgICAgICBpZihjdXJUYWlsSWR4ID09PSB0aGlzLmRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgICAgICAgICByZXR1cm4gbmV3SW5WaWV3O1xuICAgICAgICB9XG5cbiAgICAgICAgdGFpbCA9ICh0YWlsICsgMSkgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgaGVhZCA9IChoZWFkICsgMSkgJSB2aWV3Lmxlbmd0aDtcblxuICAgICAgICB2aWV3W3RhaWxdLmlkeCAgPSBjdXJUYWlsSWR4ICsgMTtcbiAgICAgICAgdmlld1t0YWlsXS5kYXRhID0gdGhpcy5kYXRhW2N1clRhaWxJZHggKyAxXTtcblxuICAgICAgICBuZXdJblZpZXcucHVzaCh2aWV3W3RhaWxdKTtcblxuICAgICAgICAvLyBPbmx5IG1haW50YWluIGF0IG1vc3Qgdmlldy5sZW5ndGggaXRlbXNcbiAgICAgICAgaWYobmV3SW5WaWV3Lmxlbmd0aCA+IHZpZXcubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXdJblZpZXcuc2hpZnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC0tY291bnQ7XG4gICAgfVxuXG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICB0aGlzLmhlYWQgPSBoZWFkO1xuXG4gICAgcmV0dXJuIG5ld0luVmlldztcbn1cblxuLypcbiAqIE1vdmVzIHRoZSBidWZmZXIgdG93YXJkcyB0aGUgYmVnaW5uaW5nIG9mIHRoZSBkYXRhIGFycmF5XG4gKi9cbmZ1bmN0aW9uIF9zaGlmdExlZnQoY291bnQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciB2aWV3ICAgICAgICA9IHRoaXMudmlldztcbiAgICB2YXIgbmV3SW5WaWV3ICAgPSBbXTtcbiAgICB2YXIgaGVhZCAgICAgICAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHRhaWwgICAgICAgID0gdGhpcy50YWlsO1xuICAgIHZhciBkYXRhICAgICAgICA9IHRoaXMuZGF0YTtcbiAgICB2YXIgY3VySGVhZElkeDtcblxuICAgIGNvdW50ID0gY291bnQgfHwgMTtcbiAgICB3aGlsZShjb3VudCkge1xuICAgICAgICBjdXJIZWFkSWR4ICA9IHZpZXdbaGVhZF0uaWR4O1xuXG4gICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiB3ZSBhcmUgYWxyZWFkeSBhdCB0aGUgYmVnaW5uaW5nXG4gICAgICAgIGlmKGN1ckhlYWRJZHggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgICAgICAgICAgcmV0dXJuIG5ld0luVmlldztcbiAgICAgICAgfVxuXG4gICAgICAgIGhlYWQgPSAoaGVhZCAtIDEgKyB2aWV3Lmxlbmd0aCkgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgdGFpbCA9ICh0YWlsIC0gMSArIHZpZXcubGVuZ3RoKSAlIHZpZXcubGVuZ3RoO1xuXG4gICAgICAgIHZpZXdbaGVhZF0uaWR4ICA9IGN1ckhlYWRJZHggLSAxO1xuICAgICAgICB2aWV3W2hlYWRdLmRhdGEgPSBkYXRhW2N1ckhlYWRJZHggLSAxXTtcblxuICAgICAgICBuZXdJblZpZXcucHVzaCh2aWV3W2hlYWRdKTtcblxuICAgICAgICAvLyBPbmx5IG1haW50YWluIGF0IG1vc3Qgdmlldy5sZW5ndGggaXRlbXNcbiAgICAgICAgaWYobmV3SW5WaWV3Lmxlbmd0aCA+IHZpZXcubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXdJblZpZXcuc2hpZnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC0tY291bnQ7XG4gICAgfVxuXG4gICAgdGhpcy5oZWFkID0gaGVhZDtcbiAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgIHJldHVybiBuZXdJblZpZXc7XG59XG5cbi8qXG4gKiBNb3ZlcyB0aGUgYnVmZmVyIHRvd2FyZHMgdGhlIGVuZCAoY291bnQgPiAwKSBvclxuICogYmVnaW5uaW5nIChjb3VudCA8IDApIG9mIHRoZSBkYXRhIGFycmF5O1xuICpcbiAqIEByZXR1cm5zIGFycmF5IG9mIG5ldyBkYXRhIGVsZW1lbnRzIGluIHRoZSB2aWV3IGJ1ZmZlclxuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uIHNoaWZ0KGNvdW50KSB7XG4gICAgdmFyIGZuO1xuXG4gICAgY291bnQgPSBjb3VudCB8fCAxO1xuICAgIGZuICAgID0gY291bnQgPiAwID8gX3NoaWZ0UmlnaHQgOiBfc2hpZnRMZWZ0O1xuXG4gICAgcmV0dXJuIGZuLmNhbGwodGhpcywgTWF0aC5hYnMoY291bnQpKTtcbn07XG5cbi8qXG4gKiBSZXNpemUgdGhlIHZpZXcgYnVmZmVyIC0gZWl0aGVyIGdyb3dpbmcgb3Igc2hyaW5raW5nIGl0LlxuICpcbiAqIEBwYXJhbSBuZXdTaXplIC0gdGhlIG5ldyBzaXplIG9mIHRoZSB2aWV3IGJ1ZmZlclxuICogQHBhcmFtIGhlYWQgICAgLSBpZiB0cnVlLCBwcmVmZXIgcmVzaXppbmcgYmFzZWQgb24gdGhlIGhlYWQgcmF0aGVyIHRoYW4gdGhlIHRhaWxcbiAqXG4gKiBAcmV0dXJucyAgICAgICAtIEFycmF5IG9mIGFkZGVkIG9yIHJlbW92ZWQgaXRlbXNcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUucmVzaXplID0gZnVuY3Rpb24gcmVzaXplKG5ld1NpemUsIGhlYWQpIHtcbiAgICBpZihuZXdTaXplID4gdGhpcy52aWV3Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gX2dyb3cuY2FsbCh0aGlzLCBuZXdTaXplLCBoZWFkKTtcbiAgICB9IGVsc2UgaWYobmV3U2l6ZSA8IHRoaXMudmlldy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIF9zaHJpbmsuY2FsbCh0aGlzLCBuZXdTaXplLCBoZWFkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxufTtcblxuLypcbiAqIFJlc2V0cyB0aGUgdmlldyBidWZmZXIgYmFjayB0byB6ZXJvIChkYXRhIGFuZCB2aWV3KVxuICpcbiAqIEByZXR1cm5zOiBsaXN0IG9mIHZpZXcgaXRlbXM7XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKSB7XG4gICAgdmFyIGluVmlld0l0ZW1zID0gdGhpcy52aWV3LnNsaWNlKDApOyAvLyBtYWtlIGEgY29weVxuXG4gICAgLy8gRG8gdGhpcyBpbiBwbGFjZSB0byBiZSBmcmllbmRseSB0byBsaWJyYXJpZXMgKFJpdmV0cyBmb3IgZXhhbXBsZSlcbiAgICAvLyB0aGF0IGJpbmQgdG8gb2JzZXJ2ZSBjaGFuZ2VzXG4gICAgdGhpcy52aWV3LnNwbGljZSgwLCBOdW1iZXIuTUFYX1ZBTFVFKTtcbiAgICB0aGlzLmRhdGEuc3BsaWNlKDAsIE51bWJlci5NQVhfVkFMVUUpO1xuXG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gLTE7XG4gICAgdGhpcy5zaXplID0gMDtcblxuICAgIHJldHVybiBpblZpZXdJdGVtcztcbn07XG5cbi8qXG4gKiBMb2NhdGVzIGFuIGl0ZW0gaW4gdGhlIHZpZXcgYnkgaXRzIGluZGV4IGluIGRhdGEgaWYgaXQgZXhpc3RzXG4gKlxuICogQHBhcmFtIGlkeCAgLSBJbmRleCBpbiB0aGUgZGF0YSBhcnJheVxuICpcbiAqIEByZXR1cm5zICAgIC0gSW5kZXggaW4gdGhlIHZpZXcgaWYgaXQgaXMgZm91bmQgb3IgLTEgaWYgbm90XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLmZpbmREYXRhSW5kZXhJblZpZXcgPSBmdW5jdGlvbiBmaW5kRGF0YUluZGV4SW5WaWV3KGlkeCkge1xuICAgIHZhciB2aWV3ID0gdGhpcy52aWV3O1xuICAgIHZhciBsZW4gID0gdmlldy5sZW5ndGg7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGlmKHZpZXdbaV0uaWR4ID09PSBpZHgpIHtcbiAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xufTtcblxuLypcbiAqIFJlbW92ZXMgYW4gZW50cnkgZnJvbSBkYXRhIGFuZCBhZGp1c3RzIHRoZSB2aWV3IGlmIG5lY2Vzc2FyeVxuICpcbiAqIEBwYXJhbSBpZHggICAtIGluZGV4IG9mIHRoZSBpdGVtIHRvIGJlIHJlbW92ZWRcbiAqXG4gKiBAcmV0dXJucyB7XG4gKiAgICAgIG5ld0luVmlldzogICBJZiBhIGRhdGEgaXRlbSB3YXMgbW92ZWQgaW50byB0aGUgdmlldyBhcyBhIHJlc3VsdCBvZiByZW1vdmluZyBhbiBpdGVtLCBhbiBhcnJheVxuICogICAgICAgICAgICAgICAgICAgY29udGFpbmluZyB0aGUgbmV3bHkgYWRkZWQgaXRlbS5cbiAqICAgICAgcmVtb3ZlZDogICAgIElmIHRoZSB2aWV3IHNpemUgd2FzIG1vZGlmaWVkIGFzIGEgcmVzdWx0IG9mIHRoZSByZW1vdmFsLCBhbiBhcnJheSBjb250YWluaW5nXG4gKiAgICAgICAgICAgICAgICAgICB0aGUgcmVtb3ZlZCBpdGVtLlxuICogICAgICB1cGRhdGVkOiAgICAgbGlzdCBvZiBkYXRhIGl0ZW1zIHRoYXQgY2hhbmdlZCBwb3NpdGlvbnMgd2l0aGluIHRoZSB2aWV3LlxuICogfVxuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiByZW1vdmUoaWR4KSB7XG4gICAgLy92YXIgaWR4VG9SZW1vdmUgID0gZmFsc2U7XG4gICAgdmFyIGhlYWQgICAgICAgICA9IHRoaXMuaGVhZDtcbiAgICB2YXIgdGFpbCAgICAgICAgID0gdGhpcy50YWlsO1xuICAgIHZhciB2aWV3ICAgICAgICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGRhdGEgICAgICAgICA9IHRoaXMuZGF0YTtcbiAgICB2YXIgdmlld0lkeCwgZnJvbSwgdG8sIHJlc2V0Vmlld0lkeCA9IGZhbHNlO1xuXG4gICAgdmFyIHJldFZhbCA9IHtcbiAgICAgICAgbmV3SW5WaWV3OiBbXSxcbiAgICAgICAgcmVtb3ZlZDogICBbXSxcbiAgICAgICAgdXBkYXRlZDogICBbXVxuICAgIH07XG5cbiAgICB2YXIgYWRkZWQsIHJlbW92ZWQsIGk7XG5cbiAgICBpZHggPSAraWR4OyAvLyBNYWtlIHN1cmUgaXQgaXMgYSBudW1iZXJcblxuICAgIC8vIElmIGlkeCA+PSB0aGUgdG90YWwgbnVtYmVyIG9mIGl0ZW1zIGluIHRoZSBsaXN0LCB0aHJvdyBhbiBlcnJvclxuICAgIGlmKGlkeCA+PSB0aGlzLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImluZGV4IG91dCBvZiBib3VuZHNcIik7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGl0IGZyb20gaXRlbXNcbiAgICB0aGlzLmRhdGEuc3BsaWNlKGlkeCwgMSk7XG5cbiAgICAvLyBJZiBncmVhdGVyIHRoYW4gdGhlIHRhaWwgSURYLCBpdCBpcyBub3QgaW4gdGhlIHZpZXcgYW5kIG5vIGFkanVzdG1lbnRzXG4gICAgLy8gYXJlIG5lY2Vzc2FyeSB0byBhbnkgdmlldyBpdGVtcy5cbiAgICBpZihpZHggPiB0aGlzLnZpZXdbdGhpcy50YWlsXS5pZHgpIHtcbiAgICAgICAgcmV0dXJuIHJldFZhbDtcbiAgICB9XG5cbiAgICAvLyBJZiBsZXNzIHRoYW4gdGhlIGhlYWQgSURYLCBpdCBpcyBub3QgaW4gdGhlIHZpZXcsIGJ1dCBhbGwgdmlldyBpdGVtc1xuICAgIC8vIG5lZWQgdG8gYmUgYWRqdXN0ZWQgYmFjayBieSBvbmUgdG8gcmVmZXJlbmNlIHRoZSBjb3JyZWN0IGRhdGEgaW5kZXhcbiAgICAvL1xuICAgIC8vIE5lZWQgdG8gdGhpbmsgYWJvdXQgd2hldGhlciBhbnl0aGluZyB3YXMgcmVhbGx5IHVwZGF0ZWQgaGVyZS4gIElkeCBpc1xuICAgIC8vIG1vc3RseSBhbiBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBkZXRhaWwgYW5kIHRoYXQgaXMgYWxsIHRoYXQgaGFzIGJlZW5cbiAgICAvLyB1cGRhdGVkIGluIHRoaXMgY2FzZS5cbiAgICBpZihpZHggPCB2aWV3W2hlYWRdLmlkeCkge1xuICAgICAgICB2aWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgaXRlbS5pZHggPSBpdGVtLmlkeCAtIDE7XG4gICAgICAgICAgICByZXRWYWwudXBkYXRlZC5wdXNoKGl0ZW0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmV0VmFsO1xuICAgIH1cblxuICAgIGZyb20gPSB2aWV3SWR4ID0gdGhpcy5maW5kRGF0YUluZGV4SW5WaWV3KGlkeCk7XG4gICAgaWYodmlld0lkeCA9PT0gaGVhZCkge1xuICAgICAgICBpZihoZWFkID09PSAwKSB7XG4gICAgICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgICAgICB9IGVsc2UgaWYoaGVhZCA9PT0gdmlldy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSAwO1xuICAgICAgICAgICAgcmVzZXRWaWV3SWR4ID0gdHJ1ZTsgLy8gdmlld0lkeCBuZWVkcyB0byBiZSBzZXQgYXQgMCBzaW5jZSBpdCB3YXMgcmVtb3ZlZCBmcm9tIHRoZSB0YWlsXG4gICAgICAgICAgICB0byA9IHRhaWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0byA9IHRhaWwgKyB2aWV3Lmxlbmd0aCAtIDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYodmlld0lkeCA9PT0gdGFpbCkge1xuICAgICAgICAvLyBOb25lIG9mIHRoZXNlIHJlcXVpcmUgbW9kaWZ5aW5nIGlkeCAtIHRoZSBsb29wIHRvIHVwZGF0ZSBpZHggd2lsbCBuZXZlciBiZSBlbnRlcmVkXG4gICAgICAgIGlmKHRhaWwgPT09IHZpZXcubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICAgICAgfSBlbHNlIGlmKHRhaWwgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHZpZXcubGVuZ3RoIC0gMjtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IDA7XG4gICAgICAgICAgICB0byA9IC0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgLSAxO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gaGVhZCAtIDE7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYodmlld0lkeCA8IGhlYWQgJiYgdmlld0lkeCA8IHRhaWwpIHtcbiAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICAgICAgdGhpcy5oZWFkID0gaGVhZCAtIDE7XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPiBoZWFkICYmIHZpZXdJZHggPCB0YWlsKSB7XG4gICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPiBoZWFkICYmIHZpZXdJZHggPiB0YWlsKSB7XG4gICAgICAgIHRvID0gdGFpbCArIHZpZXcubGVuZ3RoIC0gMTtcbiAgICB9XG5cbiAgICB0aGlzLnNpemUgPSB0aGlzLnNpemUgLSAxO1xuICAgIHJlbW92ZWQgPSB2aWV3LnNwbGljZSh2aWV3SWR4LCAxKTtcblxuICAgIHZpZXdJZHggPSByZXNldFZpZXdJZHggPyAwIDogdmlld0lkeDtcbiAgICBmb3IoaSA9IHZpZXdJZHg7IGkgPD0gdG87ICsraSkge1xuICAgICAgICAtLXZpZXdbaSAlIHZpZXcubGVuZ3RoXS5pZHg7XG4gICAgICAgIHJldFZhbC51cGRhdGVkLnB1c2godmlld1tpICUgdmlldy5sZW5ndGhdKTtcbiAgICB9XG5cbiAgICBpZihkYXRhLmxlbmd0aCA+IHZpZXcubGVuZ3RoKSB7XG4gICAgICAgIGFkZGVkID0gdGhpcy5yZXNpemUodmlldy5sZW5ndGggKyAxKTtcbiAgICB9XG5cbiAgICByZXRWYWwucmVtb3ZlZC5wdXNoLmFwcGx5KHJldFZhbC5yZW1vdmVkLCByZW1vdmVkKTtcbiAgICByZXRWYWwubmV3SW5WaWV3LnB1c2guYXBwbHkocmV0VmFsLm5ld0luVmlldywgYWRkZWQpO1xuICAgIHJldHVybiByZXRWYWw7XG59O1xuXG4vKlxuICogSXRlcmF0ZXMgdGhyb3VnaCBhbGwgaXRlbXMgY3VycmVudGx5IGluIHRoZSBjaXJjdWxhciBidWZmZXIgc3RhcnRpbmcgYXQgdGhlIGxvZ2ljYWxcbiAqIGZpcnN0IGl0ZW0gcmF0aGVyIHRoYW4gYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgdmlldyBhcnJheS4gIFRoZSBjYWxsYmFjayBzaWduYXR1cmVcbiAqIGlzIHNpbWlsYXIgdG8gQXJyYXkuZm9yRWFjaCwgaG93ZXZlciBib3RoIHRoZSByYXcgaW5kZXggYW5kIHRoZSBsb2dpY2FsIGluZGV4IGFyZVxuICogcGFzc2VkLlxuICpcbiAqIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCBmb3VyIGFyZ3VtZW50czpcbiAqXG4gKiAgICAgIHRoZSB2aWV3IGl0ZW1cbiAqICAgICAgdGhlIHZpZXcgaXRlbXMgbG9naWNhbCBpbmRleFxuICogICAgICB0aGUgdmlldyBpdGVtcyBwaHlzaWNhbCBpbmRleFxuICogICAgICB0aGUgdmlld1xuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5mb3JFYWNoSW5WaWV3ID0gZnVuY3Rpb24gZm9yRWFjaEluVmlldyhjYiwgdXNlQXNUaGlzKSB7XG4gICAgdmFyIHZpZXcgID0gdGhpcy52aWV3O1xuICAgIHZhciBsZW4gICA9IHZpZXcubGVuZ3RoO1xuICAgIHZhciBoZWFkICA9IHRoaXMuaGVhZDtcbiAgICB2YXIgdGFpbCAgPSB0aGlzLnRhaWw7XG4gICAgdmFyIHRvICAgID0gdGFpbCA8IGhlYWQgPyB0YWlsICsgbGVuIDogdGFpbDtcbiAgICB2YXIgaSwgY3VySXRlbSwgcmVhbElkeDtcblxuICAgIHVzZUFzVGhpcyA9IHVzZUFzVGhpcyB8fCB0aGlzO1xuXG4gICAgZm9yKGkgPSBoZWFkOyBpIDw9IHRvOyArK2kpIHtcbiAgICAgICAgcmVhbElkeCA9IGkgJSBsZW47XG4gICAgICAgIGN1ckl0ZW0gPSB2aWV3W3JlYWxJZHhdO1xuXG4gICAgICAgIGNiLmNhbGwodXNlQXNUaGlzLCBjdXJJdGVtLCBpIC0gaGVhZCwgcmVhbElkeCwgdmlldyk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3QnVmZmVyO1xuIl19
(2)
});
