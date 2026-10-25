/** Subset of the @dbml/parse `rawDb` output that the converter reads. */
interface DbmlField {
  name: string;
  type: { type_name: string };
  pk: boolean;
  unique: boolean;
}

interface DbmlIndex {
  pk?: boolean;
  unique?: boolean;
  columns: { type: string; value: string }[];
}

interface DbmlTableName {
  schemaName: string | null;
  name: string;
}

interface DbmlTable extends DbmlTableName {
  fields: DbmlField[];
  indexes: DbmlIndex[];
}

interface DbmlEndpoint {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  relation: string;
}

interface DbmlRef {
  endpoints: DbmlEndpoint[];
}

interface DbmlTableGroup {
  name: string;
  color?: string;
  tables: DbmlTableName[];
}

export interface DbmlDatabase {
  tables: DbmlTable[];
  refs: DbmlRef[];
  tableGroups: DbmlTableGroup[];
}

const DEFAULT_SCHEMA = "public";
const DEFAULT_GROUP_COLOR = "#64748B";

const tableKey = (table: DbmlTableName): string =>
  `${table.schemaName ?? DEFAULT_SCHEMA}.${table.name}`;

const endpointKey = (endpoint: DbmlEndpoint): string =>
  `${endpoint.schemaName ?? DEFAULT_SCHEMA}.${endpoint.tableName}`;

const entityName = (key: string): string => {
  const [schema, name] = key.split(".");
  return schema === DEFAULT_SCHEMA ? name : `${schema}_${name}`;
};

