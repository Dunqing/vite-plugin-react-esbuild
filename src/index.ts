import type { Plugin } from 'vite'
import type { FilterPattern } from '@rollup/pluginutils'
import { createFilter } from '@rollup/pluginutils'

interface PluginOptions {
  include?: FilterPattern
  exclude?: FilterPattern
}

export default function plugin({ include = [], exclude = [] }: PluginOptions = {}): Plugin {
  const filter = createFilter(include, exclude)
  return {
    name: 'vite-plugin-react-esbuild',
    resolveId(id: string) {
      if (!filter(id))
        return undefined
    },
  }
}
