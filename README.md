# vite-plugin-react-esbuild

[![NPM version](https://img.shields.io/npm/v/vite-plugin-react-esbuild.svg)](https://npmjs.org/package/vite-plugin-react-esbuild)

## Install

```bash
pnpm add vite-plugin-react-esbuild -D
```

## Usage

```typescript
import { defineConfig } from 'vite'
import plugin from 'vite-plugin-react-esbuild'

export default defineConfig({
  plugins: [plugin()],
})
```


### Options

#### `include`

Type: `string` | `Array<string>`<br>
Default: `[]`

Files to include in this plugin (default all).

#### `exclude`

Type: `string` | `Array<string>`<br>
Default: `[]`

Files to exclude in this plugin (default none).

[LICENSE (MIT)](/LICENSE)
