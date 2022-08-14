import type { ParserOptions, TransformOptions } from '@babel/core'
import * as babel from '@babel/core'
import { createFilter } from 'vite'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import MagicString from 'magic-string'
import type { SourceMap } from 'magic-string'
import {
  addRefreshWrapper,
  isRefreshBoundary,
  preambleCode,
  runtimeCode,
  runtimePublicPath,
} from './fast-refresh'

export interface Options {
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  /**
   * Enable `react-refresh` integration. Vite disables this in prod env or build mode.
   * @default true
   */
  fastRefresh?: boolean
  /**
   * Set this to `"automatic"` to use [vite-react-jsx](https://github.com/alloc/vite-react-jsx).
   * @default "automatic"
   */
  jsxRuntime?: 'classic' | 'automatic'
  /**
   * Control where the JSX factory is imported from.
   * This option is ignored when `jsxRuntime` is not `"automatic"`.
   * @default "react"
   */
  jsxImportSource?: string
  /**
   * @deprecated Use esbuild
   * Babel configuration applied in both dev and prod.
   */
  babel?:
  | BabelOptions
  | ((id: string, options: { ssr?: boolean }) => BabelOptions)
}

export type BabelOptions = Omit<
  TransformOptions,
  | 'ast'
  | 'filename'
  | 'root'
  | 'sourceFileName'
  | 'sourceMaps'
  | 'inputSourceMap'
>

/**
 * The object type used by the `options` passed to plugins with
 * an `api.reactBabel` method.
 */
export interface ReactBabelOptions extends BabelOptions {
  plugins: Extract<BabelOptions['plugins'], any[]>
  presets: Extract<BabelOptions['presets'], any[]>
  overrides: Extract<BabelOptions['overrides'], any[]>
  parserOpts: ParserOptions & {
    plugins: Extract<ParserOptions['plugins'], any[]>
  }
}

type ReactBabelHook = (
  babelConfig: ReactBabelOptions,
  context: ReactBabelHookContext,
  config: ResolvedConfig
) => void

interface ReactBabelHookContext { ssr: boolean; id: string }

declare module 'vite' {
  export interface Plugin {
    api?: {
      /**
       * Manipulate the Babel options of `@vitejs/plugin-react`
       */
      reactBabel?: ReactBabelHook
    }
  }
}

const prependReactImportCode = 'import React from \'react\'; '

