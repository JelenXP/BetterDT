// Example mod: logs the name of every screen (layout) it switches to
// and exposes the runtime as globalThis.rt for your own experiments.
DTMods.register('example', runtime => {
  globalThis.rt = runtime;
  let last = '';
  runtime.addEventListener('tick', () => {
    const name = runtime.layout.name;
    if (name !== last) { last = name; DTMods.log('layout:', name); }
  });
});
