import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Descriptions, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { normalizeUid, RESOURCE } from '../shared/uid';
import { buildRouteTree } from './routeTree';
import ImpactSummary from './ImpactSummary';

const errorText = (error: any) => error.response?.data?.errors?.[0]?.message || error.message || String(error);
const warning = 'Changing a UID changes its address and may affect links, embeds, bookmarks, scripts and external systems. Review the impact every time.';
const typeNames = { page: 'V1 page', flowPage: 'V2 page', tabs: 'Tab', group: 'Group', link: 'Link' };

function ManualChecks({ warnings, t }: { warnings: string[]; t: (key: string) => string }) {
  if (!warnings?.length) return null;
  return <div><Typography.Text type="warning">{t('Custom references require manual review.')}</Typography.Text>
    <details><summary>{t('Show reference locations')}</summary><ul>
      {warnings.map((location) => <li key={location}><Typography.Text code>{location}</Typography.Text></li>)}
    </ul></details></div>;
}

export default function UidManager({ api, t, modern = true }: { api: any; t: (key: string) => string; modern?: boolean }) {
  const [rows, setRows] = useState<any[]>([]), [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [version, setVersion] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [expanded, setExpanded] = useState<React.Key[]>([]);
  const [editing, setEditing] = useState<any>(), [newUid, setNewUid] = useState('');
  const [preview, setPreview] = useState<any>(), [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [uncertain, setUncertain] = useState(false), [result, setResult] = useState<any>();
  const [creating, setCreating] = useState(false), [form] = Form.useForm();
  const type = Form.useWatch('type', form) || 'flowPage';
  const creationUid = Form.useWatch('uid', form);
  const parentId = Form.useWatch('parentId', form);
  const parent = parents.find((row) => String(row.id) === String(parentId));
  const expectedAddress = (modern ? '/v/admin/' : '/admin/') + (type === 'tabs' ? `${parent?.schemaUid || `（${t('Parent page UID')}）`}/tabs/` : '') + (creationUid?.trim() || `（${t('Automatically generated')}）`);
  const request = async (action: string, data?: any, params?: any) => (await api.request({ url: `${RESOURCE}:${action}`,
    method: data === undefined ? 'get' : 'post', data, params })).data.data;
  const refresh = async () => {
    setLoading(true); setError('');
    try { setRows(await request('list')); setParents(await request('parents')); }
    catch (error) { setError(errorText(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const notify = () => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('xz-schema-uid'); channel.postMessage('changed'); channel.close();
    }
  };
  const finish = async (data: any) => {
    setResult(data); setUncertain(false); setEditing(undefined); setPreview(undefined); notify(); await refresh();
  };
  const checkStatus = async () => {
    setBusy(true);
    try {
      const status = await request('status', undefined, { id: preview.id });
      if (status.status === 'completed') await finish(status.result);
      else { setUncertain(false); setError(t('No committed change was found. Recheck the impact before retrying.')); setPreview(undefined); }
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await finish(await request('execute', { id: preview.id, confirmed: true })); }
    catch (error: any) {
      if (!error.response || error.response.status >= 500) {
        setUncertain(true); setError(t('The execution result is not yet known. Query its status before retrying.'));
      } else { setError(errorText(error)); setPreview(undefined); setAccepted(false); }
    } finally { busyRef.current = false; setBusy(false); }
  };
  const confirm = () => Modal.confirm({ title: t('Confirm UID change'),
    content: <Space direction="vertical"><Typography.Text>{editing.title}</Typography.Text>
      <Typography.Text code>{preview.from} → {preview.to}</Typography.Text>
      <Alert type="warning" showIcon message={t('Old addresses will redirect to the new address while this plugin is enabled. Check custom scripts and external references manually.')} />
    </Space>, okText: t('Confirm UID change'), cancelText: t('Cancel'), onOk: execute });
  const dataSource = buildRouteTree(rows, search, version, showHidden);
  const edit = (row: any) => { setEditing(row); setNewUid(row.schemaUid); setPreview(undefined); setAccepted(false); setError(''); setUncertain(false); };
  const pathOf = (row: any) => modern ? row.path : row.legacyPath;
  return <Card title={t('Custom Page UID')} extra={<Button onClick={() => { form.resetFields(); setCreating(true); }}>{t('Create page or tab')}</Button>}>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert showIcon type="info" message={t('Supports V1 and V2. Changes preserve content, layout and route permissions. Page and tab UIDs are managed independently.')} />
      {error && !editing && <Alert type="error" showIcon message={t(error)} closable onClose={() => setError('')} />}
      {result && <Alert type="success" showIcon closable onClose={() => setResult(undefined)} message={t('UID changed successfully')}
        description={<Space direction="vertical"><Typography.Text code>{result.from} → {result.to}</Typography.Text>
          <a href={modern ? result.newPath : result.newPath.replace('/v/admin/', '/admin/')} target="_blank" rel="noreferrer">{t('Open new address')}</a>
          <Typography.Text>{t('Old addresses will redirect to the new address while this plugin is enabled. Check custom scripts and external references manually.')}</Typography.Text>
          <ManualChecks warnings={result.warnings} t={t} />
        </Space>} />}
      <Space wrap><Input.Search placeholder={t('Search title or UID')} value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 320 }} />
        <Select value={version} onChange={setVersion} style={{ width: 120 }} options={['all', 'V1', 'V2'].map((value) => ({ value, label: value === 'all' ? t('All versions') : value }))} />
        <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
        <Button onClick={() => setExpanded(rows.map((row) => row.id))}>{t('Expand all')}</Button>
        <Button onClick={() => setExpanded([])}>{t('Collapse all')}</Button>
        <Space><Switch checked={showHidden} onChange={setShowHidden} size="small" /><span>{t('Show hidden tabs and routes')}</span></Space>
      </Space>
      <Typography.Text type="secondary">{t('The hierarchy and order follow the official desktop routes page. Groups and links are displayed for context; only page and tab UIDs can be changed.')}</Typography.Text>
      <Table rowKey="id" loading={loading} dataSource={dataSource} pagination={false} expandable={{ expandedRowKeys: expanded, onExpandedRowsChange: (keys) => setExpanded([...keys]) }} scroll={{ x: 900 }} columns={[
        { title: t('Title'), dataIndex: 'title', render: (value, row) => <Space>{value || t('Default tab')}{row.hidden && <Tag>{t('Hidden')}</Tag>}</Space> },
        { title: t('Type'), render: (_, row) => t(typeNames[row.type] || row.type) },
        { title: 'UID', dataIndex: 'schemaUid', render: (value, row) => ['group', 'link'].includes(row.type) ? '—' : <Typography.Text code copyable>{value}</Typography.Text> },
        { title: t('Address'), render: (_, row) => pathOf(row) ? <Typography.Text copyable={{ text: /^https?:/.test(pathOf(row)) ? pathOf(row) : location.origin + pathOf(row) }}><a href={pathOf(row)} target="_blank" rel="noreferrer">{pathOf(row)}</a></Typography.Text> : '—' },
        { title: t('Actions'), render: (_, row) => ['page', 'flowPage', 'tabs'].includes(row.type) ? <Button onClick={() => edit(row)}>{t('Change UID')}</Button> : <Typography.Text type="secondary">{t('Read only')}</Typography.Text> },
      ]} />
    </Space>
    <Modal open={!!editing} title={t('Change UID')} width={760} maskClosable={false} closable={!busy && !uncertain}
      onCancel={() => { if (!busy && !uncertain) setEditing(undefined); }} footer={null}>
      {editing && <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert type="warning" showIcon message={t(warning)} />
        {error && <Alert type="error" showIcon message={t(error)} />}
        <Descriptions size="small" column={1} bordered items={[
          { key: 'title', label: t('Title'), children: editing.title || t('Default tab') },
          { key: 'type', label: t('Type'), children: `${editing.version} · ${t(editing.type === 'tabs' ? 'Tab' : 'Page')}` },
          { key: 'parent', label: t('Parent'), children: editing.parentTitle || '—' },
          { key: 'uid', label: t('Current UID'), children: editing.schemaUid },
          { key: 'path', label: t('Current address'), children: pathOf(editing) },
        ]} />
        <Form layout="vertical"><Form.Item label={t('New UID')} extra={t('Letters, digits, underscores and hyphens; cannot start with a hyphen; maximum 64 characters.')}>
          <Input value={newUid} maxLength={64} disabled={busy || uncertain} onChange={(e) => { setNewUid(e.target.value); setPreview(undefined); setAccepted(false); }} />
        </Form.Item></Form>
        {!preview && <Button type="primary" loading={busy} disabled={newUid.trim() === editing.schemaUid} onClick={async () => {
          setBusy(true); setError('');
          try { setPreview(await request('preview', { routeId: editing.id, uid: normalizeUid(newUid) })); setAccepted(false); }
          catch (error) { setError(errorText(error)); } finally { setBusy(false); }
        }}>{t('Check impact and continue')}</Button>}
        {preview && <>
          <Alert type="warning" showIcon message={t('Review the old and new identifiers and all affected references. This preview has not changed the page.')}
            description={<Space direction="vertical"><Typography.Text code>{preview.from} → {preview.to}</Typography.Text>
              <Typography.Text>{t('New address')}{t(': ')}{modern ? preview.newPath : preview.newPath.replace('/v/admin/', '/admin/')}</Typography.Text>
              <ImpactSummary counts={preview.counts} t={t} />
              <Typography.Text>{t('Old addresses will redirect to the new address while this plugin is enabled. Check custom scripts and external references manually.')}</Typography.Text>
              <ManualChecks warnings={preview.warnings} t={t} />
            </Space>} />
          <Checkbox checked={accepted} disabled={busy || uncertain} onChange={(e) => setAccepted(e.target.checked)}>{t('I understand the impact and have checked the target and new UID.')}</Checkbox>
          {uncertain ? <Button loading={busy} onClick={checkStatus}>{t('Query execution status')}</Button> :
            <Button danger type="primary" disabled={!accepted} loading={busy} onClick={confirm}>{t('Continue to final confirmation')}</Button>}
        </>}
      </Space>}
    </Modal>
    <Modal open={creating} title={t('Create page or tab')} onCancel={() => !busy && setCreating(false)} confirmLoading={busy} maskClosable={false}
      onOk={async () => {
        try {
          const values = await form.validateFields(); setBusy(true); setError('');
          await request('create', { ...values, uid: normalizeUid(values.uid, true), tabUid: normalizeUid(values.tabUid, true) });
          setCreating(false); notify(); await refresh();
        } catch (error: any) { if (!error.errorFields) setError(errorText(error)); }
        finally { setBusy(false); }
      }}>
      {error && <Alert type="error" message={t(error)} />}
      <Form form={form} layout="vertical" initialValues={{ type: 'flowPage' }}>
        <Form.Item name="type" label={t('Type')}><Select onChange={() => form.setFieldValue('parentId', undefined)} options={[
          { value: 'page', label: t('V1 page') }, { value: 'flowPage', label: t('V2 page') }, { value: 'tabs', label: t('Tab') },
        ]} /></Form.Item>
        <Form.Item name="parentId" label={t('Parent')} rules={[{ required: type === 'tabs', message: t('Select a parent page') }]}>
          <Select allowClear showSearch optionFilterProp="label" options={parents.filter((r) => type === 'tabs' ? ['page', 'flowPage'].includes(r.type) : r.type === 'group')
            .map((r) => ({ value: String(r.id), label: `${r.title || r.schemaUid}（${t(typeNames[r.type] || r.type)}）` }))} />
        </Form.Item>
        <Form.Item name="title" label={t('Title')} rules={[{ required: true, whitespace: true, message: t('Please enter a title.') }]}><Input maxLength={255} /></Form.Item>
        <Form.Item name="uid" label={t('Custom schema UID')} extra={t('Leave empty to auto-generate. The UID is checked again by the server when saved.')}><Input maxLength={64} /></Form.Item>
        <Form.Item label={t('Expected address')}><Typography.Text code>{expectedAddress}</Typography.Text></Form.Item>
        {type !== 'tabs' && <Form.Item name="tabUid" label={t('Default tab UID')}><Input maxLength={64} /></Form.Item>}
      </Form>
    </Modal>
  </Card>;
}
