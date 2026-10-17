import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'xzUidAliases', dataCategory: 'system', dumpRules: 'required', autoGenId: false,
  fields: [
    { name: 'uid', type: 'string', primaryKey: true },
    { name: 'routeId', type: 'bigInt', allowNull: false },
  ],
});
