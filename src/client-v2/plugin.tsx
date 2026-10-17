import { Application, Plugin, AdminLayoutMenuItemModel } from '@nocobase/client-v2';
import React from 'react';
import { notification, Button } from 'antd';
import { installRuntime } from './runtime';
import { registerTranslations } from './translations';
import { installMenuUidSupport } from './menuUidSupport';

export class PluginCustomSchemaUidClientV2 extends Plugin<any, Application> {
  async load() {
    const t = registerTranslations(this.app.i18n);
    installMenuUidSupport(AdminLayoutMenuItemModel, t, '/v/admin/');
    // Core classes already exist; lazy loaders cannot override them in 2.2.x.
    const { default: Page } = await import('./custom-schema-uid/CustomSchemaUidRootPageModel');
    this.flowEngine.registerModels({
      RootPageModel: Page,
    });
    this.pluginSettingsManager.addMenuItem({ key: 'uid-management', title: t('Custom Page UID'), icon: 'EditOutlined', aclSnippet: 'pm.uid-management' });
    this.pluginSettingsManager.addPageTabItem({ menuKey: 'uid-management', key: 'index', title: t('Custom Page UID'), componentLoader: async () => {
      const { default: Manager } = await import('./UidManager');
      return { default: () => <Manager api={this.app.apiClient} t={t} /> };
    } });
    installRuntime(this.app.apiClient, () => notification.warning({ message: t('A page UID changed in another session. Reload before editing.'),
      duration: 0, btn: <Button onClick={() => location.reload()}>{t('Reload')}</Button> }));
  }
}

export default PluginCustomSchemaUidClientV2;
