!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.LiteListScroll=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/*
 * raf.js
 * https://github.com/ngryman/raf.js
 *
 * original requestAnimationFrame polyfill by Erik Möller
 * inspired from paul_irish gist and post
 *
 * Copyright (c) 2013 ngryman
 * Licensed under the MIT license.
 */

(function(window) {
	var lastTime = 0,
		vendors = ['webkit', 'moz'],
		requestAnimationFrame = window.requestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame,
		i = vendors.length;

	// try to un-prefix existing raf
	while (--i >= 0 && !requestAnimationFrame) {
		requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
		cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'];
	}

	// polyfill with setTimeout fallback
	// heavily inspired from @darius gist mod: https://gist.github.com/paulirish/1579671#comment-837945
	if (!requestAnimationFrame || !cancelAnimationFrame) {
		requestAnimationFrame = function(callback) {
			var now = Date.now(), nextTime = Math.max(lastTime + 16, now);
			return setTimeout(function() {
				callback(lastTime = nextTime);
			}, nextTime - now);
		};

		cancelAnimationFrame = clearTimeout;
	}

	// export to window
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
}(window));
},{}],2:[function(_dereq_,module,exports){
var TWEEN;

_dereq_("raf.js");

// Just here to simplify the initialization logic.  If
// window doesn't exist, this module is useless anyway
if(typeof window === 'undefined') { window = {}; }

// The build will declare TWEEN as external. However, if it isn't provided by
// browserify, we really want to check to see if it was included directly via
// script tag first.  Only if it isn't will we try a require.  This *should*
// make it easier to bundle/or not and to use with requirejs...
TWEEN = window.TWEEN || _dereq_("tween.js");

function Scroll(viewOrSelector, listener) {
    var view,
        min, max, offset, reference, pressed,
        velocity, frame, timestamp, ticker,
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
                    window.requestAnimationFrame(tick);
                })
                .onComplete(function() {
                    scroll(p0.y);
                    t0.stop();
                    t0 = false;
                });

            t0.start();
            window.requestAnimationFrame(tick);
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
    };

    timeConstant = 2000; // ms

    this.reset();
    this.bind();
}


