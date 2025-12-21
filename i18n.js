/**
 * i18n - Internationalization Manager
 * Manages language files and translations
 */

class I18n {
  constructor() {
    this.currentLang = 'ko'; // default: Korean
    this.translations = {};
    this.loaded = false;
  }

  async init() {
    // Load saved language preference
    const result = await chrome.storage.local.get(['language', 'settings']);
    if (result.language && (result.language === 'ko' || result.language === 'en')) {
      this.currentLang = result.language;
    } else if (result.settings && result.settings.language && (result.settings.language === 'ko' || result.settings.language === 'en')) {
      this.currentLang = result.settings.language;
    } else {
      // Use Chrome's language preference API
      try {
        const languages = await new Promise((resolve) => {
          chrome.i18n.getAcceptLanguages((langs) => {
            resolve(langs || []);
          });
        });
        
        // Get the first preferred language
        const preferredLang = languages && languages.length > 0 ? languages[0] : null;
        
        if (preferredLang) {
          // Extract base language (e.g., 'ko' from 'ko-KR')
          const baseLang = preferredLang.split('-')[0].toLowerCase();
          this.currentLang = (baseLang === 'ko' || baseLang === 'en') ? baseLang : 'en';
        } else {
          // Fallback to navigator.language
          const browserLang = navigator.language || navigator.userLanguage || 'en';
          const baseLang = browserLang.split('-')[0].toLowerCase();
          this.currentLang = (baseLang === 'ko' || baseLang === 'en') ? baseLang : 'en';
        }
      } catch (error) {
        console.error('Error getting Chrome language preferences:', error);
        // Fallback to navigator.language
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const baseLang = browserLang.split('-')[0].toLowerCase();
        this.currentLang = (baseLang === 'ko' || baseLang === 'en') ? baseLang : 'en';
      }
    }

    await this.loadTranslations();
    this.loaded = true;
  }

  async loadTranslations() {
    try {
      const response = await fetch(chrome.runtime.getURL(`locales/${this.currentLang}.json`));
      this.translations = await response.json();
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback to Korean if loading fails
      if (this.currentLang !== 'ko') {
        this.currentLang = 'ko';
        const response = await fetch(chrome.runtime.getURL(`locales/ko.json`));
        this.translations = await response.json();
      }
    }
  }

  async setLanguage(lang) {
    if (lang !== 'ko' && lang !== 'en') {
      console.warn('Unsupported language:', lang);
      return;
    }
    
    this.currentLang = lang;
    await chrome.storage.local.set({ language: lang });
    await this.loadTranslations();
    
    // Dispatch language change event
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  t(key, params = {}) {
    if (!this.loaded) {
      console.warn('Translations not loaded yet');
      return key;
    }

    let translation = this.translations;
    const keys = key.split('.');
    
    for (const k of keys) {
      if (translation && typeof translation === 'object') {
        translation = translation[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof translation !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Replace parameters
    let result = translation;
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), paramValue);
    }

    return result;
  }

  getCurrentLanguage() {
    return this.currentLang;
  }
}

// Export singleton instance
export const i18n = new I18n();

