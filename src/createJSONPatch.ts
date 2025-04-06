import { JSONPatch } from './jsonPatch';
import { createPatchProxy, type DeepRequired } from './patchProxy';

/**
 * Creates a `JSONPatch` instance by tracking changes made to a proxy object within an updater function.
 *
 * This provides a convenient way to generate patches based on direct object manipulation.
 * The `updater` function receives a proxy of the `target` object and the `JSONPatch` instance.
 * Modifications made to the proxy object (setting properties, calling array methods)
 * are automatically converted into JSON Patch operations and added to the patch instance.
 * You can also directly call methods on the `patch` instance within the updater.
 *
 * @template T The type of the target object.
 * @param target The initial state of the object.
 * @param updater A function that receives a proxy of the target and a `JSONPatch` instance.
 *                Modify the proxy or call patch methods within this function to generate operations.
 * @returns A `JSONPatch` instance containing the operations generated within the updater.
 *
 * @example
 * ```ts
 * const myObj = { name: { first: 'Alice' }, age: 30, tags: ['a'] };
 *
 * const patch = createJSONPatch(myObj, (proxy, p) => {
 *   proxy.name.first = 'Bob'; // Generates a 'replace' op via the proxy
 *   proxy.tags.push('b');     // Generates an 'add' op via the proxy
 *   p.increment(proxy.age, 1); // Directly adds an 'increment' op
 * });
 *
 * console.log(patch.ops);
 * // [
 * //   { op: 'replace', path: '/name/first', value: 'Bob' },
 * //   { op: 'add', path: '/tags/1', value: 'b' },
 * //   { op: 'increment', path: '/age', value: 1 }
 * // ]
 * ```
 */
export function createJSONPatch<T>(target: T, updater: (proxy: DeepRequired<T>, patch: JSONPatch) => void): JSONPatch {
  const patch = new JSONPatch();
  // Use the specific overload of createPatchProxy that takes target and patch
  updater(createPatchProxy(target, patch), patch);
  return patch;
}
