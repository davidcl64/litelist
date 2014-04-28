# LiteList

Virtual list with low DOM overhead

## About

LiteList is a small library providing an efficient, scrollable view backed by a list containing
potentially thousands of entries.

## Installation

```npm install litelist``` or grab the [source](https://github.com/davidcl64/litelist/dist/).  Bower is still tbd.

Couple of notes on that topic:

- For desktop browser support - litelist.js or litelist.min.js will do.  No other dependencies are needed.
- For mobile support - because mobile browsers don't consistently provide scroll events, additional modules
  are provided in the litelist.bundled.js/litelist.bundles.min.js:
    - A lightweight scrolling implementation borrowed heavily from [ariya/kinetic](https://github.com/ariya/kinetic)
    - [Tween.JS](https://github.com/sole/tween.js) - for smoother scrolling
    - [raf.js](https://github.com/ngryman/raf.js) - Yet another requestAnimationFrame polyfill.

## Usage

### Initialization

#### Vanilla Javascript

    var liteList = LiteList({
        itemWidth       : Optional - width of each item.  If not provide one item per row is assumed
        itemHeight      : Required - height of each item.
        margin          : Optional - margin/gutters for the items.  Defaults to: { x: 0, y: 0 };
        scrollView      : Required - query selector for the scrollable container
        itemsContainer  : Optional - query selector container of the items.  Defaults to the first child of scrollView

        // The next two are required for a vanilla javascript implementation.  ListList was written to work
        // with the Rivets library which provides this functionality as well.  In that case, it is optional.
        itemTemplate    : Required - DOM node that will be cloned as a template for each item.
        dataSource      : Required - Implementation of the dataSource contract (see below for more details).
    });


#### Rivets

LiteList was written to work with the excellent [Rivets library](https://github.com/mikeric/rivets).  Rivets will do
the heavy lifting for the data binding and managing the DOM.  For a more thorough example of how to implement this
using Rivets, see the [Rivets demo](https://github.com/davidcl64/litelist/demo).

Rivets support is included in the bundled libraries or can be included separately (rvlitelist.js/rvlitelist.min.js).

    var rvLiteList = new LiteList.RivetsLiteList({
        itemWidth       : Optional - width of each item.  If not provide one item per row is assumed
        itemHeight      : Required - height of each item.
        margin          : Optional - margin/gutters for the items.  Defaults to: { x: 0, y: 0 };
        scrollView      : Required - query selector for the scrollable container
        itemsContainer  : Optional - query selector container of the items.  Defaults to the first child of scrollView
    });

### dataSource

dataSource is an object implementing a `sync` method and optionally, `bind` and `unbind`.  For a more thorough exammple
of how to implement this interface see [vanilla demo](https://github.com/davidcl64/litelist/demo/vanilla.html)

    dataSource: {
        bind:   function(id, el) {...},
        sync:   function(id, el, itemIdx, item) {},
        unbind: function(id, el) {}
    }

**bind:** Optional, but recommended. Called once when a template is realized and appended to itemsContainer.  A typical
implementation would be to obtain a reference (mapped to id) to any node that will need to be updated for faster access
during sync. You would also register any event handlers here, although it may be more appropriate to allow the events
to bubble up to the items container and handle them there...

- id: unique id of the realized template
- el: the actual dom element

**sync:** Called each time the view needs updating.

- id: unique id of the realized template
- el: the actual dom element
- itemIdx: index of the item in the item array
- item:    the actual item to be rendered into `el`

**unbind:** Optional but recommended/required if storing references in `bind`. Called once when a view node is removed
from the DOM.

## Development

[Grunt](http://gruntjs.com) with [browserify](http://browserify.org) via [grunt-browserify](https://github.com/jmreidy/grunt-browserify)
is the build system for LiteList.  Once you have cloned the repo and have [nodejs](http://nodejs.org) and
[Grunt](http://gruntjs.com/getting-started) installed run:

    npm install .

from the projects root folder.  Once that is done, you will be able to run various tasks using grunt:

- ```grunt```: runs a dev server on port 9001, then watches for changes.
- ```grunt build```: rebuilds contents of the dist folder

For more detail on which tasks are run and the targets available, take a look at [Gruntfile.js](https://github.com/davidcl64/litelist/blob/master/Gruntfile.js)

## To Dos

While the basic implementation if functional and seems to work well on various mobile browsers, additional testing still
needs to occur (both performance and functional).  It is very likely that as implementation proceeds the exposed API and
 internal implementation will change significantly.

- Provide a simple, performant mechanism for lazy loading of the list.
- Expose generated scroll events from scroller (for mobile use case)
- Expose better ways to populate and maintain the list of items
- Support a visible scrollbar for mobile browsers
- more...

## Contributing

Contributions of any kind (feature request, bug reports/fixes, pull requests, complaints,
comments, 'why don't you just use x module instead') are all welcome.

## License

MIT. See `LICENSE.txt` in this directory.
