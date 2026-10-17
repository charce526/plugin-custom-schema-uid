import React from 'react';
import { Typography } from 'antd';

const explanations = {
  desktopRoutes: ['Route information', 'Update the address identifier of the selected page or tab.'],
  uiSchemas: ['V1 page configuration', 'Update the identifier and supported references in existing page configuration.'],
  uiSchemaTreePath: ['V1 configuration hierarchy', 'Update hierarchy references between the page, tabs and internal blocks.'],
  flowModels: ['V2 model configuration', 'Update the model identifier and supported references while keeping existing settings.'],
  flowModelTreePath: ['V2 configuration hierarchy', 'Update hierarchy references between the page, tabs and internal blocks.'],
  uiSchemaServerHooks: ['Server hooks', 'Update supported references in server-side interactions.'],
  uiButtonSchemasRoles: ['Schema permissions', 'Keep existing role access linked to the new identifier.'],
};

export default function ImpactSummary({ counts, t }: { counts: Record<string, number>; t: (key: string) => string }) {
  return <div>
    <Typography.Paragraph strong>{t('The following configuration records will be updated:')}</Typography.Paragraph>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      {Object.entries(counts).filter(([, count]) => count > 0).map(([key, count]) => {
        const [label, description] = explanations[key] || ['Other configuration', 'Update supported configuration references.'];
        return <li key={key} style={{ marginBottom: 10 }}>
          <Typography.Text strong>{t(label)}{t(': ')}{count} {t('records')}{t('.')}</Typography.Text>
          <div>{t(description)}</div>
        </li>;
      })}
    </ul>
    <Typography.Paragraph>{t('These numbers count internal configuration records, not pages, blocks or business data. A node can have a separate hierarchy record for each ancestor, so the hierarchy count may be large.')}</Typography.Paragraph>
    <Typography.Paragraph style={{ marginBottom: 0 }}>{t('Existing page content, block layouts and business data will be preserved.')}</Typography.Paragraph>
  </div>;
}
