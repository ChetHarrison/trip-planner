import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export default {
	rootDir,
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.js$": "babel-jest"
	},
	roots: [
		"<rootDir>/public/js",
		"<rootDir>/diagnostics/tests"
	],
	testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[tj]s?(x)"
	],
  	// ✅ Use setupFilesAfterEnv for ESM
	setupFilesAfterEnv: ["<rootDir>/config/jest.setup.js"],
	reporters: [
		"default",
		["jest-html-reporter", {
			pageTitle: "Test Report",
			outputPath: "diagnostics/test-report/index.html",
			includeFailureMsg: true,
			includeSuiteFailure: true,
			theme: "defaultTheme"
		}]
	]
};
