!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.LiteList=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

/*
 * LiteList
 *
 * opts: {
 *  itemWidth       : Optional - width of each item.  If not provide one item per row is assumed
 *  itemHeight      : Required - height of each item.
 *  margin          : Optional - margin/gutters for the items.  Defaults to: { x: 0, y: 0 };
 *  scrollView      : Required - query selector for the scrollable container
 *  itemsContainer  : Optional - query selector container of the items.  Defaults to the first child of scrollView
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

    // bind any event handlers now
    this.bind();

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
            this._positionViewItem(viewItem);
        }
    } else if(newStart > this._oldStart) {
        for(i = this._oldStart; i < newStart ; ++i) {
            viewItem = this.itemsInView[i % this.itemsInView.length];

            viewItem.idx = viewItem.idx + this.itemsInView.length;
            if(viewItem.idx < this.items.length) {
                this._positionViewItem(viewItem);
            }
        }
    }

    this._oldStart   = newStart;
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

    this.items.push.apply(this.items, args);
    while(this.itemsInView.length < this.maxBuffer && i < args.length) {
        inViewObj = this._createInViewObj(args[i], argsIdx);
        this.itemsInView.push(inViewObj);
        this._positionViewItem(inViewObj, true);

        i = i + 1;
        argsIdx = argsIdx + 1;
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

LiteList.prototype._scrollHandler = function scrollHandler(/*evt*/) {
    this.scrollTop  = this.view.scrollTop;
    this._requestTick();
};

LiteList.prototype._resizeHandler = function resizeHandler(/*evt*/) {
    this.dirtyResize = true;
    this._requestTick();
};

// Version.
LiteList.VERSION = '0.3.0';


module.exports = LiteList;
},{}]},{},[1])
(1)
});