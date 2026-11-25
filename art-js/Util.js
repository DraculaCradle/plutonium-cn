import {DomUtil} from "./DomUtil.js";

class SortUtil {
	static ascSort (a, b) {
		if (b === a) return 0;
		return b < a ? 1 : -1;
	}

	static ascSortLower (a, b) { return SortUtil.ascSort((a || "").toLowerCase(), (b || "").toLowerCase()); }
}

class MiscUtil {
	static copy (obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	static async pCopyTextToClipboard (text) {
		if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

		const temp = DomUtil.veT`<textarea id="copy-temp" style="position: fixed; top: -1000px; left: -1000px; width: 1px; height: 1px;"></textarea>`;
		temp.value = text;
		document.body.append(temp);
		temp.select();
		document.execCommand("Copy");
		temp.remove();
	}

	static showCopiedEffect (ele, text = "Copied!") {
		const temp = DomUtil.veT`<div class="ve-copied-tip"><span>${text}</span></div>`;
		document.body.append(temp);

		const pos = ele.getBoundingClientRect();
		const tempPos = temp.getBoundingClientRect();

		Object.assign(temp.style, {
			top: `${pos.top - tempPos.height}px`,
			left: `${pos.left - (tempPos.width / 2) + (pos.width / 2)}px`,
			transition: "top 250ms, opacity 250ms",
		});

		requestAnimationFrame(() => {
			temp.style.top = `${pos.top - tempPos.height - 8}px`;
			temp.style.opacity = "0.5";
		});

		setTimeout(() => temp.remove(), 250);
	}

	static pDelay (msecs, resolveAs) {
		return new Promise(resolve => setTimeout(() => resolve(resolveAs), msecs));
	}

	/**
	 * Borrowed from lodash.
	 *
	 * @param func The function to debounce.
	 * @param wait Minimum duration between calls.
	 * @param options Options object.
	 * @return {Function} The debounced function.
	 */
	static debounce (func, wait, options) {
		let lastArgs; let lastThis; let maxWait; let result; let timerId; let lastCallTime; let lastInvokeTime = 0; let leading = false; let maxing = false; let trailing = true;

		wait = Number(wait) || 0;
		if (typeof options === "object") {
			leading = !!options.leading;
			maxing = "maxWait" in options;
			maxWait = maxing ? Math.max(Number(options.maxWait) || 0, wait) : maxWait;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		function invokeFunc (time) {
			let args = lastArgs; let thisArg = lastThis;

			lastArgs = lastThis = undefined;
			lastInvokeTime = time;
			result = func.apply(thisArg, args);
			return result;
		}

		function leadingEdge (time) {
			lastInvokeTime = time;
			timerId = setTimeout(timerExpired, wait);
			return leading ? invokeFunc(time) : result;
		}

		function remainingWait (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime; let result = wait - timeSinceLastCall;
			return maxing ? Math.min(result, maxWait - timeSinceLastInvoke) : result;
		}

		function shouldInvoke (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime;

			return (lastCallTime === undefined || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
		}

		function timerExpired () {
			const time = Date.now();
			if (shouldInvoke(time)) {
				return trailingEdge(time);
			}
			// Restart the timer.
			timerId = setTimeout(timerExpired, remainingWait(time));
		}

		function trailingEdge (time) {
			timerId = undefined;

			if (trailing && lastArgs) return invokeFunc(time);
			lastArgs = lastThis = undefined;
			return result;
		}

		function cancel () {
			if (timerId !== undefined) clearTimeout(timerId);
			lastInvokeTime = 0;
			lastArgs = lastCallTime = lastThis = timerId = undefined;
		}

		function flush () {
			return timerId === undefined ? result : trailingEdge(Date.now());
		}

		function debounced () {
			let time = Date.now(); let isInvoking = shouldInvoke(time);
			lastArgs = arguments;
			lastThis = this;
			lastCallTime = time;

			if (isInvoking) {
				if (timerId === undefined) return leadingEdge(lastCallTime);
				if (maxing) {
					// Handle invocations in a tight loop.
					timerId = setTimeout(timerExpired, wait);
					return invokeFunc(lastCallTime);
				}
			}
			if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
			return result;
		}

		debounced.cancel = cancel;
		debounced.flush = flush;
		return debounced;
	}

	// from lodash
	static throttle (func, wait, options) {
		let leading = true; let trailing = true;

		if (typeof options === "object") {
			leading = "leading" in options ? !!options.leading : leading;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		return this.debounce(func, wait, {leading, maxWait: wait, trailing});
	}
}

class StorageUtil {
	static _getSyncStorage () {
		if (StorageUtil._init) {
			if (StorageUtil.__fakeStorage) return StorageUtil._fakeStorage;
			else return window.localStorage;
		}

		StorageUtil._init = true;
		try {
			window.localStorage.setItem("_test_storage", true);
			return window.localStorage;
		} catch (e) {
			// if the user has disabled cookies, build a fake version
			StorageUtil.__fakeStorage = true;
			StorageUtil._fakeStorage = {
				isSyncFake: true,
				getItem: k => StorageUtil.__fakeStorage[k],
				removeItem: k => delete StorageUtil.__fakeStorage[k],
				setItem: (k, v) => StorageUtil.__fakeStorage[k] = v,
			};
			return StorageUtil._fakeStorage;
		}
	}

	// region Synchronous
	static syncGet (key) {
		const rawOut = StorageUtil._getSyncStorage().getItem(key);
		if (rawOut && rawOut !== "undefined" && rawOut !== "null") return JSON.parse(rawOut);
		return null;
	}

	static syncSet (key, value) {
		StorageUtil._getSyncStorage().setItem(key, JSON.stringify(value));
	}

	static syncRemove (key) {
		StorageUtil._getSyncStorage().removeItem(key);
	}
	// endregion
}
StorageUtil._init = false;
StorageUtil._fakeStorage = {};

export {SortUtil, MiscUtil, StorageUtil};
