import { JSONPatch } from './jsonPatch';

// We use a function as the target so that `push` and other array methods can be called without error.
const proxyFodder = {} as any;

/**
 * Makes all properties in T required recursively, including nested objects and arrays so that they
 * can be used with the JSONPatch API. (e.g. helps assume they exist so properties within can be safely accessed)
 */
export type DeepRequired<T> =
  T extends Array<infer U>
    ? Array<DeepRequired<U>>
    : T extends Record<string, any>
      ? { [K in keyof T]-?: DeepRequired<T[K]> }
      : T;

/**
 * Creates a proxy object that can be used in two ways:
 *
 * 1.  **Path Generation:** When used without a `JSONPatch` instance, accessing properties
 *     on the proxy generates a JSON Pointer path string via `toString()`. This allows
 *     for type-safe path creation when using `JSONPatch` methods directly.
 *     ```ts
 *     const patch = new JSONPatch();
 *     const proxy = createPatchProxy<MyType>();
 *     patch.replace(proxy.name.first, 'Bob'); // Path is '/name/first'
 *     console.log(patch.ops); // [{ op: 'replace', path: '/name/first', value: 'Bob' }]
 *     ```
 *
 * 2.  **Automatic Patch Generation:** When created with a target object and a `JSONPatch`
 *     instance, modifying the proxy (setting properties, calling array methods like
 *     `push`, `splice`, etc.) automatically generates the corresponding JSON Patch
 *     operations and adds them to the provided `patch` instance.
 *     ```ts
 *     const patch = new JSONPatch();
 *     const myObj = { name: { first: 'Alice' }, tags: ['a'] };
 *     const proxy = createPatchProxy(myObj, patch);
 *     proxy.name.first = 'Bob'; // Generates replace op
 *     proxy.tags.push('b');     // Generates add op
 *     console.log(patch.ops);
 *     // [
 *     //   { op: 'replace', path: '/name/first', value: 'Bob' },
 *     //   { op: 'add', path: '/tags/1', value: 'b' }
 *     // ]
 *     ```
 *
 * The proxy uses `DeepRequired<T>` to ensure all nested properties are treated as present,
 * simplifying path generation and modification tracking. It behaves like the original
 * value in most contexts due to the `valueOf` trap.
 *
 * @template T The type of the object to proxy.
 * @param target The target object (required for automatic patch generation mode).
 * @param patch The `JSONPatch` instance to add generated operations to (required for automatic patch generation mode).
 * @returns A proxy object of type `DeepRequired<T>`.
 */
export function createPatchProxy<T>(): DeepRequired<T>;
export function createPatchProxy<T>(target: T, patch: JSONPatch): DeepRequired<T>;
export function createPatchProxy<T>(target?: T, patch?: JSONPatch): DeepRequired<T> {
  // Call the internal implementation
  return createPatchProxyInternal(target, patch);
}

// Internal implementation with the path parameter
function createPatchProxyInternal<T>(target?: T, patch?: JSONPatch, path = ''): DeepRequired<T> {
  // Always use an empty function as the proxy target
  // This allows us to proxy any type of value, including primitives and undefined,
  // and enables calling array methods like push/splice directly on array proxies.
  return new Proxy(proxyFodder, {
    get(_, prop: string | symbol) {
      // Return the value directly for symbol properties (not relevant for JSON paths)
      if (typeof prop === 'symbol') {
        return (target as any)?.[prop];
      }

      // Handle toString specially to make properties work as PathLike
      if (prop === 'toString') {
        return function () {
          return path;
        };
      }

      // Handle valueOf to make the proxy behave like the original value in most contexts
      if (prop === 'valueOf') {
        return function () {
          return target;
        };
      }

      // --- Array Method Interception ---
      if (Array.isArray(target)) {
        switch (prop) {
          case 'push':
            return (...items: any[]) => {
              const index = target.length;
              for (let i = 0; i < items.length; i++) {
                patch?.add(`${path}/${index + i}`, items[i]);
              }
              return Array.prototype.push.apply(target, items);
            };
          case 'pop':
            return () => {
              const index = target.length - 1;
              if (index >= 0) {
                patch?.remove(`${path}/${index}`);
              }
              return Array.prototype.pop.call(target);
            };
          case 'shift':
            return () => {
              if (target.length > 0) {
                patch?.remove(`${path}/0`);
              }
              return Array.prototype.shift.call(target);
            };
          case 'unshift':
            return (...items: any[]) => {
              for (let i = 0; i < items.length; i++) {
                patch?.add(`${path}/${i}`, items[i]);
              }
              return Array.prototype.unshift.apply(target, items);
            };
          case 'splice':
            return (start: number, deleteCount?: number, ...items: any[]) => {
              const actualStart = start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
              const actualDeleteCount = Math.min(
                Math.max(deleteCount === undefined ? target.length - actualStart : deleteCount, 0),
                target.length - actualStart
              );

              // Remove deleted elements
              for (let i = 0; i < actualDeleteCount; i++) {
                patch?.remove(`${path}/${actualStart}`); // Path automatically adjusts for subsequent removes
              }

              // Add new elements
              for (let i = 0; i < items.length; i++) {
                patch?.add(`${path}/${actualStart + i}`, items[i]);
              }

              // Use the native splice method with the correct typing
              return Array.prototype.splice.apply(target, [start, deleteCount!, ...items]); // deleteCount! is safe due to default calculation logic
            };
        }
      }
      // --- End Array Method Interception ---

      // Create a proxy for the property value if it's not an intercepted array method
      // This handles objects, primitives, and undefined values uniformly
      // Call the internal implementation recursively
      return createPatchProxyInternal((target as any)?.[prop], patch, `${path}/${String(prop)}`);
    },

    set(_, prop: string | symbol, value: any): boolean {
      // Ignore setting the 'length' property on arrays directly
      if (Array.isArray(target) && prop === 'length') {
        return true;
      }

      if ((target as any)?.[prop] === value) return true;

      const patchPath = `${path}/${String(prop)}`;

      if (value === undefined) {
        patch?.remove(patchPath);
      } else {
        patch?.replace(patchPath, value);
      }

      return true;
    },

    deleteProperty(_, prop: string | symbol): boolean {
      if (target == null || prop in (target as any)) {
        patch?.remove(`${path}/${String(prop)}`);
      }
      return true;
    },

    // Apply trap is no longer needed for array methods, but might be needed if proxying functions directly
    // apply(_, thisArg: any, argumentsList: any[]) {
    //   // If the target is a function, call it
    //   if (typeof target === 'function') {
    //     return (target as Function).apply(thisArg, argumentsList);
    //   }
    //   // Otherwise, it's likely an error (e.g., trying to call a non-function property)
    //   // Or handle other callable types if necessary
    // },

    // Make the proxy appear to be the same type as the target
    getPrototypeOf() {
      return Object.getPrototypeOf(target);
    },

    // Support instanceof checks
    isExtensible() {
      return target != null && Object.isExtensible(target as object);
    },

    // Support Object.keys and other enumeration methods
    ownKeys() {
      return target != null && typeof target === 'object' ? Reflect.ownKeys(target) : [];
    },

    // Support property descriptor access
    getOwnPropertyDescriptor(_, prop) {
      if (target == null || typeof target !== 'object') return undefined;
      return Object.getOwnPropertyDescriptor(target, prop as PropertyKey);
    },

    // Support Object.hasOwnProperty
    has(_, prop) {
      return target != null && typeof target === 'object' && prop in target;
    },
  }) as DeepRequired<T>;
}
