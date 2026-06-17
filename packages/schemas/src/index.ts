// Re-exports every shared Zod schema. Frontend infers form types from these;
// the API `.parse()`s request bodies against them.
export * from './accident';
export * from './assessment';
export * from './attendance';
export * from './child';
export * from './consent';
export * from './daily-log';
export * from './incident';
export * from './invoice';
export * from './medication';
export * from './message';
export * from './observation';
export * from './plans';
export * from './relative';
export * from './room';
export * from './session';
export * from './staff';
export * from './user';
