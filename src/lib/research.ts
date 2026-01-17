import Cite from "citation-js";
import bibRaw from "../content/ref.bib?raw";

type CitationEntry = {
  keyword?: unknown;
  keywords?: unknown;
  issued?: {
    "date-parts"?: number[][];
    literal?: string;
  };
};

const cite = new Cite(bibRaw);

const emphasizeName = (html: string) =>
  html.replace(
    /Rodriguez, A\./g,
    '<span class="font-medium">Rodriguez, A.</span>'
  );

const linkifyUrls = (html: string) =>
  html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" class="underline underline-offset-2 hover:text-zinc-800" rel="noopener" target="_blank">$1</a>'
  );

const normalizeKeywords = (keywords: unknown) => {
  if (Array.isArray(keywords)) {
    return keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
  }

  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
};

const getEntryKeywords = (entry: CitationEntry) =>
  normalizeKeywords(entry.keyword ?? entry.keywords);

const getIssuedDateValue = (entry: CitationEntry) => {
  const issued = entry.issued;
  const dateParts = issued?.["date-parts"]?.[0];
  if (dateParts && dateParts.length > 0) {
    const [year, month = 1, day = 1] = dateParts;
    return year * 10000 + month * 100 + day;
  }

  if (issued?.literal) {
    const yearMatch = issued.literal.match(/(19|20)\d{2}/);
    if (yearMatch) {
      return Number(yearMatch[0]) * 10000;
    }
  }

  return 0;
};

const formatEntry = (entry: CitationEntry) => {
  const formatted = new Cite([entry]).format("bibliography", {
    format: "html",
    template: "apa",
    lang: "en-US",
  });
  const match = formatted.match(
    /<div data-csl-entry-id="[^"]+" class="csl-entry">[\s\S]*?<\/div>/
  );
  return match ? match[0] : "";
};

const formatBibliography = (entries: CitationEntry[]) =>
  emphasizeName(
    linkifyUrls(
      `<div class="csl-bib-body">${entries
        .map((entry) => formatEntry(entry))
        .filter(Boolean)
        .join("\n")}</div>`
    )
  );

const filterByKeywords = (wanted: string[]) =>
  [...cite.data]
    .filter((entry: CitationEntry) => {
      const entryKeywords = getEntryKeywords(entry);
      return wanted.some((keyword) => entryKeywords.includes(keyword));
    })
    .sort(
      (left, right) => getIssuedDateValue(right) - getIssuedDateValue(left)
    );

export const getResearchHtml = () => ({
  publicationsHtml: formatBibliography(filterByKeywords(["Publications"])),
  presentationsHtml: formatBibliography(
    filterByKeywords(["Conference Talks", "Conference Posters"])
  ),
});
