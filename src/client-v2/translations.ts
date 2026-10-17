import zh from '../locale/zh-CN.json';
import en from '../locale/en-US.json';
import { PLUGIN_NAME } from '../shared/uid';

/** Load the namespace in the client as well: server locale caches can predate a plugin upgrade. */
export function registerTranslations(i18n: any) {
  i18n.addResourceBundle('zh-CN', PLUGIN_NAME, zh, true, true);
  i18n.addResourceBundle('en-US', PLUGIN_NAME, en, true, true);
  return (key: string) => {
    const chinese = String(i18n.resolvedLanguage || i18n.language || 'zh-CN').startsWith('zh');
    const dictionary = chinese ? zh : en;
    return String(i18n.t(key, { ns: PLUGIN_NAME, keySeparator: false, nsSeparator: false,
      defaultValue: dictionary[key] || key }));
  };
}
