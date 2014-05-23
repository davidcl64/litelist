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

    max = parseInt(window.getComputedStyle(view).height, 10) - innerHeight;
    offset = min = 0;
    pressed = false;
    timeConstant = 2000; // ms

    this.bind();
}


module.exports = Scroll;

},{"raf.js":1,"tween.js":"yazFk1"}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZGF2ZS9wZXJzb25hbC9jbm0vbGl0ZWxpc3Qvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9Vc2Vycy9kYXZlL3BlcnNvbmFsL2NubS9saXRlbGlzdC9zcmMvc2Nyb2xsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLypcbiAqIHJhZi5qc1xuICogaHR0cHM6Ly9naXRodWIuY29tL25ncnltYW4vcmFmLmpzXG4gKlxuICogb3JpZ2luYWwgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHBvbHlmaWxsIGJ5IEVyaWsgTcO2bGxlclxuICogaW5zcGlyZWQgZnJvbSBwYXVsX2lyaXNoIGdpc3QgYW5kIHBvc3RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgbmdyeW1hblxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG5cbihmdW5jdGlvbih3aW5kb3cpIHtcblx0dmFyIGxhc3RUaW1lID0gMCxcblx0XHR2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J10sXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSxcblx0XHRpID0gdmVuZG9ycy5sZW5ndGg7XG5cblx0Ly8gdHJ5IHRvIHVuLXByZWZpeCBleGlzdGluZyByYWZcblx0d2hpbGUgKC0taSA+PSAwICYmICFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ107XG5cdH1cblxuXHQvLyBwb2x5ZmlsbCB3aXRoIHNldFRpbWVvdXQgZmFsbGJhY2tcblx0Ly8gaGVhdmlseSBpbnNwaXJlZCBmcm9tIEBkYXJpdXMgZ2lzdCBtb2Q6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC8xNTc5NjcxI2NvbW1lbnQtODM3OTQ1XG5cdGlmICghcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICFjYW5jZWxBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbm93ID0gRGF0ZS5ub3coKSwgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xuXHRcdFx0cmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpO1xuXHRcdFx0fSwgbmV4dFRpbWUgLSBub3cpO1xuXHRcdH07XG5cblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcblx0fVxuXG5cdC8vIGV4cG9ydCB0byB3aW5kb3dcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZTtcblx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG59KHdpbmRvdykpOyIsInZhciBUV0VFTjtcblxucmVxdWlyZShcInJhZi5qc1wiKTtcblxuLy8gSnVzdCBoZXJlIHRvIHNpbXBsaWZ5IHRoZSBpbml0aWFsaXphdGlvbiBsb2dpYy4gIElmXG4vLyB3aW5kb3cgZG9lc24ndCBleGlzdCwgdGhpcyBtb2R1bGUgaXMgdXNlbGVzcyBhbnl3YXlcbmlmKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7IHdpbmRvdyA9IHt9OyB9XG5cbi8vIFRoZSBidWlsZCB3aWxsIGRlY2xhcmUgVFdFRU4gYXMgZXh0ZXJuYWwuIEhvd2V2ZXIsIGlmIGl0IGlzbid0IHByb3ZpZGVkIGJ5XG4vLyBicm93c2VyaWZ5LCB3ZSByZWFsbHkgd2FudCB0byBjaGVjayB0byBzZWUgaWYgaXQgd2FzIGluY2x1ZGVkIGRpcmVjdGx5IHZpYVxuLy8gc2NyaXB0IHRhZyBmaXJzdC4gIE9ubHkgaWYgaXQgaXNuJ3Qgd2lsbCB3ZSB0cnkgYSByZXF1aXJlLiAgVGhpcyAqc2hvdWxkKlxuLy8gbWFrZSBpdCBlYXNpZXIgdG8gYnVuZGxlL29yIG5vdCBhbmQgdG8gdXNlIHdpdGggcmVxdWlyZWpzLi4uXG5UV0VFTiA9IHdpbmRvdy5UV0VFTiB8fCByZXF1aXJlKFwidHdlZW4uanNcIik7XG5cbmZ1bmN0aW9uIFNjcm9sbCh2aWV3T3JTZWxlY3RvciwgbGlzdGVuZXIpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgbWluLCBtYXgsIG9mZnNldCwgcmVmZXJlbmNlLCBwcmVzc2VkLFxuICAgICAgICB2ZWxvY2l0eSwgZnJhbWUsIHRpbWVzdGFtcCwgdGlja2VyLFxuICAgICAgICBhbXBsaXR1ZGUsIHRhcmdldCwgdGltZUNvbnN0YW50LCBpbm5lckhlaWdodDtcblxuICAgIHZhciBwMCA9IHsgeTogMCB9O1xuICAgIHZhciB0MCA9IGZhbHNlO1xuXG4gICAgZnVuY3Rpb24geXBvcyhlKSB7XG4gICAgICAgIC8vIHRvdWNoIGV2ZW50XG4gICAgICAgIGlmIChlLnRhcmdldFRvdWNoZXMgJiYgKGUudGFyZ2V0VG91Y2hlcy5sZW5ndGggPj0gMSkpIHtcbiAgICAgICAgICAgIHJldHVybiBlLnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1vdXNlIGV2ZW50XG4gICAgICAgIHJldHVybiBlLmNsaWVudFk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2Nyb2xsKHkpIHtcbiAgICAgICAgb2Zmc2V0ID0gKHkgPiBtYXgpID8gbWF4IDogKHkgPCBtaW4pID8gbWluIDogeTtcblxuICAgICAgICB2aWV3LnNjcm9sbFRvcCA9IG9mZnNldDtcbiAgICAgICAgbGlzdGVuZXIuY2FsbCh2aWV3KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFjaygpIHtcbiAgICAgICAgdmFyIG5vdywgZWxhcHNlZCwgZGVsdGEsIHY7XG5cbiAgICAgICAgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgZWxhcHNlZCA9IG5vdyAtIHRpbWVzdGFtcDtcbiAgICAgICAgdGltZXN0YW1wID0gbm93O1xuICAgICAgICBkZWx0YSA9IG9mZnNldCAtIGZyYW1lO1xuICAgICAgICBmcmFtZSA9IG9mZnNldDtcblxuICAgICAgICB2ID0gMTAwMCAqIGRlbHRhIC8gKDEgKyBlbGFwc2VkKTtcbiAgICAgICAgdmVsb2NpdHkgPSAwLjggKiB2ICsgMC4yICogdmVsb2NpdHk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGljaygpIHtcbiAgICAgICAgVFdFRU4udXBkYXRlKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGFwKGUpIHtcbiAgICAgICAgcHJlc3NlZCA9IHRydWU7XG4gICAgICAgIHJlZmVyZW5jZSA9IHlwb3MoZSk7XG5cbiAgICAgICAgdmVsb2NpdHkgPSBhbXBsaXR1ZGUgPSAwO1xuICAgICAgICBmcmFtZSA9IG9mZnNldDtcbiAgICAgICAgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aWNrZXIpO1xuICAgICAgICB0aWNrZXIgPSBzZXRJbnRlcnZhbCh0cmFjaywgMTAwKTtcblxuICAgICAgICBpZih0MCkge1xuICAgICAgICAgICAgdDAuc3RvcCgpO1xuICAgICAgICAgICAgdDAgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRyYWcoZSkge1xuICAgICAgICB2YXIgeSwgZGVsdGE7XG4gICAgICAgIGlmIChwcmVzc2VkKSB7XG4gICAgICAgICAgICB5ID0geXBvcyhlKTtcbiAgICAgICAgICAgIGRlbHRhID0gcmVmZXJlbmNlIC0geTtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDIgfHwgZGVsdGEgPCAtMikge1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZSA9IHk7XG4gICAgICAgICAgICAgICAgc2Nyb2xsKG9mZnNldCArIGRlbHRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVsZWFzZSgvKmUqLykge1xuICAgICAgICBwcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aWNrZXIpO1xuXG4gICAgICAgIC8vIElmIG5vIHZlbG9jaXR5IHlldCwgdHJhY2sgb25jZSBtYWtlIHN1cmVcbiAgICAgICAgaWYodmVsb2NpdHkgPT09IDApIHsgdHJhY2soKTsgfVxuXG4gICAgICAgIGlmICh2ZWxvY2l0eSA+IDEwIHx8IHZlbG9jaXR5IDwgLTEwKSB7XG4gICAgICAgICAgICBhbXBsaXR1ZGUgPSAwLjggKiB2ZWxvY2l0eTtcbiAgICAgICAgICAgIHRhcmdldCA9IE1hdGgucm91bmQob2Zmc2V0ICsgYW1wbGl0dWRlKTtcbiAgICAgICAgICAgIHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG5cbiAgICAgICAgICAgIHAwLnkgPSB2aWV3LnNjcm9sbFRvcDtcbiAgICAgICAgICAgIHQwID0gbmV3IFRXRUVOLlR3ZWVuKHAwKVxuICAgICAgICAgICAgICAgIC50byh7eTogdGFyZ2V0fSwgdGltZUNvbnN0YW50KVxuICAgICAgICAgICAgICAgIC5lYXNpbmcoVFdFRU4uRWFzaW5nLlF1aW50aWMuT3V0KVxuICAgICAgICAgICAgICAgIC5vblVwZGF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsKHAwLnkpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uQ29tcGxldGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbChwMC55KTtcbiAgICAgICAgICAgICAgICAgICAgdDAuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICB0MCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0MC5zdGFydCgpO1xuICAgICAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZpZXcgPSB0eXBlb2Ygdmlld09yU2VsZWN0b3IgPT09ICdzdHJpbmcnID8gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih2aWV3T3JTZWxlY3RvcikgOiB2aWV3T3JTZWxlY3RvcjtcbiAgICB0aGlzLmJpbmQgPSBmdW5jdGlvbiBhdHRhY2goKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZpZXcuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRhcCk7XG4gICAgICAgICAgICB2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGRyYWcpO1xuICAgICAgICAgICAgdmlldy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHJlbGVhc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMudW5iaW5kID0gZnVuY3Rpb24gZGV0YWNoKCkge1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdy5vbnRvdWNoc3RhcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2aWV3LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0YXApO1xuICAgICAgICAgICAgdmlldy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBkcmFnKTtcbiAgICAgICAgICAgIHZpZXcucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCByZWxlYXNlKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBtYXggPSBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh2aWV3KS5oZWlnaHQsIDEwKSAtIGlubmVySGVpZ2h0O1xuICAgIG9mZnNldCA9IG1pbiA9IDA7XG4gICAgcHJlc3NlZCA9IGZhbHNlO1xuICAgIHRpbWVDb25zdGFudCA9IDIwMDA7IC8vIG1zXG5cbiAgICB0aGlzLmJpbmQoKTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFNjcm9sbDtcbiJdfQ==
(2)
});
