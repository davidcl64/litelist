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
    if (typeof window.ontouchstart !== 'undefined') {
        view.addEventListener('touchstart', tap);
        view.addEventListener('touchmove', drag);
        view.addEventListener('touchend', release);
    }

    this.unbind = function detach() {
        if (typeof window.ontouchstart !== 'undefined') {
            view.removeEventListener('touchstart', tap);
            view.removeEventListener('touchmove', drag);
            view.removeEventListener('touchend', release);
        }
    };

    max = parseInt(window.getComputedStyle(view).height, 10) - innerHeight;
    offset = min = 0;
    pressed = false;
    timeConstant = 2000; // ms
}


module.exports = Scroll;

},{"raf.js":1,"tween.js":"yazFk1"}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvc2Nyb2xsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qXG4gKiByYWYuanNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uZ3J5bWFuL3JhZi5qc1xuICpcbiAqIG9yaWdpbmFsIHJlcXVlc3RBbmltYXRpb25GcmFtZSBwb2x5ZmlsbCBieSBFcmlrIE3DtmxsZXJcbiAqIGluc3BpcmVkIGZyb20gcGF1bF9pcmlzaCBnaXN0IGFuZCBwb3N0XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIG5ncnltYW5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuXG4oZnVuY3Rpb24od2luZG93KSB7XG5cdHZhciBsYXN0VGltZSA9IDAsXG5cdFx0dmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddLFxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUsXG5cdFx0aSA9IHZlbmRvcnMubGVuZ3RoO1xuXG5cdC8vIHRyeSB0byB1bi1wcmVmaXggZXhpc3RpbmcgcmFmXG5cdHdoaWxlICgtLWkgPj0gMCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdDYW5jZWxBbmltYXRpb25GcmFtZSddO1xuXHR9XG5cblx0Ly8gcG9seWZpbGwgd2l0aCBzZXRUaW1lb3V0IGZhbGxiYWNrXG5cdC8vIGhlYXZpbHkgaW5zcGlyZWQgZnJvbSBAZGFyaXVzIGdpc3QgbW9kOiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvMTU3OTY3MSNjb21tZW50LTgzNzk0NVxuXHRpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCksIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcblx0XHRcdHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTtcblx0XHRcdH0sIG5leHRUaW1lIC0gbm93KTtcblx0XHR9O1xuXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XG5cdH1cblxuXHQvLyBleHBvcnQgdG8gd2luZG93XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lO1xufSh3aW5kb3cpKTsiLCJ2YXIgVFdFRU47XG5cbnJlcXVpcmUoXCJyYWYuanNcIik7XG5cbi8vIEp1c3QgaGVyZSB0byBzaW1wbGlmeSB0aGUgaW5pdGlhbGl6YXRpb24gbG9naWMuICBJZlxuLy8gd2luZG93IGRvZXNuJ3QgZXhpc3QsIHRoaXMgbW9kdWxlIGlzIHVzZWxlc3MgYW55d2F5XG5pZih0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgeyB3aW5kb3cgPSB7fTsgfVxuXG4vLyBUaGUgYnVpbGQgd2lsbCBkZWNsYXJlIFRXRUVOIGFzIGV4dGVybmFsLiBIb3dldmVyLCBpZiBpdCBpc24ndCBwcm92aWRlZCBieVxuLy8gYnJvd3NlcmlmeSwgd2UgcmVhbGx5IHdhbnQgdG8gY2hlY2sgdG8gc2VlIGlmIGl0IHdhcyBpbmNsdWRlZCBkaXJlY3RseSB2aWFcbi8vIHNjcmlwdCB0YWcgZmlyc3QuICBPbmx5IGlmIGl0IGlzbid0IHdpbGwgd2UgdHJ5IGEgcmVxdWlyZS4gIFRoaXMgKnNob3VsZCpcbi8vIG1ha2UgaXQgZWFzaWVyIHRvIGJ1bmRsZS9vciBub3QgYW5kIHRvIHVzZSB3aXRoIHJlcXVpcmVqcy4uLlxuVFdFRU4gPSB3aW5kb3cuVFdFRU4gfHwgcmVxdWlyZShcInR3ZWVuLmpzXCIpO1xuXG5mdW5jdGlvbiBTY3JvbGwodmlld09yU2VsZWN0b3IsIGxpc3RlbmVyKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG1pbiwgbWF4LCBvZmZzZXQsIHJlZmVyZW5jZSwgcHJlc3NlZCxcbiAgICAgICAgdmVsb2NpdHksIGZyYW1lLCB0aW1lc3RhbXAsIHRpY2tlcixcbiAgICAgICAgYW1wbGl0dWRlLCB0YXJnZXQsIHRpbWVDb25zdGFudCwgaW5uZXJIZWlnaHQ7XG5cbiAgICB2YXIgcDAgPSB7IHk6IDAgfTtcbiAgICB2YXIgdDAgPSBmYWxzZTtcblxuICAgIGZ1bmN0aW9uIHlwb3MoZSkge1xuICAgICAgICAvLyB0b3VjaCBldmVudFxuICAgICAgICBpZiAoZS50YXJnZXRUb3VjaGVzICYmIChlLnRhcmdldFRvdWNoZXMubGVuZ3RoID49IDEpKSB7XG4gICAgICAgICAgICByZXR1cm4gZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3VzZSBldmVudFxuICAgICAgICByZXR1cm4gZS5jbGllbnRZO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbCh5KSB7XG4gICAgICAgIG9mZnNldCA9ICh5ID4gbWF4KSA/IG1heCA6ICh5IDwgbWluKSA/IG1pbiA6IHk7XG5cbiAgICAgICAgdmlldy5zY3JvbGxUb3AgPSBvZmZzZXQ7XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodmlldyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJhY2soKSB7XG4gICAgICAgIHZhciBub3csIGVsYXBzZWQsIGRlbHRhLCB2O1xuXG4gICAgICAgIG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIGVsYXBzZWQgPSBub3cgLSB0aW1lc3RhbXA7XG4gICAgICAgIHRpbWVzdGFtcCA9IG5vdztcbiAgICAgICAgZGVsdGEgPSBvZmZzZXQgLSBmcmFtZTtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG5cbiAgICAgICAgdiA9IDEwMDAgKiBkZWx0YSAvICgxICsgZWxhcHNlZCk7XG4gICAgICAgIHZlbG9jaXR5ID0gMC44ICogdiArIDAuMiAqIHZlbG9jaXR5O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRpY2soKSB7XG4gICAgICAgIFRXRUVOLnVwZGF0ZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRhcChlKSB7XG4gICAgICAgIHByZXNzZWQgPSB0cnVlO1xuICAgICAgICByZWZlcmVuY2UgPSB5cG9zKGUpO1xuXG4gICAgICAgIHZlbG9jaXR5ID0gYW1wbGl0dWRlID0gMDtcbiAgICAgICAgZnJhbWUgPSBvZmZzZXQ7XG4gICAgICAgIHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcbiAgICAgICAgdGlja2VyID0gc2V0SW50ZXJ2YWwodHJhY2ssIDEwMCk7XG5cbiAgICAgICAgaWYodDApIHtcbiAgICAgICAgICAgIHQwLnN0b3AoKTtcbiAgICAgICAgICAgIHQwID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkcmFnKGUpIHtcbiAgICAgICAgdmFyIHksIGRlbHRhO1xuICAgICAgICBpZiAocHJlc3NlZCkge1xuICAgICAgICAgICAgeSA9IHlwb3MoZSk7XG4gICAgICAgICAgICBkZWx0YSA9IHJlZmVyZW5jZSAtIHk7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAyIHx8IGRlbHRhIDwgLTIpIHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2UgPSB5O1xuICAgICAgICAgICAgICAgIHNjcm9sbChvZmZzZXQgKyBkZWx0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbGVhc2UoLyplKi8pIHtcbiAgICAgICAgcHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGlja2VyKTtcblxuICAgICAgICAvLyBJZiBubyB2ZWxvY2l0eSB5ZXQsIHRyYWNrIG9uY2UgbWFrZSBzdXJlXG4gICAgICAgIGlmKHZlbG9jaXR5ID09PSAwKSB7IHRyYWNrKCk7IH1cblxuICAgICAgICBpZiAodmVsb2NpdHkgPiAxMCB8fCB2ZWxvY2l0eSA8IC0xMCkge1xuICAgICAgICAgICAgYW1wbGl0dWRlID0gMC44ICogdmVsb2NpdHk7XG4gICAgICAgICAgICB0YXJnZXQgPSBNYXRoLnJvdW5kKG9mZnNldCArIGFtcGxpdHVkZSk7XG4gICAgICAgICAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgICAgICBwMC55ID0gdmlldy5zY3JvbGxUb3A7XG4gICAgICAgICAgICB0MCA9IG5ldyBUV0VFTi5Ud2VlbihwMClcbiAgICAgICAgICAgICAgICAudG8oe3k6IHRhcmdldH0sIHRpbWVDb25zdGFudClcbiAgICAgICAgICAgICAgICAuZWFzaW5nKFRXRUVOLkVhc2luZy5RdWludGljLk91dClcbiAgICAgICAgICAgICAgICAub25VcGRhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbkNvbXBsZXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzY3JvbGwocDAueSk7XG4gICAgICAgICAgICAgICAgICAgIHQwLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgdDAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdDAuc3RhcnQoKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2aWV3ID0gdHlwZW9mIHZpZXdPclNlbGVjdG9yID09PSAnc3RyaW5nJyA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iodmlld09yU2VsZWN0b3IpIDogdmlld09yU2VsZWN0b3I7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0YXApO1xuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgcmVsZWFzZSk7XG4gICAgfVxuXG4gICAgdGhpcy51bmJpbmQgPSBmdW5jdGlvbiBkZXRhY2goKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRhcCk7XG4gICAgICAgICAgICB2aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICAgICAgdmlldy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHJlbGVhc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIG1heCA9IHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHZpZXcpLmhlaWdodCwgMTApIC0gaW5uZXJIZWlnaHQ7XG4gICAgb2Zmc2V0ID0gbWluID0gMDtcbiAgICBwcmVzc2VkID0gZmFsc2U7XG4gICAgdGltZUNvbnN0YW50ID0gMjAwMDsgLy8gbXNcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFNjcm9sbDtcbiJdfQ==
(2)
});
