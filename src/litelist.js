var ViewBuffer = require('./viewbuffer');

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