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

    // View Metrics
    this.clientHeight    = 0;
    this.clientWidth     = 0;
    this.rowsPerPage     = 0;
    this.itemsPerRow     = 0;
    this.itemsPerPage    = 0;
    this.maxBuffer       = 0;
    this.height          = 0;

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
        this.ticking = true;
        window.requestAnimationFrame(this._updateView);
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
LiteList.VERSION = '0.4.3';


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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvbGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3J2bGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3ZpZXdidWZmZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBWaWV3QnVmZmVyID0gcmVxdWlyZSgnLi92aWV3YnVmZmVyJyk7XG5cbi8qXG4gKiBMaXRlTGlzdFxuICpcbiAqIG9wdHM6IHtcbiAqICBpdGVtV2lkdGggICAgICAgOiBPcHRpb25hbCAtIHdpZHRoIG9mIGVhY2ggaXRlbS4gIElmIG5vdCBwcm92aWRlIG9uZSBpdGVtIHBlciByb3cgaXMgYXNzdW1lZFxuICogIGl0ZW1IZWlnaHQgICAgICA6IFJlcXVpcmVkIC0gaGVpZ2h0IG9mIGVhY2ggaXRlbS5cbiAqICBtYXJnaW4gICAgICAgICAgOiBPcHRpb25hbCAtIG1hcmdpbi9ndXR0ZXJzIGZvciB0aGUgaXRlbXMuICBEZWZhdWx0cyB0bzogeyB4OiAwLCB5OiAwIH07XG4gKiAgc2Nyb2xsVmlldyAgICAgIDogUmVxdWlyZWQgLSBxdWVyeSBzZWxlY3RvciBmb3IgdGhlIHNjcm9sbGFibGUgY29udGFpbmVyXG4gKiAgaXRlbXNDb250YWluZXIgIDogT3B0aW9uYWwgLSBxdWVyeSBzZWxlY3RvciBjb250YWluZXIgb2YgdGhlIGl0ZW1zLiAgRGVmYXVsdHMgdG8gdGhlIGZpcnN0IGNoaWxkIG9mIHNjcm9sbFZpZXdcbiAqICBkZWxheUJpbmQgICAgICAgOiBPcHRpb25hbCAtIGlmIHRydWUgd2lsbCB3YWl0IGZvciBhIGNhbGwgdG8gbGl0ZUxpc3QuYmluZCgpIHRvIGF0dGFjaCBhbnkgaGFuZGxlcnNcbiAqXG4gKiAgLy8gVGhlIG5leHQgdHdvIGFyZSByZXF1aXJlZCBmb3IgYSB2YW5pbGxhIGphdmFzY3JpcHQgaW1wbGVtZW50YXRpb24gdG8gYmUgZnVuY3Rpb25hbC4gIExpc3RMaXN0IHdhc1xuICogIC8vIHdyaXR0ZW4gdG8gd29yayB3aXRoIHRoZSBSaXZldHMgbGlicmFyeSB3aGljaCBwcm92aWRlcyB0aGlzIGZ1bmN0aW9uYWxpdHkgYXMgd2VsbC4gIEluIHRoYXQgY2FzZSxcbiAqICAvLyBpdCBpcyBvcHRpb25hbC4gIGkuZS4gdGhlIExpdGVMaXN0IHdpbGwgY29udGludWUgb24gaWYgdGhlc2UgYXJlIG5vdCBwcm92aWRlZC5cbiAqICBpdGVtVGVtcGxhdGUgICAgOiBSZXF1aXJlZCAtIERPTSBub2RlIHRoYXQgd2lsbCBiZSBjbG9uZWQgYXMgYSB0ZW1wbGF0ZSBmb3IgZWFjaCBpdGVtLlxuICogIGRhdGFTb3VyY2UgICAgICA6IFJlcXVpcmVkIC0gSW1wbGVtZW50YXRpb24gb2YgdGhlIGRhdGFTb3VyY2UgY29udHJhY3QgKHNlZSBiZWxvdyBmb3IgbW9yZSBkZXRhaWxzKS5cbiAqIH1cbiAqL1xuZnVuY3Rpb24gTGl0ZUxpc3Qob3B0cykge1xuICAgIHRoaXMudmlld0J1ZmZlciAgICAgID0gbmV3IFZpZXdCdWZmZXIoKTtcbiAgICB0aGlzLml0ZW1XaWR0aCAgICAgICA9IG9wdHMuaXRlbVdpZHRoIHx8IDA7XG4gICAgdGhpcy5pdGVtSGVpZ2h0ICAgICAgPSBvcHRzLml0ZW1IZWlnaHQ7XG4gICAgdGhpcy5tYXJnaW4gICAgICAgICAgPSBvcHRzLm1hcmdpbiB8fCB7IHg6IDAsIHk6IDAgfTtcbiAgICB0aGlzLmRhdGFTb3VyY2UgICAgICA9IG9wdHMuZGF0YVNvdXJjZSB8fCBmYWxzZTtcbiAgICB0aGlzLml0ZW1UZW1wbGF0ZSAgICA9IG9wdHMuaXRlbVRlbXBsYXRlIHx8IGZhbHNlO1xuICAgIHRoaXMuc2Nyb2xsVG9wICAgICAgID0gMDtcbiAgICB0aGlzLmRpcnR5UmVzaXplICAgICA9IHRydWU7XG4gICAgdGhpcy50aWNraW5nICAgICAgICAgPSBmYWxzZTtcblxuICAgIC8vIFZpZXcgTWV0cmljc1xuICAgIHRoaXMuY2xpZW50SGVpZ2h0ICAgID0gMDtcbiAgICB0aGlzLmNsaWVudFdpZHRoICAgICA9IDA7XG4gICAgdGhpcy5yb3dzUGVyUGFnZSAgICAgPSAwO1xuICAgIHRoaXMuaXRlbXNQZXJSb3cgICAgID0gMDtcbiAgICB0aGlzLml0ZW1zUGVyUGFnZSAgICA9IDA7XG4gICAgdGhpcy5tYXhCdWZmZXIgICAgICAgPSAwO1xuICAgIHRoaXMuaGVpZ2h0ICAgICAgICAgID0gMDtcblxuICAgIC8vIEdldCB0aGUgY29udGFpbmVyIGVsZW1lbnRzXG4gICAgdGhpcy52aWV3ICAgICAgICAgICAgPSBvcHRzLnNjcm9sbFZpZXc7XG4gICAgdGhpcy5pdGVtc0NvbnRhaW5lciAgPSBvcHRzLml0ZW1zQ29udGFpbmVyIHx8IGZhbHNlO1xuXG4gICAgLy8gSWYgaXQgaXMgYSBzdHJpbmcsIGl0IHNob3VsZCBiZSBhIHF1ZXJ5IHNlbGVjdG9yIC0gb3RoZXJ3aXNlIHdlIGFyZSBleHBlY3RpbmcgYW4gZWxlbWVudC5cbiAgICB0aGlzLnZpZXcgICAgICAgICAgICA9ICh0eXBlb2YgdGhpcy52aWV3ICAgICAgICAgICA9PT0gJ3N0cmluZycgfHwgdGhpcy52aWV3IGluc3RhbmNlb2YgU3RyaW5nKSAgICAgICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRoaXMudmlldykgICAgICAgICAgIDogdGhpcy52aWV3O1xuICAgIHRoaXMuaXRlbXNDb250YWluZXIgID0gKHR5cGVvZiB0aGlzLml0ZW1zQ29udGFpbmVyID09PSAnc3RyaW5nJyB8fCB0aGlzLml0ZW1zQ29udGFpbmVyIGluc3RhbmNlb2YgU3RyaW5nKSA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0cy5pdGVtc0NvbnRhaW5lcikgOiB0aGlzLml0ZW1zQ29udGFpbmVyO1xuXG4gICAgLy8gS2VlcCB0cmFjayBvZiBhIHVuaXF1ZSBpZCBmb3Igdmlld0l0ZW1zIC0gYWxsb3dzIFRoaXMgaXMgcGFzc2VkIHRvXG4gICAgLy8gZGF0YXNvdXJjZSBwcm92aWRlcnMgdG8gYWlkIGluIHRyYWNraW5nLlxuICAgIHRoaXMuX2lkID0gMDtcblxuICAgIC8vIElmIG5vdCBwYXNzZWQgYSBwYWdlIHNlbGVjdG9yLCBhc3N1bWUgaXQncyB0aGUgZmlyc3QgY2hpbGRcbiAgICBpZighdGhpcy5pdGVtc0NvbnRhaW5lcikge1xuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyID0gdGhpcy52aWV3LmNoaWxkcmVuWzBdO1xuICAgIH1cblxuICAgIC8vIF91cGRhdGVWaWV3IGlzIHVzZWQgaW4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIC0gYmluZCBpdCB0byB0aGlzXG4gICAgdGhpcy5fdXBkYXRlVmlldyA9IHRoaXMuX3VwZGF0ZVZpZXcuYmluZCh0aGlzKTtcblxuICAgIC8vIEludm9rZWQgYXMgYSByZXN1bHQgb2YgZXZlbnQgbGlzdGVuZXJzIC0gYmluZCB0aGVtIHRvIHRoaXNcbiAgICB0aGlzLl9zY3JvbGxIYW5kbGVyID0gdGhpcy5fc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX3Jlc2l6ZUhhbmRsZXIgPSB0aGlzLl9yZXNpemVIYW5kbGVyLmJpbmQodGhpcyk7XG5cbiAgICAvLyBFbnN1cmUgdmFsaWQgdmlldyBtZXRyaWNzXG4gICAgdGhpcy5fY2FsY1ZpZXdNZXRyaWNzKCk7XG5cbiAgICAvLyBiaW5kIGFueSBldmVudCBoYW5kbGVycyBub3cgaWYgbm90IGFza2VkIHRvIGRlbGF5XG4gICAgaWYoIW9wdHMuZGVsYXlCaW5kKSB7XG4gICAgICAgIHRoaXMuYmluZCgpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGtub3cgYWJvdXQgU2Nyb2xsLCBhdHRhY2ggaXQgbm93XG4gICAgdGhpcy5zY3JvbGwgPSBMaXRlTGlzdC5TY3JvbGwgPyBuZXcgTGl0ZUxpc3QuU2Nyb2xsKG9wdHMuc2Nyb2xsVmlldywgdGhpcy5fc2Nyb2xsSGFuZGxlcikgOiBmYWxzZTtcblxuICAgIC8vIEtpY2tzIG9mZiBhIGxheW91dCAoZGlydHlSZXNpemUgZGVmYXVsdHMgdG8gdHJ1ZSlcbiAgICAvLyBUaGlzIHdpbGwgbGF5b3V0IGV2ZXJ5dGhpbmcgbmljZWx5IGZpbGxpbmcgYWxsIGNvbHVtbnNcbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn1cblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjVmlld01ldHJpY3MgPSBmdW5jdGlvbiBjYWxjVmlld01ldHJpY3MoKSB7XG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gdGhpcy52aWV3LmNsaWVudFdpZHRoO1xuICAgIHRoaXMucm93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsICh0aGlzLmNsaWVudEhlaWdodCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSk7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IodGhpcy5jbGllbnRXaWR0aCAgLyAodGhpcy5pdGVtV2lkdGggICsgdGhpcy5tYXJnaW4ueCkpIDogMTtcbiAgICB0aGlzLml0ZW1zUGVyUGFnZSAgICA9IHRoaXMucm93c1BlclBhZ2UgKiB0aGlzLml0ZW1zUGVyUm93O1xuICAgIHRoaXMubWF4QnVmZmVyICAgICAgID0gdGhpcy5pdGVtc1BlclBhZ2UgKiAzO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9jYWxjRG9jSGVpZ2h0ID0gZnVuY3Rpb24gY2FsY0RvY0hlaWdodCgpIHtcbiAgICB2YXIgcm93ID0gTWF0aC5jZWlsKHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aC90aGlzLml0ZW1zUGVyUm93KTtcbiAgICB2YXIgbmV3SGVpZ2h0ID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcblxuICAgIGlmKG5ld0hlaWdodCAhPT0gdGhpcy5oZWlnaHQpIHtcbiAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBuZXdIZWlnaHQgKyBcInB4XCI7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gbmV3SGVpZ2h0O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5oZWlnaHQ7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2luaXRJblZpZXdJdGVtID0gZnVuY3Rpb24gX2luaXRJblZpZXdJdGVtKGl0ZW0pIHtcbiAgICBpdGVtLmlkICAgPSB0aGlzLl9pZCsrO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHRvIGFkZCBhIGNsb25lXG4gICAgLy8gdG8gdGhlIGRvbVxuICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlKSB7XG4gICAgICAgIHZhciBuZXdOb2RlID0gdGhpcy5pdGVtVGVtcGxhdGUuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgICAgIGlmKG5ld05vZGUgaW5zdGFuY2VvZih3aW5kb3cuRG9jdW1lbnRGcmFnbWVudCkpIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBuZXdOb2RlLmNoaWxkTm9kZXNbMF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLmFwcGVuZENoaWxkKG5ld05vZGUpO1xuICAgICAgICBpdGVtLmVsID0gbmV3Tm9kZTtcbiAgICAgICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS5iaW5kKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGFTb3VyY2UuYmluZChpdGVtLmlkLCBuZXdOb2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVtO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9zeW5jVmlld0l0ZW0gPSBmdW5jdGlvbiBzeW5jVmlld0l0ZW0odmlld0l0ZW0pIHtcbiAgICAvLyBJZiB3ZSBoYXZlIGEgZGF0YVNvdXJjZVxuICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2Uuc3luYykge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc3luYyh2aWV3SXRlbS5pZCwgdmlld0l0ZW0uZWwsIHZpZXdJdGVtLmlkeCwgdmlld0l0ZW0uZGF0YSk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9wb3NpdGlvblZpZXdJdGVtID0gZnVuY3Rpb24gcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSwgZm9yY2UpIHtcbiAgICB2YXIgaWR4ICA9IHZpZXdJdGVtLmlkeDtcbiAgICB2YXIgcm93ICA9IE1hdGguZmxvb3IoaWR4L3RoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciBjb2wgID0gKGlkeCAlIHRoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciB0b3AgID0gcm93ICogdGhpcy5pdGVtSGVpZ2h0ICsgcm93ICogdGhpcy5tYXJnaW4ueTtcbiAgICB2YXIgbGVmdCA9IGNvbCAqIHRoaXMuaXRlbVdpZHRoICArIGNvbCAqIHRoaXMubWFyZ2luLng7XG5cbiAgICAvLyBBdm9pZCB0cmlnZ2VyaW5nIHVwZGF0ZSBpZiB0aGUgdmFsdWUgaGFzbid0IGNoYW5nZWRcbiAgICBpZihmb3JjZSB8fCAodmlld0l0ZW0udG9wICAhPT0gdG9wKSApIHtcbiAgICAgICAgdmlld0l0ZW0udG9wICA9IHRvcDtcblxuICAgICAgICBpZih2aWV3SXRlbS5lbCkge1xuICAgICAgICAgICAgdmlld0l0ZW0uZWwuc3R5bGUudG9wID0gdG9wICsgXCJweFwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoZm9yY2UgfHwgKHZpZXdJdGVtLmxlZnQgIT09IGxlZnQpKSB7XG4gICAgICAgIHZpZXdJdGVtLmxlZnQgPSBsZWZ0O1xuXG4gICAgICAgIGlmKHZpZXdJdGVtLmVsKSB7XG4gICAgICAgICAgICB2aWV3SXRlbS5lbC5zdHlsZS5sZWZ0ID0gbGVmdCArIFwicHhcIjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fZW5zdXJlVmlzaWJsZSA9IGZ1bmN0aW9uIF9lbnN1cmVWaXNpYmxlKGRvbmUpIHtcbiAgICB2YXIgcGVyY2VudEluVmlld1N0YXJ0ID0gKCh0aGlzLnNjcm9sbFRvcCkgLyAodGhpcy5oZWlnaHQpKTtcbiAgICB2YXIgcGVyY2VudEluVmlld0VuZCAgID0gKCh0aGlzLnNjcm9sbFRvcCArIHRoaXMuY2xpZW50SGVpZ2h0KSAvICh0aGlzLmhlaWdodCkpO1xuXG4gICAgdmFyIG9sZFN0YXJ0LCBuZXdTdGFydCwgb2xkRW5kLCBuZXdFbmQsIGksIHZpZXdJdGVtO1xuXG4gICAgaWYodGhpcy5kaXJlY3Rpb24gPCAwKSB7XG4gICAgICAgIG9sZEVuZCA9IHRoaXMudmlld0J1ZmZlci52aWV3W3RoaXMudmlld0J1ZmZlci50YWlsXS5pZHg7XG4gICAgICAgIG5ld0VuZCA9IE1hdGguY2VpbCAocGVyY2VudEluVmlld0VuZCAgICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGkgPSBvbGRFbmQ7IGkgPiBuZXdFbmQgKyB0aGlzLml0ZW1zUGVyUm93OyAtLWkpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KC0xKVswXTtcblxuICAgICAgICAgICAgaWYgKHZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih0aGlzLmRpcmVjdGlvbiA+IDApIHtcbiAgICAgICAgb2xkU3RhcnQgPSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4O1xuICAgICAgICBuZXdTdGFydCA9IE1hdGguZmxvb3IocGVyY2VudEluVmlld1N0YXJ0ICogdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKTtcblxuICAgICAgICBmb3IoaSA9IG9sZFN0YXJ0OyBpIDwgbmV3U3RhcnQgLSB0aGlzLml0ZW1zUGVyUm93OyArK2kpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtID0gdGhpcy52aWV3QnVmZmVyLnNoaWZ0KDEpWzBdO1xuXG4gICAgICAgICAgICBpZih2aWV3SXRlbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkb25lKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Jlc2l6ZSA9IGZ1bmN0aW9uIF9yZXNpemUoZG9uZSkge1xuICAgIHZhciBuZXdIZWlnaHQgICAgPSB0aGlzLnZpZXcuY2xpZW50SGVpZ2h0O1xuICAgIHZhciBuZXdXaWR0aCAgICAgPSB0aGlzLnZpZXcuY2xpZW50V2lkdGg7XG5cbiAgICB2YXIgbmV3Um93c1BlclBhZ2UgICAgID0gTWF0aC5jZWlsIChuZXdIZWlnaHQgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpO1xuICAgIHZhciBuZXdJdGVtc1BlclJvdyAgICAgPSB0aGlzLml0ZW1XaWR0aCA/IE1hdGguZmxvb3IobmV3V2lkdGggIC8gKHRoaXMuaXRlbVdpZHRoICArIHRoaXMubWFyZ2luLngpKSA6IDE7XG5cbiAgICB2YXIgcmVtb3ZlZDsgLy8sIGluVmlld09iajtcbiAgICBpZihuZXdSb3dzUGVyUGFnZSAhPT0gdGhpcy5yb3dzUGVyUGFnZSB8fCBuZXdJdGVtc1BlclJvdyAhPT0gdGhpcy5pdGVtc1BlclJvdykge1xuICAgICAgICB0aGlzLl9jYWxjVmlld01ldHJpY3MoKTtcbiAgICAgICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuXG4gICAgICAgIHZhciBwZXJjZW50SW5WaWV3ID0gdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSAvIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aDtcbiAgICAgICAgdGhpcy5zY3JvbGxUb3AgPSB0aGlzLnZpZXcuc2Nyb2xsVG9wID0gTWF0aC5mbG9vcih0aGlzLmhlaWdodCAqIHBlcmNlbnRJblZpZXcpO1xuICAgICAgICB2YXIgbmV3Rmlyc3RWaXNpYmxlID0gTWF0aC5mbG9vcih0aGlzLnNjcm9sbFRvcCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiBuZXdJdGVtc1BlclJvdztcblxuICAgICAgICBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoID4gdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHJlbW92ZWQgPSB0aGlzLnZpZXdCdWZmZXIucmVzaXplKHRoaXMubWF4QnVmZmVyKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uIChpblZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQoaW5WaWV3SXRlbS5pZCwgaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaW5WaWV3SXRlbS5lbCk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy52aWV3QnVmZmVyLnZpZXcubGVuZ3RoIDwgdGhpcy5tYXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpXG4gICAgICAgICAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2hpZnRBbXQgPSBuZXdGaXJzdFZpc2libGUgLSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIuaGVhZF0uaWR4IC0gbmV3SXRlbXNQZXJSb3c7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci5zaGlmdChzaGlmdEFtdCk7XG4gICAgICAgIHRoaXMudmlld0J1ZmZlci52aWV3LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZG9uZSgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl91cGRhdGVWaWV3ID0gZnVuY3Rpb24gX3VwZGF0ZVZpZXcoKSB7XG4gICAgdmFyIGRvbmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZmlyc3RWaXNpYmxlSXRlbSA9IE1hdGguZmxvb3IodGhpcy5zY3JvbGxUb3AgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpICogdGhpcy5pdGVtc1BlclJvdztcbiAgICAgICAgdGhpcy5fbGFzdFZpc2libGVJdGVtICA9IE1hdGguY2VpbCAoKHRoaXMuc2Nyb2xsVG9wICsgdGhpcy5jbGllbnRIZWlnaHQpLyh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiB0aGlzLml0ZW1zUGVyUm93O1xuXG4gICAgICAgIHRoaXMuZGlydHlSZXNpemUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50aWNraW5nICAgICA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbiAgID0gMDtcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICBpZih0aGlzLmRpcnR5UmVzaXplKSB7XG4gICAgICAgIHRoaXMuX3Jlc2l6ZShkb25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9lbnN1cmVWaXNpYmxlKGRvbmUpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcmVxdWVzdFRpY2sgPSBmdW5jdGlvbiByZXF1ZXN0VGljaygpIHtcbiAgICBpZighdGhpcy50aWNraW5nKSB7XG4gICAgICAgIHRoaXMudGlja2luZyA9IHRydWU7XG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fdXBkYXRlVmlldyk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoKCkge1xuICAgIHZhciBhcmdzICAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIHRoaXMudmlld0J1ZmZlci5kYXRhLnB1c2guYXBwbHkodGhpcy52aWV3QnVmZmVyLmRhdGEsIGFyZ3MpO1xuXG4gICAgdmFyIG5ld0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5yZXNpemUoTWF0aC5taW4odGhpcy5tYXhCdWZmZXIsIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCkpO1xuXG4gICAgbmV3SW5WaWV3LmZvckVhY2goZnVuY3Rpb24oaW5WaWV3RGF0YSkge1xuICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpblZpZXdEYXRhKTtcbiAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKGluVmlld0RhdGEpO1xuICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGluVmlld0RhdGEsIHRydWUpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC5iaW5kKCk7IH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC51bmJpbmQoKTsgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKSB7XG4gICAgdmFyIGNhbGxVbmJpbmQgPSAodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpO1xuXG4gICAgdGhpcy52aWV3LnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsVG9wID0gMDtcblxuICAgIHZhciBpdGVtc0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5jbGVhcigpO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHJlbW92ZSBhbnkgbm9kZXMgd2UndmUgYWRkZWRcbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICBpdGVtc0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKGl0ZW0uZWwpICAgIHsgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpdGVtLmVsKTsgfVxuICAgICAgICAgICAgaWYoY2FsbFVuYmluZCkgeyB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpOyB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiBmb3JFYWNoKC8qZm4sIHRoaXNBcmcqLykge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmZvckVhY2guYXBwbHkodGhpcy5pdGVtcywgYXJndW1lbnRzKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoSW5WaWV3ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudmlld0J1ZmZlci5mb3JFYWNoSW5WaWV3LmFwcGx5KHRoaXMudmlld0J1ZmZlciwgYXJndW1lbnRzKTtcbn07XG5cblxuTGl0ZUxpc3QucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZShzZWFyY2hJZHgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy52aWV3QnVmZmVyLnJlbW92ZShzZWFyY2hJZHgpO1xuXG4gICAgcmVzdWx0Lm5ld0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbShpdGVtKTtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlIHx8IHRoaXMuZGF0YVNvdXJjZSkge1xuICAgICAgICByZXN1bHQucmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhc291cmNlLnVuYmluZChpdGVtLmlkLCBpdGVtLmVsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodGhpcy5pdGVtVGVtcGxhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLnJlbW92ZUNoaWxkKGl0ZW0uZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXN1bHQudXBkYXRlZC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fc2Nyb2xsSGFuZGxlciA9IGZ1bmN0aW9uIHNjcm9sbEhhbmRsZXIoLypldnQqLykge1xuICAgIHZhciBzY3JvbGxUb3AgICA9IHRoaXMudmlldy5zY3JvbGxUb3A7XG5cbiAgICBpZihzY3JvbGxUb3AgIT09IHRoaXMuc2Nyb2xsVG9wKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uICA9IHNjcm9sbFRvcCA+IHRoaXMuc2Nyb2xsVG9wID8gMSA6IC0xO1xuICAgICAgICB0aGlzLnNjcm9sbFRvcCAgPSBzY3JvbGxUb3A7XG4gICAgICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9yZXNpemVIYW5kbGVyID0gZnVuY3Rpb24gcmVzaXplSGFuZGxlcigvKmV2dCovKSB7XG4gICAgdGhpcy5kaXJ0eVJlc2l6ZSA9IHRydWU7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn07XG5cbi8vIFZlcnNpb24uXG5MaXRlTGlzdC5WRVJTSU9OID0gJzAuNC4zJztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVMaXN0OyIsInZhciBMaXRlTGlzdCA9IHJlcXVpcmUoJy4vbGl0ZWxpc3QnKTtcbnZhciByaXZldHM7XG5cbi8vIEp1c3QgaGVyZSB0byBzaW1wbGlmeSB0aGUgaW5pdGlhbGl6YXRpb24gbG9naWMuICBJZlxuLy8gd2luZG93IGRvZXNuJ3QgZXhpc3QsIHRoaXMgbW9kdWxlIGlzIHVzZWxlc3MgYW55d2F5XG5pZih0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgeyB3aW5kb3cgPSB7fTsgfVxuXG4vLyBUaGUgYnVpbGQgd2lsbCBkZWNsYXJlIFRXRUVOIGFzIGV4dGVybmFsLiBIb3dldmVyLCBpZiBpdCBpc24ndCBwcm92aWRlZCBieVxuLy8gYnJvd3NlcmlmeSwgd2UgcmVhbGx5IHdhbnQgdG8gY2hlY2sgdG8gc2VlIGlmIGl0IHdhcyBpbmNsdWRlZCBkaXJlY3RseSB2aWFcbi8vIHNjcmlwdCB0YWcgZmlyc3QuICBPbmx5IGlmIGl0IGlzbid0IHdpbGwgd2UgdHJ5IGEgcmVxdWlyZS4gIFRoaXMgKnNob3VsZCpcbi8vIG1ha2UgaXQgZWFzaWVyIHRvIGJ1bmRsZS9vciBub3QgYW5kIHRvIHVzZSB3aXRoIHJlcXVpcmVqcy4uLlxucml2ZXRzID0gd2luZG93LnJpdmV0cyB8fCByZXF1aXJlKFwicml2ZXRzXCIpO1xuXG5cbi8qXG4gKiBJbiBhZGRpdGlvbiB0byB0aGUgb3B0aW9ucyBkb2N1bWVudGVkIGluIExpdGVMaXN0XG4gKlxuICogb3B0czoge1xuICogICByaXZldHNNb2RlbHM6IHsgLi4uIH0gIC8vICBBbnkgYWRkaXRpb25hbCBtb2RlbHMgdGhhdCBuZWVkIHRvIGJlIHByb3ZpZGVkIGZvciByaXZldHMuXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gIFRoZXNlIHdpbGwgYmUgaW5jbHVkZWQgYWxvbmcgd2l0aCB7IGl0ZW1zOiBpdGVtc0luVmlldyB9XG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gIHdoZW4gY2FsbGluZyByaXZldHMuYmluZC5cbiAqICAgcml2ZXRzT3B0czogICB7IC4uLiB9ICAvLyAgQW55IGFkZGl0aW9uYWwgcml2ZXRzIGNvbmZpZ3VyYXRpb24uIEJpbmRlcnMgZm9yIHRvcCwgbGVmdCBhbmQgaGVpZ2h0XG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gIHdpbGwgYmUgbWl4ZWQgaW4gcHJpb3IgdG8gY2FsbGluZyByaXZldHMuYmluZFxuICogfVxuICovXG5mdW5jdGlvbiBSVkxpdGVMaXN0KF9vcHRzKSB7XG4gICAgdmFyIGRlbGF5QmluZCA9IF9vcHRzLmRlbGF5QmluZDtcblxuICAgIC8vIERvbid0IGxldCBMaXRlTGlzdCBiaW5kIC0gd2UnbGwgZG8gdGhhdCBoZXJlIGlmIGRlbGF5QmluZCBpc24ndCB0cnVlXG4gICAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIGluY29taW5nIG9wdHMgc28gd2UgZG9uJ3QgbW9kaWZ5IHRoZSBvcmlnaW5hbCB2ZXJzaW9uIGFuZFxuICAgIC8vIGNhdXNlIHdlaXJkIGJ1Z3MgaWYgdGhlIGNhbGxlciBpc24ndCBleHBlY3RpbmcgdGhlIGluY29taW5nIHZhbHVlIHRvIGNoYW5nZS5cbiAgICB2YXIgb3B0cyA9IHt9O1xuXG4gICAgLy8gV2UgYXJlIG9ubHkgdG91Y2hpbmcgYSBzaW1wbGUgcHJvcGVydHksIHNvIGl0IGlzIG9rIHRvIGR1cGxpY2F0ZSBhbnkgY29tcGxleFxuICAgIC8vIHByb3BlcnRpZXMgaGVyZSByYXRoZXIgdGhhbiBkb2luZyBhIHRydWUgZGVlcCBjb3B5LlxuICAgIE9iamVjdC5rZXlzKF9vcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkgeyBvcHRzW2tleV0gPSBfb3B0c1trZXldOyB9KTtcbiAgICBvcHRzLmRlbGF5QmluZCA9IHRydWU7XG5cbiAgICBMaXRlTGlzdC5jYWxsKHRoaXMsIG9wdHMpO1xuXG4gICAgdGhpcy5yaXZldHNNb2RlbHMgPSBvcHRzLnJpdmV0c01vZGVscyB8fCB7fTtcbiAgICB0aGlzLnJpdmV0c09wdHMgICA9IG9wdHMucml2ZXRzT3B0cyAgIHx8IHt9O1xuXG4gICAgLy8gT3ZlcndyaXRlIGFueSBleGlzdGluZyB2YWx1ZSBpbiB0aGUgcHJvdmlkZWQgbW9kZWwgaWYgaXQgZXhpc3RzLlxuICAgIHRoaXMucml2ZXRzTW9kZWxzLml0ZW1zICAgPSB0aGlzLnZpZXdCdWZmZXIudmlldztcbiAgICB0aGlzLnJpdmV0c01vZGVscy5tZXRyaWNzID0gdGhpcy5saXRlTGlzdDtcblxuICAgIC8vIHVzZSBwcm92aWRlZCByaXZldHNPcHRzIGFuZCBhbGxvdyBjdXN0b20gdG9wLCBsZWZ0IGFuZCBoZWlnaHQgYmluZGVycyBpZiB0aGUgY2FsbGVyXG4gICAgLy8gd2FudHMgdG8gYW5kIGtub3dzIHdoYXQgdGhleSBhcmUgZG9pbmcuLi5cbiAgICB0aGlzLnJpdmV0c09wdHMuYmluZGVycyAgICAgICAgPSB0aGlzLnJpdmV0c09wdHMuYmluZGVycyB8fCB7fTtcbiAgICB0aGlzLnJpdmV0c09wdHMuYmluZGVycy50b3AgICAgPSB0aGlzLnJpdmV0c09wdHMuYmluZGVycy50b3AgICAgfHwgZnVuY3Rpb24oZWwsIHZhbCkgeyBlbC5zdHlsZS50b3AgICAgPSB2YWwgKyBcInB4XCI7IH07XG4gICAgdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMubGVmdCAgID0gdGhpcy5yaXZldHNPcHRzLmJpbmRlcnMubGVmdCAgIHx8IGZ1bmN0aW9uKGVsLCB2YWwpIHsgZWwuc3R5bGUubGVmdCAgID0gdmFsICsgXCJweFwiOyB9O1xuICAgIHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLmhlaWdodCA9IHRoaXMucml2ZXRzT3B0cy5iaW5kZXJzLmhlaWdodCB8fCBmdW5jdGlvbihlbCwgdmFsKSB7IGVsLnN0eWxlLmhlaWdodCA9IHZhbCArIFwicHhcIjsgfTtcblxuICAgIC8vIEp1c3QgdGFrZSBjYXJlIG9mIG91cnNlbHZlcyBkdXJpbmcgY29uc3RydWN0aW9uIHNvIHdlIGRvbid0IGRvdWJsZSBiaW5kXG4gICAgaWYoIWRlbGF5QmluZCkge1xuICAgICAgICB0aGlzLmJpbmQoKTtcbiAgICB9XG59XG5cbi8vIHN1YmNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzc1xuUlZMaXRlTGlzdC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKExpdGVMaXN0LnByb3RvdHlwZSk7XG5SVkxpdGVMaXN0LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFJWTGl0ZUxpc3Q7XG5cblJWTGl0ZUxpc3QucHJvdG90eXBlLnVuYmluZCA9IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICBpZih0aGlzLnJ2Vmlldykge1xuICAgICAgICB0aGlzLnJ2Vmlldy51bmJpbmQoKTtcblxuICAgICAgICAvLyBQZW5kaW5nIHRoZSByZXNvbHV0aW9uIG9mIHJpdmV0cyMzMDYgIGFuZCByaXZldHMjMzA3LSB0aGlzIHdpbGwgYmUgY2hhbmdlZCB0byByZWJpbmQgdGhlIHZpZXcgaWYgdGhlXG4gICAgICAgIC8vIHZpZXcgYWxyZWFkeSBleGlzdHMuICBVbnRpbCB0aGF0IGJlaGF2aW9yIGlzIGZpeGVkLCB3ZSdsbCBnbyB0aHJvdWdoIHRoZSBvdmVyaGVhZCBvZlxuICAgICAgICAvLyBjcmVhdGluZyBhIG5ldyB2aWV3LlxuICAgICAgICB0aGlzLnJ2VmlldyA9IGZhbHNlO1xuICAgIH1cblxuICAgIExpdGVMaXN0LnByb3RvdHlwZS51bmJpbmQuY2FsbCh0aGlzKTtcbn07XG5cblJWTGl0ZUxpc3QucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbiBiaW5kKCkge1xuICAgIC8vIFBlbmRpbmcgdGhlIHJlc29sdXRpb24gb2Ygcml2ZXRzIzMwNiAtIHRoaXMgd2lsbCBiZSBjaGFuZ2VkIHRvIHJlYmluZCB0aGUgdmlldyBpZiB0aGVcbiAgICAvLyB2aWV3IGFscmVhZHkgZXhpc3RzLiAgVW50aWwgdGhhdCBiZWhhdmlvciBpcyBmaXhlZCwgd2UnbGwgZ28gdGhyb3VnaCB0aGUgb3ZlcmhlYWQgb2ZcbiAgICAvLyBjcmVhdGluZyBhIG5ldyB2aWV3LiAgQ2FsbGVyIGJld2FyZS4uLlxuICAgIHRoaXMucnZWaWV3ID0gcml2ZXRzLmJpbmQodGhpcy52aWV3LCB0aGlzLnJpdmV0c01vZGVscywgdGhpcy5yaXZldHNPcHRzKTtcblxuICAgIExpdGVMaXN0LnByb3RvdHlwZS5iaW5kLmNhbGwodGhpcyk7XG59O1xuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFJWTGl0ZUxpc3Q7XG5cbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKlxuICogQ2lyY3VsYXIgYnVmZmVyIHJlcHJlc2VudGluZyBhIHZpZXcgb24gYW4gYXJyYXkgb2YgZW50cmllcy5cbiAqL1xuZnVuY3Rpb24gVmlld0J1ZmZlcihkYXRhLCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG4gICAgdGhpcy5kYXRhID0gZGF0YSB8fCBbXTtcbiAgICB0aGlzLnZpZXcgPSBbXTtcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBoZXJlXG4gICAgaWYoaW5pdGlhbFNpemUpIHsgdGhpcy5yZXNpemUoaW5pdGlhbFNpemUpOyB9XG59XG5cbi8qXG4gKiBTaHJpbmsgdGhlIHZpZXcgYnVmZmVyXG4gKlxuICogQHBhcmFtIG5ld1NpemVcbiAqIEBwYXJhbSBoZWFkOiAgICAgaWYgdHJ1ZSwgd2lsbCBzaHJpbmsgcmVsYXRpdmUgdG8gaGVhZC5cbiAqXG4gKiBAcmV0dXJuczogQXJyYXkgb2YgcmVtb3ZlZCB2aWV3IGJ1ZmZlciBlbnRyaWVzXG4gKi9cbmZ1bmN0aW9uIF9zaHJpbmsobmV3U2l6ZSwgaGVhZCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIGRlbHRhID0gW107XG4gICAgdmFyIHZpZXcgID0gdGhpcy52aWV3O1xuICAgIHZhciBzaHJpbmthZ2UgPSB2aWV3Lmxlbmd0aCAtIG5ld1NpemU7XG4gICAgdmFyIHNwbGljZWQ7XG5cbiAgICBpZihuZXdTaXplID49IHZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBzaHJpbmsgdG8gYSBzaXplIGxhcmdlciB0aGFuIHRoZSBjdXJyZW50IHNpemVcIik7XG4gICAgfVxuXG4gICAgd2hpbGUoc2hyaW5rYWdlICYmIHZpZXcubGVuZ3RoID4gMCkge1xuICAgICAgICBzcGxpY2VkID0gdmlldy5zcGxpY2UoaGVhZCA/IHRoaXMuaGVhZCA6IHRoaXMudGFpbCwgMSk7XG4gICAgICAgIGRlbHRhLnB1c2goc3BsaWNlZFswXSk7XG5cbiAgICAgICAgLy8gV2hlbiBzaHJpbmtpbmcgZnJvbSBoZWFkLCB0aGUgb25seSB0aW1lIHRoZSBoZWFkcyByZXN1bHRpbmcgdmFsdWUgY2hhbmdlcyBpc1xuICAgICAgICAvLyBpZiBoZWFkIGlzIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3QuICBTbyBpdCBpcyBzYWZlIHRvIHRha2UgdGhlIG1vZHVsbyBvZiBoZWFkXG4gICAgICAgIC8vIGFnYWluc3QgdGhlIG5ldyB2aWV3IGxlbmd0aDtcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGFpbCBpcyB0aGVuIHRoZSBtb2R1bG8gb2YgaGVhZCArIDE7XG4gICAgICAgIGlmKGhlYWQpIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IHRoaXMuaGVhZCAlIHZpZXcubGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gKHRoaXMuaGVhZCArIDEpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIH0gZWxzZSBpZih0aGlzLnRhaWwgPCB0aGlzLmhlYWQpIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbCAtIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLmhlYWQgLSAxO1xuXG4gICAgICAgICAgICBpZih0aGlzLnRhaWwgPCAwKSB7IHRoaXMudGFpbCA9IHZpZXcubGVuZ3RoIC0gMTsgfVxuICAgICAgICB9IGVsc2UgaWYodGhpcy50YWlsID4gdGhpcy5oZWFkKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgLSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhleSBhcmUgZXF1YWwgd2hlbiBib3RoIGFyZSB6ZXJvXG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC0tc2hyaW5rYWdlO1xuICAgIH1cblxuICAgIGlmKHZpZXcubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHZpZXcubGVuZ3RoO1xuICAgIHJldHVybiBkZWx0YTtcbn1cblxuLypcbiAqIEdyb3dzIHRoZSB2aWV3IGJ1ZmZlcjogIHRoZSB2aWV3IGJ1ZmZlciB3aWxsIGdyb3cgaW4gdGhlIHJlcXVlc3RlZCBkaXJlY3Rpb25cbiAqIGFzIG11Y2ggYXMgaXQgY2FuLiAgV2hlbiBpdCByZWFjaGVzIGEgbGltaXQsIGl0IHdpbGwgdHJ5IHRvIGdyb3cgaW4gdGhlIG9wcG9zaXRlXG4gKiBkaXJlY3Rpb24gYXMgd2VsbC5cbiAqXG4gKiBAcGFyYW0gbmV3U2l6ZVxuICogQHBhcmFtIGhlYWQ6ICAgICBpZiB0cnVlLCB3aWxsIGdyb3cgcmVsYXRpdmUgdG8gaGVhZFxuICpcbiAqIEByZXR1cm5zOiBBcnJheSBvZiBuZXdseSBpbml0aWFsaXplZCB2aWV3IGJ1ZmZlciBlbnRyaWVzXG4gKi9cbmZ1bmN0aW9uIF9ncm93KG5ld1NpemUsIGhlYWQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciBkZWx0YSA9IFtdO1xuICAgIHZhciB2aWV3ICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGRhdGEgICA9IHRoaXMuZGF0YTtcbiAgICB2YXIgZ3Jvd3RoID0gbmV3U2l6ZSAtIHZpZXcubGVuZ3RoO1xuICAgIHZhciBuZXdFbnRyeTtcblxuICAgIGlmKG5ld1NpemUgPiBkYXRhLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZ3JvdyB0byBhIHNpemUgbGFyZ2VyIHRoYW4gdGhlIGN1cnJlbnQgZGF0YXNldFwiKTtcbiAgICB9XG5cbiAgICBpZihncm93dGggPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBncm93IHRvIGEgc2l6ZSBzbWFsbGVyIHRoYW4gdGhlIGN1cnJlbnQgc2l6ZVwiKTtcbiAgICB9XG5cbiAgICAvLyBOb3RoaW5nIHRvIGRvIGhlcmUsIGp1c3QgcmV0dXJuIGFuIGVtcHR5IGRlbHRhXG4gICAgaWYoZ3Jvd3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBkZWx0YTtcbiAgICB9XG5cbiAgICB3aGlsZShncm93dGgpIHtcbiAgICAgICAgaWYodGhpcy5oZWFkID09PSAtMSAmJiB0aGlzLnRhaWwgPT09IC0xKSB7XG4gICAgICAgICAgICBuZXdFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICBpZHg6ICAwLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFbMF1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZpZXcucHVzaChuZXdFbnRyeSk7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoaGVhZCAmJiB2aWV3W3RoaXMuaGVhZF0uaWR4ID4gMCkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgdmlld1t0aGlzLmhlYWRdLmlkeCAtIDEsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVt2aWV3W3RoaXMuaGVhZF0uaWR4IC0gMV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBzYWZlIHRvIGFkZCBhZnRlciB0aGUgdGFpbFxuICAgICAgICAgICAgdmlldy5zcGxpY2UodGhpcy5oZWFkLCAwLCBuZXdFbnRyeSk7XG5cbiAgICAgICAgICAgIC8vIEhlYWQgZG9lc24ndCBjaGFuZ2VcbiAgICAgICAgICAgIHRoaXMudGFpbCA9ICh0aGlzLmhlYWQgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIH0gZWxzZSBpZih2aWV3W3RoaXMudGFpbF0uaWR4IDwgZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBuZXdFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICBpZHg6ICB2aWV3W3RoaXMudGFpbF0uaWR4ICsgMSxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhW3ZpZXdbdGhpcy50YWlsXS5pZHggKyAxXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmlldy5zcGxpY2UodGhpcy50YWlsICsgMSwgMCwgbmV3RW50cnkpO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsICsgMTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9ICh0aGlzLnRhaWwgKyAxKSAlIHZpZXcubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBJZiB3ZSBjYW4ndCBhZGQgYW55bW9yZSBhdCB0aGUgdGFpbCwgZm9yY2UgdGhpcyBpbnRvXG4gICAgICAgICAgICAvLyB0aGUgaGVhZCBsb2dpYyB3aGljaCB3aWxsIG9ubHkgZ3JvdyB3aGVuIHRoZSBpZHggPiAwXG4gICAgICAgICAgICBpZihuZXdFbnRyeS5pZHggPT09IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIGhlYWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYodmlld1t0aGlzLnRhaWxdLmlkeCA9PT0gZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAvLyBTcGVjaWFsIGNhc2UgLSBpZiB0aGUgdmlldyBpcyBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0XG4gICAgICAgICAgICAvLyBzZXQgaGVhZCB0byB0cnVlIGFuZCBsb29wIGFyb3VuZCB3aXRob3V0IGRlY3JlbWVudGluZ1xuICAgICAgICAgICAgLy8gZ3Jvd3RoXG4gICAgICAgICAgICBoZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobmV3RW50cnkpIHsgZGVsdGEucHVzaChuZXdFbnRyeSk7IH1cbiAgICAgICAgbmV3RW50cnkgPSBmYWxzZTtcbiAgICAgICAgLS1ncm93dGg7XG4gICAgfVxuXG4gICAgdGhpcy5zaXplID0gdmlldy5sZW5ndGg7XG4gICAgcmV0dXJuIGRlbHRhO1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBlbmQgb2YgdGhlIGRhdGEgYXJyYXlcbiAqL1xuZnVuY3Rpb24gX3NoaWZ0UmlnaHQoY291bnQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciB2aWV3ICAgICAgICA9IHRoaXMudmlldztcbiAgICB2YXIgbmV3SW5WaWV3ICAgPSBbXTtcbiAgICB2YXIgY3VyVGFpbElkeDtcbiAgICB2YXIgdGFpbCA9IHRoaXMudGFpbDtcbiAgICB2YXIgaGVhZCA9IHRoaXMuaGVhZDtcblxuICAgIGNvdW50ID0gY291bnQgfHwgMTtcblxuICAgIHdoaWxlKGNvdW50KSB7XG4gICAgICAgIGN1clRhaWxJZHggID0gdmlld1t0YWlsXS5pZHg7XG5cbiAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHdlIGFyZSBhbHJlYWR5IGF0IHRoZSBlbmRcbiAgICAgICAgaWYoY3VyVGFpbElkeCA9PT0gdGhpcy5kYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgICAgICAgICAgcmV0dXJuIG5ld0luVmlldztcbiAgICAgICAgfVxuXG4gICAgICAgIHRhaWwgPSAodGFpbCArIDEpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIGhlYWQgPSAoaGVhZCArIDEpICUgdmlldy5sZW5ndGg7XG5cbiAgICAgICAgdmlld1t0YWlsXS5pZHggID0gY3VyVGFpbElkeCArIDE7XG4gICAgICAgIHZpZXdbdGFpbF0uZGF0YSA9IHRoaXMuZGF0YVtjdXJUYWlsSWR4ICsgMV07XG5cbiAgICAgICAgbmV3SW5WaWV3LnB1c2godmlld1t0YWlsXSk7XG5cbiAgICAgICAgLy8gT25seSBtYWludGFpbiBhdCBtb3N0IHZpZXcubGVuZ3RoIGl0ZW1zXG4gICAgICAgIGlmKG5ld0luVmlldy5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICAgICAgbmV3SW5WaWV3LnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAtLWNvdW50O1xuICAgIH1cblxuICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgdGhpcy5oZWFkID0gaGVhZDtcblxuICAgIHJldHVybiBuZXdJblZpZXc7XG59XG5cbi8qXG4gKiBNb3ZlcyB0aGUgYnVmZmVyIHRvd2FyZHMgdGhlIGJlZ2lubmluZyBvZiB0aGUgZGF0YSBhcnJheVxuICovXG5mdW5jdGlvbiBfc2hpZnRMZWZ0KGNvdW50KSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgdmlldyAgICAgICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIG5ld0luVmlldyAgID0gW107XG4gICAgdmFyIGhlYWQgICAgICAgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICAgICAgICA9IHRoaXMudGFpbDtcbiAgICB2YXIgZGF0YSAgICAgICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIGN1ckhlYWRJZHg7XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG4gICAgd2hpbGUoY291bnQpIHtcbiAgICAgICAgY3VySGVhZElkeCAgPSB2aWV3W2hlYWRdLmlkeDtcblxuICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgd2UgYXJlIGFscmVhZHkgYXQgdGhlIGJlZ2lubmluZ1xuICAgICAgICBpZihjdXJIZWFkSWR4ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICAgICAgICAgIHJldHVybiBuZXdJblZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICBoZWFkID0gKGhlYWQgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIHRhaWwgPSAodGFpbCAtIDEgKyB2aWV3Lmxlbmd0aCkgJSB2aWV3Lmxlbmd0aDtcblxuICAgICAgICB2aWV3W2hlYWRdLmlkeCAgPSBjdXJIZWFkSWR4IC0gMTtcbiAgICAgICAgdmlld1toZWFkXS5kYXRhID0gZGF0YVtjdXJIZWFkSWR4IC0gMV07XG5cbiAgICAgICAgbmV3SW5WaWV3LnB1c2godmlld1toZWFkXSk7XG5cbiAgICAgICAgLy8gT25seSBtYWludGFpbiBhdCBtb3N0IHZpZXcubGVuZ3RoIGl0ZW1zXG4gICAgICAgIGlmKG5ld0luVmlldy5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICAgICAgbmV3SW5WaWV3LnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAtLWNvdW50O1xuICAgIH1cblxuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICByZXR1cm4gbmV3SW5WaWV3O1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBlbmQgKGNvdW50ID4gMCkgb3JcbiAqIGJlZ2lubmluZyAoY291bnQgPCAwKSBvZiB0aGUgZGF0YSBhcnJheTtcbiAqXG4gKiBAcmV0dXJucyBhcnJheSBvZiBuZXcgZGF0YSBlbGVtZW50cyBpbiB0aGUgdmlldyBidWZmZXJcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiBzaGlmdChjb3VudCkge1xuICAgIHZhciBmbjtcblxuICAgIGNvdW50ID0gY291bnQgfHwgMTtcbiAgICBmbiAgICA9IGNvdW50ID4gMCA/IF9zaGlmdFJpZ2h0IDogX3NoaWZ0TGVmdDtcblxuICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIE1hdGguYWJzKGNvdW50KSk7XG59O1xuXG4vKlxuICogUmVzaXplIHRoZSB2aWV3IGJ1ZmZlciAtIGVpdGhlciBncm93aW5nIG9yIHNocmlua2luZyBpdC5cbiAqXG4gKiBAcGFyYW0gbmV3U2l6ZSAtIHRoZSBuZXcgc2l6ZSBvZiB0aGUgdmlldyBidWZmZXJcbiAqIEBwYXJhbSBoZWFkICAgIC0gaWYgdHJ1ZSwgcHJlZmVyIHJlc2l6aW5nIGJhc2VkIG9uIHRoZSBoZWFkIHJhdGhlciB0aGFuIHRoZSB0YWlsXG4gKlxuICogQHJldHVybnMgICAgICAgLSBBcnJheSBvZiBhZGRlZCBvciByZW1vdmVkIGl0ZW1zXG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uIHJlc2l6ZShuZXdTaXplLCBoZWFkKSB7XG4gICAgaWYobmV3U2l6ZSA+IHRoaXMudmlldy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIF9ncm93LmNhbGwodGhpcywgbmV3U2l6ZSwgaGVhZCk7XG4gICAgfSBlbHNlIGlmKG5ld1NpemUgPCB0aGlzLnZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBfc2hyaW5rLmNhbGwodGhpcywgbmV3U2l6ZSwgaGVhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbn07XG5cbi8qXG4gKiBSZXNldHMgdGhlIHZpZXcgYnVmZmVyIGJhY2sgdG8gemVybyAoZGF0YSBhbmQgdmlldylcbiAqXG4gKiBAcmV0dXJuczogbGlzdCBvZiB2aWV3IGl0ZW1zO1xuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyKCkge1xuICAgIHZhciBpblZpZXdJdGVtcyA9IHRoaXMudmlldy5zbGljZSgwKTsgLy8gbWFrZSBhIGNvcHlcblxuICAgIC8vIERvIHRoaXMgaW4gcGxhY2UgdG8gYmUgZnJpZW5kbHkgdG8gbGlicmFyaWVzIChSaXZldHMgZm9yIGV4YW1wbGUpXG4gICAgLy8gdGhhdCBiaW5kIHRvIG9ic2VydmUgY2hhbmdlc1xuICAgIHRoaXMudmlldy5zcGxpY2UoMCwgTnVtYmVyLk1BWF9WQUxVRSk7XG4gICAgdGhpcy5kYXRhLnNwbGljZSgwLCBOdW1iZXIuTUFYX1ZBTFVFKTtcblxuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG5cbiAgICByZXR1cm4gaW5WaWV3SXRlbXM7XG59O1xuXG4vKlxuICogTG9jYXRlcyBhbiBpdGVtIGluIHRoZSB2aWV3IGJ5IGl0cyBpbmRleCBpbiBkYXRhIGlmIGl0IGV4aXN0c1xuICpcbiAqIEBwYXJhbSBpZHggIC0gSW5kZXggaW4gdGhlIGRhdGEgYXJyYXlcbiAqXG4gKiBAcmV0dXJucyAgICAtIEluZGV4IGluIHRoZSB2aWV3IGlmIGl0IGlzIGZvdW5kIG9yIC0xIGlmIG5vdFxuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5maW5kRGF0YUluZGV4SW5WaWV3ID0gZnVuY3Rpb24gZmluZERhdGFJbmRleEluVmlldyhpZHgpIHtcbiAgICB2YXIgdmlldyA9IHRoaXMudmlldztcbiAgICB2YXIgbGVuICA9IHZpZXcubGVuZ3RoO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBpZih2aWV3W2ldLmlkeCA9PT0gaWR4KSB7XG4gICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAtMTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVudHJ5IGZyb20gZGF0YSBhbmQgYWRqdXN0cyB0aGUgdmlldyBpZiBuZWNlc3NhcnlcbiAqXG4gKiBAcGFyYW0gaWR4ICAgLSBpbmRleCBvZiB0aGUgaXRlbSB0byBiZSByZW1vdmVkXG4gKlxuICogQHJldHVybnMge1xuICogICAgICBuZXdJblZpZXc6ICAgSWYgYSBkYXRhIGl0ZW0gd2FzIG1vdmVkIGludG8gdGhlIHZpZXcgYXMgYSByZXN1bHQgb2YgcmVtb3ZpbmcgYW4gaXRlbSwgYW4gYXJyYXlcbiAqICAgICAgICAgICAgICAgICAgIGNvbnRhaW5pbmcgdGhlIG5ld2x5IGFkZGVkIGl0ZW0uXG4gKiAgICAgIHJlbW92ZWQ6ICAgICBJZiB0aGUgdmlldyBzaXplIHdhcyBtb2RpZmllZCBhcyBhIHJlc3VsdCBvZiB0aGUgcmVtb3ZhbCwgYW4gYXJyYXkgY29udGFpbmluZ1xuICogICAgICAgICAgICAgICAgICAgdGhlIHJlbW92ZWQgaXRlbS5cbiAqICAgICAgdXBkYXRlZDogICAgIGxpc3Qgb2YgZGF0YSBpdGVtcyB0aGF0IGNoYW5nZWQgcG9zaXRpb25zIHdpdGhpbiB0aGUgdmlldy5cbiAqIH1cbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKGlkeCkge1xuICAgIC8vdmFyIGlkeFRvUmVtb3ZlICA9IGZhbHNlO1xuICAgIHZhciBoZWFkICAgICAgICAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHRhaWwgICAgICAgICA9IHRoaXMudGFpbDtcbiAgICB2YXIgdmlldyAgICAgICAgID0gdGhpcy52aWV3O1xuICAgIHZhciBkYXRhICAgICAgICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIHZpZXdJZHgsIGZyb20sIHRvLCByZXNldFZpZXdJZHggPSBmYWxzZTtcblxuICAgIHZhciByZXRWYWwgPSB7XG4gICAgICAgIG5ld0luVmlldzogW10sXG4gICAgICAgIHJlbW92ZWQ6ICAgW10sXG4gICAgICAgIHVwZGF0ZWQ6ICAgW11cbiAgICB9O1xuXG4gICAgdmFyIGFkZGVkLCByZW1vdmVkLCBpO1xuXG4gICAgaWR4ID0gK2lkeDsgLy8gTWFrZSBzdXJlIGl0IGlzIGEgbnVtYmVyXG5cbiAgICAvLyBJZiBpZHggPj0gdGhlIHRvdGFsIG51bWJlciBvZiBpdGVtcyBpbiB0aGUgbGlzdCwgdGhyb3cgYW4gZXJyb3JcbiAgICBpZihpZHggPj0gdGhpcy5kYXRhLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbmRleCBvdXQgb2YgYm91bmRzXCIpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBpdCBmcm9tIGl0ZW1zXG4gICAgdGhpcy5kYXRhLnNwbGljZShpZHgsIDEpO1xuXG4gICAgLy8gSWYgZ3JlYXRlciB0aGFuIHRoZSB0YWlsIElEWCwgaXQgaXMgbm90IGluIHRoZSB2aWV3IGFuZCBubyBhZGp1c3RtZW50c1xuICAgIC8vIGFyZSBuZWNlc3NhcnkgdG8gYW55IHZpZXcgaXRlbXMuXG4gICAgaWYoaWR4ID4gdGhpcy52aWV3W3RoaXMudGFpbF0uaWR4KSB7XG4gICAgICAgIHJldHVybiByZXRWYWw7XG4gICAgfVxuXG4gICAgLy8gSWYgbGVzcyB0aGFuIHRoZSBoZWFkIElEWCwgaXQgaXMgbm90IGluIHRoZSB2aWV3LCBidXQgYWxsIHZpZXcgaXRlbXNcbiAgICAvLyBuZWVkIHRvIGJlIGFkanVzdGVkIGJhY2sgYnkgb25lIHRvIHJlZmVyZW5jZSB0aGUgY29ycmVjdCBkYXRhIGluZGV4XG4gICAgLy9cbiAgICAvLyBOZWVkIHRvIHRoaW5rIGFib3V0IHdoZXRoZXIgYW55dGhpbmcgd2FzIHJlYWxseSB1cGRhdGVkIGhlcmUuICBJZHggaXNcbiAgICAvLyBtb3N0bHkgYW4gaW50ZXJuYWwgaW1wbGVtZW50YXRpb24gZGV0YWlsIGFuZCB0aGF0IGlzIGFsbCB0aGF0IGhhcyBiZWVuXG4gICAgLy8gdXBkYXRlZCBpbiB0aGlzIGNhc2UuXG4gICAgaWYoaWR4IDwgdmlld1toZWFkXS5pZHgpIHtcbiAgICAgICAgdmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGl0ZW0uaWR4ID0gaXRlbS5pZHggLSAxO1xuICAgICAgICAgICAgcmV0VmFsLnVwZGF0ZWQucHVzaChpdGVtKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJldFZhbDtcbiAgICB9XG5cbiAgICBmcm9tID0gdmlld0lkeCA9IHRoaXMuZmluZERhdGFJbmRleEluVmlldyhpZHgpO1xuICAgIGlmKHZpZXdJZHggPT09IGhlYWQpIHtcbiAgICAgICAgaWYoaGVhZCA9PT0gMCkge1xuICAgICAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICAgICAgfSBlbHNlIGlmKGhlYWQgPT09IHZpZXcubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gMDtcbiAgICAgICAgICAgIHJlc2V0Vmlld0lkeCA9IHRydWU7IC8vIHZpZXdJZHggbmVlZHMgdG8gYmUgc2V0IGF0IDAgc2luY2UgaXQgd2FzIHJlbW92ZWQgZnJvbSB0aGUgdGFpbFxuICAgICAgICAgICAgdG8gPSB0YWlsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdG8gPSB0YWlsICsgdmlldy5sZW5ndGggLSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPT09IHRhaWwpIHtcbiAgICAgICAgLy8gTm9uZSBvZiB0aGVzZSByZXF1aXJlIG1vZGlmeWluZyBpZHggLSB0aGUgbG9vcCB0byB1cGRhdGUgaWR4IHdpbGwgbmV2ZXIgYmUgZW50ZXJlZFxuICAgICAgICBpZih0YWlsID09PSB2aWV3Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIH0gZWxzZSBpZih0YWlsID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB2aWV3Lmxlbmd0aCAtIDI7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSAwO1xuICAgICAgICAgICAgdG8gPSAtMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGhpcy50YWlsIC0gMTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IGhlYWQgLSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPCBoZWFkICYmIHZpZXdJZHggPCB0YWlsKSB7XG4gICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIHRoaXMuaGVhZCA9IGhlYWQgLSAxO1xuICAgIH0gZWxzZSBpZih2aWV3SWR4ID4gaGVhZCAmJiB2aWV3SWR4IDwgdGFpbCkge1xuICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgIH0gZWxzZSBpZih2aWV3SWR4ID4gaGVhZCAmJiB2aWV3SWR4ID4gdGFpbCkge1xuICAgICAgICB0byA9IHRhaWwgKyB2aWV3Lmxlbmd0aCAtIDE7XG4gICAgfVxuXG4gICAgdGhpcy5zaXplID0gdGhpcy5zaXplIC0gMTtcbiAgICByZW1vdmVkID0gdmlldy5zcGxpY2Uodmlld0lkeCwgMSk7XG5cbiAgICB2aWV3SWR4ID0gcmVzZXRWaWV3SWR4ID8gMCA6IHZpZXdJZHg7XG4gICAgZm9yKGkgPSB2aWV3SWR4OyBpIDw9IHRvOyArK2kpIHtcbiAgICAgICAgLS12aWV3W2kgJSB2aWV3Lmxlbmd0aF0uaWR4O1xuICAgICAgICByZXRWYWwudXBkYXRlZC5wdXNoKHZpZXdbaSAlIHZpZXcubGVuZ3RoXSk7XG4gICAgfVxuXG4gICAgaWYoZGF0YS5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICBhZGRlZCA9IHRoaXMucmVzaXplKHZpZXcubGVuZ3RoICsgMSk7XG4gICAgfVxuXG4gICAgcmV0VmFsLnJlbW92ZWQucHVzaC5hcHBseShyZXRWYWwucmVtb3ZlZCwgcmVtb3ZlZCk7XG4gICAgcmV0VmFsLm5ld0luVmlldy5wdXNoLmFwcGx5KHJldFZhbC5uZXdJblZpZXcsIGFkZGVkKTtcbiAgICByZXR1cm4gcmV0VmFsO1xufTtcblxuLypcbiAqIEl0ZXJhdGVzIHRocm91Z2ggYWxsIGl0ZW1zIGN1cnJlbnRseSBpbiB0aGUgY2lyY3VsYXIgYnVmZmVyIHN0YXJ0aW5nIGF0IHRoZSBsb2dpY2FsXG4gKiBmaXJzdCBpdGVtIHJhdGhlciB0aGFuIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHZpZXcgYXJyYXkuICBUaGUgY2FsbGJhY2sgc2lnbmF0dXJlXG4gKiBpcyBzaW1pbGFyIHRvIEFycmF5LmZvckVhY2gsIGhvd2V2ZXIgYm90aCB0aGUgcmF3IGluZGV4IGFuZCB0aGUgbG9naWNhbCBpbmRleCBhcmVcbiAqIHBhc3NlZC5cbiAqXG4gKiBjYWxsYmFjayBpcyBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM6XG4gKlxuICogICAgICB0aGUgdmlldyBpdGVtXG4gKiAgICAgIHRoZSB2aWV3IGl0ZW1zIGxvZ2ljYWwgaW5kZXhcbiAqICAgICAgdGhlIHZpZXcgaXRlbXMgcGh5c2ljYWwgaW5kZXhcbiAqICAgICAgdGhlIHZpZXdcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuZm9yRWFjaEluVmlldyA9IGZ1bmN0aW9uIGZvckVhY2hJblZpZXcoY2IsIHVzZUFzVGhpcykge1xuICAgIHZhciB2aWV3ICA9IHRoaXMudmlldztcbiAgICB2YXIgbGVuICAgPSB2aWV3Lmxlbmd0aDtcbiAgICB2YXIgaGVhZCAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHRhaWwgID0gdGhpcy50YWlsO1xuICAgIHZhciB0byAgICA9IHRhaWwgPCBoZWFkID8gdGFpbCArIGxlbiA6IHRhaWw7XG4gICAgdmFyIGksIGN1ckl0ZW0sIHJlYWxJZHg7XG5cbiAgICB1c2VBc1RoaXMgPSB1c2VBc1RoaXMgfHwgdGhpcztcblxuICAgIGZvcihpID0gaGVhZDsgaSA8PSB0bzsgKytpKSB7XG4gICAgICAgIHJlYWxJZHggPSBpICUgbGVuO1xuICAgICAgICBjdXJJdGVtID0gdmlld1tyZWFsSWR4XTtcblxuICAgICAgICBjYi5jYWxsKHVzZUFzVGhpcywgY3VySXRlbSwgaSAtIGhlYWQsIHJlYWxJZHgsIHZpZXcpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmlld0J1ZmZlcjtcbiJdfQ==
(2)
});
