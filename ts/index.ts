export type LooseAutocomplete<T extends string> = T | Omit<string, T>;

type BuildTuple<L extends number, T extends any[] = []> = 
    T extends { length: L } ? T : BuildTuple<L, [...T, any]>;
type Length<T extends any[]> = 
    T extends { length: infer L } ? L : never;
type Add<A extends number, B extends number> = 
    Length<[...BuildTuple<A>, ...BuildTuple<B>]>;

export type Find<T extends readonly string[], SEARCH extends T[number], C extends number = 0> = T extends readonly [infer TFirst, ...infer TRest]
? TFirst extends SEARCH
  ? C
  // @ts-ignore
  : Find<TRest, SEARCH, Add<C, 1>>
: never;

export * from './definitions'