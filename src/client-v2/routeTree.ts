/** Input order is the official repository's `sort` order; never re-sort by title, UID or primary key. */
export function buildRouteTree(rows: any[], search = '', version = 'all', showHidden = false): any[] {
  const nodes = new Map(rows.map((row) => [String(row.id), { ...row, children: [] as any[] }]));
  const roots: any[] = [];
  for (const row of rows) {
    const node = nodes.get(String(row.id));
    const parent = nodes.get(String(row.parentId));
    if (parent && parent !== node) parent.children.push(node); else roots.push(node);
  }
  const query = search.trim().toLowerCase();
  const visited = new Set<string>();
  function filter(node: any, inheritedMatch = false): any {
    if (visited.has(String(node.id)) || (!showHidden && node.hidden)) return null;
    visited.add(String(node.id));
    const matches = !query || `${node.title || ''} ${node.schemaUid || ''}`.toLowerCase().includes(query);
    const children = node.children.map((child) => filter(child, inheritedMatch || matches)).filter(Boolean);
    const matchesVersion = version === 'all' || node.version === version;
    if (!children.length && (!(inheritedMatch || matches) || !matchesVersion)) return null;
    const result = { ...node };
    if (children.length) result.children = children; else delete result.children;
    return result;
  }
  return roots.map((node) => filter(node)).filter(Boolean);
}
