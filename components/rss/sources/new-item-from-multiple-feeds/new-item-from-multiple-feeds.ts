import rss from "../../app/rss.app";
import { defineSource } from "@pipedream/types";
import rssCommon from "../common/common";
import nlp from "compromise";

export default defineSource({
  ...rssCommon,
  key: "rss-new-item-from-multiple-feeds",
  name: "New Item From Multiple RSS Feeds",
  type: "source",
  description: "Emit new items from multiple RSS feeds",
  version: "1.1.0",
  props: {
    ...rssCommon.props,
    urls: {
      propDefinition: [
        rss,
        "urls",
      ],
      description: "Enter one or multiple URLs from any public RSS feed. To avoid timeouts, 5 or less URLs is recommended.",
    },
    max: {
      type: "integer",
      label: "Max per Feed",
      description: "Maximum number of posts per feed to retrieve at one time. Defaults to 20.",
      optional: true,
      default: 20,
    },
    keywords: {
      type: "string[]",
      label: "Keywords",
      description: "Filters the RSS feed to only include items with a title, description or category matching a keyword",
    },
  },
  dedupe: "unique",
  hooks: {
    async activate() {
      // Try to parse the feed one time to confirm we can fetch and parse.
      // The code will throw any errors to the user.
      for (const url of this.urls) {
        await this.rss.fetchAndParseFeed(url);
      }
    },
  },
  async run() {
    const items = [];
    // Get the feeds asynchronously
    const feeds = await Promise.all(
      this.urls.map((url) => this.rss.fetchAndParseFeed(url))
    );
    feeds.forEach((feedItems, i) => {
      feedItems = feedItems?.slice(0, this.max);
      console.log(`Retrieved items from ${this.urls[i]}`);
      if (this.keywords) {
        feedItems = feedItems
          .map((item) => {
            // Extract the description and title from the event
            const { title, description, categories } = item;

            // Use the compromise library to process the title, description and categories
            const doc = nlp(
              `${title}\n\n${description}\n\ntags: ${categories.join(", ")}.`
            );

            // Add the matched keywords to the RSS feed item
            item.matched_keywords = this.keywords.filter((keyword) =>
              doc.has(keyword)
            );

            return item;
          })
          .filter((item) => item.matched_keywords.length);
        console.log(`${feedItems.length} items matched keywords`);
      }
      items.push(...feedItems);
    });
    this.rss.sortItems(items).forEach((item: any) => {
      const meta = this.generateMeta(item);
      this.$emit(item, meta);
    });
  },
});
