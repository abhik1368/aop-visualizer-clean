import {
  __commonJS
} from "./chunk-PR4QN5HX.js";

// node_modules/cytoscape-euler/cytoscape-euler.js
var require_cytoscape_euler = __commonJS({
  "node_modules/cytoscape-euler/cytoscape-euler.js"(exports, module) {
    (function webpackUniversalModuleDefinition(root, factory) {
      if (typeof exports === "object" && typeof module === "object")
        module.exports = factory();
      else if (typeof define === "function" && define.amd)
        define([], factory);
      else if (typeof exports === "object")
        exports["cytoscapeEuler"] = factory();
      else
        root["cytoscapeEuler"] = factory();
    })(exports, function() {
      return (
        /******/
        (function(modules) {
          var installedModules = {};
          function __webpack_require__(moduleId) {
            if (installedModules[moduleId]) {
              return installedModules[moduleId].exports;
            }
            var module2 = installedModules[moduleId] = {
              /******/
              i: moduleId,
              /******/
              l: false,
              /******/
              exports: {}
              /******/
            };
            modules[moduleId].call(module2.exports, module2, module2.exports, __webpack_require__);
            module2.l = true;
            return module2.exports;
          }
          __webpack_require__.m = modules;
          __webpack_require__.c = installedModules;
          __webpack_require__.i = function(value) {
            return value;
          };
          __webpack_require__.d = function(exports2, name, getter) {
            if (!__webpack_require__.o(exports2, name)) {
              Object.defineProperty(exports2, name, {
                /******/
                configurable: false,
                /******/
                enumerable: true,
                /******/
                get: getter
                /******/
              });
            }
          };
          __webpack_require__.n = function(module2) {
            var getter = module2 && module2.__esModule ? (
              /******/
              function getDefault() {
                return module2["default"];
              }
            ) : (
              /******/
              function getModuleExports() {
                return module2;
              }
            );
            __webpack_require__.d(getter, "a", getter);
            return getter;
          };
          __webpack_require__.o = function(object, property) {
            return Object.prototype.hasOwnProperty.call(object, property);
          };
          __webpack_require__.p = "";
          return __webpack_require__(__webpack_require__.s = 11);
        })([
          /* 0 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            module2.exports = Object.assign != null ? Object.assign.bind(Object) : function(tgt) {
              for (var _len = arguments.length, srcs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                srcs[_key - 1] = arguments[_key];
              }
              srcs.forEach(function(src) {
                Object.keys(src).forEach(function(k) {
                  return tgt[k] = src[k];
                });
              });
              return tgt;
            };
          }),
          /* 1 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var assign = __webpack_require__(0);
            var defaults = Object.freeze({
              source: null,
              target: null,
              length: 80,
              coeff: 2e-4,
              weight: 1
            });
            function makeSpring(spring) {
              return assign({}, defaults, spring);
            }
            function applySpring(spring) {
              var body1 = spring.source, body2 = spring.target, length = spring.length < 0 ? defaults.length : spring.length, dx = body2.pos.x - body1.pos.x, dy = body2.pos.y - body1.pos.y, r = Math.sqrt(dx * dx + dy * dy);
              if (r === 0) {
                dx = (Math.random() - 0.5) / 50;
                dy = (Math.random() - 0.5) / 50;
                r = Math.sqrt(dx * dx + dy * dy);
              }
              var d = r - length;
              var coeff = (!spring.coeff || spring.coeff < 0 ? defaults.springCoeff : spring.coeff) * d / r * spring.weight;
              body1.force.x += coeff * dx;
              body1.force.y += coeff * dy;
              body2.force.x -= coeff * dx;
              body2.force.y -= coeff * dy;
            }
            module2.exports = { makeSpring, applySpring };
          }),
          /* 2 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var _createClass = /* @__PURE__ */ (function() {
              function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                  var descriptor = props[i];
                  descriptor.enumerable = descriptor.enumerable || false;
                  descriptor.configurable = true;
                  if ("value" in descriptor) descriptor.writable = true;
                  Object.defineProperty(target, descriptor.key, descriptor);
                }
              }
              return function(Constructor, protoProps, staticProps) {
                if (protoProps) defineProperties(Constructor.prototype, protoProps);
                if (staticProps) defineProperties(Constructor, staticProps);
                return Constructor;
              };
            })();
            function _classCallCheck(instance, Constructor) {
              if (!(instance instanceof Constructor)) {
                throw new TypeError("Cannot call a class as a function");
              }
            }
            function _possibleConstructorReturn(self, call) {
              if (!self) {
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              }
              return call && (typeof call === "object" || typeof call === "function") ? call : self;
            }
            function _inherits(subClass, superClass) {
              if (typeof superClass !== "function" && superClass !== null) {
                throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
              }
              subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });
              if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
            }
            var Layout = __webpack_require__(13);
            var assign = __webpack_require__(0);
            var defaults = __webpack_require__(4);
            var _require = __webpack_require__(10), _tick = _require.tick;
            var _require2 = __webpack_require__(7), makeQuadtree = _require2.makeQuadtree;
            var _require3 = __webpack_require__(3), makeBody = _require3.makeBody;
            var _require4 = __webpack_require__(1), makeSpring = _require4.makeSpring;
            var isFn = function isFn2(fn) {
              return typeof fn === "function";
            };
            var isParent = function isParent2(n) {
              return n.isParent();
            };
            var notIsParent = function notIsParent2(n) {
              return !isParent(n);
            };
            var isLocked = function isLocked2(n) {
              return n.locked();
            };
            var notIsLocked = function notIsLocked2(n) {
              return !isLocked(n);
            };
            var isParentEdge = function isParentEdge2(e) {
              return isParent(e.source()) || isParent(e.target());
            };
            var notIsParentEdge = function notIsParentEdge2(e) {
              return !isParentEdge(e);
            };
            var getBody = function getBody2(n) {
              return n.scratch("euler").body;
            };
            var getNonParentDescendants = function getNonParentDescendants2(n) {
              return isParent(n) ? n.descendants().filter(notIsParent) : n;
            };
            var getScratch = function getScratch2(el) {
              var scratch = el.scratch("euler");
              if (!scratch) {
                scratch = {};
                el.scratch("euler", scratch);
              }
              return scratch;
            };
            var optFn = function optFn2(opt, ele) {
              if (isFn(opt)) {
                return opt(ele);
              } else {
                return opt;
              }
            };
            var Euler = (function(_Layout) {
              _inherits(Euler2, _Layout);
              function Euler2(options) {
                _classCallCheck(this, Euler2);
                return _possibleConstructorReturn(this, (Euler2.__proto__ || Object.getPrototypeOf(Euler2)).call(this, assign({}, defaults, options)));
              }
              _createClass(Euler2, [{
                key: "prerun",
                value: function prerun(state) {
                  var s = state;
                  s.quadtree = makeQuadtree();
                  var bodies = s.bodies = [];
                  s.nodes.filter(function(n) {
                    return notIsParent(n);
                  }).forEach(function(n) {
                    var scratch = getScratch(n);
                    var body = makeBody({
                      pos: { x: scratch.x, y: scratch.y },
                      mass: optFn(s.mass, n),
                      locked: scratch.locked
                    });
                    body._cyNode = n;
                    scratch.body = body;
                    body._scratch = scratch;
                    bodies.push(body);
                  });
                  var springs = s.springs = [];
                  s.edges.filter(notIsParentEdge).forEach(function(e) {
                    var spring = makeSpring({
                      source: getBody(e.source()),
                      target: getBody(e.target()),
                      length: optFn(s.springLength, e),
                      coeff: optFn(s.springCoeff, e)
                    });
                    spring._cyEdge = e;
                    var scratch = getScratch(e);
                    spring._scratch = scratch;
                    scratch.spring = spring;
                    springs.push(spring);
                  });
                  s.edges.filter(isParentEdge).forEach(function(e) {
                    var sources = getNonParentDescendants(e.source());
                    var targets = getNonParentDescendants(e.target());
                    sources = [sources[0]];
                    targets = [targets[0]];
                    sources.forEach(function(src) {
                      targets.forEach(function(tgt) {
                        springs.push(makeSpring({
                          source: getBody(src),
                          target: getBody(tgt),
                          length: optFn(s.springLength, e),
                          coeff: optFn(s.springCoeff, e)
                        }));
                      });
                    });
                  });
                }
              }, {
                key: "tick",
                value: function tick(state) {
                  var movement = _tick(state);
                  var isDone = movement <= state.movementThreshold;
                  return isDone;
                }
              }]);
              return Euler2;
            })(Layout);
            module2.exports = Euler;
          }),
          /* 3 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var defaults = Object.freeze({
              pos: { x: 0, y: 0 },
              prevPos: { x: 0, y: 0 },
              force: { x: 0, y: 0 },
              velocity: { x: 0, y: 0 },
              mass: 1
            });
            var copyVec = function copyVec2(v) {
              return { x: v.x, y: v.y };
            };
            var getValue = function getValue2(val, def) {
              return val != null ? val : def;
            };
            var getVec = function getVec2(vec, def) {
              return copyVec(getValue(vec, def));
            };
            function makeBody(opts) {
              var b = {};
              b.pos = getVec(opts.pos, defaults.pos);
              b.prevPos = getVec(opts.prevPos, b.pos);
              b.force = getVec(opts.force, defaults.force);
              b.velocity = getVec(opts.velocity, defaults.velocity);
              b.mass = opts.mass != null ? opts.mass : defaults.mass;
              b.locked = opts.locked;
              return b;
            }
            module2.exports = { makeBody };
          }),
          /* 4 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var defaults = Object.freeze({
              // The ideal legth of a spring
              // - This acts as a hint for the edge length
              // - The edge length can be longer or shorter if the forces are set to extreme values
              springLength: function springLength(edge) {
                return 80;
              },
              // Hooke's law coefficient
              // - The value ranges on [0, 1]
              // - Lower values give looser springs
              // - Higher values give tighter springs
              springCoeff: function springCoeff(edge) {
                return 8e-4;
              },
              // The mass of the node in the physics simulation
              // - The mass affects the gravity node repulsion/attraction
              mass: function mass(node) {
                return 4;
              },
              // Coulomb's law coefficient
              // - Makes the nodes repel each other for negative values
              // - Makes the nodes attract each other for positive values
              gravity: -1.2,
              // A force that pulls nodes towards the origin (0, 0)
              // Higher values keep the components less spread out
              pull: 1e-3,
              // Theta coefficient from Barnes-Hut simulation
              // - Value ranges on [0, 1]
              // - Performance is better with smaller values
              // - Very small values may not create enough force to give a good result
              theta: 0.666,
              // Friction / drag coefficient to make the system stabilise over time
              dragCoeff: 0.02,
              // When the total of the squared position deltas is less than this value, the simulation ends
              movementThreshold: 1,
              // The amount of time passed per tick
              // - Larger values result in faster runtimes but might spread things out too far
              // - Smaller values produce more accurate results
              timeStep: 20
            });
            module2.exports = defaults;
          }),
          /* 5 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var defaultCoeff = 0.02;
            function applyDrag(body, manualDragCoeff) {
              var dragCoeff = void 0;
              if (manualDragCoeff != null) {
                dragCoeff = manualDragCoeff;
              } else if (body.dragCoeff != null) {
                dragCoeff = body.dragCoeff;
              } else {
                dragCoeff = defaultCoeff;
              }
              body.force.x -= dragCoeff * body.velocity.x;
              body.force.y -= dragCoeff * body.velocity.y;
            }
            module2.exports = { applyDrag };
          }),
          /* 6 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            function integrate(bodies, timeStep) {
              var dx = 0, tx = 0, dy = 0, ty = 0, i, max = bodies.length;
              if (max === 0) {
                return 0;
              }
              for (i = 0; i < max; ++i) {
                var body = bodies[i], coeff = timeStep / body.mass;
                if (body.grabbed) {
                  continue;
                }
                if (body.locked) {
                  body.velocity.x = 0;
                  body.velocity.y = 0;
                } else {
                  body.velocity.x += coeff * body.force.x;
                  body.velocity.y += coeff * body.force.y;
                }
                var vx = body.velocity.x, vy = body.velocity.y, v = Math.sqrt(vx * vx + vy * vy);
                if (v > 1) {
                  body.velocity.x = vx / v;
                  body.velocity.y = vy / v;
                }
                dx = timeStep * body.velocity.x;
                dy = timeStep * body.velocity.y;
                body.pos.x += dx;
                body.pos.y += dy;
                tx += Math.abs(dx);
                ty += Math.abs(dy);
              }
              return (tx * tx + ty * ty) / max;
            }
            module2.exports = { integrate };
          }),
          /* 7 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var Node = __webpack_require__(9);
            var InsertStack = __webpack_require__(8);
            var resetVec = function resetVec2(v) {
              v.x = 0;
              v.y = 0;
            };
            var isSamePosition = function isSamePosition2(p1, p2) {
              var threshold = 1e-8;
              var dx = Math.abs(p1.x - p2.x);
              var dy = Math.abs(p1.y - p2.y);
              return dx < threshold && dy < threshold;
            };
            function makeQuadtree() {
              var updateQueue = [], insertStack = new InsertStack(), nodesCache = [], currentInCache = 0, root = newNode();
              function newNode() {
                var node = nodesCache[currentInCache];
                if (node) {
                  node.quad0 = null;
                  node.quad1 = null;
                  node.quad2 = null;
                  node.quad3 = null;
                  node.body = null;
                  node.mass = node.massX = node.massY = 0;
                  node.left = node.right = node.top = node.bottom = 0;
                } else {
                  node = new Node();
                  nodesCache[currentInCache] = node;
                }
                ++currentInCache;
                return node;
              }
              function update(sourceBody, gravity, theta, pull) {
                var queue = updateQueue, v = void 0, dx = void 0, dy = void 0, r = void 0, fx = 0, fy = 0, queueLength = 1, shiftIdx = 0, pushIdx = 1;
                queue[0] = root;
                resetVec(sourceBody.force);
                var px = -sourceBody.pos.x;
                var py = -sourceBody.pos.y;
                var pr = Math.sqrt(px * px + py * py);
                var pv = sourceBody.mass * pull / pr;
                fx += pv * px;
                fy += pv * py;
                while (queueLength) {
                  var node = queue[shiftIdx], body = node.body;
                  queueLength -= 1;
                  shiftIdx += 1;
                  var differentBody = body !== sourceBody;
                  if (body && differentBody) {
                    dx = body.pos.x - sourceBody.pos.x;
                    dy = body.pos.y - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);
                    if (r === 0) {
                      dx = (Math.random() - 0.5) / 50;
                      dy = (Math.random() - 0.5) / 50;
                      r = Math.sqrt(dx * dx + dy * dy);
                    }
                    v = gravity * body.mass * sourceBody.mass / (r * r * r);
                    fx += v * dx;
                    fy += v * dy;
                  } else if (differentBody) {
                    dx = node.massX / node.mass - sourceBody.pos.x;
                    dy = node.massY / node.mass - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);
                    if (r === 0) {
                      dx = (Math.random() - 0.5) / 50;
                      dy = (Math.random() - 0.5) / 50;
                      r = Math.sqrt(dx * dx + dy * dy);
                    }
                    if ((node.right - node.left) / r < theta) {
                      v = gravity * node.mass * sourceBody.mass / (r * r * r);
                      fx += v * dx;
                      fy += v * dy;
                    } else {
                      if (node.quad0) {
                        queue[pushIdx] = node.quad0;
                        queueLength += 1;
                        pushIdx += 1;
                      }
                      if (node.quad1) {
                        queue[pushIdx] = node.quad1;
                        queueLength += 1;
                        pushIdx += 1;
                      }
                      if (node.quad2) {
                        queue[pushIdx] = node.quad2;
                        queueLength += 1;
                        pushIdx += 1;
                      }
                      if (node.quad3) {
                        queue[pushIdx] = node.quad3;
                        queueLength += 1;
                        pushIdx += 1;
                      }
                    }
                  }
                }
                sourceBody.force.x += fx;
                sourceBody.force.y += fy;
              }
              function insertBodies(bodies) {
                if (bodies.length === 0) {
                  return;
                }
                var x1 = Number.MAX_VALUE, y1 = Number.MAX_VALUE, x2 = Number.MIN_VALUE, y2 = Number.MIN_VALUE, i = void 0, max = bodies.length;
                i = max;
                while (i--) {
                  var x = bodies[i].pos.x;
                  var y = bodies[i].pos.y;
                  if (x < x1) {
                    x1 = x;
                  }
                  if (x > x2) {
                    x2 = x;
                  }
                  if (y < y1) {
                    y1 = y;
                  }
                  if (y > y2) {
                    y2 = y;
                  }
                }
                var dx = x2 - x1, dy = y2 - y1;
                if (dx > dy) {
                  y2 = y1 + dx;
                } else {
                  x2 = x1 + dy;
                }
                currentInCache = 0;
                root = newNode();
                root.left = x1;
                root.right = x2;
                root.top = y1;
                root.bottom = y2;
                i = max - 1;
                if (i >= 0) {
                  root.body = bodies[i];
                }
                while (i--) {
                  insert(bodies[i], root);
                }
              }
              function insert(newBody) {
                insertStack.reset();
                insertStack.push(root, newBody);
                while (!insertStack.isEmpty()) {
                  var stackItem = insertStack.pop(), node = stackItem.node, body = stackItem.body;
                  if (!node.body) {
                    var x = body.pos.x;
                    var y = body.pos.y;
                    node.mass = node.mass + body.mass;
                    node.massX = node.massX + body.mass * x;
                    node.massY = node.massY + body.mass * y;
                    var quadIdx = 0, left = node.left, right = (node.right + left) / 2, top = node.top, bottom = (node.bottom + top) / 2;
                    if (x > right) {
                      quadIdx = quadIdx + 1;
                      left = right;
                      right = node.right;
                    }
                    if (y > bottom) {
                      quadIdx = quadIdx + 2;
                      top = bottom;
                      bottom = node.bottom;
                    }
                    var child = getChild(node, quadIdx);
                    if (!child) {
                      child = newNode();
                      child.left = left;
                      child.top = top;
                      child.right = right;
                      child.bottom = bottom;
                      child.body = body;
                      setChild(node, quadIdx, child);
                    } else {
                      insertStack.push(child, body);
                    }
                  } else {
                    var oldBody = node.body;
                    node.body = null;
                    if (isSamePosition(oldBody.pos, body.pos)) {
                      var retriesCount = 3;
                      do {
                        var offset = Math.random();
                        var dx = (node.right - node.left) * offset;
                        var dy = (node.bottom - node.top) * offset;
                        oldBody.pos.x = node.left + dx;
                        oldBody.pos.y = node.top + dy;
                        retriesCount -= 1;
                      } while (retriesCount > 0 && isSamePosition(oldBody.pos, body.pos));
                      if (retriesCount === 0 && isSamePosition(oldBody.pos, body.pos)) {
                        return;
                      }
                    }
                    insertStack.push(node, oldBody);
                    insertStack.push(node, body);
                  }
                }
              }
              return {
                insertBodies,
                updateBodyForce: update
              };
            }
            function getChild(node, idx) {
              if (idx === 0) return node.quad0;
              if (idx === 1) return node.quad1;
              if (idx === 2) return node.quad2;
              if (idx === 3) return node.quad3;
              return null;
            }
            function setChild(node, idx, child) {
              if (idx === 0) node.quad0 = child;
              else if (idx === 1) node.quad1 = child;
              else if (idx === 2) node.quad2 = child;
              else if (idx === 3) node.quad3 = child;
            }
            module2.exports = { makeQuadtree };
          }),
          /* 8 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            module2.exports = InsertStack;
            function InsertStack() {
              this.stack = [];
              this.popIdx = 0;
            }
            InsertStack.prototype = {
              isEmpty: function isEmpty() {
                return this.popIdx === 0;
              },
              push: function push(node, body) {
                var item = this.stack[this.popIdx];
                if (!item) {
                  this.stack[this.popIdx] = new InsertStackElement(node, body);
                } else {
                  item.node = node;
                  item.body = body;
                }
                ++this.popIdx;
              },
              pop: function pop() {
                if (this.popIdx > 0) {
                  return this.stack[--this.popIdx];
                }
              },
              reset: function reset() {
                this.popIdx = 0;
              }
            };
            function InsertStackElement(node, body) {
              this.node = node;
              this.body = body;
            }
          }),
          /* 9 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            module2.exports = function Node() {
              this.body = null;
              this.quad0 = null;
              this.quad1 = null;
              this.quad2 = null;
              this.quad3 = null;
              this.mass = 0;
              this.massX = 0;
              this.massY = 0;
              this.left = 0;
              this.top = 0;
              this.bottom = 0;
              this.right = 0;
            };
          }),
          /* 10 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var _require = __webpack_require__(6), integrate = _require.integrate;
            var _require2 = __webpack_require__(5), applyDrag = _require2.applyDrag;
            var _require3 = __webpack_require__(1), applySpring = _require3.applySpring;
            function tick(_ref) {
              var bodies = _ref.bodies, springs = _ref.springs, quadtree = _ref.quadtree, timeStep = _ref.timeStep, gravity = _ref.gravity, theta = _ref.theta, dragCoeff = _ref.dragCoeff, pull = _ref.pull;
              bodies.forEach(function(body2) {
                var p = body2._scratch;
                if (!p) {
                  return;
                }
                body2.locked = p.locked;
                body2.grabbed = p.grabbed;
                body2.pos.x = p.x;
                body2.pos.y = p.y;
              });
              quadtree.insertBodies(bodies);
              for (var i = 0; i < bodies.length; i++) {
                var body = bodies[i];
                quadtree.updateBodyForce(body, gravity, theta, pull);
                applyDrag(body, dragCoeff);
              }
              for (var _i = 0; _i < springs.length; _i++) {
                var spring = springs[_i];
                applySpring(spring);
              }
              var movement = integrate(bodies, timeStep);
              bodies.forEach(function(body2) {
                var p = body2._scratch;
                if (!p) {
                  return;
                }
                p.x = body2.pos.x;
                p.y = body2.pos.y;
              });
              return movement;
            }
            module2.exports = { tick };
          }),
          /* 11 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var Euler = __webpack_require__(2);
            var register = function register2(cytoscape2) {
              if (!cytoscape2) {
                return;
              }
              cytoscape2("layout", "euler", Euler);
            };
            if (typeof cytoscape !== "undefined") {
              register(cytoscape);
            }
            module2.exports = register;
          }),
          /* 12 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            module2.exports = Object.freeze({
              animate: true,
              // whether to show the layout as it's running; special 'end' value makes the layout animate like a discrete layout
              refresh: 10,
              // number of ticks per frame; higher is faster but more jerky
              maxIterations: 1e3,
              // max iterations before the layout will bail out
              maxSimulationTime: 4e3,
              // max length in ms to run the layout
              ungrabifyWhileSimulating: false,
              // so you can't drag nodes during layout
              fit: true,
              // on every layout reposition of nodes, fit the viewport
              padding: 30,
              // padding around the simulation
              boundingBox: void 0,
              // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
              // layout event callbacks
              ready: function ready() {
              },
              // on layoutready
              stop: function stop() {
              },
              // on layoutstop
              // positioning options
              randomize: false,
              // use random node positions at beginning of layout
              // infinite layout options
              infinite: false
              // overrides all other options for a forces-all-the-time mode
            });
          }),
          /* 13 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var _createClass = /* @__PURE__ */ (function() {
              function defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                  var descriptor = props[i];
                  descriptor.enumerable = descriptor.enumerable || false;
                  descriptor.configurable = true;
                  if ("value" in descriptor) descriptor.writable = true;
                  Object.defineProperty(target, descriptor.key, descriptor);
                }
              }
              return function(Constructor, protoProps, staticProps) {
                if (protoProps) defineProperties(Constructor.prototype, protoProps);
                if (staticProps) defineProperties(Constructor, staticProps);
                return Constructor;
              };
            })();
            function _classCallCheck(instance, Constructor) {
              if (!(instance instanceof Constructor)) {
                throw new TypeError("Cannot call a class as a function");
              }
            }
            var assign = __webpack_require__(0);
            var defaults = __webpack_require__(12);
            var makeBoundingBox = __webpack_require__(14);
            var _require = __webpack_require__(15), setInitialPositionState = _require.setInitialPositionState, refreshPositions = _require.refreshPositions, getNodePositionData = _require.getNodePositionData;
            var _require2 = __webpack_require__(16), multitick = _require2.multitick;
            var Layout = (function() {
              function Layout2(options) {
                _classCallCheck(this, Layout2);
                var o = this.options = assign({}, defaults, options);
                var nodes = o.eles.nodes();
                if (!o.randomize) {
                  nodes = nodes.sort(function(a, b) {
                    return a.position().x - b.position().x;
                  });
                  var prev = { x: 0, y: 0 };
                  var pos = {};
                  nodes.forEach(function(n) {
                    Object.assign(pos, n.position());
                    if (Math.abs(prev.x - pos.x) < o.theta && Math.abs(prev.y - pos.y) < o.theta) {
                      n.position({ x: Math.random() * 100, y: Math.random() * 100 });
                    }
                    Object.assign(prev, pos);
                  });
                }
                var s = this.state = assign({}, o, {
                  layout: this,
                  nodes,
                  edges: o.eles.edges(),
                  tickIndex: 0,
                  firstUpdate: true
                });
                s.animateEnd = o.animate && o.animate === "end";
                s.animateContinuously = o.animate && !s.animateEnd;
              }
              _createClass(Layout2, [{
                key: "run",
                value: function run() {
                  var l = this;
                  var s = this.state;
                  s.tickIndex = 0;
                  s.firstUpdate = true;
                  s.startTime = Date.now();
                  s.running = true;
                  s.currentBoundingBox = makeBoundingBox(s.boundingBox, s.cy);
                  if (s.ready) {
                    l.one("ready", s.ready);
                  }
                  if (s.stop) {
                    l.one("stop", s.stop);
                  }
                  s.nodes.forEach(function(n) {
                    return setInitialPositionState(n, s);
                  });
                  l.prerun(s);
                  if (s.animateContinuously) {
                    var ungrabify = function ungrabify2(node) {
                      if (!s.ungrabifyWhileSimulating) {
                        return;
                      }
                      var grabbable = getNodePositionData(node, s).grabbable = node.grabbable();
                      if (grabbable) {
                        node.ungrabify();
                      }
                    };
                    var regrabify = function regrabify2(node) {
                      if (!s.ungrabifyWhileSimulating) {
                        return;
                      }
                      var grabbable = getNodePositionData(node, s).grabbable;
                      if (grabbable) {
                        node.grabify();
                      }
                    };
                    var updateGrabState = function updateGrabState2(node) {
                      return getNodePositionData(node, s).grabbed = node.grabbed();
                    };
                    var onGrab = function onGrab2(_ref) {
                      var target = _ref.target;
                      updateGrabState(target);
                    };
                    var onFree = onGrab;
                    var onDrag = function onDrag2(_ref2) {
                      var target = _ref2.target;
                      var p = getNodePositionData(target, s);
                      var tp = target.position();
                      p.x = tp.x;
                      p.y = tp.y;
                    };
                    var listenToGrab = function listenToGrab2(node) {
                      node.on("grab", onGrab);
                      node.on("free", onFree);
                      node.on("drag", onDrag);
                    };
                    var unlistenToGrab = function unlistenToGrab2(node) {
                      node.removeListener("grab", onGrab);
                      node.removeListener("free", onFree);
                      node.removeListener("drag", onDrag);
                    };
                    var fit = function fit2() {
                      if (s.fit && s.animateContinuously) {
                        s.cy.fit(s.padding);
                      }
                    };
                    var onNotDone = function onNotDone2() {
                      refreshPositions(s.nodes, s);
                      fit();
                      requestAnimationFrame(_frame);
                    };
                    var _frame = function _frame2() {
                      multitick(s, onNotDone, _onDone);
                    };
                    var _onDone = function _onDone3() {
                      refreshPositions(s.nodes, s);
                      fit();
                      s.nodes.forEach(function(n) {
                        regrabify(n);
                        unlistenToGrab(n);
                      });
                      s.running = false;
                      l.emit("layoutstop");
                    };
                    l.emit("layoutstart");
                    s.nodes.forEach(function(n) {
                      ungrabify(n);
                      listenToGrab(n);
                    });
                    _frame();
                  } else {
                    var done = false;
                    var _onNotDone = function _onNotDone2() {
                    };
                    var _onDone2 = function _onDone22() {
                      return done = true;
                    };
                    while (!done) {
                      multitick(s, _onNotDone, _onDone2);
                    }
                    s.eles.layoutPositions(this, s, function(node) {
                      var pd = getNodePositionData(node, s);
                      return { x: pd.x, y: pd.y };
                    });
                  }
                  l.postrun(s);
                  return this;
                }
              }, {
                key: "prerun",
                value: function prerun() {
                }
              }, {
                key: "postrun",
                value: function postrun() {
                }
              }, {
                key: "tick",
                value: function tick() {
                }
              }, {
                key: "stop",
                value: function stop() {
                  this.state.running = false;
                  return this;
                }
              }, {
                key: "destroy",
                value: function destroy() {
                  return this;
                }
              }]);
              return Layout2;
            })();
            module2.exports = Layout;
          }),
          /* 14 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            module2.exports = function(bb, cy) {
              if (bb == null) {
                bb = { x1: 0, y1: 0, w: cy.width(), h: cy.height() };
              } else {
                bb = { x1: bb.x1, x2: bb.x2, y1: bb.y1, y2: bb.y2, w: bb.w, h: bb.h };
              }
              if (bb.x2 == null) {
                bb.x2 = bb.x1 + bb.w;
              }
              if (bb.w == null) {
                bb.w = bb.x2 - bb.x1;
              }
              if (bb.y2 == null) {
                bb.y2 = bb.y1 + bb.h;
              }
              if (bb.h == null) {
                bb.h = bb.y2 - bb.y1;
              }
              return bb;
            };
          }),
          /* 15 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var assign = __webpack_require__(0);
            var setInitialPositionState = function setInitialPositionState2(node, state) {
              var p = node.position();
              var bb = state.currentBoundingBox;
              var scratch = node.scratch(state.name);
              if (scratch == null) {
                scratch = {};
                node.scratch(state.name, scratch);
              }
              assign(scratch, state.randomize ? {
                x: bb.x1 + Math.random() * bb.w,
                y: bb.y1 + Math.random() * bb.h
              } : {
                x: p.x,
                y: p.y
              });
              scratch.locked = node.locked();
            };
            var getNodePositionData = function getNodePositionData2(node, state) {
              return node.scratch(state.name);
            };
            var refreshPositions = function refreshPositions2(nodes, state) {
              nodes.positions(function(node) {
                var scratch = node.scratch(state.name);
                return {
                  x: scratch.x,
                  y: scratch.y
                };
              });
            };
            module2.exports = { setInitialPositionState, getNodePositionData, refreshPositions };
          }),
          /* 16 */
          /***/
          (function(module2, exports2, __webpack_require__) {
            "use strict";
            var nop = function nop2() {
            };
            var tick = function tick2(state) {
              var s = state;
              var l = state.layout;
              var tickIndicatesDone = l.tick(s);
              if (s.firstUpdate) {
                if (s.animateContinuously) {
                  s.layout.emit("layoutready");
                }
                s.firstUpdate = false;
              }
              s.tickIndex++;
              var duration = Date.now() - s.startTime;
              return !s.infinite && (tickIndicatesDone || s.tickIndex >= s.maxIterations || duration >= s.maxSimulationTime);
            };
            var multitick = function multitick2(state) {
              var onNotDone = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : nop;
              var onDone = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : nop;
              var done = false;
              var s = state;
              for (var i = 0; i < s.refresh; i++) {
                done = !s.running || tick(s);
                if (done) {
                  break;
                }
              }
              if (!done) {
                onNotDone();
              } else {
                onDone();
              }
            };
            module2.exports = { tick, multitick };
          })
          /******/
        ])
      );
    });
  }
});
export default require_cytoscape_euler();
//# sourceMappingURL=cytoscape-euler.js.map
