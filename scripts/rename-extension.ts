import { program } from "commander";
import fs from "fs";

program.argument("<name>", "The name of the extension");
program.parse();

function renameExtension(name: string) {
  renameExtensionInManifest(name);
  renameExtensionInPackageJson(name);
}

function renameExtensionInManifest(name: string) {
  try {
    const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

    manifest.name = name;

    fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

    console.log("Extension renamed in manifest");
  } catch (error) {
    console.error("Error renaming extension in manifest:", error);
  }
}

function renameExtensionInPackageJson(name: string) {
  try {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

    packageJson.name = name;

    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

    console.log("Extension renamed in package.json");
  } catch (error) {
    console.error("Error renaming extension in package.json:", error);
  }
}

renameExtension(program.args[0]);
