"use strict";

// Base function.
function LiteList(opts) {
    var itemsInView     = this.itemsInView = [];
    var items           = this.items       = [];
    var itemWidth       = opts.itemWidth || 0;
    var itemHeight      = opts.itemHeight;
    var margin          = opts.margin || { x: 0, y: 0 };
    var view            = document.querySelector(opts.scrollView);
    var itemsContainer  = opts.itemsContainer ? document.querySelector(opts.itemsContainer) : false;
    var dataSource      = opts.dataSource || false;
    var itemTemplate    = opts.itemTemplate || false;
    var scrollTop       = 0;
    var dirtyResize     = true;
    var ticking         = false;

    // View Metrics
    var clientHeight, clientWidth, rowsPerPage, itemsPerRow, itemsPerPage, maxBuffer;

    // If not passed a page selector, assume it's the first child
    if(!itemsContainer) {
        itemsContainer = view.children[0];
    }

    // Keep track of a unique id for viewItems - allows This is passed to
    // datasource providers to aid in tracking.
    var id = 0;
    function createInViewObj(item, idx) {
        var row = Math.floor(idx/itemsPerRow);
        var col = (idx % itemsPerRow);

        var newViewObj = {
            id:   id++,
            top:  row * itemHeight + row * margin.y,
            left: col * itemWidth  + col * margin.x,
            idx:  idx,
            item: item
        };

        // If we were given an item template, we need to add a clone
        // to the dom
        if(itemTemplate) {
            var newNode = itemTemplate.cloneNode(true);

            itemsContainer.appendChild(newNode);
            newViewObj.el = newNode;
            if(dataSource && dataSource.bind) {
                dataSource.bind(newViewObj.id, newNode);
            }

            positionViewItem(newViewObj, true);
        }

        return newViewObj;
    }

    function calcViewMetrics() {
        clientHeight    = view.clientHeight;
        clientWidth     = view.clientWidth;
        rowsPerPage     = Math.ceil (clientHeight / (itemHeight + margin.y));
        itemsPerRow     = itemWidth ? Math.floor(clientWidth  / (itemWidth  + margin.x)) : 1;
        itemsPerPage    = rowsPerPage * itemsPerRow;
        maxBuffer       = itemsPerPage * 3;
    }
    calcViewMetrics();

    function calcDocHeight() {
        var row = Math.ceil(items.length/itemsPerRow);
        var newHeight = row * itemHeight + row * margin.y;

        if(newHeight !== itemsInView.height) {
            itemsContainer.style.height = newHeight + "px";
            itemsInView.height = newHeight;
        }
        return itemsInView.height;
    }

    function positionViewItem(viewItem, force) {
        var idx  = viewItem.idx;
        var row  = Math.floor(idx/itemsPerRow);
        var col  = (idx % itemsPerRow);
        var top  = row * itemHeight + row * margin.y;
        var left = col * itemWidth  + col * margin.x;

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
        if(force || (viewItem.item !== items[idx])) {
            viewItem.item = items[idx];

            // If we have a dataSource
            if(dataSource && dataSource.sync) {
                dataSource.sync(viewItem.id, viewItem.el, idx, items[idx]);
            }
        }
    }

    var oldStart = 0;
    function _ensureVisible() {
        var bufferHeight  = itemsInView.length * itemHeight/itemsPerRow + itemsInView.length * margin.y/itemsPerRow;
        var percentInView = ((scrollTop - bufferHeight/3) / (itemsInView.height - clientHeight));

        if(percentInView < 0) { percentInView = 0; }
        var newStart = Math.floor(percentInView * items.length);
        var i;
        var viewItem;

        if(newStart < oldStart) {
            for(i = newStart; i < oldStart; ++i) {
                viewItem = itemsInView[i % itemsInView.length];

                viewItem.idx = viewItem.idx - itemsInView.length;
                positionViewItem(viewItem);
            }
        } else if(newStart > oldStart) {
            for(i = oldStart; i < newStart ; ++i) {
                viewItem = itemsInView[i % itemsInView.length];

                viewItem.idx = viewItem.idx + itemsInView.length;
                if(viewItem.idx < items.length) {
                    positionViewItem(viewItem);
                }
            }
        }

        oldStart    = newStart;
        dirtyResize = false;
        ticking     = false;
    }

    function ensureVisible() {
        if(dirtyResize) {
            var newHeight    = view.clientHeight;
            var newWidth     = view.clientWidth;

            var newRowsPerPage     = Math.ceil (newHeight / (itemHeight + margin.y));
            var newItemsPerRow     = itemWidth ? Math.floor(newWidth  / (itemWidth  + margin.x)) : 1;

            var i, removed;
            if(newRowsPerPage !== rowsPerPage || newItemsPerRow !== itemsPerRow) {
                calcViewMetrics();
                calcDocHeight();

                if(itemsInView.length > maxBuffer) {
                    removed = itemsInView.splice(0, itemsInView.length - maxBuffer);

                    if(dataSource && dataSource.unbind) {
                        removed.forEach(function(inViewItem) {
                            dataSource.unbind(inViewItem.id, inViewItem.el);
                            itemsContainer.removeChild(inViewItem.el);
                        });
                    }
                } else if(itemsInView.length < maxBuffer) {
                    var newItems = [-1, 0];
                    for(i = itemsInView.length; i < maxBuffer; ++i) {
                        newItems.push(createInViewObj({}, 0));
                    }

                    itemsInView.splice.apply(itemsInView, newItems);
                }

                for(i = 0; i < itemsInView.length; ++i) {
                    itemsInView[i].idx = i;
                    positionViewItem(itemsInView[i]);
                }

                oldStart = 0;
            }
        }

        _ensureVisible();
    }

    function requestTick() {
        if(!ticking) {
            window.requestAnimationFrame(ensureVisible);
        }
        ticking = true;
    }

    function push() {
        var args    = Array.prototype.slice.call(arguments);
        var i       = 0;
        var argsIdx = items.length;

        items.push.apply(items, args);
        while(itemsInView.length < maxBuffer && i < args.length) {
            itemsInView.push( createInViewObj(args[i], argsIdx) );

            i = i + 1;
            argsIdx = argsIdx + 1;
        }

        calcDocHeight();
        requestTick();
    }
    this.push = push;

    function bind() {
        view.addEventListener("scroll", scrollHandler);
        window.addEventListener("resize", resizeHandler);
    }

    function unbind() {
        view.removeEventListener("scroll", scrollHandler);
        window.removeEventListener("resize", resizeHandler);

        if(scroll) { scroll.unbind(); }
    }
    this.unbind = unbind;

    function scrollHandler(/*evt*/) {
        /*jshint validthis:true */
        scrollTop  = this.scrollTop;

        requestTick();
    }

    function resizeHandler(/*evt*/) {
        dirtyResize = true;
        requestTick();
    }

    bind();

    var scroll = LiteList.Scroll ? new LiteList.Scroll(opts.scrollView, scrollHandler) : false;

    // Kicks off a layout (dirtyResize defaults to true)
    // This will layout everything nicely filling all columns
    calcDocHeight();
    requestTick();
}


// Version.
LiteList.VERSION = '0.1.1';


module.exports = LiteList;