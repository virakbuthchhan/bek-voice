# Third-party sources

## VoxCPM2 browser model

Source: https://huggingface.co/Uddom/voxcpm2-khmer-webgpu
Base model: https://github.com/OpenBMB/VoxCPM

The compact model is a 4-bit ONNX conversion, approximately 1,937,476,083 bytes. Weights are downloaded directly from the model publisher; they are not included in this app package. The model is Apache-2.0 licensed. Its LICENSE and NOTICE are included in public/vendor. The manifest is retained with its integrity hashes and file sizes.

## Browser inference worker

Source distribution: https://kamvox.app/assets/voxcpm2.worker-CHpWAWQ3.js
Retrieved: 2026-10-16.

The browser inference engine is adapted from Kamvox's publicly distributed WebGPU engine. Changes: local ONNX Runtime module/WASM paths and an isolated Sori model-cache namespace. Sori's controls, progress display, engine selection, audio handling, and application adapter are separate files. The model license above does not assert a separate license for the Kamvox application source. Preserve this attribution when distributing this build.

## ONNX Runtime Web

Microsoft ONNX Runtime Web 1.30.0, obtained from the npm registry:
https://www.npmjs.com/package/onnxruntime-web

MIT license; see public/vendor/onnxruntime-LICENSE.txt. Bundled JSPI and asyncify WebGPU runtime assets allow the runtime itself to load locally, including after returning offline.

## Fonts

Google Sans from Google Fonts (https://github.com/googlefonts/googlesans), SIL Open Font License. Font files are self-hosted under public/fonts; the license is public/fonts/googlesans-OFL.txt.

## Vue frontend

Vue (MIT), Vuetify (MIT), Vite (MIT), @vitejs/plugin-vue (MIT), and vite-plugin-vuetify (MIT) are installed through the locked npm manifest. Material Design Icons paths from @mdi/js use Apache-2.0. Runtime dependencies are bundled into the production frontend; runtime license copies are included in public/vendor (and served under vendor/ in production). Build-plugin licenses are also available in their npm packages.
