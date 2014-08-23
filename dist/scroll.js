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
// borrowed heavily from [ariya/kinetic](https://github.com/ariya/kinetic)
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

},{"raf.js":1,"tween.js":"yazFk1"}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvc2Nyb2xsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogcmFmLmpzXG4gKiBodHRwczovL2dpdGh1Yi5jb20vbmdyeW1hbi9yYWYuanNcbiAqXG4gKiBvcmlnaW5hbCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyXG4gKiBpbnNwaXJlZCBmcm9tIHBhdWxfaXJpc2ggZ2lzdCBhbmQgcG9zdFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBuZ3J5bWFuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cblxuKGZ1bmN0aW9uKHdpbmRvdykge1xuXHR2YXIgbGFzdFRpbWUgPSAwLFxuXHRcdHZlbmRvcnMgPSBbJ3dlYmtpdCcsICdtb3onXSxcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lLFxuXHRcdGkgPSB2ZW5kb3JzLmxlbmd0aDtcblxuXHQvLyB0cnkgdG8gdW4tcHJlZml4IGV4aXN0aW5nIHJhZlxuXHR3aGlsZSAoLS1pID49IDAgJiYgIXJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXTtcblx0fVxuXG5cdC8vIHBvbHlmaWxsIHdpdGggc2V0VGltZW91dCBmYWxsYmFja1xuXHQvLyBoZWF2aWx5IGluc3BpcmVkIGZyb20gQGRhcml1cyBnaXN0IG1vZDogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vcGF1bGlyaXNoLzE1Nzk2NzEjY29tbWVudC04Mzc5NDVcblx0aWYgKCFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIWNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHZhciBub3cgPSBEYXRlLm5vdygpLCBuZXh0VGltZSA9IE1hdGgubWF4KGxhc3RUaW1lICsgMTYsIG5vdyk7XG5cdFx0XHRyZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0Y2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7XG5cdFx0XHR9LCBuZXh0VGltZSAtIG5vdyk7XG5cdFx0fTtcblxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2xlYXJUaW1lb3V0O1xuXHR9XG5cblx0Ly8gZXhwb3J0IHRvIHdpbmRvd1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjYW5jZWxBbmltYXRpb25GcmFtZTtcbn0od2luZG93KSk7IiwiLy8gYm9ycm93ZWQgaGVhdmlseSBmcm9tIFthcml5YS9raW5ldGljXShodHRwczovL2dpdGh1Yi5jb20vYXJpeWEva2luZXRpYylcbnZhciBUV0VFTjtcblxucmVxdWlyZShcInJhZi5qc1wiKTtcblxuLy8gSnVzdCBoZXJlIHRvIHNpbXBsaWZ5IHRoZSBpbml0aWFsaXphdGlvbiBsb2dpYy4gIElmXG4vLyB3aW5kb3cgZG9lc24ndCBleGlzdCwgdGhpcyBtb2R1bGUgaXMgdXNlbGVzcyBhbnl3YXlcbmlmKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7IHdpbmRvdyA9IHt9OyB9XG5cbi8vIFRoZSBidWlsZCB3aWxsIGRlY2xhcmUgVFdFRU4gYXMgZXh0ZXJuYWwuIEhvd2V2ZXIsIGlmIGl0IGlzbid0IHByb3ZpZGVkIGJ5XG4vLyBicm93c2VyaWZ5LCB3ZSByZWFsbHkgd2FudCB0byBjaGVjayB0byBzZWUgaWYgaXQgd2FzIGluY2x1ZGVkIGRpcmVjdGx5IHZpYVxuLy8gc2NyaXB0IHRhZyBmaXJzdC4gIE9ubHkgaWYgaXQgaXNuJ3Qgd2lsbCB3ZSB0cnkgYSByZXF1aXJlLiAgVGhpcyAqc2hvdWxkKlxuLy8gbWFrZSBpdCBlYXNpZXIgdG8gYnVuZGxlL29yIG5vdCBhbmQgdG8gdXNlIHdpdGggcmVxdWlyZWpzLi4uXG5UV0VFTiA9IHdpbmRvdy5UV0VFTiB8fCByZXF1aXJlKFwidHdlZW4uanNcIik7XG5cbmZ1bmN0aW9uIFNjcm9sbCh2aWV3T3JTZWxlY3RvciwgbGlzdGVuZXIpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgbWluLCBtYXgsIG9mZnNldCwgcmVmZXJlbmNlLCBwcmVzc2VkLFxuICAgICAgICB2ZWxvY2l0eSwgZnJhbWUsIHRpbWVzdGFtcCwgdGlja2VyLCB0d2VlblRpY2tlcixcbiAgICAgICAgYW1wbGl0dWRlLCB0YXJnZXQsIHRpbWVDb25zdGFudCwgaW5uZXJIZWlnaHQ7XG5cbiAgICB2YXIgcDAgPSB7IHk6IDAgfTtcbiAgICB2YXIgdDAgPSBmYWxzZTtcblxuICAgIGZ1bmN0aW9uIHlwb3MoZSkge1xuICAgICAgICAvLyB0b3VjaCBldmVudFxuICAgICAgICBpZiAoZS50YXJnZXRUb3VjaGVzICYmIChlLnRhcmdldFRvdWNoZXMubGVuZ3RoID49IDEpKSB7XG4gICAgICAgICAgICByZXR1cm4gZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3VzZSBldmVudFxuICAgICAgICByZXR1cm4gZS5jbGllbnRZO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbCh5KSB7XG4gICAgICAgIG9mZnNldCA9ICh5ID4gbWF4KSA/IG1heCA6ICh5IDwgbWluKSA/IG1pbiA6IHk7XG5cbiAgICAgICAgdmlldy5zY3JvbGxUb3AgPSBvZmZzZXQ7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodmlldyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhY2soKSB7XG4gICAgICAgIHZhciBub3csIGVsYXBzZWQsIGRlbHRhLCB2O1xuXG4gICAgICAgIG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIGVsYXBzZWQgPSBub3cgLSB0aW1lc3RhbXA7XG4gICAgICAgIHRpbWVzdGFtcCA9IG5vdztcbiAgICAgICAgZGVsdGEgPSBvZmZzZXQgLSBmcmFtZTtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG5cbiAgICAgICAgdiA9IDEwMDAgKiBkZWx0YSAvICgxICsgZWxhcHNlZCk7XG4gICAgICAgIHZlbG9jaXR5ID0gMC44ICogdiArIDAuMiAqIHZlbG9jaXR5O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRpY2soKSB7XG4gICAgICAgIFRXRUVOLnVwZGF0ZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRhcChlKSB7XG4gICAgICAgIHByZXNzZWQgPSB0cnVlO1xuICAgICAgICByZWZlcmVuY2UgPSB5cG9zKGUpO1xuXG4gICAgICAgIHZlbG9jaXR5ID0gYW1wbGl0dWRlID0gMDtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG4gICAgICAgIHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcbiAgICAgICAgdGlja2VyID0gc2V0SW50ZXJ2YWwodHJhY2ssIDEwMCk7XG5cbiAgICAgICAgaWYodDApIHtcbiAgICAgICAgICAgIHQwLnN0b3AoKTtcbiAgICAgICAgICAgIHQwID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkcmFnKGUpIHtcbiAgICAgICAgdmFyIHksIGRlbHRhO1xuICAgICAgICBpZiAocHJlc3NlZCkge1xuICAgICAgICAgICAgeSA9IHlwb3MoZSk7XG4gICAgICAgICAgICBkZWx0YSA9IHJlZmVyZW5jZSAtIHk7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAyIHx8IGRlbHRhIDwgLTIpIHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2UgPSB5O1xuICAgICAgICAgICAgICAgIHNjcm9sbChvZmZzZXQgKyBkZWx0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbGVhc2UoLyplKi8pIHtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcblxuICAgICAgICAvLyBJZiBubyB2ZWxvY2l0eSB5ZXQsIHRyYWNrIG9uY2UgbWFrZSBzdXJlXG4gICAgICAgIGlmKHZlbG9jaXR5ID09PSAwKSB7IHRyYWNrKCk7IH1cblxuICAgICAgICBpZiAodmVsb2NpdHkgPiAxMCB8fCB2ZWxvY2l0eSA8IC0xMCkge1xuICAgICAgICAgICAgYW1wbGl0dWRlID0gMC44ICogdmVsb2NpdHk7XG4gICAgICAgICAgICB0YXJnZXQgPSBNYXRoLnJvdW5kKG9mZnNldCArIGFtcGxpdHVkZSk7XG4gICAgICAgICAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgICAgICBwMC55ID0gdmlldy5zY3JvbGxUb3A7XG4gICAgICAgICAgICB0MCA9IG5ldyBUV0VFTi5Ud2VlbihwMClcbiAgICAgICAgICAgICAgICAudG8oe3k6IHRhcmdldH0sIHRpbWVDb25zdGFudClcbiAgICAgICAgICAgICAgICAuZWFzaW5nKFRXRUVOLkVhc2luZy5RdWludGljLk91dClcbiAgICAgICAgICAgICAgICAub25VcGRhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgdHdlZW5UaWNrZXIgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uQ29tcGxldGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgdDAuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICB0MCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0MC5zdGFydCgpO1xuICAgICAgICAgICAgdHdlZW5UaWNrZXIgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmlldyA9IHR5cGVvZiB2aWV3T3JTZWxlY3RvciA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHZpZXdPclNlbGVjdG9yKSA6IHZpZXdPclNlbGVjdG9yO1xuICAgIHRoaXMuYmluZCA9IGZ1bmN0aW9uIGF0dGFjaCgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmlldy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGFwKTtcbiAgICAgICAgICAgIHZpZXcuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgZHJhZyk7XG4gICAgICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgcmVsZWFzZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy51bmJpbmQgPSBmdW5jdGlvbiBkZXRhY2goKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRhcCk7XG4gICAgICAgICAgICB2aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICAgICAgdmlldy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHJlbGVhc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMucmVzZXQgPSBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgbWF4ID0gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUodmlldykuaGVpZ2h0LCAxMCkgLSBpbm5lckhlaWdodDtcbiAgICAgICAgb2Zmc2V0ID0gbWluID0gMDtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICBjbGVhckludGVydmFsKHRpY2tlcik7XG4gICAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSh0d2VlblRpY2tlcik7XG4gICAgfTtcblxuICAgIHRpbWVDb25zdGFudCA9IDIwMDA7IC8vIG1zXG5cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5iaW5kKCk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBTY3JvbGw7XG4iXX0=
(2)
});
