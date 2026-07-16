/**
 * Auth Router Helper
 * Simplifies generating authentication URLs across all Volant platforms
 * Usage: authRouter.getLoginUrl(platform, redirectPage)
 */

const AuthRouter = {
  PLATFORMS: {
    POETRY: 'poetry',
    READS: 'reads',
    FOUNDRY: 'foundry'
  },

  PLATFORM_CONFIG: {
    poetry: {
      name: 'Volant Poetry',
      homeUrl: 'index.html',
      platformName: 'Volant Poetry'
    },
    reads: {
      name: 'Volant Reads',
      homeUrl: 'store/index.html',
      platformName: 'Volant Reads'
    },
    foundry: {
      name: 'Volant Foundry',
      homeUrl: 'parent-house.html',
      platformName: 'Volant Foundry'
    }
  },

  /**
   * Get the platform from the current page
   * @returns {string} Platform identifier (poetry, reads, foundry)
   */
  getCurrentPlatform() {
    const currentFile = window.location.pathname.split('/').pop();

    if (currentFile.startsWith('volantReads-')) {
      return this.PLATFORMS.READS;
    } else if (currentFile === 'parent-house.html' || currentFile === 'learning.html') {
      return this.PLATFORMS.FOUNDRY;
    }
    return this.PLATFORMS.POETRY;
  },

  /**
   * Get current page URL for redirect
   * @returns {string} Current page filename with query params
   */
  getCurrentPageUrl() {
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const search = window.location.search;
    return currentFile + search;
  },

  /**
   * Generate login URL
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after login
   * @returns {string} Full login URL with parameters
   */
  getLoginUrl(platform = null, redirectPage = null) {
    platform = platform || this.getCurrentPlatform();
    redirectPage = redirectPage || this.getCurrentPageUrl();

    const params = new URLSearchParams();
    params.append('platform', platform);
    params.append('redirect', redirectPage);

    return `universal-login.html?${params.toString()}`;
  },

  /**
   * Generate signup URL
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after signup
   * @returns {string} Full signup URL with parameters
   */
  getSignupUrl(platform = null, redirectPage = null) {
    platform = platform || this.getCurrentPlatform();
    redirectPage = redirectPage || this.getCurrentPageUrl();

    const params = new URLSearchParams();
    params.append('platform', platform);
    params.append('redirect', redirectPage);

    return `universal-signup.html?${params.toString()}`;
  },

  /**
   * Generate password reset URL
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after reset
   * @returns {string} Full password reset URL with parameters
   */
  getResetUrl(platform = null, redirectPage = null) {
    platform = platform || this.getCurrentPlatform();
    redirectPage = redirectPage || this.getCurrentPageUrl();

    const params = new URLSearchParams();
    params.append('platform', platform);
    params.append('redirect', redirectPage);

    return `users-reset.html?${params.toString()}`;
  },

  /**
   * Generate verification URL
   * @param {string} email - User email to verify
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after verification
   * @returns {string} Full verification URL with parameters
   */
  getVerificationUrl(email, platform = null, redirectPage = null) {
    platform = platform || this.getCurrentPlatform();
    redirectPage = redirectPage || this.getCurrentPageUrl();

    const params = new URLSearchParams();
    params.append('email', email);
    params.append('platform', platform);
    if (redirectPage) params.append('redirect', redirectPage);

    return `verify-email.html?${params.toString()}`;
  },

  /**
   * Get home page URL for a platform
   * @param {string} platform - Platform identifier
   * @returns {string} Home page URL
   */
  getHomeUrl(platform = null) {
    platform = platform || this.getCurrentPlatform();
    return this.PLATFORM_CONFIG[platform]?.homeUrl || 'index.html';
  },

  /**
   * Get platform name for display
   * @param {string} platform - Platform identifier
   * @returns {string} Friendly platform name
   */
  getPlatformName(platform = null) {
    platform = platform || this.getCurrentPlatform();
    return this.PLATFORM_CONFIG[platform]?.platformName || 'Volant Platform';
  },

  /**
   * Navigate to login
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after login
   */
  goToLogin(platform = null, redirectPage = null) {
    window.location.href = this.getLoginUrl(platform, redirectPage);
  },

  /**
   * Navigate to signup
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after signup
   */
  goToSignup(platform = null, redirectPage = null) {
    window.location.href = this.getSignupUrl(platform, redirectPage);
  },

  /**
   * Navigate to password reset
   * @param {string} platform - Platform identifier
   * @param {string} redirectPage - Optional page to redirect to after reset
   */
  goToReset(platform = null, redirectPage = null) {
    window.location.href = this.getResetUrl(platform, redirectPage);
  },

  /**
   * Get URL parameters for current page
   * @returns {object} Parsed URL parameters
   */
  getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      platform: params.get('platform') || this.getCurrentPlatform(),
      redirect: params.get('redirect'),
      email: params.get('email')
    };
  }
};

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthRouter;
}
