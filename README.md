# Plutonium CN — V14 / DND5E 6

当前版本：**2.19.7-cn.9**。适配 **Foundry VTT 14.370 / DND5E 6.1.1**，同时支持 FVTT 14.369 和 DND5E 6.0.6。

中文安装与更新说明见 [发行说明](RELEASE-NOTES.md)，兼容维护记录见 [适配说明](LOCAL-ADAPTATION.md)。以下保留上游使用说明。

## GitHub 安装与更新

仓库保存完整模块源码；每个 Release 的 `plutonium-cn.zip` 为可安装版本。请使用固定清单或发行附件安装。后续提交版本更新后，GitHub Actions 会自动打包并发布。

安装清单：<https://github.com/DraculaCradle/plutonium-cn/releases/latest/download/module.json>

在 Foundry 设置界面的“附加模块 → 安装模块”中粘贴以上清单地址安装。已有手动安装版本时，先备份原模块目录；若 Foundry 没有记录该清单地址，需要使用清单重新安装一次。世界里的角色和场景不在模块目录中。

之后在世界关闭时使用“检查更新/更新模块”，Foundry 会从 GitHub 下载新版本，无需手动向服务器上传压缩包。服务器需要能访问 GitHub 及其附件下载域名。

最新版：[Releases](https://github.com/DraculaCradle/plutonium-cn/releases)。兼容范围见下方发行说明；“未验证”标记保留此前的实测范围。

## 后续维护与自动发布

修改源码、更新 `module.json` 中的版本号，并同步更新发行说明后，提交到 `main`。GitHub Actions 会检查 JavaScript 语法、打包模块并验证 ZIP，再创建对应版本的 Release，上传 `module.json`、安装包和 SHA-256 校验文件。现有版本的发行附件不会被覆盖。

完整发布清单保存在 `tools/module-files.json`；增加或移除模块文件时一并更新该清单。打包脚本只收录这些模块文件，不包含工作流和维护工具。发布使用 GitHub 自动提供的仓库令牌，无需另外设置个人令牌或服务器密钥。

通过已连接的 GitHub API 即可提交代码；日常更新无需控制维护者电脑，也无需手动向 Foundry 服务器上传文件。

### Installation

- Install module dependencies:
  - libWrapper https://foundryvtt.com/packages/lib-wrapper
- Copy the directory containing this README to `%appdata%/../Local/FoundryVTT/Data/modules`
- Restart Foundry
- In Foundry, go to the "Settings" tab, click "Module Management", and enable "Plutonium". Be sure to save the changes by clicking "Save Module Settings".

---

### Rivet

A companion browser extension, "Rivet", is available on the [Chrome](https://chrome.google.com/webstore/detail/rivet/igmilfmbmkmpkjjgoabaagaoohhhbjde) and [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/rivet/) web stores. With Rivet, you can one-click import content (notably creatures as a GM, or spells as a player) when browsing 5etools.

---

### Server-Side Modding

_**Note: Local/dedicated installs only!** You cannot use this with hosting services, such as Forge. Turn back now._

⚠️ Modifying server-side code can/will introduce security vulnerabilities, making your game more susceptible to attack. Some known vulnerabilities are highlighted below, but this is not a complete list. ⚠️

Plutonium comes with a server-side mod to enable mass-downloading via the built-in Art Browser. To install this:

- Find Foundry's `main.mjs` file in:
   - If you installed "for current user only" on Windows: `%appdata%/../Local/Programs/FoundryVTT/resources/app`
   - If you installed "for all users" on Windows: `Program Files/FoundryVTT/resources/app`
- Edit the file, changing this:
```js
init.default({
	args: process.argv,
	root: root,
	messages: startupMessages,
	debug: isDebug
})
```

to

```js
await init.default({
	args: process.argv,
	root: root,
	messages: startupMessages,
	debug: isDebug
});
(await import("./plutonium-backend.mjs")).Plutonium.init();
```
- Copy the `plutonium-backend.mjs` file from `server/<foundry version>/` to the directory containing `main.mjs`
- Launch Foundry, and pray that nothing explodes. If everything is working, the in-game Foundry logo (in the top-left of the screen) will show the running Plutonium backend version.

#### Additional Server-Side Addons

##### Custom Setup Screen Addon

This addon allows custom CSS and JavaScript to be loaded when viewing the setup screen, allowing additional styling/functionality to be applied.

⚠️ Enabling this addon allows any user with upload permissions to create potentially-malicious scripts and styles which will automatically be executed when a client visits the setup page. ⚠️

Installation: copy the `plutonium-backend-addon-custom-setup.mjs` file to the same directory as `plutonium-backend.mjs`.

Usage: create a `setup.css` and/or a `setup.js` in your Foundry data folder (alongside the `modules`, `systems`, and `worlds` directories). These files will then be loaded, if they exist, when a client visits the setup screen (`/setup`).

Examples can be found in the `server/<foundry version>/custom-setup-samples` directory.

##### Custom World Login Screen Addon

This addon allows custom CSS and JavaScript to be loaded when viewing a world's login screen, allowing additional styling/functionality to be applied on a per-world basis.

⚠️ Enabling this addon allows any user with upload permissions to create potentially-malicious scripts and styles which will automatically be executed when a client visits the login page. ⚠️

Installation: copy the `plutonium-backend-addon-custom-login.mjs` file to the same directory as `plutonium-backend.mjs`.

Usage: create a `login.css` and/or a `login.js` in a world's directory. These files will then be loaded, if they exist, when a client visits the login screen (`/join`) for a world.

For example, filling `worlds/my-world/login.css` with the CSS found in [this Reddit post](https://www.reddit.com/r/FoundryVTT/comments/nkg6z2) will have the same effect as modifying Foundry's `style.css` (as per the post), but the changes will only be applied to the login page for `my-world`. Aside from allowing per-world customization, this circumvents the need to re-apply the CSS changes after each Foundry update (assuming the Plutonium backend mod is re-applied instead!).

Further examples can be found in the `server/<foundry version>/custom-login-samples` directory.

##### Electron Addon

An additional file, `plutonium-backend-addon-electron.js`, can be installed in order to enable additional functionality when running Foundry as a "native" (Electron) app.

Installation: copy the `plutonium-backend-addon-electron.js` file to the same directory as `plutonium-backend.mjs`.

This addon allows the Foundry app to open popup windows, enabling Plutonium's "Pop Out" feature (among possible others, depending on your installed modules).

##### Increase Max Folder Depth Addon

An additional file, `plutonium-backend-addon-folder-max-depth.js`, can be installed in order support folder nesting up to 9 levels deep.

Installation: copy the `plutonium-backend-addon-folder-max-depth.js` file to the same directory as `plutonium-backend.mjs`.

##### Package Operations (Unused)

_Note that this addon is unused by Plutonium, and installation is therefore **not recommended**._

An additional file, `plutonium-backend-addon-package-operations.mjs`, can be installed in order to allow access to package lookup/installation while a game is running. This _theoretically_ allows Plutonium to install e.g. adventure worlds from within the Importer, but in practice, this feature is not currently used.

⚠️ Enabling this addon allows **any admin-authenticated web client** to check the status of/install modules and worlds. ⚠️

Installation: copy the `plutonium-backend-addon-package-operations.mjs` file to the same directory as `plutonium-backend.mjs`.
