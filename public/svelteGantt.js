var SvelteGantt = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (var k in src) tar[k] = src[k];
		return tar;
	}

	function assignTrue(tar, src) {
		for (var k in src) tar[k] = 1;
		return tar;
	}

	function callAfter(fn, i) {
		if (i === 0) fn();
		return () => {
			if (!--i) fn();
		};
	}

	function addLoc(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		fn();
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function detachBetween(before, after) {
		while (before.nextSibling && before.nextSibling !== after) {
			before.parentNode.removeChild(before.nextSibling);
		}
	}

	function reinsertChildren(parent, target) {
		while (parent.firstChild) target.appendChild(parent.firstChild);
	}

	function destroyEach(iterations, detach) {
		for (var i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detach);
		}
	}

	function createFragment() {
		return document.createDocumentFragment();
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function createComment() {
		return document.createComment('');
	}

	function addListener(node, event, handler) {
		node.addEventListener(event, handler, false);
	}

	function removeListener(node, event, handler) {
		node.removeEventListener(event, handler, false);
	}

	function setData(text, data) {
		text.data = '' + data;
	}

	function setStyle(node, key, value) {
		node.style.setProperty(key, value);
	}

	function toggleClass(element, name, toggle) {
		element.classList.toggle(name, !!toggle);
	}

	function destroyBlock(block, lookup) {
		block.d(1);
		lookup[block.key] = null;
	}

	function outroAndDestroyBlock(block, lookup) {
		block.o(function() {
			destroyBlock(block, lookup);
		});
	}

	function updateKeyedEach(old_blocks, component, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, intro_method, next, get_context) {
		var o = old_blocks.length;
		var n = list.length;

		var i = o;
		var old_indexes = {};
		while (i--) old_indexes[old_blocks[i].key] = i;

		var new_blocks = [];
		var new_lookup = {};
		var deltas = {};

		var i = n;
		while (i--) {
			var child_ctx = get_context(ctx, list, i);
			var key = get_key(child_ctx);
			var block = lookup[key];

			if (!block) {
				block = create_each_block(component, key, child_ctx);
				block.c();
			} else if (dynamic) {
				block.p(changed, child_ctx);
			}

			new_blocks[i] = new_lookup[key] = block;

			if (key in old_indexes) deltas[key] = Math.abs(i - old_indexes[key]);
		}

		var will_move = {};
		var did_move = {};

		function insert(block) {
			block[intro_method](node, next);
			lookup[block.key] = block;
			next = block.first;
			n--;
		}

		while (o && n) {
			var new_block = new_blocks[n - 1];
			var old_block = old_blocks[o - 1];
			var new_key = new_block.key;
			var old_key = old_block.key;

			if (new_block === old_block) {
				// do nothing
				next = new_block.first;
				o--;
				n--;
			}

			else if (!new_lookup[old_key]) {
				// remove old block
				destroy(old_block, lookup);
				o--;
			}

			else if (!lookup[new_key] || will_move[new_key]) {
				insert(new_block);
			}

			else if (did_move[old_key]) {
				o--;

			} else if (deltas[new_key] > deltas[old_key]) {
				did_move[new_key] = true;
				insert(new_block);

			} else {
				will_move[old_key] = true;
				o--;
			}
		}

		while (o--) {
			var old_block = old_blocks[o];
			if (!new_lookup[old_block.key]) destroy(old_block, lookup);
		}

		while (n) insert(new_blocks[n - 1]);

		return new_blocks;
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function destroyDev(detach) {
		destroy.call(this, detach);
		this.destroy = function() {
			console.warn('Component was already destroyed');
		};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function _differsImmutable(a, b) {
		return a != a ? b == b : a !== b;
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) return;

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				try {
					handler.__calling = true;
					handler.call(this, data);
				} finally {
					handler.__calling = false;
				}
			}
		}
	}

	function flush(component) {
		component._lock = true;
		callAll(component._beforecreate);
		callAll(component._oncreate);
		callAll(component._aftercreate);
		component._lock = false;
	}

	function get() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._slots = blankObject();
		component._bind = options._bind;
		component._staged = {};

		component.options = options;
		component.root = options.root || component;
		component.store = options.store || component.root.store;

		if (!options.root) {
			component._beforecreate = [];
			component._oncreate = [];
			component._aftercreate = [];
		}
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) handlers.splice(index, 1);
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) return;
		flush(this.root);
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		newState = assign(this._staged, newState);
		this._staged = {};

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) this._bind(changed, this._state);

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function _stage(newState) {
		assign(this._staged, newState);
	}

	function setDev(newState) {
		if (typeof newState !== 'object') {
			throw new Error(
				this._debugName + '.set was called without an object of data key-values to update.'
			);
		}

		this._checkReadOnly(newState);
		set.call(this, newState);
	}

	function callAll(fns) {
		while (fns && fns.length) fns.shift()();
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	function removeFromStore() {
		this.store._remove(this);
	}

	var protoDev = {
		destroy: destroyDev,
		get,
		fire,
		on,
		set: setDev,
		_recompute: noop,
		_set,
		_stage,
		_mount,
		_differs
	};

	class DOMUtils {
	    isTaskVisible() {

	    }
	    
	    isRowVisible() {

	    }

	    //get mouse position within the element
	    static getRelativePos(node, event) {
	        const rect = node.getBoundingClientRect();
	        const x = event.clientX - rect.left; //x position within the element.
	        const y = event.clientY - rect.top;  //y position within the element.
	        return {
	            x: x,
	            y: y
	        }
	    }

	    //does mouse position intersect element
	    static intersects(node, event) {
	    }

	    static addEventListenerOnce(target, type, listener, addOptions, removeOptions) {
	        target.addEventListener(type, function fn(event) {
	            target.removeEventListener(type, fn, removeOptions);
	            listener.apply(this, arguments, addOptions);
	        });
	    }
	}

	class SvelteTask {

	    constructor(gantt, task, row){
	        this.gantt = gantt;
	        this.model = task;

	        /*Object.assign(this, {
	            classes: ''
	        }, task);*/
	        this.row = row;
	        this.dependencies = [];
	        this.updatePosition();
	    }

	    notify() {
	        if(this.dependencies){
	            this.dependencies.forEach(dependency => {
	                dependency.update();
	            });
	        }
	    }

	    updatePosition(){
	        const left = this.gantt.utils.getPositionByDate(this.model.from);
	        const right = this.gantt.utils.getPositionByDate(this.model.to); 

	        this.left = left;
	        this.width = right - left;
	    }

	    updateDate(){
	        const from = this.gantt.utils.getDateByPosition(this.left);
	        const to = this.gantt.utils.getDateByPosition(this.left + this.width);
	                   
	        const roundedFrom = this.gantt.utils.roundTo(from);
	        const roundedTo = this.gantt.utils.roundTo(to);

	        if(!roundedFrom.isSame(roundedTo)){
	            this.model.from = roundedFrom;
	            this.model.to = roundedTo;
	        }
	    }

	    overlaps(other) {
	        return !(this.left + this.width <= other.left || this.left >= other.left + other.width);
	    }

	    subscribe(dependency) {
	        this.dependencies.push(dependency);
	    }

	    unsubscribe(dependency) {
	        let result = [];
	        for(let i = 0; i < this.dependencies.length; i++) {
	            if(this.dependencies[i] === dependency) {
	                result.push(dependency);
	            }
	        }

	        for(let i = 0; i < result.length; i++) {
	            let index = this.dependencies.indexOf(result[i]);
	            this.dependencies.splice(index, 1);
	        }
	    }

	    updateView() {
	        if(this.component) {
	            this.component.set({task: this});
	        }
	    }
	}

	/* src\ExternalDiv.html generated by Svelte v2.13.4 */

	//let SvelteGantt;

	function data() {
	    return {
	        dragging: false,
	        gantt: null,
	        onsuccess: function(targetRow, dropDate, gantt) {
	            const newTask = new SvelteTask(gantt, {
	                        id: 5000+Math.floor(Math.random() * 1000),
	                        label: 'Task #'+4343,
	                        from: dropDate,
	                        to: dropDate.clone().add(3, 'hour'),
	                        amountDone: Math.floor(Math.random() * 100)
	                    }, targetRow);

	            targetRow.tasks.push(newTask);
	            console.log('drop successful');
	        },
	        onfail: function() {
	            console.log('drop unsucessful');
	        },
	        elementContent: 'yolo'
	    }
	}
	var methods = {
	    createElement(text){
	        const element = document.createElement('div');
					element.innerHTML = text;
					Object.assign(element.style, {
	            position: 'absolute',
						background: '#eee',
						padding: '0.5em 1em',
						fontSize: '12px',
						pointerEvents: 'none',
	        });
	        return element;
	    }
	};

	function oncreate(){
	    
	}
	function drag(node) {
	    const { gantt } = this.store.get();
	    const windowElement = window, self = this;

	    let successful = false;
	    //TODO make these functions gantt instance specific
	    const onmouseenter = (e) => {
	        successful = true; 
	    };
	    const onmouseleave = (e) => {
	        successful = false;
	    };
	    
	    function onmousedown(event) {
	        event.preventDefault();
	        
	        const { elementContent } = self.get();
	        const element = self.createElement(elementContent);
	        Object.assign(element.style, {
	            top: event.pageY+'px',
	            left: event.pageX+'px'
	        });
	        document.body.appendChild(element);
	        self.set({element, dragging: true});

	        const { rowContainerElement } = self.store.get();
	        rowContainerElement.addEventListener('mouseenter', onmouseenter);
	        rowContainerElement.addEventListener('mouseleave', onmouseleave);

	        windowElement.addEventListener('mousemove', onmousemove, false);
	        DOMUtils.addEventListenerOnce(windowElement, 'mouseup', onmouseup);
	    }
	    
	    function onmousemove(event) {
	        event.preventDefault();
	        const { dragging } = self.get();
	        if(dragging) {
	            const { element } = self.get();
	            Object.assign(element.style, {
	                top: event.pageY+'px',
	                left: event.pageX+'px'
	            });
	        }
	    }

	    function onmouseup(event) {
	        const { element, onsuccess, onfail, gantt } = self.get();
	        const { rowContainerElement } = self.store.get();
	        document.body.removeChild(element);
	        self.set({dragging: false, element: null});

	        //if over gantt
	        if(successful){
	            //create task
	            const rowCenterX = rowContainerElement.getBoundingClientRect().left + rowContainerElement.getBoundingClientRect().width / 2;
	            
	            const mousePos = DOMUtils.getRelativePos(rowContainerElement, event);
	            const dropDate = gantt.utils.getDateByPosition(mousePos.x);

	            //TODO extract into helper, used in Task
	            let elements = document.elementsFromPoint(rowCenterX, event.clientY);
	            let rowElement = elements.find((element) => element.classList.contains('row'));
	            if(rowElement !== undefined) {
	                const { visibleRows } = gantt.store.get();
	                const targetRow = visibleRows.find((r) => r.rowElement === rowElement);
	                onsuccess(targetRow, dropDate, gantt);
	                gantt.set({ visibleRows });
	            }
	        }
	        else{
	            onfail();
	            //fail, return indicator to ex-div
	            //remove task if created
	        }

	        rowContainerElement.removeEventListener('mouseenter', onmouseenter);
	        rowContainerElement.removeEventListener('mouseleave', onmouseleave);
	        windowElement.removeEventListener('mousemove', onmousemove, false);
	    }

	    node.addEventListener('mousedown', onmousedown, false);

					return {
						update() {
	            
						},
						destroy() {
							node.removeEventListener('mousedown', onmousedown, false);
							//windowElement.removeEventListener('mousemove', onmousemove, false);
							node.removeEventListener('mousemove', onmousemove, false);
							node.removeEventListener('mouseup', onmouseup, false);
						}
					}
	}
	const file = "src\\ExternalDiv.html";

	function create_main_fragment(component, ctx) {
		var div, slot_content_default = component._slotted.default, text, drag_action, current;

		return {
			c: function create() {
				div = createElement("div");
				if (!slot_content_default) {
					text = createText("Fallback content");
				}
				div.className = "external-div";
				addLoc(div, file, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (!slot_content_default) {
					append(div, text);
				}

				else {
					append(div, slot_content_default);
				}

				drag_action = drag.call(component, div) || {};
				current = true;
			},

			p: noop,

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				if (slot_content_default) {
					reinsertChildren(div, slot_content_default);
				}

				if (typeof drag_action.destroy === 'function') drag_action.destroy.call(component);
			}
		};
	}

	function ExternalDiv(options) {
		this._debugName = '<ExternalDiv>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign(data(), options.data);
		this._intro = !!options.intro;

		this._slotted = options.slots || {};

		this._fragment = create_main_fragment(this, this._state);

		this.root._oncreate.push(() => {
			oncreate.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(ExternalDiv.prototype, protoDev);
	assign(ExternalDiv.prototype, methods);

	ExternalDiv.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\ContextMenu.html generated by Svelte v2.13.4 */

	function data$1() {
	    return {
	        actions: [],
	        top: 0,
	        left: 0
	    }
	}
	var methods$1 = {
	    position(point) {
	        this.set({top: point.y, left: point.x});
	    },
	    execute(event, action) {
	        event.stopPropagation();
	        action.action();

	        this.options.onactionend();
	        //close();
	    },
	    close() {
	        //this.refs.yolo.remove();
	        this.destroy();
	    },
	    isTarget(event) {
	        return this.refs.contextMenu === event.target;
	    }
	};

	function oncreate$1(dsds) {
	    this.position(this.options.position);
	    //this.set({ actions: this.options.actions });
	}
	const file$1 = "src\\ContextMenu.html";

	function create_main_fragment$1(component, ctx) {
		var div, current;

		var each_value = ctx.actions;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = createElement("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "context-menu svelte-1dijfv8";
				setStyle(div, "top", "" + ctx.top + "px");
				setStyle(div, "left", "" + ctx.left + "px");
				addLoc(div, file$1, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				component.refs.contextMenu = div;
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.actions) {
					each_value = ctx.actions;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if (changed.top) {
					setStyle(div, "top", "" + ctx.top + "px");
				}

				if (changed.left) {
					setStyle(div, "left", "" + ctx.left + "px");
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				destroyEach(each_blocks, detach);

				if (component.refs.contextMenu === div) component.refs.contextMenu = null;
			}
		};
	}

	// (2:4) {#each actions as action}
	function create_each_block(component, ctx) {
		var div, text_value = ctx.action.label, text;

		return {
			c: function create() {
				div = createElement("div");
				text = createText(text_value);
				div._svelte = { component, ctx };

				addListener(div, "click", click_handler);
				div.className = "context-option svelte-1dijfv8";
				addLoc(div, file$1, 2, 8, 117);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, text);
			},

			p: function update(changed, ctx) {
				if ((changed.actions) && text_value !== (text_value = ctx.action.label)) {
					setData(text, text_value);
				}

				div._svelte.ctx = ctx;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				removeListener(div, "click", click_handler);
			}
		};
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.action = list[i];
		child_ctx.each_value = list;
		child_ctx.action_index = i;
		return child_ctx;
	}

	function click_handler(event) {
		const { component, ctx } = this._svelte;

		component.execute(event, ctx.action);
	}

	function ContextMenu(options) {
		this._debugName = '<ContextMenu>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this.refs = {};
		this._state = assign(data$1(), options.data);
		if (!('top' in this._state)) console.warn("<ContextMenu> was created without expected data property 'top'");
		if (!('left' in this._state)) console.warn("<ContextMenu> was created without expected data property 'left'");
		if (!('actions' in this._state)) console.warn("<ContextMenu> was created without expected data property 'actions'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$1(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$1.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(ContextMenu.prototype, protoDev);
	assign(ContextMenu.prototype, methods$1);

	ContextMenu.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\Task.html generated by Svelte v2.13.4 */

	function data$2() {
	    return {
	        task: { dragging: false }
	    }
	}
	var methods$2 = {
				updateTaskPosition() {
	        const { task } = this.get();
	        task.updatePosition();
	    },
	    updateTaskDate() {
	        const { task } = this.get();
	        task.updateDate();
	    },
	    updateCursor(cursor){
	        const element = this.refs.taskElement;
	        element.style.cursor = cursor || 'default';
	    },
	    truncate(){
	        const { task } = this.get();
	        if(!task){
	            return;
	        }

	        const ganttWidth = this.store.get().width;
	        if(task.left + task.width > ganttWidth){
	            task.truncated = true;
	            task.truncatedWidth = ganttWidth - task.left;
	            task.truncatedLeft = task.left;
	        }
	        /*else{
	            task.truncated = false;
	        }*/
	        
	        else if(task.left < 0){
	            task.truncated = true;
	            task.truncatedLeft = 0;
	            task.truncatedWidth = task.width + task.left;
	        }
	        else{
	            task.truncated = false;
	        }
	    }
	};

	function oncreate$2() {
	    const { task, row } = this.get();
	    task.row = row;
	    task.component = this;
	}
	function ondestroy() {
	    const { task } = this.get();
	    //does automatically (?)
	    if(task.component === this) {
	        task.component = null;
	    }
	}
	function onupdate({ changed, current, previous }) {
	    if(changed.task){
	        //console.log('current', current.task);
	        //console.log('previous', previous && previous.task);
	        //current.row.rowElement = this.refs.row;
	        console.log('update, generation:', current.task.model.generation, previous && previous.task.model.generation);
	        current.task.component = this;
	    }

	    if(changed.task && changed.row){
	        current.task.row = current.row;
	    }
	}
	function drag$1(node) {
	                //PROBLEM: pri refreshu podataka ovdje su "stari" event handleri
	                const { rowContainerElement, ganttUtils, gantt, resizeHandleWidth } = this.store.get();
	                const windowElement = window;

	                let { task } = this.get();
	                this.on('update', ({ changed, current, previous }) => {
	                    if(changed.task){
	                        task = current.task;
	                    }
	                });

	                let mouseStartPosX;
	                let mouseStartRight;
	                
	                let originalRow;
	                    
	                function onmousedown(event) {
	                    if(event.which !== 1){
	                        //debugger;
	                        return;
	                    }

	                    event.stopPropagation();
	                    event.preventDefault();
	                    console.log('drag down, generation:', task.model.generation);
	                    originalRow = task.row;

	                    if(originalRow.tasks.filter(t => t.model.id === task.model.id).length > 1){
	                        debugger;
	                    }

	                    if(originalRow.model.enableDragging){
	                        mouseStartPosX = DOMUtils.getRelativePos(rowContainerElement, event).x - task.left;
	                        mouseStartRight = task.left + task.width;

	                        if(mouseStartPosX < resizeHandleWidth) {
	                            task.resizing = true;
	                            task.direction = 'left';
	                        }
	                        else if(mouseStartPosX > task.width - resizeHandleWidth) {
	                            task.resizing = true;
	                            task.direction = 'right';
	                        }
	                        else {
	                            task.dragging = true;
	                        }

	                        windowElement.addEventListener('mousemove', onmousemove, false);
	                        DOMUtils.addEventListenerOnce(windowElement, 'mouseup', onmouseup);
	                    }
	                }
	                
	                function onmousemove(event) {
	                    const self = task.component;

	                    event.preventDefault();
	                    if(task.resizing) {
	                        const mousePos = DOMUtils.getRelativePos(rowContainerElement, event);
	                        
	                        if(task.direction === 'left') { //resize ulijevo
	                            if(mousePos.x > task.left + task.width) {
	                                task.left = mouseStartRight; //mousePos.x //
	                                task.width = task.left - mousePos.x;
	                                task.direction = 'right';
	                                mouseStartRight = task.left + task.width;
	                            }
	                            else{
	                                task.left = mousePos.x;
	                                task.width = mouseStartRight - mousePos.x;
	                            }
	                        }
	                        else if(task.direction === 'right') {//resize desno
	                            if(mousePos.x <= task.left) {
	                                task.width = task.left - mousePos.x;
	                                task.left = mousePos.x;
	                                task.direction = 'left';
	                                mouseStartRight = task.left + task.width;
	                            }
	                            else {
	                                task.width = mousePos.x - task.left;
	                            }
	                        }

	                        console.log(mousePos.x, mouseStartPosX);

	                        self.updateTaskDate();
	                        self.updateTaskPosition();
	                        self.set({ task });
	                        self.fire('taskResized', { task: task });
	                    }

	                    if(task.dragging) {
	                        const mousePos = DOMUtils.getRelativePos(rowContainerElement, event);
	                        task.left = mousePos.x - mouseStartPosX;

	                        self.updateTaskDate();//pomaknuti na kraj funkcije
	                        self.updateTaskPosition();
	                        
	                        //row switching
	                        const rowCenterX = gantt.refs.mainContainer.getBoundingClientRect().left + gantt.refs.mainContainer.getBoundingClientRect().width / 2; //rowContainerElement.getBoundingClientRect().left + rowContainerElement.getBoundingClientRect().width / 2;
	                        const sourceRow = task.row;

	                        let elements = document.elementsFromPoint(rowCenterX, event.clientY);
	                        let rowElement = elements.find((element) => element.classList.contains('row'));
	                        if(rowElement !== undefined && rowElement !== sourceRow.rowElement) {

	                            const { visibleRows } = self.store.get();

	                            const targetRow = visibleRows.find((r) => r.rowElement === rowElement);
	                            console.log('move task to '+targetRow.label, targetRow);

	                            if(targetRow.model.enableDragging){

	                                targetRow.moveTask(task);

	                                self.store.set({visibleRows: visibleRows});
	                                
	                                //targetRow.component.movedRow();
	                                //sourceRow.component.movedRow();
	                                self.fire('taskRemovedRow', { task: task, row: targetRow });
	                                gantt.api.tasks.raise.switchRow(task, targetRow, originalRow);
	                                targetRow.component.taskAdded();
	                            }
	                        }
	                        self.fire('taskMoved', { task: task });
	                        //task.component.fire('updateVisibleRows');
	                    }
	                    self.truncate();
	                    self.set({task:task});
	                    task.notify();
	                    gantt.api.tasks.raise.move(task);
	                }

	                function onmouseup(event) {
	                    console.log('drag up, generation:', task.model.generation); 
	                    task.dragging = false;
	                    task.resizing = false;
	                    task.direction = null;
	                    windowElement.removeEventListener('mousemove', onmousemove, false);
	                    task.component.fire('taskDropped', { task });
	                    task.component.set({task});

	                    //code this better
	                    if(originalRow && originalRow !== task.row) {
	                        console.log('moved from original row', originalRow);

	                        originalRow.component.taskMoved();
	                        originalRow.component.handleOverlaps();
	                    }
	                    console.log('drag up end, generation:', task.model.generation); 
	                }

	                node.addEventListener('mousedown', onmousedown, false);

	                const cursorOnMove = (e) => {
	                    const mouseStartPosX = DOMUtils.getRelativePos(rowContainerElement, e).x - task.left;

	                    //TODO globally set cursor ON mousedown
	                    if(mouseStartPosX < resizeHandleWidth || mouseStartPosX > task.width - resizeHandleWidth) {
	                        this.updateCursor('e-resize');
	                    }
	                    else{
	                        this.updateCursor();
	                    }

	                };
	                node.addEventListener('mousemove', cursorOnMove, false);

		return {
			update() {
	                        //ne radi??
	                        task = this.get().task;
			},

			destroy() {
				node.removeEventListener('mousedown', onmousedown, false);
				//windowElement.removeEventListener('mousemove', onmousemove, false);
				node.removeEventListener('mousemove', onmousemove, false);
				node.removeEventListener('mouseup', onmouseup, false);
			}
		}
	            }
	function contextMenu(node){
	    const { gantt } = this.store.get();

	    if(gantt.enableContextMenu){
	        const { task } = this.get();
	        const options = [
	            {
	                label: 'Copy',
	                action: () => console.log('clicked action 1 for task ', task.model.id)
	            },
	            {
	                label: 'Clear dependencies',
	                action: () => console.log('clicked action 2 for task ', task.model.id)
	            }
	        ];

	        function onClose(event) {
	            //if(!contextMenu.isTarget(e))
	            gantt.menuManager.close();
	        }

	        node.addEventListener('mouseup', (e) => {
	            if(e.which === 3){
	                e.stopPropagation();
	                gantt.menuManager.open(options, {x: e.x, y: e.y});

	                DOMUtils.addEventListenerOnce(node, 'mousedown', onClose); //document.body
	            }
	        });
	    }
	    
					return {
						destroy() {
	            gantt.menuManager.close();
						}
					}
	}
	function selectable(node) {
	    const { gantt } = this.store.get();
	    node.addEventListener('click', (e) => {
	        const { task } = this.get();
	        if(e.ctrlKey){
	            gantt.selectionManager.toggleSelection(task);
	        }
	        else{
	            gantt.selectionManager.selectSingle(task);
	        }

	        if(task.selected){
	            gantt.api.tasks.raise.select(task);
	        }
	    });
	}
	const file$2 = "src\\Task.html";

	function create_main_fragment$2(component, ctx) {
		var div, div_1, text, div_2, div_class_value, drag_action, contextMenu_action, selectable_action, current;

		function select_block_type(ctx) {
			if (ctx.task.model.html) return create_if_block;
			return create_if_block_1;
		}

		var current_block_type = select_block_type(ctx);
		var if_block = current_block_type(component, ctx);

		return {
			c: function create() {
				div = createElement("div");
				div_1 = createElement("div");
				text = createText("\r\n    ");
				div_2 = createElement("div");
				if_block.c();
				div_1.className = "task-background svelte-1mt96qt";
				setStyle(div_1, "width", "" + ctx.task.model.amountDone + "%");
				addLoc(div_1, file$2, 9, 4, 381);
				div_2.className = "task-content svelte-1mt96qt";
				addLoc(div_2, file$2, 10, 4, 461);
				div.className = div_class_value = "task " + ctx.task.model.classes + " svelte-1mt96qt";
				setStyle(div, "left", "" + (ctx.task.truncated ? ctx.task.truncatedLeft : ctx.task.left) + "px");
				setStyle(div, "width", "" + (ctx.task.truncated ? ctx.task.truncatedWidth : ctx.task.width) + "px");
				toggleClass(div, "overlapping", ctx.task.overlapping);
				toggleClass(div, "selected", ctx.task.selected);
				toggleClass(div, "moving", ctx.task.dragging||ctx.task.resizing);
				addLoc(div, file$2, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, div_1);
				append(div, text);
				append(div, div_2);
				if_block.m(div_2, null);
				component.refs.taskElement = div;
				drag_action = drag$1.call(component, div) || {};
				contextMenu_action = contextMenu.call(component, div) || {};
				selectable_action = selectable.call(component, div) || {};
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.task) {
					setStyle(div_1, "width", "" + ctx.task.model.amountDone + "%");
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block.d(1);
					if_block = current_block_type(component, ctx);
					if_block.c();
					if_block.m(div_2, null);
				}

				if ((changed.task) && div_class_value !== (div_class_value = "task " + ctx.task.model.classes + " svelte-1mt96qt")) {
					div.className = div_class_value;
				}

				if (changed.task) {
					setStyle(div, "left", "" + (ctx.task.truncated ? ctx.task.truncatedLeft : ctx.task.left) + "px");
					setStyle(div, "width", "" + (ctx.task.truncated ? ctx.task.truncatedWidth : ctx.task.width) + "px");
				}

				if ((changed.task || changed.task)) {
					toggleClass(div, "overlapping", ctx.task.overlapping);
					toggleClass(div, "selected", ctx.task.selected);
					toggleClass(div, "moving", ctx.task.dragging||ctx.task.resizing);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				if_block.d();
				if (component.refs.taskElement === div) component.refs.taskElement = null;
				if (typeof drag_action.destroy === 'function') drag_action.destroy.call(component);
				if (typeof contextMenu_action.destroy === 'function') contextMenu_action.destroy.call(component);
				if (typeof selectable_action.destroy === 'function') selectable_action.destroy.call(component);
			}
		};
	}

	// (12:8) {#if task.model.html}
	function create_if_block(component, ctx) {
		var raw_value = ctx.task.model.html, raw_before, raw_after;

		return {
			c: function create() {
				raw_before = createElement('noscript');
				raw_after = createElement('noscript');
			},

			m: function mount(target, anchor) {
				insert(target, raw_before, anchor);
				raw_before.insertAdjacentHTML("afterend", raw_value);
				insert(target, raw_after, anchor);
			},

			p: function update(changed, ctx) {
				if ((changed.task) && raw_value !== (raw_value = ctx.task.model.html)) {
					detachBetween(raw_before, raw_after);
					raw_before.insertAdjacentHTML("afterend", raw_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachBetween(raw_before, raw_after);
					detachNode(raw_before);
					detachNode(raw_after);
				}
			}
		};
	}

	// (14:8) {:else}
	function create_if_block_1(component, ctx) {
		var text_value = ctx.task.model.label, text;

		return {
			c: function create() {
				text = createText(text_value);
			},

			m: function mount(target, anchor) {
				insert(target, text, anchor);
			},

			p: function update(changed, ctx) {
				if ((changed.task) && text_value !== (text_value = ctx.task.model.label)) {
					setData(text, text_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(text);
				}
			}
		};
	}

	function Task(options) {
		this._debugName = '<Task>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this.refs = {};
		this._state = assign(data$2(), options.data);
		if (!('task' in this._state)) console.warn("<Task> was created without expected data property 'task'");
		this._intro = !!options.intro;
		this._handlers.update = [onupdate];

		this._handlers.destroy = [ondestroy];

		this._fragment = create_main_fragment$2(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$2.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Task.prototype, protoDev);
	assign(Task.prototype, methods$2);

	Task.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\Row.html generated by Svelte v2.13.4 */

	var methods$3 = {
	    taskMoved() {
	        console.log('Task moved');
	        const { row } = this.get();
	        this.set({ row });
	    },
	    taskAdded() {
	        //when task moving to row, need to update row to show new task
	        const { row } = this.get();
	        console.log('Task moved to row', row);
	        this.set({ row });
	    },
	    taskRemoved() {
	        const { row } = this.get();
	        console.log('Task removed from row', row);
	        this.set({ row });
	    },
	    taskDropped(task) {
	        this.handleOverlaps();
	    },
	    handleOverlaps(){
	        this.sortTasks();
	        const { row } = this.get();
	        const overlaps = [];
	        let previous = row.tasks[0];
	        for(let i = 1; i < row.tasks.length; i++){
	            const current = row.tasks[i];

	            if(current.overlaps(previous))
	            {
	                if(current.overlapping !== true){
	                    current.overlapping = true;
	                    current.component.set({ task: current });
	                }
	                if(previous.overlapping !== true){
	                    previous.overlapping = true;
	                    previous.component.set({ task: previous });
	                }

	                if(overlaps.indexOf(current.id) === -1){
	                    overlaps.push(current.id);
	                }

	                if(overlaps.indexOf(previous.id) === -1){
	                    overlaps.push(previous.id);
	                }
	            }

	            if (previous.left + previous.width < current.left + current.width) {
	                previous = current;
	            }
	        }

	        for(let i = 0; i < row.tasks.length; i++){
	            const current = row.tasks[i];
	            if(overlaps.indexOf(current.id) === -1){
	                if(!!current.overlapping) {
	                    current.overlapping = false;
	                    current.component.set({ task: current });
	                }
	            }
	        }
	    },
	    sortTasks() {
	        const { row } =  this.get();
	        row.tasks.sort(function (a, b) {
	            if (a.left < b.left) {
	                return -1
	            } else if (a.left > b.left) {
	                return 1
	            }
	            return 0
	        });
	    },
	    updateVisible(){
	        const { row } = this.get();

	        const visibleTasks = this.visibleTasks(row);
	        this.set({visibleTasks});
	    },
	    visibleTasks(row){
	        const { gantt, from, to } = this.store.get();
	        const scrollLeft = gantt.refs.mainContainer.scrollLeft;
	        const clientWidth = gantt.refs.mainContainer.clientWidth;
	        //finish this
	        //this.store.set({scrollLeft, clientWidth});

	        //da su sortirani -> index prvog, zadnjeg, i onda slice
	        //da su sortirani -> nakon zadnjeg break
	        const visibleTasks = [];
	        row.tasks.forEach(task => {
	            if(!(task.to < from || task.from > to)){
	                visibleTasks.push(task);
	            }
	        });
	        console.log(visibleTasks.length);
	        return visibleTasks;
	    }
	};

	function oncreate$3() {
	    const { row } = this.get();
	    row.rowElement = this.refs.row;
	    row.component = this;

	    if(!row.classes){ //default
	        row.classes = [];
	    }
	}
	function ondestroy$1(){
	    const { row } = this.get();
	    row.rowElement = null;
	    row.component = null;
	}
	function onupdate$1({ changed, current, previous }) {
	    if(changed.row){
	        current.row.rowElement = this.refs.row;
	        current.row.component = this;
	    }
	}
	function contextMenu$1(node){
	    const { gantt } = this.store.get();

	    if(gantt.enableContextMenu){
	        const { row } = this.get();
	        const options = [
	            {
	                label: 'Copy row',
	                action: () => console.log('clicked action 1 for task ', row.id)
	            },
	            {
	                label: 'Clear dependencies',
	                action: () => console.log('clicked action 2 for task ', row.id)
	            }
	        ];

	        function onClose(event) {
	            //if(!contextMenu.isTarget(e))
	            gantt.menuManager.close();
	        }

	        node.addEventListener('mouseup', (e) => {
	            //e.stopPropagation();
	            if(e.which === 3){
	                gantt.menuManager.open(options, {x: e.x, y: e.y});

	                DOMUtils.addEventListenerOnce(node, 'mousedown', onClose); //document.body
	            }
	        });
	    }
	    
	    return {
	        destroy() {
	            gantt.menuManager.close();
	        }
	    }
	}
	const file$3 = "src\\Row.html";

	function create_main_fragment$3(component, ctx) {
		var div, each_blocks_1 = [], each_lookup = blankObject(), text, div_class_value, contextMenu_action, current;

		var each_value = ctx.row.tasks;

		const get_key = ctx => ctx.task.model.id;

		for (var i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$1(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_blocks_1[i] = each_lookup[key] = create_each_block$1(component, key, child_ctx);
		}

		var if_block = (ctx.row.model.contentHtml) && create_if_block$1(component, ctx);

		return {
			c: function create() {
				div = createElement("div");

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].c();

				text = createText("\r\n    ");
				if (if_block) if_block.c();
				div.className = div_class_value = "row " + ctx.row.model.classes + " svelte-1jglin1";
				setStyle(div, "height", "" + ctx.$rowHeight + "px");
				addLoc(div, file$3, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].i(div, null);

				append(div, text);
				if (if_block) if_block.m(div, null);
				component.refs.row = div;
				contextMenu_action = contextMenu$1.call(component, div) || {};
				current = true;
			},

			p: function update(changed, ctx) {
				const each_value = ctx.row.tasks;
				each_blocks_1 = updateKeyedEach(each_blocks_1, component, changed, get_key, 1, ctx, each_value, each_lookup, div, outroAndDestroyBlock, create_each_block$1, "i", text, get_each_context$1);

				if (ctx.row.model.contentHtml) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block$1(component, ctx);
						if_block.c();
						if_block.m(div, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if ((!current || changed.row) && div_class_value !== (div_class_value = "row " + ctx.row.model.classes + " svelte-1jglin1")) {
					div.className = div_class_value;
				}

				if (!current || changed.$rowHeight) {
					setStyle(div, "height", "" + ctx.$rowHeight + "px");
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				const countdown = callAfter(outrocallback, each_blocks_1.length);
				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].o(countdown);

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].d();

				if (if_block) if_block.d();
				if (component.refs.row === div) component.refs.row = null;
				if (typeof contextMenu_action.destroy === 'function') contextMenu_action.destroy.call(component);
			}
		};
	}

	// (2:4) {#each row.tasks as task (task.model.id)}
	function create_each_block$1(component, key_1, ctx) {
		var first, current;

		var task_initial_data = { row: ctx.row, task: ctx.task };
		var task = new Task({
			root: component.root,
			store: component.store,
			data: task_initial_data
		});

		task.on("updateVisibleRows", function(event) {
			component.fire("updateVisibleRows", event);
		});
		task.on("taskMoved", function(event) {
			component.taskMoved();
		});
		task.on("taskMovedRow", function(event) {
			component.taskAdded();
		});
		task.on("taskRemovedRow", function(event) {
			component.taskRemoved();
		});
		task.on("taskResized", function(event) {
			component.taskMoved();
		});
		task.on("taskDropped", function(event) {
			component.taskDropped(ctx.task);
		});

		return {
			key: key_1,

			first: null,

			c: function create() {
				first = createComment();
				task._fragment.c();
				this.first = first;
			},

			m: function mount(target, anchor) {
				insert(target, first, anchor);
				task._mount(target, anchor);
				current = true;
			},

			p: function update(changed, _ctx) {
				ctx = _ctx;
				var task_changes = {};
				if (changed.row) task_changes.row = ctx.row;
				if (changed.row) task_changes.task = ctx.task;
				task._set(task_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (task) task._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(first);
				}

				task.destroy(detach);
			}
		};
	}

	// (12:4) {#if row.model.contentHtml}
	function create_if_block$1(component, ctx) {
		var raw_value = ctx.row.model.contentHtml, raw_before, raw_after;

		return {
			c: function create() {
				raw_before = createElement('noscript');
				raw_after = createElement('noscript');
			},

			m: function mount(target, anchor) {
				insert(target, raw_before, anchor);
				raw_before.insertAdjacentHTML("afterend", raw_value);
				insert(target, raw_after, anchor);
			},

			p: function update(changed, ctx) {
				if ((changed.row) && raw_value !== (raw_value = ctx.row.model.contentHtml)) {
					detachBetween(raw_before, raw_after);
					raw_before.insertAdjacentHTML("afterend", raw_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachBetween(raw_before, raw_after);
					detachNode(raw_before);
					detachNode(raw_after);
				}
			}
		};
	}

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.task = list[i];
		child_ctx.each_value = list;
		child_ctx.task_index = i;
		return child_ctx;
	}

	function Row(options) {
		this._debugName = '<Row>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this.refs = {};
		this._state = assign(this.store._init(["rowHeight"]), options.data);
		this.store._add(this, ["rowHeight"]);
		if (!('row' in this._state)) console.warn("<Row> was created without expected data property 'row'");
		if (!('$rowHeight' in this._state)) console.warn("<Row> was created without expected data property '$rowHeight'");
		this._intro = !!options.intro;
		this._handlers.update = [onupdate$1];

		this._handlers.destroy = [ondestroy$1, removeFromStore];

		this._fragment = create_main_fragment$3(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$3.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Row.prototype, protoDev);
	assign(Row.prototype, methods$3);

	Row.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\Column.html generated by Svelte v2.13.4 */

	function data$3(){
	    return {}
	}
	function oncreate$4() {
	}
	const file$4 = "src\\Column.html";

	function create_main_fragment$4(component, ctx) {
		var div, current;

		return {
			c: function create() {
				div = createElement("div");
				div.className = "column svelte-gqf3br";
				setStyle(div, "width", "" + ctx.width + "px");
				addLoc(div, file$4, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.width) {
					setStyle(div, "width", "" + ctx.width + "px");
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	function Column(options) {
		this._debugName = '<Column>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign(data$3(), options.data);
		if (!('width' in this._state)) console.warn("<Column> was created without expected data property 'width'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$4(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$4.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Column.prototype, protoDev);

	Column.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src\ColumnHeader.html generated by Svelte v2.13.4 */

	function data$4(){
	    return {
	        headers: [],
	        width: null
	    }
	}
	var methods$4 = {
	    initHeaders() {
	        this.root.initGantt();
	        const { header } = this.get();
	        const { from, width, gantt } = this.store.get();
	        const columnWidth = gantt.utils.getPositionByDate(from.clone().add(1, header.unit));
	        const columnCount = Math.ceil(width / columnWidth); 

	        const headers = [];
	        let headerTime = from.clone();

	        for(let i=0; i< columnCount; i++){
	            headers.push({width: columnWidth, label: headerTime.format(header.format)});
	            headerTime.add(1, header.unit);
	        }

	        this.set({headers});
	    }
	};

	function oncreate$5() {
	    this.initHeaders();
	}
	function onupdate$2({ changed, current, previous }){
	    if(previous != null){
	        this.initHeaders();
	    }
	}
	const file$5 = "src\\ColumnHeader.html";

	function create_main_fragment$5(component, ctx) {
		var div, current;

		var each_value = ctx.headers;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(component, get_each_context$2(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = createElement("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "column-header-row svelte-1obsyea";
				setStyle(div, "width", "" + ctx.width + "px");
				addLoc(div, file$5, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.headers) {
					each_value = ctx.headers;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$2(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if (changed.width) {
					setStyle(div, "width", "" + ctx.width + "px");
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (2:4) {#each headers as header}
	function create_each_block$2(component, ctx) {
		var div, text_value = ctx.header.label || 'N/A', text;

		return {
			c: function create() {
				div = createElement("div");
				text = createText(text_value);
				div.className = "column-header svelte-1obsyea";
				setStyle(div, "width", "" + ctx.header.width + "px");
				addLoc(div, file$5, 2, 8, 96);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, text);
			},

			p: function update(changed, ctx) {
				if ((changed.headers) && text_value !== (text_value = ctx.header.label || 'N/A')) {
					setData(text, text_value);
				}

				if (changed.headers) {
					setStyle(div, "width", "" + ctx.header.width + "px");
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	function get_each_context$2(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.header = list[i];
		child_ctx.each_value = list;
		child_ctx.header_index = i;
		return child_ctx;
	}

	function ColumnHeader(options) {
		this._debugName = '<ColumnHeader>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign(data$4(), options.data);
		if (!('width' in this._state)) console.warn("<ColumnHeader> was created without expected data property 'width'");
		if (!('headers' in this._state)) console.warn("<ColumnHeader> was created without expected data property 'headers'");
		this._intro = !!options.intro;
		this._handlers.update = [onupdate$2];

		this._fragment = create_main_fragment$5(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$5.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(ColumnHeader.prototype, protoDev);
	assign(ColumnHeader.prototype, methods$4);

	ColumnHeader.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	function Store(state, options) {
		this._handlers = {};
		this._dependents = [];

		this._computed = blankObject();
		this._sortedComputedProperties = [];

		this._state = assign({}, state);
		this._differs = options && options.immutable ? _differsImmutable : _differs;
	}

	assign(Store.prototype, {
		_add(component, props) {
			this._dependents.push({
				component: component,
				props: props
			});
		},

		_init(props) {
			const state = {};
			for (let i = 0; i < props.length; i += 1) {
				const prop = props[i];
				state['$' + prop] = this._state[prop];
			}
			return state;
		},

		_remove(component) {
			let i = this._dependents.length;
			while (i--) {
				if (this._dependents[i].component === component) {
					this._dependents.splice(i, 1);
					return;
				}
			}
		},

		_set(newState, changed) {
			const previous = this._state;
			this._state = assign(assign({}, previous), newState);

			for (let i = 0; i < this._sortedComputedProperties.length; i += 1) {
				this._sortedComputedProperties[i].update(this._state, changed);
			}

			this.fire('state', {
				changed,
				previous,
				current: this._state
			});

			this._dependents
				.filter(dependent => {
					const componentState = {};
					let dirty = false;

					for (let j = 0; j < dependent.props.length; j += 1) {
						const prop = dependent.props[j];
						if (prop in changed) {
							componentState['$' + prop] = this._state[prop];
							dirty = true;
						}
					}

					if (dirty) {
						dependent.component._stage(componentState);
						return true;
					}
				})
				.forEach(dependent => {
					dependent.component.set({});
				});

			this.fire('update', {
				changed,
				previous,
				current: this._state
			});
		},

		_sortComputedProperties() {
			const computed = this._computed;
			const sorted = this._sortedComputedProperties = [];
			const visited = blankObject();
			let currentKey;

			function visit(key) {
				const c = computed[key];

				if (c) {
					c.deps.forEach(dep => {
						if (dep === currentKey) {
							throw new Error(`Cyclical dependency detected between ${dep} <-> ${key}`);
						}

						visit(dep);
					});

					if (!visited[key]) {
						visited[key] = true;
						sorted.push(c);
					}
				}
			}

			for (const key in this._computed) {
				visit(currentKey = key);
			}
		},

		compute(key, deps, fn) {
			let value;

			const c = {
				deps,
				update: (state, changed, dirty) => {
					const values = deps.map(dep => {
						if (dep in changed) dirty = true;
						return state[dep];
					});

					if (dirty) {
						const newValue = fn.apply(null, values);
						if (this._differs(newValue, value)) {
							value = newValue;
							changed[key] = true;
							state[key] = value;
						}
					}
				}
			};

			this._computed[key] = c;
			this._sortComputedProperties();

			const state = assign({}, this._state);
			const changed = {};
			c.update(state, changed, true);
			this._set(state, changed);
		},

		fire,

		get,

		on,

		set(newState) {
			const oldState = this._state;
			const changed = this._changed = {};
			let dirty = false;

			for (const key in newState) {
				if (this._computed[key]) throw new Error(`'${key}' is a read-only property`);
				if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
			}
			if (!dirty) return;

			this._set(newState, changed);
		}
	});

	class ContextMenuManager {
	    constructor(gantt) {
	        this.current = null;
	        this.gantt = gantt;
	    }

	    open(actions, position) {
	        if(this.current) {
	            this.current.close();
	        }
	        
	        const contextMenu = new ContextMenu({
	            target: document.body,//this.gantt.refs.ganttElement,//todo: fix, styles (font size, font face), positioning
	            data: { actions },
	            position: position,
	            onactionend: () => contextMenu.close()
	        });

	        this.current = contextMenu;
	        return this.current;
	    }

	    close() {
	        if(this.current) {
	            this.current.close();
	            this.current = null;
	        }
	    }
	}

	class SelectionManager {
	    constructor(onSelectionChange) {
	        this.onSelectionChange = onSelectionChange;
	        this.selection = [];
	    }

	    selectSingle(item){
	        this.selection.forEach((selectionItem) => { 
	            this.updateSelected(selectionItem, false);
	        });
	        this.updateSelected(item, true);
	        this.selection = [item];
	    }

	    toggleSelection(item){
	        const index = this.selection.indexOf(item);
	        if(index !== -1){
	            this.updateSelected(item, false);
	            this.selection.splice(index, 1);
	        }
	        else{
	            this.updateSelected(item, true);
	            this.selection.push(item);
	        }
	    }

	    updateSelected(item, value){
	        if(item.selected !== value){
	            item.selected = value;
	            item.updateView();
	            //this.onSelectionChange && this.onSelectionChange(item, value);
	        }
	    }

	    clearSelection(){
	        this.selection = [];
	    }
	}

	class GanttUtils {

	    constructor(gantt) {
	        this.gantt = gantt;
	    }

	    /**
	     * Returns position of date on a line if from and to represent length of width
	     * @param {*} date 
	     */
	    getPositionByDate (date) {
	        if (!date) {
	          return undefined
	        }

	        const {from, to, width} = this.gantt.store.get();

	        let durationTo = date.diff(from, 'milliseconds');
	        let durationToEnd = to.diff(from, 'milliseconds');

	        return durationTo / durationToEnd * width;
	    }

	    getDateByPosition (x) {
	        const {from, to, width} = this.gantt.store.get();

	        let durationTo = x / width * to.diff(from, 'milliseconds');
	        let dateAtPosition = from.clone().add(durationTo, 'milliseconds');
	        return dateAtPosition; 
	    }

	    /**
	     * 
	     * @param {Moment} date - Date
	     * @returns {Moment} rounded date passed as parameter
	     */
	    roundTo (date) {
	        const {magnetUnit, magnetOffset} = this.gantt.store.get();

	        let value = date.get(magnetUnit);
	    
	        value = Math.round(value / magnetOffset);
	    
	        date.set(magnetUnit, value * magnetOffset);

	        //round all smaller units to 0
	        const units = ['millisecond', 'second', 'minute', 'hour', 'date', 'month', 'year'];
	        const indexOf = units.indexOf(magnetUnit);
	        for (let i = 0; i < indexOf; i++) {
	            date.set(units[i], 0);
	        }
	        return date
	    }
	}

	class GanttApi {
	    constructor(gantt){
	        this.gantt = gantt;
	        this.listeners = [];
	        this.listenersMap = {};
	    }

	    registerEvent(featureName, eventName) {
	        if (!this[featureName]) {
	            this[featureName] = {};      
	        }
	    
	        let feature = this[featureName];
	        if (!feature.on) {
	            feature.on = {};
	            feature.raise = {};
	        }
	    
	        let eventId = 'on:' + featureName + ':' + eventName;
	    
	        feature.raise[eventName] = (...params) => {
	            //todo add svelte? event listeners, looping isnt effective unless rarely used
	            this.listeners.forEach(listener => {
	                if(listener.eventId === eventId){
	                    listener.handler(params);
	                }
	            });
	        };
	    
	        // Creating on event method featureName.oneventName
	        feature.on[eventName] = (handler) => {
	    
	            // track our listener so we can turn off and on
	            let listener = {
	                handler: handler,
	                eventId: eventId
	            };
	            this.listenersMap[eventId] = listener;
	            this.listeners.push(listener);
	    
	            let removeListener = () => {
	                let index = this.listeners.indexOf(listener);
	                this.listeners.splice(index, 1);
	            };
	    
	            return removeListener
	        };
	      }
	}

	class SvelteRow {

	    constructor(gantt, row){
	        this.gantt = gantt;
	        this.model = row;
	        this.tasks = [];//kasnije se init
	    }

	    addTask(task) {
	        this.tasks.push(task);

	        if (this.model.tasks === undefined) {
	            this.model.tasks = [];
	        }
	        if (this.model.tasks.indexOf(task.model) === -1) {
	            this.model.tasks.push(task.model);
	        }
	    }

	    moveTask(task) {
	        const sourceRow = task.row;
	        sourceRow.removeTask(task);

	        task.row = this;
	        this.addTask(task);
	    }

	    
	    removeTask(task) {
	        const index = this.tasks.indexOf(task);
	        if(index !== -1){
	            this.tasks.splice(index, 1);
	        }

	        const modelIndex = this.model.tasks.indexOf(task.model);
	        if(modelIndex !== -1){
	            this.model.tasks.splice(modelIndex, 1);
	        }
	    }

	    updateView() {
	        if(this.component) {
	            this.component.set({row: this});
	        }
	    }
	}

	/* src\Gantt.html generated by Svelte v2.13.4 */

	//import GanttDependencies from './modules/dependencies/GanttDependencies.html';
	//import Table from './modules/table/Table.html';

	let SvelteGantt;

	function rowContainerHeight({rows, $rowHeight}) {
		return rows.length * $rowHeight;
	}

	function data$5() {
	    return {
	        columns: [],
	        scrollables: [],
	        visibleRows: [],
	        _ganttBodyModules: [],
	        _ganttTableModules: [],
	        _modules: [],

	        rows: [],

	        paddingTop: 0,
	        paddingBottom: 0
	    }
	}
	var methods$5 = {
	    initData(data){
	        const rows = [];
	        const _allTasks = [];
	        const _taskCache = {};
	        for(let i=0; i < data.rows.length; i++){
	            const currentRow = data.rows[i];
	            const row = new SvelteRow(this, currentRow);
	            for(let j=0; j < currentRow.tasks.length; j++){
	                const currentTask = currentRow.tasks[j];
	                currentTask.amountDone = currentTask.amountDone || 0;
	                
	                const task = new SvelteTask(this, currentTask, row);
	                row.addTask(task);
	                _allTasks.push(task);
	                _taskCache[task.model.id] = task;
	            }
	            rows.push(row);
	        }
	        this.set({
	            _allTasks,
	            _taskCache,
	            rows
	        });
	        this.store.set({rows});
	        this.selectionManager.clearSelection();
	        this.updateViewport();
	        this.broadcastModules('initData', data);
	    },
	    initGantt(){
	        if(!this.store.get().gantt){
	            this.store.set({
	                bodyElement: this.refs.mainContainer, 
	                rowContainerElement: this.refs.rowContainer,
	                gantt: this
	            });
	            
	            this.menuManager = new ContextMenuManager(this);
	            this.selectionManager = new SelectionManager();
	            this.utils = new GanttUtils(this);
	            this.api = new GanttApi(this);

	            this.api.registerEvent('tasks', 'move');
	            this.api.registerEvent('tasks', 'select');
	            this.api.registerEvent('tasks', 'switchRow');
	        }
	    },
	    initModule(module){
	        const moduleOptions = Object.assign({
	            _gantt: this,
	            _options: this.get()
	        }, {});//merge with module specific data, modules[module.constructor.key]);
	        module.initModule(moduleOptions);
	        
	        const {_modules} = this.get();
	        _modules.push(module);
	    },
	    broadcastModules(event, data) {
	        const {_modules} = this.get();
	        _modules.forEach((module) => {
	            if (typeof module[event] === 'function') {
	                module[event](data);
	            }
	        });
	    },
	    updateVisibleRows(scrollTop, viewportHeight){
	        console.log('update v rows');
	        const { rows, rowHeight } = this.store.get();

	        let startIndex = Math.floor(scrollTop / rowHeight);
	        let endIndex = Math.min(startIndex + Math.ceil(viewportHeight / rowHeight ), rows.length - 1);

	        console.log('['+startIndex+','+endIndex+']');

	        const paddingTop = startIndex * rowHeight;
	        const paddingBottom = (rows.length - endIndex - 1) * rowHeight;

	        const visibleRows = rows.slice(startIndex, endIndex + 1);

	        //only horizontal scroll
	        /*visibleRows.forEach(row => {
	            row.visibleTasks = this.visibleTasks(row);
	        });*/

	        this.set({ visibleRows, paddingTop, paddingBottom });
	        this.store.set({ visibleRows, paddingTop, paddingBottom });
	    },
	    visibleTasks(row){
	        const scrollLeft = this.refs.mainContainer.scrollLeft;
	        const clientWidth = this.refs.mainContainer.clientWidth;
	        //finish this
	        //this.store.set({scrollLeft, clientWidth});

	        //da su sortirani -> index prvog, zadnjeg, i onda slice
	        //da su sortirani -> nakon zadnjeg break
	        const visibleTasks = [];
	        row.tasks.forEach(task => {
	            if(!(task.left + task.width < scrollLeft || task.left > scrollLeft + clientWidth)){
	                visibleTasks.push(task);
	            }
	        });
	        console.log(visibleTasks.length);
	        return visibleTasks;
	    },
	    updateViewport(){
	        console.log('update v port');
	        const {scrollTop, clientHeight} = this.refs.mainContainer;

	        this.updateVisibleRows(scrollTop, clientHeight);
	        this.broadcastModules('updateVisible', {scrollAmount: scrollTop, viewportHeight: clientHeight});
	    },
	    initColumns() {
	        const {magnetOffset, magnetUnit, from, width} = this.store.get();
	        const columnWidth = this.utils.getPositionByDate(from.clone().add(magnetOffset, magnetUnit));
	        const columnCount = Math.ceil(width / columnWidth); 

	        const columns = [];
	        for(let i = 0; i < columnCount; i++){
	            columns.push({width: columnWidth});
	        }

	        this.set({ columns });
	    },
	    updateView({from, to, headers, width}){
	        this.store.set({from, to, headers, width});
	        this.initColumns();

	        const {_allTasks} = this.get();
	        _allTasks.forEach(task => {
	            task.updatePosition();
	            task.updateView();
	        });

	        const {rows} = this.store.get();
	        rows.forEach(row => {
	            if(row.component)
	                row.component.updateVisible();
	        });

	        this.broadcastModules('updateView', {from, to, headers});
	    }
	};

	function oncreate$6(){
	    this.initGantt();
	    

	    const {rows, initialRows, dependencies} = this.get();
	    this.initData({rows: initialRows, dependencies});
	    // const _allTasks = [];
	    // const _taskCache = {};
	    // for(let i=0; i < initialRows.length; i++){
	    //     const currentRow = initialRows[i];
	    //     const row = new SvelteRow(this, currentRow);
	    //     for(let j=0; j < currentRow.tasks.length; j++){
	    //         const currentTask = currentRow.tasks[j];
	    //         currentTask.amountDone = currentTask.amountDone || 0;
	            
	    //         const task = new SvelteTask(this, currentTask, row);
	    //         row.addTask(task);
	    //         _allTasks.push(task);
	    //         _taskCache[task.model.id] = task;
	    //     }
	    //     rows.push(row);
	    // }
	    // this.set({
	    //     _allTasks,
	    //     _taskCache,
	    //     rows
	    // });
	    // this.store.set({rows});


	    this.initColumns();

	    this.refs.mainContainer.addEventListener('mouseup', function(event){
	        console.log('mouse up on ', event.target);
	    });

	    this.onWindowResizeHandler = (event) => {
	        const parentWidth = this.refs.ganttElement.clientWidth;
	        const parentHeight = this.refs.ganttElement.clientHeight;
	        
	        const tableWidth = this.store.get().tableWidth || 0;

	        this.refs.sideContainer.style.width = parentWidth - tableWidth - 17 + 'px';
	        this.refs.mainContainer.style.width = parentWidth - tableWidth + 'px';

	        const height = parentHeight - this.refs.sideContainer.clientHeight - 17;

	        this.store.set({
	            //width, 
	            height
	        });
	    };

	    window.addEventListener('resize', this.onWindowResizeHandler);
	    this.onWindowResizeHandler(null);
	    
	    this.broadcastModules('onGanttCreated');
	    this.updateViewport();
	}
	function ondestroy$2(){
	    //remove event listener
	    window.removeEventListener('resize', this.onWindowResizeHandler);
	}
	function setup$2(component){
	    SvelteGantt = component;
	    SvelteGantt.defaults = {
	        // datetime timeline starts on, currently moment-js object
	        from: null,
	        // datetime timeline ends on, currently moment-js object
	        to: null,
	        // width of main gantt area in px
	        width: 800, //rename to timelinewidth
	        // height of main gantt area in px
	        height: 400,
	        // minimum unit of time task date values will round to 
	        magnetUnit: 'minute',
	        // amount of units task date values will round to
	        magnetOffset: 15,
	        // list of headers used for main gantt area
	        // unit: time unit used, e.g. day will create a cell in the header for each day in the timeline
	        // format: datetime format used for header cell label
	        headers: [{unit: 'day', format: 'DD.MM.YYYY'}, {unit: 'hour', format: 'HH'}],
	        // height of a single row in px
	        rowHeight: 24,
	        // modules used in gantt
	        modules: [],
	        // enables right click context menu
	        enableContextMenu: false,
	        // sets top level gantt class which can be used for styling
	        classes: '',
	        // width of handle for resizing grid
	        resizeHandleWidth: 5
	    };

	    SvelteGantt.create = function(target, data, options) {

	        const ganttModules = {
	            ganttBodyModules: [],
	            ganttTableModules: [],
	            defaults: {}
	        };

	        // delete when each module gets built into separate js
	        //options.modules = [Table, ...options.modules]; // [Table, GanttDependencies];
	        if(options.modules) {
	            options.modules.forEach((module) => {
	                module.bindToGantt(ganttModules);
	            });
	        }

	        const newData = {
	            initialRows: data.rows,
	            dependencies: data.dependencies
	        };

	        Object.assign(newData, {
	            _ganttBodyModules: ganttModules.ganttBodyModules,
	            _ganttTableModules: ganttModules.ganttTableModules
	        });


	        const ganttOptions = Object.assign({}, SvelteGantt.defaults, ganttModules.defaults, options);
	        
	        const store = new Store();
	        store.set(ganttOptions);
	        store.set({ 
	            //rows: data.rows
	        });

	        return new SvelteGantt({
	            target,
	            data: newData,
	            store
	        });
	    };
	}
	function disableContextMenu(node) {
	    if(this.store.get().enableContextMenu){
	        node.addEventListener('contextmenu', function(e) {
	            e.preventDefault();
	        }, false);
	        //ovo dolje radi kad stvoriš svelte contextmenu, klikne na sam contextmenu TO DO remove
	        document.addEventListener('contextmenu', function(e) {
	            e.preventDefault();
	        }, false);
	    }
	}
	function scrollable(node){
	    const { scrollables } = this.get();
	    const self = this;

	    function onscroll(event) {
	        const scrollAmount = node.scrollTop; 

	        console.log(scrollAmount);
	        for(let i=0; i< scrollables.length; i++){
	            const scrollable = scrollables[i];
	            if(scrollable.orientation === 'horizontal') {
	                scrollable.node.scrollLeft = node.scrollLeft;
	            }
	            else {
	                scrollable.node.scrollTop = scrollAmount;
	            }
	        }
	        //TODO: only for vertical scroll
	        self.updateVisibleRows(scrollAmount, node.clientHeight);

	        self.broadcastModules('updateVisible', {scrollAmount, viewportHeight: node.clientHeight});
	    }

	    node.addEventListener('scroll', onscroll);
	    return {
						destroy() {
							node.removeEventListener('scroll', onscroll, false);
						}
	    }
	}
	function horizontalScrollListener(node){
	    const { scrollables } = this.get();
	    scrollables.push({node, orientation: 'horizontal'});
	}
	const file$6 = "src\\Gantt.html";

	function create_main_fragment$6(component, ctx) {
		var div, each_blocks_1 = [], each_lookup = blankObject(), text, div_1, div_2, horizontalScrollListener_action, text_3, div_3, div_4, div_5, text_5, div_6, each_3_blocks_1 = [], each_3_lookup = blankObject(), text_7, each_4_blocks_1 = [], each_4_lookup = blankObject(), scrollable_action, div_class_value, disableContextMenu_action, text_11, text_12, current;

		var each_value = ctx._ganttTableModules;

		const get_key = ctx => ctx.module.key;

		for (var i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$3(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_blocks_1[i] = each_lookup[key] = create_each_block$3(component, key, child_ctx);
		}

		var each_value_1 = ctx.$headers;

		var each_1_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_1_blocks[i] = create_each_block_1(component, get_each_1_context(ctx, each_value_1, i));
		}

		function outroBlock(i, detach, fn) {
			if (each_1_blocks[i]) {
				each_1_blocks[i].o(() => {
					if (detach) {
						each_1_blocks[i].d(detach);
						each_1_blocks[i] = null;
					}
					if (fn) fn();
				});
			}
		}

		var each_value_2 = ctx.columns;

		var each_2_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_2_blocks[i] = create_each_block_2(component, get_each_2_context(ctx, each_value_2, i));
		}

		function outroBlock_1(i, detach, fn) {
			if (each_2_blocks[i]) {
				each_2_blocks[i].o(() => {
					if (detach) {
						each_2_blocks[i].d(detach);
						each_2_blocks[i] = null;
					}
					if (fn) fn();
				});
			}
		}

		var each_value_3 = ctx.visibleRows;

		const get_key_1 = ctx => ctx.row.model.id;

		for (var i = 0; i < each_value_3.length; i += 1) {
			let child_ctx = get_each_3_context(ctx, each_value_3, i);
			let key = get_key_1(child_ctx);
			each_3_blocks_1[i] = each_3_lookup[key] = create_each_block_3(component, key, child_ctx);
		}

		var each_value_4 = ctx._ganttBodyModules;

		const get_key_2 = ctx => ctx.module.key;

		for (var i = 0; i < each_value_4.length; i += 1) {
			let child_ctx = get_each_4_context(ctx, each_value_4, i);
			let key = get_key_2(child_ctx);
			each_4_blocks_1[i] = each_4_lookup[key] = create_each_block_4(component, key, child_ctx);
		}

		var externaldiv_initial_data = { gantt: ctx.$gantt };
		var externaldiv = new ExternalDiv({
			root: component.root,
			store: component.store,
			slots: { default: createFragment() },
			data: externaldiv_initial_data
		});

		return {
			c: function create() {
				div = createElement("div");

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].c();

				text = createText("\r\n\r\n    ");
				div_1 = createElement("div");
				div_2 = createElement("div");

				for (var i = 0; i < each_1_blocks.length; i += 1) {
					each_1_blocks[i].c();
				}

				text_3 = createText("\r\n\r\n    ");
				div_3 = createElement("div");
				div_4 = createElement("div");
				div_5 = createElement("div");

				for (var i = 0; i < each_2_blocks.length; i += 1) {
					each_2_blocks[i].c();
				}

				text_5 = createText("\r\n            ");
				div_6 = createElement("div");

				for (i = 0; i < each_3_blocks_1.length; i += 1) each_3_blocks_1[i].c();

				text_7 = createText("\r\n            ");

				for (i = 0; i < each_4_blocks_1.length; i += 1) each_4_blocks_1[i].c();

				text_11 = createText("\r\n");
				text_12 = createText("\r\nreal content\r\n");
				externaldiv._fragment.c();
				div_2.className = "header-container";
				setStyle(div_2, "width", "" + ctx.$width + "px");
				addLoc(div_2, file$6, 6, 8, 331);
				div_1.className = "main-header-container svelte-1mh1voh";
				addLoc(div_1, file$6, 5, 4, 238);
				div_5.className = "column-container svelte-1mh1voh";
				addLoc(div_5, file$6, 15, 12, 690);
				div_6.className = "row-container svelte-1mh1voh";
				setStyle(div_6, "padding-top", "" + ctx.paddingTop + "px");
				setStyle(div_6, "padding-bottom", "" + ctx.paddingBottom + "px");
				setStyle(div_6, "height", "" + ctx.rowContainerHeight + "px");
				addLoc(div_6, file$6, 20, 12, 874);
				div_4.className = "content svelte-1mh1voh";
				setStyle(div_4, "width", "" + ctx.$width + "px");
				addLoc(div_4, file$6, 14, 8, 630);
				div_3.className = "main-container svelte-1mh1voh";
				setStyle(div_3, "height", "" + ctx.$height + "px");
				addLoc(div_3, file$6, 13, 4, 532);
				div.className = div_class_value = "gantt " + ctx.$classes + " svelte-1mh1voh";
				addLoc(div, file$6, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].i(div, null);

				append(div, text);
				append(div, div_1);
				append(div_1, div_2);

				for (var i = 0; i < each_1_blocks.length; i += 1) {
					each_1_blocks[i].i(div_2, null);
				}

				component.refs.sideContainer = div_1;
				horizontalScrollListener_action = horizontalScrollListener.call(component, div_1) || {};
				append(div, text_3);
				append(div, div_3);
				append(div_3, div_4);
				append(div_4, div_5);

				for (var i = 0; i < each_2_blocks.length; i += 1) {
					each_2_blocks[i].i(div_5, null);
				}

				append(div_4, text_5);
				append(div_4, div_6);

				for (i = 0; i < each_3_blocks_1.length; i += 1) each_3_blocks_1[i].i(div_6, null);

				component.refs.rowContainer = div_6;
				append(div_4, text_7);

				for (i = 0; i < each_4_blocks_1.length; i += 1) each_4_blocks_1[i].i(div_4, null);

				component.refs.mainContainer = div_3;
				scrollable_action = scrollable.call(component, div_3) || {};
				component.refs.ganttElement = div;
				disableContextMenu_action = disableContextMenu.call(component, div) || {};
				insert(target, text_11, anchor);
				append(externaldiv._slotted.default, text_12);
				externaldiv._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				const each_value = ctx._ganttTableModules;
				each_blocks_1 = updateKeyedEach(each_blocks_1, component, changed, get_key, 1, ctx, each_value, each_lookup, div, outroAndDestroyBlock, create_each_block$3, "i", text, get_each_context$3);

				if (changed.$headers) {
					each_value_1 = ctx.$headers;

					for (var i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_1_context(ctx, each_value_1, i);

						if (each_1_blocks[i]) {
							each_1_blocks[i].p(changed, child_ctx);
						} else {
							each_1_blocks[i] = create_each_block_1(component, child_ctx);
							each_1_blocks[i].c();
						}
						each_1_blocks[i].i(div_2, null);
					}
					for (; i < each_1_blocks.length; i += 1) outroBlock(i, 1);
				}

				if (!current || changed.$width) {
					setStyle(div_2, "width", "" + ctx.$width + "px");
				}

				if (changed.columns) {
					each_value_2 = ctx.columns;

					for (var i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_2_context(ctx, each_value_2, i);

						if (each_2_blocks[i]) {
							each_2_blocks[i].p(changed, child_ctx);
						} else {
							each_2_blocks[i] = create_each_block_2(component, child_ctx);
							each_2_blocks[i].c();
						}
						each_2_blocks[i].i(div_5, null);
					}
					for (; i < each_2_blocks.length; i += 1) outroBlock_1(i, 1);
				}

				const each_value_3 = ctx.visibleRows;
				each_3_blocks_1 = updateKeyedEach(each_3_blocks_1, component, changed, get_key_1, 1, ctx, each_value_3, each_3_lookup, div_6, outroAndDestroyBlock, create_each_block_3, "i", null, get_each_3_context);

				if (!current || changed.paddingTop) {
					setStyle(div_6, "padding-top", "" + ctx.paddingTop + "px");
				}

				if (!current || changed.paddingBottom) {
					setStyle(div_6, "padding-bottom", "" + ctx.paddingBottom + "px");
				}

				if (!current || changed.rowContainerHeight) {
					setStyle(div_6, "height", "" + ctx.rowContainerHeight + "px");
				}

				const each_value_4 = ctx._ganttBodyModules;
				each_4_blocks_1 = updateKeyedEach(each_4_blocks_1, component, changed, get_key_2, 1, ctx, each_value_4, each_4_lookup, div_4, outroAndDestroyBlock, create_each_block_4, "i", null, get_each_4_context);

				if (!current || changed.$width) {
					setStyle(div_4, "width", "" + ctx.$width + "px");
				}

				if (!current || changed.$height) {
					setStyle(div_3, "height", "" + ctx.$height + "px");
				}

				if ((!current || changed.$classes) && div_class_value !== (div_class_value = "gantt " + ctx.$classes + " svelte-1mh1voh")) {
					div.className = div_class_value;
				}

				var externaldiv_changes = {};
				if (changed.$gantt) externaldiv_changes.gantt = ctx.$gantt;
				externaldiv._set(externaldiv_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				outrocallback = callAfter(outrocallback, 6);

				const countdown = callAfter(outrocallback, each_blocks_1.length);
				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].o(countdown);

				each_1_blocks = each_1_blocks.filter(Boolean);
				const countdown_1 = callAfter(outrocallback, each_1_blocks.length);
				for (let i = 0; i < each_1_blocks.length; i += 1) outroBlock(i, 0, countdown_1);

				each_2_blocks = each_2_blocks.filter(Boolean);
				const countdown_2 = callAfter(outrocallback, each_2_blocks.length);
				for (let i = 0; i < each_2_blocks.length; i += 1) outroBlock_1(i, 0, countdown_2);

				const countdown_3 = callAfter(outrocallback, each_3_blocks_1.length);
				for (i = 0; i < each_3_blocks_1.length; i += 1) each_3_blocks_1[i].o(countdown_3);

				const countdown_4 = callAfter(outrocallback, each_4_blocks_1.length);
				for (i = 0; i < each_4_blocks_1.length; i += 1) each_4_blocks_1[i].o(countdown_4);

				if (externaldiv) externaldiv._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].d();

				destroyEach(each_1_blocks, detach);

				if (component.refs.sideContainer === div_1) component.refs.sideContainer = null;
				if (typeof horizontalScrollListener_action.destroy === 'function') horizontalScrollListener_action.destroy.call(component);

				destroyEach(each_2_blocks, detach);

				for (i = 0; i < each_3_blocks_1.length; i += 1) each_3_blocks_1[i].d();

				if (component.refs.rowContainer === div_6) component.refs.rowContainer = null;

				for (i = 0; i < each_4_blocks_1.length; i += 1) each_4_blocks_1[i].d();

				if (component.refs.mainContainer === div_3) component.refs.mainContainer = null;
				if (typeof scrollable_action.destroy === 'function') scrollable_action.destroy.call(component);
				if (component.refs.ganttElement === div) component.refs.ganttElement = null;
				if (typeof disableContextMenu_action.destroy === 'function') disableContextMenu_action.destroy.call(component);
				if (detach) {
					detachNode(text_11);
				}

				externaldiv.destroy(detach);
			}
		};
	}

	// (2:4) {#each _ganttTableModules as module (module.key)}
	function create_each_block$3(component, key_1, ctx) {
		var first, switch_instance_anchor, current;

		var switch_value = ctx.module;

		function switch_props(ctx) {
			var switch_instance_initial_data = { visibleRows: ctx.visibleRows };
			return {
				root: component.root,
				store: component.store,
				data: switch_instance_initial_data
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		function switch_instance_init(event) {
			component.initModule(event.module);
		}

		if (switch_instance) switch_instance.on("init", switch_instance_init);

		return {
			key: key_1,

			first: null,

			c: function create() {
				first = createComment();
				if (switch_instance) switch_instance._fragment.c();
				switch_instance_anchor = createComment();
				this.first = first;
			},

			m: function mount(target, anchor) {
				insert(target, first, anchor);

				if (switch_instance) {
					switch_instance._mount(target, anchor);
				}

				insert(target, switch_instance_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var switch_instance_changes = {};
				if (changed.visibleRows) switch_instance_changes.visibleRows = ctx.visibleRows;

				if (switch_value !== (switch_value = ctx.module)) {
					if (switch_instance) {
						const old_component = switch_instance;
						old_component._fragment.o(() => {
							old_component.destroy();
						});
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));
						switch_instance._fragment.c();
						switch_instance._mount(switch_instance_anchor.parentNode, switch_instance_anchor);

						switch_instance.on("init", switch_instance_init);
					} else {
						switch_instance = null;
					}
				}

				else if (switch_value) {
					switch_instance._set(switch_instance_changes);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (switch_instance) switch_instance._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(first);
					detachNode(switch_instance_anchor);
				}

				if (switch_instance) switch_instance.destroy(detach);
			}
		};
	}

	// (8:12) {#each $headers as header}
	function create_each_block_1(component, ctx) {
		var current;

		var columnheader_initial_data = { header: ctx.header };
		var columnheader = new ColumnHeader({
			root: component.root,
			store: component.store,
			data: columnheader_initial_data
		});

		return {
			c: function create() {
				columnheader._fragment.c();
			},

			m: function mount(target, anchor) {
				columnheader._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var columnheader_changes = {};
				if (changed.$headers) columnheader_changes.header = ctx.header;
				columnheader._set(columnheader_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (columnheader) columnheader._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				columnheader.destroy(detach);
			}
		};
	}

	// (17:16) {#each columns as column}
	function create_each_block_2(component, ctx) {
		var current;

		var column_initial_data = { width: ctx.column.width };
		var column = new Column({
			root: component.root,
			store: component.store,
			data: column_initial_data
		});

		return {
			c: function create() {
				column._fragment.c();
			},

			m: function mount(target, anchor) {
				column._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var column_changes = {};
				if (changed.columns) column_changes.width = ctx.column.width;
				column._set(column_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (column) column._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				column.destroy(detach);
			}
		};
	}

	// (23:16) {#each visibleRows as row (row.model.id)}
	function create_each_block_3(component, key_1, ctx) {
		var first, current;

		var row_initial_data = { row: ctx.row };
		var row = new Row({
			root: component.root,
			store: component.store,
			data: row_initial_data
		});

		row.on("updateVisibleRows", function(event) {
			component.updateViewport();
		});

		return {
			key: key_1,

			first: null,

			c: function create() {
				first = createComment();
				row._fragment.c();
				this.first = first;
			},

			m: function mount(target, anchor) {
				insert(target, first, anchor);
				row._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var row_changes = {};
				if (changed.visibleRows) row_changes.row = ctx.row;
				row._set(row_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (row) row._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(first);
				}

				row.destroy(detach);
			}
		};
	}

	// (28:12) {#each _ganttBodyModules as module (module.key)}
	function create_each_block_4(component, key_1, ctx) {
		var first, switch_instance_anchor, current;

		var switch_value = ctx.module;

		function switch_props(ctx) {
			return {
				root: component.root,
				store: component.store
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		function switch_instance_init(event) {
			component.initModule(event.module);
		}

		if (switch_instance) switch_instance.on("init", switch_instance_init);

		return {
			key: key_1,

			first: null,

			c: function create() {
				first = createComment();
				if (switch_instance) switch_instance._fragment.c();
				switch_instance_anchor = createComment();
				this.first = first;
			},

			m: function mount(target, anchor) {
				insert(target, first, anchor);

				if (switch_instance) {
					switch_instance._mount(target, anchor);
				}

				insert(target, switch_instance_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (switch_value !== (switch_value = ctx.module)) {
					if (switch_instance) {
						const old_component = switch_instance;
						old_component._fragment.o(() => {
							old_component.destroy();
						});
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));
						switch_instance._fragment.c();
						switch_instance._mount(switch_instance_anchor.parentNode, switch_instance_anchor);

						switch_instance.on("init", switch_instance_init);
					} else {
						switch_instance = null;
					}
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (switch_instance) switch_instance._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(first);
					detachNode(switch_instance_anchor);
				}

				if (switch_instance) switch_instance.destroy(detach);
			}
		};
	}

	function get_each_context$3(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.module = list[i];
		child_ctx.each_value = list;
		child_ctx.module_index = i;
		return child_ctx;
	}

	function get_each_1_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.header = list[i];
		child_ctx.each_value_1 = list;
		child_ctx.header_index = i;
		return child_ctx;
	}

	function get_each_2_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.column = list[i];
		child_ctx.each_value_2 = list;
		child_ctx.column_index = i;
		return child_ctx;
	}

	function get_each_3_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.row = list[i];
		child_ctx.each_value_3 = list;
		child_ctx.row_index = i;
		return child_ctx;
	}

	function get_each_4_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.module = list[i];
		child_ctx.each_value_4 = list;
		child_ctx.module_index_1 = i;
		return child_ctx;
	}

	function Gantt(options) {
		this._debugName = '<Gantt>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this.refs = {};
		this._state = assign(assign(this.store._init(["rowHeight","classes","width","headers","height","gantt"]), data$5()), options.data);
		this.store._add(this, ["rowHeight","classes","width","headers","height","gantt"]);
		this._recompute({ rows: 1, $rowHeight: 1 }, this._state);
		if (!('rows' in this._state)) console.warn("<Gantt> was created without expected data property 'rows'");
		if (!('$rowHeight' in this._state)) console.warn("<Gantt> was created without expected data property '$rowHeight'");
		if (!('$classes' in this._state)) console.warn("<Gantt> was created without expected data property '$classes'");
		if (!('_ganttTableModules' in this._state)) console.warn("<Gantt> was created without expected data property '_ganttTableModules'");
		if (!('visibleRows' in this._state)) console.warn("<Gantt> was created without expected data property 'visibleRows'");
		if (!('$width' in this._state)) console.warn("<Gantt> was created without expected data property '$width'");
		if (!('$headers' in this._state)) console.warn("<Gantt> was created without expected data property '$headers'");
		if (!('$height' in this._state)) console.warn("<Gantt> was created without expected data property '$height'");
		if (!('columns' in this._state)) console.warn("<Gantt> was created without expected data property 'columns'");
		if (!('paddingTop' in this._state)) console.warn("<Gantt> was created without expected data property 'paddingTop'");
		if (!('paddingBottom' in this._state)) console.warn("<Gantt> was created without expected data property 'paddingBottom'");

		if (!('_ganttBodyModules' in this._state)) console.warn("<Gantt> was created without expected data property '_ganttBodyModules'");
		if (!('$gantt' in this._state)) console.warn("<Gantt> was created without expected data property '$gantt'");
		this._intro = !!options.intro;

		this._handlers.destroy = [ondestroy$2, removeFromStore];

		this._fragment = create_main_fragment$6(this, this._state);

		this.root._oncreate.push(() => {
			oncreate$6.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Gantt.prototype, protoDev);
	assign(Gantt.prototype, methods$5);

	Gantt.prototype._checkReadOnly = function _checkReadOnly(newState) {
		if ('rowContainerHeight' in newState && !this._updatingReadonlyProperty) throw new Error("<Gantt>: Cannot set read-only property 'rowContainerHeight'");
	};

	Gantt.prototype._recompute = function _recompute(changed, state) {
		if (changed.rows || changed.$rowHeight) {
			if (this._differs(state.rowContainerHeight, (state.rowContainerHeight = rowContainerHeight(state)))) changed.rowContainerHeight = true;
		}
	};

	setup$2(Gantt);

	return Gantt;

}());
//# sourceMappingURL=svelteGantt.js.map