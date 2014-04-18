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

/**
 * @author sole / http://soledadpenades.com
 * @author mrdoob / http://mrdoob.com
 * @author Robert Eisele / http://www.xarg.org
 * @author Philippe / http://philippe.elsass.me
 * @author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html
 * @author Paul Lewis / http://www.aerotwist.com/
 * @author lechecacharro
 * @author Josh Faul / http://jocafa.com/
 * @author egraether / http://egraether.com/
 * @author endel / http://endel.me
 * @author Ben Delarre / http://delarre.net
 */

// Date.now shim for (ahem) Internet Explo(d|r)er
if ( Date.now === undefined ) {

	Date.now = function () {

		return new Date().valueOf();

	};

}

var TWEEN = TWEEN || ( function () {

	var _tweens = [];

	return {

		REVISION: '12',

		getAll: function () {

			return _tweens;

		},

		removeAll: function () {

			_tweens = [];

		},

		add: function ( tween ) {

			_tweens.push( tween );

		},

		remove: function ( tween ) {

			var i = _tweens.indexOf( tween );

			if ( i !== -1 ) {

				_tweens.splice( i, 1 );

			}

		},

		update: function ( time ) {

			if ( _tweens.length === 0 ) return false;

			var i = 0;

			time = time !== undefined ? time : ( typeof window !== 'undefined' && window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );

			while ( i < _tweens.length ) {

				if ( _tweens[ i ].update( time ) ) {

					i++;

				} else {

					_tweens.splice( i, 1 );

				}

			}

			return true;

		}
	};

} )();

