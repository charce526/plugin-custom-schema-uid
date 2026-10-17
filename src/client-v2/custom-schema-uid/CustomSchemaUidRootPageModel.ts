import { RootPageModel } from '@nocobase/client-v2';
import { uid } from '@nocobase/utils/client';
import { askCreationUid } from '../creationDialog';
import { PLUGIN_NAME } from '../../shared/uid';

/** Decide the UID before FlowEngine constructs a tab, so route, model and grid parent agree. */
export class CustomSchemaUidRootPageModel extends RootPageModel {
  createPageTabModelOptions: any = async () => {
    const pageUid = (this.context as any).currentRoute?.schemaUid || ':pageUid';
    const custom = await askCreationUid(this.context.api, (key) => this.context.t(key, { ns: [PLUGIN_NAME, 'client'] }), `/v/admin/${pageUid}/tabs/`);
    if (custom === null) return null;
    const tabUid = custom || uid();
    return { uid: tabUid, use: 'RootPageTabModel', props: { route: {
      parentId: this.props.routeId, type: 'tabs', schemaUid: tabUid, tabSchemaName: uid(),
      params: [], hideInMenu: false, enableTabs: false,
    } } };
  };
}
export default CustomSchemaUidRootPageModel;
