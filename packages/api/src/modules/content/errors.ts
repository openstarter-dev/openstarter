export class SlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Slug '${slug}' already exists`);
    this.name = "SlugConflictError";
    this.slug = slug;
  }
}