TWEEN.Tween = function ( object ) {

	var _object = object;
	var _valuesStart = {};
	var _valuesEnd = {};
	var _valuesStartRepeat = {};
	var _duration = 1000;
	var _repeat = 0;
	var _yoyo = false;
	var _isPlaying = false;
	var _reversed = false;
	var _delayTime = 0;
	var _startTime = null;
	var _easingFunction = TWEEN.Easing.Linear.None;
	var _interpolationFunction = TWEEN.Interpolation.Linear;
	var _chainedTweens = [];
	var _onStartCallback = null;
	var _onStartCallbackFired = false;
	var _onUpdateCallback = null;
	var _onCompleteCallback = null;

	// Set all starting values present on the target object
	for ( var field in object ) {

		_valuesStart[ field ] = parseFloat(object[field], 10);

	}

	this.to = function ( properties, duration ) {

		if ( duration !== undefined ) {

			_duration = duration;

		}

		_valuesEnd = properties;

		return this;

	};

	this.start = function ( time ) {

		TWEEN.add( this );

		_isPlaying = true;

		_onStartCallbackFired = false;

		_startTime = time !== undefined ? time : ( typeof window !== 'undefined' && window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );
		_startTime += _delayTime;

		for ( var property in _valuesEnd ) {

			// check if an Array was provided as property value
			if ( _valuesEnd[ property ] instanceof Array ) {

				if ( _valuesEnd[ property ].length === 0 ) {

					continue;

				}

				// create a local copy of the Array with the start value at the front
				_valuesEnd[ property ] = [ _object[ property ] ].concat( _valuesEnd[ property ] );

			}

			_valuesStart[ property ] = _object[ property ];

			if( ( _valuesStart[ property ] instanceof Array ) === false ) {
				_valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
			}

			_valuesStartRepeat[ property ] = _valuesStart[ property ] || 0;

		}

		return this;

	};

	this.stop = function () {

		if ( !_isPlaying ) {
			return this;
		}

		TWEEN.remove( this );
		_isPlaying = false;
		this.stopChainedTweens();
		return this;

	};

	this.stopChainedTweens = function () {

		for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++ ) {

			_chainedTweens[ i ].stop();

		}

	};

	this.delay = function ( amount ) {

		_delayTime = amount;
		return this;

	};

	this.repeat = function ( times ) {

		_repeat = times;
		return this;

	};

	this.yoyo = function( yoyo ) {

		_yoyo = yoyo;
		return this;

	};


	this.easing = function ( easing ) {

		_easingFunction = easing;
		return this;

	};

	this.interpolation = function ( interpolation ) {

		_interpolationFunction = interpolation;
		return this;

	};

	this.chain = function () {

		_chainedTweens = arguments;
		return this;

	};

	this.onStart = function ( callback ) {

		_onStartCallback = callback;
		return this;

	};

	this.onUpdate = function ( callback ) {

		_onUpdateCallback = callback;
		return this;

	};

	this.onComplete = function ( callback ) {

		_onCompleteCallback = callback;
		return this;

	};

	this.update = function ( time ) {

		var property;

		if ( time < _startTime ) {

			return true;

		}

		if ( _onStartCallbackFired === false ) {

			if ( _onStartCallback !== null ) {

				_onStartCallback.call( _object );

			}

			_onStartCallbackFired = true;

		}

		var elapsed = ( time - _startTime ) / _duration;
		elapsed = elapsed > 1 ? 1 : elapsed;

		var value = _easingFunction( elapsed );

		for ( property in _valuesEnd ) {

			var start = _valuesStart[ property ] || 0;
			var end = _valuesEnd[ property ];

			if ( end instanceof Array ) {

				_object[ property ] = _interpolationFunction( end, value );

			} else {

                // Parses relative end values with start as base (e.g.: +10, -3)
				if ( typeof(end) === "string" ) {
					end = start + parseFloat(end, 10);
				}

				// protect against non numeric properties.
                if ( typeof(end) === "number" ) {
					_object[ property ] = start + ( end - start ) * value;
				}

			}

		}

		if ( _onUpdateCallback !== null ) {

			_onUpdateCallback.call( _object, value );

		}

		if ( elapsed == 1 ) {

			if ( _repeat > 0 ) {

				if( isFinite( _repeat ) ) {
					_repeat--;
				}

				// reassign starting values, restart by making startTime = now
				for( property in _valuesStartRepeat ) {

					if ( typeof( _valuesEnd[ property ] ) === "string" ) {
						_valuesStartRepeat[ property ] = _valuesStartRepeat[ property ] + parseFloat(_valuesEnd[ property ], 10);
					}

					if (_yoyo) {
						var tmp = _valuesStartRepeat[ property ];
						_valuesStartRepeat[ property ] = _valuesEnd[ property ];
						_valuesEnd[ property ] = tmp;
						_reversed = !_reversed;
					}
					_valuesStart[ property ] = _valuesStartRepeat[ property ];

				}

				_startTime = time + _delayTime;

				return true;

			} else {

				if ( _onCompleteCallback !== null ) {

					_onCompleteCallback.call( _object );

				}

				for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++ ) {

					_chainedTweens[ i ].start( time );

				}

				return false;

			}

		}

		return true;

	};

};


