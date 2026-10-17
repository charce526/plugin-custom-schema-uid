import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import Manager from '../src/client-v2/UidManager';
import messages from '../src/locale/zh-CN.json';
const api = { async request(config: any) {
  const query = new URLSearchParams(config.params || {});
  const response = await fetch('/api/' + config.url + '?' + query, { method: config.method || 'get',
    headers: { 'content-type': 'application/json' }, body: config.data ? JSON.stringify(config.data) : undefined });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.errors?.[0]?.message), { response: { status: response.status, data } });
  return { data };
} };
createRoot(document.getElementById('root')!).render(<ConfigProvider locale={zhCN}>
  <div style={{ padding: 24, maxWidth: 1500, margin: 'auto' }}><p>本地隔离验收环境 · NocoBase 2.2.10 · MariaDB · V1 / V2</p>
    <Manager api={api} t={(key) => messages[key] || key} /></div>
</ConfigProvider>);
