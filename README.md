[On the tutorial](https://codelabs.developers.google.com/your-first-webgpu-app) at google they use a plain HTML file.

You can use Live Server, but to get good type-hints I set it up with vite.

Run `npm i && npm run dev` to start.

You may need the [WebGPU Troubleshooting Guide](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) to set up the browser.

Interesting parts of the spec:

- [Compute Shaders](https://gpuweb.github.io/gpuweb/wgsl/#compute-shader-workgroups)
- [Built in Values](https://gpuweb.github.io/gpuweb/wgsl/#built-in-values)
- [Attributes](https://gpuweb.github.io/gpuweb/wgsl/#attributes)
- [Memory Alignment](https://gpuweb.github.io/gpuweb/wgsl/#alignment-and-size)
