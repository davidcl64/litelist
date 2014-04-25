"use strict";

// Base function.
function LiteList(opts) {
    this.itemsInView     = [];
    this.items           = [];
    this.itemWidth       = opts.itemWidth || 0;
    this.itemHeight      = opts.itemHeight;
    this.margin          = opts.margin || { x: 0, y: 0 };
    this.view            = document.querySelector(opts.scrollView);
    this.itemsContainer  = opts.itemsContainer ? document.querySelector(opts.itemsContainer) : false;
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

    // If not passed a page selector, assume it's the first child
    if(!this.itemsContainer) {
        this.itemsContainer = this.view.children[0];
    }

    // ensureVisible is used in requestAnimationFrame - bind it to this
    this.ensureVisible = this.ensureVisible.bind(this);

    // Invoked as a result of event listeners
    this.scrollHandler = this.scrollHandler.bind(this);
    this.resizeHandler = this.resizeHandler.bind(this);

    // Keep track of a unique id for viewItems - allows This is passed to
    // datasource providers to aid in tracking.
    this._id = 0;
    this.calcViewMetrics();

    this._oldStart = 0;

    this.bind();

    this.scroll = LiteList.Scroll ? new LiteList.Scroll(opts.scrollView, this.scrollHandler) : false;

    // Kicks off a layout (dirtyResize defaults to true)
    // This will layout everything nicely filling all columns
    this.calcDocHeight();
    this.requestTick();
}

LiteList.prototype.createInViewObj = function createInViewObj(item, idx) {
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

        this.itemsContainer.appendChild(newNode);
        newViewObj.el = newNode;
        if(this.dataSource && this.dataSource.bind) {
            this.dataSource.bind(newViewObj.id, newNode);
        }

        this.positionViewItem(newViewObj, true);
    }

    return newViewObj;
};

LiteList.prototype.calcViewMetrics = function calcViewMetrics() {
    this.clientHeight    = this.view.clientHeight;
    this.clientWidth     = this.view.clientWidth;
    this.rowsPerPage     = Math.ceil (this.clientHeight / (this.itemHeight + this.margin.y));
    this.itemsPerRow     = this.itemWidth ? Math.floor(this.clientWidth  / (this.itemWidth  + this.margin.x)) : 1;
    this.itemsPerPage    = this.rowsPerPage * this.itemsPerRow;
    this.maxBuffer       = this.itemsPerPage * 3;
};

LiteList.prototype.calcDocHeight = function calcDocHeight() {
    var row = Math.ceil(this.items.length/this.itemsPerRow);
    var newHeight = row * this.itemHeight + row * this.margin.y;

    if(newHeight !== this.itemsInView.height) {
        this.itemsContainer.style.height = newHeight + "px";
        this.itemsInView.height = newHeight;
    }
    return this.itemsInView.height;
};

LiteList.prototype.positionViewItem = function positionViewItem(viewItem, force) {
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

LiteList.prototype._ensureVisible = function _ensureVisible() {
    var bufferHeight  = this.itemsInView.length * this.itemHeight/this.itemsPerRow + this.itemsInView.length * this.margin.y/this.itemsPerRow;
    var percentInView = ((this.scrollTop - bufferHeight/3) / (this.itemsInView.height - this.clientHeight));

    if(percentInView < 0) { percentInView = 0; }
    var newStart = Math.floor(percentInView * this.items.length);
    var i;
    var viewItem;

    if(newStart < this._oldStart) {
        for(i = newStart; i < this._oldStart; ++i) {
            viewItem = this.itemsInView[i % this.itemsInView.length];

            viewItem.idx = viewItem.idx - this.itemsInView.length;
            this.positionViewItem(viewItem);
        }
    } else if(newStart > this._oldStart) {
        for(i = this._oldStart; i < newStart ; ++i) {
            viewItem = this.itemsInView[i % this.itemsInView.length];

            viewItem.idx = viewItem.idx + this.itemsInView.length;
            if(viewItem.idx < this.items.length) {
                this.positionViewItem(viewItem);
            }
        }
    }

    this._oldStart   = newStart;
    this.dirtyResize = false;
    this.ticking     = false;
};

LiteList.prototype.ensureVisible = function ensureVisible() {
    if(this.dirtyResize) {
        var newHeight    = this.view.clientHeight;
        var newWidth     = this.view.clientWidth;

        var newRowsPerPage     = Math.ceil (newHeight / (this.itemHeight + this.margin.y));
        var newItemsPerRow     = this.itemWidth ? Math.floor(newWidth  / (this.itemWidth  + this.margin.x)) : 1;

        var i, removed;
        if(newRowsPerPage !== this.rowsPerPage || newItemsPerRow !== this.itemsPerRow) {
            this.calcViewMetrics();
            this.calcDocHeight();

            if(this.itemsInView.length > this.maxBuffer) {
                removed = this.itemsInView.splice(0, this.itemsInView.length - this.maxBuffer);

                if(this.dataSource && this.dataSource.unbind) {
                    removed.forEach(function(inViewItem) {
                        this.dataSource.unbind(inViewItem.id, inViewItem.el);
                        this.itemsContainer.removeChild(inViewItem.el);
                    });
                }
            } else if(this.itemsInView.length < this.maxBuffer) {
                var newItems = [-1, 0];
                for(i = this.itemsInView.length; i < this.maxBuffer; ++i) {
                    newItems.push(this.createInViewObj({}, 0));
                }

                this.itemsInView.splice.apply(this.itemsInView, newItems);
            }

            for(i = 0; i < this.itemsInView.length; ++i) {
                this.itemsInView[i].idx = i;
                this.positionViewItem(this.itemsInView[i]);
            }

            this._oldStart = 0;
        }
    }

    this._ensureVisible();
};

LiteList.prototype.requestTick = function requestTick() {
    if(!this.ticking) {
        window.requestAnimationFrame(this.ensureVisible);
    }
    this.ticking = true;
};

LiteList.prototype.push = function push() {
    var args    = Array.prototype.slice.call(arguments);
    var i       = 0;
    var argsIdx = this.items.length;

    this.items.push.apply(this.items, args);
    while(this.itemsInView.length < this.maxBuffer && i < args.length) {
        this.itemsInView.push( this.createInViewObj(args[i], argsIdx) );

        i = i + 1;
        argsIdx = argsIdx + 1;
    }

    this.calcDocHeight();
    this.requestTick();
};

LiteList.prototype.bind = function bind() {
    this.view.addEventListener("scroll", this.scrollHandler);
    window.addEventListener("resize", this.resizeHandler);
};

LiteList.prototype.unbind = function unbind() {
    this.view.removeEventListener("scroll", this.scrollHandler);
    window.removeEventListener("resize", this.resizeHandler);

    if(this.scroll) { this.scroll.unbind(); }
};

LiteList.prototype.scrollHandler = function scrollHandler(/*evt*/) {
    this.scrollTop  = this.view.scrollTop;
    this.requestTick();
};

LiteList.prototype.resizeHandler = function resizeHandler(/*evt*/) {
    this.dirtyResize = true;
    this.requestTick();
};

// Version.
LiteList.VERSION = '0.1.0';


module.exports = LiteList;