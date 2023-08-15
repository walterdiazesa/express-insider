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

export type AnyButNullish = boolean | number | string | object | ((...any) => any);

type UnionToIoF<U> =
    (U extends any ? (k: (x: U) => void) => void : never) extends
    ((k: infer I) => void) ? I : never

type UnionPop<U> = UnionToIoF<U> extends { (a: infer A): void; } ? A : never;

type Prepend<U, T extends any[]> =
    ((a: U, ...r: T) => void) extends (...r: infer R) => void ? R : never;

type UnionToTupleRecursively<Union, Result extends any[]> = {
    1: Result;
    0: UnionToTupleRecursively_<Union, UnionPop<Union>, Result>;
}[[Union] extends [never] ? 1 : 0];

type UnionToTupleRecursively_<Union, Element, Result extends any[]> =
    UnionToTupleRecursively<Exclude<Union, Element>, Prepend<Element, Result>>;

type UnionToTuple<U> = UnionToTupleRecursively<U, []>;

// @ts-ignore
export type KeyLength<T> = UnionToTuple<T>['length'];

export * from './definitions'