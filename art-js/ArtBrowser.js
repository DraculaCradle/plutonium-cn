import {Const} from "./Const.js";
import {MiscUtil, SortUtil, StorageUtil} from "./Util.js";
import {DomUtil} from "./DomUtil.js";
import {DownloadHelper} from "./DownloadHelper.js";

export class ArtBrowser {
	static _JSON_CACHE = {};
	static _JSON_FETCHING = {};
	static _ID_STYLE_THUMBNAILS = "artr__style__thumbnails";
	static _SZ_PX_MAIN_ROW_HEADER = 18;
	static _SZ_PX_THUMBNAIL = 180;
	static _STORAGE_KEY_THUMBNAIL_SIZE = "artr__style__thumbnails";

	static async pGetJson (url) {
		if (ArtBrowser._JSON_FETCHING[url]) {
			await ArtBrowser._JSON_FETCHING[url];
			return ArtBrowser._JSON_CACHE[url];
		}

		ArtBrowser._JSON_FETCHING[url] = (async () => {
			const response = await fetch(url);
			ArtBrowser._JSON_CACHE[url] = await response.json();
		})();

		await ArtBrowser._JSON_FETCHING[url];
		return ArtBrowser._JSON_CACHE[url];
	}

	static _searchFeatures (searchTerm, item, doLowercase) {
		// features are lowercase in index
		return (item.features || []).some(x => (doLowercase ? x.toLowerCase() : x).includes(searchTerm));
	}

	static _filterProps (filters, item) {
		if (Object.keys(filters).length) {
			const missingOrUnwanted = Object.keys(filters).find(prop => {
				if (!item[prop]) return true;
				const requiredVals = Object.keys(filters[prop]).filter(k => filters[prop][k]);
				const missingEnum = !!requiredVals.find(x => !item[prop].includes(x));
				const excludedVals = Object.keys(filters[prop]).filter(k => !filters[prop][k]);
				const unwantedEnum = !!excludedVals.find(x => item[prop].includes(x));
				return missingEnum || unwantedEnum;
			});
			if (missingOrUnwanted) return false;
		}
		return true;
	}

	static _filterFakeProps (filterStorage, item, filterProp, prop) {
		const filterState = filterStorage[filterProp];
		const key = item[prop];

		// There can only be one artist or set (the two "fake" filter properties) per item, so return true if:
		//  - the entire filter is white (i.e. the filter is inactive)
		//  - our value is blue (i.e. the filter is inactive, but our value is selected)
		if (filterState && Object.keys(filterState).length) return filterState[key];
		else return true;
	}

	constructor (eleParent) {
		this._eleParent = eleParent;
		this._eleParent.classList.add("artr__wrp");
		this._downloadHelper = new DownloadHelper(eleParent);

		this._index = null;

		this._currentItem = null;
		this._currentIndexItem = null;
		this._search = "";

		this._itemMetas = null;

		this._filtersArtists = {};
		this._filtersSets = {};
		this._filters = {};

		this._itemObservers = [];

		this._eleSideBody = null;
		this._eleMainBody = null;
		this._elesMainHeader = null;
		this._eleMainBodyInner = null;
		this._eleItemBody = null;
		this._eleItemBodyInner = null;
		this._eleNotificationBody = null;
		this._eleWrpBread = null;
	}

