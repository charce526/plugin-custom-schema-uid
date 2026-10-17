import React from 'react';
import { Alert, Modal, Space, Typography, message } from 'antd';
import { normalizeUid, RESOURCE, rewriteReferences } from '../shared/uid';

export function ManualChecks({ warnings, t }: { warnings: string[]; t: (key: string) => string }) {
  if (!warnings?.length) return null;
  return <details><summary>{t('Show reference locations')}</summary><ul>
    {warnings.map((value) => <li key={value}><Typography.Text code>{value}</Typography.Text></li>)}
  </ul></details>;
}

export function notifyUidChange() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('xz-schema-uid'); channel.postMessage('changed'); channel.close();
  }
}

export function reloadChangedPage(result: any) {
  const path = rewriteReferences({ path: location.pathname }, result.from, result.to).path;
  // Let the native edit dialog finish its normal save cycle first.
  setTimeout(() => location.replace(path + location.search + location.hash), 300);
}

/** Validate/prepare automatically, then show exactly one confirmation. No write before onOk. */
export async function requestUidChange({ api, routeId, uid, t, modern = true, zIndex = 2100, showConfirmation = Modal.confirm }: {
  api: any; routeId: any; uid: string; t: (key: string) => string; modern?: boolean; zIndex?: number; showConfirmation?: (options: any) => { update: (patch: any) => void };
}): Promise<any | null> {
  const request = async (action: string, data?: any, params?: any) => (await api.request({
    url: `${RESOURCE}:${action}`, method: data === undefined ? 'get' : 'post', data, params,
  })).data.data;
  const preview = await request('preview', { routeId, uid: normalizeUid(uid) });
  return new Promise((resolve) => {
    let uncertain = false;
    const content = (error?: string) => <Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Text>{preview.route.title || t('Default tab')}</Typography.Text>
      <Typography.Text code>{preview.from} → {preview.to}</Typography.Text>
      <Typography.Text>{t('New address')}{t(': ')}{modern ? preview.newPath : preview.newPath.replace('/v/admin/', '/admin/')}</Typography.Text>
      <Alert type="warning" showIcon message={t('The plugin updates related configuration while preserving page content and business data. Old addresses will stop working; review scripts and external links.')} />
      <ManualChecks warnings={preview.warnings} t={t} />
      {error && <Alert type="error" message={error} showIcon />}
    </Space>;
    const modal = showConfirmation({ title: t('Confirm UID change'), content: content(), zIndex,
      okText: t('Confirm UID change'), cancelText: t('Cancel'), maskClosable: false,
      onCancel: () => { message.info(t('Save cancelled.')); resolve(null); },
      async onOk() {
        try {
          let result;
          if (uncertain) {
            const status = await request('status', undefined, { id: preview.id });
            if (status.status === 'completed') result = status.result;
            else uncertain = false; // Status uses the execution lock: no in-flight transaction remains.
          }
          if (!result) result = await request('execute', { id: preview.id, confirmed: true });
          notifyUidChange(); resolve(result);
        } catch (error: any) {
          if (!error.response || error.response.status >= 500) uncertain = true;
          const message = uncertain ? t('The execution result is not yet known. Query its status before retrying.') :
            t(error.response?.data?.errors?.[0]?.message || error.message);
          modal.update({ content: content(message),
            okText: t(uncertain ? 'Query execution status' : 'Confirm UID change'),
            cancelButtonProps: { disabled: uncertain }, keyboard: !uncertain, closable: false });
          throw error; // Keep this same confirmation open; never open another modal.
        }
      },
    });
  });
}
