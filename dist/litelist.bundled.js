!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.LiteList=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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
// Rivets.js
// version: 0.6.7
// author: Michael Richards
// license: MIT
(function() {
  var Rivets, bindMethod, unbindMethod, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Rivets = {
    binders: {},
    components: {},
    formatters: {},
    adapters: {},
    config: {
      prefix: 'rv',
      templateDelimiters: ['{', '}'],
      rootInterface: '.',
      preloadData: true,
      handler: function(context, ev, binding) {
        return this.call(context, ev, binding.view.models);
      }
    }
  };

  if ('jQuery' in window) {
    _ref = 'on' in jQuery ? ['on', 'off'] : ['bind', 'unbind'], bindMethod = _ref[0], unbindMethod = _ref[1];
    Rivets.Util = {
      bindEvent: function(el, event, handler) {
        return jQuery(el)[bindMethod](event, handler);
      },
      unbindEvent: function(el, event, handler) {
        return jQuery(el)[unbindMethod](event, handler);
      },
      getInputValue: function(el) {
        var $el;
        $el = jQuery(el);
        if ($el.attr('type') === 'checkbox') {
          return $el.is(':checked');
        } else {
          return $el.val();
        }
      }
    };
  } else {
    Rivets.Util = {
      bindEvent: (function() {
        if ('addEventListener' in window) {
          return function(el, event, handler) {
            return el.addEventListener(event, handler, false);
          };
        }
        return function(el, event, handler) {
          return el.attachEvent('on' + event, handler);
        };
      })(),
      unbindEvent: (function() {
        if ('removeEventListener' in window) {
          return function(el, event, handler) {
            return el.removeEventListener(event, handler, false);
          };
        }
        return function(el, event, handler) {
          return el.detachEvent('on' + event, handler);
        };
      })(),
      getInputValue: function(el) {
        var o, _i, _len, _results;
        if (el.type === 'checkbox') {
          return el.checked;
        } else if (el.type === 'select-multiple') {
          _results = [];
          for (_i = 0, _len = el.length; _i < _len; _i++) {
            o = el[_i];
            if (o.selected) {
              _results.push(o.value);
            }
          }
          return _results;
        } else {
          return el.value;
        }
      }
    };
  }

  Rivets.View = (function() {
    function View(els, models, options) {
      var k, option, v, _base, _i, _len, _ref1, _ref2, _ref3;
      this.els = els;
      this.models = models;
      this.options = options != null ? options : {};
      this.update = __bind(this.update, this);
      this.publish = __bind(this.publish, this);
      this.sync = __bind(this.sync, this);
      this.unbind = __bind(this.unbind, this);
      this.bind = __bind(this.bind, this);
      this.select = __bind(this.select, this);
      this.build = __bind(this.build, this);
      this.componentRegExp = __bind(this.componentRegExp, this);
      this.bindingRegExp = __bind(this.bindingRegExp, this);
      if (!(this.els.jquery || this.els instanceof Array)) {
        this.els = [this.els];
      }
      _ref1 = ['config', 'binders', 'formatters', 'adapters'];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        option = _ref1[_i];
        this[option] = {};
        if (this.options[option]) {
          _ref2 = this.options[option];
          for (k in _ref2) {
            v = _ref2[k];
            this[option][k] = v;
          }
        }
        _ref3 = Rivets[option];
        for (k in _ref3) {
          v = _ref3[k];
          if ((_base = this[option])[k] == null) {
            _base[k] = v;
          }
        }
      }
      this.build();
    }

    View.prototype.bindingRegExp = function() {
      return new RegExp("^" + this.config.prefix + "-");
    };

    View.prototype.componentRegExp = function() {
      return new RegExp("^" + (this.config.prefix.toUpperCase()) + "-");
    };

    View.prototype.build = function() {
      var bindingRegExp, buildBinding, componentRegExp, el, parse, skipNodes, _i, _len, _ref1,
        _this = this;
      this.bindings = [];
      skipNodes = [];
      bindingRegExp = this.bindingRegExp();
      componentRegExp = this.componentRegExp();
      buildBinding = function(binding, node, type, declaration) {
        var context, ctx, dependencies, keypath, options, pipe, pipes;
        options = {};
        pipes = (function() {
          var _i, _len, _ref1, _results;
          _ref1 = declaration.split('|');
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            pipe = _ref1[_i];
            _results.push(pipe.trim());
          }
          return _results;
        })();
        context = (function() {
          var _i, _len, _ref1, _results;
          _ref1 = pipes.shift().split('<');
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            ctx = _ref1[_i];
            _results.push(ctx.trim());
          }
          return _results;
        })();
        keypath = context.shift();
        options.formatters = pipes;
        if (dependencies = context.shift()) {
          options.dependencies = dependencies.split(/\s+/);
        }
        return _this.bindings.push(new Rivets[binding](_this, node, type, keypath, options));
      };
      parse = function(node) {
        var attribute, attributes, binder, childNode, delimiters, identifier, n, parser, regexp, text, token, tokens, type, value, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref1, _ref2, _ref3, _ref4, _ref5, _results;
        if (__indexOf.call(skipNodes, node) < 0) {
          if (node.nodeType === 3) {
            parser = Rivets.TextTemplateParser;
            if (delimiters = _this.config.templateDelimiters) {
              if ((tokens = parser.parse(node.data, delimiters)).length) {
                if (!(tokens.length === 1 && tokens[0].type === parser.types.text)) {
                  for (_i = 0, _len = tokens.length; _i < _len; _i++) {
                    token = tokens[_i];
                    text = document.createTextNode(token.value);
                    node.parentNode.insertBefore(text, node);
                    if (token.type === 1) {
                      buildBinding('TextBinding', text, null, token.value);
                    }
                  }
                  node.parentNode.removeChild(node);
                }
              }
            }
          } else if (componentRegExp.test(node.tagName)) {
            type = node.tagName.replace(componentRegExp, '').toLowerCase();
            _this.bindings.push(new Rivets.ComponentBinding(_this, node, type));
          } else if (node.attributes != null) {
            _ref1 = node.attributes;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              attribute = _ref1[_j];
              if (bindingRegExp.test(attribute.name)) {
                type = attribute.name.replace(bindingRegExp, '');
                if (!(binder = _this.binders[type])) {
                  _ref2 = _this.binders;
                  for (identifier in _ref2) {
                    value = _ref2[identifier];
                    if (identifier !== '*' && identifier.indexOf('*') !== -1) {
                      regexp = new RegExp("^" + (identifier.replace('*', '.+')) + "$");
                      if (regexp.test(type)) {
                        binder = value;
                      }
                    }
                  }
                }
                binder || (binder = _this.binders['*']);
                if (binder.block) {
                  _ref3 = node.childNodes;
                  for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
                    n = _ref3[_k];
                    skipNodes.push(n);
                  }
                  attributes = [attribute];
                }
              }
            }
            _ref4 = attributes || node.attributes;
            for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
              attribute = _ref4[_l];
              if (bindingRegExp.test(attribute.name)) {
                type = attribute.name.replace(bindingRegExp, '');
                buildBinding('Binding', node, type, attribute.value);
              }
            }
          }
          _ref5 = (function() {
            var _len4, _n, _ref5, _results1;
            _ref5 = node.childNodes;
            _results1 = [];
            for (_n = 0, _len4 = _ref5.length; _n < _len4; _n++) {
              n = _ref5[_n];
              _results1.push(n);
            }
            return _results1;
          })();
          _results = [];
          for (_m = 0, _len4 = _ref5.length; _m < _len4; _m++) {
            childNode = _ref5[_m];
            _results.push(parse(childNode));
          }
          return _results;
        }
      };
      _ref1 = this.els;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        el = _ref1[_i];
        parse(el);
      }
    };

    View.prototype.select = function(fn) {
      var binding, _i, _len, _ref1, _results;
      _ref1 = this.bindings;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        if (fn(binding)) {
          _results.push(binding);
        }
      }
      return _results;
    };

    View.prototype.bind = function() {
      var binding, _i, _len, _ref1, _results;
      _ref1 = this.bindings;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        _results.push(binding.bind());
      }
      return _results;
    };

    View.prototype.unbind = function() {
      var binding, _i, _len, _ref1, _results;
      _ref1 = this.bindings;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        _results.push(binding.unbind());
      }
      return _results;
    };

    View.prototype.sync = function() {
      var binding, _i, _len, _ref1, _results;
      _ref1 = this.bindings;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        _results.push(binding.sync());
      }
      return _results;
    };

    View.prototype.publish = function() {
      var binding, _i, _len, _ref1, _results;
      _ref1 = this.select(function(b) {
        return b.binder.publishes;
      });
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        _results.push(binding.publish());
      }
      return _results;
    };

    View.prototype.update = function(models) {
      var binding, key, model, _i, _len, _ref1, _results;
      if (models == null) {
        models = {};
      }
      for (key in models) {
        model = models[key];
        this.models[key] = model;
      }
      _ref1 = this.bindings;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        binding = _ref1[_i];
        _results.push(binding.update(models));
      }
      return _results;
    };

    return View;

  })();

  Rivets.Binding = (function() {
    function Binding(view, el, type, keypath, options) {
      this.view = view;
      this.el = el;
      this.type = type;
      this.keypath = keypath;
      this.options = options != null ? options : {};
      this.update = __bind(this.update, this);
      this.unbind = __bind(this.unbind, this);
      this.bind = __bind(this.bind, this);
      this.publish = __bind(this.publish, this);
      this.sync = __bind(this.sync, this);
      this.set = __bind(this.set, this);
      this.eventHandler = __bind(this.eventHandler, this);
      this.formattedValue = __bind(this.formattedValue, this);
      this.setBinder = __bind(this.setBinder, this);
      this.formatters = this.options.formatters || [];
      this.dependencies = [];
      this.model = void 0;
      this.setBinder();
    }

    Binding.prototype.setBinder = function() {
      var identifier, regexp, value, _ref1;
      if (!(this.binder = this.view.binders[this.type])) {
        _ref1 = this.view.binders;
        for (identifier in _ref1) {
          value = _ref1[identifier];
          if (identifier !== '*' && identifier.indexOf('*') !== -1) {
            regexp = new RegExp("^" + (identifier.replace('*', '.+')) + "$");
            if (regexp.test(this.type)) {
              this.binder = value;
              this.args = new RegExp("^" + (identifier.replace('*', '(.+)')) + "$").exec(this.type);
              this.args.shift();
            }
          }
        }
      }
      this.binder || (this.binder = this.view.binders['*']);
      if (this.binder instanceof Function) {
        return this.binder = {
          routine: this.binder
        };
      }
    };

    Binding.prototype.formattedValue = function(value) {
      var args, formatter, id, _i, _len, _ref1;
      _ref1 = this.formatters;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        formatter = _ref1[_i];
        args = formatter.split(/\s+/);
        id = args.shift();
        formatter = this.view.formatters[id];
        if ((formatter != null ? formatter.read : void 0) instanceof Function) {
          value = formatter.read.apply(formatter, [value].concat(__slice.call(args)));
        } else if (formatter instanceof Function) {
          value = formatter.apply(null, [value].concat(__slice.call(args)));
        }
      }
      return value;
    };

    Binding.prototype.eventHandler = function(fn) {
      var binding, handler;
      handler = (binding = this).view.config.handler;
      return function(ev) {
        return handler.call(fn, this, ev, binding);
      };
    };

    Binding.prototype.set = function(value) {
      var _ref1;
      value = value instanceof Function && !this.binder["function"] ? this.formattedValue(value.call(this.model)) : this.formattedValue(value);
      return (_ref1 = this.binder.routine) != null ? _ref1.call(this, this.el, value) : void 0;
    };

    Binding.prototype.sync = function() {
      var dependency, observer, _i, _j, _len, _len1, _ref1, _ref2, _ref3;
      if (this.model !== this.observer.target) {
        _ref1 = this.dependencies;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          observer = _ref1[_i];
          observer.unobserve();
        }
        this.dependencies = [];
        if (((this.model = this.observer.target) != null) && ((_ref2 = this.options.dependencies) != null ? _ref2.length : void 0)) {
          _ref3 = this.options.dependencies;
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            dependency = _ref3[_j];
            observer = new Rivets.Observer(this.view, this.model, dependency, this.sync);
            this.dependencies.push(observer);
          }
        }
      }
      return this.set(this.observer.value());
    };

    Binding.prototype.publish = function() {
      var args, formatter, id, value, _i, _len, _ref1, _ref2, _ref3;
      value = Rivets.Util.getInputValue(this.el);
      _ref1 = this.formatters.slice(0).reverse();
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        formatter = _ref1[_i];
        args = formatter.split(/\s+/);
        id = args.shift();
        if ((_ref2 = this.view.formatters[id]) != null ? _ref2.publish : void 0) {
          value = (_ref3 = this.view.formatters[id]).publish.apply(_ref3, [value].concat(__slice.call(args)));
        }
      }
      return this.observer.publish(value);
    };

    Binding.prototype.bind = function() {
      var dependency, observer, _i, _len, _ref1, _ref2, _ref3;
      if ((_ref1 = this.binder.bind) != null) {
        _ref1.call(this, this.el);
      }
      this.observer = new Rivets.Observer(this.view, this.view.models, this.keypath, this.sync);
      this.model = this.observer.target;
      if ((this.model != null) && ((_ref2 = this.options.dependencies) != null ? _ref2.length : void 0)) {
        _ref3 = this.options.dependencies;
        for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
          dependency = _ref3[_i];
          observer = new Rivets.Observer(this.view, this.model, dependency, this.sync);
          this.dependencies.push(observer);
        }
      }
      if (this.view.config.preloadData) {
        return this.sync();
      }
    };

    Binding.prototype.unbind = function() {
      var observer, _i, _len, _ref1, _ref2;
      if ((_ref1 = this.binder.unbind) != null) {
        _ref1.call(this, this.el);
      }
      this.observer.unobserve();
      _ref2 = this.dependencies;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        observer = _ref2[_i];
        observer.unobserve();
      }
      return this.dependencies = [];
    };

    Binding.prototype.update = function(models) {
      var _ref1;
      if (models == null) {
        models = {};
      }
      this.model = this.observer.target;
      return (_ref1 = this.binder.update) != null ? _ref1.call(this, models) : void 0;
    };

    return Binding;

  })();

  Rivets.ComponentBinding = (function(_super) {
    __extends(ComponentBinding, _super);

    function ComponentBinding(view, el, type) {
      var attribute, _i, _len, _ref1, _ref2;
      this.view = view;
      this.el = el;
      this.type = type;
      this.unbind = __bind(this.unbind, this);
      this.bind = __bind(this.bind, this);
      this.update = __bind(this.update, this);
      this.locals = __bind(this.locals, this);
      this.component = Rivets.components[this.type];
      this.attributes = {};
      this.inflections = {};
      _ref1 = this.el.attributes || [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        attribute = _ref1[_i];
        if (_ref2 = attribute.name, __indexOf.call(this.component.attributes, _ref2) >= 0) {
          this.attributes[attribute.name] = attribute.value;
        } else {
          this.inflections[attribute.name] = attribute.value;
        }
      }
    }

    ComponentBinding.prototype.sync = function() {};

    ComponentBinding.prototype.locals = function(models) {
      var inverse, key, model, path, result, _i, _len, _ref1, _ref2;
      if (models == null) {
        models = this.view.models;
      }
      result = {};
      _ref1 = this.inflections;
      for (key in _ref1) {
        inverse = _ref1[key];
        _ref2 = inverse.split('.');
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          path = _ref2[_i];
          result[key] = (result[key] || models)[path];
        }
      }
      for (key in models) {
        model = models[key];
        if (result[key] == null) {
          result[key] = model;
        }
      }
      return result;
    };

    ComponentBinding.prototype.update = function(models) {
      var _ref1;
      return (_ref1 = this.componentView) != null ? _ref1.update(this.locals(models)) : void 0;
    };

    ComponentBinding.prototype.bind = function() {
      var el, _ref1;
      if (this.componentView != null) {
        return (_ref1 = this.componentView) != null ? _ref1.bind() : void 0;
      } else {
        el = this.component.build.call(this.attributes);
        (this.componentView = new Rivets.View(el, this.locals(), this.view.options)).bind();
        return this.el.parentNode.replaceChild(el, this.el);
      }
    };

    ComponentBinding.prototype.unbind = function() {
      var _ref1;
      return (_ref1 = this.componentView) != null ? _ref1.unbind() : void 0;
    };

    return ComponentBinding;

  })(Rivets.Binding);

  Rivets.TextBinding = (function(_super) {
    __extends(TextBinding, _super);

    function TextBinding(view, el, type, keypath, options) {
      this.view = view;
      this.el = el;
      this.type = type;
      this.keypath = keypath;
      this.options = options != null ? options : {};
      this.sync = __bind(this.sync, this);
      this.formatters = this.options.formatters || [];
      this.dependencies = [];
    }

    TextBinding.prototype.binder = {
      routine: function(node, value) {
        return node.data = value != null ? value : '';
      }
    };

    TextBinding.prototype.sync = function() {
      return TextBinding.__super__.sync.apply(this, arguments);
    };

    return TextBinding;

  })(Rivets.Binding);

  Rivets.KeypathParser = (function() {
    function KeypathParser() {}

    KeypathParser.parse = function(keypath, interfaces, root) {
      var char, current, index, tokens, _i, _ref1;
      tokens = [];
      current = {
        "interface": root,
        path: ''
      };
      for (index = _i = 0, _ref1 = keypath.length; _i < _ref1; index = _i += 1) {
        char = keypath.charAt(index);
        if (__indexOf.call(interfaces, char) >= 0) {
          tokens.push(current);
          current = {
            "interface": char,
            path: ''
          };
        } else {
          current.path += char;
        }
      }
      tokens.push(current);
      return tokens;
    };

    return KeypathParser;

  })();

  Rivets.TextTemplateParser = (function() {
    function TextTemplateParser() {}

    TextTemplateParser.types = {
      text: 0,
      binding: 1
    };

    TextTemplateParser.parse = function(template, delimiters) {
      var index, lastIndex, lastToken, length, substring, tokens, value;
      tokens = [];
      length = template.length;
      index = 0;
      lastIndex = 0;
      while (lastIndex < length) {
        index = template.indexOf(delimiters[0], lastIndex);
        if (index < 0) {
          tokens.push({
            type: this.types.text,
            value: template.slice(lastIndex)
          });
          break;
        } else {
          if (index > 0 && lastIndex < index) {
            tokens.push({
              type: this.types.text,
              value: template.slice(lastIndex, index)
            });
          }
          lastIndex = index + delimiters[0].length;
          index = template.indexOf(delimiters[1], lastIndex);
          if (index < 0) {
            substring = template.slice(lastIndex - delimiters[1].length);
            lastToken = tokens[tokens.length - 1];
            if ((lastToken != null ? lastToken.type : void 0) === this.types.text) {
              lastToken.value += substring;
            } else {
              tokens.push({
                type: this.types.text,
                value: substring
              });
            }
            break;
          }
          value = template.slice(lastIndex, index).trim();
          tokens.push({
            type: this.types.binding,
            value: value
          });
          lastIndex = index + delimiters[1].length;
        }
      }
      return tokens;
    };

    return TextTemplateParser;

  })();

  Rivets.Observer = (function() {
    function Observer(view, model, keypath, callback) {
      this.view = view;
      this.model = model;
      this.keypath = keypath;
      this.callback = callback;
      this.unobserve = __bind(this.unobserve, this);
      this.realize = __bind(this.realize, this);
      this.value = __bind(this.value, this);
      this.publish = __bind(this.publish, this);
      this.read = __bind(this.read, this);
      this.set = __bind(this.set, this);
      this.adapter = __bind(this.adapter, this);
      this.update = __bind(this.update, this);
      this.initialize = __bind(this.initialize, this);
      this.parse = __bind(this.parse, this);
      this.parse();
      this.initialize();
    }

    Observer.prototype.parse = function() {
      var interfaces, k, path, root, v, _ref1;
      interfaces = (function() {
        var _ref1, _results;
        _ref1 = this.view.adapters;
        _results = [];
        for (k in _ref1) {
          v = _ref1[k];
          _results.push(k);
        }
        return _results;
      }).call(this);
      if (_ref1 = this.keypath[0], __indexOf.call(interfaces, _ref1) >= 0) {
        root = this.keypath[0];
        path = this.keypath.substr(1);
      } else {
        root = this.view.config.rootInterface;
        path = this.keypath;
      }
      this.tokens = Rivets.KeypathParser.parse(path, interfaces, root);
      return this.key = this.tokens.pop();
    };

    Observer.prototype.initialize = function() {
      this.objectPath = [];
      this.target = this.realize();
      if (this.target != null) {
        return this.set(true, this.key, this.target, this.callback);
      }
    };

    Observer.prototype.update = function() {
      var next, oldValue;
      if ((next = this.realize()) !== this.target) {
        if (this.target != null) {
          this.set(false, this.key, this.target, this.callback);
        }
        if (next != null) {
          this.set(true, this.key, next, this.callback);
        }
        oldValue = this.value();
        this.target = next;
        if (this.value() !== oldValue) {
          return this.callback();
        }
      }
    };

    Observer.prototype.adapter = function(key) {
      return this.view.adapters[key["interface"]];
    };

    Observer.prototype.set = function(active, key, obj, callback) {
      var action;
      action = active ? 'subscribe' : 'unsubscribe';
      return this.adapter(key)[action](obj, key.path, callback);
    };

    Observer.prototype.read = function(key, obj) {
      return this.adapter(key).read(obj, key.path);
    };

    Observer.prototype.publish = function(value) {
      if (this.target != null) {
        return this.adapter(this.key).publish(this.target, this.key.path, value);
      }
    };

    Observer.prototype.value = function() {
      if (this.target != null) {
        return this.read(this.key, this.target);
      }
    };

    Observer.prototype.realize = function() {
      var current, index, prev, token, unreached, _i, _len, _ref1;
      current = this.model;
      unreached = null;
      _ref1 = this.tokens;
      for (index = _i = 0, _len = _ref1.length; _i < _len; index = ++_i) {
        token = _ref1[index];
        if (current != null) {
          if (this.objectPath[index] != null) {
            if (current !== (prev = this.objectPath[index])) {
              this.set(false, token, prev, this.update);
              this.set(true, token, current, this.update);
              this.objectPath[index] = current;
            }
          } else {
            this.set(true, token, current, this.update);
            this.objectPath[index] = current;
          }
          current = this.read(token, current);
        } else {
          if (unreached == null) {
            unreached = index;
          }
          if (prev = this.objectPath[index]) {
            this.set(false, token, prev, this.update);
          }
        }
      }
      if (unreached != null) {
        this.objectPath.splice(unreached);
      }
      return current;
    };

    Observer.prototype.unobserve = function() {
      var index, obj, token, _i, _len, _ref1, _results;
      _ref1 = this.tokens;
      _results = [];
      for (index = _i = 0, _len = _ref1.length; _i < _len; index = ++_i) {
        token = _ref1[index];
        if (obj = this.objectPath[index]) {
          _results.push(this.set(false, token, obj, this.update));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    return Observer;

  })();

  Rivets.binders.text = function(el, value) {
    if (el.textContent != null) {
      return el.textContent = value != null ? value : '';
    } else {
      return el.innerText = value != null ? value : '';
    }
  };

  Rivets.binders.html = function(el, value) {
    return el.innerHTML = value != null ? value : '';
  };

  Rivets.binders.show = function(el, value) {
    return el.style.display = value ? '' : 'none';
  };

  Rivets.binders.hide = function(el, value) {
    return el.style.display = value ? 'none' : '';
  };

  Rivets.binders.enabled = function(el, value) {
    return el.disabled = !value;
  };

  Rivets.binders.disabled = function(el, value) {
    return el.disabled = !!value;
  };

  Rivets.binders.checked = {
    publishes: true,
    bind: function(el) {
      return Rivets.Util.bindEvent(el, 'change', this.publish);
    },
    unbind: function(el) {
      return Rivets.Util.unbindEvent(el, 'change', this.publish);
    },
    routine: function(el, value) {
      var _ref1;
      if (el.type === 'radio') {
        return el.checked = ((_ref1 = el.value) != null ? _ref1.toString() : void 0) === (value != null ? value.toString() : void 0);
      } else {
        return el.checked = !!value;
      }
    }
  };

  Rivets.binders.unchecked = {
    publishes: true,
    bind: function(el) {
      return Rivets.Util.bindEvent(el, 'change', this.publish);
    },
    unbind: function(el) {
      return Rivets.Util.unbindEvent(el, 'change', this.publish);
    },
    routine: function(el, value) {
      var _ref1;
      if (el.type === 'radio') {
        return el.checked = ((_ref1 = el.value) != null ? _ref1.toString() : void 0) !== (value != null ? value.toString() : void 0);
      } else {
        return el.checked = !value;
      }
    }
  };

  Rivets.binders.value = {
    publishes: true,
    bind: function(el) {
      return Rivets.Util.bindEvent(el, 'change', this.publish);
    },
    unbind: function(el) {
      return Rivets.Util.unbindEvent(el, 'change', this.publish);
    },
    routine: function(el, value) {
      var o, _i, _len, _ref1, _ref2, _ref3, _results;
      if (window.jQuery != null) {
        el = jQuery(el);
        if ((value != null ? value.toString() : void 0) !== ((_ref1 = el.val()) != null ? _ref1.toString() : void 0)) {
          return el.val(value != null ? value : '');
        }
      } else {
        if (el.type === 'select-multiple') {
          if (value != null) {
            _results = [];
            for (_i = 0, _len = el.length; _i < _len; _i++) {
              o = el[_i];
              _results.push(o.selected = (_ref2 = o.value, __indexOf.call(value, _ref2) >= 0));
            }
            return _results;
          }
        } else if ((value != null ? value.toString() : void 0) !== ((_ref3 = el.value) != null ? _ref3.toString() : void 0)) {
          return el.value = value != null ? value : '';
        }
      }
    }
  };

  Rivets.binders["if"] = {
    block: true,
    bind: function(el) {
      var attr, declaration;
      if (this.marker == null) {
        attr = [this.view.config.prefix, this.type].join('-').replace('--', '-');
        declaration = el.getAttribute(attr);
        this.marker = document.createComment(" rivets: " + this.type + " " + declaration + " ");
        el.removeAttribute(attr);
        el.parentNode.insertBefore(this.marker, el);
        return el.parentNode.removeChild(el);
      }
    },
    unbind: function() {
      var _ref1;
      return (_ref1 = this.nested) != null ? _ref1.unbind() : void 0;
    },
    routine: function(el, value) {
      var key, model, models, options, _ref1;
      if (!!value === (this.nested == null)) {
        if (value) {
          models = {};
          _ref1 = this.view.models;
          for (key in _ref1) {
            model = _ref1[key];
            models[key] = model;
          }
          options = {
            binders: this.view.options.binders,
            formatters: this.view.options.formatters,
            adapters: this.view.options.adapters,
            config: this.view.options.config
          };
          (this.nested = new Rivets.View(el, models, options)).bind();
          return this.marker.parentNode.insertBefore(el, this.marker.nextSibling);
        } else {
          el.parentNode.removeChild(el);
          this.nested.unbind();
          return delete this.nested;
        }
      }
    },
    update: function(models) {
      var _ref1;
      return (_ref1 = this.nested) != null ? _ref1.update(models) : void 0;
    }
  };

  Rivets.binders.unless = {
    block: true,
    bind: function(el) {
      return Rivets.binders["if"].bind.call(this, el);
    },
    unbind: function() {
      return Rivets.binders["if"].unbind.call(this);
    },
    routine: function(el, value) {
      return Rivets.binders["if"].routine.call(this, el, !value);
    },
    update: function(models) {
      return Rivets.binders["if"].update.call(this, models);
    }
  };

  Rivets.binders['on-*'] = {
    "function": true,
    unbind: function(el) {
      if (this.handler) {
        return Rivets.Util.unbindEvent(el, this.args[0], this.handler);
      }
    },
    routine: function(el, value) {
      if (this.handler) {
        Rivets.Util.unbindEvent(el, this.args[0], this.handler);
      }
      return Rivets.Util.bindEvent(el, this.args[0], this.handler = this.eventHandler(value));
    }
  };

  Rivets.binders['each-*'] = {
    block: true,
    bind: function(el) {
      var attr;
      if (this.marker == null) {
        attr = [this.view.config.prefix, this.type].join('-').replace('--', '-');
        this.marker = document.createComment(" rivets: " + this.type + " ");
        this.iterated = [];
        el.removeAttribute(attr);
        el.parentNode.insertBefore(this.marker, el);
        return el.parentNode.removeChild(el);
      }
    },
    unbind: function(el) {
      var view, _i, _len, _ref1, _results;
      if (this.iterated != null) {
        _ref1 = this.iterated;
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          view = _ref1[_i];
          _results.push(view.unbind());
        }
        return _results;
      }
    },
    routine: function(el, collection) {
      var binding, data, i, index, k, key, model, modelName, options, previous, template, v, view, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2, _ref3, _ref4, _results;
      modelName = this.args[0];
      collection = collection || [];
      if (this.iterated.length > collection.length) {
        _ref1 = Array(this.iterated.length - collection.length);
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          i = _ref1[_i];
          view = this.iterated.pop();
          view.unbind();
          this.marker.parentNode.removeChild(view.els[0]);
        }
      }
      for (index = _j = 0, _len1 = collection.length; _j < _len1; index = ++_j) {
        model = collection[index];
        data = {
          index: index
        };
        data[modelName] = model;
        if (this.iterated[index] == null) {
          _ref2 = this.view.models;
          for (key in _ref2) {
            model = _ref2[key];
            if (data[key] == null) {
              data[key] = model;
            }
          }
          previous = this.iterated.length ? this.iterated[this.iterated.length - 1].els[0] : this.marker;
          options = {
            binders: this.view.options.binders,
            formatters: this.view.options.formatters,
            adapters: this.view.options.adapters,
            config: {}
          };
          _ref3 = this.view.options.config;
          for (k in _ref3) {
            v = _ref3[k];
            options.config[k] = v;
          }
          options.config.preloadData = true;
          template = el.cloneNode(true);
          view = new Rivets.View(template, data, options);
          view.bind();
          this.iterated.push(view);
          this.marker.parentNode.insertBefore(template, previous.nextSibling);
        } else if (this.iterated[index].models[modelName] !== model) {
          this.iterated[index].update(data);
        }
      }
      if (el.nodeName === 'OPTION') {
        _ref4 = this.view.bindings;
        _results = [];
        for (_k = 0, _len2 = _ref4.length; _k < _len2; _k++) {
          binding = _ref4[_k];
          if (binding.el === this.marker.parentNode && binding.type === 'value') {
            _results.push(binding.sync());
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    },
    update: function(models) {
      var data, key, model, view, _i, _len, _ref1, _results;
      data = {};
      for (key in models) {
        model = models[key];
        if (key !== this.args[0]) {
          data[key] = model;
        }
      }
      _ref1 = this.iterated;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        view = _ref1[_i];
        _results.push(view.update(data));
      }
      return _results;
    }
  };

  Rivets.binders['class-*'] = function(el, value) {
    var elClass;
    elClass = " " + el.className + " ";
    if (!value === (elClass.indexOf(" " + this.args[0] + " ") !== -1)) {
      return el.className = value ? "" + el.className + " " + this.args[0] : elClass.replace(" " + this.args[0] + " ", ' ').trim();
    }
  };

  Rivets.binders['*'] = function(el, value) {
    if (value != null) {
      return el.setAttribute(this.type, value);
    } else {
      return el.removeAttribute(this.type);
    }
  };

  Rivets.adapters['.'] = {
    id: '_rv',
    counter: 0,
    weakmap: {},
    weakReference: function(obj) {
      var id;
      if (obj[this.id] == null) {
        id = this.counter++;
        this.weakmap[id] = {
          callbacks: {}
        };
        Object.defineProperty(obj, this.id, {
          value: id
        });
      }
      return this.weakmap[obj[this.id]];
    },
    stubFunction: function(obj, fn) {
      var map, original, weakmap;
      original = obj[fn];
      map = this.weakReference(obj);
      weakmap = this.weakmap;
      return obj[fn] = function() {
        var callback, k, r, response, _i, _len, _ref1, _ref2, _ref3, _ref4;
        response = original.apply(obj, arguments);
        _ref1 = map.pointers;
        for (r in _ref1) {
          k = _ref1[r];
          _ref4 = (_ref2 = (_ref3 = weakmap[r]) != null ? _ref3.callbacks[k] : void 0) != null ? _ref2 : [];
          for (_i = 0, _len = _ref4.length; _i < _len; _i++) {
            callback = _ref4[_i];
            callback();
          }
        }
        return response;
      };
    },
    observeMutations: function(obj, ref, keypath) {
      var fn, functions, map, _base, _i, _len;
      if (Array.isArray(obj)) {
        map = this.weakReference(obj);
        if (map.pointers == null) {
          map.pointers = {};
          functions = ['push', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'splice'];
          for (_i = 0, _len = functions.length; _i < _len; _i++) {
            fn = functions[_i];
            this.stubFunction(obj, fn);
          }
        }
        if ((_base = map.pointers)[ref] == null) {
          _base[ref] = [];
        }
        if (__indexOf.call(map.pointers[ref], keypath) < 0) {
          return map.pointers[ref].push(keypath);
        }
      }
    },
    unobserveMutations: function(obj, ref, keypath) {
      var keypaths, _ref1;
      if (Array.isArray(obj && (obj[this.id] != null))) {
        if (keypaths = (_ref1 = this.weakReference(obj).pointers) != null ? _ref1[ref] : void 0) {
          return keypaths.splice(keypaths.indexOf(keypath), 1);
        }
      }
    },
    subscribe: function(obj, keypath, callback) {
      var callbacks, value,
        _this = this;
      callbacks = this.weakReference(obj).callbacks;
      if (callbacks[keypath] == null) {
        callbacks[keypath] = [];
        value = obj[keypath];
        Object.defineProperty(obj, keypath, {
          enumerable: true,
          get: function() {
            return value;
          },
          set: function(newValue) {
            var _i, _len, _ref1;
            if (newValue !== value) {
              value = newValue;
              _ref1 = callbacks[keypath];
              for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
                callback = _ref1[_i];
                callback();
              }
              return _this.observeMutations(newValue, obj[_this.id], keypath);
            }
          }
        });
      }
      if (__indexOf.call(callbacks[keypath], callback) < 0) {
        callbacks[keypath].push(callback);
      }
      return this.observeMutations(obj[keypath], obj[this.id], keypath);
    },
    unsubscribe: function(obj, keypath, callback) {
      var callbacks;
      callbacks = this.weakmap[obj[this.id]].callbacks[keypath];
      callbacks.splice(callbacks.indexOf(callback), 1);
      return this.unobserveMutations(obj[keypath], obj[this.id], keypath);
    },
    read: function(obj, keypath) {
      return obj[keypath];
    },
    publish: function(obj, keypath, value) {
      return obj[keypath] = value;
    }
  };

  Rivets.factory = function(exports) {
    exports._ = Rivets;
    exports.binders = Rivets.binders;
    exports.components = Rivets.components;
    exports.formatters = Rivets.formatters;
    exports.adapters = Rivets.adapters;
    exports.config = Rivets.config;
    exports.configure = function(options) {
      var property, value;
      if (options == null) {
        options = {};
      }
      for (property in options) {
        value = options[property];
        Rivets.config[property] = value;
      }
    };
    return exports.bind = function(el, models, options) {
      var view;
      if (models == null) {
        models = {};
      }
      if (options == null) {
        options = {};
      }
      view = new Rivets.View(el, models, options);
      view.bind();
      return view;
    };
  };

  if (typeof exports === 'object') {
    Rivets.factory(exports);
  } else if (typeof define === 'function' && define.amd) {
    define(['exports'], function(exports) {
      Rivets.factory(this.rivets = exports);
      return exports;
    });
  } else {
    Rivets.factory(this.rivets = {});
  }

}).call(this);

},{}],3:[function(_dereq_,module,exports){
// tween.js - http://github.com/sole/tween.js
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

module.exports=TWEEN;
},{}],4:[function(_dereq_,module,exports){
var LiteList            = _dereq_("./litelist");
LiteList.RivetsLiteList = _dereq_("./rvlitelist");
LiteList.Scroll         = _dereq_("./scroll");


module.exports = LiteList;
},{"./litelist":5,"./rvlitelist":6,"./scroll":7}],5:[function(_dereq_,module,exports){
"use strict";

// Base function.
function LiteList(opts) {
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
}


// Version.
LiteList.VERSION = '0.0.0';


module.exports = LiteList;
},{}],6:[function(_dereq_,module,exports){
var rivets   = _dereq_('rivets');
var LiteList = _dereq_('./litelist');

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


},{"./litelist":5,"rivets":2}],7:[function(_dereq_,module,exports){
var TWEEN = _dereq_("tween.js");

_dereq_("raf.js");

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


module.exports = Scroll;

},{"raf.js":1,"tween.js":3}]},{},[4])
(4)
});