module.exports = Scroll;

},{"raf.js":1,"tween.js":"yazFk1"}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvc2Nyb2xsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogcmFmLmpzXG4gKiBodHRwczovL2dpdGh1Yi5jb20vbmdyeW1hbi9yYWYuanNcbiAqXG4gKiBvcmlnaW5hbCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyXG4gKiBpbnNwaXJlZCBmcm9tIHBhdWxfaXJpc2ggZ2lzdCBhbmQgcG9zdFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBuZ3J5bWFuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cblxuKGZ1bmN0aW9uKHdpbmRvdykge1xuXHR2YXIgbGFzdFRpbWUgPSAwLFxuXHRcdHZlbmRvcnMgPSBbJ3dlYmtpdCcsICdtb3onXSxcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lLFxuXHRcdGkgPSB2ZW5kb3JzLmxlbmd0aDtcblxuXHQvLyB0cnkgdG8gdW4tcHJlZml4IGV4aXN0aW5nIHJhZlxuXHR3aGlsZSAoLS1pID49IDAgJiYgIXJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXTtcblx0fVxuXG5cdC8vIHBvbHlmaWxsIHdpdGggc2V0VGltZW91dCBmYWxsYmFja1xuXHQvLyBoZWF2aWx5IGluc3BpcmVkIGZyb20gQGRhcml1cyBnaXN0IG1vZDogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vcGF1bGlyaXNoLzE1Nzk2NzEjY29tbWVudC04Mzc5NDVcblx0aWYgKCFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIWNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHZhciBub3cgPSBEYXRlLm5vdygpLCBuZXh0VGltZSA9IE1hdGgubWF4KGxhc3RUaW1lICsgMTYsIG5vdyk7XG5cdFx0XHRyZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0Y2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7XG5cdFx0XHR9LCBuZXh0VGltZSAtIG5vdyk7XG5cdFx0fTtcblxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2xlYXJUaW1lb3V0O1xuXHR9XG5cblx0Ly8gZXhwb3J0IHRvIHdpbmRvd1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjYW5jZWxBbmltYXRpb25GcmFtZTtcbn0od2luZG93KSk7IiwidmFyIFRXRUVOO1xuXG5yZXF1aXJlKFwicmFmLmpzXCIpO1xuXG4vLyBKdXN0IGhlcmUgdG8gc2ltcGxpZnkgdGhlIGluaXRpYWxpemF0aW9uIGxvZ2ljLiAgSWZcbi8vIHdpbmRvdyBkb2Vzbid0IGV4aXN0LCB0aGlzIG1vZHVsZSBpcyB1c2VsZXNzIGFueXdheVxuaWYodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHsgd2luZG93ID0ge307IH1cblxuLy8gVGhlIGJ1aWxkIHdpbGwgZGVjbGFyZSBUV0VFTiBhcyBleHRlcm5hbC4gSG93ZXZlciwgaWYgaXQgaXNuJ3QgcHJvdmlkZWQgYnlcbi8vIGJyb3dzZXJpZnksIHdlIHJlYWxseSB3YW50IHRvIGNoZWNrIHRvIHNlZSBpZiBpdCB3YXMgaW5jbHVkZWQgZGlyZWN0bHkgdmlhXG4vLyBzY3JpcHQgdGFnIGZpcnN0LiAgT25seSBpZiBpdCBpc24ndCB3aWxsIHdlIHRyeSBhIHJlcXVpcmUuICBUaGlzICpzaG91bGQqXG4vLyBtYWtlIGl0IGVhc2llciB0byBidW5kbGUvb3Igbm90IGFuZCB0byB1c2Ugd2l0aCByZXF1aXJlanMuLi5cblRXRUVOID0gd2luZG93LlRXRUVOIHx8IHJlcXVpcmUoXCJ0d2Vlbi5qc1wiKTtcblxuZnVuY3Rpb24gU2Nyb2xsKHZpZXdPclNlbGVjdG9yLCBsaXN0ZW5lcikge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBtaW4sIG1heCwgb2Zmc2V0LCByZWZlcmVuY2UsIHByZXNzZWQsXG4gICAgICAgIHZlbG9jaXR5LCBmcmFtZSwgdGltZXN0YW1wLCB0aWNrZXIsXG4gICAgICAgIGFtcGxpdHVkZSwgdGFyZ2V0LCB0aW1lQ29uc3RhbnQsIGlubmVySGVpZ2h0O1xuXG4gICAgdmFyIHAwID0geyB5OiAwIH07XG4gICAgdmFyIHQwID0gZmFsc2U7XG5cbiAgICBmdW5jdGlvbiB5cG9zKGUpIHtcbiAgICAgICAgLy8gdG91Y2ggZXZlbnRcbiAgICAgICAgaWYgKGUudGFyZ2V0VG91Y2hlcyAmJiAoZS50YXJnZXRUb3VjaGVzLmxlbmd0aCA+PSAxKSkge1xuICAgICAgICAgICAgcmV0dXJuIGUudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRZO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW91c2UgZXZlbnRcbiAgICAgICAgcmV0dXJuIGUuY2xpZW50WTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY3JvbGwoeSkge1xuICAgICAgICBvZmZzZXQgPSAoeSA+IG1heCkgPyBtYXggOiAoeSA8IG1pbikgPyBtaW4gOiB5O1xuXG4gICAgICAgIHZpZXcuc2Nyb2xsVG9wID0gb2Zmc2V0O1xuICAgICAgICBsaXN0ZW5lci5jYWxsKHZpZXcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyYWNrKCkge1xuICAgICAgICB2YXIgbm93LCBlbGFwc2VkLCBkZWx0YSwgdjtcblxuICAgICAgICBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgICBlbGFwc2VkID0gbm93IC0gdGltZXN0YW1wO1xuICAgICAgICB0aW1lc3RhbXAgPSBub3c7XG4gICAgICAgIGRlbHRhID0gb2Zmc2V0IC0gZnJhbWU7XG4gICAgICAgIGZyYW1lID0gb2Zmc2V0O1xuXG4gICAgICAgIHYgPSAxMDAwICogZGVsdGEgLyAoMSArIGVsYXBzZWQpO1xuICAgICAgICB2ZWxvY2l0eSA9IDAuOCAqIHYgKyAwLjIgKiB2ZWxvY2l0eTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0aWNrKCkge1xuICAgICAgICBUV0VFTi51cGRhdGUoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0YXAoZSkge1xuICAgICAgICBwcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgcmVmZXJlbmNlID0geXBvcyhlKTtcblxuICAgICAgICB2ZWxvY2l0eSA9IGFtcGxpdHVkZSA9IDA7XG4gICAgICAgIGZyYW1lID0gb2Zmc2V0O1xuICAgICAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgICBjbGVhckludGVydmFsKHRpY2tlcik7XG4gICAgICAgIHRpY2tlciA9IHNldEludGVydmFsKHRyYWNrLCAxMDApO1xuXG4gICAgICAgIGlmKHQwKSB7XG4gICAgICAgICAgICB0MC5zdG9wKCk7XG4gICAgICAgICAgICB0MCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZHJhZyhlKSB7XG4gICAgICAgIHZhciB5LCBkZWx0YTtcbiAgICAgICAgaWYgKHByZXNzZWQpIHtcbiAgICAgICAgICAgIHkgPSB5cG9zKGUpO1xuICAgICAgICAgICAgZGVsdGEgPSByZWZlcmVuY2UgLSB5O1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMiB8fCBkZWx0YSA8IC0yKSB7XG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlID0geTtcbiAgICAgICAgICAgICAgICBzY3JvbGwob2Zmc2V0ICsgZGVsdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWxlYXNlKC8qZSovKSB7XG4gICAgICAgIHByZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICBjbGVhckludGVydmFsKHRpY2tlcik7XG5cbiAgICAgICAgLy8gSWYgbm8gdmVsb2NpdHkgeWV0LCB0cmFjayBvbmNlIG1ha2Ugc3VyZVxuICAgICAgICBpZih2ZWxvY2l0eSA9PT0gMCkgeyB0cmFjaygpOyB9XG5cbiAgICAgICAgaWYgKHZlbG9jaXR5ID4gMTAgfHwgdmVsb2NpdHkgPCAtMTApIHtcbiAgICAgICAgICAgIGFtcGxpdHVkZSA9IDAuOCAqIHZlbG9jaXR5O1xuICAgICAgICAgICAgdGFyZ2V0ID0gTWF0aC5yb3VuZChvZmZzZXQgKyBhbXBsaXR1ZGUpO1xuICAgICAgICAgICAgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgICAgICAgICAgcDAueSA9IHZpZXcuc2Nyb2xsVG9wO1xuICAgICAgICAgICAgdDAgPSBuZXcgVFdFRU4uVHdlZW4ocDApXG4gICAgICAgICAgICAgICAgLnRvKHt5OiB0YXJnZXR9LCB0aW1lQ29uc3RhbnQpXG4gICAgICAgICAgICAgICAgLmVhc2luZyhUV0VFTi5FYXNpbmcuUXVpbnRpYy5PdXQpXG4gICAgICAgICAgICAgICAgLm9uVXBkYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzY3JvbGwocDAueSk7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub25Db21wbGV0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsKHAwLnkpO1xuICAgICAgICAgICAgICAgICAgICB0MC5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgIHQwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHQwLnN0YXJ0KCk7XG4gICAgICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmlldyA9IHR5cGVvZiB2aWV3T3JTZWxlY3RvciA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHZpZXdPclNlbGVjdG9yKSA6IHZpZXdPclNlbGVjdG9yO1xuICAgIHRoaXMuYmluZCA9IGZ1bmN0aW9uIGF0dGFjaCgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmlldy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGFwKTtcbiAgICAgICAgICAgIHZpZXcuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgZHJhZyk7XG4gICAgICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgcmVsZWFzZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy51bmJpbmQgPSBmdW5jdGlvbiBkZXRhY2goKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRhcCk7XG4gICAgICAgICAgICB2aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICAgICAgdmlldy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHJlbGVhc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMucmVzZXQgPSBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgbWF4ID0gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUodmlldykuaGVpZ2h0LCAxMCkgLSBpbm5lckhlaWdodDtcbiAgICAgICAgb2Zmc2V0ID0gbWluID0gMDtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuICAgIH07XG5cbiAgICB0aW1lQ29uc3RhbnQgPSAyMDAwOyAvLyBtc1xuXG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMuYmluZCgpO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsO1xuIl19
(2)
});
