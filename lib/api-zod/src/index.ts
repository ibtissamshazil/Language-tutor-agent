export * from "./generated/api";
export * from "./generated/types";

// Query-param names are generated both as zod schemas (in ./generated/api) and
// as TypeScript types (in ./generated/types), which collide under `export *`.
// Re-export the zod schema versions explicitly so they win the ambiguity — the
// runtime validators are the point of this package, and consumers that need the
// param *types* import them from @workspace/api-client-react instead.
export {
  GetLessonParams,
  UnmarkLessonCompletedParams,
} from "./generated/api";
