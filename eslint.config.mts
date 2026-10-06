import prettierConfig from '@electron-toolkit/eslint-config-prettier'
import tsConfig from '@electron-toolkit/eslint-config-ts'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import reactRefreshPlugin from 'eslint-plugin-react-refresh'

export default tsConfig.config(
  tsConfig.configs.recommended,
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin
    },
    rules: {
      'react-refresh/only-export-components': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  prettierConfig,
  {
    rules: {
      curly: ['error', 'all']
    }
  }
)
