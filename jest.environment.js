const { TestEnvironment: NodeEnvironment } = require('jest-environment-node');

// Custom Jest environment that guarantees a global `FormData` exists before any
// setupFiles run.
//
// Why: on Node < 18 there is no global FormData. jest-expo's preset setup
// (`jest-expo/src/preset/setup.js`) does `require('expo/src/winter')`, which
// evaluates `installFormDataPatch(FormData)` in expo/src/winter/runtime.native.
// Even though the patch function is mocked to a no-op for the jest runtime, the
// bare `FormData` argument is still evaluated and throws
// `ReferenceError: FormData is not defined`, taking every suite down before a
// single test runs. The environment constructor executes before setupFiles, so
// defining the identifier here fixes it for all suites. A no-op class is
// sufficient — nothing in the test runtime actually uses FormData.
class ExpoNodeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    if (typeof this.global.FormData === 'undefined') {
      this.global.FormData = class FormData {};
    }
  }
}

module.exports = ExpoNodeEnvironment;
