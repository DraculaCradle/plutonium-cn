export class DomUtil {
	static _ATTRS_NO_FALSY = new Set([
		"checked",
		"disabled",
		"readonly",
		"title",
	]);

	static veT (...allArgs) {
		return this.getTemplated(...allArgs);
	}

	static getTemplated (...allArgs) {
		if (!allArgs.length) throw new TypeError(`"veT" called with no arguments!`);

		const [parts, ...args] = allArgs;

		if (parts == null) throw new TypeError(`"veT" called with "${parts}" as first argument!`);

		if (parts instanceof Node) {
			return (...passed) => {
				const parts2 = [...passed[0]];
				const args2 = passed.slice(1);
				parts2[0] = `<div>${parts2[0]}`;
				parts2.last(`${parts2.at(-1)}</div>`);

				const eleTmp = DomUtil.veT(parts2, ...args2);
				Array.from(eleTmp.childNodes).forEach(node => parts.appendChild(node));

				return DomUtil.veE({ele: parts});
			};
		}

		const eles = [];
		let ixArg = 0;

		const raw = parts
			.reduce((html, p, ix) => {
				// Initial `.reduce` `ix` is 1
				if (ix === 1) html = html.trimStart();
				// ...and final `ix` is actually-final-index + 1
				if (ix === parts.length) html = html.trimEnd();

				const myIxArg = ixArg++;
				if (args[myIxArg] == null) return `${html}${p}`;
				if (args[myIxArg] instanceof Array) return `${html}${args[myIxArg].map(arg => DomUtil._getTemplatedHandleArg(eles, arg)).join("")}${p}`;
				else return `${html}${DomUtil._getTemplatedHandleArg(eles, args[myIxArg])}${p}`;
			});

		const eleTmpTemplate = document.createElement("template");
		eleTmpTemplate.innerHTML = raw.trim();
		const {content: eleTmp} = eleTmpTemplate;

		if (!eleTmp.children.length) throw new Error(`Failed to create HTML element(s) from "${raw}"!`);

		Array.from(eleTmp.querySelectorAll(".ve-tpl-r"))
			.forEach((node, i) => node.replaceWith(eles[i]));

		const childNodes = Array.from(eleTmp.childNodes);
		childNodes.forEach(node => document.adoptNode(node));

		// If the caller has passed in a single element, return it
		if (childNodes.length === 1) return DomUtil.veE({ele: childNodes[0]});

		// If the caller has passed in multiple elements with no wrapper, return a fragment
		const fragment = document.createDocumentFragment();
		childNodes
			.forEach(childNode => fragment.appendChild(DomUtil.veE({ele: childNode})));
		return fragment;
	}

	static _getTemplatedHandleArg (eles, arg) {
		if (arg instanceof Node) {
			eles.push(arg);
			// Use a class for performance
			return `<${arg.tagName} class="ve-tpl-r"></${arg.tagName}>`;
		}

		return arg;
	}

	static veE (opts) {
		if (!opts) return null;
		if (opts instanceof Element) opts = {ele: opts};

		const {
			tag,
			clazz,
			style,
			click,
			contextmenu,
			change,
			mousedown,
			mouseup,
			mousemove,
			pointerdown,
			pointerup,
			keydown,
			html,
			txt,
			children,
			outer,

			id,
			name,
			title,
			val,
			href,
			type,
			tabindex,
			value,
			placeholder,
			attrs,
			data,
		} = opts;
		let {
			ele,
		} = opts;

		const metaEle = DomUtil._getOrModifyGetEle({
			ele,
			outer,
			tag,
			id,
		});
		ele = metaEle.ele;

		if (clazz) ele.className = clazz;
		if (style) ele.setAttribute("style", style);
		if (click) ele.addEventListener("click", click);
		if (contextmenu) ele.addEventListener("contextmenu", contextmenu);
		if (change) ele.addEventListener("change", change);
		if (mousedown) ele.addEventListener("mousedown", mousedown);
		if (mouseup) ele.addEventListener("mouseup", mouseup);
		if (mousemove) ele.addEventListener("mousemove", mousemove);
		if (pointerdown) ele.addEventListener("pointerdown", pointerdown);
		if (pointerup) ele.addEventListener("pointerup", pointerup);
		if (keydown) ele.addEventListener("keydown", keydown);
		if (html != null) ele.innerHTML = html;
		if (txt != null) {
			if (ele instanceof HTMLOptionElement) ele.text = txt;
			else ele.textContent = txt;
		}
		if (id != null && metaEle.isSetId) ele.setAttribute("id", id);
		if (name != null) ele.setAttribute("name", name);
		if (title != null) ele.setAttribute("title", title);
		if (href != null) ele.setAttribute("href", href);
		if (val != null) ele.setAttribute("value", val);
		if (type != null) ele.setAttribute("type", type);
		if (tabindex != null) ele.setAttribute("tabindex", tabindex);
		if (value != null) ele.setAttribute("value", value);
		if (placeholder != null) ele.setAttribute("placeholder", placeholder);

		if (attrs != null) {
			for (const k in attrs) {
				if (attrs[k] === undefined) continue;
				if (!attrs[k] && DomUtil._ATTRS_NO_FALSY.has(k)) continue;
				ele.setAttribute(k, attrs[k]);
			}
		}

		if (data != null) {
			for (const k in data) {
				if (data[k] === undefined) continue;
				ele.dataset[k] = data[k];
			}
		}

		if (children) for (let i = 0, len = children.length; i < len; ++i) if (children[i] != null) ele.append(children[i]);

		DomUtil._bindArtre(ele);

		return ele;
	}

	static _bindArtre (ele) {
		if (ele.artre) return ele;

		Object.defineProperty(ele, "artre", {
			configurable: true,
			enumerable: false,
			writable: true,
			value: {
				empty: DomUtil._empty.bind(ele),
				show: DomUtil._show.bind(ele),
				hide: DomUtil._hide.bind(ele),
				toggle: DomUtil._toggle.bind(ele),
			},
		});

		return ele;
	}

	static _getOrModifyGetEle (
		{
			ele,
			outer,
			tag,
			id,
		},
	) {
		if (ele) return {ele, isSetId: true};
		if (outer) {
			const eleTmpTemplate = document.createElement("template");
			eleTmpTemplate.innerHTML = outer.trim();
			const {content: eleTmp} = eleTmpTemplate;
			if (eleTmp.childNodes.length !== 1) throw new Error(`Failed to create exactly one DOM element from HTML "${outer}"!`);
			return {ele: eleTmp.childNodes[0], isSetId: true};
		}
		if (tag) return {ele: document.createElement(tag), isSetId: true};
		if (id) {
			const eleId = document.getElementById(id);
			if (!eleId) throw new Error(`Could not find element with ID "${id}"`);
			return {ele: eleId, isSetId: false};
		}
		throw new Error(`Could not find or create element!`);
	}

	static _empty () {
		this.innerHTML = "";
		return this;
	}

	static _show () {
		this.classList.remove("ve-hidden");
		return this;
	}

	static _hide () {
		this.classList.add("ve-hidden");
		return this;
	}

	static _toggle (isActive = null) {
		if (isActive == null) this.classList.toggle("ve-hidden");
		else this.classList.toggle("ve-hidden", !isActive);
		return this;
	}

	static veEs (selector, parent) {
		const ele = (parent || document).querySelector(selector);
		if (!ele) return null;
		return DomUtil.veE({ele});
	}

	static veEm (selector, parent) {
		return [...(parent || document).querySelectorAll(selector)]
			.map(ele => DomUtil.veE({ele}));
	}
}
