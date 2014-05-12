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
