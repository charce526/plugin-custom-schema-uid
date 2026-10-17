import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'xzUidOperations', dataCategory: 'system', dumpRules: 'required', autoGenId: false,
  fields: [
    { name: 'id', type: 'string', primaryKey: true },
    { name: 'userId', type: 'bigInt' },
    { name: 'status', type: 'string' },
    { name: 'payload', type: 'json' },
    { name: 'result', type: 'json' },
  ],
});
