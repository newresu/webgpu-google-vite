[On the tutorial](https://codelabs.developers.google.com/your-first-webgpu-app) at google they use a plain HTML file.

You can use Live Server, but to get good type-hints I set it up with vite.

Run `npm i && npm run dev` to start.

You may need the [WebGPU Troubleshooting Guide](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) to set up the browser.

Links to relevant parts of the spec:

- [Built-Ins](https://gpuweb.github.io/gpuweb/wgsl/#built-in-values)

Which as a summary says:

1. Built In like `@builtin(position)` can not be duplicated and each belongs to Stage, Direction (Input or Output) and Type (data type.)
2. They can be on an argument or on a struct, and used as `name: struct_instance`.
3. Some like `@builtin(position)` belong two combinations of those like Stage: Vertex, Direction:Output **and** Stage: Fragment, Direction:Input. Type is `f32` in both cases.

Some other common ones are:

- Compute Stage - Input: `@builtin(global_invocation_id)`,`@builtin(local_invocation_id)`, `@builtin(local_invocation_index)`
- Vertex Stage - Input: `@builtin(instance_index)`, `@builtin(vertex_index)`.
