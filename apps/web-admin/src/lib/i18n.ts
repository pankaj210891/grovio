/**
 * i18n configuration for the admin panel.
 * Loads 'common' and 'admin' namespaces.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../../../packages/locales/en/common.json';
import adminEn from '../../../packages/locales/en/admin.json';

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        admin: adminEn,
      },
    },
    defaultNS: 'admin',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
