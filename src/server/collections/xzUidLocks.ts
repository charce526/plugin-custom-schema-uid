import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'xzUidLocks', dataCategory: 'system', dumpRules: 'required', autoGenId: false, timestamps: false,
  fields: [{ name: 'id', type: 'string', primaryKey: true }, { name: 'revision', type: 'integer', defaultValue: 0 }],
});
