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
LiteList.VERSION = '0.4.4';


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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvbGl0ZWxpc3QuanMiLCIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvc3JjL3ZpZXdidWZmZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgVmlld0J1ZmZlciA9IHJlcXVpcmUoJy4vdmlld2J1ZmZlcicpO1xuXG4vKlxuICogTGl0ZUxpc3RcbiAqXG4gKiBvcHRzOiB7XG4gKiAgaXRlbVdpZHRoICAgICAgIDogT3B0aW9uYWwgLSB3aWR0aCBvZiBlYWNoIGl0ZW0uICBJZiBub3QgcHJvdmlkZSBvbmUgaXRlbSBwZXIgcm93IGlzIGFzc3VtZWRcbiAqICBpdGVtSGVpZ2h0ICAgICAgOiBSZXF1aXJlZCAtIGhlaWdodCBvZiBlYWNoIGl0ZW0uXG4gKiAgbWFyZ2luICAgICAgICAgIDogT3B0aW9uYWwgLSBtYXJnaW4vZ3V0dGVycyBmb3IgdGhlIGl0ZW1zLiAgRGVmYXVsdHMgdG86IHsgeDogMCwgeTogMCB9O1xuICogIHNjcm9sbFZpZXcgICAgICA6IFJlcXVpcmVkIC0gcXVlcnkgc2VsZWN0b3IgZm9yIHRoZSBzY3JvbGxhYmxlIGNvbnRhaW5lclxuICogIGl0ZW1zQ29udGFpbmVyICA6IE9wdGlvbmFsIC0gcXVlcnkgc2VsZWN0b3IgY29udGFpbmVyIG9mIHRoZSBpdGVtcy4gIERlZmF1bHRzIHRvIHRoZSBmaXJzdCBjaGlsZCBvZiBzY3JvbGxWaWV3XG4gKiAgZGVsYXlCaW5kICAgICAgIDogT3B0aW9uYWwgLSBpZiB0cnVlIHdpbGwgd2FpdCBmb3IgYSBjYWxsIHRvIGxpdGVMaXN0LmJpbmQoKSB0byBhdHRhY2ggYW55IGhhbmRsZXJzXG4gKlxuICogIC8vIFRoZSBuZXh0IHR3byBhcmUgcmVxdWlyZWQgZm9yIGEgdmFuaWxsYSBqYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIHRvIGJlIGZ1bmN0aW9uYWwuICBMaXN0TGlzdCB3YXNcbiAqICAvLyB3cml0dGVuIHRvIHdvcmsgd2l0aCB0aGUgUml2ZXRzIGxpYnJhcnkgd2hpY2ggcHJvdmlkZXMgdGhpcyBmdW5jdGlvbmFsaXR5IGFzIHdlbGwuICBJbiB0aGF0IGNhc2UsXG4gKiAgLy8gaXQgaXMgb3B0aW9uYWwuICBpLmUuIHRoZSBMaXRlTGlzdCB3aWxsIGNvbnRpbnVlIG9uIGlmIHRoZXNlIGFyZSBub3QgcHJvdmlkZWQuXG4gKiAgaXRlbVRlbXBsYXRlICAgIDogUmVxdWlyZWQgLSBET00gbm9kZSB0aGF0IHdpbGwgYmUgY2xvbmVkIGFzIGEgdGVtcGxhdGUgZm9yIGVhY2ggaXRlbS5cbiAqICBkYXRhU291cmNlICAgICAgOiBSZXF1aXJlZCAtIEltcGxlbWVudGF0aW9uIG9mIHRoZSBkYXRhU291cmNlIGNvbnRyYWN0IChzZWUgYmVsb3cgZm9yIG1vcmUgZGV0YWlscykuXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIExpdGVMaXN0KG9wdHMpIHtcbiAgICB0aGlzLnZpZXdCdWZmZXIgICAgICA9IG5ldyBWaWV3QnVmZmVyKCk7XG4gICAgdGhpcy5pdGVtV2lkdGggICAgICAgPSBvcHRzLml0ZW1XaWR0aCB8fCAwO1xuICAgIHRoaXMuaXRlbUhlaWdodCAgICAgID0gb3B0cy5pdGVtSGVpZ2h0O1xuICAgIHRoaXMubWFyZ2luICAgICAgICAgID0gb3B0cy5tYXJnaW4gfHwgeyB4OiAwLCB5OiAwIH07XG4gICAgdGhpcy5kYXRhU291cmNlICAgICAgPSBvcHRzLmRhdGFTb3VyY2UgfHwgZmFsc2U7XG4gICAgdGhpcy5pdGVtVGVtcGxhdGUgICAgPSBvcHRzLml0ZW1UZW1wbGF0ZSB8fCBmYWxzZTtcbiAgICB0aGlzLnNjcm9sbFRvcCAgICAgICA9IDA7XG4gICAgdGhpcy5kaXJ0eVJlc2l6ZSAgICAgPSB0cnVlO1xuICAgIHRoaXMudGlja2luZyAgICAgICAgID0gZmFsc2U7XG5cbiAgICAvLyBWaWV3IE1ldHJpY3NcbiAgICB0aGlzLmNsaWVudEhlaWdodCAgICA9IDA7XG4gICAgdGhpcy5jbGllbnRXaWR0aCAgICAgPSAwO1xuICAgIHRoaXMucm93c1BlclBhZ2UgICAgID0gMDtcbiAgICB0aGlzLml0ZW1zUGVyUm93ICAgICA9IDA7XG4gICAgdGhpcy5pdGVtc1BlclBhZ2UgICAgPSAwO1xuICAgIHRoaXMubWF4QnVmZmVyICAgICAgID0gMDtcbiAgICB0aGlzLmhlaWdodCAgICAgICAgICA9IDA7XG5cbiAgICAvLyBHZXQgdGhlIGNvbnRhaW5lciBlbGVtZW50c1xuICAgIHRoaXMudmlldyAgICAgICAgICAgID0gb3B0cy5zY3JvbGxWaWV3O1xuICAgIHRoaXMuaXRlbXNDb250YWluZXIgID0gb3B0cy5pdGVtc0NvbnRhaW5lciB8fCBmYWxzZTtcblxuICAgIC8vIElmIGl0IGlzIGEgc3RyaW5nLCBpdCBzaG91bGQgYmUgYSBxdWVyeSBzZWxlY3RvciAtIG90aGVyd2lzZSB3ZSBhcmUgZXhwZWN0aW5nIGFuIGVsZW1lbnQuXG4gICAgdGhpcy52aWV3ICAgICAgICAgICAgPSAodHlwZW9mIHRoaXMudmlldyAgICAgICAgICAgPT09ICdzdHJpbmcnIHx8IHRoaXMudmlldyBpbnN0YW5jZW9mIFN0cmluZykgICAgICAgICAgID8gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLnZpZXcpICAgICAgICAgICA6IHRoaXMudmlldztcbiAgICB0aGlzLml0ZW1zQ29udGFpbmVyICA9ICh0eXBlb2YgdGhpcy5pdGVtc0NvbnRhaW5lciA9PT0gJ3N0cmluZycgfHwgdGhpcy5pdGVtc0NvbnRhaW5lciBpbnN0YW5jZW9mIFN0cmluZykgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG9wdHMuaXRlbXNDb250YWluZXIpIDogdGhpcy5pdGVtc0NvbnRhaW5lcjtcblxuICAgIC8vIEtlZXAgdHJhY2sgb2YgYSB1bmlxdWUgaWQgZm9yIHZpZXdJdGVtcyAtIGFsbG93cyBUaGlzIGlzIHBhc3NlZCB0b1xuICAgIC8vIGRhdGFzb3VyY2UgcHJvdmlkZXJzIHRvIGFpZCBpbiB0cmFja2luZy5cbiAgICB0aGlzLl9pZCA9IDA7XG5cbiAgICAvLyBJZiBub3QgcGFzc2VkIGEgcGFnZSBzZWxlY3RvciwgYXNzdW1lIGl0J3MgdGhlIGZpcnN0IGNoaWxkXG4gICAgaWYoIXRoaXMuaXRlbXNDb250YWluZXIpIHtcbiAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lciA9IHRoaXMudmlldy5jaGlsZHJlblswXTtcbiAgICB9XG5cbiAgICAvLyBfdXBkYXRlVmlldyBpcyB1c2VkIGluIHJlcXVlc3RBbmltYXRpb25GcmFtZSAtIGJpbmQgaXQgdG8gdGhpc1xuICAgIHRoaXMuX3VwZGF0ZVZpZXcgPSB0aGlzLl91cGRhdGVWaWV3LmJpbmQodGhpcyk7XG5cbiAgICAvLyBJbnZva2VkIGFzIGEgcmVzdWx0IG9mIGV2ZW50IGxpc3RlbmVycyAtIGJpbmQgdGhlbSB0byB0aGlzXG4gICAgdGhpcy5fc2Nyb2xsSGFuZGxlciA9IHRoaXMuX3Njcm9sbEhhbmRsZXIuYmluZCh0aGlzKTtcbiAgICB0aGlzLl9yZXNpemVIYW5kbGVyID0gdGhpcy5fcmVzaXplSGFuZGxlci5iaW5kKHRoaXMpO1xuXG4gICAgLy8gRW5zdXJlIHZhbGlkIHZpZXcgbWV0cmljc1xuICAgIHRoaXMuX2NhbGNWaWV3TWV0cmljcygpO1xuXG4gICAgLy8gYmluZCBhbnkgZXZlbnQgaGFuZGxlcnMgbm93IGlmIG5vdCBhc2tlZCB0byBkZWxheVxuICAgIGlmKCFvcHRzLmRlbGF5QmluZCkge1xuICAgICAgICB0aGlzLmJpbmQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBrbm93IGFib3V0IFNjcm9sbCwgYXR0YWNoIGl0IG5vd1xuICAgIHRoaXMuc2Nyb2xsID0gTGl0ZUxpc3QuU2Nyb2xsID8gbmV3IExpdGVMaXN0LlNjcm9sbChvcHRzLnNjcm9sbFZpZXcsIHRoaXMuX3Njcm9sbEhhbmRsZXIpIDogZmFsc2U7XG5cbiAgICAvLyBLaWNrcyBvZmYgYSBsYXlvdXQgKGRpcnR5UmVzaXplIGRlZmF1bHRzIHRvIHRydWUpXG4gICAgLy8gVGhpcyB3aWxsIGxheW91dCBldmVyeXRoaW5nIG5pY2VseSBmaWxsaW5nIGFsbCBjb2x1bW5zXG4gICAgdGhpcy5fY2FsY0RvY0hlaWdodCgpO1xuICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG59XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fY2FsY1ZpZXdNZXRyaWNzID0gZnVuY3Rpb24gY2FsY1ZpZXdNZXRyaWNzKCkge1xuICAgIHRoaXMuY2xpZW50SGVpZ2h0ICAgID0gdGhpcy52aWV3LmNsaWVudEhlaWdodDtcbiAgICB0aGlzLmNsaWVudFdpZHRoICAgICA9IHRoaXMudmlldy5jbGllbnRXaWR0aDtcbiAgICB0aGlzLnJvd3NQZXJQYWdlICAgICA9IE1hdGguY2VpbCAodGhpcy5jbGllbnRIZWlnaHQgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpO1xuICAgIHRoaXMuaXRlbXNQZXJSb3cgICAgID0gdGhpcy5pdGVtV2lkdGggPyBNYXRoLmZsb29yKHRoaXMuY2xpZW50V2lkdGggIC8gKHRoaXMuaXRlbVdpZHRoICArIHRoaXMubWFyZ2luLngpKSA6IDE7XG4gICAgdGhpcy5pdGVtc1BlclBhZ2UgICAgPSB0aGlzLnJvd3NQZXJQYWdlICogdGhpcy5pdGVtc1BlclJvdztcbiAgICB0aGlzLm1heEJ1ZmZlciAgICAgICA9IHRoaXMuaXRlbXNQZXJQYWdlICogMztcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fY2FsY0RvY0hlaWdodCA9IGZ1bmN0aW9uIGNhbGNEb2NIZWlnaHQoKSB7XG4gICAgdmFyIHJvdyA9IE1hdGguY2VpbCh0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGgvdGhpcy5pdGVtc1BlclJvdyk7XG4gICAgdmFyIG5ld0hlaWdodCA9IHJvdyAqIHRoaXMuaXRlbUhlaWdodCArIHJvdyAqIHRoaXMubWFyZ2luLnk7XG5cbiAgICBpZihuZXdIZWlnaHQgIT09IHRoaXMuaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuaXRlbXNDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gbmV3SGVpZ2h0ICsgXCJweFwiO1xuICAgICAgICB0aGlzLmhlaWdodCA9IG5ld0hlaWdodDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaGVpZ2h0O1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9pbml0SW5WaWV3SXRlbSA9IGZ1bmN0aW9uIF9pbml0SW5WaWV3SXRlbShpdGVtKSB7XG4gICAgaXRlbS5pZCAgID0gdGhpcy5faWQrKztcblxuICAgIC8vIElmIHdlIHdlcmUgZ2l2ZW4gYW4gaXRlbSB0ZW1wbGF0ZSwgd2UgbmVlZCB0byBhZGQgYSBjbG9uZVxuICAgIC8vIHRvIHRoZSBkb21cbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSkge1xuICAgICAgICB2YXIgbmV3Tm9kZSA9IHRoaXMuaXRlbVRlbXBsYXRlLmNsb25lTm9kZSh0cnVlKTtcblxuICAgICAgICBpZihuZXdOb2RlIGluc3RhbmNlb2Yod2luZG93LkRvY3VtZW50RnJhZ21lbnQpKSB7XG4gICAgICAgICAgICBuZXdOb2RlID0gbmV3Tm9kZS5jaGlsZE5vZGVzWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5hcHBlbmRDaGlsZChuZXdOb2RlKTtcbiAgICAgICAgaXRlbS5lbCA9IG5ld05vZGU7XG4gICAgICAgIGlmKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UuYmluZCkge1xuICAgICAgICAgICAgdGhpcy5kYXRhU291cmNlLmJpbmQoaXRlbS5pZCwgbmV3Tm9kZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaXRlbTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fc3luY1ZpZXdJdGVtID0gZnVuY3Rpb24gc3luY1ZpZXdJdGVtKHZpZXdJdGVtKSB7XG4gICAgLy8gSWYgd2UgaGF2ZSBhIGRhdGFTb3VyY2VcbiAgICBpZih0aGlzLmRhdGFTb3VyY2UgJiYgdGhpcy5kYXRhU291cmNlLnN5bmMpIHtcbiAgICAgICAgdGhpcy5kYXRhU291cmNlLnN5bmModmlld0l0ZW0uaWQsIHZpZXdJdGVtLmVsLCB2aWV3SXRlbS5pZHgsIHZpZXdJdGVtLmRhdGEpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcG9zaXRpb25WaWV3SXRlbSA9IGZ1bmN0aW9uIHBvc2l0aW9uVmlld0l0ZW0odmlld0l0ZW0sIGZvcmNlKSB7XG4gICAgdmFyIGlkeCAgPSB2aWV3SXRlbS5pZHg7XG4gICAgdmFyIHJvdyAgPSBNYXRoLmZsb29yKGlkeC90aGlzLml0ZW1zUGVyUm93KTtcbiAgICB2YXIgY29sICA9IChpZHggJSB0aGlzLml0ZW1zUGVyUm93KTtcbiAgICB2YXIgdG9wICA9IHJvdyAqIHRoaXMuaXRlbUhlaWdodCArIHJvdyAqIHRoaXMubWFyZ2luLnk7XG4gICAgdmFyIGxlZnQgPSBjb2wgKiB0aGlzLml0ZW1XaWR0aCAgKyBjb2wgKiB0aGlzLm1hcmdpbi54O1xuXG4gICAgLy8gQXZvaWQgdHJpZ2dlcmluZyB1cGRhdGUgaWYgdGhlIHZhbHVlIGhhc24ndCBjaGFuZ2VkXG4gICAgaWYoZm9yY2UgfHwgKHZpZXdJdGVtLnRvcCAgIT09IHRvcCkgKSB7XG4gICAgICAgIHZpZXdJdGVtLnRvcCAgPSB0b3A7XG5cbiAgICAgICAgaWYodmlld0l0ZW0uZWwpIHtcbiAgICAgICAgICAgIHZpZXdJdGVtLmVsLnN0eWxlLnRvcCA9IHRvcCArIFwicHhcIjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmKGZvcmNlIHx8ICh2aWV3SXRlbS5sZWZ0ICE9PSBsZWZ0KSkge1xuICAgICAgICB2aWV3SXRlbS5sZWZ0ID0gbGVmdDtcblxuICAgICAgICBpZih2aWV3SXRlbS5lbCkge1xuICAgICAgICAgICAgdmlld0l0ZW0uZWwuc3R5bGUubGVmdCA9IGxlZnQgKyBcInB4XCI7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX2Vuc3VyZVZpc2libGUgPSBmdW5jdGlvbiBfZW5zdXJlVmlzaWJsZShkb25lKSB7XG4gICAgdmFyIHBlcmNlbnRJblZpZXdTdGFydCA9ICgodGhpcy5zY3JvbGxUb3ApIC8gKHRoaXMuaGVpZ2h0KSk7XG4gICAgdmFyIHBlcmNlbnRJblZpZXdFbmQgICA9ICgodGhpcy5zY3JvbGxUb3AgKyB0aGlzLmNsaWVudEhlaWdodCkgLyAodGhpcy5oZWlnaHQpKTtcblxuICAgIHZhciBvbGRTdGFydCwgbmV3U3RhcnQsIG9sZEVuZCwgbmV3RW5kLCBpLCB2aWV3SXRlbTtcblxuICAgIGlmKHRoaXMuZGlyZWN0aW9uIDwgMCkge1xuICAgICAgICBvbGRFbmQgPSB0aGlzLnZpZXdCdWZmZXIudmlld1t0aGlzLnZpZXdCdWZmZXIudGFpbF0uaWR4O1xuICAgICAgICBuZXdFbmQgPSBNYXRoLmNlaWwgKHBlcmNlbnRJblZpZXdFbmQgICAqIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCk7XG5cbiAgICAgICAgZm9yIChpID0gb2xkRW5kOyBpID4gbmV3RW5kICsgdGhpcy5pdGVtc1BlclJvdzsgLS1pKSB7XG4gICAgICAgICAgICB2aWV3SXRlbSA9IHRoaXMudmlld0J1ZmZlci5zaGlmdCgtMSlbMF07XG5cbiAgICAgICAgICAgIGlmICh2aWV3SXRlbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbSh2aWV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYodGhpcy5kaXJlY3Rpb24gPiAwKSB7XG4gICAgICAgIG9sZFN0YXJ0ID0gdGhpcy52aWV3QnVmZmVyLnZpZXdbdGhpcy52aWV3QnVmZmVyLmhlYWRdLmlkeDtcbiAgICAgICAgbmV3U3RhcnQgPSBNYXRoLmZsb29yKHBlcmNlbnRJblZpZXdTdGFydCAqIHRoaXMudmlld0J1ZmZlci5kYXRhLmxlbmd0aCk7XG5cbiAgICAgICAgZm9yKGkgPSBvbGRTdGFydDsgaSA8IG5ld1N0YXJ0IC0gdGhpcy5pdGVtc1BlclJvdzsgKytpKSB7XG4gICAgICAgICAgICB2aWV3SXRlbSA9IHRoaXMudmlld0J1ZmZlci5zaGlmdCgxKVswXTtcblxuICAgICAgICAgICAgaWYodmlld0l0ZW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zeW5jVmlld0l0ZW0odmlld0l0ZW0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0odmlld0l0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZG9uZSgpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLl9yZXNpemUgPSBmdW5jdGlvbiBfcmVzaXplKGRvbmUpIHtcbiAgICB2YXIgbmV3SGVpZ2h0ICAgID0gdGhpcy52aWV3LmNsaWVudEhlaWdodDtcbiAgICB2YXIgbmV3V2lkdGggICAgID0gdGhpcy52aWV3LmNsaWVudFdpZHRoO1xuXG4gICAgdmFyIG5ld1Jvd3NQZXJQYWdlICAgICA9IE1hdGguY2VpbCAobmV3SGVpZ2h0IC8gKHRoaXMuaXRlbUhlaWdodCArIHRoaXMubWFyZ2luLnkpKTtcbiAgICB2YXIgbmV3SXRlbXNQZXJSb3cgICAgID0gdGhpcy5pdGVtV2lkdGggPyBNYXRoLmZsb29yKG5ld1dpZHRoICAvICh0aGlzLml0ZW1XaWR0aCAgKyB0aGlzLm1hcmdpbi54KSkgOiAxO1xuXG4gICAgdmFyIHJlbW92ZWQ7IC8vLCBpblZpZXdPYmo7XG4gICAgaWYobmV3Um93c1BlclBhZ2UgIT09IHRoaXMucm93c1BlclBhZ2UgfHwgbmV3SXRlbXNQZXJSb3cgIT09IHRoaXMuaXRlbXNQZXJSb3cpIHtcbiAgICAgICAgdGhpcy5fY2FsY1ZpZXdNZXRyaWNzKCk7XG4gICAgICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcblxuICAgICAgICB2YXIgcGVyY2VudEluVmlldyA9IHRoaXMuX2ZpcnN0VmlzaWJsZUl0ZW0gLyB0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGg7XG4gICAgICAgIHRoaXMuc2Nyb2xsVG9wID0gdGhpcy52aWV3LnNjcm9sbFRvcCA9IE1hdGguZmxvb3IodGhpcy5oZWlnaHQgKiBwZXJjZW50SW5WaWV3KTtcbiAgICAgICAgdmFyIG5ld0ZpcnN0VmlzaWJsZSA9IE1hdGguZmxvb3IodGhpcy5zY3JvbGxUb3AgLyAodGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpICogbmV3SXRlbXNQZXJSb3c7XG5cbiAgICAgICAgaWYgKHRoaXMudmlld0J1ZmZlci52aWV3Lmxlbmd0aCA+IHRoaXMubWF4QnVmZmVyKSB7XG4gICAgICAgICAgICByZW1vdmVkID0gdGhpcy52aWV3QnVmZmVyLnJlc2l6ZSh0aGlzLm1heEJ1ZmZlcik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGFTb3VyY2UgJiYgdGhpcy5kYXRhU291cmNlLnVuYmluZCkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbiAoaW5WaWV3SXRlbSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKGluVmlld0l0ZW0uaWQsIGluVmlld0l0ZW0uZWwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLml0ZW1zQ29udGFpbmVyLnJlbW92ZUNoaWxkKGluVmlld0l0ZW0uZWwpO1xuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudmlld0J1ZmZlci52aWV3Lmxlbmd0aCA8IHRoaXMubWF4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZpZXdCdWZmZXIucmVzaXplKE1hdGgubWluKHRoaXMubWF4QnVmZmVyLCB0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGgpKVxuICAgICAgICAgICAgICAgIC5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luaXRJblZpZXdJdGVtKGl0ZW0pO1xuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNoaWZ0QW10ID0gbmV3Rmlyc3RWaXNpYmxlIC0gdGhpcy52aWV3QnVmZmVyLnZpZXdbdGhpcy52aWV3QnVmZmVyLmhlYWRdLmlkeCAtIG5ld0l0ZW1zUGVyUm93O1xuICAgICAgICB0aGlzLnZpZXdCdWZmZXIuc2hpZnQoc2hpZnRBbXQpO1xuICAgICAgICB0aGlzLnZpZXdCdWZmZXIudmlldy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIGRvbmUoKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fdXBkYXRlVmlldyA9IGZ1bmN0aW9uIF91cGRhdGVWaWV3KCkge1xuICAgIHZhciBkb25lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX2ZpcnN0VmlzaWJsZUl0ZW0gPSBNYXRoLmZsb29yKHRoaXMuc2Nyb2xsVG9wIC8gKHRoaXMuaXRlbUhlaWdodCArIHRoaXMubWFyZ2luLnkpKSAqIHRoaXMuaXRlbXNQZXJSb3c7XG4gICAgICAgIHRoaXMuX2xhc3RWaXNpYmxlSXRlbSAgPSBNYXRoLmNlaWwgKCh0aGlzLnNjcm9sbFRvcCArIHRoaXMuY2xpZW50SGVpZ2h0KS8odGhpcy5pdGVtSGVpZ2h0ICsgdGhpcy5tYXJnaW4ueSkpICogdGhpcy5pdGVtc1BlclJvdztcblxuICAgICAgICB0aGlzLmRpcnR5UmVzaXplID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGlja2luZyAgICAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kaXJlY3Rpb24gICA9IDA7XG4gICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgaWYodGhpcy5kaXJ0eVJlc2l6ZSkge1xuICAgICAgICB0aGlzLl9yZXNpemUoZG9uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZW5zdXJlVmlzaWJsZShkb25lKTtcbiAgICB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3JlcXVlc3RUaWNrID0gZnVuY3Rpb24gcmVxdWVzdFRpY2soKSB7XG4gICAgaWYoIXRoaXMudGlja2luZykge1xuICAgICAgICB0aGlzLnRpY2tpbmcgPSB0cnVlO1xuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX3VwZGF0ZVZpZXcpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gcHVzaCgpIHtcbiAgICB2YXIgYXJncyAgICA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICB0aGlzLnZpZXdCdWZmZXIuZGF0YS5wdXNoLmFwcGx5KHRoaXMudmlld0J1ZmZlci5kYXRhLCBhcmdzKTtcblxuICAgIHZhciBuZXdJblZpZXcgPSB0aGlzLnZpZXdCdWZmZXIucmVzaXplKE1hdGgubWluKHRoaXMubWF4QnVmZmVyLCB0aGlzLnZpZXdCdWZmZXIuZGF0YS5sZW5ndGgpKTtcblxuICAgIG5ld0luVmlldy5mb3JFYWNoKGZ1bmN0aW9uKGluVmlld0RhdGEpIHtcbiAgICAgICAgdGhpcy5faW5pdEluVmlld0l0ZW0oaW5WaWV3RGF0YSk7XG4gICAgICAgIHRoaXMuX3N5bmNWaWV3SXRlbShpblZpZXdEYXRhKTtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25WaWV3SXRlbShpblZpZXdEYXRhLCB0cnVlKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcbiAgICB0aGlzLl9yZXF1ZXN0VGljaygpO1xufTtcblxuTGl0ZUxpc3QucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMuX3Njcm9sbEhhbmRsZXIpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMuX3Jlc2l6ZUhhbmRsZXIpO1xuXG4gICAgaWYodGhpcy5zY3JvbGwpIHsgdGhpcy5zY3JvbGwuYmluZCgpOyB9XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUudW5iaW5kID0gZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIHRoaXMudmlldy5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMuX3Njcm9sbEhhbmRsZXIpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMuX3Jlc2l6ZUhhbmRsZXIpO1xuXG4gICAgaWYodGhpcy5zY3JvbGwpIHsgdGhpcy5zY3JvbGwudW5iaW5kKCk7IH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyKCkge1xuICAgIHZhciBjYWxsVW5iaW5kID0gKHRoaXMuZGF0YVNvdXJjZSAmJiB0aGlzLmRhdGFTb3VyY2UudW5iaW5kKTtcblxuICAgIHRoaXMudmlldy5zY3JvbGxUb3AgPSB0aGlzLnNjcm9sbFRvcCA9IDA7XG5cbiAgICB2YXIgaXRlbXNJblZpZXcgPSB0aGlzLnZpZXdCdWZmZXIuY2xlYXIoKTtcblxuICAgIC8vIElmIHdlIHdlcmUgZ2l2ZW4gYW4gaXRlbSB0ZW1wbGF0ZSwgd2UgbmVlZCByZW1vdmUgYW55IG5vZGVzIHdlJ3ZlIGFkZGVkXG4gICAgaWYodGhpcy5pdGVtVGVtcGxhdGUpIHtcbiAgICAgICAgaXRlbXNJblZpZXcuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICBpZihpdGVtLmVsKSAgICB7IHRoaXMuaXRlbXNDb250YWluZXIucmVtb3ZlQ2hpbGQoaXRlbS5lbCk7IH1cbiAgICAgICAgICAgIGlmKGNhbGxVbmJpbmQpIHsgdGhpcy5kYXRhU291cmNlLnVuYmluZChpdGVtLmlkLCBpdGVtLmVsKTsgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGlmKHRoaXMuc2Nyb2xsKSB7IHRoaXMuc2Nyb2xsLnJlc2V0KCk7IH1cblxuICAgIHRoaXMuX2NhbGNEb2NIZWlnaHQoKTtcbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gZm9yRWFjaCgvKmZuLCB0aGlzQXJnKi8pIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5mb3JFYWNoLmFwcGx5KHRoaXMuaXRlbXMsIGFyZ3VtZW50cyk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuZm9yRWFjaEluVmlldyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnZpZXdCdWZmZXIuZm9yRWFjaEluVmlldy5hcHBseSh0aGlzLnZpZXdCdWZmZXIsIGFyZ3VtZW50cyk7XG59O1xuXG5cbkxpdGVMaXN0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiByZW1vdmUoc2VhcmNoSWR4KSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMudmlld0J1ZmZlci5yZW1vdmUoc2VhcmNoSWR4KTtcblxuICAgIHJlc3VsdC5uZXdJblZpZXcuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHRoaXMuX2luaXRJblZpZXdJdGVtKGl0ZW0pO1xuICAgICAgICB0aGlzLl9zeW5jVmlld0l0ZW0oaXRlbSk7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0oaXRlbSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICBpZih0aGlzLml0ZW1UZW1wbGF0ZSB8fCB0aGlzLmRhdGFTb3VyY2UpIHtcbiAgICAgICAgcmVzdWx0LnJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICBpZih0aGlzLmRhdGFTb3VyY2UgJiYgdGhpcy5kYXRhU291cmNlLnVuYmluZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YXNvdXJjZS51bmJpbmQoaXRlbS5pZCwgaXRlbS5lbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMuaXRlbVRlbXBsYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pdGVtc0NvbnRhaW5lci5yZW1vdmVDaGlsZChpdGVtLmVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgcmVzdWx0LnVwZGF0ZWQuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlld0l0ZW0oaXRlbSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9jYWxjRG9jSGVpZ2h0KCk7XG59O1xuXG5MaXRlTGlzdC5wcm90b3R5cGUuX3Njcm9sbEhhbmRsZXIgPSBmdW5jdGlvbiBzY3JvbGxIYW5kbGVyKC8qZXZ0Ki8pIHtcbiAgICB2YXIgc2Nyb2xsVG9wICAgPSB0aGlzLnZpZXcuc2Nyb2xsVG9wO1xuXG4gICAgaWYoc2Nyb2xsVG9wICE9PSB0aGlzLnNjcm9sbFRvcCkge1xuICAgICAgICB0aGlzLmRpcmVjdGlvbiAgPSBzY3JvbGxUb3AgPiB0aGlzLnNjcm9sbFRvcCA/IDEgOiAtMTtcbiAgICAgICAgdGhpcy5zY3JvbGxUb3AgID0gc2Nyb2xsVG9wO1xuICAgICAgICB0aGlzLl9yZXF1ZXN0VGljaygpO1xuICAgIH1cbn07XG5cbkxpdGVMaXN0LnByb3RvdHlwZS5fcmVzaXplSGFuZGxlciA9IGZ1bmN0aW9uIHJlc2l6ZUhhbmRsZXIoLypldnQqLykge1xuICAgIHRoaXMuZGlydHlSZXNpemUgPSB0cnVlO1xuICAgIHRoaXMuX3JlcXVlc3RUaWNrKCk7XG59O1xuXG4vLyBWZXJzaW9uLlxuTGl0ZUxpc3QuVkVSU0lPTiA9ICcwLjQuNCc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBMaXRlTGlzdDsiLCJcInVzZSBzdHJpY3RcIjtcblxuLypcbiAqIENpcmN1bGFyIGJ1ZmZlciByZXByZXNlbnRpbmcgYSB2aWV3IG9uIGFuIGFycmF5IG9mIGVudHJpZXMuXG4gKi9cbmZ1bmN0aW9uIFZpZXdCdWZmZXIoZGF0YSwgaW5pdGlhbFNpemUpIHtcbiAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB0aGlzLnNpemUgPSAwO1xuICAgIHRoaXMuZGF0YSA9IGRhdGEgfHwgW107XG4gICAgdGhpcy52aWV3ID0gW107XG5cbiAgICAvLyBTcGVjaWFsIGNhc2UgaGVyZVxuICAgIGlmKGluaXRpYWxTaXplKSB7IHRoaXMucmVzaXplKGluaXRpYWxTaXplKTsgfVxufVxuXG4vKlxuICogU2hyaW5rIHRoZSB2aWV3IGJ1ZmZlclxuICpcbiAqIEBwYXJhbSBuZXdTaXplXG4gKiBAcGFyYW0gaGVhZDogICAgIGlmIHRydWUsIHdpbGwgc2hyaW5rIHJlbGF0aXZlIHRvIGhlYWQuXG4gKlxuICogQHJldHVybnM6IEFycmF5IG9mIHJlbW92ZWQgdmlldyBidWZmZXIgZW50cmllc1xuICovXG5mdW5jdGlvbiBfc2hyaW5rKG5ld1NpemUsIGhlYWQpIHtcbiAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgIHZhciBkZWx0YSA9IFtdO1xuICAgIHZhciB2aWV3ICA9IHRoaXMudmlldztcbiAgICB2YXIgc2hyaW5rYWdlID0gdmlldy5sZW5ndGggLSBuZXdTaXplO1xuICAgIHZhciBzcGxpY2VkO1xuXG4gICAgaWYobmV3U2l6ZSA+PSB2aWV3Lmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gc2hyaW5rIHRvIGEgc2l6ZSBsYXJnZXIgdGhhbiB0aGUgY3VycmVudCBzaXplXCIpO1xuICAgIH1cblxuICAgIHdoaWxlKHNocmlua2FnZSAmJiB2aWV3Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3BsaWNlZCA9IHZpZXcuc3BsaWNlKGhlYWQgPyB0aGlzLmhlYWQgOiB0aGlzLnRhaWwsIDEpO1xuICAgICAgICBkZWx0YS5wdXNoKHNwbGljZWRbMF0pO1xuXG4gICAgICAgIC8vIFdoZW4gc2hyaW5raW5nIGZyb20gaGVhZCwgdGhlIG9ubHkgdGltZSB0aGUgaGVhZHMgcmVzdWx0aW5nIHZhbHVlIGNoYW5nZXMgaXNcbiAgICAgICAgLy8gaWYgaGVhZCBpcyBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0LiAgU28gaXQgaXMgc2FmZSB0byB0YWtlIHRoZSBtb2R1bG8gb2YgaGVhZFxuICAgICAgICAvLyBhZ2FpbnN0IHRoZSBuZXcgdmlldyBsZW5ndGg7XG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRhaWwgaXMgdGhlbiB0aGUgbW9kdWxvIG9mIGhlYWQgKyAxO1xuICAgICAgICBpZihoZWFkKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLmhlYWQgJSB2aWV3Lmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9ICh0aGlzLmhlYWQgKyAxKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB9IGVsc2UgaWYodGhpcy50YWlsIDwgdGhpcy5oZWFkKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwgLSAxO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkIC0gMTtcblxuICAgICAgICAgICAgaWYodGhpcy50YWlsIDwgMCkgeyB0aGlzLnRhaWwgPSB2aWV3Lmxlbmd0aCAtIDE7IH1cbiAgICAgICAgfSBlbHNlIGlmKHRoaXMudGFpbCA+IHRoaXMuaGVhZCkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdGhpcy50YWlsIC0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZXkgYXJlIGVxdWFsIHdoZW4gYm90aCBhcmUgemVyb1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAtLXNocmlua2FnZTtcbiAgICB9XG5cbiAgICBpZih2aWV3Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB9XG5cbiAgICB0aGlzLnNpemUgPSB2aWV3Lmxlbmd0aDtcbiAgICByZXR1cm4gZGVsdGE7XG59XG5cbi8qXG4gKiBHcm93cyB0aGUgdmlldyBidWZmZXI6ICB0aGUgdmlldyBidWZmZXIgd2lsbCBncm93IGluIHRoZSByZXF1ZXN0ZWQgZGlyZWN0aW9uXG4gKiBhcyBtdWNoIGFzIGl0IGNhbi4gIFdoZW4gaXQgcmVhY2hlcyBhIGxpbWl0LCBpdCB3aWxsIHRyeSB0byBncm93IGluIHRoZSBvcHBvc2l0ZVxuICogZGlyZWN0aW9uIGFzIHdlbGwuXG4gKlxuICogQHBhcmFtIG5ld1NpemVcbiAqIEBwYXJhbSBoZWFkOiAgICAgaWYgdHJ1ZSwgd2lsbCBncm93IHJlbGF0aXZlIHRvIGhlYWRcbiAqXG4gKiBAcmV0dXJuczogQXJyYXkgb2YgbmV3bHkgaW5pdGlhbGl6ZWQgdmlldyBidWZmZXIgZW50cmllc1xuICovXG5mdW5jdGlvbiBfZ3JvdyhuZXdTaXplLCBoZWFkKSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgZGVsdGEgPSBbXTtcbiAgICB2YXIgdmlldyAgID0gdGhpcy52aWV3O1xuICAgIHZhciBkYXRhICAgPSB0aGlzLmRhdGE7XG4gICAgdmFyIGdyb3d0aCA9IG5ld1NpemUgLSB2aWV3Lmxlbmd0aDtcbiAgICB2YXIgbmV3RW50cnk7XG5cbiAgICBpZihuZXdTaXplID4gZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGdyb3cgdG8gYSBzaXplIGxhcmdlciB0aGFuIHRoZSBjdXJyZW50IGRhdGFzZXRcIik7XG4gICAgfVxuXG4gICAgaWYoZ3Jvd3RoIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZ3JvdyB0byBhIHNpemUgc21hbGxlciB0aGFuIHRoZSBjdXJyZW50IHNpemVcIik7XG4gICAgfVxuXG4gICAgLy8gTm90aGluZyB0byBkbyBoZXJlLCBqdXN0IHJldHVybiBhbiBlbXB0eSBkZWx0YVxuICAgIGlmKGdyb3d0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZGVsdGE7XG4gICAgfVxuXG4gICAgd2hpbGUoZ3Jvd3RoKSB7XG4gICAgICAgIGlmKHRoaXMuaGVhZCA9PT0gLTEgJiYgdGhpcy50YWlsID09PSAtMSkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgMCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhWzBdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2aWV3LnB1c2gobmV3RW50cnkpO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGhlYWQgJiYgdmlld1t0aGlzLmhlYWRdLmlkeCA+IDApIHtcbiAgICAgICAgICAgIG5ld0VudHJ5ID0ge1xuICAgICAgICAgICAgICAgIGlkeDogIHZpZXdbdGhpcy5oZWFkXS5pZHggLSAxLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFbdmlld1t0aGlzLmhlYWRdLmlkeCAtIDFdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBhbHdheXMgc2FmZSB0byBhZGQgYWZ0ZXIgdGhlIHRhaWxcbiAgICAgICAgICAgIHZpZXcuc3BsaWNlKHRoaXMuaGVhZCwgMCwgbmV3RW50cnkpO1xuXG4gICAgICAgICAgICAvLyBIZWFkIGRvZXNuJ3QgY2hhbmdlXG4gICAgICAgICAgICB0aGlzLnRhaWwgPSAodGhpcy5oZWFkIC0gMSArIHZpZXcubGVuZ3RoKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB9IGVsc2UgaWYodmlld1t0aGlzLnRhaWxdLmlkeCA8IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgbmV3RW50cnkgPSB7XG4gICAgICAgICAgICAgICAgaWR4OiAgdmlld1t0aGlzLnRhaWxdLmlkeCArIDEsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVt2aWV3W3RoaXMudGFpbF0uaWR4ICsgMV1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZpZXcuc3BsaWNlKHRoaXMudGFpbCArIDEsIDAsIG5ld0VudHJ5KTtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbCArIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSAodGhpcy50YWlsICsgMSkgJSB2aWV3Lmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gSWYgd2UgY2FuJ3QgYWRkIGFueW1vcmUgYXQgdGhlIHRhaWwsIGZvcmNlIHRoaXMgaW50b1xuICAgICAgICAgICAgLy8gdGhlIGhlYWQgbG9naWMgd2hpY2ggd2lsbCBvbmx5IGdyb3cgd2hlbiB0aGUgaWR4ID4gMFxuICAgICAgICAgICAgaWYobmV3RW50cnkuaWR4ID09PSBkYXRhLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICBoZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmKHZpZXdbdGhpcy50YWlsXS5pZHggPT09IGRhdGEubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIC0gaWYgdGhlIHZpZXcgaXMgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgLy8gc2V0IGhlYWQgdG8gdHJ1ZSBhbmQgbG9vcCBhcm91bmQgd2l0aG91dCBkZWNyZW1lbnRpbmdcbiAgICAgICAgICAgIC8vIGdyb3d0aFxuICAgICAgICAgICAgaGVhZCA9IHRydWU7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG5ld0VudHJ5KSB7IGRlbHRhLnB1c2gobmV3RW50cnkpOyB9XG4gICAgICAgIG5ld0VudHJ5ID0gZmFsc2U7XG4gICAgICAgIC0tZ3Jvd3RoO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHZpZXcubGVuZ3RoO1xuICAgIHJldHVybiBkZWx0YTtcbn1cblxuLypcbiAqIE1vdmVzIHRoZSBidWZmZXIgdG93YXJkcyB0aGUgZW5kIG9mIHRoZSBkYXRhIGFycmF5XG4gKi9cbmZ1bmN0aW9uIF9zaGlmdFJpZ2h0KGNvdW50KSB7XG4gICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICB2YXIgdmlldyAgICAgICAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIG5ld0luVmlldyAgID0gW107XG4gICAgdmFyIGN1clRhaWxJZHg7XG4gICAgdmFyIHRhaWwgPSB0aGlzLnRhaWw7XG4gICAgdmFyIGhlYWQgPSB0aGlzLmhlYWQ7XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG5cbiAgICB3aGlsZShjb3VudCkge1xuICAgICAgICBjdXJUYWlsSWR4ICA9IHZpZXdbdGFpbF0uaWR4O1xuXG4gICAgICAgIC8vIEVhcmx5IHJldHVybiBpZiB3ZSBhcmUgYWxyZWFkeSBhdCB0aGUgZW5kXG4gICAgICAgIGlmKGN1clRhaWxJZHggPT09IHRoaXMuZGF0YS5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gaGVhZDtcbiAgICAgICAgICAgIHJldHVybiBuZXdJblZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICB0YWlsID0gKHRhaWwgKyAxKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICBoZWFkID0gKGhlYWQgKyAxKSAlIHZpZXcubGVuZ3RoO1xuXG4gICAgICAgIHZpZXdbdGFpbF0uaWR4ICA9IGN1clRhaWxJZHggKyAxO1xuICAgICAgICB2aWV3W3RhaWxdLmRhdGEgPSB0aGlzLmRhdGFbY3VyVGFpbElkeCArIDFdO1xuXG4gICAgICAgIG5ld0luVmlldy5wdXNoKHZpZXdbdGFpbF0pO1xuXG4gICAgICAgIC8vIE9ubHkgbWFpbnRhaW4gYXQgbW9zdCB2aWV3Lmxlbmd0aCBpdGVtc1xuICAgICAgICBpZihuZXdJblZpZXcubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5ld0luVmlldy5zaGlmdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLS1jb3VudDtcbiAgICB9XG5cbiAgICB0aGlzLnRhaWwgPSB0YWlsO1xuICAgIHRoaXMuaGVhZCA9IGhlYWQ7XG5cbiAgICByZXR1cm4gbmV3SW5WaWV3O1xufVxuXG4vKlxuICogTW92ZXMgdGhlIGJ1ZmZlciB0b3dhcmRzIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGRhdGEgYXJyYXlcbiAqL1xuZnVuY3Rpb24gX3NoaWZ0TGVmdChjb3VudCkge1xuICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgdmFyIHZpZXcgICAgICAgID0gdGhpcy52aWV3O1xuICAgIHZhciBuZXdJblZpZXcgICA9IFtdO1xuICAgIHZhciBoZWFkICAgICAgICA9IHRoaXMuaGVhZDtcbiAgICB2YXIgdGFpbCAgICAgICAgPSB0aGlzLnRhaWw7XG4gICAgdmFyIGRhdGEgICAgICAgID0gdGhpcy5kYXRhO1xuICAgIHZhciBjdXJIZWFkSWR4O1xuXG4gICAgY291bnQgPSBjb3VudCB8fCAxO1xuICAgIHdoaWxlKGNvdW50KSB7XG4gICAgICAgIGN1ckhlYWRJZHggID0gdmlld1toZWFkXS5pZHg7XG5cbiAgICAgICAgLy8gRWFybHkgcmV0dXJuIGlmIHdlIGFyZSBhbHJlYWR5IGF0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgaWYoY3VySGVhZElkeCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gaGVhZDtcbiAgICAgICAgICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgICAgICAgICByZXR1cm4gbmV3SW5WaWV3O1xuICAgICAgICB9XG5cbiAgICAgICAgaGVhZCA9IChoZWFkIC0gMSArIHZpZXcubGVuZ3RoKSAlIHZpZXcubGVuZ3RoO1xuICAgICAgICB0YWlsID0gKHRhaWwgLSAxICsgdmlldy5sZW5ndGgpICUgdmlldy5sZW5ndGg7XG5cbiAgICAgICAgdmlld1toZWFkXS5pZHggID0gY3VySGVhZElkeCAtIDE7XG4gICAgICAgIHZpZXdbaGVhZF0uZGF0YSA9IGRhdGFbY3VySGVhZElkeCAtIDFdO1xuXG4gICAgICAgIG5ld0luVmlldy5wdXNoKHZpZXdbaGVhZF0pO1xuXG4gICAgICAgIC8vIE9ubHkgbWFpbnRhaW4gYXQgbW9zdCB2aWV3Lmxlbmd0aCBpdGVtc1xuICAgICAgICBpZihuZXdJblZpZXcubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5ld0luVmlldy5zaGlmdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLS1jb3VudDtcbiAgICB9XG5cbiAgICB0aGlzLmhlYWQgPSBoZWFkO1xuICAgIHRoaXMudGFpbCA9IHRhaWw7XG4gICAgcmV0dXJuIG5ld0luVmlldztcbn1cblxuLypcbiAqIE1vdmVzIHRoZSBidWZmZXIgdG93YXJkcyB0aGUgZW5kIChjb3VudCA+IDApIG9yXG4gKiBiZWdpbm5pbmcgKGNvdW50IDwgMCkgb2YgdGhlIGRhdGEgYXJyYXk7XG4gKlxuICogQHJldHVybnMgYXJyYXkgb2YgbmV3IGRhdGEgZWxlbWVudHMgaW4gdGhlIHZpZXcgYnVmZmVyXG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24gc2hpZnQoY291bnQpIHtcbiAgICB2YXIgZm47XG5cbiAgICBjb3VudCA9IGNvdW50IHx8IDE7XG4gICAgZm4gICAgPSBjb3VudCA+IDAgPyBfc2hpZnRSaWdodCA6IF9zaGlmdExlZnQ7XG5cbiAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBNYXRoLmFicyhjb3VudCkpO1xufTtcblxuLypcbiAqIFJlc2l6ZSB0aGUgdmlldyBidWZmZXIgLSBlaXRoZXIgZ3Jvd2luZyBvciBzaHJpbmtpbmcgaXQuXG4gKlxuICogQHBhcmFtIG5ld1NpemUgLSB0aGUgbmV3IHNpemUgb2YgdGhlIHZpZXcgYnVmZmVyXG4gKiBAcGFyYW0gaGVhZCAgICAtIGlmIHRydWUsIHByZWZlciByZXNpemluZyBiYXNlZCBvbiB0aGUgaGVhZCByYXRoZXIgdGhhbiB0aGUgdGFpbFxuICpcbiAqIEByZXR1cm5zICAgICAgIC0gQXJyYXkgb2YgYWRkZWQgb3IgcmVtb3ZlZCBpdGVtc1xuICovXG5WaWV3QnVmZmVyLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUobmV3U2l6ZSwgaGVhZCkge1xuICAgIGlmKG5ld1NpemUgPiB0aGlzLnZpZXcubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBfZ3Jvdy5jYWxsKHRoaXMsIG5ld1NpemUsIGhlYWQpO1xuICAgIH0gZWxzZSBpZihuZXdTaXplIDwgdGhpcy52aWV3Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gX3Nocmluay5jYWxsKHRoaXMsIG5ld1NpemUsIGhlYWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG59O1xuXG4vKlxuICogUmVzZXRzIHRoZSB2aWV3IGJ1ZmZlciBiYWNrIHRvIHplcm8gKGRhdGEgYW5kIHZpZXcpXG4gKlxuICogQHJldHVybnM6IGxpc3Qgb2YgdmlldyBpdGVtcztcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiBjbGVhcigpIHtcbiAgICB2YXIgaW5WaWV3SXRlbXMgPSB0aGlzLnZpZXcuc2xpY2UoMCk7IC8vIG1ha2UgYSBjb3B5XG5cbiAgICAvLyBEbyB0aGlzIGluIHBsYWNlIHRvIGJlIGZyaWVuZGx5IHRvIGxpYnJhcmllcyAoUml2ZXRzIGZvciBleGFtcGxlKVxuICAgIC8vIHRoYXQgYmluZCB0byBvYnNlcnZlIGNoYW5nZXNcbiAgICB0aGlzLnZpZXcuc3BsaWNlKDAsIE51bWJlci5NQVhfVkFMVUUpO1xuICAgIHRoaXMuZGF0YS5zcGxpY2UoMCwgTnVtYmVyLk1BWF9WQUxVRSk7XG5cbiAgICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSAtMTtcbiAgICB0aGlzLnNpemUgPSAwO1xuXG4gICAgcmV0dXJuIGluVmlld0l0ZW1zO1xufTtcblxuLypcbiAqIExvY2F0ZXMgYW4gaXRlbSBpbiB0aGUgdmlldyBieSBpdHMgaW5kZXggaW4gZGF0YSBpZiBpdCBleGlzdHNcbiAqXG4gKiBAcGFyYW0gaWR4ICAtIEluZGV4IGluIHRoZSBkYXRhIGFycmF5XG4gKlxuICogQHJldHVybnMgICAgLSBJbmRleCBpbiB0aGUgdmlldyBpZiBpdCBpcyBmb3VuZCBvciAtMSBpZiBub3RcbiAqL1xuVmlld0J1ZmZlci5wcm90b3R5cGUuZmluZERhdGFJbmRleEluVmlldyA9IGZ1bmN0aW9uIGZpbmREYXRhSW5kZXhJblZpZXcoaWR4KSB7XG4gICAgdmFyIHZpZXcgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGxlbiAgPSB2aWV3Lmxlbmd0aDtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgaWYodmlld1tpXS5pZHggPT09IGlkeCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gLTE7XG59O1xuXG4vKlxuICogUmVtb3ZlcyBhbiBlbnRyeSBmcm9tIGRhdGEgYW5kIGFkanVzdHMgdGhlIHZpZXcgaWYgbmVjZXNzYXJ5XG4gKlxuICogQHBhcmFtIGlkeCAgIC0gaW5kZXggb2YgdGhlIGl0ZW0gdG8gYmUgcmVtb3ZlZFxuICpcbiAqIEByZXR1cm5zIHtcbiAqICAgICAgbmV3SW5WaWV3OiAgIElmIGEgZGF0YSBpdGVtIHdhcyBtb3ZlZCBpbnRvIHRoZSB2aWV3IGFzIGEgcmVzdWx0IG9mIHJlbW92aW5nIGFuIGl0ZW0sIGFuIGFycmF5XG4gKiAgICAgICAgICAgICAgICAgICBjb250YWluaW5nIHRoZSBuZXdseSBhZGRlZCBpdGVtLlxuICogICAgICByZW1vdmVkOiAgICAgSWYgdGhlIHZpZXcgc2l6ZSB3YXMgbW9kaWZpZWQgYXMgYSByZXN1bHQgb2YgdGhlIHJlbW92YWwsIGFuIGFycmF5IGNvbnRhaW5pbmdcbiAqICAgICAgICAgICAgICAgICAgIHRoZSByZW1vdmVkIGl0ZW0uXG4gKiAgICAgIHVwZGF0ZWQ6ICAgICBsaXN0IG9mIGRhdGEgaXRlbXMgdGhhdCBjaGFuZ2VkIHBvc2l0aW9ucyB3aXRoaW4gdGhlIHZpZXcuXG4gKiB9XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZShpZHgpIHtcbiAgICAvL3ZhciBpZHhUb1JlbW92ZSAgPSBmYWxzZTtcbiAgICB2YXIgaGVhZCAgICAgICAgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICAgICAgICAgPSB0aGlzLnRhaWw7XG4gICAgdmFyIHZpZXcgICAgICAgICA9IHRoaXMudmlldztcbiAgICB2YXIgZGF0YSAgICAgICAgID0gdGhpcy5kYXRhO1xuICAgIHZhciB2aWV3SWR4LCBmcm9tLCB0bywgcmVzZXRWaWV3SWR4ID0gZmFsc2U7XG5cbiAgICB2YXIgcmV0VmFsID0ge1xuICAgICAgICBuZXdJblZpZXc6IFtdLFxuICAgICAgICByZW1vdmVkOiAgIFtdLFxuICAgICAgICB1cGRhdGVkOiAgIFtdXG4gICAgfTtcblxuICAgIHZhciBhZGRlZCwgcmVtb3ZlZCwgaTtcblxuICAgIGlkeCA9ICtpZHg7IC8vIE1ha2Ugc3VyZSBpdCBpcyBhIG51bWJlclxuXG4gICAgLy8gSWYgaWR4ID49IHRoZSB0b3RhbCBudW1iZXIgb2YgaXRlbXMgaW4gdGhlIGxpc3QsIHRocm93IGFuIGVycm9yXG4gICAgaWYoaWR4ID49IHRoaXMuZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5kZXggb3V0IG9mIGJvdW5kc1wiKTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgaXQgZnJvbSBpdGVtc1xuICAgIHRoaXMuZGF0YS5zcGxpY2UoaWR4LCAxKTtcblxuICAgIC8vIElmIGdyZWF0ZXIgdGhhbiB0aGUgdGFpbCBJRFgsIGl0IGlzIG5vdCBpbiB0aGUgdmlldyBhbmQgbm8gYWRqdXN0bWVudHNcbiAgICAvLyBhcmUgbmVjZXNzYXJ5IHRvIGFueSB2aWV3IGl0ZW1zLlxuICAgIGlmKGlkeCA+IHRoaXMudmlld1t0aGlzLnRhaWxdLmlkeCkge1xuICAgICAgICByZXR1cm4gcmV0VmFsO1xuICAgIH1cblxuICAgIC8vIElmIGxlc3MgdGhhbiB0aGUgaGVhZCBJRFgsIGl0IGlzIG5vdCBpbiB0aGUgdmlldywgYnV0IGFsbCB2aWV3IGl0ZW1zXG4gICAgLy8gbmVlZCB0byBiZSBhZGp1c3RlZCBiYWNrIGJ5IG9uZSB0byByZWZlcmVuY2UgdGhlIGNvcnJlY3QgZGF0YSBpbmRleFxuICAgIC8vXG4gICAgLy8gTmVlZCB0byB0aGluayBhYm91dCB3aGV0aGVyIGFueXRoaW5nIHdhcyByZWFsbHkgdXBkYXRlZCBoZXJlLiAgSWR4IGlzXG4gICAgLy8gbW9zdGx5IGFuIGludGVybmFsIGltcGxlbWVudGF0aW9uIGRldGFpbCBhbmQgdGhhdCBpcyBhbGwgdGhhdCBoYXMgYmVlblxuICAgIC8vIHVwZGF0ZWQgaW4gdGhpcyBjYXNlLlxuICAgIGlmKGlkeCA8IHZpZXdbaGVhZF0uaWR4KSB7XG4gICAgICAgIHZpZXcuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICBpdGVtLmlkeCA9IGl0ZW0uaWR4IC0gMTtcbiAgICAgICAgICAgIHJldFZhbC51cGRhdGVkLnB1c2goaXRlbSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXRWYWw7XG4gICAgfVxuXG4gICAgZnJvbSA9IHZpZXdJZHggPSB0aGlzLmZpbmREYXRhSW5kZXhJblZpZXcoaWR4KTtcbiAgICBpZih2aWV3SWR4ID09PSBoZWFkKSB7XG4gICAgICAgIGlmKGhlYWQgPT09IDApIHtcbiAgICAgICAgICAgIHRvID0gdGhpcy50YWlsID0gdGFpbCAtIDE7XG4gICAgICAgIH0gZWxzZSBpZihoZWFkID09PSB2aWV3Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZCA9IDA7XG4gICAgICAgICAgICByZXNldFZpZXdJZHggPSB0cnVlOyAvLyB2aWV3SWR4IG5lZWRzIHRvIGJlIHNldCBhdCAwIHNpbmNlIGl0IHdhcyByZW1vdmVkIGZyb20gdGhlIHRhaWxcbiAgICAgICAgICAgIHRvID0gdGFpbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvID0gdGFpbCArIHZpZXcubGVuZ3RoIC0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih2aWV3SWR4ID09PSB0YWlsKSB7XG4gICAgICAgIC8vIE5vbmUgb2YgdGhlc2UgcmVxdWlyZSBtb2RpZnlpbmcgaWR4IC0gdGhlIGxvb3AgdG8gdXBkYXRlIGlkeCB3aWxsIG5ldmVyIGJlIGVudGVyZWRcbiAgICAgICAgaWYodGFpbCA9PT0gdmlldy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgICAgICB9IGVsc2UgaWYodGFpbCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy50YWlsID0gdmlldy5sZW5ndGggLSAyO1xuICAgICAgICAgICAgdGhpcy5oZWFkID0gMDtcbiAgICAgICAgICAgIHRvID0gLTE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRoaXMudGFpbCAtIDE7XG4gICAgICAgICAgICB0aGlzLmhlYWQgPSBoZWFkIC0gMTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZih2aWV3SWR4IDwgaGVhZCAmJiB2aWV3SWR4IDwgdGFpbCkge1xuICAgICAgICB0byA9IHRoaXMudGFpbCA9IHRhaWwgLSAxO1xuICAgICAgICB0aGlzLmhlYWQgPSBoZWFkIC0gMTtcbiAgICB9IGVsc2UgaWYodmlld0lkeCA+IGhlYWQgJiYgdmlld0lkeCA8IHRhaWwpIHtcbiAgICAgICAgdG8gPSB0aGlzLnRhaWwgPSB0YWlsIC0gMTtcbiAgICB9IGVsc2UgaWYodmlld0lkeCA+IGhlYWQgJiYgdmlld0lkeCA+IHRhaWwpIHtcbiAgICAgICAgdG8gPSB0YWlsICsgdmlldy5sZW5ndGggLSAxO1xuICAgIH1cblxuICAgIHRoaXMuc2l6ZSA9IHRoaXMuc2l6ZSAtIDE7XG4gICAgcmVtb3ZlZCA9IHZpZXcuc3BsaWNlKHZpZXdJZHgsIDEpO1xuXG4gICAgdmlld0lkeCA9IHJlc2V0Vmlld0lkeCA/IDAgOiB2aWV3SWR4O1xuICAgIGZvcihpID0gdmlld0lkeDsgaSA8PSB0bzsgKytpKSB7XG4gICAgICAgIC0tdmlld1tpICUgdmlldy5sZW5ndGhdLmlkeDtcbiAgICAgICAgcmV0VmFsLnVwZGF0ZWQucHVzaCh2aWV3W2kgJSB2aWV3Lmxlbmd0aF0pO1xuICAgIH1cblxuICAgIGlmKGRhdGEubGVuZ3RoID4gdmlldy5sZW5ndGgpIHtcbiAgICAgICAgYWRkZWQgPSB0aGlzLnJlc2l6ZSh2aWV3Lmxlbmd0aCArIDEpO1xuICAgIH1cblxuICAgIHJldFZhbC5yZW1vdmVkLnB1c2guYXBwbHkocmV0VmFsLnJlbW92ZWQsIHJlbW92ZWQpO1xuICAgIHJldFZhbC5uZXdJblZpZXcucHVzaC5hcHBseShyZXRWYWwubmV3SW5WaWV3LCBhZGRlZCk7XG4gICAgcmV0dXJuIHJldFZhbDtcbn07XG5cbi8qXG4gKiBJdGVyYXRlcyB0aHJvdWdoIGFsbCBpdGVtcyBjdXJyZW50bHkgaW4gdGhlIGNpcmN1bGFyIGJ1ZmZlciBzdGFydGluZyBhdCB0aGUgbG9naWNhbFxuICogZmlyc3QgaXRlbSByYXRoZXIgdGhhbiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSB2aWV3IGFycmF5LiAgVGhlIGNhbGxiYWNrIHNpZ25hdHVyZVxuICogaXMgc2ltaWxhciB0byBBcnJheS5mb3JFYWNoLCBob3dldmVyIGJvdGggdGhlIHJhdyBpbmRleCBhbmQgdGhlIGxvZ2ljYWwgaW5kZXggYXJlXG4gKiBwYXNzZWQuXG4gKlxuICogY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIGZvdXIgYXJndW1lbnRzOlxuICpcbiAqICAgICAgdGhlIHZpZXcgaXRlbVxuICogICAgICB0aGUgdmlldyBpdGVtcyBsb2dpY2FsIGluZGV4XG4gKiAgICAgIHRoZSB2aWV3IGl0ZW1zIHBoeXNpY2FsIGluZGV4XG4gKiAgICAgIHRoZSB2aWV3XG4gKi9cblZpZXdCdWZmZXIucHJvdG90eXBlLmZvckVhY2hJblZpZXcgPSBmdW5jdGlvbiBmb3JFYWNoSW5WaWV3KGNiLCB1c2VBc1RoaXMpIHtcbiAgICB2YXIgdmlldyAgPSB0aGlzLnZpZXc7XG4gICAgdmFyIGxlbiAgID0gdmlldy5sZW5ndGg7XG4gICAgdmFyIGhlYWQgID0gdGhpcy5oZWFkO1xuICAgIHZhciB0YWlsICA9IHRoaXMudGFpbDtcbiAgICB2YXIgdG8gICAgPSB0YWlsIDwgaGVhZCA/IHRhaWwgKyBsZW4gOiB0YWlsO1xuICAgIHZhciBpLCBjdXJJdGVtLCByZWFsSWR4O1xuXG4gICAgdXNlQXNUaGlzID0gdXNlQXNUaGlzIHx8IHRoaXM7XG5cbiAgICBmb3IoaSA9IGhlYWQ7IGkgPD0gdG87ICsraSkge1xuICAgICAgICByZWFsSWR4ID0gaSAlIGxlbjtcbiAgICAgICAgY3VySXRlbSA9IHZpZXdbcmVhbElkeF07XG5cbiAgICAgICAgY2IuY2FsbCh1c2VBc1RoaXMsIGN1ckl0ZW0sIGkgLSBoZWFkLCByZWFsSWR4LCB2aWV3KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXdCdWZmZXI7XG4iXX0=
(1)
});
