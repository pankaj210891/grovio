/**
 * Type shim for 'motion/react'.
 *
 * framer-motion v12 is published as the 'framer-motion' npm package
 * but the recommended import path is 'motion/react' (see CLAUDE.md).
 * The standalone 'motion' npm package is the future home but framer-motion
 * v12 re-exports the same API. This shim satisfies the TypeScript resolver
 * without requiring an additional npm package install.
 */
declare module 'motion/react' {
  export * from 'framer-motion';
}
