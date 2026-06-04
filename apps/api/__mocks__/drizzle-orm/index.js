// Mock drizzle-orm for vitest - tests mock the DB anyway
// Supports all drizzle-orm subpath exports: pg-core, node-postgres, etc.

const chainable = (base) => {
  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Unknown method → return chainable version
      return () => proxy;
    }
  });
  return proxy;
};

const colDef = (name) => {
  const obj = { _col: name };
  const methods = ['primaryKey', 'notNull', 'defaultRandom', 'references', 'unique', 
    'default', 'defaultNow', 'withTimezone', 'mode', 'onDelete', 'onUpdate',
    '$type', '$default', '$defaultFn'];
  for (const m of methods) {
    obj[m] = (...args) => colDef(name);
  }
  return obj;
};

// Core operators
export const eq = (a, b) => ({ type: 'eq', a, b });
export const and = (...args) => ({ type: 'and', args });
export const or = (...args) => ({ type: 'or', args });
export const not = (expr) => ({ type: 'not', expr });
export const desc = (col) => ({ type: 'desc', col });
export const asc = (col) => ({ type: 'asc', col });
export const inArray = (col, arr) => ({ type: 'inArray', col, arr });
export const notInArray = (col, arr) => ({ type: 'notInArray', col, arr });
export const sql = Object.assign(
  (template, ...args) => ({ type: 'sql', template, args }),
  { placeholder: () => ({}) }
);
export const isNull = (col) => ({ type: 'isNull', col });
export const isNotNull = (col) => ({ type: 'isNotNull', col });
export const lt = (a, b) => ({ type: 'lt', a, b });
export const lte = (a, b) => ({ type: 'lte', a, b });
export const gt = (a, b) => ({ type: 'gt', a, b });
export const gte = (a, b) => ({ type: 'gte', a, b });
export const ilike = (a, b) => ({ type: 'ilike', a, b });
export const like = (a, b) => ({ type: 'like', a, b });
export const ne = (a, b) => ({ type: 'ne', a, b });
export const between = (a, b, c) => ({ type: 'between', a, b, c });
export const exists = (subq) => ({ type: 'exists', subq });
export const count = (col) => ({ type: 'count', col: col ?? '*' });

// pg-core column types - chainable
export const uuid = (name) => colDef(name);
export const text = (name) => colDef(name);
export const bigint = (name, opts) => colDef(name);
export const integer = (name) => colDef(name);
export const boolean = (name) => colDef(name);
export const timestamp = (name, opts) => colDef(name);
export const jsonb = (name) => colDef(name);
export const numeric = (name, opts) => colDef(name);
export const varchar = (name, opts) => colDef(name);
export const date = (name) => colDef(name);
export const real = (name) => colDef(name);
export const doublePrecision = (name) => colDef(name);
export const serial = (name) => colDef(name);
export const bigserial = (name) => colDef(name);
export const smallint = (name) => colDef(name);
export const char = (name, opts) => colDef(name);
export const inet = (name) => colDef(name);
export const interval = (name) => colDef(name);
export const json = (name) => colDef(name);

// pgEnum: returns a function that when called returns a chainable column def
// The returned function also has .enumName and .enumValues for schema queries
export const pgEnum = (name, values) => {
  const enumFn = (colName) => colDef(colName);
  enumFn.enumName = name;
  enumFn.enumValues = values;
  return enumFn;
};

// pgTable
export const pgTable = (name, cols, extras) => {
  const table = { _name: name, _cols: cols, $inferInsert: {}, $inferSelect: {} };
  return table;
};

// Indexes
export const index = (name) => ({ on: () => index(name) });
export const uniqueIndex = (name) => ({ on: () => uniqueIndex(name) });

// drizzle-orm/node-postgres exports
export const drizzle = () => ({});
export const NodePgDatabase = null;

// GIN index for PostgreSQL
export const pg_extras = {};

export default {};
