declare module "*.mdx" {
  const MDXContent: import("react").FC<import("mdx/types").MDXProps>;
  export default MDXContent;
}
