import { Plugin, AdminLayoutMenuItemModel } from '@nocobase/client';
import React from 'react';
import { notification, Button } from 'antd';
import { installLegacyCreation, installRuntime } from '../client-v2/runtime';
import { askCreationUid } from '../client-v2/creationDialog';
import { registerTranslations } from '../client-v2/translations';
import { installMenuUidSupport } from '../client-v2/menuUidSupport';

export class PluginCustomSchemaUidClient extends Plugin {
  async load() {
    const t = registerTranslations(this.app.i18n);
    installMenuUidSupport(AdminLayoutMenuItemModel, t, '/admin/');
    this.app.pluginSettingsManager.add('uid-management', { title: t('Custom Page UID'), icon: 'EditOutlined',
      aclSnippet: 'pm.uid-management', componentLoader: async () => {
        const { default: Manager } = await import('../client-v2/UidManager');
        return { default: () => <Manager api={this.app.apiClient} t={t} modern={false} /> };
      } });
    installRuntime(this.app.apiClient, () => notification.warning({ message: t('A page UID changed in another session. Reload before editing.'),
      duration: 0, btn: <Button onClick={() => location.reload()}>{t('Reload')}</Button> }));
    installLegacyCreation(this.app.apiClient, async (config) => {
      let prefix = '/admin/';
      if (config.data?.type === 'tabs') {
        const response = await this.app.apiClient.request({ url: 'desktopRoutes:getAccessible', params: { filterByTk: config.data.parentId } });
        prefix += (response.data?.data?.schemaUid || ':pageUid') + '/tabs/';
      }
      return askCreationUid(this.app.apiClient, t, prefix);
    }, ['tabs']);
  }
}

export default PluginCustomSchemaUidClient;
