/** @type {import('expo/config').ConfigContext} */
module.exports = ({ config }) => {
  // GitHub Pages is served under /checking-lists — only set for export/deploy.
  // Leaving baseUrl set during `expo start` breaks localhost:8081 after refresh
  // (Metro injects transform.baseUrl=/checking-lists and mis-resolves entry/assets).
  const baseUrl = process.env.EXPO_BASE_URL;
  return {
    ...config,
    ...(baseUrl
      ? { experiments: { ...(config.experiments || {}), baseUrl } }
      : { experiments: { ...(config.experiments || {}) } }),
  };
};
