process.chdir(__dirname)

module.exports = {
  name: "Services",
  testEnvironment: `node`,
  rootDir: "./",
  testPathIgnorePatterns: [
    `/examples/`,
    `/www/`,
    `/dist/`,
    `/node_modules/`,
    `<rootDir>/node_modules/`,
    `__tests__/fixtures`,
    `__testfixtures__`,
    `.cache`,
  ],
  transformIgnorePatterns: [`/dist`],
  transform: { "^.+\\.[jt]s$": `../../jest-transformer.js` },
  setupFiles: ["../setup-env.js"],
  setupFilesAfterEnv: ["../setup.js"],
  globalSetup: "../globalSetup.js",
  globalTeardown: "../globalTeardown.js",
}
