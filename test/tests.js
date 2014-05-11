require('source-map-support').install();

// For tests, set it up to callback immediately.
// Currently none of the code relies on the time param
// so this should be ok.
window.requestAnimationFrame = function(cb) {
    cb();
};

require('./litelist_test');
require('./viewbuffer_test');


