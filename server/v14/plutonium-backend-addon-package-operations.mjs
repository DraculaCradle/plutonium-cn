import fs from "fs";
import path from "path";
import {installPackage, checkPackage} from "./dist/packages/views.mjs";
import Module from "./dist/packages/module.mjs";
import {PACKAGE_AVAILABILITY_CODES} from "./common/constants.mjs";
import sessions from "./dist/sessions.mjs";

class PackageOperations {
	static async pHandleCheckPackage (req, res) {
		const out = {errors: []};

		const adminAuth = sessions.authenticateAdmin(req, res);
		if (!adminAuth.success) {
			res.status(403).json({error: `Not authenticated!`});
			return;
		}

		const checkResults = await checkPackage(req.body.manifest);

		if (checkResults.isDowngrade) out.errors.push(`Your currently-installed version of ${checkResults.title} is more recent!`);
		if (
			![
				PACKAGE_AVAILABILITY_CODES.VERIFIED,
				PACKAGE_AVAILABILITY_CODES.UNVERIFIED_BUILD,
				PACKAGE_AVAILABILITY_CODES.UNVERIFIED_SYSTEM,
				PACKAGE_AVAILABILITY_CODES.UNVERIFIED_GENERATION,
			]
				.includes(checkResults.availability)
		) {
			const codeName = Object.entries(PACKAGE_AVAILABILITY_CODES)
				.find(([, v]) => v === checkResults.availability)?.[0] || "(CODE_NOT_FOUND)";
			out.errors.push(`${checkResults.title} is not compatible with your current installation! (Code ${checkResults.availability}; ${codeName})`);
		}

		const outPath = path.join(Module.baseDir, checkResults.remote.id);
		if (fs.existsSync(outPath)) out.errors.push(`Target installation directory "${outPath}" already exists!`);

		res.send(out);
	}

	static async pHandleInstallPackage (req, res) {
		const adminAuth = sessions.authenticateAdmin(req, res);
		if (!adminAuth.success) {
			res.status(403).json({error: `Not authenticated!`});
			return;
		}

		const out = await installPackage(req.body.manifest);
		res.send(out);
	}
}

export default ({Plutonium}) => {
	Plutonium.MODULE_PACKAGE_OPERATIONS = PackageOperations;
};
