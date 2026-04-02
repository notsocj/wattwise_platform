// Type declarations for importing plain CSS/SCSS files in TypeScript
// Allows side-effect imports like `import './globals.css'` in Next.js
declare module "*.css";
declare module "*.scss";
declare module "*.sass";

// CSS module support
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}