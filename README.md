# [name]

[![NPM version](https://img.shields.io/npm/v/[name].svg)](https://npmjs.org/package/[name])

## How to use this template?

### Github Template

[Click use this template](https://github.com/Dunqing/vite-plugin-starter/generate)

### Clone to local

```bash
npx degit Dunqing/vite-plugin-starter vite-plugin-name

cd vite-plugin-name

# Replace all [name] with your package name

pnpm i
```




## Install

```bash
pnpm add [name] -D
```

## Usage

```typescript
import { defineConfig } from 'vite'
import plugin from '[name]'

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