const sanitizeType = (type: string): string => {
  const cleaned = type.replace(/[^A-Za-z0-9_\-\[\]\(\).,]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `t_${cleaned}`;
};

const groupClassName = (group: DbmlTableGroup): string =>
  `group_${group.name.replace(/\W/g, "_")}`;

/**
 * Collects the "schema.table.field" ids of every foreign-key column: the many side of a
 * relationship, or the non-primary-key side of a one-to-one relationship.
 */
const collectForeignKeys = (
  refs: DbmlRef[],
  primaryKeys: Set<string>,
): Set<string> => {
  const foreignKeys = new Set<string>();
  for (const ref of refs) {
    const isOneToOne = ref.endpoints.every((e) => e.relation === "1");
    for (const endpoint of ref.endpoints) {
      const ids = endpoint.fieldNames.map(
        (field) => `${endpointKey(endpoint)}.${field}`,
      );
      const holdsKey = isOneToOne
        ? ids.some((id) => !primaryKeys.has(id))
        : endpoint.relation === "*";
      if (holdsKey) ids.forEach((id) => foreignKeys.add(id));
    }
  }
  return foreignKeys;
};

/** Collects the "schema.table.field" ids of every column in a single or composite primary key. */
const collectPrimaryKeys = (tables: DbmlTable[]): Set<string> => {
  const primaryKeys = new Set<string>();
  for (const table of tables) {
    const key = tableKey(table);
    table.fields
      .filter((field) => field.pk)
      .forEach((field) => primaryKeys.add(`${key}.${field.name}`));
    table.indexes
      .filter((index) => index.pk)
      .flatMap((index) => index.columns)
      .filter((column) => column.type === "column")
      .forEach((column) => primaryKeys.add(`${key}.${column.value}`));
  }
  return primaryKeys;
};

/** Collects the "schema.table.field" ids of columns that are unique on their own. */
const collectUniqueKeys = (tables: DbmlTable[]): Set<string> => {
  const uniqueKeys = new Set<string>();
  for (const table of tables) {
    const key = tableKey(table);
    table.fields
      .filter((field) => field.unique)
      .forEach((field) => uniqueKeys.add(`${key}.${field.name}`));
    table.indexes
      .filter((index) => index.unique && index.columns.length === 1)
      .forEach((index) => uniqueKeys.add(`${key}.${index.columns[0].value}`));
  }
  return uniqueKeys;
};

const entityLines = (
  table: DbmlTable,
  keySets: { pk: Set<string>; fk: Set<string>; uk: Set<string> },
): string[] => {
  const key = tableKey(table);
  const attributes = table.fields.map((field) => {
    const id = `${key}.${field.name}`;
    const keys = [
      keySets.pk.has(id) ? "PK" : null,
      keySets.fk.has(id) ? "FK" : null,
      keySets.uk.has(id) && !keySets.pk.has(id) ? "UK" : null,
    ].filter(Boolean);
    const suffix = keys.length > 0 ? ` ${keys.join(", ")}` : "";
    return `    ${sanitizeType(field.type.type_name)} ${field.name}${suffix}`;
  });
  return [`  ${entityName(key)} {`, ...attributes, "  }"];
};

const relationshipLine = (ref: DbmlRef): string | null => {
  if (ref.endpoints.length !== 2) return null;
  const [from, to] = ref.endpoints;
  const left = from.relation === "*" ? "}o" : "||";
  const right = to.relation === "*" ? "o{" : "||";
  const foreignKeySide = from.relation === "*" ? from : to;
  const label = foreignKeySide.fieldNames.join(", ");
  return `  ${entityName(endpointKey(from))} ${left}--${right} ${entityName(endpointKey(to))} : "${label}"`;
};

/**
 * Converts a parsed DBML database into Mermaid `erDiagram` source.
 *
 * @param database The `compiler.parse.rawDb()` output from @dbml/parse.
 * @param groupName When set, draws only the tables of this `TableGroup` with full columns, plus
 *     the tables they reference as column-less neighbours. When omitted, draws every table.
 * @returns Mermaid diagram source, with tables coloured by their table group.
 * @throws Error if `groupName` does not match any table group.
 */
export const toMermaidErDiagram = (
  database: DbmlDatabase,
  groupName?: string,
): string => {
  const { tables, refs, tableGroups: groups } = database;

  let focus: Set<string>;
  if (groupName) {
    const group = groups.find((g) => g.name === groupName);
    if (!group) throw new Error(`Table group "${groupName}" not found`);
    focus = new Set(group.tables.map(tableKey));
  } else {
    focus = new Set(tables.map(tableKey));
  }

  const visibleRefs = refs.filter((ref) =>
    ref.endpoints.some((endpoint) => focus.has(endpointKey(endpoint))),
  );
  const neighbours = new Set(
    visibleRefs
      .flatMap((ref) => ref.endpoints.map(endpointKey))
      .filter((key) => !focus.has(key)),
  );

  const primaryKeys = collectPrimaryKeys(tables);
  const keySets = {
    pk: primaryKeys,
    fk: collectForeignKeys(refs, primaryKeys),
    uk: collectUniqueKeys(tables),
  };

  const lines = ["erDiagram"];
  tables
    .filter((table) => focus.has(tableKey(table)))
    .forEach((table) => lines.push(...entityLines(table, keySets)));
  visibleRefs
    .map(relationshipLine)
    .filter((line): line is string => line !== null)
    .forEach((line) => lines.push(line));

  for (const group of groups) {
    const members = group.tables
      .map(tableKey)
      .filter((key) => focus.has(key))
      .map(entityName);
    if (members.length === 0) continue;
    const color = group.color ?? DEFAULT_GROUP_COLOR;
    lines.push(
      `  classDef ${groupClassName(group)} fill:${color}1F,stroke:${color},stroke-width:2px`,
    );
    lines.push(`  class ${members.join(",")} ${groupClassName(group)}`);
  }

  if (neighbours.size > 0) {
    lines.push(
      "  classDef neighbour fill:#F8FAFC,stroke:#94A3B8,stroke-dasharray:4",
    );
    lines.push(`  class ${[...neighbours].map(entityName).join(",")} neighbour`);
  }

  return lines.join("\n");
};
