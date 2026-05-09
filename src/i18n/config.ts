// Global Language Map
export const langMap: Record<string, string[]> = {
  'zh': ['zh-CN'],
  'zh-tw': ['zh-TW'],
  'en': ['en-US'],
}

// Giscus Language Map
// https://giscus.app/
export const giscusLocaleMap: Record<string, string> = {
  'zh': 'zh-CN',
  'zh-tw': 'zh-TW',
  'en': 'en-US',
}

// Twikoo Language Map
// https://github.com/twikoojs/twikoo/blob/main/src/client/utils/i18n/index.js
export const twikooLocaleMap: Record<string, string> = {
  'en': 'en',
  'zh': 'zh-cn',
  'zh-tw': 'zh-tw',
}

// Waline Language Map
// https://waline.js.org/en/guide/features/i18n.html
export const walineLocaleMap: Record<string, string> = {
  'de': 'en-US', // fallback to English
  'en': 'en-US',
}

// Supported Languages
export const supportedLangs = Object.keys(langMap).flat()