	_handleHashChange () {
		const key = window.location.hash.slice(1);
		if (key && this._index[key]) {
			const indexItem = this._index[key];

			ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)
				.then(file => {
					this._currentItem = file;
					this._currentIndexItem = indexItem;
					this._doRenderItem(true);
				});
		} else {
			this._doRenderIndex();
		}
	}

	_updateCrumbs () {
		DomUtil.veE(this._eleWrpBread).artre.empty();
		DomUtil.veT(this._eleWrpBread)`<a href="#" class="artr__crumb">Index</a>`;

		if (this._currentItem) {
			this._eleWrpBread.append(
				DomUtil.veT`<span class="artr__crumb--sep">/</span>`,
				DomUtil.veT`<a href="#${this._currentIndexItem._key}" class="artr__crumb">${this._currentItem.set} \u2013 ${this._currentItem.artist}</a>`,
			);
		}
	}

	/**
	 * Convert a search string of the form `"ship" "sea" "black powder"` to `["ship", "sea", "black powder"]`
	 */
	_getSearchTerms () {
		const str = this._search.toLowerCase().trim();

		const len = str.length;
		const out = [];
		let stack = "";
		let inQuotes = false;

		for (let i = 0; i < len; ++i) {
			const c = str[i];
			switch (c) {
				case `"`: {
					if (inQuotes && stack && stack.trim()) {
						out.push(stack.trim());
						stack = "";
					}
					inQuotes = !inQuotes;
					break;
				}
				default: stack += c;
			}
		}

		// handle remaining output
		if (stack && stack.trim()) out.push(stack.trim());

		return out;
	}

	_applyFilterAndSearchToIndex () {
		this._search = this._search.toLowerCase();

		// require the user to search or apply a filter before displaying any results
		if (Object.keys(this._filtersArtists).length === 0
			&& Object.keys(this._filtersSets).length === 0
			&& Object.keys(this._filters).length === 0
			&& this._search.replace(/"/g, "").length < 2) return [];

		return Object.values(this._index).filter(it => {
			if (this._search) {
				const searchTerms = this._getSearchTerms();

				const lowerSet = it._set.toLowerCase();
				const isSetMatch = searchTerms.every(srch => lowerSet.includes(srch));

				const lowerArtist = it._artist.toLowerCase();
				const isArtistMatch = searchTerms.every(srch => lowerArtist.includes(srch));

				const isFeatureMatch = searchTerms.every(srch => ArtBrowser._searchFeatures(srch, it));

				if (!isSetMatch && !isArtistMatch && !isFeatureMatch) return false;
			}
			if (!ArtBrowser._filterFakeProps(this._filtersArtists, it, Const.FAKE_FILTER_ARTIST, "_artist")) return false;
			if (!ArtBrowser._filterFakeProps(this._filtersSets, it, Const.FAKE_FILTER_SET, "_set")) return false;
			if (!ArtBrowser._filterProps(this._filters, it)) return false;
			return true;
		});
	}

	_doRenderIndex () {
		const indexSlice = this._applyFilterAndSearchToIndex();

		this._currentItem = false;
		this._currentIndexItem = false;
		DomUtil.veE(this._eleMainBody).artre.show();
		(this._elesMainHeader || []).forEach(it => DomUtil.veE(it).artre.show());
		DomUtil.veE(this._eleItemBody).artre.hide();
		DomUtil.veE(this._eleMainBodyInner).artre.empty();
		this._itemMetas = null;
		this._updateCrumbs();

		if (!indexSlice.length) {
			DomUtil.veT(this._eleMainBodyInner)`<div class="artr__no_results_wrp"><div class="artr__no_results"><div class="ve-text-center"><span class="artr__no_results_headline">No results found</span><br>Please adjust the filters (on the left) or refine your search (above).</div></div></div>`;
		} else {
			this._itemMetas = indexSlice.map(it => {
				const cbSel = DomUtil.veT`<input type="checkbox" class="ve-mr-2 artr__item__cb-select">`;
				cbSel.addEventListener("change", () => {
					itemBottom.classList.toggle("artr__item__bottom--selected", cbSel.checked);
				});

				let isExpanded = false;
				const btnToggleExpanded = DomUtil.veT`<div class="ve-clickable ve-mr-2 artr__item__btn-toggle-expand">[+]</div>`;
				btnToggleExpanded.addEventListener("click", () => {
					isExpanded = !isExpanded;
					btnToggleExpanded.classList.toggle("ve-active", isExpanded);
					itemTop.classList.toggle("artr__item__top--expanded", isExpanded);
					btnToggleExpanded.textContent = isExpanded ? "[\u2013]" : "[+]";
				});

				const dispName = DomUtil.veT`<div class="ve-clickable ve-mr-2">${it._set} <i>by</i> ${it._artist} (${it._size.toLocaleString()} images)</div>`;
				dispName.addEventListener("click", () => cbSel.checked = !cbSel.checked);

				const itemBottom = DomUtil.veT`<div class="artr__item__bottom ve-flex-v-center">
					${cbSel}
					${btnToggleExpanded}
					${dispName}
					<a href="#${it._key}" class="artr__item__lnk-view">View</a>
				</div>`;

				// Alternate version--avoid using this, as it just wastes bandwidth
				// ${it._sample.map(sample => `<img class="artr__item__thumbnail" src="${Const.GH_PATH}${it._key}--thumb-${sample}.jpg">`).join("")}
				const itemTop = DomUtil.veT`<div class="artr__item__top"><img src="${Const.IMG_LAZY_180}"></div>`;

				const item = DomUtil.veT`<div class="artr__item ve-flex-col">
					${itemBottom}
					${itemTop}
				</div>`;
				this._eleMainBodyInner.append(item);

				return {
					item,
					cbSel,
					fnHandleChangeCbAll: value => itemBottom.classList.toggle("artr__item__bottom--selected", value),
					key: it._key,
					fnOnIntersect: this._loadItemThumbnails.bind(this, itemTop, it._key),
				};
			});

			this._addScrollHandlers();
		}
	}

	_loadItemThumbnails (itemTop, key) {
		const indexItem = this._index[key];

		ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)
			.then(async file => {
				DomUtil.veE(itemTop).artre.empty();

				const intersectionMetas = [];

				file.data.sort((a, b) => SortUtil.ascSortLower(a.uri, b.uri));

				for (const it of file.data) {
					const img = DomUtil.veT`<img class="artr__item__thumbnail" src="${Const.IMG_LAZY_180}">`;
					const urlThumb = `${Const.GH_PATH}${indexItem._key}--thumb-${it.hash}.jpg`;

					const btns = await this._pGetBtnsItemThumbnail(it);

					const lnk = DomUtil.veT`<a href="${it.uri}" target="_blank" class="artr__item__lnk-fullsize" draggable="true">${img}</a>`;
					lnk.addEventListener("dragstart", evt => {
						const meta = {
							type: "ve-Art",
							uri: it.uri,
						};
						evt.dataTransfer.setData("application/json", JSON.stringify(meta));
					});

					DomUtil.veT(itemTop)`<div class="artr__item__wrp ve-relative">
						${lnk}
						<div class="artr__item__menu">${btns}</div>
					</div>`;

					intersectionMetas.push({eleImg: img, urlThumb});
				}

				this._addHorizontalScrollHandler(intersectionMetas);
			});
	}

	async _pGetBtnsItemThumbnail (meta) {
		const btnCopyUrl = DomUtil.veT`<div class="artr__item__menu_item" title="Copy URL"><span class="fas fa-link"></span></div>`;
		btnCopyUrl.addEventListener("click", async (evt) => {
			evt.stopPropagation();
			evt.preventDefault();

			await MiscUtil.pCopyTextToClipboard(meta.uri);
			MiscUtil.showCopiedEffect(btnCopyUrl, "Copied URL!");
		});

		const btnSupport = meta.support
			? DomUtil.veT`<a class="artr__item__menu_item" href="${meta.support}" target="_blank" title="Support Artist"><span class="fas fa-cart-shopping"></span></a>`
			: null;

		return [btnCopyUrl, btnSupport];
	}

	_doRenderItem (resetScroll) {
		DomUtil.veE(this._eleMainBody).artre.hide();
		(this._elesMainHeader || []).forEach(it => DomUtil.veE(it).artre.hide());
		DomUtil.veE(this._eleItemBody).artre.show();
		DomUtil.veE(this._eleItemBodyInner).artre.empty();
		this._updateCrumbs();
		if (resetScroll) this._eleItemBodyInner.scrollTop = 0;

		const eles = this._currentItem.data
			.sort((a, b) => SortUtil.ascSortLower(a.uri, b.uri))
			.map(it => {
				const urlThumb = `${Const.GH_PATH}${this._currentIndexItem._key}--thumb-${it.hash}.jpg`;

				const btnCopyUrl = DomUtil.veT`<div class="artr__item__menu_item" title="Copy URL"><span class="fas fa-link"></span></div>`;
				btnCopyUrl.addEventListener("click", async (evt) => {
					evt.stopPropagation();
					evt.preventDefault();

					await MiscUtil.pCopyTextToClipboard(it.uri);
					MiscUtil.showCopiedEffect(btnCopyUrl, "Copied URL!");
				});

				const btnSupport = it.support
					? DomUtil.veT`<a class="artr__item__menu_item" href="${it.support}" target="_blank" title="Support Artist"><span class="fas fa-cart-shopping"></span></a>`
					: null;

				const lnk = DomUtil.veT`<a href="${it.uri}" target="_blank" class="artr__item__lnk-fullsize" draggable="true">
					<img class="artr__item__thumbnail" src="${urlThumb}">
				</a>`;
				lnk.addEventListener("dragstart", evt => {
					const meta = {
						type: "ve-Art",
						uri: it.uri,
					};
					evt.dataTransfer.setData("application/json", JSON.stringify(meta));
				});

				return DomUtil.veT`<div class="artr__item__wrp ve-relative">
					${lnk}
					<div class="artr__item__menu">${btnCopyUrl}${btnSupport}</div>
				</div>`;
			});

		const wrpItem = DomUtil.veT`<div class="artr__item__top artr__item__top--expanded artr__item__top--expanded-sub-page">
			${eles}
		</div>`;

		const btnDownload = DomUtil.veT`<button class="artr__btn-lg artr__btn-primary">Download</button>`;
		btnDownload.addEventListener("click", () => this._pHandleDownloadClick([this._currentIndexItem], {isSingleMode: true}));

		DomUtil.veT(this._eleItemBodyInner)`<div class="ve-flex-col ve-w-100 ve-h-100">
			<div class="artr__item__bottom ve-flex-v-center">
				<div class="ve-mr-2">${this._currentIndexItem._set} <i>by</i> ${this._currentIndexItem._artist} (${(this._currentIndexItem._size || 0).toLocaleString()} images)</div>
				${btnDownload}
			</div>
			${wrpItem}
		</div>`;
	}

	_addSidebarSection (propOrHeader, values, filterStorage, fnSort, ix) {
		const isInitialShowing = !ix; // hide all but first (real) section by default

		const fullName = (() => {
			switch (propOrHeader) {
				case "imageType": return "Image Type";
				case "grid": return "Grid Type";
				case "monster": return "Monster Type";
				case "audience": return "Intended Audience";
				default: return propOrHeader.uppercaseFirst();
			}
		})();

		const dispToggle = DomUtil.veT`<div>${isInitialShowing ? "[\u2013]" : "[+]"}</div>`;
		const wrpHead = DomUtil.veT`<div class="artr__side__tag_header ve-mb-1">
			<div>${fullName}</div>
			${dispToggle}
		</div>`;
		this._eleSideBody.append(wrpHead);
		wrpHead.addEventListener("click", () => {
			DomUtil.veE(wrpBody).artre.toggle();
			dispToggle.innerHTML = dispToggle.innerHTML === "[+]" ? "[\u2013]" : "[+]";
		});

		const getNextState = (state, dir) => {
			const ix = Const.STATES.indexOf(state) + dir;
			if (ix > Const.STATES.length - 1) return Const.STATES[0];
			if (ix < 0) return Const.STATES.last();
			return Const.STATES[ix];
		};

		values.sort(fnSort);
		const btnMetas = values.map(enm => {
			const cycleState = dir => {
				const nxtState = getNextState(btn.dataset.state, dir);
				btn.dataset.state = nxtState;

				if (nxtState === "0") {
					delete filterStorage[propOrHeader][enm.v];
					if (!Object.keys(filterStorage[propOrHeader]).length) delete filterStorage[propOrHeader];
				} else (filterStorage[propOrHeader] = filterStorage[propOrHeader] || {})[enm.v] = nxtState === "1";

				this._handleHashChange();
			};

			const btn = DomUtil.veT`<button class="artr__side__tag" data-state="0">${enm.v} (${enm.c})</button>`;
			btn.addEventListener("click", () => cycleState(1));
			btn.addEventListener("contextmenu", (evt) => {
				if (!evt.ctrlKey) {
					evt.preventDefault();
					cycleState(-1);
				}
			});

			return {
				btn,
				searchText: (enm.v || "").trim().toLowerCase(),
			};
		});

		const iptSearch = DomUtil.veT`<input type="text" placeholder="Filter...">`;
		iptSearch.addEventListener("change", () => {
			const searchVal = iptSearch.value.trim().toLowerCase();

			if (!searchVal) btnMetas.forEach(it => DomUtil.veE(it.btn).artre.show());
			else btnMetas.forEach(it => DomUtil.veE(it.btn).artre.toggle(it.searchText.includes(searchVal)));
		});

		const wrpBody = DomUtil.veT`<div class="ve-flex-col">
			<div class="ve-pb-1 ve-px-1 artr__side__wrp-tag-filter">${iptSearch}</div>
			<div class="artr__side__tag-grid ve-pb-1 ve-mb-1">${btnMetas.map(it => it.btn)}</div>
		</div>`;
		DomUtil.veE(wrpBody).artre.toggle(isInitialShowing);
		this._eleSideBody.append(wrpBody);
	}

	_addFakeSidebarSection (title, propToCount, filterStorage) {
		const fakeValues = Object.keys(propToCount).sort(SortUtil.ascSort).map(it => ({v: it, c: propToCount[it]})); // [v]alue and [c]ount
		this._addSidebarSection(title, fakeValues, filterStorage, (a, b) => SortUtil.ascSortLower(a.v, b.v), true); // force minimize
	}

	async pInit () {
		const win = DomUtil.veT`<div class="artr__win"></div>`;
		this._eleParent.append(win);

		const dispLoadingSidebar = DomUtil.veT`<div class="artr__side__loading" title="Caching repository data, this may take some time">Loading...</div>`;

		const [enums, index] = await Promise.all([ArtBrowser.pGetJson(`${Const.GH_PATH}_meta_enums.json`), ArtBrowser.pGetJson(`${Const.GH_PATH}_meta_index.json`)]);
		this._index = index;

		Object.keys(this._index).forEach(k => this._index[k]._key = k);

		window.addEventListener("hashchange", this._handleHashChange.bind(this));

		// region sidebar
		const dispToggleSidebar = DomUtil.veT`<div>[\u2013]</div>`;
		const sideHead = DomUtil.veT`<div class="artr__side__head ve-split-v-center ve-clickable">
			<div class="artr__side__head__title">Filters</div>
			${dispToggleSidebar}
		</div>`;
		sideHead.addEventListener("click", () => {
			dispToggleSidebar.innerHTML = dispToggleSidebar.innerHTML === "[+]" ? "[\u2013]" : "[+]";
			sidebar.classList.toggle("artr__side--minimized");
			DomUtil.veE(this._eleSideBody).artre.toggle();
		});

		this._eleSideBody = DomUtil.veT`<div class="artr__side__body"></div>`;

		const sidebar = DomUtil.veT`<div class="artr__side">
			${dispLoadingSidebar}

			${sideHead}
			${this._eleSideBody}
		</div>`;
		win.append(sidebar);

		// Index artists/sets, to make fake tag sections
		const artists = {};
		const sets = {};
		Object.values(this._index).forEach(it => {
			artists[it._artist] = artists[it._artist] || 0;
			artists[it._artist] += it._size;
			sets[it._set] = sets[it._set] || 0;
			sets[it._set] += it._size;
		});

		this._addFakeSidebarSection(Const.FAKE_FILTER_ARTIST, artists, this._filtersArtists);
		this._addFakeSidebarSection(Const.FAKE_FILTER_SET, sets, this._filtersSets);
		Object.keys(enums).forEach((k, i) => this._addSidebarSection(k, enums[k], this._filters, (a, b) => SortUtil.ascSort(b.c, a.c), i));
		// endregion

		// region main
		const mainPane = DomUtil.veT`<div class="artr__main"></div>`;
		win.append(mainPane);

		const dispLoadingMain = DomUtil.veT`<div class="artr__main__loading" title="Caching repository data, this may take some time">Loading...</div>`;
		mainPane.append(dispLoadingMain);

		this._eleWrpBread = DomUtil.veT`<div class="artr__bread"></div>`;
		this._updateCrumbs();

		this._pInit_renderHeader({mainPane});

		this._eleMainBody = DomUtil.veT`<div class="artr__view"></div>`;
		mainPane.append(this._eleMainBody);
		this._eleMainBodyInner = DomUtil.veT`<div class="artr__view_inner"></div>`;
		this._eleMainBody.append(this._eleMainBodyInner);

		this._eleItemBody = DomUtil.veT`<div class="artr__view"></div>`;
		DomUtil.veE(this._eleItemBody).artre.hide();
		mainPane.append(this._eleItemBody);
		this._eleItemBodyInner = DomUtil.veT`<div class="artr__view_inner"></div>`;
		this._eleItemBody.append(this._eleItemBodyInner);

		this._eleNotificationBody = DomUtil.veT`<div class="artr__stg-notifs"></div>`;
		DomUtil.veE(this._eleNotificationBody).artre.hide();
		mainPane.append(this._eleNotificationBody);

		this._handleHashChange();

		[
			dispLoadingSidebar,
			dispLoadingMain,
		].forEach(ele => ele.remove());
		// endregion

		await this._pInit_pOnComplete();
	}

	/* -------------------------------------------- */

	_pInit_renderHeader ({mainPane}) {
		const cbAll = this._pInit_renderHeader_getCbAll();

		const btnDownloadSelected = this._pInit_renderHeader_getBtnDownloadSelected();

		const wrpHeaderControlsMain = DomUtil.veT`<div class="ve-flex-v-center ve-no-shrink">
			${cbAll}
			${btnDownloadSelected}
		</div>`;
		const spcHeaderControlsMain = DomUtil.veT`<div class="artr__search__divider ve-mx-2"></div>`;
		this._elesMainHeader = [wrpHeaderControlsMain, spcHeaderControlsMain];

		const iptSearch = this._pInit_renderHeader_getIptSearch();
		const sldThumbnailSize = this._pInit_renderHeader_getSldThumbnailSize();

		DomUtil.veT(mainPane)`<div class="ve-p-2 artr__search ve-flex-v-center">
			${wrpHeaderControlsMain}
			${spcHeaderControlsMain}
			<div class="ve-flex-col ve-w-100">
				${this._eleWrpBread}
				${iptSearch}
			</div>
			<div class="ve-flex-v-center ve-h-100">
				<div class="artr__search__divider ve-mx-2"></div>
				<div class="ve-flex-col ve-flex-vh-center">
					<div class="ve-mb-1">Thumbnail Size</div>
					${sldThumbnailSize}
				</div>
			</div>
			${this._pInit_renderHeader_getAdditionalElements()}
		</div>`;
	}

	_pInit_renderHeader_getCbAll () {
		const cbAll = DomUtil.veT`<input type="checkbox" class="ve-mr-2 artr__item__cb-select artr__item__cb-select--all">`;
		cbAll.addEventListener("change", () => {
			if (!this._itemMetas) return;
			const toVal = cbAll.checked;
			this._itemMetas.forEach(it => {
				it.cbSel.checked = toVal;
				it.fnHandleChangeCbAll(toVal);
			});
		});

		return cbAll;
	}

	_pInit_renderHeader_getBtnDownloadSelected () {
		const btnDownloadSelected = DomUtil.veT`<button class="artr__btn-lg artr__btn-primary" title="Download ZIP (SHIFT to download a text file of URLs)">Download Selected</button>`;
		btnDownloadSelected.addEventListener("click", () => {
			if (!this._itemMetas) return;
			const selected = this._itemMetas.filter(it => it.cbSel.checked);
			if (!selected.length) return alert(`Please select some items to download!`);
			const indexItems = selected.map(it => this._index[it.key]);
			return this._pHandleDownloadClick(indexItems);
		});
		return btnDownloadSelected;
	}

	_pInit_renderHeader_getIptSearch () {
		let searchTimeout;
		const doSearch = () => {
			this._search = (iptSearch.value || "").trim();
			this._handleHashChange();
		};
		const iptSearch = DomUtil.veT`<input type="text" placeholder="Search..." class="artr__search__field">`;
		iptSearch.title = `Multiple search terms can be provided by using quotes, e.g.: "ship" "pirate"`;
		iptSearch.addEventListener("keydown", (e) => {
			clearTimeout(searchTimeout);
			if (e.key === "Enter") doSearch();
			else searchTimeout = setTimeout(() => { doSearch(); }, 100);
		});

		return iptSearch;
	}

	_pInit_renderHeader_getSldThumbnailSize () {
		let style = document.getElementById(ArtBrowser._ID_STYLE_THUMBNAILS);
		if (!style) {
			style = DomUtil.veT`<style id="${ArtBrowser._ID_STYLE_THUMBNAILS}"></style>`;
			document.body.append(style);
		}

		let lastThumbnailSize = null;
		const hkThumbnailSize = () => {
			const sliderVal = sldThumbnailSize.value;
			const size = Math.round(ArtBrowser._SZ_PX_THUMBNAIL * (sliderVal / 100));

			if (lastThumbnailSize === size) return;
			lastThumbnailSize = size;

			style.innerHTML = `
.artr__wrp .artr__item__top {
    height: ${size + ArtBrowser._SZ_PX_MAIN_ROW_HEADER}px;
}

.artr__wrp .artr__item__top--expanded {
	height: initial;
}

.artr__wrp .artr__item__thumbnail {
	min-width: ${size}px;
	min-height: ${size}px;
	max-width: ${size}px;
	max-height: ${size}px;
}`;
			StorageUtil.syncSet(ArtBrowser._STORAGE_KEY_THUMBNAIL_SIZE, sliderVal);
		};
		const sldThumbnailSize = DomUtil.veT`<input type="range" min="25" max="200" title="Thumbnail Size">`;
		sldThumbnailSize.addEventListener("mousemove", evt => {
			if (evt.currentTarget !== sldThumbnailSize) return;
			hkThumbnailSize();
		});
		sldThumbnailSize.addEventListener("change", () => hkThumbnailSize());
		let savedThumbnailSize = StorageUtil.syncGet(ArtBrowser._STORAGE_KEY_THUMBNAIL_SIZE);
		if (savedThumbnailSize != null) {
			sldThumbnailSize.value = Math.min(200, Math.max(25, savedThumbnailSize));
			hkThumbnailSize();
		}

		return sldThumbnailSize;
	}

	/** @abstract */
	_pInit_renderHeader_getAdditionalElements () { /* Implement as required. */ }

	/* -------------------------------------------- */

	/** @abstract */
	async _pInit_pOnComplete () { /* Implement as required. */ }

	/* -------------------------------------------- */

	/**
	 * @param indexItems
	 * @param [opts]
	 * @param [opts.isSingleMode]
	 */
	async _pHandleDownloadClick (indexItems, opts) {
		opts = opts || {};

		const {eleModalInner, doClose} = this._getShowModal();

		eleModalInner.classList.add("ve-flex-vh-center");
		DomUtil.veT(eleModalInner)`<div class="ve-flex-vh-center"><i>Collecting data...</i></div>`;

		const jsons = await Promise.all(indexItems.map(indexItem => ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)));

		DomUtil.veE(eleModalInner).artre.empty();

		const options = await this._pGetDownloadModes();

		const selMode = DomUtil.veT`<select>
			${options.map((it, ix) => `<option value="${ix}" ${ix === 0 ? "selected" : ""}>${it.name}</option>`).join("")}
		</select>`;
		selMode.addEventListener("change", () => {
			if (!wrpCb) return;
			const option = options[Number(selMode.value)];
			DomUtil.veE(wrpCb).artre.toggle(!option.isMultipleFilesOnly);
		});

		const cbFilePerItem = DomUtil.veT`<input type="checkbox" checked>`;

		const btnDownload = DomUtil.veT`<button class="artr__btn-lg artr__btn-primary">Download</button>`;
		btnDownload.addEventListener("click", async () => {
			doClose();

			try {
				const isSingleFile = !cbFilePerItem.checked;
				const option = options[Number(selMode.value)];

				if (isSingleFile && !option.isMultipleFilesOnly) {
					await option.pDownloadAsSingleFile(...jsons);
				} else {
					const len = jsons.length;
					for (let i = 0; i < len; ++i) {
						const json = jsons[i];
						await option.pDownloadAsMultipleFiles(json, i, len);
						await MiscUtil.pDelay(33);
					}
				}
			} catch (e) {
				alert(`Download failed! See the console (CTRL+SHIFT+J) for details.`);
				throw e;
			}
		});

		const wrpCb = indexItems.length > 1 ? DomUtil.veT`<label class="ve-p-0 ve-m-0 ve-mb-2 ve-flex-v-center" title="If the download should be a single file per selected item, as opposed to the default of one file containing all items."><div class="ve-mr-2">One file per item</div>${cbFilePerItem}</label>` : null;
		selMode.dispatchEvent(new Event("change"));

		DomUtil.veT(eleModalInner)`<div class="ve-flex-col">
			${opts.isSingleMode ? "" : `<div class="ve-flex-v-center ve-mb-2"><i>${indexItems.length} item${indexItems.length === 1 ? "" : "s"} selected</i></div>`}
			<label class="ve-p-0 ve-m-0 ve-mb-2 ve-flex-v-center"><div class="ve-mr-2">Format</div>${selMode}</label>
			${wrpCb}
			<div class="ve-flex-vh-center ve-mt-auto ve-w-100">${btnDownload}</div>
		</div>`;
	}

	/* -------------------------------------------- */

	get _textDownloadMode () {
		return {
			name: "Text",
			pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadUrls(...jsons),
			pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadUrls(json),
		};
	}

	get _jsonDownloadMode () {
		return {
			name: "JSON",
			pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadJson(...jsons),
			pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadJson(json),
		};
	}

	/**
	 * To be overridden externally.
	 * First item is default selected.
	 */
	async _pGetDownloadModes () {
		return [
			this._textDownloadMode,
			this._jsonDownloadMode,
			{
				name: "ZIP (Warning: rate-limited)",
				pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadZip(...jsons),
				pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadZip(json),
			},
		];
	}

	/* -------------------------------------------- */

	_getShowModal () {
		const doClose = () => {
			wrpOverlay.remove();
		};

		const wrpModal = DomUtil.veT`<div class="ve-flex-col artr__modal__wrp ve-p-2"></div>`;
		const wrpOverlay = DomUtil.veT`<div class="ve-flex-vh-center artr__modal__overlay">${wrpModal}</div>`;
		wrpOverlay.addEventListener("click", evt => {
			if (evt.target === wrpOverlay) doClose();
		});
		this._eleParent.append(wrpOverlay);

		return {eleModalInner: wrpModal, doClose};
	}

	/* -------------------------------------------- */

	_addScrollHandlers () {
		const config = {
			rootMargin: "0px 0px",
			threshold: 0.01,
		};

		this._itemObservers.forEach(it => it.disconnect());
		this._itemObservers = [];

		this._itemMetas.forEach(meta => {
			const observer = new IntersectionObserver(
				obsEntries => {
					obsEntries.forEach(entry => {
						if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
							observer.unobserve(entry.target);

							meta.fnOnIntersect();
						}
					});
				},
				config,
			);

			observer.observe(meta.item);
			this._itemObservers.push(observer);
		});
	}

	_addHorizontalScrollHandler (intersectionMetas) {
		const observer = new IntersectionObserver(
			obsEntries => {
				obsEntries.forEach(entry => {
					if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
						const eleImg = entry.target;
						observer.unobserve(eleImg);

						const meta = intersectionMetas.find(meta => meta.eleImg === eleImg);
						if (!meta) return; // should never occur
						meta.eleImg.src = meta.urlThumb;
					}
				});
			},
			{
				rootMargin: "0px 0px",
				threshold: 0.01,
			},
		);

		intersectionMetas.forEach(meta => observer.observe(meta.eleImg));
	}

	/* -------------------------------------------- */

	doShowNotification ({content, pFnOnDismiss = null}) {
		DomUtil.veE(this._eleNotificationBody).artre.show();

		const btnDismiss = DomUtil.veT`<button class="artr__btn-lg artr__btn-dismiss-notif" title="Dismiss">\u00d7</button>`;
		btnDismiss.addEventListener("click", evt => {
			evt.stopPropagation();
			notif.remove();
			DomUtil.veE(this._eleNotificationBody).artre.hide();
			if (pFnOnDismiss) pFnOnDismiss();
		});

		const notif = DomUtil.veT`<div class="artr__notif">
			<div class="artr__notif-wrp-content">${content}</div>
			${btnDismiss}
		</div>`;
		this._eleNotificationBody.append(notif);
	}
}
