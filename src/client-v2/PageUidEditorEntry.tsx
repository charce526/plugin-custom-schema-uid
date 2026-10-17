import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { normalizeUid } from '../shared/uid';
import { reloadChangedPage, requestUidChange } from './uidChange';

/** Content for the official viewer dialog: no independent Modal or body portal. */
export function UidEditDialog({ getContext, t, addressPrefix, onChange, view }: any) {
  const ctx = getContext();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(ctx.model.getRoute().schemaUid), [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<any>();
  const route = ctx.model.getRoute();
  const cancelBlocked = busy || confirmation?.cancelButtonProps?.disabled;
  useEffect(() => {
    const previous = view.beforeClose;
    view.beforeClose = () => !cancelBlocked && !confirmation;
    return () => { view.beforeClose = previous; };
  }, [view, cancelBlocked, confirmation]);
  const cancel = () => {
    if (cancelBlocked) return;
    if (confirmation) { setConfirmation(undefined); confirmation.onCancel(); }
    else void view.close();
  };
  const confirm = async () => {
    setBusy(true);
    try { await confirmation.onOk(); } catch { /* The controller renders errors in this same view. */ }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const uid = normalizeUid(draft);
      if (uid === route.schemaUid) { await view.close(undefined, true); return; }
      const result = await requestUidChange({ api: ctx.api, routeId: route.id, uid, t,
        modern: addressPrefix.startsWith('/v/'), showConfirmation: (options) => {
          setConfirmation(options); setBusy(false);
          return { update: (patch) => setConfirmation((current: any) => ({ ...current, ...patch })) };
        } });
      if (!result) return;
      ctx.model.setProps({ route: { ...ctx.model.getRoute(), schemaUid: result.to } });
      onChange?.(result.to);
      await view.close(undefined, true);
      reloadChangedPage(result);
    } catch (error: any) {
      setError(t(error.response?.data?.errors?.[0]?.message || error.message));
    } finally { setBusy(false); }
  };
  return <>
    <view.Header title={confirmation ? confirmation.title : t('Change UID')} />
    {confirmation ? confirmation.content : <>
      {error && <Alert type="error" showIcon message={error} />}
      <Form layout="vertical">
        <Form.Item label={t('Current UID')}><Typography.Text code>{route.schemaUid}</Typography.Text></Form.Item>
        <Form.Item label={t('New UID')} extra={t('Letters, digits, underscores and hyphens; cannot start with a hyphen; maximum 64 characters.')}>
          <Input autoFocus value={draft} maxLength={64} disabled={busy} onChange={(event) => setDraft(event.target.value)} />
        </Form.Item>
      </Form>
    </>}
    <view.Footer><Space>
      <Button disabled={cancelBlocked} onClick={cancel}>{t('Cancel')}</Button>
      <Button type="primary" loading={busy} onClick={confirmation ? confirm : save}>
        {confirmation ? confirmation.okText : t('Continue')}
      </Button>
    </Space></view.Footer>
  </>;
}

/** Respect the actual opener layer, including native settings' explicit z-index overrides. */
export function uidDialogLayer(opener: HTMLElement | undefined, ctx: any) {
  const wrap = opener?.closest('.ant-modal-root')?.querySelector('.ant-modal-wrap');
  const openerLayer = wrap ? Number(window.getComputedStyle(wrap).zIndex) || 0 : 0;
  return Math.max(openerLayer, Number(ctx.viewer?.getNextZIndex?.()) || 0,
    Number(ctx.themeToken?.zIndexPopupBase) || 1000) + 100;
}

/** Use the official container and place the UID view above its actual opener. */
export function PageUidEditor(props: any) {
  const { getContext, t } = props;
  const ctx = getContext();
  const route = ctx.model.getRoute();
  return <Space>
    <Typography.Text code copyable={{ text: route.schemaUid,
      tooltips: [t('Copy UID'), t('UID copied')] }}>{route.schemaUid}</Typography.Text>
    <Button type="text" size="small" icon={<EditOutlined />} title={t('Change UID')}
      aria-label={t('Change UID')} onClick={(event) => ctx.viewer.dialog({
        title: t('Change UID'), zIndex: uidDialogLayer(event.currentTarget, ctx), width: 560, maskClosable: false, keyboard: false, closable: false,
        content: (view: any) => <UidEditDialog {...props} view={view} />,
      })} />
  </Space>;
}

export function pageUidEditorField(ctx: any, t: (key: string) => string, addressPrefix: string) {
  return { type: 'string', title: 'UID', default: ctx.model.getRoute().schemaUid,
    'x-decorator': 'FormItem', 'x-component': PageUidEditor,
    // The schema compiler must never traverse the live context graph.
    'x-component-props': { getContext: () => ctx, t, addressPrefix } };
}
