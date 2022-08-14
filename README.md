# vite-plugin-react-esbuild [![npm](https://img.shields.io/npm/v/vite-plugin-react-esbuild.svg)](https://npmjs.com/package/vite-plugin-react-esbuild)

- Development. HMR based on react-refresh and babel, transform jsx and ts via esbuild.
- Production. All using esbuild.

## Motivation

Enjoy the speed of esbuild before using it in [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react).


## Installation

```bash
pnpm add vite-plugin-react-esbuild -D
```

## Usage

```typescript
import { defineConfig } from 'vite'
import react from 'vite-plugin-react-esbuild'

export default defineConfig({
  plugins: [react({
  })],
})
```


### Options

Same options as [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react)



[LICENSE (MIT)](/LICENSE)
