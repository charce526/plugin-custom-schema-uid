import React, { useState } from 'react';
import { Alert, Form, Input, Modal, Typography } from 'antd';
import { normalizeUid, RESOURCE } from '../shared/uid';

export function CreationUidInput(props: any) {
  const prefix = props.addressPrefix || '/v/admin/';
  const { addressPrefix, autoLabel, ...inputProps } = props;
  return <div><Input {...inputProps} /><Typography.Text type="secondary">{prefix}{String(props.value || '').trim() || `（${autoLabel || '自动生成'}）`}</Typography.Text></div>;
}

export function askCreationUid(api: any, t: (key: string) => string, prefix = '/v/admin/'): Promise<string | null> {
  return new Promise((resolve) => {
    let value = '';
    function Editor() {
      const [current, setCurrent] = useState('');
      return <div>
        <Alert type="info" showIcon message={t('Leave empty to auto-generate. The UID is checked again by the server when saved.')} />
        <Form layout="vertical" style={{ marginTop: 16 }}><Form.Item label="UID">
          <Input autoFocus value={current} maxLength={64} onChange={(event) => { value = event.target.value; setCurrent(value); }} placeholder="project-overview" />
        </Form.Item></Form>
        <Typography.Paragraph code>{prefix}{current.trim() || `（${t('Automatically generated')}）`}</Typography.Paragraph>
        <Typography.Text type="secondary">{t('Letters, digits, underscores and hyphens; cannot start with a hyphen; maximum 64 characters.')}</Typography.Text>
      </div>;
    }
    Modal.confirm({
      title: t('Custom schema UID'), icon: null, okText: t('Continue'), cancelText: t('Cancel'),
      content: <Editor />,
      async onOk() {
        try {
          const result = normalizeUid(value, true);
          if (result) await api.request({ url: `${RESOURCE}:check`, method: 'post', data: { uid: result } });
          resolve(result);
        } catch (error: any) {
          Modal.error({ title: t('Unable to continue'), content: t(error.response?.data?.errors?.[0]?.message || error.message) });
          throw error;
        }
      },
      onCancel() { resolve(null); },
    });
  });
}
