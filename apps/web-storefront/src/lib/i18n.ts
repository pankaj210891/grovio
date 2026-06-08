/**
 * i18n configuration for the storefront.
 *
 * Uses i18next with i18next-browser-languagedetector.
 * Loads 'common' and 'storefront' namespaces from packages/locales.
 *
 * English is the only language in v1 — the infrastructure is the deliverable.
 * Translations are buyer responsibility per productization spec.
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation(['storefront', 'common']);
 *   t('add_to_cart')      // storefront namespace
 *   t('common:save')      // common namespace
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import commonEn from '../../../../packages/locales/en/common.json';
import storefrontEn from '../../../../packages/locales/en/storefront.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        storefront: storefrontEn,
      },
    },
    defaultNS: 'storefront',
    fallbackLng: 'en',
    interpolation: {
      // React already handles XSS
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'grovio_language',
    },
  });

export default i18n;
