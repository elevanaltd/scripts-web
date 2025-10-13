/**
 * Mobile Detection Utility Tests
 *
 * Tests for mobile device detection utility used for graceful degradation
 * of the TipTap editor on mobile devices.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { isMobileDevice, getMobileDeviceInfo } from './mobileDetection';

describe('Mobile Detection Utilities', () => {
  // Save original userAgent to restore after tests
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true
    });
  });

  describe('isMobileDevice', () => {
    it('should detect iPhone as mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        writable: true
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should detect Android as mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        writable: true
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should detect iPad as mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        writable: true
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should NOT detect desktop Chrome as mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      expect(isMobileDevice()).toBe(false);
    });

    it('should NOT detect macOS Safari as mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
        writable: true
      });

      expect(isMobileDevice()).toBe(false);
    });

    it('should handle screen size detection for borderline cases', () => {
      // Mock very small screen
      Object.defineProperty(window, 'innerWidth', {
        value: 500,
        writable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 2,
        writable: true
      });

      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      // Should detect very small screen + touch as mobile-like even with desktop UA
      expect(isMobileDevice()).toBe(true);
    });

    it('should NOT detect desktop with touch as mobile without small screen', () => {
      // Mock touch capability but large screen (like desktop with touchscreen)
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true
      });

      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        writable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 1080,
        writable: true
      });

      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      // Touch-capable desktop should NOT be considered mobile
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe('getMobileDeviceInfo', () => {
    it('should return device info for iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        writable: true
      });

      const deviceInfo = getMobileDeviceInfo();
      expect(deviceInfo.isMobile).toBe(true);
      expect(deviceInfo.platform).toBe('iOS');
      expect(deviceInfo.deviceType).toBe('phone');
    });

    it('should return device info for Android tablet', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36',
        writable: true
      });

      const deviceInfo = getMobileDeviceInfo();
      expect(deviceInfo.isMobile).toBe(true);
      expect(deviceInfo.platform).toBe('Android');
      expect(deviceInfo.deviceType).toBe('tablet');
    });

    it('should return desktop info for non-mobile devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true
      });

      const deviceInfo = getMobileDeviceInfo();
      expect(deviceInfo.isMobile).toBe(false);
      expect(deviceInfo.platform).toBe('Windows');
      expect(deviceInfo.deviceType).toBe('desktop');
    });

    it('should include screen size information', () => {
      const deviceInfo = getMobileDeviceInfo();
      expect(deviceInfo.screenWidth).toBeTypeOf('number');
      expect(deviceInfo.screenHeight).toBeTypeOf('number');
      expect(deviceInfo.isSmallScreen).toBeTypeOf('boolean');
    });

    it('should include touch capability information', () => {
      const deviceInfo = getMobileDeviceInfo();
      expect(deviceInfo.touchCapable).toBeTypeOf('boolean');
    });
  });
});