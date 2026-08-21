import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  // fixtures/下是给单元测试用的独立Node脚本（假引擎），不是应用源码，跑在裸Node环境里，
  // 用到process/setInterval这些Node全局变量不需要走eslint的浏览器/Electron环境限制
  { ignores: ['out', 'dist', 'node_modules', 'resources', '**/__tests__/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // scripts/下是开发时手动跑的裸Node脚本（比如下载引擎二进制），不是应用源码，
    // 需要用到process/console这些Node全局变量
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly'
      }
    }
  }
)
