import assert from "node:assert/strict";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const categoryFilter = args.find((arg) => arg.startsWith("--category="))?.slice("--category=".length);
const concurrency = 2;

function normalized(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function classTypeFor(type) {
  const value = normalized(type);
  return {
    n: "NOUN",
    noun: "NOUN",
    v: "VERB",
    verb: "VERB",
    adj: "ADJECTIVE",
    adjective: "ADJECTIVE",
    adv: "ADVERB",
    adverb: "ADVERB",
  }[value] ?? value.toUpperCase().replace(/[ -]+/g, "_");
}

function imageFor(card, result) {
  const word = normalized(card.word);
  const classType = classTypeFor(card.type);
  return result?.payload?.ftsPage?.data?.find((item) =>
    normalized(item.content) === word &&
    item.avatar?.url &&
    item.classTypes?.some((itemType) => itemType.classType === classType),
  )?.avatar.url ?? null;
}

function cardInput(card, imageUrl) {
  return {
    word: card.word,
    type: card.type,
    explanation: card.explanation,
    translation: card.translation,
    example: card.example,
    phonetics: card.phonetics,
    image_url: imageUrl,
    difficulty: card.difficulty,
    category_id: card.category_id,
  };
}

async function forEachConcurrent(items, callback) {
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(callback));
  }
}

if (args.includes("--self-test")) {
  assert.equal(classTypeFor("N"), "NOUN");
  assert.equal(classTypeFor("phrasal verb"), "PHRASAL_VERB");
  assert.equal(imageFor({ word: "Set  up", type: "V" }, {
    payload: { ftsPage: { data: [
      { content: "set up", classTypes: [{ classType: "VERB" }], avatar: { url: "verb.jpg" } },
      { content: "set up", classTypes: [{ classType: "NOUN" }], avatar: { url: "noun.jpg" } },
    ] } },
  }), "verb.jpg");
  assert.equal(imageFor({ word: "set up", type: "noun" }, { payload: { ftsPage: { data: [] } } }), null);
  console.log("self-test passed");
  process.exit();
}

const productApiUrl = (process.env.PRODUCT_API_URL ?? "https://api.urms.io.vn").replace(/\/$/, "");
const vocaApiUrl = "https://voca-api.lingoland.ai/api/vocabulary/v1/word/search";

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

async function getCards(categoryId, page) {
  const url = new URL(`${productApiUrl}/api/cards`);
  url.search = new URLSearchParams({ categoryId, page: String(page), pageSize: "100" });
  return fetchJson(url, undefined, `GET cards ${categoryId}/${page}`);
}

async function searchVoca(word) {
  return fetchJson(vocaApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceLang: "EN",
      targetLang: "VI",
      text: word,
      mimeType: null,
      criteria: null,
      source: "APP.SEARCH_WORD_SCREEN",
    }),
  }, `Voca search for ${JSON.stringify(word)}`);
}

async function updateCard(card, imageUrl) {
  await fetchJson(`${productApiUrl}/api/cards/${card.card_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardInput(card, imageUrl)),
  }, `PUT card ${card.card_id}`);
}

const categories = await fetchJson(`${productApiUrl}/api/categories`, undefined, "GET categories");
const selectedCategories = categoryFilter
  ? categories.filter((category) => category.category_id === categoryFilter || category.name === categoryFilter)
  : categories;

if (categoryFilter && selectedCategories.length === 0) throw new Error(`Category not found: ${categoryFilter}`);

const summary = { updated: 0, planned: 0, skipped: 0, notFound: 0, errors: 0 };
console.log(`${apply ? "Applying" : "Dry run"}: ${selectedCategories.length} category(s) from ${productApiUrl}`);

for (const category of selectedCategories) {
  const firstPage = await getCards(category.category_id, 1);
  console.log(`Category: ${category.name} (${firstPage.total} cards)`);
  for (let page = 1; page <= firstPage.total_pages; page += 1) {
    const result = page === 1 ? firstPage : await getCards(category.category_id, page);
    await forEachConcurrent(result.items, async (card) => {
      if (card.image_url) {
        summary.skipped += 1;
        return;
      }
      try {
        const imageUrl = imageFor(card, await searchVoca(card.word));
        if (!imageUrl) {
          summary.notFound += 1;
          console.log(`no matching image: ${card.word} (${card.type})`);
          return;
        }
        if (apply) {
          await updateCard(card, imageUrl);
          summary.updated += 1;
          console.log(`updated: ${card.word} (${card.type})`);
        } else {
          summary.planned += 1;
          console.log(`would update: ${card.word} (${card.type})`);
        }
      } catch (error) {
        summary.errors += 1;
        console.error(`error: ${card.word} (${card.type}): ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
}

console.log(summary);
