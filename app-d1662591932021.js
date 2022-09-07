var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\comp\email.svelte generated by Svelte v3.35.0 */

    const { document: document_1$8 } = globals;

    function add_css$d() {
    	var style = element("style");
    	style.id = "svelte-czdw07-style";
    	style.textContent = ".container.svelte-czdw07{position:absolute;overflow:visible;margin-left:30%;margin-top:50px;border:2px solid black;background-color:white;padding:5px;width:50%;z-index:999}.email-form.svelte-czdw07{width:90%;padding:5px}.width100.svelte-czdw07{width:100%}.btn-grp.svelte-czdw07{padding:5px}";
    	append(document_1$8.head, style);
    }

    function create_fragment$e(ctx) {
    	let div2;
    	let div1;
    	let h40;
    	let t1;
    	let input0;
    	let t2;
    	let h41;
    	let t4;
    	let input1;
    	let t5;
    	let h42;
    	let t7;
    	let textarea;
    	let t8;
    	let div0;
    	let button0;
    	let t10;
    	let button1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div2 = element("div");
    			div1 = element("div");
    			h40 = element("h4");
    			h40.textContent = "Name";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			h41 = element("h4");
    			h41.textContent = "Email";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			h42 = element("h4");
    			h42.textContent = "Message";
    			t7 = space();
    			textarea = element("textarea");
    			t8 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Send Email";
    			t10 = space();
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			attr(input0, "type", "text");
    			attr(input0, "class", "name");
    			attr(input1, "type", "email");
    			attr(input1, "class", "email");
    			attr(textarea, "placeholder", "Enter your message");
    			attr(textarea, "class", "message width100 svelte-czdw07");
    			textarea.value = "\r\n        ";
    			attr(div0, "class", "btn-grp svelte-czdw07");
    			attr(div1, "class", "email-form svelte-czdw07");
    			attr(div2, "class", "container svelte-czdw07");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div1);
    			append(div1, h40);
    			append(div1, t1);
    			append(div1, input0);
    			append(div1, t2);
    			append(div1, h41);
    			append(div1, t4);
    			append(div1, input1);
    			append(div1, t5);
    			append(div1, h42);
    			append(div1, t7);
    			append(div1, textarea);
    			append(div1, t8);
    			append(div1, div0);
    			append(div0, button0);
    			append(div0, t10);
    			append(div0, button1);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*SendEmail*/ ctx[0]),
    					listen(button1, "click", /*ClosePopup*/ ctx[1])
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$c($$self) {
    	const SendEmail = () => {
    		let name = document.getElementsByClassName("name")[0].value;
    		let email = document.getElementsByClassName("email")[0].value;
    		let message = document.getElementsByClassName("message")[0].value;
    		window.open("mailto:[email]?subject=Request for information&body=" + "Name: " + name + "%0D%0A" + "Email: " + email + "%0D%0A" + "Date: " + new Date().toDateString() + "%0D%0A" + "%0D%0A" + name + " has requested more information about their taxes on " + new Date().toDateString() + "%0D%0A %0D%0A Message: %0D%0A %0D%0A" + message + "%0D%0A %0D%0A");
    	};

    	const ClosePopup = () => {
    		document.getElementsByClassName("tax-app")[0].style.opacity = "1";
    		document.getElementsByClassName("top-nav-container")[0].style.opacity = "1";
    		document.getElementsByClassName("logo")[0].style.opacity = ".5";
    		document.getElementsByClassName("email")[0].style.display = "none";
    	};

    	return [SendEmail, ClosePopup];
    }

    class Email extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$8.getElementById("svelte-czdw07-style")) add_css$d();
    		init(this, options, instance$c, create_fragment$e, safe_not_equal, {});
    	}
    }

    /* src\comp\top-nav.svelte generated by Svelte v3.35.0 */

    const { document: document_1$7 } = globals;

    function add_css$c() {
    	var style = element("style");
    	style.id = "svelte-1kjizl2-style";
    	style.textContent = ".top-nav-container.svelte-1kjizl2.svelte-1kjizl2{background-color:black;color:floralwhite;top:0;left:0;position:fixed;width:100%;z-index:99}.top-nav.svelte-1kjizl2.svelte-1kjizl2{display:flex;list-style-type:none;justify-content:space-between;margin:1px}.variation.svelte-1kjizl2.svelte-1kjizl2{padding-top:5px}.float-left.svelte-1kjizl2.svelte-1kjizl2{display:flex}.float-left.svelte-1kjizl2 li.svelte-1kjizl2{padding:5px}.float-right.svelte-1kjizl2.svelte-1kjizl2{display:flex}.btn.svelte-1kjizl2.svelte-1kjizl2{padding:5px;margin:1px 5px}.email.svelte-1kjizl2.svelte-1kjizl2{position:relative;opacity:1;z-index:1}";
    	append(document_1$7.head, style);
    }

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (51:12) {#each variations as variation}
    function create_each_block$4(ctx) {
    	let li;
    	let label;
    	let input;
    	let t0;
    	let t1_value = /*variation*/ ctx[11] + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			attr(input, "type", "radio");
    			input.__value = /*variation*/ ctx[11];
    			input.value = input.__value;
    			/*$$binding_groups*/ ctx[9][0].push(input);
    			attr(li, "class", "variation svelte-1kjizl2");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, label);
    			append(label, input);
    			input.checked = input.__value === /*selectedVariation*/ ctx[0];
    			append(label, t0);
    			append(label, t1);
    			append(li, t2);

    			if (!mounted) {
    				dispose = listen(input, "change", /*input_change_handler*/ ctx[8]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*selectedVariation*/ 1) {
    				input.checked = input.__value === /*selectedVariation*/ ctx[0];
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			/*$$binding_groups*/ ctx[9][0].splice(/*$$binding_groups*/ ctx[9][0].indexOf(input), 1);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$d(ctx) {
    	let div2;
    	let ul;
    	let div0;
    	let t0;
    	let div1;
    	let li0;
    	let button0;
    	let t2;
    	let li1;
    	let button1;
    	let t4;
    	let li2;
    	let button2;
    	let t6;
    	let li3;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let t12;
    	let div3;
    	let email;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*variations*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	email = new Email({});

    	return {
    		c() {
    			div2 = element("div");
    			ul = element("ul");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div1 = element("div");
    			li0 = element("li");
    			button0 = element("button");
    			button0.textContent = "Print";
    			t2 = space();
    			li1 = element("li");
    			button1 = element("button");
    			button1.textContent = "Email";
    			t4 = space();
    			li2 = element("li");
    			button2 = element("button");
    			button2.textContent = "Show Combined Summary";
    			t6 = space();
    			li3 = element("li");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Select a Table to Show\r\n                    ";
    			option1 = element("option");
    			option1.textContent = "i1040tt\r\n                    ";
    			option2 = element("option");
    			option2.textContent = "Child Care Credit\r\n                    ";
    			option3 = element("option");
    			option3.textContent = "Retirement Savings\r\n                    ";
    			option4 = element("option");
    			option4.textContent = "Earned Income Credit (EIC)";
    			t12 = space();
    			div3 = element("div");
    			create_component(email.$$.fragment);
    			attr(div0, "class", "float-left svelte-1kjizl2");
    			attr(button0, "class", "btn svelte-1kjizl2");
    			attr(button1, "class", "btn svelte-1kjizl2");
    			attr(button2, "class", "btn svelte-1kjizl2");
    			option0.__value = "\r\n                        Select a Table to Show\r\n                    ";
    			option0.value = option0.__value;
    			option1.__value = "\r\n                        i1040tt\r\n                    ";
    			option1.value = option1.__value;
    			option2.__value = "\r\n                        Child Care Credit\r\n                    ";
    			option2.value = option2.__value;
    			option3.__value = "\r\n                        Retirement Savings\r\n                    ";
    			option3.value = option3.__value;
    			option4.__value = "\r\n                        Earned Income Credit (EIC)\r\n                    ";
    			option4.value = option4.__value;
    			attr(select, "class", "btn svelte-1kjizl2");
    			attr(div1, "class", "float-right svelte-1kjizl2");
    			attr(ul, "class", "top-nav svelte-1kjizl2");
    			attr(div2, "class", "top-nav-container svelte-1kjizl2");
    			attr(div3, "class", "email svelte-1kjizl2");
    			div3.hidden = true;
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, ul);
    			append(ul, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append(ul, t0);
    			append(ul, div1);
    			append(div1, li0);
    			append(li0, button0);
    			append(div1, t2);
    			append(div1, li1);
    			append(li1, button1);
    			append(div1, t4);
    			append(div1, li2);
    			append(li2, button2);
    			append(div1, t6);
    			append(div1, li3);
    			append(li3, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(select, option4);
    			insert(target, t12, anchor);
    			insert(target, div3, anchor);
    			mount_component(email, div3, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*Print*/ ctx[6]),
    					listen(button1, "click", /*ShowEmailForm*/ ctx[4]),
    					listen(button2, "click", /*ShowCombinedSummary*/ ctx[5]),
    					listen(option1, "click", /*ShowTaxTable*/ ctx[2]),
    					listen(option2, "click", /*ShowCCCTable*/ ctx[3]),
    					listen(option3, "click", /*ShowEmailForm*/ ctx[4]),
    					listen(option4, "click", /*ShowEmailForm*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*variations, selectedVariation*/ 3) {
    				each_value = /*variations*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(email.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(email.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t12);
    			if (detaching) detach(div3);
    			destroy_component(email);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let variations = ["Current", "Projected 1", "Projected 2"];
    	let selectedVariation = "Current";
    	let { onChange } = $$props;

    	const ShowTaxTable = () => {
    		FadeBackgroundItems();
    		document.getElementsByClassName("pdf-table")[0].style.display = "block";
    		document.getElementsByClassName("tax-table-frame")[0].src = "../src/PDF_Tables/tax-table/i1040tt.pdf";
    	};

    	const ShowCCCTable = () => {
    		FadeBackgroundItems();
    		document.getElementsByClassName("pdf-table")[0].style.display = "block";
    		document.getElementsByClassName("tax-table-frame")[0].src = "";
    	};

    	const ShowEmailForm = () => {
    		FadeBackgroundItems();
    		document.getElementsByClassName("email")[0].style.display = "block";
    	};

    	const ShowCombinedSummary = () => {
    		document.getElementById("combined-tax-summary").removeAttribute("hidden");
    		document.getElementsByClassName("actions-to-take")[0].removeAttribute("hidden");
    	};

    	const Print = () => {
    		window.print();
    	};

    	const FadeBackgroundItems = () => {
    		document.getElementsByClassName("tax-app")[0].style.opacity = "0.2";
    		document.getElementsByClassName("logo")[0].style.opacity = "0.2";
    		document.getElementsByClassName("top-nav-container")[0].style.opacity = "0.2";
    	};

    	const $$binding_groups = [[]];

    	function input_change_handler() {
    		selectedVariation = this.__value;
    		$$invalidate(0, selectedVariation);
    	}

    	$$self.$$set = $$props => {
    		if ("onChange" in $$props) $$invalidate(7, onChange = $$props.onChange);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*onChange, selectedVariation*/ 129) {
    			onChange(selectedVariation);
    		}
    	};

    	return [
    		selectedVariation,
    		variations,
    		ShowTaxTable,
    		ShowCCCTable,
    		ShowEmailForm,
    		ShowCombinedSummary,
    		Print,
    		onChange,
    		input_change_handler,
    		$$binding_groups
    	];
    }

    class Top_nav extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$7.getElementById("svelte-1kjizl2-style")) add_css$c();
    		init(this, options, instance$b, create_fragment$d, safe_not_equal, { onChange: 7 });
    	}
    }

    /* src\comp\pdf-table.svelte generated by Svelte v3.35.0 */

    const { document: document_1$6 } = globals;

    function add_css$b() {
    	var style = element("style");
    	style.id = "svelte-122bffh-style";
    	style.textContent = ".pdf-table.svelte-122bffh{position:relative;opacity:1;z-index:1;margin-top:5%}.close-btn.svelte-122bffh{margin-left:92%}";
    	append(document_1$6.head, style);
    }

    function create_fragment$c(ctx) {
    	let div2;
    	let div0;
    	let button;
    	let t1;
    	let div1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "Close";
    			t1 = space();
    			div1 = element("div");

    			div1.innerHTML = `<iframe src="../src/PDF_Tables/tax-table/i1040tt.pdf" title="tax-table" style="
                width: 90%;
                height: 600px;
                position: absolute;
                margin-left: 5%;" class="tax-table-frame"></iframe>`;

    			attr(div0, "class", "close-btn svelte-122bffh");
    			attr(div2, "class", "pdf-table svelte-122bffh");
    			div2.hidden = true;
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, button);
    			append(div2, t1);
    			append(div2, div1);

    			if (!mounted) {
    				dispose = listen(button, "click", /*ClosePopupTaxTable*/ ctx[0]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$a($$self) {
    	const ClosePopupTaxTable = () => {
    		document.getElementsByClassName("tax-app")[0].style.opacity = "1";
    		document.getElementsByClassName("top-nav-container")[0].style.opacity = "1";
    		document.getElementsByClassName("pdf-table")[0].style.display = "none";
    	};

    	return [ClosePopupTaxTable];
    }

    class Pdf_table extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$6.getElementById("svelte-122bffh-style")) add_css$b();
    		init(this, options, instance$a, create_fragment$c, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const current_tax_info = writable([]);
    const projected1_tax_info = writable([]);
    const projected2_tax_info = writable([]);

    /* src\comp\tax-summary\Current.svelte generated by Svelte v3.35.0 */

    const { document: document_1$5 } = globals;

    function add_css$a() {
    	var style = element("style");
    	style.id = "svelte-15uq3sy-style";
    	style.textContent = ".tax-summary-current.svelte-15uq3sy{text-align:center;width:22%;float:left;margin-top:5px}.border-2.svelte-15uq3sy{border:2px solid black;padding:10px;background:gray;opacity:0.9;color:white}@media print{.tax-summary-current.svelte-15uq3sy{text-align:center;width:29%;float:left;margin:1px}}";
    	append(document_1$5.head, style);
    }

    // (203:60) 
    function create_if_block_1$4(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Schedule A Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="schedule-a-deduction">Using Schedule A Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (194:8) {#if !$current_tax_info[0].isScheduleADeduction}
    function create_if_block$4(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Standard Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="standard-deduction">Using Standard Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$b(ctx) {
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let h30;
    	let t3;
    	let p0;
    	let t4;
    	let b0;
    	let span0;
    	let t5_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].grossIncome) + "";
    	let t5;
    	let t6;
    	let h31;
    	let t8;
    	let p1;
    	let t9;
    	let b1;
    	let span1;
    	let t11;
    	let p2;
    	let t12;
    	let b2;
    	let span2;
    	let t13_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].AGITax) + "";
    	let t13;
    	let t14;
    	let p3;
    	let t15;
    	let b3;
    	let span3;
    	let t16_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].sect125) + "";
    	let t16;
    	let t17;
    	let h32;
    	let t19;
    	let p4;
    	let t20;
    	let b4;
    	let span4;
    	let t21_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].TSA) + "";
    	let t21;
    	let t22;
    	let p5;
    	let t23;
    	let b5;
    	let span5;
    	let t24_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].NonTSASavings) + "";
    	let t24;
    	let t25;
    	let p6;
    	let t26;
    	let b6;
    	let span6;
    	let t27_value = /*$current_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "";
    	let t27;
    	let t28;
    	let i;
    	let t30;
    	let t31;
    	let p7;
    	let t32;
    	let b7;
    	let span7;
    	let t34;
    	let p8;
    	let t35;
    	let b8;
    	let span8;
    	let t36_value = /*$current_tax_info*/ ctx[0][0].Age65 + "";
    	let t36;
    	let t37;
    	let p9;
    	let t38;
    	let b9;
    	let span9;
    	let t40;
    	let h33;
    	let t42;
    	let p10;
    	let t43;
    	let b10;
    	let span10;
    	let t44_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].WithHoldingTax) + "";
    	let t44;
    	let t45;
    	let p11;
    	let t46;
    	let b11;
    	let span11;
    	let t48;
    	let p12;
    	let t49;
    	let b12;
    	let span12;
    	let t50_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].MISC) + "";
    	let t50;
    	let t51;
    	let h34;
    	let t53;
    	let p13;
    	let t54;
    	let b13;
    	let span13;
    	let t56;
    	let p14;
    	let t57;
    	let b14;
    	let span14;
    	let t58_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].ProjTaxRefund) + "";
    	let t58;

    	function select_block_type(ctx, dirty) {
    		if (!/*$current_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block$4;
    		if (/*$current_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block_1$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<h2><u>Current Tax Summary</u></h2>`;
    			t1 = space();
    			div1 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Income";
    			t3 = space();
    			p0 = element("p");
    			t4 = text("Gross Income per Year:\r\n            ");
    			b0 = element("b");
    			span0 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Filing Status:\r\n            ");
    			b1 = element("b");
    			span1 = element("span");
    			span1.textContent = `${/*GetFilingStatus*/ ctx[3]()}`;
    			t11 = space();
    			p2 = element("p");
    			t12 = text("Tax Owed:\r\n            ");
    			b2 = element("b");
    			span2 = element("span");
    			t13 = text(t13_value);
    			t14 = space();
    			p3 = element("p");
    			t15 = text("Section 125:\r\n            ");
    			b3 = element("b");
    			span3 = element("span");
    			t16 = text(t16_value);
    			t17 = space();
    			h32 = element("h3");
    			h32.textContent = "Pre-Tax Contributions";
    			t19 = space();
    			p4 = element("p");
    			t20 = text("TSA Contribution:\r\n            ");
    			b4 = element("b");
    			span4 = element("span");
    			t21 = text(t21_value);
    			t22 = space();
    			p5 = element("p");
    			t23 = text("Non-TSA Savings:\r\n            ");
    			b5 = element("b");
    			span5 = element("span");
    			t24 = text(t24_value);
    			t25 = space();
    			p6 = element("p");
    			t26 = text("Contribution:\r\n            ");
    			b6 = element("b");
    			span6 = element("span");
    			t27 = text(t27_value);
    			t28 = text("\r\n                % ");
    			i = element("i");
    			i.textContent = "*rounded";
    			t30 = space();
    			if (if_block) if_block.c();
    			t31 = space();
    			p7 = element("p");
    			t32 = text("Over 65 deduction:\r\n            ");
    			b7 = element("b");
    			span7 = element("span");
    			span7.textContent = `${/*toCurrency*/ ctx[1].format(/*GetOver65Deduction*/ ctx[5]())}`;
    			t34 = space();
    			p8 = element("p");
    			t35 = text("Age 65:\r\n            ");
    			b8 = element("b");
    			span8 = element("span");
    			t36 = text(t36_value);
    			t37 = space();
    			p9 = element("p");
    			t38 = text("Net Taxable:\r\n            ");
    			b9 = element("b");
    			span9 = element("span");
    			span9.textContent = `${/*toCurrency*/ ctx[1].format(/*GetTaxableIncome*/ ctx[2]())}`;
    			t40 = space();
    			h33 = element("h3");
    			h33.textContent = "Withholding Taxes:";
    			t42 = space();
    			p10 = element("p");
    			t43 = text("W/H Tax:\r\n            ");
    			b10 = element("b");
    			span10 = element("span");
    			t44 = text(t44_value);
    			t45 = space();
    			p11 = element("p");
    			t46 = text("FICA:\r\n            ");
    			b11 = element("b");
    			span11 = element("span");
    			span11.textContent = `${/*toCurrency*/ ctx[1].format(/*GetFICA*/ ctx[7]())}`;
    			t48 = space();
    			p12 = element("p");
    			t49 = text("MISC:\r\n            ");
    			b12 = element("b");
    			span12 = element("span");
    			t50 = text(t50_value);
    			t51 = space();
    			h34 = element("h3");
    			h34.textContent = "Summary";
    			t53 = space();
    			p13 = element("p");
    			t54 = text("Net Take-Home Pay:\r\n            ");
    			b13 = element("b");
    			span13 = element("span");
    			span13.textContent = `${/*toCurrency*/ ctx[1].format(/*GetNetTakeHomePay*/ ctx[6]())}`;
    			t56 = space();
    			p14 = element("p");
    			t57 = text("Projected Refund:\r\n            ");
    			b14 = element("b");
    			span14 = element("span");
    			t58 = text(t58_value);
    			attr(div0, "id", "tax-summary-title");
    			attr(span0, "name", "gross-inc");
    			attr(span1, "name", "filling-status");
    			attr(span2, "name", "AGI-tax");
    			attr(span3, "name", "sect-125");
    			attr(span4, "name", "tsa-cont");
    			attr(span5, "name", "non-tsa-savings");
    			attr(span6, "name", "percent-pre-tax");
    			attr(span7, "name", "over65deduction");
    			attr(span8, "name", "Age65");
    			attr(span9, "name", "net-taxible");
    			attr(span10, "name", "withholding-tax");
    			attr(span11, "name", "FICA");
    			attr(span12, "name", "MISC");
    			attr(span13, "name", "net-take-home");
    			attr(span14, "name", "proj-refund");
    			attr(div2, "id", "tax-summary-current");
    			attr(div2, "class", "tax-summary-current border-2 svelte-15uq3sy");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, div1);
    			append(div1, h30);
    			append(div1, t3);
    			append(div1, p0);
    			append(p0, t4);
    			append(p0, b0);
    			append(b0, span0);
    			append(span0, t5);
    			append(div1, t6);
    			append(div1, h31);
    			append(div1, t8);
    			append(div1, p1);
    			append(p1, t9);
    			append(p1, b1);
    			append(b1, span1);
    			append(div1, t11);
    			append(div1, p2);
    			append(p2, t12);
    			append(p2, b2);
    			append(b2, span2);
    			append(span2, t13);
    			append(div1, t14);
    			append(div1, p3);
    			append(p3, t15);
    			append(p3, b3);
    			append(b3, span3);
    			append(span3, t16);
    			append(div1, t17);
    			append(div1, h32);
    			append(div1, t19);
    			append(div1, p4);
    			append(p4, t20);
    			append(p4, b4);
    			append(b4, span4);
    			append(span4, t21);
    			append(div1, t22);
    			append(div1, p5);
    			append(p5, t23);
    			append(p5, b5);
    			append(b5, span5);
    			append(span5, t24);
    			append(div1, t25);
    			append(div1, p6);
    			append(p6, t26);
    			append(p6, b6);
    			append(b6, span6);
    			append(span6, t27);
    			append(b6, t28);
    			append(b6, i);
    			append(div1, t30);
    			if (if_block) if_block.m(div1, null);
    			append(div1, t31);
    			append(div1, p7);
    			append(p7, t32);
    			append(p7, b7);
    			append(b7, span7);
    			append(div1, t34);
    			append(div1, p8);
    			append(p8, t35);
    			append(p8, b8);
    			append(b8, span8);
    			append(span8, t36);
    			append(div1, t37);
    			append(div1, p9);
    			append(p9, t38);
    			append(p9, b9);
    			append(b9, span9);
    			append(div1, t40);
    			append(div1, h33);
    			append(div1, t42);
    			append(div1, p10);
    			append(p10, t43);
    			append(p10, b10);
    			append(b10, span10);
    			append(span10, t44);
    			append(div1, t45);
    			append(div1, p11);
    			append(p11, t46);
    			append(p11, b11);
    			append(b11, span11);
    			append(div1, t48);
    			append(div1, p12);
    			append(p12, t49);
    			append(p12, b12);
    			append(b12, span12);
    			append(span12, t50);
    			append(div1, t51);
    			append(div1, h34);
    			append(div1, t53);
    			append(div1, p13);
    			append(p13, t54);
    			append(p13, b13);
    			append(b13, span13);
    			append(div1, t56);
    			append(div1, p14);
    			append(p14, t57);
    			append(p14, b14);
    			append(b14, span14);
    			append(span14, t58);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$current_tax_info*/ 1 && t5_value !== (t5_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].grossIncome) + "")) set_data(t5, t5_value);
    			if (dirty & /*$current_tax_info*/ 1 && t13_value !== (t13_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].AGITax) + "")) set_data(t13, t13_value);
    			if (dirty & /*$current_tax_info*/ 1 && t16_value !== (t16_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].sect125) + "")) set_data(t16, t16_value);
    			if (dirty & /*$current_tax_info*/ 1 && t21_value !== (t21_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].TSA) + "")) set_data(t21, t21_value);
    			if (dirty & /*$current_tax_info*/ 1 && t24_value !== (t24_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].NonTSASavings) + "")) set_data(t24, t24_value);
    			if (dirty & /*$current_tax_info*/ 1 && t27_value !== (t27_value = /*$current_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "")) set_data(t27, t27_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t31);
    				}
    			}

    			if (dirty & /*$current_tax_info*/ 1 && t36_value !== (t36_value = /*$current_tax_info*/ ctx[0][0].Age65 + "")) set_data(t36, t36_value);
    			if (dirty & /*$current_tax_info*/ 1 && t44_value !== (t44_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].WithHoldingTax) + "")) set_data(t44, t44_value);
    			if (dirty & /*$current_tax_info*/ 1 && t50_value !== (t50_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].MISC) + "")) set_data(t50, t50_value);
    			if (dirty & /*$current_tax_info*/ 1 && t58_value !== (t58_value = /*toCurrency*/ ctx[1].format(/*$current_tax_info*/ ctx[0][0].ProjTaxRefund) + "")) set_data(t58, t58_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $current_tax_info;
    	component_subscribe($$self, current_tax_info, $$value => $$invalidate(0, $current_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	set_store_value(current_tax_info, $current_tax_info[0].PercentPreTax = $current_tax_info[0].TSA / $current_tax_info[0].grossIncome * 100, $current_tax_info);

    	const GetTaxableIncome = () => {
    		set_store_value(current_tax_info, $current_tax_info[0].NetTaxableInc = $current_tax_info[0].grossIncome - $current_tax_info[0].TSA - $current_tax_info[0].sect125 - GetStandardDeduction() - GetOver65Deduction(), $current_tax_info);
    		return $current_tax_info[0].NetTaxableInc;
    	};

    	const GetFilingStatus = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		switch (output) {
    			case "singe":
    				set_store_value(current_tax_info, $current_tax_info[0].FillingStatus = "Single", $current_tax_info);
    				return $current_tax_info[0].FillingStatus;
    			case "married":
    				set_store_value(current_tax_info, $current_tax_info[0].FillingStatus = "Married", $current_tax_info);
    				return $current_tax_info[0].FillingStatus;
    			case "Married_s":
    				set_store_value(current_tax_info, $current_tax_info[0].FillingStatus = "Married filing separately", $current_tax_info);
    				return $current_tax_info[0].FillingStatus;
    			case "headofhousehold":
    				set_store_value(current_tax_info, $current_tax_info[0].FillingStatus = "Head of Household", $current_tax_info);
    				return $current_tax_info[0].FillingStatus;
    			default:
    				set_store_value(current_tax_info, $current_tax_info[0].FillingStatus = "Single", $current_tax_info);
    				return $current_tax_info[0].FillingStatus;
    		}
    	};

    	const GetStandardDeduction = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		if (!$current_tax_info[0].isScheduleADeduction) {
    			switch (output) {
    				case "singe":
    					set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = 12950, $current_tax_info);
    					break;
    				case "married":
    					set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = 25900, $current_tax_info);
    					break;
    				case "Married_s":
    					set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = 12950, $current_tax_info);
    					break;
    				case "headofhousehold":
    					set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = 19400, $current_tax_info);
    					break;
    				default:
    					set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = 12950, $current_tax_info);
    					break;
    			}
    		}

    		console.log({ $current_tax_info });

    		if ($current_tax_info[0].isScheduleADeduction) {
    			set_store_value(current_tax_info, $current_tax_info[0].StandardDeduction = $current_tax_info[0].ScheduleA, $current_tax_info);
    		}

    		return $current_tax_info[0].StandardDeduction;
    	};

    	const GetOver65Deduction = () => {
    		if ($current_tax_info[0].over65dedution) {
    			set_store_value(current_tax_info, $current_tax_info[0].Over65Deduction = 1700, $current_tax_info);
    			return $current_tax_info[0].Over65Deduction;
    		} else return 0;
    	};

    	const GetNetTakeHomePay = () => {
    		set_store_value(current_tax_info, $current_tax_info[0].NetTakeHomePay = $current_tax_info[0].grossIncome - $current_tax_info[0].AGITax - $current_tax_info[0].TSA - $current_tax_info[0].sect125 - $current_tax_info[0].WithHoldingTax - GetFICA() - $current_tax_info[0].MISC - $current_tax_info[0].NonTSASavings, $current_tax_info);
    		return $current_tax_info[0].NetTakeHomePay;
    	};

    	const GetFICA = () => {
    		set_store_value(current_tax_info, $current_tax_info[0].FICA = ($current_tax_info[0].grossIncome - $current_tax_info[0].sect125) * 0.0765, $current_tax_info);
    		return $current_tax_info[0].FICA;
    	};

    	return [
    		$current_tax_info,
    		toCurrency,
    		GetTaxableIncome,
    		GetFilingStatus,
    		GetStandardDeduction,
    		GetOver65Deduction,
    		GetNetTakeHomePay,
    		GetFICA
    	];
    }

    class Current$1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$5.getElementById("svelte-15uq3sy-style")) add_css$a();
    		init(this, options, instance$9, create_fragment$b, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-summary\Projected1.svelte generated by Svelte v3.35.0 */

    const { document: document_1$4 } = globals;

    function add_css$9() {
    	var style = element("style");
    	style.id = "svelte-owcj5-style";
    	style.textContent = ".tax-summary-projected1.svelte-owcj5{text-align:center;width:22%;float:left;margin-top:5px}.border-2.svelte-owcj5{border:2px solid black;padding:10px;background:lightblue;opacity:0.9;color:white}@media print{.tax-summary-projected1.svelte-owcj5{text-align:center;width:29%;float:left;margin:1px}}";
    	append(document_1$4.head, style);
    }

    // (199:63) 
    function create_if_block_1$3(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Schedule A Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="schedule-a-deduction">Using Schedule A Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (190:8) {#if !$projected1_tax_info[0].isScheduleADeduction}
    function create_if_block$3(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Standard Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="standard-deduction">Using Standard Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let h30;
    	let t3;
    	let p0;
    	let t4;
    	let b0;
    	let span0;
    	let t5_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].grossIncome) + "";
    	let t5;
    	let t6;
    	let h31;
    	let t8;
    	let p1;
    	let t9;
    	let b1;
    	let span1;
    	let t11;
    	let p2;
    	let t12;
    	let b2;
    	let span2;
    	let t13_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].AGITax) + "";
    	let t13;
    	let t14;
    	let p3;
    	let t15;
    	let b3;
    	let span3;
    	let t16_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].sect125) + "";
    	let t16;
    	let t17;
    	let h32;
    	let t19;
    	let p4;
    	let t20;
    	let b4;
    	let span4;
    	let t21_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].TSA) + "";
    	let t21;
    	let t22;
    	let p5;
    	let t23;
    	let b5;
    	let span5;
    	let t24_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].NonTSASavings) + "";
    	let t24;
    	let t25;
    	let p6;
    	let t26;
    	let b6;
    	let span6;
    	let t27_value = /*$projected1_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "";
    	let t27;
    	let t28;
    	let i;
    	let t30;
    	let t31;
    	let p7;
    	let t32;
    	let b7;
    	let span7;
    	let t34;
    	let p8;
    	let t35;
    	let b8;
    	let span8;
    	let t37;
    	let h33;
    	let t39;
    	let p9;
    	let t40;
    	let b9;
    	let span9;
    	let t41_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].WithHoldingTax) + "";
    	let t41;
    	let t42;
    	let p10;
    	let t43;
    	let b10;
    	let span10;
    	let t45;
    	let p11;
    	let t46;
    	let b11;
    	let span11;
    	let t47_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].MISC) + "";
    	let t47;
    	let t48;
    	let p12;
    	let t49;
    	let b12;
    	let span12;
    	let t50_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].Age65) + "";
    	let t50;
    	let t51;
    	let h34;
    	let t53;
    	let p13;
    	let t54;
    	let b13;
    	let span13;
    	let t56;
    	let p14;
    	let t57;
    	let b14;
    	let span14;
    	let t58_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].ProjTaxRefund) + "";
    	let t58;

    	function select_block_type(ctx, dirty) {
    		if (!/*$projected1_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block$3;
    		if (/*$projected1_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block_1$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<h2><u>Projected 1 Tax Summary</u></h2>`;
    			t1 = space();
    			div1 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Income";
    			t3 = space();
    			p0 = element("p");
    			t4 = text("Gross Income per Year:\r\n            ");
    			b0 = element("b");
    			span0 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Filing Status:\r\n            ");
    			b1 = element("b");
    			span1 = element("span");
    			span1.textContent = `${/*GetFilingStatus*/ ctx[3]()}`;
    			t11 = space();
    			p2 = element("p");
    			t12 = text("Tax Owed:\r\n            ");
    			b2 = element("b");
    			span2 = element("span");
    			t13 = text(t13_value);
    			t14 = space();
    			p3 = element("p");
    			t15 = text("Section 125:\r\n            ");
    			b3 = element("b");
    			span3 = element("span");
    			t16 = text(t16_value);
    			t17 = space();
    			h32 = element("h3");
    			h32.textContent = "Pre-Tax Contributions";
    			t19 = space();
    			p4 = element("p");
    			t20 = text("TSA Contribution:\r\n            ");
    			b4 = element("b");
    			span4 = element("span");
    			t21 = text(t21_value);
    			t22 = space();
    			p5 = element("p");
    			t23 = text("Non-TSA Savings:\r\n            ");
    			b5 = element("b");
    			span5 = element("span");
    			t24 = text(t24_value);
    			t25 = space();
    			p6 = element("p");
    			t26 = text("Contribution:\r\n            ");
    			b6 = element("b");
    			span6 = element("span");
    			t27 = text(t27_value);
    			t28 = text("\r\n                % ");
    			i = element("i");
    			i.textContent = "*rounded";
    			t30 = space();
    			if (if_block) if_block.c();
    			t31 = space();
    			p7 = element("p");
    			t32 = text("Over 65 deduction:\r\n            ");
    			b7 = element("b");
    			span7 = element("span");
    			span7.textContent = `${/*toCurrency*/ ctx[1].format(/*GetOver65Deduction*/ ctx[5]())}`;
    			t34 = space();
    			p8 = element("p");
    			t35 = text("Net Taxable:\r\n            ");
    			b8 = element("b");
    			span8 = element("span");
    			span8.textContent = `${/*toCurrency*/ ctx[1].format(/*GetTaxableIncome*/ ctx[2]())}`;
    			t37 = space();
    			h33 = element("h3");
    			h33.textContent = "Withholding Taxes:";
    			t39 = space();
    			p9 = element("p");
    			t40 = text("W/H Tax:\r\n            ");
    			b9 = element("b");
    			span9 = element("span");
    			t41 = text(t41_value);
    			t42 = space();
    			p10 = element("p");
    			t43 = text("FICA:\r\n            ");
    			b10 = element("b");
    			span10 = element("span");
    			span10.textContent = `${/*toCurrency*/ ctx[1].format(/*GetFICA*/ ctx[7]())}`;
    			t45 = space();
    			p11 = element("p");
    			t46 = text("MISC:\r\n            ");
    			b11 = element("b");
    			span11 = element("span");
    			t47 = text(t47_value);
    			t48 = space();
    			p12 = element("p");
    			t49 = text("Age 65:\r\n            ");
    			b12 = element("b");
    			span12 = element("span");
    			t50 = text(t50_value);
    			t51 = space();
    			h34 = element("h3");
    			h34.textContent = "Summary";
    			t53 = space();
    			p13 = element("p");
    			t54 = text("Net Take-Home Pay:\r\n            ");
    			b13 = element("b");
    			span13 = element("span");
    			span13.textContent = `${/*toCurrency*/ ctx[1].format(/*GetNetTakeHomePay*/ ctx[6]())}`;
    			t56 = space();
    			p14 = element("p");
    			t57 = text("Projected Refund:\r\n            ");
    			b14 = element("b");
    			span14 = element("span");
    			t58 = text(t58_value);
    			attr(div0, "id", "tax-summary-title");
    			attr(span0, "name", "gross-inc");
    			attr(span1, "name", "filling-status");
    			attr(span2, "name", "AGI-tax");
    			attr(span3, "name", "sect-125");
    			attr(span4, "name", "tsa-cont");
    			attr(span5, "name", "non-tsa-savings");
    			attr(span6, "name", "percent-pre-tax");
    			attr(span7, "name", "over65deduction");
    			attr(span8, "name", "net-taxible");
    			attr(span9, "name", "withholding-tax");
    			attr(span10, "name", "FICA");
    			attr(span11, "name", "MISC");
    			attr(span12, "name", "Age65");
    			attr(span13, "name", "net-take-home");
    			attr(span14, "name", "proj-refund");
    			attr(div1, "id", "tax-summary");
    			attr(div2, "id", "tax-summary-projected1");
    			attr(div2, "class", "tax-summary-projected1 border-2 svelte-owcj5");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, div1);
    			append(div1, h30);
    			append(div1, t3);
    			append(div1, p0);
    			append(p0, t4);
    			append(p0, b0);
    			append(b0, span0);
    			append(span0, t5);
    			append(div1, t6);
    			append(div1, h31);
    			append(div1, t8);
    			append(div1, p1);
    			append(p1, t9);
    			append(p1, b1);
    			append(b1, span1);
    			append(div1, t11);
    			append(div1, p2);
    			append(p2, t12);
    			append(p2, b2);
    			append(b2, span2);
    			append(span2, t13);
    			append(div1, t14);
    			append(div1, p3);
    			append(p3, t15);
    			append(p3, b3);
    			append(b3, span3);
    			append(span3, t16);
    			append(div1, t17);
    			append(div1, h32);
    			append(div1, t19);
    			append(div1, p4);
    			append(p4, t20);
    			append(p4, b4);
    			append(b4, span4);
    			append(span4, t21);
    			append(div1, t22);
    			append(div1, p5);
    			append(p5, t23);
    			append(p5, b5);
    			append(b5, span5);
    			append(span5, t24);
    			append(div1, t25);
    			append(div1, p6);
    			append(p6, t26);
    			append(p6, b6);
    			append(b6, span6);
    			append(span6, t27);
    			append(b6, t28);
    			append(b6, i);
    			append(div1, t30);
    			if (if_block) if_block.m(div1, null);
    			append(div1, t31);
    			append(div1, p7);
    			append(p7, t32);
    			append(p7, b7);
    			append(b7, span7);
    			append(div1, t34);
    			append(div1, p8);
    			append(p8, t35);
    			append(p8, b8);
    			append(b8, span8);
    			append(div1, t37);
    			append(div1, h33);
    			append(div1, t39);
    			append(div1, p9);
    			append(p9, t40);
    			append(p9, b9);
    			append(b9, span9);
    			append(span9, t41);
    			append(div1, t42);
    			append(div1, p10);
    			append(p10, t43);
    			append(p10, b10);
    			append(b10, span10);
    			append(div1, t45);
    			append(div1, p11);
    			append(p11, t46);
    			append(p11, b11);
    			append(b11, span11);
    			append(span11, t47);
    			append(div1, t48);
    			append(div1, p12);
    			append(p12, t49);
    			append(p12, b12);
    			append(b12, span12);
    			append(span12, t50);
    			append(div1, t51);
    			append(div1, h34);
    			append(div1, t53);
    			append(div1, p13);
    			append(p13, t54);
    			append(p13, b13);
    			append(b13, span13);
    			append(div1, t56);
    			append(div1, p14);
    			append(p14, t57);
    			append(p14, b14);
    			append(b14, span14);
    			append(span14, t58);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$projected1_tax_info*/ 1 && t5_value !== (t5_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].grossIncome) + "")) set_data(t5, t5_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t13_value !== (t13_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].AGITax) + "")) set_data(t13, t13_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t16_value !== (t16_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].sect125) + "")) set_data(t16, t16_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t21_value !== (t21_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].TSA) + "")) set_data(t21, t21_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t24_value !== (t24_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].NonTSASavings) + "")) set_data(t24, t24_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t27_value !== (t27_value = /*$projected1_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "")) set_data(t27, t27_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t31);
    				}
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && t41_value !== (t41_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].WithHoldingTax) + "")) set_data(t41, t41_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t47_value !== (t47_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].MISC) + "")) set_data(t47, t47_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t50_value !== (t50_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].Age65) + "")) set_data(t50, t50_value);
    			if (dirty & /*$projected1_tax_info*/ 1 && t58_value !== (t58_value = /*toCurrency*/ ctx[1].format(/*$projected1_tax_info*/ ctx[0][0].ProjTaxRefund) + "")) set_data(t58, t58_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let $projected1_tax_info;
    	component_subscribe($$self, projected1_tax_info, $$value => $$invalidate(0, $projected1_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	set_store_value(projected1_tax_info, $projected1_tax_info[0].PercentPreTax = $projected1_tax_info[0].TSA / $projected1_tax_info[0].grossIncome * 100, $projected1_tax_info);

    	const GetTaxableIncome = () => {
    		set_store_value(projected1_tax_info, $projected1_tax_info[0].NetTaxableInc = $projected1_tax_info[0].grossIncome - $projected1_tax_info[0].TSA - $projected1_tax_info[0].sect125 - GetStandardDeduction() - GetOver65Deduction(), $projected1_tax_info);
    		return $projected1_tax_info[0].NetTaxableInc;
    	};

    	const GetFilingStatus = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		switch (output) {
    			case "singe":
    				set_store_value(projected1_tax_info, $projected1_tax_info[0].FillingStatus = "Single", $projected1_tax_info);
    				return $projected1_tax_info[0].FillingStatus;
    			case "married":
    				set_store_value(projected1_tax_info, $projected1_tax_info[0].FillingStatus = "Married", $projected1_tax_info);
    				return $projected1_tax_info[0].FillingStatus;
    			case "Married_s":
    				set_store_value(projected1_tax_info, $projected1_tax_info[0].FillingStatus = "Married filing separately", $projected1_tax_info);
    				return $projected1_tax_info[0].FillingStatus;
    			case "headofhousehold":
    				set_store_value(projected1_tax_info, $projected1_tax_info[0].FillingStatus = "Head of Household", $projected1_tax_info);
    				return $projected1_tax_info[0].FillingStatus;
    			default:
    				set_store_value(projected1_tax_info, $projected1_tax_info[0].FillingStatus = "Single", $projected1_tax_info);
    				return $projected1_tax_info[0].FillingStatus;
    		}
    	};

    	const GetStandardDeduction = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		if (!$projected1_tax_info[0].isScheduleADeduction) {
    			switch (output) {
    				case "singe":
    					set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = 12950, $projected1_tax_info);
    					break;
    				case "married":
    					set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = 25900, $projected1_tax_info);
    					break;
    				case "Married_s":
    					set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = 12950, $projected1_tax_info);
    					break;
    				case "headofhousehold":
    					set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = 19400, $projected1_tax_info);
    					break;
    				default:
    					set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = 12950, $projected1_tax_info);
    					break;
    			}
    		}

    		if ($projected1_tax_info[0].isScheduleADeduction) {
    			set_store_value(projected1_tax_info, $projected1_tax_info[0].StandardDeduction = $projected1_tax_info[0].scheduleADeduction, $projected1_tax_info);
    		}

    		return $projected1_tax_info[0].StandardDeduction;
    	};

    	const GetOver65Deduction = () => {
    		if ($projected1_tax_info[0].over65dedution) {
    			set_store_value(projected1_tax_info, $projected1_tax_info[0].Over65Deduction = 1700, $projected1_tax_info);
    			return $projected1_tax_info[0].Over65Deduction;
    		} else return 0;
    	};

    	const GetNetTakeHomePay = () => {
    		set_store_value(projected1_tax_info, $projected1_tax_info[0].NetTakeHomePay = $projected1_tax_info[0].grossIncome - $projected1_tax_info[0].AGITax - $projected1_tax_info[0].TSA - $projected1_tax_info[0].sect125 - $projected1_tax_info[0].WithHoldingTax - GetFICA() - $projected1_tax_info[0].MISC - $projected1_tax_info[0].NonTSASavings, $projected1_tax_info);
    		return $projected1_tax_info[0].NetTakeHomePay;
    	};

    	const GetFICA = () => {
    		set_store_value(projected1_tax_info, $projected1_tax_info[0].FICA = ($projected1_tax_info[0].grossIncome - $projected1_tax_info[0].sect125) * 0.0765, $projected1_tax_info);
    		return $projected1_tax_info[0].FICA;
    	};

    	return [
    		$projected1_tax_info,
    		toCurrency,
    		GetTaxableIncome,
    		GetFilingStatus,
    		GetStandardDeduction,
    		GetOver65Deduction,
    		GetNetTakeHomePay,
    		GetFICA
    	];
    }

    class Projected1$1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$4.getElementById("svelte-owcj5-style")) add_css$9();
    		init(this, options, instance$8, create_fragment$a, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-summary\Projected2.svelte generated by Svelte v3.35.0 */

    const { document: document_1$3 } = globals;

    function add_css$8() {
    	var style = element("style");
    	style.id = "svelte-1jfx4xa-style";
    	style.textContent = ".tax-summary-projected2.svelte-1jfx4xa{text-align:center;width:22%;float:left;margin-top:5px}.border-2.svelte-1jfx4xa{border:2px solid black;padding:10px;background:lightcoral;opacity:0.9;color:white}@media print{.tax-summary-projected2.svelte-1jfx4xa{text-align:center;width:29%;float:left;margin:1px}}";
    	append(document_1$3.head, style);
    }

    // (200:63) 
    function create_if_block_1$2(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Schedule A Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="schedule-a-deduction">Using Schedule A Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (191:8) {#if !$projected2_tax_info[0].isScheduleADeduction}
    function create_if_block$2(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[1].format(/*GetStandardDeduction*/ ctx[4]()) + "";
    	let t1;
    	let t2;
    	let b;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Standard Deduction: ");
    			t1 = text(t1_value);
    			t2 = space();
    			b = element("b");
    			b.innerHTML = `<div name="standard-deduction">Using Standard Deduction</div>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			append(p, b);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let h30;
    	let t3;
    	let p0;
    	let t4;
    	let b0;
    	let span0;
    	let t5_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].grossIncome) + "";
    	let t5;
    	let t6;
    	let h31;
    	let t8;
    	let p1;
    	let t9;
    	let b1;
    	let span1;
    	let t11;
    	let p2;
    	let t12;
    	let b2;
    	let span2;
    	let t13_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].AGITax) + "";
    	let t13;
    	let t14;
    	let p3;
    	let t15;
    	let b3;
    	let span3;
    	let t16_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].sect125) + "";
    	let t16;
    	let t17;
    	let h32;
    	let t19;
    	let p4;
    	let t20;
    	let b4;
    	let span4;
    	let t21_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].TSA) + "";
    	let t21;
    	let t22;
    	let p5;
    	let t23;
    	let b5;
    	let span5;
    	let t24_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].NonTSASavings) + "";
    	let t24;
    	let t25;
    	let p6;
    	let t26;
    	let b6;
    	let span6;
    	let t27_value = /*$projected2_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "";
    	let t27;
    	let t28;
    	let i;
    	let t30;
    	let t31;
    	let p7;
    	let t32;
    	let b7;
    	let span7;
    	let t34;
    	let p8;
    	let t35;
    	let b8;
    	let span8;
    	let t37;
    	let h33;
    	let t39;
    	let p9;
    	let t40;
    	let b9;
    	let span9;
    	let t41_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].WithHoldingTax) + "";
    	let t41;
    	let t42;
    	let p10;
    	let t43;
    	let b10;
    	let span10;
    	let t45;
    	let p11;
    	let t46;
    	let b11;
    	let span11;
    	let t47_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].MISC) + "";
    	let t47;
    	let t48;
    	let p12;
    	let t49;
    	let b12;
    	let span12;
    	let t50_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].Age65) + "";
    	let t50;
    	let t51;
    	let h34;
    	let t53;
    	let p13;
    	let t54;
    	let b13;
    	let span13;
    	let t56;
    	let p14;
    	let t57;
    	let b14;
    	let span14;
    	let t58_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].ProjTaxRefund) + "";
    	let t58;

    	function select_block_type(ctx, dirty) {
    		if (!/*$projected2_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block$2;
    		if (/*$projected2_tax_info*/ ctx[0][0].isScheduleADeduction) return create_if_block_1$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<h2><u>Projected 2 Tax Summary</u></h2>`;
    			t1 = space();
    			div1 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Income";
    			t3 = space();
    			p0 = element("p");
    			t4 = text("Gross Income per Year:\r\n            ");
    			b0 = element("b");
    			span0 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Filing Status:\r\n            ");
    			b1 = element("b");
    			span1 = element("span");
    			span1.textContent = `${/*GetFilingStatus*/ ctx[3]()}`;
    			t11 = space();
    			p2 = element("p");
    			t12 = text("Tax Owed:\r\n            ");
    			b2 = element("b");
    			span2 = element("span");
    			t13 = text(t13_value);
    			t14 = space();
    			p3 = element("p");
    			t15 = text("Section 125:\r\n            ");
    			b3 = element("b");
    			span3 = element("span");
    			t16 = text(t16_value);
    			t17 = space();
    			h32 = element("h3");
    			h32.textContent = "Pre-Tax Contributions";
    			t19 = space();
    			p4 = element("p");
    			t20 = text("TSA Contribution:\r\n            ");
    			b4 = element("b");
    			span4 = element("span");
    			t21 = text(t21_value);
    			t22 = space();
    			p5 = element("p");
    			t23 = text("Non-TSA Savings:\r\n            ");
    			b5 = element("b");
    			span5 = element("span");
    			t24 = text(t24_value);
    			t25 = space();
    			p6 = element("p");
    			t26 = text("Contribution:\r\n            ");
    			b6 = element("b");
    			span6 = element("span");
    			t27 = text(t27_value);
    			t28 = text("\r\n                % ");
    			i = element("i");
    			i.textContent = "*rounded";
    			t30 = space();
    			if (if_block) if_block.c();
    			t31 = space();
    			p7 = element("p");
    			t32 = text("Over 65 deduction:\r\n            ");
    			b7 = element("b");
    			span7 = element("span");
    			span7.textContent = `${/*toCurrency*/ ctx[1].format(/*GetOver65Deduction*/ ctx[5]())}`;
    			t34 = space();
    			p8 = element("p");
    			t35 = text("Net Taxable:\r\n            ");
    			b8 = element("b");
    			span8 = element("span");
    			span8.textContent = `${/*toCurrency*/ ctx[1].format(/*GetTaxableIncome*/ ctx[2]())}`;
    			t37 = space();
    			h33 = element("h3");
    			h33.textContent = "Withholding Taxes:";
    			t39 = space();
    			p9 = element("p");
    			t40 = text("W/H Tax:\r\n            ");
    			b9 = element("b");
    			span9 = element("span");
    			t41 = text(t41_value);
    			t42 = space();
    			p10 = element("p");
    			t43 = text("FICA:\r\n            ");
    			b10 = element("b");
    			span10 = element("span");
    			span10.textContent = `${/*toCurrency*/ ctx[1].format(/*GetFICA*/ ctx[7]())}`;
    			t45 = space();
    			p11 = element("p");
    			t46 = text("MISC:\r\n            ");
    			b11 = element("b");
    			span11 = element("span");
    			t47 = text(t47_value);
    			t48 = space();
    			p12 = element("p");
    			t49 = text("Age 65:\r\n            ");
    			b12 = element("b");
    			span12 = element("span");
    			t50 = text(t50_value);
    			t51 = space();
    			h34 = element("h3");
    			h34.textContent = "Summary";
    			t53 = space();
    			p13 = element("p");
    			t54 = text("Net Take-Home Pay:\r\n            ");
    			b13 = element("b");
    			span13 = element("span");
    			span13.textContent = `${/*toCurrency*/ ctx[1].format(/*GetNetTakeHomePay*/ ctx[6]())}`;
    			t56 = space();
    			p14 = element("p");
    			t57 = text("Projected Refund:\r\n            ");
    			b14 = element("b");
    			span14 = element("span");
    			t58 = text(t58_value);
    			attr(div0, "id", "tax-summary-title");
    			attr(span0, "name", "gross-inc");
    			attr(span1, "name", "filling-status");
    			attr(span2, "name", "AGI-tax");
    			attr(span3, "name", "sect-125");
    			attr(span4, "name", "tsa-cont");
    			attr(span5, "name", "non-tsa-savings");
    			attr(span6, "name", "percent-pre-tax");
    			attr(span7, "name", "over65deduction");
    			attr(span8, "name", "net-taxible");
    			attr(span9, "name", "withholding-tax");
    			attr(span10, "name", "FICA");
    			attr(span11, "name", "MISC");
    			attr(span12, "name", "Age65");
    			attr(span13, "name", "net-take-home");
    			attr(span14, "name", "proj-refund");
    			attr(div1, "id", "tax-summary");
    			attr(div2, "id", "tax-summary-projected2");
    			attr(div2, "class", "tax-summary-projected2 border-2 svelte-1jfx4xa");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, div1);
    			append(div1, h30);
    			append(div1, t3);
    			append(div1, p0);
    			append(p0, t4);
    			append(p0, b0);
    			append(b0, span0);
    			append(span0, t5);
    			append(div1, t6);
    			append(div1, h31);
    			append(div1, t8);
    			append(div1, p1);
    			append(p1, t9);
    			append(p1, b1);
    			append(b1, span1);
    			append(div1, t11);
    			append(div1, p2);
    			append(p2, t12);
    			append(p2, b2);
    			append(b2, span2);
    			append(span2, t13);
    			append(div1, t14);
    			append(div1, p3);
    			append(p3, t15);
    			append(p3, b3);
    			append(b3, span3);
    			append(span3, t16);
    			append(div1, t17);
    			append(div1, h32);
    			append(div1, t19);
    			append(div1, p4);
    			append(p4, t20);
    			append(p4, b4);
    			append(b4, span4);
    			append(span4, t21);
    			append(div1, t22);
    			append(div1, p5);
    			append(p5, t23);
    			append(p5, b5);
    			append(b5, span5);
    			append(span5, t24);
    			append(div1, t25);
    			append(div1, p6);
    			append(p6, t26);
    			append(p6, b6);
    			append(b6, span6);
    			append(span6, t27);
    			append(b6, t28);
    			append(b6, i);
    			append(div1, t30);
    			if (if_block) if_block.m(div1, null);
    			append(div1, t31);
    			append(div1, p7);
    			append(p7, t32);
    			append(p7, b7);
    			append(b7, span7);
    			append(div1, t34);
    			append(div1, p8);
    			append(p8, t35);
    			append(p8, b8);
    			append(b8, span8);
    			append(div1, t37);
    			append(div1, h33);
    			append(div1, t39);
    			append(div1, p9);
    			append(p9, t40);
    			append(p9, b9);
    			append(b9, span9);
    			append(span9, t41);
    			append(div1, t42);
    			append(div1, p10);
    			append(p10, t43);
    			append(p10, b10);
    			append(b10, span10);
    			append(div1, t45);
    			append(div1, p11);
    			append(p11, t46);
    			append(p11, b11);
    			append(b11, span11);
    			append(span11, t47);
    			append(div1, t48);
    			append(div1, p12);
    			append(p12, t49);
    			append(p12, b12);
    			append(b12, span12);
    			append(span12, t50);
    			append(div1, t51);
    			append(div1, h34);
    			append(div1, t53);
    			append(div1, p13);
    			append(p13, t54);
    			append(p13, b13);
    			append(b13, span13);
    			append(div1, t56);
    			append(div1, p14);
    			append(p14, t57);
    			append(p14, b14);
    			append(b14, span14);
    			append(span14, t58);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$projected2_tax_info*/ 1 && t5_value !== (t5_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].grossIncome) + "")) set_data(t5, t5_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t13_value !== (t13_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].AGITax) + "")) set_data(t13, t13_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t16_value !== (t16_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].sect125) + "")) set_data(t16, t16_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t21_value !== (t21_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].TSA) + "")) set_data(t21, t21_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t24_value !== (t24_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].NonTSASavings) + "")) set_data(t24, t24_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t27_value !== (t27_value = /*$projected2_tax_info*/ ctx[0][0].PercentPreTax.toFixed(2) + "")) set_data(t27, t27_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t31);
    				}
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && t41_value !== (t41_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].WithHoldingTax) + "")) set_data(t41, t41_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t47_value !== (t47_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].MISC) + "")) set_data(t47, t47_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t50_value !== (t50_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].Age65) + "")) set_data(t50, t50_value);
    			if (dirty & /*$projected2_tax_info*/ 1 && t58_value !== (t58_value = /*toCurrency*/ ctx[1].format(/*$projected2_tax_info*/ ctx[0][0].ProjTaxRefund) + "")) set_data(t58, t58_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let $projected2_tax_info;
    	component_subscribe($$self, projected2_tax_info, $$value => $$invalidate(0, $projected2_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	set_store_value(projected2_tax_info, $projected2_tax_info[0].PercentPreTax = $projected2_tax_info[0].TSA / $projected2_tax_info[0].grossIncome * 100, $projected2_tax_info);

    	const GetTaxableIncome = () => {
    		set_store_value(projected2_tax_info, $projected2_tax_info[0].NetTaxableInc = $projected2_tax_info[0].grossIncome - $projected2_tax_info[0].TSA - $projected2_tax_info[0].sect125 - GetStandardDeduction() - GetOver65Deduction(), $projected2_tax_info);
    		return $projected2_tax_info[0].NetTaxableInc;
    	};

    	const GetFilingStatus = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		switch (output) {
    			case "singe":
    				set_store_value(projected2_tax_info, $projected2_tax_info[0].FillingStatus = "Single", $projected2_tax_info);
    				return $projected2_tax_info[0].FillingStatus;
    			case "married":
    				set_store_value(projected2_tax_info, $projected2_tax_info[0].FillingStatus = "Married", $projected2_tax_info);
    				return $projected2_tax_info[0].FillingStatus;
    			case "Married_s":
    				set_store_value(projected2_tax_info, $projected2_tax_info[0].FillingStatus = "Married filing separately", $projected2_tax_info);
    				return $projected2_tax_info[0].FillingStatus;
    			case "headofhousehold":
    				set_store_value(projected2_tax_info, $projected2_tax_info[0].FillingStatus = "Head of Household", $projected2_tax_info);
    				return $projected2_tax_info[0].FillingStatus;
    			default:
    				set_store_value(projected2_tax_info, $projected2_tax_info[0].FillingStatus = "Single", $projected2_tax_info);
    				return $projected2_tax_info[0].FillingStatus;
    		}
    	};

    	const GetStandardDeduction = () => {
    		let selectElement = document.querySelector("#filing-status");
    		let output = selectElement.options[selectElement.selectedIndex].value;

    		if (!$projected2_tax_info[0].isScheduleADeduction) {
    			switch (output) {
    				case "singe":
    					set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = 12950, $projected2_tax_info);
    					break;
    				case "married":
    					set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = 25900, $projected2_tax_info);
    					break;
    				case "Married_s":
    					set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = 12950, $projected2_tax_info);
    					break;
    				case "headofhousehold":
    					set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = 19400, $projected2_tax_info);
    					break;
    				default:
    					set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = 12950, $projected2_tax_info);
    					break;
    			}
    		}

    		if ($projected2_tax_info[0].isScheduleADeduction) {
    			set_store_value(projected2_tax_info, $projected2_tax_info[0].StandardDeduction = $projected2_tax_info[0].scheduleADeduction, $projected2_tax_info);
    		}

    		return $projected2_tax_info[0].StandardDeduction;
    	};

    	const GetOver65Deduction = () => {
    		if ($projected2_tax_info[0].over65dedution) {
    			set_store_value(projected2_tax_info, $projected2_tax_info[0].Over65Deduction = 1700, $projected2_tax_info);
    			return $projected2_tax_info[0].Over65Deduction;
    		} else return 0;
    	};

    	const GetNetTakeHomePay = () => {
    		set_store_value(projected2_tax_info, $projected2_tax_info[0].NetTakeHomePay = $projected2_tax_info[0].grossIncome - $projected2_tax_info[0].AGITax - $projected2_tax_info[0].TSA - $projected2_tax_info[0].sect125 - $projected2_tax_info[0].WithHoldingTax - GetFICA() - $projected2_tax_info[0].MISC - $projected2_tax_info[0].NonTSASavings, $projected2_tax_info);
    		return $projected2_tax_info[0].NetTakeHomePay;
    	};

    	const GetFICA = () => {
    		set_store_value(projected2_tax_info, $projected2_tax_info[0].FICA = ($projected2_tax_info[0].grossIncome - $projected2_tax_info[0].sect125) * 0.0765, $projected2_tax_info);
    		return $projected2_tax_info[0].FICA;
    	};

    	return [
    		$projected2_tax_info,
    		toCurrency,
    		GetTaxableIncome,
    		GetFilingStatus,
    		GetStandardDeduction,
    		GetOver65Deduction,
    		GetNetTakeHomePay,
    		GetFICA
    	];
    }

    class Projected2$1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$3.getElementById("svelte-1jfx4xa-style")) add_css$8();
    		init(this, options, instance$7, create_fragment$9, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-summary.svelte generated by Svelte v3.35.0 */

    function create_if_block_2$1(ctx) {
    	let proj2;
    	let current;
    	proj2 = new Projected2$1({ props: { projected2_tax_info } });

    	return {
    		c() {
    			create_component(proj2.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(proj2, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(proj2.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(proj2.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(proj2, detaching);
    		}
    	};
    }

    // (17:49) 
    function create_if_block_1$1(ctx) {
    	let proj1;
    	let current;
    	proj1 = new Projected1$1({ props: { projected1_tax_info } });

    	return {
    		c() {
    			create_component(proj1.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(proj1, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(proj1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(proj1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(proj1, detaching);
    		}
    	};
    }

    // (15:4) {#if selectedVariation == "Current"}
    function create_if_block$1(ctx) {
    	let current;
    	let current$1;
    	current = new Current$1({ props: { current_tax_info } });

    	return {
    		c() {
    			create_component(current.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(current, target, anchor);
    			current$1 = true;
    		},
    		p: noop,
    		i(local) {
    			if (current$1) return;
    			transition_in(current.$$.fragment, local);
    			current$1 = true;
    		},
    		o(local) {
    			transition_out(current.$$.fragment, local);
    			current$1 = false;
    		},
    		d(detaching) {
    			destroy_component(current, detaching);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_1$1, create_if_block_2$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*selectedVariation*/ ctx[0] == "Current") return 0;
    		if (/*selectedVariation*/ ctx[0] == "Projected 1") return 1;
    		if (/*selectedVariation*/ ctx[0] == "Projected 2") return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr(div, "class", "tax-summary");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { selectedVariation } = $$props;

    	$$self.$$set = $$props => {
    		if ("selectedVariation" in $$props) $$invalidate(0, selectedVariation = $$props.selectedVariation);
    	};

    	return [selectedVariation];
    }

    class Tax_summary extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$8, safe_not_equal, { selectedVariation: 0 });
    	}
    }

    /* src\comp\tax-form\Current.svelte generated by Svelte v3.35.0 */

    const { document: document_1$2 } = globals;

    function add_css$7() {
    	var style = element("style");
    	style.id = "svelte-18meaip-style";
    	style.textContent = ".current-tax-form.svelte-18meaip{width:25%;text-align:center;float:left;padding:5px}.border-2.svelte-18meaip{border:2px solid black;padding:10px;background:gray;opacity:0.9;color:white}.calculate-agi.svelte-18meaip{width:100%;padding:5px}#filing-status.svelte-18meaip{width:100%;padding:5px;margin-bottom:10px;text-align:center}";
    	append(document_1$2.head, style);
    }

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	child_ctx[19] = list;
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (60:4) {#each $current_tax_info as current_tax_info}
    function create_each_block$3(ctx) {
    	let div12;
    	let h2;
    	let t1;
    	let div4;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let h30;
    	let t6;
    	let div0;
    	let label1;
    	let t8;
    	let input1;
    	let t9;
    	let div1;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div2;
    	let label3;
    	let t14;
    	let input3;
    	let t15;
    	let div3;
    	let br;
    	let t16;
    	let button;
    	let t18;
    	let p;
    	let t19;
    	let b;
    	let span;
    	let input4;
    	let t20;
    	let h31;
    	let t22;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t27;
    	let div5;
    	let t28;
    	let input5;
    	let t29;
    	let input6;
    	let t30;
    	let div6;
    	let label4;
    	let t32;
    	let input7;
    	let t33;
    	let div7;
    	let t34;
    	let input8;
    	let t35;
    	let div8;
    	let t36;
    	let input9;
    	let t37;
    	let h32;
    	let t39;
    	let div9;
    	let label5;
    	let t41;
    	let input10;
    	let t42;
    	let div10;
    	let label6;
    	let t44;
    	let input11;
    	let t45;
    	let div11;
    	let label7;
    	let t47;
    	let input12;
    	let mounted;
    	let dispose;

    	function input0_input_handler() {
    		/*input0_input_handler*/ ctx[3].call(input0, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input1_input_handler() {
    		/*input1_input_handler*/ ctx[4].call(input1, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input2_input_handler() {
    		/*input2_input_handler*/ ctx[5].call(input2, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input3_input_handler() {
    		/*input3_input_handler*/ ctx[6].call(input3, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input4_input_handler() {
    		/*input4_input_handler*/ ctx[7].call(input4, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input5_change_handler() {
    		/*input5_change_handler*/ ctx[8].call(input5, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input6_input_handler() {
    		/*input6_input_handler*/ ctx[9].call(input6, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input7_input_handler() {
    		/*input7_input_handler*/ ctx[10].call(input7, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input8_change_handler() {
    		/*input8_change_handler*/ ctx[11].call(input8, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input9_input_handler() {
    		/*input9_input_handler*/ ctx[12].call(input9, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input10_input_handler() {
    		/*input10_input_handler*/ ctx[13].call(input10, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input11_input_handler() {
    		/*input11_input_handler*/ ctx[14].call(input11, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	function input12_input_handler() {
    		/*input12_input_handler*/ ctx[15].call(input12, /*each_value*/ ctx[19], /*current_tax_info_index*/ ctx[20]);
    	}

    	return {
    		c() {
    			div12 = element("div");
    			h2 = element("h2");
    			h2.innerHTML = `<u>Current Tax Information</u>`;
    			t1 = space();
    			div4 = element("div");
    			label0 = element("label");
    			label0.textContent = "Gross Income /yr:";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			h30 = element("h3");
    			h30.textContent = "Pre-Tax Contributions";
    			t6 = space();
    			div0 = element("div");
    			label1 = element("label");
    			label1.textContent = "Sect 125:";
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			div1 = element("div");
    			label2 = element("label");
    			label2.textContent = "TSA:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div2 = element("div");
    			label3 = element("label");
    			label3.textContent = "Non TSA:";
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			div3 = element("div");
    			br = element("br");
    			t16 = space();
    			button = element("button");
    			button.textContent = "Calculate AGI";
    			t18 = space();
    			p = element("p");
    			t19 = text("Current AGI:\r\n                    ");
    			b = element("b");
    			span = element("span");
    			input4 = element("input");
    			t20 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t22 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Single";
    			option1 = element("option");
    			option1.textContent = "Married";
    			option2 = element("option");
    			option2.textContent = "Married filing separatly";
    			option3 = element("option");
    			option3.textContent = "Head of Houshold";
    			t27 = space();
    			div5 = element("div");
    			t28 = text("Use Schedule A\r\n                ");
    			input5 = element("input");
    			t29 = space();
    			input6 = element("input");
    			t30 = space();
    			div6 = element("div");
    			label4 = element("label");
    			label4.textContent = "Search Tax Owed:";
    			t32 = space();
    			input7 = element("input");
    			t33 = space();
    			div7 = element("div");
    			t34 = text("65+ years old\r\n                ");
    			input8 = element("input");
    			t35 = space();
    			div8 = element("div");
    			t36 = text("Age 65:\r\n                ");
    			input9 = element("input");
    			t37 = space();
    			h32 = element("h3");
    			h32.textContent = "Witholding Taxes";
    			t39 = space();
    			div9 = element("div");
    			label5 = element("label");
    			label5.textContent = "W/H Tax:";
    			t41 = space();
    			input10 = element("input");
    			t42 = space();
    			div10 = element("div");
    			label6 = element("label");
    			label6.textContent = "MISC:";
    			t44 = space();
    			input11 = element("input");
    			t45 = space();
    			div11 = element("div");
    			label7 = element("label");
    			label7.textContent = "Proj Tax Refund:";
    			t47 = space();
    			input12 = element("input");
    			attr(label0, "for", "GrossInc");
    			attr(input0, "type", "number");
    			attr(label1, "for", "Sect125");
    			attr(input1, "type", "number");
    			attr(label2, "for", "TSA");
    			attr(input2, "type", "number");
    			attr(label3, "for", "NonTSA");
    			attr(input3, "type", "number");
    			attr(button, "class", "calculate-agi svelte-18meaip");
    			attr(input4, "type", "text");
    			attr(input4, "class", "AGI");
    			input4.disabled = true;
    			option0.__value = "single";
    			option0.value = option0.__value;
    			option1.__value = "married";
    			option1.value = option1.__value;
    			option2.__value = "Married_s";
    			option2.value = option2.__value;
    			option3.__value = "headofhousehold";
    			option3.value = option3.__value;
    			attr(select, "name", "filing-status");
    			attr(select, "id", "filing-status");
    			attr(select, "class", "svelte-18meaip");
    			attr(input5, "class", "isScheduleA");
    			attr(input5, "type", "checkbox");
    			attr(input6, "type", "number");
    			attr(label4, "for", "AGI-tax");
    			attr(input7, "type", "number");
    			attr(input8, "class", "is65orover");
    			attr(input8, "type", "checkbox");
    			attr(input9, "type", "number");
    			attr(label5, "for", "witholding");
    			attr(input10, "type", "number");
    			attr(label6, "for", "Misc");
    			attr(input11, "type", "number");
    			attr(label7, "for", "CurrentTaxRefund");
    			attr(input12, "type", "number");
    			attr(input12, "class", "CurrentTaxRefund");
    			input12.disabled = true;
    			attr(div12, "class", "border-2 svelte-18meaip");
    		},
    		m(target, anchor) {
    			insert(target, div12, anchor);
    			append(div12, h2);
    			append(div12, t1);
    			append(div12, div4);
    			append(div4, label0);
    			append(div4, t3);
    			append(div4, input0);
    			set_input_value(input0, /*current_tax_info*/ ctx[18].grossIncome);
    			append(div4, t4);
    			append(div4, h30);
    			append(div4, t6);
    			append(div4, div0);
    			append(div0, label1);
    			append(div0, t8);
    			append(div0, input1);
    			set_input_value(input1, /*current_tax_info*/ ctx[18].sect125);
    			append(div4, t9);
    			append(div4, div1);
    			append(div1, label2);
    			append(div1, t11);
    			append(div1, input2);
    			set_input_value(input2, /*current_tax_info*/ ctx[18].TSA);
    			append(div4, t12);
    			append(div4, div2);
    			append(div2, label3);
    			append(div2, t14);
    			append(div2, input3);
    			set_input_value(input3, /*current_tax_info*/ ctx[18].NonTSASavings);
    			append(div4, t15);
    			append(div4, div3);
    			append(div3, br);
    			append(div3, t16);
    			append(div3, button);
    			append(div4, t18);
    			append(div4, p);
    			append(p, t19);
    			append(p, b);
    			append(b, span);
    			append(span, input4);
    			set_input_value(input4, /*current_tax_info*/ ctx[18].AGI);
    			append(div12, t20);
    			append(div12, h31);
    			append(div12, t22);
    			append(div12, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(div12, t27);
    			append(div12, div5);
    			append(div5, t28);
    			append(div5, input5);
    			input5.checked = /*current_tax_info*/ ctx[18].isScheduleADeduction;
    			append(div5, t29);
    			append(div5, input6);
    			set_input_value(input6, /*current_tax_info*/ ctx[18].ScheduleA);
    			append(div12, t30);
    			append(div12, div6);
    			append(div6, label4);
    			append(div6, t32);
    			append(div6, input7);
    			set_input_value(input7, /*current_tax_info*/ ctx[18].AGITax);
    			append(div12, t33);
    			append(div12, div7);
    			append(div7, t34);
    			append(div7, input8);
    			input8.checked = /*current_tax_info*/ ctx[18].over65dedution;
    			append(div12, t35);
    			append(div12, div8);
    			append(div8, t36);
    			append(div8, input9);
    			set_input_value(input9, /*current_tax_info*/ ctx[18].Age65);
    			append(div12, t37);
    			append(div12, h32);
    			append(div12, t39);
    			append(div12, div9);
    			append(div9, label5);
    			append(div9, t41);
    			append(div9, input10);
    			set_input_value(input10, /*current_tax_info*/ ctx[18].WithHoldingTax);
    			append(div12, t42);
    			append(div12, div10);
    			append(div10, label6);
    			append(div10, t44);
    			append(div10, input11);
    			set_input_value(input11, /*current_tax_info*/ ctx[18].MISC);
    			append(div12, t45);
    			append(div12, div11);
    			append(div11, label7);
    			append(div11, t47);
    			append(div11, input12);
    			set_input_value(input12, /*current_tax_info*/ ctx[18].ProjTaxRefund);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", input0_input_handler),
    					listen(input1, "input", input1_input_handler),
    					listen(input2, "input", input2_input_handler),
    					listen(input3, "input", input3_input_handler),
    					listen(button, "click", /*CalculateAGI*/ ctx[1]),
    					listen(input4, "input", input4_input_handler),
    					listen(input5, "change", input5_change_handler),
    					listen(input6, "input", input6_input_handler),
    					listen(input7, "input", input7_input_handler),
    					listen(input8, "change", input8_change_handler),
    					listen(input9, "input", input9_input_handler),
    					listen(input10, "input", input10_input_handler),
    					listen(input11, "input", input11_input_handler),
    					listen(input12, "input", input12_input_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input0.value) !== /*current_tax_info*/ ctx[18].grossIncome) {
    				set_input_value(input0, /*current_tax_info*/ ctx[18].grossIncome);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input1.value) !== /*current_tax_info*/ ctx[18].sect125) {
    				set_input_value(input1, /*current_tax_info*/ ctx[18].sect125);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input2.value) !== /*current_tax_info*/ ctx[18].TSA) {
    				set_input_value(input2, /*current_tax_info*/ ctx[18].TSA);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input3.value) !== /*current_tax_info*/ ctx[18].NonTSASavings) {
    				set_input_value(input3, /*current_tax_info*/ ctx[18].NonTSASavings);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && input4.value !== /*current_tax_info*/ ctx[18].AGI) {
    				set_input_value(input4, /*current_tax_info*/ ctx[18].AGI);
    			}

    			if (dirty & /*$current_tax_info*/ 1) {
    				input5.checked = /*current_tax_info*/ ctx[18].isScheduleADeduction;
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input6.value) !== /*current_tax_info*/ ctx[18].ScheduleA) {
    				set_input_value(input6, /*current_tax_info*/ ctx[18].ScheduleA);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input7.value) !== /*current_tax_info*/ ctx[18].AGITax) {
    				set_input_value(input7, /*current_tax_info*/ ctx[18].AGITax);
    			}

    			if (dirty & /*$current_tax_info*/ 1) {
    				input8.checked = /*current_tax_info*/ ctx[18].over65dedution;
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input9.value) !== /*current_tax_info*/ ctx[18].Age65) {
    				set_input_value(input9, /*current_tax_info*/ ctx[18].Age65);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input10.value) !== /*current_tax_info*/ ctx[18].WithHoldingTax) {
    				set_input_value(input10, /*current_tax_info*/ ctx[18].WithHoldingTax);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input11.value) !== /*current_tax_info*/ ctx[18].MISC) {
    				set_input_value(input11, /*current_tax_info*/ ctx[18].MISC);
    			}

    			if (dirty & /*$current_tax_info*/ 1 && to_number(input12.value) !== /*current_tax_info*/ ctx[18].ProjTaxRefund) {
    				set_input_value(input12, /*current_tax_info*/ ctx[18].ProjTaxRefund);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div12);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let div;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*$current_tax_info*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			button = element("button");
    			button.textContent = "Calculate Summary";
    			set_style(button, "width", "100%");
    			set_style(button, "padding", "5px");
    			attr(div, "class", "current-tax-form svelte-18meaip");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t0);
    			append(div, button);

    			if (!mounted) {
    				dispose = listen(button, "click", /*LoadSummary*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$current_tax_info, CalculateAGI*/ 3) {
    				each_value = /*$current_tax_info*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $current_tax_info;
    	component_subscribe($$self, current_tax_info, $$value => $$invalidate(0, $current_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	const GetAGI = () => {
    		set_store_value(current_tax_info, $current_tax_info[0].AGI = toCurrency.format($current_tax_info[0].grossIncome - $current_tax_info[0].TSA - $current_tax_info[0].sect125), $current_tax_info);
    		return $current_tax_info[0].AGI;
    	};

    	const CalculateAGI = () => {
    		let AGI = GetAGI();
    		document.querySelector(".AGI").textContent = AGI;
    	};

    	const LoadSummary = () => {
    		set_store_value(current_tax_info, $current_tax_info[0].ProjTaxRefund = $current_tax_info[0].AGITax - $current_tax_info[0].WithHoldingTax, $current_tax_info); //- tax credits

    		if (document.getElementById("tax-summary-current") == null) {
    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Current" }
    				});
    		} else if (document.getElementById("tax-summary-current") != null) {
    			document.getElementById("tax-summary-current").remove();

    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Current" }
    				});
    		}
    	};

    	function input0_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].grossIncome = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input1_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].sect125 = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input2_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].TSA = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input3_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].NonTSASavings = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input4_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].AGI = this.value;
    		current_tax_info.set($current_tax_info);
    	}

    	function input5_change_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].isScheduleADeduction = this.checked;
    		current_tax_info.set($current_tax_info);
    	}

    	function input6_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].ScheduleA = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input7_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].AGITax = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input8_change_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].over65dedution = this.checked;
    		current_tax_info.set($current_tax_info);
    	}

    	function input9_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].Age65 = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input10_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].WithHoldingTax = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input11_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].MISC = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	function input12_input_handler(each_value, current_tax_info_index) {
    		each_value[current_tax_info_index].ProjTaxRefund = to_number(this.value);
    		current_tax_info.set($current_tax_info);
    	}

    	return [
    		$current_tax_info,
    		CalculateAGI,
    		LoadSummary,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_change_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_change_handler,
    		input9_input_handler,
    		input10_input_handler,
    		input11_input_handler,
    		input12_input_handler
    	];
    }

    class Current extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$2.getElementById("svelte-18meaip-style")) add_css$7();
    		init(this, options, instance$5, create_fragment$7, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-form\Projected1.svelte generated by Svelte v3.35.0 */

    const { document: document_1$1 } = globals;

    function add_css$6() {
    	var style = element("style");
    	style.id = "svelte-1v7glqa-style";
    	style.textContent = ".projected1-tax-form.svelte-1v7glqa{width:25%;text-align:center;float:left;padding:5px}.border-2.svelte-1v7glqa{border:2px solid black;padding:10px;background:lightblue;opacity:0.9;color:white}.calculate-agi.svelte-1v7glqa{width:100%;padding:5px}#filing-status.svelte-1v7glqa{width:100%;padding:5px;margin-bottom:10px;text-align:center}";
    	append(document_1$1.head, style);
    }

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	child_ctx[19] = list;
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (59:4) {#each $projected1_tax_info as projected1_tax_info}
    function create_each_block$2(ctx) {
    	let div12;
    	let h2;
    	let t1;
    	let div4;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let h30;
    	let t6;
    	let div0;
    	let label1;
    	let t8;
    	let input1;
    	let t9;
    	let div1;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div2;
    	let label3;
    	let t14;
    	let input3;
    	let t15;
    	let div3;
    	let br;
    	let t16;
    	let button;
    	let t18;
    	let p;
    	let t19;
    	let b;
    	let span;
    	let input4;
    	let t20;
    	let h31;
    	let t22;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t27;
    	let div5;
    	let t28;
    	let input5;
    	let t29;
    	let input6;
    	let t30;
    	let div6;
    	let label4;
    	let t32;
    	let input7;
    	let t33;
    	let div7;
    	let t34;
    	let input8;
    	let t35;
    	let div8;
    	let t36;
    	let input9;
    	let t37;
    	let h32;
    	let t39;
    	let div9;
    	let label5;
    	let t41;
    	let input10;
    	let t42;
    	let div10;
    	let label6;
    	let t44;
    	let input11;
    	let t45;
    	let div11;
    	let label7;
    	let t47;
    	let input12;
    	let mounted;
    	let dispose;

    	function input0_input_handler() {
    		/*input0_input_handler*/ ctx[3].call(input0, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input1_input_handler() {
    		/*input1_input_handler*/ ctx[4].call(input1, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input2_input_handler() {
    		/*input2_input_handler*/ ctx[5].call(input2, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input3_input_handler() {
    		/*input3_input_handler*/ ctx[6].call(input3, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input4_input_handler() {
    		/*input4_input_handler*/ ctx[7].call(input4, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input5_change_handler() {
    		/*input5_change_handler*/ ctx[8].call(input5, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input6_input_handler() {
    		/*input6_input_handler*/ ctx[9].call(input6, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input7_input_handler() {
    		/*input7_input_handler*/ ctx[10].call(input7, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input8_change_handler() {
    		/*input8_change_handler*/ ctx[11].call(input8, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input9_input_handler() {
    		/*input9_input_handler*/ ctx[12].call(input9, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input10_input_handler() {
    		/*input10_input_handler*/ ctx[13].call(input10, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input11_input_handler() {
    		/*input11_input_handler*/ ctx[14].call(input11, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	function input12_input_handler() {
    		/*input12_input_handler*/ ctx[15].call(input12, /*each_value*/ ctx[19], /*projected1_tax_info_index*/ ctx[20]);
    	}

    	return {
    		c() {
    			div12 = element("div");
    			h2 = element("h2");
    			h2.innerHTML = `<u>Projected 1 Tax Information</u>`;
    			t1 = space();
    			div4 = element("div");
    			label0 = element("label");
    			label0.textContent = "Gross Income /yr:";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			h30 = element("h3");
    			h30.textContent = "Pre-Tax Contributions";
    			t6 = space();
    			div0 = element("div");
    			label1 = element("label");
    			label1.textContent = "Sect 125:";
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			div1 = element("div");
    			label2 = element("label");
    			label2.textContent = "TSA:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div2 = element("div");
    			label3 = element("label");
    			label3.textContent = "Non TSA:";
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			div3 = element("div");
    			br = element("br");
    			t16 = space();
    			button = element("button");
    			button.textContent = "Calculate AGI";
    			t18 = space();
    			p = element("p");
    			t19 = text("Current AGI:\r\n                    ");
    			b = element("b");
    			span = element("span");
    			input4 = element("input");
    			t20 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t22 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Single";
    			option1 = element("option");
    			option1.textContent = "Married";
    			option2 = element("option");
    			option2.textContent = "Married filing separatly";
    			option3 = element("option");
    			option3.textContent = "Head of Houshold";
    			t27 = space();
    			div5 = element("div");
    			t28 = text("Use Schedule A\r\n                ");
    			input5 = element("input");
    			t29 = space();
    			input6 = element("input");
    			t30 = space();
    			div6 = element("div");
    			label4 = element("label");
    			label4.textContent = "Search Tax Owed:";
    			t32 = space();
    			input7 = element("input");
    			t33 = space();
    			div7 = element("div");
    			t34 = text("65+ years old\r\n                ");
    			input8 = element("input");
    			t35 = space();
    			div8 = element("div");
    			t36 = text("Age 65:\r\n                ");
    			input9 = element("input");
    			t37 = space();
    			h32 = element("h3");
    			h32.textContent = "Witholding Taxes";
    			t39 = space();
    			div9 = element("div");
    			label5 = element("label");
    			label5.textContent = "W/H Tax:";
    			t41 = space();
    			input10 = element("input");
    			t42 = space();
    			div10 = element("div");
    			label6 = element("label");
    			label6.textContent = "MISC:";
    			t44 = space();
    			input11 = element("input");
    			t45 = space();
    			div11 = element("div");
    			label7 = element("label");
    			label7.textContent = "Proj Tax Refund:";
    			t47 = space();
    			input12 = element("input");
    			attr(label0, "for", "GrossInc");
    			attr(input0, "type", "number");
    			attr(label1, "for", "Sect125");
    			attr(input1, "type", "number");
    			attr(label2, "for", "TSA");
    			attr(input2, "type", "number");
    			attr(label3, "for", "NonTSA");
    			attr(input3, "type", "number");
    			attr(button, "class", "calculate-agi svelte-1v7glqa");
    			attr(input4, "type", "text");
    			attr(input4, "class", "AGI");
    			input4.disabled = true;
    			option0.__value = "single";
    			option0.value = option0.__value;
    			option1.__value = "married";
    			option1.value = option1.__value;
    			option2.__value = "Married_s";
    			option2.value = option2.__value;
    			option3.__value = "headofhousehold";
    			option3.value = option3.__value;
    			attr(select, "name", "filing-status");
    			attr(select, "id", "filing-status");
    			attr(select, "class", "svelte-1v7glqa");
    			attr(input5, "class", "isScheduleA");
    			attr(input5, "type", "checkbox");
    			attr(input6, "type", "number");
    			attr(label4, "for", "AGI-tax");
    			attr(input7, "type", "number");
    			attr(input8, "class", "is65orover");
    			attr(input8, "type", "checkbox");
    			attr(input9, "type", "number");
    			attr(label5, "for", "witholding");
    			attr(input10, "type", "number");
    			attr(label6, "for", "Misc");
    			attr(input11, "type", "number");
    			attr(label7, "for", "ProjTaxRefund");
    			attr(input12, "type", "number");
    			attr(input12, "class", "ProjTaxRefund");
    			input12.disabled = true;
    			attr(div12, "class", "border-2 svelte-1v7glqa");
    		},
    		m(target, anchor) {
    			insert(target, div12, anchor);
    			append(div12, h2);
    			append(div12, t1);
    			append(div12, div4);
    			append(div4, label0);
    			append(div4, t3);
    			append(div4, input0);
    			set_input_value(input0, /*projected1_tax_info*/ ctx[18].grossIncome);
    			append(div4, t4);
    			append(div4, h30);
    			append(div4, t6);
    			append(div4, div0);
    			append(div0, label1);
    			append(div0, t8);
    			append(div0, input1);
    			set_input_value(input1, /*projected1_tax_info*/ ctx[18].sect125);
    			append(div4, t9);
    			append(div4, div1);
    			append(div1, label2);
    			append(div1, t11);
    			append(div1, input2);
    			set_input_value(input2, /*projected1_tax_info*/ ctx[18].TSA);
    			append(div4, t12);
    			append(div4, div2);
    			append(div2, label3);
    			append(div2, t14);
    			append(div2, input3);
    			set_input_value(input3, /*projected1_tax_info*/ ctx[18].NonTSASavings);
    			append(div4, t15);
    			append(div4, div3);
    			append(div3, br);
    			append(div3, t16);
    			append(div3, button);
    			append(div4, t18);
    			append(div4, p);
    			append(p, t19);
    			append(p, b);
    			append(b, span);
    			append(span, input4);
    			set_input_value(input4, /*projected1_tax_info*/ ctx[18].AGI);
    			append(div12, t20);
    			append(div12, h31);
    			append(div12, t22);
    			append(div12, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(div12, t27);
    			append(div12, div5);
    			append(div5, t28);
    			append(div5, input5);
    			input5.checked = /*projected1_tax_info*/ ctx[18].isScheduleADeduction;
    			append(div5, t29);
    			append(div5, input6);
    			set_input_value(input6, /*projected1_tax_info*/ ctx[18].scheduleADeduction);
    			append(div12, t30);
    			append(div12, div6);
    			append(div6, label4);
    			append(div6, t32);
    			append(div6, input7);
    			set_input_value(input7, /*projected1_tax_info*/ ctx[18].AGITax);
    			append(div12, t33);
    			append(div12, div7);
    			append(div7, t34);
    			append(div7, input8);
    			input8.checked = /*projected1_tax_info*/ ctx[18].over65dedution;
    			append(div12, t35);
    			append(div12, div8);
    			append(div8, t36);
    			append(div8, input9);
    			set_input_value(input9, /*projected1_tax_info*/ ctx[18].Age65);
    			append(div12, t37);
    			append(div12, h32);
    			append(div12, t39);
    			append(div12, div9);
    			append(div9, label5);
    			append(div9, t41);
    			append(div9, input10);
    			set_input_value(input10, /*projected1_tax_info*/ ctx[18].WithHoldingTax);
    			append(div12, t42);
    			append(div12, div10);
    			append(div10, label6);
    			append(div10, t44);
    			append(div10, input11);
    			set_input_value(input11, /*projected1_tax_info*/ ctx[18].MISC);
    			append(div12, t45);
    			append(div12, div11);
    			append(div11, label7);
    			append(div11, t47);
    			append(div11, input12);
    			set_input_value(input12, /*projected1_tax_info*/ ctx[18].ProjTaxRefund);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", input0_input_handler),
    					listen(input1, "input", input1_input_handler),
    					listen(input2, "input", input2_input_handler),
    					listen(input3, "input", input3_input_handler),
    					listen(button, "click", /*CalculateAGI*/ ctx[1]),
    					listen(input4, "input", input4_input_handler),
    					listen(input5, "change", input5_change_handler),
    					listen(input6, "input", input6_input_handler),
    					listen(input7, "input", input7_input_handler),
    					listen(input8, "change", input8_change_handler),
    					listen(input9, "input", input9_input_handler),
    					listen(input10, "input", input10_input_handler),
    					listen(input11, "input", input11_input_handler),
    					listen(input12, "input", input12_input_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input0.value) !== /*projected1_tax_info*/ ctx[18].grossIncome) {
    				set_input_value(input0, /*projected1_tax_info*/ ctx[18].grossIncome);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input1.value) !== /*projected1_tax_info*/ ctx[18].sect125) {
    				set_input_value(input1, /*projected1_tax_info*/ ctx[18].sect125);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input2.value) !== /*projected1_tax_info*/ ctx[18].TSA) {
    				set_input_value(input2, /*projected1_tax_info*/ ctx[18].TSA);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input3.value) !== /*projected1_tax_info*/ ctx[18].NonTSASavings) {
    				set_input_value(input3, /*projected1_tax_info*/ ctx[18].NonTSASavings);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && input4.value !== /*projected1_tax_info*/ ctx[18].AGI) {
    				set_input_value(input4, /*projected1_tax_info*/ ctx[18].AGI);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1) {
    				input5.checked = /*projected1_tax_info*/ ctx[18].isScheduleADeduction;
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input6.value) !== /*projected1_tax_info*/ ctx[18].scheduleADeduction) {
    				set_input_value(input6, /*projected1_tax_info*/ ctx[18].scheduleADeduction);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input7.value) !== /*projected1_tax_info*/ ctx[18].AGITax) {
    				set_input_value(input7, /*projected1_tax_info*/ ctx[18].AGITax);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1) {
    				input8.checked = /*projected1_tax_info*/ ctx[18].over65dedution;
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input9.value) !== /*projected1_tax_info*/ ctx[18].Age65) {
    				set_input_value(input9, /*projected1_tax_info*/ ctx[18].Age65);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input10.value) !== /*projected1_tax_info*/ ctx[18].WithHoldingTax) {
    				set_input_value(input10, /*projected1_tax_info*/ ctx[18].WithHoldingTax);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input11.value) !== /*projected1_tax_info*/ ctx[18].MISC) {
    				set_input_value(input11, /*projected1_tax_info*/ ctx[18].MISC);
    			}

    			if (dirty & /*$projected1_tax_info*/ 1 && to_number(input12.value) !== /*projected1_tax_info*/ ctx[18].ProjTaxRefund) {
    				set_input_value(input12, /*projected1_tax_info*/ ctx[18].ProjTaxRefund);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div12);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*$projected1_tax_info*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			button = element("button");
    			button.textContent = "Calculate Summary";
    			set_style(button, "width", "100%");
    			set_style(button, "padding", "5px");
    			attr(div, "class", "projected1-tax-form svelte-1v7glqa");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t0);
    			append(div, button);

    			if (!mounted) {
    				dispose = listen(button, "click", /*LoadSummary*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$projected1_tax_info, CalculateAGI*/ 3) {
    				each_value = /*$projected1_tax_info*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $projected1_tax_info;
    	component_subscribe($$self, projected1_tax_info, $$value => $$invalidate(0, $projected1_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	const GetAGI = () => {
    		set_store_value(projected1_tax_info, $projected1_tax_info[0].AGI = toCurrency.format($projected1_tax_info[0].grossIncome - $projected1_tax_info[0].TSA - $projected1_tax_info[0].sect125), $projected1_tax_info);
    		return $projected1_tax_info[0].AGI;
    	};

    	const CalculateAGI = () => {
    		let AGI = GetAGI();
    		document.querySelector(".AGI").textContent = AGI;
    	};

    	const LoadSummary = () => {
    		set_store_value(projected1_tax_info, $projected1_tax_info[0].ProjTaxRefund = $projected1_tax_info[0].AGITax - $projected1_tax_info[0].WithHoldingTax, $projected1_tax_info); //- tax credits

    		if (document.getElementById("tax-summary-projected1") == null) {
    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Projected 1" }
    				});
    		} else if (document.getElementById("tax-summary-projected1") != null) {
    			document.getElementById("tax-summary-projected1").remove();

    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Projected 1" }
    				});
    		}
    	};

    	function input0_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].grossIncome = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input1_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].sect125 = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input2_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].TSA = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input3_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].NonTSASavings = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input4_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].AGI = this.value;
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input5_change_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].isScheduleADeduction = this.checked;
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input6_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].scheduleADeduction = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input7_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].AGITax = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input8_change_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].over65dedution = this.checked;
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input9_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].Age65 = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input10_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].WithHoldingTax = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input11_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].MISC = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	function input12_input_handler(each_value, projected1_tax_info_index) {
    		each_value[projected1_tax_info_index].ProjTaxRefund = to_number(this.value);
    		projected1_tax_info.set($projected1_tax_info);
    	}

    	return [
    		$projected1_tax_info,
    		CalculateAGI,
    		LoadSummary,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_change_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_change_handler,
    		input9_input_handler,
    		input10_input_handler,
    		input11_input_handler,
    		input12_input_handler
    	];
    }

    class Projected1 extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1$1.getElementById("svelte-1v7glqa-style")) add_css$6();
    		init(this, options, instance$4, create_fragment$6, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-form\Projected2.svelte generated by Svelte v3.35.0 */

    const { document: document_1 } = globals;

    function add_css$5() {
    	var style = element("style");
    	style.id = "svelte-1j92lge-style";
    	style.textContent = ".projected2-tax-form.svelte-1j92lge{width:25%;text-align:center;float:left;padding:5px}.border-2.svelte-1j92lge{border:2px solid black;padding:10px;background:lightcoral;opacity:0.9;color:white}.calculate-agi.svelte-1j92lge{width:100%;padding:5px}#filing-status.svelte-1j92lge{width:100%;padding:5px;margin-bottom:10px;text-align:center}";
    	append(document_1.head, style);
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	child_ctx[19] = list;
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (56:4) {#each $projected2_tax_info as projected2_tax_info}
    function create_each_block$1(ctx) {
    	let div12;
    	let h2;
    	let t1;
    	let div4;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let h30;
    	let t6;
    	let div0;
    	let label1;
    	let t8;
    	let input1;
    	let t9;
    	let div1;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div2;
    	let label3;
    	let t14;
    	let input3;
    	let t15;
    	let div3;
    	let br;
    	let t16;
    	let button;
    	let t18;
    	let p;
    	let t19;
    	let b;
    	let span;
    	let input4;
    	let t20;
    	let h31;
    	let t22;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t27;
    	let div5;
    	let t28;
    	let input5;
    	let t29;
    	let input6;
    	let t30;
    	let div6;
    	let label4;
    	let t32;
    	let input7;
    	let t33;
    	let div7;
    	let t34;
    	let input8;
    	let t35;
    	let div8;
    	let t36;
    	let input9;
    	let t37;
    	let h32;
    	let t39;
    	let div9;
    	let label5;
    	let t41;
    	let input10;
    	let t42;
    	let div10;
    	let label6;
    	let t44;
    	let input11;
    	let t45;
    	let div11;
    	let label7;
    	let t47;
    	let input12;
    	let mounted;
    	let dispose;

    	function input0_input_handler() {
    		/*input0_input_handler*/ ctx[3].call(input0, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input1_input_handler() {
    		/*input1_input_handler*/ ctx[4].call(input1, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input2_input_handler() {
    		/*input2_input_handler*/ ctx[5].call(input2, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input3_input_handler() {
    		/*input3_input_handler*/ ctx[6].call(input3, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input4_input_handler() {
    		/*input4_input_handler*/ ctx[7].call(input4, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input5_change_handler() {
    		/*input5_change_handler*/ ctx[8].call(input5, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input6_input_handler() {
    		/*input6_input_handler*/ ctx[9].call(input6, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input7_input_handler() {
    		/*input7_input_handler*/ ctx[10].call(input7, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input8_change_handler() {
    		/*input8_change_handler*/ ctx[11].call(input8, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input9_input_handler() {
    		/*input9_input_handler*/ ctx[12].call(input9, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input10_input_handler() {
    		/*input10_input_handler*/ ctx[13].call(input10, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input11_input_handler() {
    		/*input11_input_handler*/ ctx[14].call(input11, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	function input12_input_handler() {
    		/*input12_input_handler*/ ctx[15].call(input12, /*each_value*/ ctx[19], /*projected2_tax_info_index*/ ctx[20]);
    	}

    	return {
    		c() {
    			div12 = element("div");
    			h2 = element("h2");
    			h2.innerHTML = `<u>Projected 2 Tax Information</u>`;
    			t1 = space();
    			div4 = element("div");
    			label0 = element("label");
    			label0.textContent = "Gross Income /yr:";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			h30 = element("h3");
    			h30.textContent = "Pre-Tax Contributions";
    			t6 = space();
    			div0 = element("div");
    			label1 = element("label");
    			label1.textContent = "Sect 125:";
    			t8 = space();
    			input1 = element("input");
    			t9 = space();
    			div1 = element("div");
    			label2 = element("label");
    			label2.textContent = "TSA:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div2 = element("div");
    			label3 = element("label");
    			label3.textContent = "Non TSA:";
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			div3 = element("div");
    			br = element("br");
    			t16 = space();
    			button = element("button");
    			button.textContent = "Calculate AGI";
    			t18 = space();
    			p = element("p");
    			t19 = text("Current AGI:\r\n                    ");
    			b = element("b");
    			span = element("span");
    			input4 = element("input");
    			t20 = space();
    			h31 = element("h3");
    			h31.textContent = "Filing Status";
    			t22 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Single";
    			option1 = element("option");
    			option1.textContent = "Married";
    			option2 = element("option");
    			option2.textContent = "Married filing separatly";
    			option3 = element("option");
    			option3.textContent = "Head of Houshold";
    			t27 = space();
    			div5 = element("div");
    			t28 = text("Use Schedule A\r\n                ");
    			input5 = element("input");
    			t29 = space();
    			input6 = element("input");
    			t30 = space();
    			div6 = element("div");
    			label4 = element("label");
    			label4.textContent = "Search Tax Owed:";
    			t32 = space();
    			input7 = element("input");
    			t33 = space();
    			div7 = element("div");
    			t34 = text("65+ years old\r\n                ");
    			input8 = element("input");
    			t35 = space();
    			div8 = element("div");
    			t36 = text("Age 65:\r\n                ");
    			input9 = element("input");
    			t37 = space();
    			h32 = element("h3");
    			h32.textContent = "Witholding Taxes";
    			t39 = space();
    			div9 = element("div");
    			label5 = element("label");
    			label5.textContent = "W/H Tax:";
    			t41 = space();
    			input10 = element("input");
    			t42 = space();
    			div10 = element("div");
    			label6 = element("label");
    			label6.textContent = "MISC:";
    			t44 = space();
    			input11 = element("input");
    			t45 = space();
    			div11 = element("div");
    			label7 = element("label");
    			label7.textContent = "Proj Tax Refund:";
    			t47 = space();
    			input12 = element("input");
    			attr(label0, "for", "GrossInc");
    			attr(input0, "type", "number");
    			attr(label1, "for", "Sect125");
    			attr(input1, "type", "number");
    			attr(label2, "for", "TSA");
    			attr(input2, "type", "number");
    			attr(label3, "for", "NonTSA");
    			attr(input3, "type", "number");
    			attr(button, "class", "calculate-agi svelte-1j92lge");
    			attr(input4, "type", "text");
    			attr(input4, "class", "AGI");
    			input4.disabled = true;
    			option0.__value = "single";
    			option0.value = option0.__value;
    			option1.__value = "married";
    			option1.value = option1.__value;
    			option2.__value = "Married_s";
    			option2.value = option2.__value;
    			option3.__value = "headofhousehold";
    			option3.value = option3.__value;
    			attr(select, "name", "filing-status");
    			attr(select, "id", "filing-status");
    			attr(select, "class", "svelte-1j92lge");
    			attr(input5, "class", "isScheduleA");
    			attr(input5, "type", "checkbox");
    			attr(input6, "type", "number");
    			attr(label4, "for", "AGI-tax");
    			attr(input7, "type", "number");
    			attr(input8, "class", "is65orover");
    			attr(input8, "type", "checkbox");
    			attr(input9, "type", "number");
    			attr(label5, "for", "witholding");
    			attr(input10, "type", "number");
    			attr(label6, "for", "Misc");
    			attr(input11, "type", "number");
    			attr(label7, "for", "Proj2TaxRefund");
    			attr(input12, "type", "number");
    			attr(input12, "class", "Proj2TaxRefund");
    			input12.disabled = true;
    			attr(div12, "class", "border-2 svelte-1j92lge");
    		},
    		m(target, anchor) {
    			insert(target, div12, anchor);
    			append(div12, h2);
    			append(div12, t1);
    			append(div12, div4);
    			append(div4, label0);
    			append(div4, t3);
    			append(div4, input0);
    			set_input_value(input0, /*projected2_tax_info*/ ctx[18].grossIncome);
    			append(div4, t4);
    			append(div4, h30);
    			append(div4, t6);
    			append(div4, div0);
    			append(div0, label1);
    			append(div0, t8);
    			append(div0, input1);
    			set_input_value(input1, /*projected2_tax_info*/ ctx[18].sect125);
    			append(div4, t9);
    			append(div4, div1);
    			append(div1, label2);
    			append(div1, t11);
    			append(div1, input2);
    			set_input_value(input2, /*projected2_tax_info*/ ctx[18].TSA);
    			append(div4, t12);
    			append(div4, div2);
    			append(div2, label3);
    			append(div2, t14);
    			append(div2, input3);
    			set_input_value(input3, /*projected2_tax_info*/ ctx[18].NonTSASavings);
    			append(div4, t15);
    			append(div4, div3);
    			append(div3, br);
    			append(div3, t16);
    			append(div3, button);
    			append(div4, t18);
    			append(div4, p);
    			append(p, t19);
    			append(p, b);
    			append(b, span);
    			append(span, input4);
    			set_input_value(input4, /*projected2_tax_info*/ ctx[18].AGI);
    			append(div12, t20);
    			append(div12, h31);
    			append(div12, t22);
    			append(div12, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(div12, t27);
    			append(div12, div5);
    			append(div5, t28);
    			append(div5, input5);
    			input5.checked = /*projected2_tax_info*/ ctx[18].isScheduleADeduction;
    			append(div5, t29);
    			append(div5, input6);
    			set_input_value(input6, /*projected2_tax_info*/ ctx[18].scheduleADeduction);
    			append(div12, t30);
    			append(div12, div6);
    			append(div6, label4);
    			append(div6, t32);
    			append(div6, input7);
    			set_input_value(input7, /*projected2_tax_info*/ ctx[18].AGITax);
    			append(div12, t33);
    			append(div12, div7);
    			append(div7, t34);
    			append(div7, input8);
    			input8.checked = /*projected2_tax_info*/ ctx[18].over65dedution;
    			append(div12, t35);
    			append(div12, div8);
    			append(div8, t36);
    			append(div8, input9);
    			set_input_value(input9, /*projected2_tax_info*/ ctx[18].Age65);
    			append(div12, t37);
    			append(div12, h32);
    			append(div12, t39);
    			append(div12, div9);
    			append(div9, label5);
    			append(div9, t41);
    			append(div9, input10);
    			set_input_value(input10, /*projected2_tax_info*/ ctx[18].WithHoldingTax);
    			append(div12, t42);
    			append(div12, div10);
    			append(div10, label6);
    			append(div10, t44);
    			append(div10, input11);
    			set_input_value(input11, /*projected2_tax_info*/ ctx[18].MISC);
    			append(div12, t45);
    			append(div12, div11);
    			append(div11, label7);
    			append(div11, t47);
    			append(div11, input12);
    			set_input_value(input12, /*projected2_tax_info*/ ctx[18].ProjTaxRefund);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", input0_input_handler),
    					listen(input1, "input", input1_input_handler),
    					listen(input2, "input", input2_input_handler),
    					listen(input3, "input", input3_input_handler),
    					listen(button, "click", /*CalculateAGI*/ ctx[1]),
    					listen(input4, "input", input4_input_handler),
    					listen(input5, "change", input5_change_handler),
    					listen(input6, "input", input6_input_handler),
    					listen(input7, "input", input7_input_handler),
    					listen(input8, "change", input8_change_handler),
    					listen(input9, "input", input9_input_handler),
    					listen(input10, "input", input10_input_handler),
    					listen(input11, "input", input11_input_handler),
    					listen(input12, "input", input12_input_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input0.value) !== /*projected2_tax_info*/ ctx[18].grossIncome) {
    				set_input_value(input0, /*projected2_tax_info*/ ctx[18].grossIncome);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input1.value) !== /*projected2_tax_info*/ ctx[18].sect125) {
    				set_input_value(input1, /*projected2_tax_info*/ ctx[18].sect125);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input2.value) !== /*projected2_tax_info*/ ctx[18].TSA) {
    				set_input_value(input2, /*projected2_tax_info*/ ctx[18].TSA);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input3.value) !== /*projected2_tax_info*/ ctx[18].NonTSASavings) {
    				set_input_value(input3, /*projected2_tax_info*/ ctx[18].NonTSASavings);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && input4.value !== /*projected2_tax_info*/ ctx[18].AGI) {
    				set_input_value(input4, /*projected2_tax_info*/ ctx[18].AGI);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1) {
    				input5.checked = /*projected2_tax_info*/ ctx[18].isScheduleADeduction;
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input6.value) !== /*projected2_tax_info*/ ctx[18].scheduleADeduction) {
    				set_input_value(input6, /*projected2_tax_info*/ ctx[18].scheduleADeduction);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input7.value) !== /*projected2_tax_info*/ ctx[18].AGITax) {
    				set_input_value(input7, /*projected2_tax_info*/ ctx[18].AGITax);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1) {
    				input8.checked = /*projected2_tax_info*/ ctx[18].over65dedution;
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input9.value) !== /*projected2_tax_info*/ ctx[18].Age65) {
    				set_input_value(input9, /*projected2_tax_info*/ ctx[18].Age65);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input10.value) !== /*projected2_tax_info*/ ctx[18].WithHoldingTax) {
    				set_input_value(input10, /*projected2_tax_info*/ ctx[18].WithHoldingTax);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input11.value) !== /*projected2_tax_info*/ ctx[18].MISC) {
    				set_input_value(input11, /*projected2_tax_info*/ ctx[18].MISC);
    			}

    			if (dirty & /*$projected2_tax_info*/ 1 && to_number(input12.value) !== /*projected2_tax_info*/ ctx[18].ProjTaxRefund) {
    				set_input_value(input12, /*projected2_tax_info*/ ctx[18].ProjTaxRefund);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div12);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*$projected2_tax_info*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			button = element("button");
    			button.textContent = "Calculate Summary";
    			set_style(button, "width", "100%");
    			set_style(button, "padding", "5px");
    			attr(div, "class", "projected2-tax-form svelte-1j92lge");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t0);
    			append(div, button);

    			if (!mounted) {
    				dispose = listen(button, "click", /*LoadSummary*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$projected2_tax_info, CalculateAGI*/ 3) {
    				each_value = /*$projected2_tax_info*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $projected2_tax_info;
    	component_subscribe($$self, projected2_tax_info, $$value => $$invalidate(0, $projected2_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	const GetAGI = () => {
    		set_store_value(projected2_tax_info, $projected2_tax_info[0].AGI = toCurrency.format($projected2_tax_info[0].grossIncome - $projected2_tax_info[0].TSA - $projected2_tax_info[0].sect125), $projected2_tax_info);
    		return $projected2_tax_info[0].AGI;
    	};

    	const CalculateAGI = () => {
    		let AGI = GetAGI();
    		document.querySelector(".AGI").textContent = AGI;
    	};

    	const LoadSummary = () => {
    		if (document.getElementById("tax-summary-projected2") == null) {
    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Projected 2" }
    				});
    		} else if (document.getElementById("tax-summary-projected2") != null) {
    			document.getElementById("tax-summary-projected2").remove();

    			new Tax_summary({
    					target: document.body,
    					props: { selectedVariation: "Projected 2" }
    				});
    		}
    	};

    	function input0_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].grossIncome = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input1_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].sect125 = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input2_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].TSA = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input3_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].NonTSASavings = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input4_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].AGI = this.value;
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input5_change_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].isScheduleADeduction = this.checked;
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input6_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].scheduleADeduction = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input7_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].AGITax = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input8_change_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].over65dedution = this.checked;
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input9_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].Age65 = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input10_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].WithHoldingTax = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input11_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].MISC = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	function input12_input_handler(each_value, projected2_tax_info_index) {
    		each_value[projected2_tax_info_index].ProjTaxRefund = to_number(this.value);
    		projected2_tax_info.set($projected2_tax_info);
    	}

    	return [
    		$projected2_tax_info,
    		CalculateAGI,
    		LoadSummary,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_change_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_change_handler,
    		input9_input_handler,
    		input10_input_handler,
    		input11_input_handler,
    		input12_input_handler
    	];
    }

    class Projected2 extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document_1.getElementById("svelte-1j92lge-style")) add_css$5();
    		init(this, options, instance$3, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-form.svelte generated by Svelte v3.35.0 */

    function add_css$4() {
    	var style = element("style");
    	style.id = "svelte-1frmb0c-style";
    	style.textContent = "@media print{.load-tax-form.svelte-1frmb0c{display:none}}";
    	append(document.head, style);
    }

    // (18:49) 
    function create_if_block_2(ctx) {
    	let proj2;
    	let current;
    	proj2 = new Projected2({ props: { projected2_tax_info } });

    	return {
    		c() {
    			create_component(proj2.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(proj2, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(proj2.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(proj2.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(proj2, detaching);
    		}
    	};
    }

    // (16:49) 
    function create_if_block_1(ctx) {
    	let proj1;
    	let current;
    	proj1 = new Projected1({ props: { projected1_tax_info } });

    	return {
    		c() {
    			create_component(proj1.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(proj1, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(proj1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(proj1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(proj1, detaching);
    		}
    	};
    }

    // (14:4) {#if selectedVariation == "Current"}
    function create_if_block(ctx) {
    	let current;
    	let current$1;
    	current = new Current({ props: { current_tax_info } });

    	return {
    		c() {
    			create_component(current.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(current, target, anchor);
    			current$1 = true;
    		},
    		p: noop,
    		i(local) {
    			if (current$1) return;
    			transition_in(current.$$.fragment, local);
    			current$1 = true;
    		},
    		o(local) {
    			transition_out(current.$$.fragment, local);
    			current$1 = false;
    		},
    		d(detaching) {
    			destroy_component(current, detaching);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*selectedVariation*/ ctx[0] == "Current") return 0;
    		if (/*selectedVariation*/ ctx[0] == "Projected 1") return 1;
    		if (/*selectedVariation*/ ctx[0] == "Projected 2") return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr(div, "class", "load-tax-form svelte-1frmb0c");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { selectedVariation } = $$props;

    	$$self.$$set = $$props => {
    		if ("selectedVariation" in $$props) $$invalidate(0, selectedVariation = $$props.selectedVariation);
    	};

    	return [selectedVariation];
    }

    class Tax_form extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1frmb0c-style")) add_css$4();
    		init(this, options, instance$2, create_fragment$4, safe_not_equal, { selectedVariation: 0 });
    	}
    }

    /* src\comp\disclaimer.svelte generated by Svelte v3.35.0 */

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-1o4xh1r-style";
    	style.textContent = ".disclaimer.svelte-1o4xh1r{background-color:gray;color:white;opacity:0.9;padding:5px}";
    	append(document.head, style);
    }

    function create_fragment$3(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");

    			div.innerHTML = `<h4>Disclaimers</h4> 
    <p><i>The information presented below reflects information provided by the client. This information, the calculations and projections are for illustration purposes only. Actual results may vary. This is not a legal contract.</i></p> 
    <p><i>This software program is exclusive property of <b>National Retirement Group</b> and is authorized for use only with plans and products offered through <b>National Retirement Group</b>. Any other use may render invalid results and is strictly prohibited.</i></p>`;

    			attr(div, "class", "disclaimer svelte-1o4xh1r");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    class Disclaimer extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1o4xh1r-style")) add_css$3();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src\comp\actions-to-take.svelte generated by Svelte v3.35.0 */

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-1sjqya0-style";
    	style.textContent = ".container.svelte-1sjqya0{border:2px solid black;background-color:gray;color:white;margin-left:343px;padding:4px}@media print{.container.svelte-1sjqya0{margin-left:1px;opacity:.9}}";
    	append(document.head, style);
    }

    function create_fragment$2(ctx) {
    	let div2;

    	return {
    		c() {
    			div2 = element("div");

    			div2.innerHTML = `<div><h4>What to Expect</h4> 
        <span>Payroll Deduction to begin: </span><input type="datetime"/></div> 
    <div><h4>Steps you must handle</h4> 
        <span>1:</span><input style="width:50%;"/>  <br/> 
        <span>2:</span><input style="width:50%;"/></div>`;

    			attr(div2, "class", "container svelte-1sjqya0");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    class Actions_to_take extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1sjqya0-style")) add_css$2();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src\comp\tax-summary\Combined.svelte generated by Svelte v3.35.0 */

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-1g93cef-style";
    	style.textContent = ".combined-container.svelte-1g93cef{background-color:gray;color:white;padding:10px;text-align:center;display:flex;padding:5px}.combined-current.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:28%}.combined-projected1.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:28%}.combined-projected2.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:28%}@media print{.combined-container.svelte-1g93cef{opacity:.9}.combined-current.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:30%;opacity:.9}.combined-projected1.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:30%;opacity:.9}.combined-projected2.svelte-1g93cef{border-right:1px solid black;margin:0px 10px;padding:0px 10px;width:30%;opacity:.9}}";
    	append(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (43:8) {#each $current_tax_info as item}
    function create_each_block_2(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay) + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let t4_value = /*item*/ ctx[4].PercentPreTax.toFixed(2) + "";
    	let t4;
    	let t5;
    	let t6;
    	let p2;
    	let t7;
    	let t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "";
    	let t8;
    	let t9;
    	let p3;
    	let t10;
    	let t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "";
    	let t11;
    	let t12;
    	let p4;
    	let t13;
    	let t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "";
    	let t14;
    	let t15;
    	let p5;
    	let t16;
    	let t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "";
    	let t17;
    	let t18;
    	let p6;
    	let t19;
    	let t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "";
    	let t20;
    	let t21;
    	let p7;
    	let t22;
    	let t23_value = /*item*/ ctx[4].Age65 + "";
    	let t23;
    	let t24;

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text("Annual Tax Savings: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Proj. Savings @ Curr. Int. Rate: ");
    			t4 = text(t4_value);
    			t5 = text("%");
    			t6 = space();
    			p2 = element("p");
    			t7 = text("Proj. Tax Refund: ");
    			t8 = text(t8_value);
    			t9 = space();
    			p3 = element("p");
    			t10 = text("5 year: ");
    			t11 = text(t11_value);
    			t12 = space();
    			p4 = element("p");
    			t13 = text("10 year: ");
    			t14 = text(t14_value);
    			t15 = space();
    			p5 = element("p");
    			t16 = text("15 year: ");
    			t17 = text(t17_value);
    			t18 = space();
    			p6 = element("p");
    			t19 = text("20 year: ");
    			t20 = text(t20_value);
    			t21 = space();
    			p7 = element("p");
    			t22 = text("Age 65: ");
    			t23 = text(t23_value);
    			t24 = space();
    			attr(div, "class", "current-summary");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(p0, t1);
    			append(div, t2);
    			append(div, p1);
    			append(p1, t3);
    			append(p1, t4);
    			append(p1, t5);
    			append(div, t6);
    			append(div, p2);
    			append(p2, t7);
    			append(p2, t8);
    			append(div, t9);
    			append(div, p3);
    			append(p3, t10);
    			append(p3, t11);
    			append(div, t12);
    			append(div, p4);
    			append(p4, t13);
    			append(p4, t14);
    			append(div, t15);
    			append(div, p5);
    			append(p5, t16);
    			append(p5, t17);
    			append(div, t18);
    			append(div, p6);
    			append(p6, t19);
    			append(p6, t20);
    			append(div, t21);
    			append(div, p7);
    			append(p7, t22);
    			append(p7, t23);
    			append(div, t24);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$current_tax_info*/ 1 && t1_value !== (t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay) + "")) set_data(t1, t1_value);
    			if (dirty & /*$current_tax_info*/ 1 && t4_value !== (t4_value = /*item*/ ctx[4].PercentPreTax.toFixed(2) + "")) set_data(t4, t4_value);
    			if (dirty & /*$current_tax_info*/ 1 && t8_value !== (t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "")) set_data(t8, t8_value);
    			if (dirty & /*$current_tax_info*/ 1 && t11_value !== (t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "")) set_data(t11, t11_value);
    			if (dirty & /*$current_tax_info*/ 1 && t14_value !== (t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "")) set_data(t14, t14_value);
    			if (dirty & /*$current_tax_info*/ 1 && t17_value !== (t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "")) set_data(t17, t17_value);
    			if (dirty & /*$current_tax_info*/ 1 && t20_value !== (t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "")) set_data(t20, t20_value);
    			if (dirty & /*$current_tax_info*/ 1 && t23_value !== (t23_value = /*item*/ ctx[4].Age65 + "")) set_data(t23, t23_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (75:8) {#each $projected1_tax_info as item}
    function create_each_block_1(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay - /*$current_tax_info*/ ctx[0][0].NetTakeHomePay) + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let t4_value = (/*item*/ ctx[4].PercentPreTax - /*$current_tax_info*/ ctx[0][0].PercentPreTax).toFixed(2) + "";
    	let t4;
    	let t5;
    	let t6;
    	let p2;
    	let t7;
    	let t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "";
    	let t8;
    	let t9;
    	let p3;
    	let t10;
    	let t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "";
    	let t11;
    	let t12;
    	let p4;
    	let t13;
    	let t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "";
    	let t14;
    	let t15;
    	let p5;
    	let t16;
    	let t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "";
    	let t17;
    	let t18;
    	let p6;
    	let t19;
    	let t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "";
    	let t20;
    	let t21;
    	let p7;
    	let t22;
    	let t23_value = /*item*/ ctx[4].Age65 + "";
    	let t23;
    	let t24;

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text("Annual Tax Savings: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Savings @ Curr. Int. Rate: ");
    			t4 = text(t4_value);
    			t5 = text("%");
    			t6 = space();
    			p2 = element("p");
    			t7 = text("Proj. Tax Refund: ");
    			t8 = text(t8_value);
    			t9 = space();
    			p3 = element("p");
    			t10 = text("5 year: ");
    			t11 = text(t11_value);
    			t12 = space();
    			p4 = element("p");
    			t13 = text("10 year: ");
    			t14 = text(t14_value);
    			t15 = space();
    			p5 = element("p");
    			t16 = text("15 year: ");
    			t17 = text(t17_value);
    			t18 = space();
    			p6 = element("p");
    			t19 = text("20 year: ");
    			t20 = text(t20_value);
    			t21 = space();
    			p7 = element("p");
    			t22 = text("Age 65: ");
    			t23 = text(t23_value);
    			t24 = space();
    			attr(div, "class", "projected1-vs-current");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(p0, t1);
    			append(div, t2);
    			append(div, p1);
    			append(p1, t3);
    			append(p1, t4);
    			append(p1, t5);
    			append(div, t6);
    			append(div, p2);
    			append(p2, t7);
    			append(p2, t8);
    			append(div, t9);
    			append(div, p3);
    			append(p3, t10);
    			append(p3, t11);
    			append(div, t12);
    			append(div, p4);
    			append(p4, t13);
    			append(p4, t14);
    			append(div, t15);
    			append(div, p5);
    			append(p5, t16);
    			append(p5, t17);
    			append(div, t18);
    			append(div, p6);
    			append(p6, t19);
    			append(p6, t20);
    			append(div, t21);
    			append(div, p7);
    			append(p7, t22);
    			append(p7, t23);
    			append(div, t24);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$projected1_tax_info, $current_tax_info*/ 3 && t1_value !== (t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay - /*$current_tax_info*/ ctx[0][0].NetTakeHomePay) + "")) set_data(t1, t1_value);
    			if (dirty & /*$projected1_tax_info, $current_tax_info*/ 3 && t4_value !== (t4_value = (/*item*/ ctx[4].PercentPreTax - /*$current_tax_info*/ ctx[0][0].PercentPreTax).toFixed(2) + "")) set_data(t4, t4_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t8_value !== (t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "")) set_data(t8, t8_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t11_value !== (t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "")) set_data(t11, t11_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t14_value !== (t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "")) set_data(t14, t14_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t17_value !== (t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "")) set_data(t17, t17_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t20_value !== (t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "")) set_data(t20, t20_value);
    			if (dirty & /*$projected1_tax_info*/ 2 && t23_value !== (t23_value = /*item*/ ctx[4].Age65 + "")) set_data(t23, t23_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (91:8) {#each $projected2_tax_info as item}
    function create_each_block(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay - /*$current_tax_info*/ ctx[0][0].NetTakeHomePay) + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let t4_value = (/*item*/ ctx[4].PercentPreTax - /*$current_tax_info*/ ctx[0][0].PercentPreTax).toFixed(2) + "";
    	let t4;
    	let t5;
    	let t6;
    	let p2;
    	let t7;
    	let t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "";
    	let t8;
    	let t9;
    	let p3;
    	let t10;
    	let t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "";
    	let t11;
    	let t12;
    	let p4;
    	let t13;
    	let t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "";
    	let t14;
    	let t15;
    	let p5;
    	let t16;
    	let t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "";
    	let t17;
    	let t18;
    	let p6;
    	let t19;
    	let t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "";
    	let t20;
    	let t21;
    	let p7;
    	let t22;
    	let t23_value = /*item*/ ctx[4].Age65 + "";
    	let t23;
    	let t24;

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text("Annual Tax Savings: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Savings @ Curr. Int. Rate: ");
    			t4 = text(t4_value);
    			t5 = text("%");
    			t6 = space();
    			p2 = element("p");
    			t7 = text("Proj. Tax Refund: ");
    			t8 = text(t8_value);
    			t9 = space();
    			p3 = element("p");
    			t10 = text("5 year: ");
    			t11 = text(t11_value);
    			t12 = space();
    			p4 = element("p");
    			t13 = text("10 year: ");
    			t14 = text(t14_value);
    			t15 = space();
    			p5 = element("p");
    			t16 = text("15 year: ");
    			t17 = text(t17_value);
    			t18 = space();
    			p6 = element("p");
    			t19 = text("20 year: ");
    			t20 = text(t20_value);
    			t21 = space();
    			p7 = element("p");
    			t22 = text("Age 65: ");
    			t23 = text(t23_value);
    			t24 = space();
    			attr(div, "class", "projected2-vs-current");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(p0, t1);
    			append(div, t2);
    			append(div, p1);
    			append(p1, t3);
    			append(p1, t4);
    			append(p1, t5);
    			append(div, t6);
    			append(div, p2);
    			append(p2, t7);
    			append(p2, t8);
    			append(div, t9);
    			append(div, p3);
    			append(p3, t10);
    			append(p3, t11);
    			append(div, t12);
    			append(div, p4);
    			append(p4, t13);
    			append(p4, t14);
    			append(div, t15);
    			append(div, p5);
    			append(p5, t16);
    			append(p5, t17);
    			append(div, t18);
    			append(div, p6);
    			append(p6, t19);
    			append(p6, t20);
    			append(div, t21);
    			append(div, p7);
    			append(p7, t22);
    			append(p7, t23);
    			append(div, t24);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$projected2_tax_info, $current_tax_info*/ 5 && t1_value !== (t1_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].NetTakeHomePay - /*$current_tax_info*/ ctx[0][0].NetTakeHomePay) + "")) set_data(t1, t1_value);
    			if (dirty & /*$projected2_tax_info, $current_tax_info*/ 5 && t4_value !== (t4_value = (/*item*/ ctx[4].PercentPreTax - /*$current_tax_info*/ ctx[0][0].PercentPreTax).toFixed(2) + "")) set_data(t4, t4_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t8_value !== (t8_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].ProjTaxRefund) + "")) set_data(t8, t8_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t11_value !== (t11_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 5) + "")) set_data(t11, t11_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t14_value !== (t14_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 10) + "")) set_data(t14, t14_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t17_value !== (t17_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 15) + "")) set_data(t17, t17_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t20_value !== (t20_value = /*toCurrency*/ ctx[3].format(/*item*/ ctx[4].TSA * 20) + "")) set_data(t20, t20_value);
    			if (dirty & /*$projected2_tax_info*/ 4 && t23_value !== (t23_value = /*item*/ ctx[4].Age65 + "")) set_data(t23, t23_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let h2;
    	let t1;
    	let div3;
    	let div0;
    	let h40;
    	let t3;
    	let t4;
    	let div1;
    	let h41;
    	let t6;
    	let t7;
    	let div2;
    	let h42;
    	let t9;
    	let each_value_2 = /*$current_tax_info*/ ctx[0];
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*$projected1_tax_info*/ ctx[1];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*$projected2_tax_info*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Combined Summary";
    			t1 = space();
    			div3 = element("div");
    			div0 = element("div");
    			h40 = element("h4");
    			h40.innerHTML = `<u>Current</u>`;
    			t3 = space();

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t4 = space();
    			div1 = element("div");
    			h41 = element("h4");
    			h41.textContent = "Projected 1";
    			t6 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t7 = space();
    			div2 = element("div");
    			h42 = element("h4");
    			h42.textContent = "Projected 2";
    			t9 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "class", "combined-current svelte-1g93cef");
    			set_style(div0, "background-color", "gray");
    			attr(div1, "class", "combined-projected1 svelte-1g93cef");
    			set_style(div1, "background-color", "lightblue");
    			attr(div2, "class", "combined-projected2 svelte-1g93cef");
    			set_style(div2, "background-color", "lightcoral");
    			attr(div3, "class", "combined-container svelte-1g93cef");
    			set_style(div3, "background-color", "lightgray");
    			set_style(div3, "border", "2px solid black");
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			insert(target, div3, anchor);
    			append(div3, div0);
    			append(div0, h40);
    			append(div0, t3);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div0, null);
    			}

    			append(div3, t4);
    			append(div3, div1);
    			append(div1, h41);
    			append(div1, t6);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append(div3, t7);
    			append(div3, div2);
    			append(div2, h42);
    			append(div2, t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$current_tax_info, toCurrency*/ 9) {
    				each_value_2 = /*$current_tax_info*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_2.length;
    			}

    			if (dirty & /*$projected1_tax_info, toCurrency, $current_tax_info*/ 11) {
    				each_value_1 = /*$projected1_tax_info*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*$projected2_tax_info, toCurrency, $current_tax_info*/ 13) {
    				each_value = /*$projected2_tax_info*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (detaching) detach(div3);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $current_tax_info;
    	let $projected1_tax_info;
    	let $projected2_tax_info;
    	component_subscribe($$self, current_tax_info, $$value => $$invalidate(0, $current_tax_info = $$value));
    	component_subscribe($$self, projected1_tax_info, $$value => $$invalidate(1, $projected1_tax_info = $$value));
    	component_subscribe($$self, projected2_tax_info, $$value => $$invalidate(2, $projected2_tax_info = $$value));

    	const toCurrency = new Intl.NumberFormat("en-US",
    	{
    			style: "currency",
    			currency: "USD",
    			minimumFractionDigits: 2
    		});

    	set_store_value(current_tax_info, $current_tax_info[0].PercentPreTax = $current_tax_info[0].TSA / $current_tax_info[0].grossIncome * 100, $current_tax_info);
    	set_store_value(projected1_tax_info, $projected1_tax_info[0].PercentPreTax = $projected1_tax_info[0].TSA / $projected1_tax_info[0].grossIncome * 100, $projected1_tax_info);
    	set_store_value(projected2_tax_info, $projected2_tax_info[0].PercentPreTax = $projected2_tax_info[0].TSA / $projected2_tax_info[0].grossIncome * 100, $projected2_tax_info);
    	return [$current_tax_info, $projected1_tax_info, $projected2_tax_info, toCurrency];
    }

    class Combined extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1g93cef-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\app.svelte generated by Svelte v3.35.0 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-1qrvjpk-style";
    	style.textContent = ".logo.svelte-1qrvjpk.svelte-1qrvjpk{position:absolute;margin:0% auto;width:90%;padding:4% 5%;z-index:-1}.logo.svelte-1qrvjpk img.svelte-1qrvjpk{opacity:0.4;width:100%}.Nav.svelte-1qrvjpk.svelte-1qrvjpk{padding:3px}.disclaimer-containter.svelte-1qrvjpk.svelte-1qrvjpk{width:100%;padding:5px;margin-top:20px}.actions-to-take.svelte-1qrvjpk.svelte-1qrvjpk{margin-top:10px}@media print{.Nav.svelte-1qrvjpk.svelte-1qrvjpk{display:none}}@media(orientation: landscape){@media print{.logo.svelte-1qrvjpk.svelte-1qrvjpk{width:100%;padding:0;height:95%}.disclaimer-containter.svelte-1qrvjpk.svelte-1qrvjpk{width:100%;top:0;left:0;margin:0}}}@media(orientation: portrait){@media print{.logo.svelte-1qrvjpk.svelte-1qrvjpk{margin:50% auto}.disclaimer-containter.svelte-1qrvjpk.svelte-1qrvjpk{width:100%;top:0;left:0;margin:0}}}";
    	append(document.head, style);
    }

    function create_fragment(ctx) {
    	let div0;
    	let t0;
    	let div1;
    	let topnav;
    	let t1;
    	let div2;
    	let pdftable;
    	let t2;
    	let div3;
    	let disclaimer;
    	let t3;
    	let div4;
    	let taxform;
    	let t4;
    	let div5;
    	let combinedsummary;
    	let t5;
    	let div6;
    	let actionstotake;
    	let current;
    	topnav = new Top_nav({ props: { onChange: /*func*/ ctx[1] } });
    	pdftable = new Pdf_table({});
    	disclaimer = new Disclaimer({});

    	taxform = new Tax_form({
    			props: {
    				selectedVariation: /*selectedVariation*/ ctx[0]
    			}
    		});

    	combinedsummary = new Combined({});
    	actionstotake = new Actions_to_take({});

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<img src="src/logo/logo.png" alt="Nature" class="responsive svelte-1qrvjpk" width="50%" height="80%"/>`;
    			t0 = space();
    			div1 = element("div");
    			create_component(topnav.$$.fragment);
    			t1 = space();
    			div2 = element("div");
    			create_component(pdftable.$$.fragment);
    			t2 = space();
    			div3 = element("div");
    			create_component(disclaimer.$$.fragment);
    			t3 = space();
    			div4 = element("div");
    			create_component(taxform.$$.fragment);
    			t4 = space();
    			div5 = element("div");
    			create_component(combinedsummary.$$.fragment);
    			t5 = space();
    			div6 = element("div");
    			create_component(actionstotake.$$.fragment);
    			attr(div0, "class", "logo svelte-1qrvjpk");
    			attr(div1, "class", "Nav svelte-1qrvjpk");
    			attr(div2, "class", "PDFTable");
    			attr(div3, "class", "disclaimer-containter svelte-1qrvjpk");
    			attr(div4, "class", "tax-app");
    			attr(div5, "id", "combined-tax-summary");
    			div5.hidden = true;
    			attr(div6, "class", "actions-to-take svelte-1qrvjpk");
    			div6.hidden = true;
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			mount_component(topnav, div1, null);
    			insert(target, t1, anchor);
    			insert(target, div2, anchor);
    			mount_component(pdftable, div2, null);
    			insert(target, t2, anchor);
    			insert(target, div3, anchor);
    			mount_component(disclaimer, div3, null);
    			insert(target, t3, anchor);
    			insert(target, div4, anchor);
    			mount_component(taxform, div4, null);
    			insert(target, t4, anchor);
    			insert(target, div5, anchor);
    			mount_component(combinedsummary, div5, null);
    			insert(target, t5, anchor);
    			insert(target, div6, anchor);
    			mount_component(actionstotake, div6, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const topnav_changes = {};
    			if (dirty & /*selectedVariation*/ 1) topnav_changes.onChange = /*func*/ ctx[1];
    			topnav.$set(topnav_changes);
    			const taxform_changes = {};
    			if (dirty & /*selectedVariation*/ 1) taxform_changes.selectedVariation = /*selectedVariation*/ ctx[0];
    			taxform.$set(taxform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(topnav.$$.fragment, local);
    			transition_in(pdftable.$$.fragment, local);
    			transition_in(disclaimer.$$.fragment, local);
    			transition_in(taxform.$$.fragment, local);
    			transition_in(combinedsummary.$$.fragment, local);
    			transition_in(actionstotake.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(topnav.$$.fragment, local);
    			transition_out(pdftable.$$.fragment, local);
    			transition_out(disclaimer.$$.fragment, local);
    			transition_out(taxform.$$.fragment, local);
    			transition_out(combinedsummary.$$.fragment, local);
    			transition_out(actionstotake.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t0);
    			if (detaching) detach(div1);
    			destroy_component(topnav);
    			if (detaching) detach(t1);
    			if (detaching) detach(div2);
    			destroy_component(pdftable);
    			if (detaching) detach(t2);
    			if (detaching) detach(div3);
    			destroy_component(disclaimer);
    			if (detaching) detach(t3);
    			if (detaching) detach(div4);
    			destroy_component(taxform);
    			if (detaching) detach(t4);
    			if (detaching) detach(div5);
    			destroy_component(combinedsummary);
    			if (detaching) detach(t5);
    			if (detaching) detach(div6);
    			destroy_component(actionstotake);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $current_tax_info;
    	let $projected1_tax_info;
    	let $projected2_tax_info;
    	component_subscribe($$self, current_tax_info, $$value => $$invalidate(2, $current_tax_info = $$value));
    	component_subscribe($$self, projected1_tax_info, $$value => $$invalidate(3, $projected1_tax_info = $$value));
    	component_subscribe($$self, projected2_tax_info, $$value => $$invalidate(4, $projected2_tax_info = $$value));
    	let selectedVariation;
    	set_store_value(current_tax_info, $current_tax_info = [], $current_tax_info);

    	set_store_value(
    		current_tax_info,
    		$current_tax_info = [
    			...$current_tax_info,
    			{
    				GrossIncome: 0,
    				FillingStatus: "",
    				AGITax: 0,
    				Sect125: 0,
    				TSA: 0,
    				PercentPreTax: 0,
    				StandardDeduction: 0,
    				isScheduleADeduction: false,
    				ScheduleA: 0,
    				Over65Deduction: 0,
    				NetTaxableInc: 0,
    				WithHoldingTax: 0,
    				FICA: 0,
    				MISC: 0,
    				NonTSASavings: 0,
    				NetTakeHomePay: 0,
    				ProjTaxRefund: 0,
    				Age65: 0
    			}
    		],
    		$current_tax_info
    	);

    	set_store_value(projected1_tax_info, $projected1_tax_info = [], $projected1_tax_info);

    	set_store_value(
    		projected1_tax_info,
    		$projected1_tax_info = [
    			...$projected1_tax_info,
    			{
    				GrossIncome: 0,
    				FillingStatus: "",
    				AGITax: 0,
    				Sect125: 0,
    				TSA: 0,
    				PercentPreTax: 0,
    				StandardDeduction: 0,
    				isScheduleADeduction: false,
    				ScheduleA: 0,
    				Over65Deduction: 0,
    				NetTaxableInc: 0,
    				WithHoldingTax: 0,
    				FICA: 0,
    				MISC: 0,
    				NonTSASavings: 0,
    				NetTakeHomePay: 0,
    				ProjTaxRefund: 0,
    				Age65: 0
    			}
    		],
    		$projected1_tax_info
    	);

    	set_store_value(projected2_tax_info, $projected2_tax_info = [], $projected2_tax_info);

    	set_store_value(
    		projected2_tax_info,
    		$projected2_tax_info = [
    			...$projected2_tax_info,
    			{
    				GrossIncome: 0,
    				FillingStatus: "",
    				AGITax: 0,
    				Sect125: 0,
    				TSA: 0,
    				PercentPreTax: 0,
    				StandardDeduction: 0,
    				isScheduleADeduction: false,
    				ScheduleA: 0,
    				Over65Deduction: 0,
    				NetTaxableInc: 0,
    				WithHoldingTax: 0,
    				FICA: 0,
    				MISC: 0,
    				NonTSASavings: 0,
    				NetTakeHomePay: 0,
    				ProjTaxRefund: 0,
    				Age65: 0
    			}
    		],
    		$projected2_tax_info
    	);

    	const func = newValue => $$invalidate(0, selectedVariation = newValue);
    	return [selectedVariation, func];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-1qrvjpk-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
      props: {
        name: 'App',
      },
    });

    return app;

}());
