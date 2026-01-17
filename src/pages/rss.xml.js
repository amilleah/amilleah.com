import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function GET(context) {
  const now = await getCollection("now");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: now.map((post) => ({
      ...post.data,
      link: `/now/${post.slug}/`,
    })),
  });
}
