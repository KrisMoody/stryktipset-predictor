module.exports = {
  '*.{ts,vue,js,mjs}': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{json,yml,yaml}': [
    'prettier --write',
  ],
  '*.{ts,vue}': () => 'nuxt typecheck',
}
