var TWEEN;

require("raf.js");

// Just here to simplify the initialization logic.  If
// window doesn't exist, this module is useless anyway
if(typeof window === 'undefined') { window = {}; }

// The build will declare TWEEN as external. However, if it isn't provided by
// browserify, we really want to check to see if it was included directly via
// script tag first.  Only if it isn't will we try a require.  This *should*
// make it easier to bundle/or not and to use with requirejs...
TWEEN = window.TWEEN || require("tween.js");

function Scroll(viewOrSelector, listener) {
    var view,
        min, max, offset, reference, pressed,
        velocity, frame, timestamp, ticker, tweenTicker,
        amplitude, target, timeConstant, innerHeight;

    var p0 = { y: 0 };
    var t0 = false;

    function ypos(e) {
        // touch event
        if (e.targetTouches && (e.targetTouches.length >= 1)) {
            return e.targetTouches[0].clientY;
        }

        // mouse event
        return e.clientY;
    }

    function scroll(y) {
        offset = (y > max) ? max : (y < min) ? min : y;

        view.scrollTop = offset;
        listener.call(view);
    }

    function track() {
        var now, elapsed, delta, v;

        now = Date.now();
        elapsed = now - timestamp;
        timestamp = now;
        delta = offset - frame;
        frame = offset;

        v = 1000 * delta / (1 + elapsed);
        velocity = 0.8 * v + 0.2 * velocity;
    }

    function tick() {
        TWEEN.update();
    }

    function tap(e) {
        pressed = true;
        reference = ypos(e);

        velocity = amplitude = 0;
        frame = offset;
        timestamp = Date.now();
        clearInterval(ticker);
        ticker = setInterval(track, 100);

        if(t0) {
            t0.stop();
            t0 = false;
        }
    }

    function drag(e) {
        var y, delta;
        if (pressed) {
            y = ypos(e);
            delta = reference - y;
            if (delta > 2 || delta < -2) {
                reference = y;
                scroll(offset + delta);
            }
        }
        e.preventDefault();
    }

    function release(/*e*/) {
        pressed = false;

        clearInterval(ticker);

        // If no velocity yet, track once make sure
        if(velocity === 0) { track(); }

        if (velocity > 10 || velocity < -10) {
            amplitude = 0.8 * velocity;
            target = Math.round(offset + amplitude);
            timestamp = Date.now();

            p0.y = view.scrollTop;
            t0 = new TWEEN.Tween(p0)
                .to({y: target}, timeConstant)
                .easing(TWEEN.Easing.Quintic.Out)
                .onUpdate(function() {
                    scroll(p0.y);
                    tweenTicker = window.requestAnimationFrame(tick);
                })
                .onComplete(function() {
                    scroll(p0.y);
                    t0.stop();
                    t0 = false;
                });

            t0.start();
            tweenTicker = window.requestAnimationFrame(tick);
        }
    }

    view = typeof viewOrSelector === 'string' ? document.querySelector(viewOrSelector) : viewOrSelector;
    this.bind = function attach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.addEventListener('touchstart', tap);
            view.addEventListener('touchmove', drag);
            view.addEventListener('touchend', release);
        }
    };

    this.unbind = function detach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.removeEventListener('touchstart', tap);
            view.removeEventListener('touchmove', drag);
            view.removeEventListener('touchend', release);
        }
    };

    this.reset = function reset() {
        max = parseInt(window.getComputedStyle(view).height, 10) - innerHeight;
        offset = min = 0;
        pressed = false;
        clearInterval(ticker);
        window.cancelAnimationFrame(tweenTicker);
    };

    timeConstant = 2000; // ms

    this.reset();
    this.bind();
}


module.exports = Scroll;
