// Ukázkový mod: při každé změně obrazovky (layoutu) zapíše do konzole její jméno
// a vystaví runtime jako globalThis.rt pro vlastní pokusy.
DTMods.register('example', runtime => {
  globalThis.rt = runtime;
  let last = '';
  runtime.addEventListener('tick', () => {
    const name = runtime.layout.name;
    if (name !== last) { last = name; DTMods.log('layout:', name); }
  });
});