export default function viteReact(opts: Options = {}): PluginOption[] {
  // Provide default values for Rollup compat.
  let devBase = '/'
  let filter = createFilter(opts.include, opts.exclude)
  let needHiresSourcemap = false
  let isProduction = true
  let projectRoot = process.cwd()
  let skipFastRefresh = opts.fastRefresh === false
  let runPluginOverrides: (
    options: ReactBabelOptions,
    context: ReactBabelHookContext,
  ) => boolean = () => false
  let staticBabelOptions: ReactBabelOptions | undefined

  // Any extension, including compound ones like '.bs.js'
  const fileExtensionRE = /\.[^\/\s\?]+$/

  const reactEsbuild: Plugin = {
    name: 'vite:react-esbuild',
    enforce: 'pre',
    config(_, { mode }) {
      isProduction
        = (process.env.NODE_ENV || process.env.VITE_USER_NODE_ENV || mode)
        === 'production'

      if (opts.jsxRuntime === 'classic') {
        return {
          esbuild: {
            jsx: 'transform',
            jsxImportSource: opts.jsxImportSource,
          },
        }
      }
      else {
        return {
          esbuild: {
            jsxDev: !isProduction,
            jsx: 'automatic',
            jsxImportSource: opts.jsxImportSource,
          },
        }
      }
    },
  }

  const viteBabel: Plugin = {
    name: 'vite:react-babel',
    config(_) {
      if (opts.jsxRuntime === 'classic') {
        return {
          esbuild: {
            logOverride: {
              'this-is-undefined-in-esm': 'silent',
            },
          },
        }
      }
    },
    configResolved(config) {
      devBase = config.base
      projectRoot = config.root
      filter = createFilter(opts.include, opts.exclude, {
        resolve: projectRoot,
      })
      needHiresSourcemap
        = config.command === 'build' && !!config.build.sourcemap
      isProduction = config.isProduction
      skipFastRefresh ||= isProduction || config.command === 'build'

      runPluginOverrides = (babelOptions, context) => {
        const hooks = config.plugins
          .map(plugin => plugin.api?.reactBabel)
          .filter(Boolean) as ReactBabelHook[]

        if (hooks.length > 0) {
          return (runPluginOverrides = (babelOptions, context) => {
            hooks.forEach(hook => hook(babelOptions, context, config))
            return true
          })(babelOptions, context)
        }
        runPluginOverrides = () => false
        return false
      }
    },
    async transform(code, id, options) {
      const ssr = options?.ssr === true
      // File extension could be mocked/overridden in querystring.
      const [filepath, querystring = ''] = id.split('?')
      const [extension = '']
        = querystring.match(fileExtensionRE)
        || filepath.match(fileExtensionRE)
        || []

      if (/\.(mjs|[tj]sx?)$/.test(extension)) {
        const isNodeModules = id.includes('/node_modules/')
        const isProjectFile
          = !isNodeModules && (id[0] === '\0' || id.startsWith(`${projectRoot}/`))

        let babelOptions = staticBabelOptions
        if (typeof opts.babel === 'function') {
          const rawOptions = opts.babel(id, { ssr })
          babelOptions = createBabelOptions(rawOptions)
          runPluginOverrides(babelOptions, { ssr, id })
        }
        else if (!babelOptions) {
          babelOptions = createBabelOptions(opts.babel)
          if (!runPluginOverrides(babelOptions, { ssr, id }))
            staticBabelOptions = babelOptions
        }

        const plugins = isProjectFile ? [...babelOptions.plugins] : []

        let useFastRefresh = false
        if (!skipFastRefresh && !ssr && !isNodeModules) {
          // Modules with .js or .ts extension must import React.
          if (filter(id)) {
            useFastRefresh = true
            plugins.push([
              await loadPlugin('react-refresh/babel'),
              { skipEnvCheck: true },
            ])
          }
        }

        const prependReactImport = false

        let inputMap: SourceMap | undefined
        if (prependReactImport) {
          if (needHiresSourcemap) {
            const s = new MagicString(code)
            s.prepend(prependReactImportCode)
            code = s.toString()
            inputMap = s.generateMap({ hires: true, source: id })
          }
          else {
            code = prependReactImportCode + code
          }
        }

        // Plugins defined through this Vite plugin are only applied
        // to modules within the project root, but "babel.config.js"
        // files can define plugins that need to be applied to every
        // module, including node_modules and linked packages.
        const shouldSkip
          = !plugins.length
          && !babelOptions.configFile
          && !(isProjectFile && babelOptions.babelrc)

        // Avoid parsing if no plugins exist.
        if (shouldSkip) {
          return {
            code,
            map: inputMap ?? null,
          }
        }

        const isReasonReact = extension.endsWith('.bs.js')
        const result = await babel.transformAsync(code, {
          ...babelOptions,
          ast: !isReasonReact,
          root: projectRoot,
          filename: id,
          sourceFileName: filepath,
          parserOpts: {
            ...babelOptions.parserOpts,
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            plugins: babelOptions.parserOpts.plugins,
          },
          generatorOpts: {
            ...babelOptions.generatorOpts,
            decoratorsBeforeExport: true,
          },
          plugins,
          sourceMaps: true,
          // Vite handles sourcemap flattening
          inputSourceMap: inputMap ?? (false as any),
        })

        if (result) {
          let code = result.code!
          if (useFastRefresh && /\$RefreshReg\$\(/.test(code)) {
            const accept = isReasonReact || isRefreshBoundary(result.ast!)
            code = addRefreshWrapper(code, id, accept)
          }
          return {
            code,
            map: result.map,
          }
        }
      }
    },
  }

  const viteReactRefresh: Plugin = {
    name: 'vite:react-refresh',
    config: () => ({
      resolve: {
        dedupe: ['react', 'react-dom'],
      },
    }),
    resolveId(id) {
      if (id === runtimePublicPath)
        return id
    },
    load(id) {
      if (id === runtimePublicPath)
        return runtimeCode
    },
    transformIndexHtml() {
      if (!skipFastRefresh) {
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: preambleCode.replace('__BASE__', devBase),
          },
        ]
      }
    },
  }

  return [reactEsbuild, viteBabel, viteReactRefresh]
}

function loadPlugin(path: string): Promise<any> {
  return import(path).then(module => module.default || module)
}

viteReact.preambleCode = preambleCode

function createBabelOptions(rawOptions?: BabelOptions) {
  const babelOptions = {
    babelrc: false,
    configFile: false,
    ...rawOptions,
  } as ReactBabelOptions

  babelOptions.plugins ||= []
  babelOptions.presets ||= []
  babelOptions.overrides ||= []
  babelOptions.parserOpts ||= {} as any
  babelOptions.parserOpts.plugins ||= []

  return babelOptions
}
