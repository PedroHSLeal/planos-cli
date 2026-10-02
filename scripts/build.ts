import { name } from "../package.json";

await Bun.build({
  entrypoints: ['./index.ts'],
  outdir: '.',
  env: "inline",
  compile: {
    outfile: name,
    autoloadBunfig: true,
    autoloadDotenv: true,
    autoloadPackageJson: true,
    autoloadTsconfig: true
  }
});