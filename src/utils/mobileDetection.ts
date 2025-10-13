/**
 * Mobile Detection Utilities
 *
 * Provides utilities for detecting mobile devices and determining
 * device capabilities for graceful degradation of the TipTap editor.
 *
 * Critical-Engineer: consulted for Mobile detection patterns and edge cases
 */

export interface MobileDeviceInfo {
  isMobile: boolean;
  platform: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  deviceType: 'phone' | 'tablet' | 'desktop';
  screenWidth: number;
  screenHeight: number;
  isSmallScreen: boolean;
  touchCapable: boolean;
}

/**
 * Detects if the current device is a mobile device
 * Uses multiple detection methods for reliability:
 * 1. User agent string analysis (primary)
 * 2. Screen size detection (secondary)
 * 3. Touch capability detection (tertiary)
 */
export function isMobileDevice(): boolean {
  // Method 1: User Agent detection (most reliable)
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'mobile', 'android', 'iphone', 'ipad', 'ipod',
    'blackberry', 'windows phone', 'opera mini'
  ];

  const userAgentIsMobile = mobileKeywords.some(keyword =>
    userAgent.includes(keyword)
  );

  // If user agent clearly indicates mobile, return true
  if (userAgentIsMobile) {
    return true;
  }

  // Method 2: Screen size detection (mobile-like dimensions)
  const screenWidth = window.innerWidth || document.documentElement.clientWidth;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight;
  const isVerySmallScreen = screenWidth <= 600 && screenHeight <= 900; // More conservative

  // Method 3: Touch capability detection
  const touchCapable = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ((navigator as { msMaxTouchPoints?: number }).msMaxTouchPoints || 0) > 0
  );

  // Only consider it mobile if it has BOTH very small screen AND touch capability
  // This prevents desktop browsers with touch screens from being detected as mobile
  return isVerySmallScreen && touchCapable;
}

/**
 * Gets comprehensive mobile device information
 */
export function getMobileDeviceInfo(): MobileDeviceInfo {
  const userAgent = navigator.userAgent;
  const screenWidth = window.innerWidth || document.documentElement.clientWidth;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight;

  // Platform detection
  let platform: MobileDeviceInfo['platform'] = 'Unknown';
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    platform = 'iOS';
  } else if (/Android/.test(userAgent)) {
    platform = 'Android';
  } else if (/Windows/.test(userAgent)) {
    platform = 'Windows';
  } else if (/Mac/.test(userAgent)) {
    platform = 'macOS';
  } else if (/Linux/.test(userAgent)) {
    platform = 'Linux';
  }

  // Device type detection
  let deviceType: MobileDeviceInfo['deviceType'] = 'desktop';
  if (/iPhone|iPod|Android.*Mobile/.test(userAgent)) {
    deviceType = 'phone';
  } else if (/iPad|Android(?!.*Mobile)/.test(userAgent)) {
    deviceType = 'tablet';
  }

  // Touch capability
  const touchCapable = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ((navigator as { msMaxTouchPoints?: number }).msMaxTouchPoints || 0) > 0
  );

  // Small screen determination
  const isSmallScreen = screenWidth <= 768;

  return {
    isMobile: isMobileDevice(),
    platform,
    deviceType,
    screenWidth,
    screenHeight,
    isSmallScreen,
    touchCapable
  };
}