!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.LiteList=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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
LiteList.VERSION = '0.4.2';


module.exports = LiteList;
},{"./viewbuffer":2}],2:[function(_dereq_,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvbGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3ZpZXdidWZmZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIFZpZXdCdWZmZXIgPSByZXF1aXJlKCcuL3ZpZXdidWZmZXInKTtcblxuLypcbiAqIExpdGVMaXN0XG4gKlxuICogb3B0czoge1xuICogIGl0ZW1XaWR0aCAgICAgICA6IE9wdGlvbmFsIC0gd2lkdGggb2YgZWFjaCBpdGVtLiAgSWYgbm90IHByb3ZpZGUgb25lIGl0ZW0gcGVyIHJvdyBpcyBhc3N1bWVkXG4gKiAgaXRlbUhlaWdodCAgICAgIDogUmVxdWlyZWQgLSBoZWlnaHQgb2YgZWFjaCBpdGVtLlxuICogIG1hcmdpbiAgICAgICAgICA6IE9wdGlvbmFsIC0gbWFyZ2luL2d1dHRlcnMgZm9yIHRoZSBpdGVtcy4gIERlZmF1bHRzIHRvOiB7IHg6IDAsIHk6IDAgfTtcbiAqICBzY3JvbGxWaWV3ICAgICAgOiBSZXF1aXJlZCAtIHF1ZXJ5IHNlbGVjdG9yIGZvciB0aGUgc2Nyb2xsYWJsZSBjb250YWluZXJcbiAqICBpdGVtc0NvbnRhaW5lciAgOiBPcHRpb25hbCAtIHF1ZXJ5IHNlbGVjdG9yIGNvbnRhaW5lciBvZiB0aGUgaXRlbXMuICBEZWZhdWx0cyB0byB0aGUgZmlyc3QgY2hpbGQgb2Ygc2Nyb2xsVmlld1xuICogIGRlbGF5QmluZCAgICAgICA6IE9wdGlvbmFsIC0gaWYgdHJ1ZSB3aWxsIHdhaXQgZm9yIGEgY2FsbCB0byBsaXRlTGlzdC5iaW5kKCkgdG8gYXR0YWNoIGFueSBoYW5kbGVyc1xuICpcbiAqICAvLyBUaGUgbmV4dCB0d28gYXJlIHJlcXVpcmVkIGZvciBhIHZhbmlsbGEgamF2YXNjcmlwdCBpbXBsZW1lbnRhdGlvbiB0byBiZSBmdW5jdGlvbmFsLiAgTGlzdExpc3Qgd2FzXG4gKiAgLy8gd3JpdHRlbiB0byB3b3JrIHdpdGggdGhlIFJpdmV0cyBsaWJyYXJ5IHdoaWNoIHByb3ZpZGVzIHRoaXMgZnVuY3Rpb25hbGl0eSBhcyB3ZWxsLiAgSW4gdGhhdCBjYXNlLFxuICogIC8vIGl0IGlzIG9wdGlvbmFsLiAgaS5lLiB0aGUgTGl0ZUxpc3Qgd2lsbCBjb250aW51ZSBvbiBpZiB0aGVzZSBhcmUgbm90IHByb3ZpZGVkLlxuICogIGl0ZW1UZW1wbGF0ZSAgICA6IFJlcXVpcmVkIC0gRE9NIG5vZGUgdGhhdCB3aWxsIGJlIGNsb25lZCBhcyBhIHRlbXBsYXRlIGZvciBlYWNoIGl0ZW0uXG4gKiAgZGF0YVNvdXJjZSAgICAgIDogUmVxdWlyZWQgLSBJbXBsZW1lbnRhdGlvbiBvZiB0aGUgZGF0YVNvdXJjZSBjb250cmFjdCAoc2VlIGJlbG93IGZvciBtb3JlIGRldGFpbHMpLlxuICogfVxuICovXG5mdW5jdGlvbiBMaXRlTGlzdChvcHRzKSB7XG4gICAgdGhpcy52aWV3QnVmZmVyICAgICAgPSBuZXcgVmlld0J1ZmZlcigpO1xuICAgIHRoaXMuaXRlbVdpZHRoICAgICAgID0gb3B0cy5pdGVtV2lkdGggfHwgMDtcbiAgICB0aGlzLml0ZW1IZWlnaHQgICAgICA9IG9wdHMuaXRlbUhlaWdodDtcbiAgICB0aGlzLm1hcmdpbiAgICAgICAgICA9IG9wdHMubWFyZ2luIHx8IHsgeDogMCwgeTogMCB9O1xuICAgIHRoaXMuZGF0YVNvdXJjZSAgICAgID0gb3B0cy5kYXRhU291cmNlIHx8IGZhbHNlO1xuICAgIHRoaXMuaXRlbVRlbXBsYXRlICAgID0gb3B0cy5pdGVtVGVtcGxhdGUgfHwgZmFsc2U7XG4gICAgdGhpcy5zY3JvbGxUb3AgICAgICAgPSAwO1xuICAgIHRoaXMuZGlydHlSZXNpemUgICAgID0gdHJ1ZTtcbiAgICB0aGlzLnRpY2tpbmcgICAgICAgICA9IGZhbHNlO1xuXG4gICAgLy8gVmlldyBNZXRyaWNzXG4gICAgdGhpcy5jbGllbnRIZWlnaHQgICAgPSAwO1xuICAgIHRoaXMuY2xpZW50V2lkdGggICAgID0gMDtcbiAgICB0aGlzLnJvd3NQZXJQYWdlICAgICA9IDA7XG4gICAgdGhpcy5pdGVtc1BlclJvdyAgICAgPSAwO1xuICAgIHRoaXMuaXRlbXNQZXJQYWdlICAgID0gMDtcbiAgICB0aGlzLm1heEJ1ZmZlciAgICAgICA9IDA7XG4gICAgdGhpcy5oZWlnaHQgICAgICAgICAgPSAwO1xuXG4gICAgLy8gR2V0IHRoZSBjb250YWluZXIgZWxlbWVudHNcbiAgICB0aGlzLnZpZXcgICAgICAgICAgICA9IG9wdHMuc2Nyb2xsVmlldztcbiAgICB0aGlzLml0ZW1zQ29udGFpbmVyICA9IG9wdHMuaXRlbXNDb250YWluZXIgfHwgZmFsc2U7XG5cbiAgICAvLyBJZiBpdCBpcyBhIHN0cmluZywgaXQgc2hvdWxkIGJlIGEgcXVlcnkgc2VsZWN0b3IgLSBvdGhlcndpc2Ugd2UgYXJlIGV4cGVjdGluZyBhbiBlbGVtZW50LlxuICAgIHRoaXMudmlldyAgICAgICAgICAgID0gKHR5cGVvZiB0aGlzLnZpZXcgICAgICAgICAgID09PSAnc3RyaW5nJyB8fCB0aGlzLnZpZXcgaW5zdGFuY2VvZiBTdHJpbmcpICAgICAgICAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy52aWV3KSAgICAgICAgICAgOiB0aGlzLnZpZXc7XG4gICAgdGhpcy5pdGVtc0NvbnRhaW5lciAgPSAodHlwZW9mIHRoaXMuaXRlbXNDb250YWluZXIgPT09ICdzdHJpbmcnIHx8IHRoaXMuaXRlbXNDb250YWluZXIgaW5zdGFuY2VvZiBTdHJpbmcpID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihvcHRzLml0ZW1zQ29udGFpbmVyKSA6IHRoaXMuaXRlbXNDb250YWluZXI7XG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIGEgdW5pcXVlIGlkIGZvciB2aWV3SXRlbXMgLSBhbGxvd3MgVGhpcyBpcyBwYXNzZWQgdG9cbiAgICAvLyBkYXRhc291cmNlIHByb3ZpZGVycyB0byBhaWQgaW4gdHJhY2tpbmcuXG4gICAgdGhpcy5faWQgPSAwO1xuXG4gICAgLy8gSWYgbm90IHBhc3NlZCBhIHBhZ2Ugc2VsZWN0b3IsIGFzc3VtZSBpdCdzIHRoZSBmaXJzdCBjaGlsZFxuICAgIGlmKCF0aGlzLml0ZW1zQ29udGFpbmVyKSB7XG4gICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIgPSB0aGlzLnZpZXcuY2hpbGRyZW5bMF07XG4gICAgfVxuXG4gICAgLy8gX3VwZGF0ZVZpZXcgaXMgdXNlZCBpbiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgLSBiaW5kIGl0IHRvIHRoaXNcbiAgICB0aGlzLl91cGRhdGVWaWV3ID0gdGhpcy5fdXBkYXRlVmlldy5iaW5kKHRoaXMpO1xuXG4gICAgLy8gSW52b2tlZCBhcyBhIHJlc3VsdCBvZiBldmVudCBsaXN0ZW5lcnMgLSBiaW5kIHRoZW0gdG8gdGhpc1xuICAgIHRoaXMuX3Njcm9sbEhhbmRsZXIgPSB0aGlzLl9zY3JvbGxIYW5kbGVyLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fcmVzaXplSGFuZGxlciA9IHRoaXMuX3Jlc2l6ZUhhbmRsZXIuYmluZCh0aGlzKTtcblxuICAgIC8vIEVuc3VyZSB2YWxpZCB2aWV3IG1ldHJpY3NcbiAgICB0aGlzLl9jYWxjVmlld01ldHJpY3MoKTtcblxuICAgIC8vIGJpbmQgYW55IGV2ZW50IGhhbmRsZXJzIG5vdyBpZiBub3QgYXNrZWQgdG8gZGVsYXlcbiAgICBpZighb3B0cy5kZWxheUJpbmQpIHtcbiAgICAgICAgdGhpcy5iaW5kKCk7XG4gICAgfVxuXG4gICAgLy8gSWYgd2Uga25vdyBhYm91dCBTY3JvbGwsIGF0dGFjaCBpdCBub3dcbiAgICB0aGlzLnNjcm9sbCA9IExpdGVMaXN0LlNjcm9sbCA/IG5ldyBMaXRlTGlzdC5TY3JvbGwob3B0cy5zY3JvbGxWaWV3LCB0aGlzLl9zY3JvbGxIYW5kbGVyKSA6IGZhbHNlO1xuXG4gICAgLy8gS2lja3Mgb2ZmIGEgbGF5b3V0IChkaXJ0eVJlc2l6ZSBkZWZhdWx0cyB0byB0cnVlKVxuICAgIC8vIFRoaXMgd2lsbCBsYXlvdXQgZXZlcnl0aGluZyBuaWNlbHkgZmlsbGluZyBhbGwgY29sdW1uc1xuICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcbiAgICB0aGlzLl9yZXF1ZXN0VGljaygpO1xufVxuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2NhbGNWaWV3TWV0cmljcyA9IGZ1bmN0aW9uIGNhbGNWaWV3TWV0cmljcygpIHtcbiAgICB0aGlzLmNsaWVudEhlaWdodCAgICA9IHRoaXMudmlldy5jbGllbnRIZWlnaHQ7XG4gICAgdGhpcy5jbGllbnRXaWR0aCAgICAgPSB0aGlzLnZpZXcuY2xpZW50V2lkdGg7XG4gICAgdGhpcy5yb3dzUGVyUGFnZSAgICAgPSBNYXRoLmNlaWwgKHRoaXMuY2xpZW50SGVpZ2h0IC8gKHRoaXMuaXRlbUhlaWdodCArIHRoaXMubWFyZ2luLnkpKTtcbiAgICB0aGlzLml0ZW1zUGVyUm93ICAgICA9IHRoaXMuaXRlbVdpZHRoID8gTWF0aC5mbG9vcih0aGlzLmNsaWVudFdpZHRoICAvICh0aGlzLml0ZW1XaWR0aCAgKyB0aGlzLm1hcmdpbi54KSkgOiAxO1xuICAgIHRoaXMuaXRlbXNQZXJQYWdlICAgID0gdGhpcy5yb3dzUGVyUGFnZSAqIHRoaXMuaXRlbXNQZXJSb3c7XG4gICAgdGhpcy5tYXhCdWZmZXIgICAgICAgPSB0aGlzLml0ZW1zUGVyUGFnZSAqIDM7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2NhbGNEb2NIZWlnaHQgPSBmdW5jdGlvbiBjYWxjRG9jSGVpZ2h0KCkge1xuICAgIHZhciByb3cgPSBNYXRoLmNlaWwodGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoL3RoaXMuaXRlbXNQZXJSb3cpO1xuICAgIHZhciBuZXdIZWlnaHQgPSByb3cgKiB0aGlzLml0ZW1IZWlnaHQgKyByb3cgKiB0aGlzLm1hcmdpbi55O1xuXG4gICAgaWYobmV3SGVpZ2h0ICE9PSB0aGlzLmhlaWdodCkge1xuICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IG5ld0hlaWdodCArIFwicHhcIjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBuZXdIZWlnaHQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmhlaWdodDtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5faW5pdEluVmlld0l0ZW0gPSBmdW5jdGlvbiBfaW5pdEluVmlld0l0ZW0oaXRlbSkge1xuICAgIGl0ZW0uaWQgICA9IHRoaXMuX2lkKys7XG5cbiAgICAvLyBJZiB3ZSB3ZXJlIGdpdmVuIGFuIGl0ZW0gdGVtcGxhdGUsIHdlIG5lZWQgdG8gYWRkIGEgY2xvbmVcbiAgICAvLyB0byB0aGUgZG9tXG4gICAgaWYodGhpcy5pdGVtVGVtcGxhdGUpIHtcbiAgICAgICAgdmFyIG5ld05vZGUgPSB0aGlzLml0ZW1UZW1wbGF0ZS5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICAgICAgaWYobmV3Tm9kZSBpbnN0YW5jZW9mKHdpbmRvdy5Eb2N1bWVudEZyYWdtZW50KSkge1xuICAgICAgICAgICAgbmV3Tm9kZSA9IG5ld05vZGUuY2hpbGROb2Rlc1swXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIuYXBwZW5kQ2hpbGQobmV3Tm9kZSk7XG4gICAgICAgIGl0ZW0uZWwgPSBuZXdOb2RlO1xuICAgICAgICBpZih0aGlzLmRhdGFTb3VyY2UgJiYgdGhpcy5kYXRhU291cmNlLmJpbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YVNvdXJjZS5iaW5kKGl0ZW0uaWQsIG5ld05vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZW07XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3N5bmNWaWV3SXRlbSA9IGZ1bmN0aW9uIHN5bmNWaWV3SXRlbSh2aWV3SXRlbSkge1xuICAgIC8vIElmIHdlIGhhdmUgYSBkYXRhU291cmNlXG4gICAgaWYodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS5zeW5jKSB7XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZS5zeW5jKHZpZXdJdGVtLmlkLCB2aWV3SXRlbS5lbCwgdmlld0l0ZW0uaWR4LCB2aWV3SXRlbS5kYXRhKTtcbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Bvc2l0aW9uVmlld0l0ZW0gPSBmdW5jdGlvbiBwb3NpdGlvblZpZXdJdGVtKHZpZXdJdGVtLCBmb3JjZSkge1xuICAgIHZhciBpZHggID0gdmlld0l0ZW0uaWR4O1xuICAgIHZhciByb3cgID0gTWF0aC5mbG9vcihpZHgvdGhpcy5pdGVtc1BlclJvdyk7XG4gICAgdmFyIGNvbCAgPSAoaWR4ICUgdGhpcy5pdGVtc1BlclJvdyk7XG4gICAgdmFyIHRvcCAgPSByb3cgKiB0aGlzLml0ZW1IZWlnaHQgKyByb3cgKiB0aGlzLm1hcmdpbi55O1xuICAgIHZhciBsZWZ0ID0gY29sICogdGhpcy5pdGVtV2lkdGggICsgY29sICogdGhpcy5tYXJnaW4ueDtcblxuICAgIC8vIEF2b2lkIHRyaWdnZXJpbmcgdXBkYXRlIGlmIHRoZSB2YWx1ZSBoYXNuJ3QgY2hhbmdlZFxuICAgIGlmKGZvcmNlIHx8ICh2aWV3SXRlbS50b3AgICE9PSB0b3ApICkge1xuICAgICAgICB2aWV3SXRlbS50b3AgID0gdG9wO1xuXG4gICAgICAgIGlmKHZpZXdJdGVtLmVsKSB7XG4gICAgICAgICAgICB2aWV3SXRlbS5lbC5zdHlsZS50b3AgPSB0b3AgKyBcInB4XCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZihmb3JjZSB8fCAodmlld0l0ZW0ubGVmdCAhPT0gbGVmdCkpIHtcbiAgICAgICAgdmlld0l0ZW0ubGVmdCA9IGxlZnQ7XG5cbiAgICAgICAgaWYodmlld0l0ZW0uZWwpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtLmVsLnN0eWxlLmxlZnQgPSBsZWZ0ICsgXCJweFwiO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9lbnN1cmVWaXNpYmxlID0gZnVuY3Rpb24gX2Vuc3VyZVZpc2libGUoZG9uZSkge1xuICAgIHZhciBwZXJjZW50SW5WaWV3U3RhcnQgPSAoKHRoaXMuc2Nyb2xsVG9wKSAvICh0aGlzLmhlaWdodCkpO1xuICAgIHZhciBwZXJjZW50SW5WaWV3RW5kICAgPSAoKHRoaXMuc2Nyb2xsVG9wICsgdGhpcy5jbGllbnRIZWlnaHQpIC8gKHRoaXMuaGVpZ2h0KSk7XG5cbiAgICB2YXIgb2xkU3RhcnQsIG5ld1N0YXJ0LCBvbGRFbmQsIG5ld0VuZCwgaSwgdmlld0l0ZW07XG5cbiAgICBpZih0aGlzLmRpcmVjdGlvbiA8IDApIHtcbiAgICAgICAgb2xkRW5kID0gdGhpcy52aWV3QnVmZmVyLnZpZXdbdGhpcy52aWV3QnVmZmVyLnRhaWxdLmlkeDtcbiAgICAgICAgbmV3RW5kID0gTWF0aC5jZWlsIChwZXJjZW50SW5WaWV3RW5kICAgKiB0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAoaSA9IG9sZEVuZDsgaSA+IG5ld0VuZCArIHRoaXMuaXRlbXNQZXJSb3c7IC0taSkge1xuICAgICAgICAgICAgdmlld0l0ZW0gPSB0aGlzLnZpZXdCdWZmZXIuc2hpZnQoLTEpWzBdO1xuXG4gICAgICAgICAgICBpZiAodmlld0l0ZW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zeW5jVmlld0l0ZW0odmlld0l0ZW0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0odmlld0l0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKHRoaXMuZGlyZWN0aW9uID4gMCkge1xuICAgICAgICBvbGRTdGFydCA9IHRoaXMudmlld0J1ZmZlci52aWV3W3RoaXMudmlld0J1ZmZlci5oZWFkXS5pZHg7XG4gICAgICAgIG5ld1N0YXJ0ID0gTWF0aC5mbG9vcihwZXJjZW50SW5WaWV3U3RhcnQgKiB0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGgpO1xuXG4gICAgICAgIGZvcihpID0gb2xkU3RhcnQ7IGkgPCBuZXdTdGFydCAtIHRoaXMuaXRlbXNQZXJSb3c7ICsraSkge1xuICAgICAgICAgICAgdmlld0l0ZW0gPSB0aGlzLnZpZXdCdWZmZXIuc2hpZnQoMSlbMF07XG5cbiAgICAgICAgICAgIGlmKHZpZXdJdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3luY1ZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKHZpZXdJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRvbmUoKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcmVzaXplID0gZnVuY3Rpb24gX3Jlc2l6ZShkb25lKSB7XG4gICAgdmFyIG5ld0hlaWdodCAgICA9IHRoaXMudmlldy5jbGllbnRIZWlnaHQ7XG4gICAgdmFyIG5ld1dpZHRoICAgICA9IHRoaXMudmlldy5jbGllbnRXaWR0aDtcblxuICAgIHZhciBuZXdSb3dzUGVyUGFnZSAgICAgPSBNYXRoLmNlaWwgKG5ld0hlaWdodCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSk7XG4gICAgdmFyIG5ld0l0ZW1zUGVyUm93ICAgICA9IHRoaXMuaXRlbVdpZHRoID8gTWF0aC5mbG9vcihuZXdXaWR0aCAgLyAodGhpcy5pdGVtV2lkdGggICsgdGhpcy5tYXJnaW4ueCkpIDogMTtcblxuICAgIHZhciByZW1vdmVkOyAvLywgaW5WaWV3T2JqO1xuICAgIGlmKG5ld1Jvd3NQZXJQYWdlICE9PSB0aGlzLnJvd3NQZXJQYWdlIHx8IG5ld0l0ZW1zUGVyUm93ICE9PSB0aGlzLml0ZW1zUGVyUm93KSB7XG4gICAgICAgIHRoaXMuX2NhbGNWaWV3TWV0cmljcygpO1xuICAgICAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG5cbiAgICAgICAgdmFyIHBlcmNlbnRJblZpZXcgPSB0aGlzLl9maXJzdFZpc2libGVJdGVtIC8gdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoO1xuICAgICAgICB0aGlzLnNjcm9sbFRvcCA9IHRoaXMudmlldy5zY3JvbGxUb3AgPSBNYXRoLmZsb29yKHRoaXMuaGVpZ2h0ICogcGVyY2VudEluVmlldyk7XG4gICAgICAgIHZhciBuZXdGaXJzdFZpc2libGUgPSBNYXRoLmZsb29yKHRoaXMuc2Nyb2xsVG9wIC8gKHRoaXMuaXRlbUhlaWdodCArIHRoaXMubWFyZ2luLnkpKSAqIG5ld0l0ZW1zUGVyUm93O1xuXG4gICAgICAgIGlmICh0aGlzLnZpZXdCdWZmZXIudmlldy5sZW5ndGggPiB0aGlzLm1heEJ1ZmZlcikge1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHRoaXMudmlld0J1ZmZlci5yZXNpemUodGhpcy5tYXhCdWZmZXIpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24gKGluVmlld0l0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhU291cmNlLnVuYmluZChpblZpZXdJdGVtLmlkLCBpblZpZXdJdGVtLmVsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpblZpZXdJdGVtLmVsKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnZpZXdCdWZmZXIudmlldy5sZW5ndGggPCB0aGlzLm1heEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy52aWV3QnVmZmVyLnJlc2l6ZShNYXRoLm1pbih0aGlzLm1heEJ1ZmZlciwgdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKSlcbiAgICAgICAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbml0SW5WaWV3SXRlbShpdGVtKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzaGlmdEFtdCA9IG5ld0ZpcnN0VmlzaWJsZSAtIHRoaXMudmlld0J1ZmZlci52aWV3W3RoaXMudmlld0J1ZmZlci5oZWFkXS5pZHggLSBuZXdJdGVtc1BlclJvdztcbiAgICAgICAgdGhpcy52aWV3QnVmZmVyLnNoaWZ0KHNoaWZ0QW10KTtcbiAgICAgICAgdGhpcy52aWV3QnVmZmVyLnZpZXcuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3NpdGlvblZpZXdJdGVtKGl0ZW0pO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICBkb25lKCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3VwZGF0ZVZpZXcgPSBmdW5jdGlvbiBfdXBkYXRlVmlldygpIHtcbiAgICB2YXIgZG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLl9maXJzdFZpc2libGVJdGVtID0gTWF0aC5mbG9vcih0aGlzLnNjcm9sbFRvcCAvICh0aGlzLml0ZW1IZWlnaHQgKyB0aGlzLm1hcmdpbi55KSkgKiB0aGlzLml0ZW1zUGVyUm93O1xuICAgICAgICB0aGlzLl9sYXN0VmlzaWJsZUl0ZW0gID0gTWF0aC5jZWlsICgodGhpcy5zY3JvbGxUb3AgKyB0aGlzLmNsaWVudEhlaWdodCkvKHRoaXMuaXRlbUhlaWdodCArIHRoaXMubWFyZ2luLnkpKSAqIHRoaXMuaXRlbXNQZXJSb3c7XG5cbiAgICAgICAgdGhpcy5kaXJ0eVJlc2l6ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRpY2tpbmcgICAgID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uICAgPSAwO1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIGlmKHRoaXMuZGlydHlSZXNpemUpIHtcbiAgICAgICAgdGhpcy5fcmVzaXplKGRvbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2Vuc3VyZVZpc2libGUoZG9uZSk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9yZXF1ZXN0VGljayA9IGZ1bmN0aW9uIHJlcXVlc3RUaWNrKCkge1xuICAgIGlmKCF0aGlzLnRpY2tpbmcpIHtcbiAgICAgICAgdGhpcy50aWNraW5nID0gdHJ1ZTtcbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl91cGRhdGVWaWV3KTtcbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIHB1c2goKSB7XG4gICAgdmFyIGFyZ3MgICAgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgdGhpcy52aWV3QnVmZmVyLmRhdGEucHVzaC5hcHBseSh0aGlzLnZpZXdCdWZmZXIuZGF0YSwgYXJncyk7XG5cbiAgICB2YXIgbmV3SW5WaWV3ID0gdGhpcy52aWV3QnVmZmVyLnJlc2l6ZShNYXRoLm1pbih0aGlzLm1heEJ1ZmZlciwgdGhpcy52aWV3QnVmZmVyLmRhdGEubGVuZ3RoKSk7XG5cbiAgICBuZXdJblZpZXcuZm9yRWFjaChmdW5jdGlvbihpblZpZXdEYXRhKSB7XG4gICAgICAgIHRoaXMuX2luaXRJblZpZXdJdGVtKGluVmlld0RhdGEpO1xuICAgICAgICB0aGlzLl9zeW5jVmlld0l0ZW0oaW5WaWV3RGF0YSk7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0oaW5WaWV3RGF0YSwgdHJ1ZSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gYmluZCgpIHtcbiAgICB0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLl9zY3JvbGxIYW5kbGVyKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCB0aGlzLl9yZXNpemVIYW5kbGVyKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdGhpcy52aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5fc2Nyb2xsSGFuZGxlcik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5fcmVzaXplSGFuZGxlcik7XG5cbiAgICBpZih0aGlzLnNjcm9sbCkgeyB0aGlzLnNjcm9sbC51bmJpbmQoKTsgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKSB7XG4gICAgdmFyIGNhbGxVbmJpbmQgPSAodGhpcy5kYXRhU291cmNlICYmIHRoaXMuZGF0YVNvdXJjZS51bmJpbmQpO1xuXG4gICAgdGhpcy52aWV3LnNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsVG9wID0gMDtcblxuICAgIHZhciBpdGVtc0luVmlldyA9IHRoaXMudmlld0J1ZmZlci5jbGVhcigpO1xuXG4gICAgLy8gSWYgd2Ugd2VyZSBnaXZlbiBhbiBpdGVtIHRlbXBsYXRlLCB3ZSBuZWVkIHJlbW92ZSBhbnkgbm9kZXMgd2UndmUgYWRkZWRcbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICBpdGVtc0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKGl0ZW0uZWwpICAgIHsgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpdGVtLmVsKTsgfVxuICAgICAgICAgICAgaWYoY2FsbFVuYmluZCkgeyB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKGl0ZW0uaWQsIGl0ZW0uZWwpOyB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiBmb3JFYWNoKC8qZm4sIHRoaXNBcmcqLykge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmZvckVhY2guYXBwbHkodGhpcy5pdGVtcywgYXJndW1lbnRzKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoSW5WaWV3ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudmlld0J1ZmZlci5mb3JFYWNoSW5WaWV3LmFwcGx5KHRoaXMudmlld0J1ZmZlciwgYXJndW1lbnRzKTtcbn07XG5cblxuTGl0ZUxpc3QucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZShzZWFyY2hJZHgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy52aWV3QnVmZmVyLnJlbW92ZShzZWFyY2hJZHgpO1xuXG4gICAgcmVzdWx0Lm5ld0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbShpdGVtKTtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlIHx8IHRoaXMuZGF0YVNvdXJjZSkge1xuICAgICAgICByZXN1bHQucmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhc291cmNlLnVuYmluZChpdGVtLmlkLCBpdGVtLmVsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodGhpcy5pdGVtVGVtcGxhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLnJlbW92ZUNoaWxkKGl0ZW0uZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXN1bHQudXBkYXRlZC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpdGVtKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fc2Nyb2xsSGFuZGxlciA9IGZ1bmN0aW9uIHNjcm9sbEhhbmRsZXIoLypldnQqLykge1xuICAgIHZhciBzY3JvbGxUb3AgICA9IHRoaXMudmlldy5zY3JvbGxUb3A7XG5cbiAgICBpZihzY3JvbGxUb3AgIT09IHRoaXMuc2Nyb2xsVG9wKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uICA9IHNjcm9sbFRvcCA+IHRoaXMuc2Nyb2xsVG9wID8gMSA6IC0xO1xuICAgICAgICB0aGlzLnNjcm9sbFRvcCAgPSBzY3JvbGxUb3A7XG4gICAgICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG4gICAgfVxufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9yZXNpemVIYW5kbGVyID0gZnVuY3Rpb24gcmVzaXplSGFuZGxlcigvKmV2dCovKSB7XG4gICAgdGhpcy5kaXJ0eVJlc2l6ZSA9IHRydWU7XG4gICAgdGhpcy5fcmVxdWVzdFRpY2soKTtcbn07XG5cbi8vIFZlcnNpb24uXG5MaXRlTGlzdC5WRVJTSU9OID0gJzAuNC4yJztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVMaXN0OyIsIlwidXNlIHN0cmljdFwiO1xuXG4vKlxuICogQ2lyY3VsYXIgYnVmZmVyIHJlcHJlc2VudGluZyBhIHZpZXcgb24gYW4gYXJyYXkgb2YgZW50cmllcy5cbiAqL1xuZnVuY3Rpb24gVmlld0J1ZmZlcihkYXRhLCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG4gICAgdGhpcy5kYXRhID0gZGF0YSB8fCBbXTtcbiAgICB0aGlzLnZpZXcgPSBbXTtcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBoZXJlXG4gICAgaWYoaW5pdGlhbFNpemUpIHsgdGhpcy5yZXNpemUoaW5pdGlhbFNpemUpOyB9XG59XG5cbi8qXG4gKiBTaHJpbmsgdGhlIHZpZXcgYnVmZmVyXG4gKlxuICogQHBhcmFtIG5ld1NpemVcbiAqIEBwYXJhbSBoZWFkOiAgICAgaWYgdHJ1ZSwgd2lsbCBzaHJpbmsgcmVsYXRpdmUgdG8gaGVhZC5cbiAqXG4gKiBAcmV0dXJuczogQXJyYXkgb2YgcmVtb3ZlZCB2aWV3IGJ1ZmZlciBlbnRyaWVzXG4gKi9cbmZ1bmN0aW9uIF9zaHJpbmsobmV3U2l6ZSwgaGVhZCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIGRlbHRhID0gW107XG4gICAgdmFyIHZpZXcgID0gdGhpcy52aWV3O1xuICAgIHZhciBzaHJpbmthZ2UgPSB2aWV3Lmxlbmd0aCAtIG5ld1NpemU7XG4gICAgdmFyIHNwbGljZWQ7XG5cbiAgICBpZihuZXdTaXplID49IHZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBzaHJpbmsgdG8gYSBzaXplIGxhcmdlciB0aGFuIHRoZSBjdXJyZW50IHNpemVcIik7XG4gICAgfVxuXG4gICAgd2hpbGUoc2hyaW5rYWdlICYmIHZpZXcubGVuZ3RoID4gMCkge1xuICAgICAgICBzcGxpY2VkID0gdmlldy5zcGxpY2UoaGVhZCA/IHRoaXMuaGVhZCA6IHRoaXMudGFpbCwgMSk7XG4gICAgICAgIGRlbHRhLnB1c2goc3BsaWNlZFswXSk7XG5cbiAgICAgICAgLy8gV2hlbiBzaHJpbmtpbmcgZnJvbSBoZWFkLCB0aGUgb25seSB0aW1lIHRoZSBoZWFkcyByZXN1bHRpbmcgdmFsdWUgY2hhbmdlcyBpc1xuICAgICAgICAvLyBpZiBoZWFkIGlzIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3QuICBTbyBpdCBpcyBzYWZlIHRvIHRha2UgdGhlIG1vZHVsbyBvZiBoZWFkXG4gICAgICAgIC8vIGFnYWluc3QgdGhlIG5ldyB2aWV3IGxlbmd0aDtcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGFpbCBpcyB0aGVuIHRoZSBtb2R1bG8gb2YgaGVhZCArIDE7XG4gICAgICAgIGlmKGhlYWQpIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IHRoaXMuaGVhZCAlIHZpZXcubGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gKHRoaXMuaGVhZCArIDEpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIH0gZWxzZSBpZih0aGlzLnRhaWwgPCB0aGlzLmhlYWQpIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbCAtIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLmhlYWQgLSAxO1xuXG4gICAgICAgICAgICBpZih0aGlzLnRhaWwgPCAwKSB7IHRoaXMudGFpbCA9IHZpZXcubGVuZ3RoIC0gMTsgfVxuICAgICAgICB9IGVsc2UgaWYodGhpcy50YWlsID4gdGhpcy5oZWFkKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgLSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhleSBhcmUgZXF1YWwgd2hlbiBib3RoIGFyZSB6ZXJvXG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC0tc2hyaW5rYWdlO1xuICAgIH1cblxuICAgIGlmKHZpZXcubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHZpZXcubGVuZ3RoO1xuICAgIHJldHVybiBkZWx0YTtcbn1cblxuLypcbiAqIEdyb3dzIHRoZSB2aWV3IGJ1ZmZlcjogIHRoZSB2aWV3IGJ1ZmZlciB3aWxsIGdyb3cgaW4gdGhlIHJlcXVlc3RlZCBkaXJlY3Rpb25cbiAqIGFzIG11Y2ggYXMgaXQgY2FuLiAgV2hlbiBpdCByZWFjaGVzIGEgbGltaXQsIGl0IHdpbGwgdHJ5IHRvIGdyb3cgaW4gdGhlIG9wcG9zaXRlXG4gKiBkaXJlY3Rpb24gYXMgd2VsbC5cbiAqXG4gKiBAcGFyYW0gbmV3U2l6ZVxuICogQHBhcmFtIGhlYWQ6ICAgICBpZiB0cnVlLCB3aWxsIGdyb3cgcmVsYXRpdmUgdG8gaGVhZFxuICpcbiAqIEByZXR1cm5zOiBBcnJheSBvZiBuZXdseSBpbml0aWFsaXplZCB2aWV3IGJ1ZmZlciBlbnRyaWVzXG4gKi9cbmZ1bmN0aW9uIF9ncm93KG5ld1NpemUsIGhlYWQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciBkZWx0YSA9IFtdO1xuICAgIHZhciB2aWV3ICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGRhdGEgICA9IHRoaXMuZGF0YTtcbiAgICB2YXIgZ3Jvd3RoID0gbmV3U2l6ZSAtIHZpZXcubGVuZ3RoO1xuICAgIHZhciBuZXdFbnRyeTtcblxuICAgIGlmKG5ld1NpemUgPiBkYXRhLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZ3JvdyB0byBhIHNpemUgbGFyZ2VyIHRoYW4gdGhlIGN1cnJlbnQgZGF0YXNldFwiKTtcbiAgICB9XG5cbiAgICBpZihncm93dGggPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBncm93IHRvIGEgc2l6ZSBzbWFsbGVyIHRoYW4gdGhlIGN1cnJlbnQgc2l6ZVwiKTtcbiAgICB9XG5cbiAgICAvLyBOb3RoaW5nIHRvIGRvIGhlcmUsIGp1c3QgcmV0dXJuIGFuIGVtcHR5IGRlbHRhXG4gICAgaWYoZ3Jvd3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBkZWx0YTtcbiAgICB9XG5cbiAgICB3aGlsZShncm93dGgpIHtcbiAgICAgICAgaWYodGhpcy5oZWFkID09PSAtMSAmJiB0aGlzLnRhaWwgPT09IC0xKSB7XG4gICAgICAgICAgICBuZXdFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICBpZHg6ICAwLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFbMF1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZpZXcucHVzaChuZXdFbnRyeSk7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoaGVhZCAmJiB2aWV3W3RoaXMuaGVhZF0uaWR4ID4gMCkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgdmlld1t0aGlzLmhlYWRdLmlkeCAtIDEsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVt2aWV3W3RoaXMuaGVhZF0uaWR4IC0gMV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBzYWZlIHRvIGFkZCBhZnRlciB0aGUgdGFpbFxuICAgICAgICAgICAgdmlldy5zcGxpY2UodGhpcy5oZWFkLCAwLCBuZXdFbnRyeSk7XG5cbiAgICAgICAgICAgIC8vIEhlYWQgZG9lc24ndCBjaGFuZ2VcbiAgICAgICAgICAgIHRoaXMudGFpbCA9ICh0aGlzLmhlYWQgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIH0gZWxzZSBpZih2aWV3W3RoaXMudGFpbF0uaWR4IDwgZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBuZXdFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICBpZHg6ICB2aWV3W3RoaXMudGFpbF0uaWR4ICsgMSxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhW3ZpZXdbdGhpcy50YWlsXS5pZHggKyAxXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmlldy5zcGxpY2UodGhpcy50YWlsICsgMSwgMCwgbmV3RW50cnkpO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsICsgMTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9ICh0aGlzLnRhaWwgKyAxKSAlIHZpZXcubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBJZiB3ZSBjYW4ndCBhZGQgYW55bW9yZSBhdCB0aGUgdGFpbCwgZm9yY2UgdGhpcyBpbnRvXG4gICAgICAgICAgICAvLyB0aGUgaGVhZCBsb2dpYyB3aGljaCB3aWxsIG9ubHkgZ3JvdyB3aGVuIHRoZSBpZHggPiAwXG4gICAgICAgICAgICBpZihuZXdFbnRyeS5pZHggPT09IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIGhlYWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYodmlld1t0aGlzLnRhaWxdLmlkeCA9PT0gZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAvLyBTcGVjaWFsIGNhc2UgLSBpZiB0aGUgdmlldyBpcyBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0XG4gICAgICAgICAgICAvLyBzZXQgaGVhZCB0byB0cnVlIGFuZCBsb29wIGFyb3VuZCB3aXRob3V0IGRlY3JlbWVudGluZ1xuICAgICAgICAgICAgLy8gZ3Jvd3RoXG4gICAgICAgICAgICBoZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobmV3RW50cnkpIHsgZGVsdGEucHVzaChuZXdFbnRyeSk7IH1cbiAgICAgICAgbmV3RW50cnkgPSBmYWxzZTtcbiAgICAgICAgLS1ncm93dGg7XG4gICAgfVxuXG4gICAgdGhpcy5zaXplID0gdmlldy5sZW5ndGg7XG4gICAgcmV0dXJuIGRlbHRhO1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBlbmQgb2YgdGhlIGRhdGEgYXJyYXlcbiAqL1xuZnVuY3Rpb24gX3NoaWZ0UmlnaHQoY291bnQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciB2aWV3ICAgICAgICA9IHRoaXMudmlldztcbiAgICB2YXIgbmV3SW5WaWV3ICAgPSBbXTtcbiAgICB2YXIgY3VyVGFpbElkeDtcbiAgICB2YXIgdGFpbCA9IHRoaXMudGFpbDtcbiAgICB2YXIgaGVhZCA9IHRoaXMuaGVhZDtcblxuICAgIGNvdW50ID0gY291bnQgfHwgMTtcblxuICAgIHdoaWxlKGNvdW50KSB7XG4gICAgICAgIGN1clRhaWxJZHggID0gdmlld1t0YWlsXS5pZHg7XG5cbiAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHdlIGFyZSBhbHJlYWR5IGF0IHRoZSBlbmRcbiAgICAgICAgaWYoY3VyVGFpbElkeCA9PT0gdGhpcy5kYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgICAgICAgICAgcmV0dXJuIG5ld0luVmlldztcbiAgICAgICAgfVxuXG4gICAgICAgIHRhaWwgPSAodGFpbCArIDEpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIGhlYWQgPSAoaGVhZCArIDEpICUgdmlldy5sZW5ndGg7XG5cbiAgICAgICAgdmlld1t0YWlsXS5pZHggID0gY3VyVGFpbElkeCArIDE7XG4gICAgICAgIHZpZXdbdGFpbF0uZGF0YSA9IHRoaXMuZGF0YVtjdXJUYWlsSWR4ICsgMV07XG5cbiAgICAgICAgbmV3SW5WaWV3LnB1c2godmlld1t0YWlsXSk7XG5cbiAgICAgICAgLy8gT25seSBtYWludGFpbiBhdCBtb3N0IHZpZXcubGVuZ3RoIGl0ZW1zXG4gICAgICAgIGlmKG5ld0luVmlldy5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICAgICAgbmV3SW5WaWV3LnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAtLWNvdW50O1xuICAgIH1cblxuICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgdGhpcy5oZWFkID0gaGVhZDtcblxuICAgIHJldHVybiBuZXdJblZpZXc7XG59XG5cbi8qXG4gKiBNb3ZlcyB0aGUgYnVmZmVyIHRvd2FyZHMgdGhlIGJlZ2lubmluZyBvZiB0aGUgZGF0YSBhcnJheVxuICovXG5mdW5jdGlvbiBfc2hpZnRMZWZ0KGNvdW50KSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgdmlldyAgICAgICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIG5ld0luVmlldyAgID0gW107XG4gICAgdmFyIGhlYWQgICAgICAgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICAgICAgICA9IHRoaXMudGFpbDtcbiAgICB2YXIgZGF0YSAgICAgICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIGN1ckhlYWRJZHg7XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG4gICAgd2hpbGUoY291bnQpIHtcbiAgICAgICAgY3VySGVhZElkeCAgPSB2aWV3W2hlYWRdLmlkeDtcblxuICAgICAgICAvLyBFYXJseSByZXR1cm4gaWYgd2UgYXJlIGFscmVhZHkgYXQgdGhlIGJlZ2lubmluZ1xuICAgICAgICBpZihjdXJIZWFkSWR4ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICAgICAgICAgIHJldHVybiBuZXdJblZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICBoZWFkID0gKGhlYWQgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG4gICAgICAgIHRhaWwgPSAodGFpbCAtIDEgKyB2aWV3Lmxlbmd0aCkgJSB2aWV3Lmxlbmd0aDtcblxuICAgICAgICB2aWV3W2hlYWRdLmlkeCAgPSBjdXJIZWFkSWR4IC0gMTtcbiAgICAgICAgdmlld1toZWFkXS5kYXRhID0gZGF0YVtjdXJIZWFkSWR4IC0gMV07XG5cbiAgICAgICAgbmV3SW5WaWV3LnB1c2godmlld1toZWFkXSk7XG5cbiAgICAgICAgLy8gT25seSBtYWludGFpbiBhdCBtb3N0IHZpZXcubGVuZ3RoIGl0ZW1zXG4gICAgICAgIGlmKG5ld0luVmlldy5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICAgICAgbmV3SW5WaWV3LnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAtLWNvdW50O1xuICAgIH1cblxuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG4gICAgdGhpcy50YWlsID0gdGFpbDtcbiAgICByZXR1cm4gbmV3SW5WaWV3O1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBlbmQgKGNvdW50ID4gMCkgb3JcbiAqIGJlZ2lubmluZyAoY291bnQgPCAwKSBvZiB0aGUgZGF0YSBhcnJheTtcbiAqXG4gKiBAcmV0dXJucyBhcnJheSBvZiBuZXcgZGF0YSBlbGVtZW50cyBpbiB0aGUgdmlldyBidWZmZXJcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuc2hpZnQgPSBmdW5jdGlvbiBzaGlmdChjb3VudCkge1xuICAgIHZhciBmbjtcblxuICAgIGNvdW50ID0gY291bnQgfHwgMTtcbiAgICBmbiAgICA9IGNvdW50ID4gMCA/IF9zaGlmdFJpZ2h0IDogX3NoaWZ0TGVmdDtcblxuICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIE1hdGguYWJzKGNvdW50KSk7XG59O1xuXG4vKlxuICogUmVzaXplIHRoZSB2aWV3IGJ1ZmZlciAtIGVpdGhlciBncm93aW5nIG9yIHNocmlua2luZyBpdC5cbiAqXG4gKiBAcGFyYW0gbmV3U2l6ZSAtIHRoZSBuZXcgc2l6ZSBvZiB0aGUgdmlldyBidWZmZXJcbiAqIEBwYXJhbSBoZWFkICAgIC0gaWYgdHJ1ZSwgcHJlZmVyIHJlc2l6aW5nIGJhc2VkIG9uIHRoZSBoZWFkIHJhdGhlciB0aGFuIHRoZSB0YWlsXG4gKlxuICogQHJldHVybnMgICAgICAgLSBBcnJheSBvZiBhZGRlZCBvciByZW1vdmVkIGl0ZW1zXG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uIHJlc2l6ZShuZXdTaXplLCBoZWFkKSB7XG4gICAgaWYobmV3U2l6ZSA+IHRoaXMudmlldy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIF9ncm93LmNhbGwodGhpcywgbmV3U2l6ZSwgaGVhZCk7XG4gICAgfSBlbHNlIGlmKG5ld1NpemUgPCB0aGlzLnZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBfc2hyaW5rLmNhbGwodGhpcywgbmV3U2l6ZSwgaGVhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbn07XG5cbi8qXG4gKiBSZXNldHMgdGhlIHZpZXcgYnVmZmVyIGJhY2sgdG8gemVybyAoZGF0YSBhbmQgdmlldylcbiAqXG4gKiBAcmV0dXJuczogbGlzdCBvZiB2aWV3IGl0ZW1zO1xuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyKCkge1xuICAgIHZhciBpblZpZXdJdGVtcyA9IHRoaXMudmlldy5zbGljZSgwKTsgLy8gbWFrZSBhIGNvcHlcblxuICAgIC8vIERvIHRoaXMgaW4gcGxhY2UgdG8gYmUgZnJpZW5kbHkgdG8gbGlicmFyaWVzIChSaXZldHMgZm9yIGV4YW1wbGUpXG4gICAgLy8gdGhhdCBiaW5kIHRvIG9ic2VydmUgY2hhbmdlc1xuICAgIHRoaXMudmlldy5zcGxpY2UoMCwgTnVtYmVyLk1BWF9WQUxVRSk7XG4gICAgdGhpcy5kYXRhLnNwbGljZSgwLCBOdW1iZXIuTUFYX1ZBTFVFKTtcblxuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IC0xO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG5cbiAgICByZXR1cm4gaW5WaWV3SXRlbXM7XG59O1xuXG4vKlxuICogTG9jYXRlcyBhbiBpdGVtIGluIHRoZSB2aWV3IGJ5IGl0cyBpbmRleCBpbiBkYXRhIGlmIGl0IGV4aXN0c1xuICpcbiAqIEBwYXJhbSBpZHggIC0gSW5kZXggaW4gdGhlIGRhdGEgYXJyYXlcbiAqXG4gKiBAcmV0dXJucyAgICAtIEluZGV4IGluIHRoZSB2aWV3IGlmIGl0IGlzIGZvdW5kIG9yIC0xIGlmIG5vdFxuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5maW5kRGF0YUluZGV4SW5WaWV3ID0gZnVuY3Rpb24gZmluZERhdGFJbmRleEluVmlldyhpZHgpIHtcbiAgICB2YXIgdmlldyA9IHRoaXMudmlldztcbiAgICB2YXIgbGVuICA9IHZpZXcubGVuZ3RoO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBpZih2aWV3W2ldLmlkeCA9PT0gaWR4KSB7XG4gICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAtMTtcbn07XG5cbi8qXG4gKiBSZW1vdmVzIGFuIGVudHJ5IGZyb20gZGF0YSBhbmQgYWRqdXN0cyB0aGUgdmlldyBpZiBuZWNlc3NhcnlcbiAqXG4gKiBAcGFyYW0gaWR4ICAgLSBpbmRleCBvZiB0aGUgaXRlbSB0byBiZSByZW1vdmVkXG4gKlxuICogQHJldHVybnMge1xuICogICAgICBuZXdJblZpZXc6ICAgSWYgYSBkYXRhIGl0ZW0gd2FzIG1vdmVkIGludG8gdGhlIHZpZXcgYXMgYSByZXN1bHQgb2YgcmVtb3ZpbmcgYW4gaXRlbSwgYW4gYXJyYXlcbiAqICAgICAgICAgICAgICAgICAgIGNvbnRhaW5pbmcgdGhlIG5ld2x5IGFkZGVkIGl0ZW0uXG4gKiAgICAgIHJlbW92ZWQ6ICAgICBJZiB0aGUgdmlldyBzaXplIHdhcyBtb2RpZmllZCBhcyBhIHJlc3VsdCBvZiB0aGUgcmVtb3ZhbCwgYW4gYXJyYXkgY29udGFpbmluZ1xuICogICAgICAgICAgICAgICAgICAgdGhlIHJlbW92ZWQgaXRlbS5cbiAqICAgICAgdXBkYXRlZDogICAgIGxpc3Qgb2YgZGF0YSBpdGVtcyB0aGF0IGNoYW5nZWQgcG9zaXRpb25zIHdpdGhpbiB0aGUgdmlldy5cbiAqIH1cbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKGlkeCkge1xuICAgIC8vdmFyIGlkeFRvUmVtb3ZlICA9IGZhbHNlO1xuICAgIHZhciBoZWFkICAgICAgICAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHRhaWwgICAgICAgICA9IHRoaXMudGFpbDtcbiAgICB2YXIgdmlldyAgICAgICAgID0gdGhpcy52aWV3O1xuICAgIHZhciBkYXRhICAgICAgICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIHZpZXdJZHgsIGZyb20sIHRvLCByZXNldFZpZXdJZHggPSBmYWxzZTtcblxuICAgIHZhciByZXRWYWwgPSB7XG4gICAgICAgIG5ld0luVmlldzogW10sXG4gICAgICAgIHJlbW92ZWQ6ICAgW10sXG4gICAgICAgIHVwZGF0ZWQ6ICAgW11cbiAgICB9O1xuXG4gICAgdmFyIGFkZGVkLCByZW1vdmVkLCBpO1xuXG4gICAgaWR4ID0gK2lkeDsgLy8gTWFrZSBzdXJlIGl0IGlzIGEgbnVtYmVyXG5cbiAgICAvLyBJZiBpZHggPj0gdGhlIHRvdGFsIG51bWJlciBvZiBpdGVtcyBpbiB0aGUgbGlzdCwgdGhyb3cgYW4gZXJyb3JcbiAgICBpZihpZHggPj0gdGhpcy5kYXRhLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbmRleCBvdXQgb2YgYm91bmRzXCIpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBpdCBmcm9tIGl0ZW1zXG4gICAgdGhpcy5kYXRhLnNwbGljZShpZHgsIDEpO1xuXG4gICAgLy8gSWYgZ3JlYXRlciB0aGFuIHRoZSB0YWlsIElEWCwgaXQgaXMgbm90IGluIHRoZSB2aWV3IGFuZCBubyBhZGp1c3RtZW50c1xuICAgIC8vIGFyZSBuZWNlc3NhcnkgdG8gYW55IHZpZXcgaXRlbXMuXG4gICAgaWYoaWR4ID4gdGhpcy52aWV3W3RoaXMudGFpbF0uaWR4KSB7XG4gICAgICAgIHJldHVybiByZXRWYWw7XG4gICAgfVxuXG4gICAgLy8gSWYgbGVzcyB0aGFuIHRoZSBoZWFkIElEWCwgaXQgaXMgbm90IGluIHRoZSB2aWV3LCBidXQgYWxsIHZpZXcgaXRlbXNcbiAgICAvLyBuZWVkIHRvIGJlIGFkanVzdGVkIGJhY2sgYnkgb25lIHRvIHJlZmVyZW5jZSB0aGUgY29ycmVjdCBkYXRhIGluZGV4XG4gICAgLy9cbiAgICAvLyBOZWVkIHRvIHRoaW5rIGFib3V0IHdoZXRoZXIgYW55dGhpbmcgd2FzIHJlYWxseSB1cGRhdGVkIGhlcmUuICBJZHggaXNcbiAgICAvLyBtb3N0bHkgYW4gaW50ZXJuYWwgaW1wbGVtZW50YXRpb24gZGV0YWlsIGFuZCB0aGF0IGlzIGFsbCB0aGF0IGhhcyBiZWVuXG4gICAgLy8gdXBkYXRlZCBpbiB0aGlzIGNhc2UuXG4gICAgaWYoaWR4IDwgdmlld1toZWFkXS5pZHgpIHtcbiAgICAgICAgdmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIGl0ZW0uaWR4ID0gaXRlbS5pZHggLSAxO1xuICAgICAgICAgICAgcmV0VmFsLnVwZGF0ZWQucHVzaChpdGVtKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJldFZhbDtcbiAgICB9XG5cbiAgICBmcm9tID0gdmlld0lkeCA9IHRoaXMuZmluZERhdGFJbmRleEluVmlldyhpZHgpO1xuICAgIGlmKHZpZXdJZHggPT09IGhlYWQpIHtcbiAgICAgICAgaWYoaGVhZCA9PT0gMCkge1xuICAgICAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICAgICAgfSBlbHNlIGlmKGhlYWQgPT09IHZpZXcubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gMDtcbiAgICAgICAgICAgIHJlc2V0Vmlld0lkeCA9IHRydWU7IC8vIHZpZXdJZHggbmVlZHMgdG8gYmUgc2V0IGF0IDAgc2luY2UgaXQgd2FzIHJlbW92ZWQgZnJvbSB0aGUgdGFpbFxuICAgICAgICAgICAgdG8gPSB0YWlsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdG8gPSB0YWlsICsgdmlldy5sZW5ndGggLSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPT09IHRhaWwpIHtcbiAgICAgICAgLy8gTm9uZSBvZiB0aGVzZSByZXF1aXJlIG1vZGlmeWluZyBpZHggLSB0aGUgbG9vcCB0byB1cGRhdGUgaWR4IHdpbGwgbmV2ZXIgYmUgZW50ZXJlZFxuICAgICAgICBpZih0YWlsID09PSB2aWV3Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIH0gZWxzZSBpZih0YWlsID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB2aWV3Lmxlbmd0aCAtIDI7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSAwO1xuICAgICAgICAgICAgdG8gPSAtMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGhpcy50YWlsIC0gMTtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IGhlYWQgLSAxO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKHZpZXdJZHggPCBoZWFkICYmIHZpZXdJZHggPCB0YWlsKSB7XG4gICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIHRoaXMuaGVhZCA9IGhlYWQgLSAxO1xuICAgIH0gZWxzZSBpZih2aWV3SWR4ID4gaGVhZCAmJiB2aWV3SWR4IDwgdGFpbCkge1xuICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgIH0gZWxzZSBpZih2aWV3SWR4ID4gaGVhZCAmJiB2aWV3SWR4ID4gdGFpbCkge1xuICAgICAgICB0byA9IHRhaWwgKyB2aWV3Lmxlbmd0aCAtIDE7XG4gICAgfVxuXG4gICAgdGhpcy5zaXplID0gdGhpcy5zaXplIC0gMTtcbiAgICByZW1vdmVkID0gdmlldy5zcGxpY2Uodmlld0lkeCwgMSk7XG5cbiAgICB2aWV3SWR4ID0gcmVzZXRWaWV3SWR4ID8gMCA6IHZpZXdJZHg7XG4gICAgZm9yKGkgPSB2aWV3SWR4OyBpIDw9IHRvOyArK2kpIHtcbiAgICAgICAgLS12aWV3W2kgJSB2aWV3Lmxlbmd0aF0uaWR4O1xuICAgICAgICByZXRWYWwudXBkYXRlZC5wdXNoKHZpZXdbaSAlIHZpZXcubGVuZ3RoXSk7XG4gICAgfVxuXG4gICAgaWYoZGF0YS5sZW5ndGggPiB2aWV3Lmxlbmd0aCkge1xuICAgICAgICBhZGRlZCA9IHRoaXMucmVzaXplKHZpZXcubGVuZ3RoICsgMSk7XG4gICAgfVxuXG4gICAgcmV0VmFsLnJlbW92ZWQucHVzaC5hcHBseShyZXRWYWwucmVtb3ZlZCwgcmVtb3ZlZCk7XG4gICAgcmV0VmFsLm5ld0luVmlldy5wdXNoLmFwcGx5KHJldFZhbC5uZXdJblZpZXcsIGFkZGVkKTtcbiAgICByZXR1cm4gcmV0VmFsO1xufTtcblxuLypcbiAqIEl0ZXJhdGVzIHRocm91Z2ggYWxsIGl0ZW1zIGN1cnJlbnRseSBpbiB0aGUgY2lyY3VsYXIgYnVmZmVyIHN0YXJ0aW5nIGF0IHRoZSBsb2dpY2FsXG4gKiBmaXJzdCBpdGVtIHJhdGhlciB0aGFuIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHZpZXcgYXJyYXkuICBUaGUgY2FsbGJhY2sgc2lnbmF0dXJlXG4gKiBpcyBzaW1pbGFyIHRvIEFycmF5LmZvckVhY2gsIGhvd2V2ZXIgYm90aCB0aGUgcmF3IGluZGV4IGFuZCB0aGUgbG9naWNhbCBpbmRleCBhcmVcbiAqIHBhc3NlZC5cbiAqXG4gKiBjYWxsYmFjayBpcyBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM6XG4gKlxuICogICAgICB0aGUgdmlldyBpdGVtXG4gKiAgICAgIHRoZSB2aWV3IGl0ZW1zIGxvZ2ljYWwgaW5kZXhcbiAqICAgICAgdGhlIHZpZXcgaXRlbXMgcGh5c2ljYWwgaW5kZXhcbiAqICAgICAgdGhlIHZpZXdcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuZm9yRWFjaEluVmlldyA9IGZ1bmN0aW9uIGZvckVhY2hJblZpZXcoY2IsIHVzZUFzVGhpcykge1xuICAgIHZhciB2aWV3ICA9IHRoaXMudmlldztcbiAgICB2YXIgbGVuICAgPSB2aWV3Lmxlbmd0aDtcbiAgICB2YXIgaGVhZCAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHRhaWwgID0gdGhpcy50YWlsO1xuICAgIHZhciB0byAgICA9IHRhaWwgPCBoZWFkID8gdGFpbCArIGxlbiA6IHRhaWw7XG4gICAgdmFyIGksIGN1ckl0ZW0sIHJlYWxJZHg7XG5cbiAgICB1c2VBc1RoaXMgPSB1c2VBc1RoaXMgfHwgdGhpcztcblxuICAgIGZvcihpID0gaGVhZDsgaSA8PSB0bzsgKytpKSB7XG4gICAgICAgIHJlYWxJZHggPSBpICUgbGVuO1xuICAgICAgICBjdXJJdGVtID0gdmlld1tyZWFsSWR4XTtcblxuICAgICAgICBjYi5jYWxsKHVzZUFzVGhpcywgY3VySXRlbSwgaSAtIGhlYWQsIHJlYWxJZHgsIHZpZXcpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmlld0J1ZmZlcjtcbiJdfQ==
(1)
});
