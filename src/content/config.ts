import { defineCollection, z } from "astro:content";

const now = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    image: z.string().default("/static/blog-placeholder.png"),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const collections = { now };
