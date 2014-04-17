// Initial implementation: https://github.com/ariya/kinetic
(function(window, TWEEN, LiteList, undefined) {
    function Scroll(viewSelector, listener) {
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

            e.preventDefault();
            e.stopPropagation();
            return false;
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
            e.stopPropagation();
            return false;
        }

        function release(e) {
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

            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        view = document.querySelector(viewSelector);
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


    LiteList.Scroll = Scroll;
})(window, window.TWEEN, window.LiteList);