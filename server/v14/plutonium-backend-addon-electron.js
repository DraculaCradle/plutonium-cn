import * as electron from "electron";
import ElectronWindow from "./dist/interface/electron.mjs";

module.exports = () => {
	global.config.app.window.webContents.setWindowOpenHandler(({url} = {}) => {
		if (url === `${global.express.address}detached/index.html`) {
			const windowOptions = ElectronWindow.getWindowOptions();
			["width", "height", "minWidth", "minHeight"].forEach(t => delete windowOptions[t]);
			return {action: "allow", overrideBrowserWindowOptions: windowOptions};
		}

		if (/^about:blank\b/.test(url)) return {action: "allow"};

		if (/https?:\/\//.test(url)) setImmediate(() => electron.shell.openExternal(url));

		return {action: "deny"};
	});
};