TWEEN.Easing = {

	Linear: {

		None: function ( k ) {

			return k;

		}

	},

	Quadratic: {

		In: function ( k ) {

			return k * k;

		},

		Out: function ( k ) {

			return k * ( 2 - k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
			return - 0.5 * ( --k * ( k - 2 ) - 1 );

		}

	},

	Cubic: {

		In: function ( k ) {

			return k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );

		}

	},

	Quartic: {

		In: function ( k ) {

			return k * k * k * k;

		},

		Out: function ( k ) {

			return 1 - ( --k * k * k * k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
			return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

		}

	},

	Quintic: {

		In: function ( k ) {

			return k * k * k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

		}

	},

	Sinusoidal: {

		In: function ( k ) {

			return 1 - Math.cos( k * Math.PI / 2 );

		},

		Out: function ( k ) {

			return Math.sin( k * Math.PI / 2 );

		},

		InOut: function ( k ) {

			return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

		}

	},

	Exponential: {

		In: function ( k ) {

			return k === 0 ? 0 : Math.pow( 1024, k - 1 );

		},

		Out: function ( k ) {

			return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

		},

		InOut: function ( k ) {

			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
			return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

		}

	},

	Circular: {

		In: function ( k ) {

			return 1 - Math.sqrt( 1 - k * k );

		},

		Out: function ( k ) {

			return Math.sqrt( 1 - ( --k * k ) );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
			return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

		}

	},

	Elastic: {

		In: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

		},

		Out: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

		},

		InOut: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
			return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

		}

	},

	Back: {

		In: function ( k ) {

			var s = 1.70158;
			return k * k * ( ( s + 1 ) * k - s );

		},

		Out: function ( k ) {

			var s = 1.70158;
			return --k * k * ( ( s + 1 ) * k + s ) + 1;

		},

		InOut: function ( k ) {

			var s = 1.70158 * 1.525;
			if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
			return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

		}

	},

	Bounce: {

		In: function ( k ) {

			return 1 - TWEEN.Easing.Bounce.Out( 1 - k );

		},

		Out: function ( k ) {

			if ( k < ( 1 / 2.75 ) ) {

				return 7.5625 * k * k;

			} else if ( k < ( 2 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

			} else if ( k < ( 2.5 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

			} else {

				return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

			}

		},

		InOut: function ( k ) {

			if ( k < 0.5 ) return TWEEN.Easing.Bounce.In( k * 2 ) * 0.5;
			return TWEEN.Easing.Bounce.Out( k * 2 - 1 ) * 0.5 + 0.5;

		}

	}

};

TWEEN.Interpolation = {

	Linear: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.Linear;

		if ( k < 0 ) return fn( v[ 0 ], v[ 1 ], f );
		if ( k > 1 ) return fn( v[ m ], v[ m - 1 ], m - f );

		return fn( v[ i ], v[ i + 1 > m ? m : i + 1 ], f - i );

	},

	Bezier: function ( v, k ) {

		var b = 0, n = v.length - 1, pw = Math.pow, bn = TWEEN.Interpolation.Utils.Bernstein, i;

		for ( i = 0; i <= n; i++ ) {
			b += pw( 1 - k, n - i ) * pw( k, i ) * v[ i ] * bn( n, i );
		}

		return b;

	},

	CatmullRom: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.CatmullRom;

		if ( v[ 0 ] === v[ m ] ) {

			if ( k < 0 ) i = Math.floor( f = m * ( 1 + k ) );

			return fn( v[ ( i - 1 + m ) % m ], v[ i ], v[ ( i + 1 ) % m ], v[ ( i + 2 ) % m ], f - i );

		} else {

			if ( k < 0 ) return v[ 0 ] - ( fn( v[ 0 ], v[ 0 ], v[ 1 ], v[ 1 ], -f ) - v[ 0 ] );
			if ( k > 1 ) return v[ m ] - ( fn( v[ m ], v[ m ], v[ m - 1 ], v[ m - 1 ], f - m ) - v[ m ] );

			return fn( v[ i ? i - 1 : 0 ], v[ i ], v[ m < i + 1 ? m : i + 1 ], v[ m < i + 2 ? m : i + 2 ], f - i );

		}

	},

	Utils: {

		Linear: function ( p0, p1, t ) {

			return ( p1 - p0 ) * t + p0;

		},

		Bernstein: function ( n , i ) {

			var fc = TWEEN.Interpolation.Utils.Factorial;
			return fc( n ) / fc( i ) / fc( n - i );

		},

		Factorial: ( function () {

			var a = [ 1 ];

			return function ( n ) {

				var s = 1, i;
				if ( a[ n ] ) return a[ n ];
				for ( i = n; i > 1; i-- ) s *= i;
				return a[ n ] = s;

			};

		} )(),

		CatmullRom: function ( p0, p1, p2, p3, t ) {

			var v0 = ( p2 - p0 ) * 0.5, v1 = ( p3 - p1 ) * 0.5, t2 = t * t, t3 = t * t2;
			return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( - 3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;

		}

	}

};


