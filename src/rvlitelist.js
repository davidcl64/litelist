var rivets   = require('rivets');
var LiteList = require('./litelist');

function RVLiteList(opts) {
    this.liteList    = new LiteList(opts);
    this.itemsInView = this.liteList.itemsInView;

    this.unbind = function unbind() {
        if(this.rvView) { this.rvView.unbind(); }

        this.liteList.unbind();
    };

    this.push = function() {
        this.liteList.push.apply(this.liteList, arguments);
    };

    this.rvView = rivets.bind(document.querySelector(opts.itemsContainer), {items: this.itemsInView}, {
        binders: {
            top:    function(el, val) { el.style.top    = val + "px"; },
            left:   function(el, val) { el.style.left   = val + "px"; },
            height: function(el, val) { el.style.height = val + "px"; }
        }
    });
}

LiteList.RivetsLiteList = RVLiteList;

module.exports = LiteList;

