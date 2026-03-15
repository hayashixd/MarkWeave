import '@testing-library/jest-dom/vitest';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!('__TAURI_INTERNALS__' in window)) {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    writable: true,
    value: {
      transformCallback: () => 0,
      invoke: async () => null,
      convertFileSrc: (filePath: string) => filePath,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    },
  });
}

if (!('__TAURI_EVENT_PLUGIN_INTERNALS__' in window)) {
  Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
    writable: true,
    value: {
      registerListener: () => {},
      unregisterListener: () => {},
      emit: () => {},
    },
  });
}
