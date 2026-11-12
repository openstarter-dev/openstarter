import { Link } from "@tanstack/react-router";

export type BlogCardProps = {
  slug: string;
  title: string;
  description: string | null;
  image: string | null;
  date: string;
  authorName: string | null;
  authorImage: string | null;
};

export function BlogCard({
  slug,
  title,
  description,
  image,
  date,
  authorName,
  authorImage,
}: BlogCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card ring-1 ring-foreground/5 transition-colors hover:ring-foreground/15">
      <Link className="group flex flex-1 flex-col" params={{ slug }} to="/blog/$slug">
        {image ? (
          <img
            alt={title}
            className="aspect-video w-full object-cover"
            decoding="async"
            loading="lazy"
            src={image}
          />
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="font-medium text-base group-hover:underline">{title}</h2>
          {description ? (
            <p className="line-clamp-3 text-muted-foreground text-sm">{description}</p>
          ) : null}
          <div className="mt-auto flex items-center gap-2 pt-3 text-muted-foreground text-xs">
            {authorImage ? (
              <img
                alt=""
                className="size-5 rounded-full object-cover"
                decoding="async"
                loading="lazy"
                src={authorImage}
              />
            ) : null}
            {authorName ? <span>{authorName}</span> : null}
            <time>{date}</time>
          </div>
        </div>
      </Link>
    </article>
  );
}
