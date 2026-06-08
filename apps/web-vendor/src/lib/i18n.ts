/**
 * i18n configuration for the vendor panel.
 * Loads 'common' and 'vendor' namespaces.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../../../../packages/locales/en/common.json';
import vendorEn from '../../../../packages/locales/en/vendor.json';

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        vendor: vendorEn,
      },
    },
    defaultNS: 'vendor',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
