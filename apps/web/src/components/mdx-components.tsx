import type { MDXComponents } from "mdx/types";

// Element styling for MDX-authored static pages. Kept semantic so headings
// preserve document outline and links stay readable for screen readers.
export const mdxComponents: MDXComponents = {
  h1: (props) => <h1 className="mt-2 mb-6 font-bold text-3xl tracking-tight" {...props} />,
  h2: (props) => (
    <h2 className="mt-10 mb-4 border-b pb-2 font-semibold text-2xl tracking-tight" {...props} />
  ),
  h3: (props) => <h3 className="mt-8 mb-3 font-semibold text-xl tracking-tight" {...props} />,
  p: (props) => <p className="my-4 leading-7 text-foreground/90" {...props} />,
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      {...props}
    >
      {children}
    </a>
  ),
  ul: (props) => <ul className="my-4 ml-6 list-disc space-y-2" {...props} />,
  ol: (props) => <ol className="my-4 ml-6 list-decimal space-y-2" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-4 border-l-2 pl-4 text-muted-foreground italic" {...props} />
  ),
  hr: (props) => <hr className="my-8 border-border" {...props} />,
};