/* litelist main */
(function(root, undefined) {
    "use strict";

    // Base function.
    var LiteList = function(opts) {
        var itemsInView     = this.itemsInView = [];
        var items           = this.items       = [];
        var itemWidth       = opts.itemWidth || 0;
        var itemHeight      = opts.itemHeight;
        var margin          = opts.margin || { x: 0, y: 0 };
        var view            = document.querySelector(opts.scrollView);
        var itemsContainer  = opts.itemsContainer ? document.querySelector(opts.itemsContainer) : false;
        var dataSource      = opts.dataSource || false;
        var itemTemplate    = opts.itemTemplate || false;
        var scrollTop       = 0;
        var dirtyResize     = true;
        var ticking         = false;

        // View Metrics
        var clientHeight, clientWidth, rowsPerPage, itemsPerRow, itemsPerPage, maxBuffer;

        // If not passed a page selector, assume it's the first child
        if(!itemsContainer) {
            itemsContainer = view.children[0];
        }

        // Keep track of a unique id for viewItems - allows This is passed to
        // datasource providers to aid in tracking.
        var id = 0;
        function createInViewObj(item, idx) {
            var row = Math.floor(idx/itemsPerRow);
            var col = (idx % itemsPerRow);

            var newViewObj = {
                id:   id++,
                top:  row * itemHeight + row * margin.y,
                left: col * itemWidth  + col * margin.x,
                idx:  idx,
                item: item
            };

            // If we were given an item template, we need to add a clone
            // to the dom
            if(itemTemplate) {
                var newNode = itemTemplate.cloneNode(true);

                itemsContainer.appendChild(newNode);
                newViewObj.el = newNode;
                if(dataSource && dataSource.bind) {
                    dataSource.bind(newViewObj.id, newNode);
                }

                positionViewItem(newViewObj, true);
            }

            return newViewObj;
        }

        function calcViewMetrics() {
            clientHeight    = view.clientHeight;
            clientWidth     = view.clientWidth;
            rowsPerPage     = Math.ceil (clientHeight / (itemHeight + margin.y));
            itemsPerRow     = itemWidth ? Math.floor(clientWidth  / (itemWidth  + margin.x)) : 1;
            itemsPerPage    = rowsPerPage * itemsPerRow;
            maxBuffer       = itemsPerPage * 3;
        }
        calcViewMetrics();

        function calcDocHeight() {
            var row = Math.ceil(items.length/itemsPerRow);
            var newHeight = row * itemHeight + row * margin.y;

            if(newHeight !== itemsInView.height) {
                itemsContainer.style.height = newHeight + "px";
                itemsInView.height = newHeight;
            }
            return itemsInView.height;
        }

        function positionViewItem(viewItem, force) {
            var idx  = viewItem.idx;
            var row  = Math.floor(idx/itemsPerRow);
            var col  = (idx % itemsPerRow);
            var top  = row * itemHeight + row * margin.y;
            var left = col * itemWidth  + col * margin.x;

            // Avoid triggering update if the value hasn't changed
            if(force || (viewItem.top  !== top) ) {
                viewItem.top  = top;

                if(viewItem.el) {
                    viewItem.el.style.top = top + "px";
                }
            }

            if(force || (viewItem.left !== left)) {
                viewItem.left = left;

                if(viewItem.el) {
                    viewItem.el.style.left = left + "px";
                }
            }

            // this is ok for just an instance check
            if(force || (viewItem.item !== items[idx])) {
                viewItem.item = items[idx];

                // If we have a dataSource
                if(dataSource && dataSource.sync) {
                    dataSource.sync(viewItem.id, viewItem.el, idx, items[idx]);
                }
            }
        }

        var oldStart = 0;
        function _ensureVisible() {
            var bufferHeight  = itemsInView.length * itemHeight/itemsPerRow + itemsInView.length * margin.y/itemsPerRow;
            var percentInView = ((scrollTop - bufferHeight/3) / (itemsInView.height - clientHeight));

            if(percentInView < 0) { percentInView = 0; }
            var newStart = Math.floor(percentInView * items.length);
            var i;
            var viewItem;

            if(newStart < oldStart) {
                for(i = newStart; i < oldStart; ++i) {
                    viewItem = itemsInView[i % itemsInView.length];

                    viewItem.idx = viewItem.idx - itemsInView.length;
                    positionViewItem(viewItem);
                }
            } else if(newStart > oldStart) {
                for(i = oldStart; i < newStart ; ++i) {
                    viewItem = itemsInView[i % itemsInView.length];

                    viewItem.idx = viewItem.idx + itemsInView.length;
                    if(viewItem.idx < items.length) {
                        positionViewItem(viewItem);
                    }
                }
            }

            oldStart    = newStart;
            dirtyResize = false;
            ticking     = false;
        }

        function ensureVisible() {
            if(dirtyResize) {
                var newHeight    = view.clientHeight;
                var newWidth     = view.clientWidth;

                var newRowsPerPage     = Math.ceil (newHeight / (itemHeight + margin.y));
                var newItemsPerRow     = itemWidth ? Math.floor(newWidth  / (itemWidth  + margin.x)) : 1;

                var i, removed;
                if(newRowsPerPage !== rowsPerPage || newItemsPerRow !== itemsPerRow) {
                    calcViewMetrics();
                    calcDocHeight();

                    if(itemsInView.length > maxBuffer) {
                        removed = itemsInView.splice(0, itemsInView.length - maxBuffer);

                        if(dataSource && dataSource.unbind) {
                            removed.forEach(function(inViewItem) {
                                dataSource.unbind(inViewItem.id, inViewItem.el);
                                itemsContainer.removeChild(inViewItem.el);
                            });
                        }
                    } else if(itemsInView.length < maxBuffer) {
                        var newItems = [-1, 0];
                        for(i = itemsInView.length; i < maxBuffer; ++i) {
                            newItems.push(createInViewObj({}, 0));
                        }

                        itemsInView.splice.apply(itemsInView, newItems);
                    }

                    for(i = 0; i < itemsInView.length; ++i) {
                        itemsInView[i].idx = i;
                        positionViewItem(itemsInView[i]);
                    }

                    oldStart = 0;
                }
            }

            _ensureVisible();
        }

        function requestTick() {
            if(!ticking) {
                window.requestAnimationFrame(ensureVisible);
            }
            ticking = true;
        }

        function push() {
            var args    = Array.prototype.slice.call(arguments);
            var i       = 0;
            var argsIdx = items.length;

            items.push.apply(items, args);
            while(itemsInView.length < maxBuffer && i < args.length) {
                itemsInView.push( createInViewObj(args[i], argsIdx) );

                i = i + 1;
                argsIdx = argsIdx + 1;
            }

            calcDocHeight();
            requestTick();
        }
        this.push = push;

        function bind() {
            view.addEventListener("scroll", scrollHandler);
            window.addEventListener("resize", resizeHandler);
        }

        function unbind() {
            view.removeEventListener("scroll", scrollHandler);
            window.removeEventListener("resize", resizeHandler);

            if(scroll) { scroll.unbind(); }
        }
        this.unbind = unbind;

        function scrollHandler(/*evt*/) {
            /*jshint validthis:true */
            scrollTop  = this.scrollTop;

            requestTick();
        }

        function resizeHandler(/*evt*/) {
            dirtyResize = true;
            requestTick();
        }

        bind();

        var scroll = LiteList.Scroll ? new LiteList.Scroll(opts.scrollView, scrollHandler) : false;

        // Kicks off a layout (dirtyResize defaults to true)
        // This will layout everything nicely filling all columns
        calcDocHeight();
        requestTick();
    };


    // Version.
    LiteList.VERSION = '0.0.0';


    // Export to the root, which is probably `window`.
    root.LiteList = LiteList;

})(window);



(function(window, document, LiteList, rivets, undefined){
    var RVLiteList = function(opts) {
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

    };

    LiteList.RivetsLiteList = RVLiteList;
})(window, document, window.LiteList, window.rivets);


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