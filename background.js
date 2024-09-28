// @ts-check

const UTM_SOURCE = "Scryfall Context Menu";

/**
 * @param {string} unsafe
 * @returns {string}
 */
function escapeXML(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

// === CONTEXT MENU ===

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "search",
    title: 'Search Scryfall for "%s"',
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const urlObj = new URL("https://scryfall.com/search");
  urlObj.searchParams.set("q", info.selectionText ?? "");
  urlObj.searchParams.set("utm_source", UTM_SOURCE);

  const url = urlObj.toString();

  let index = tab?.index;
  if (index !== undefined) {
    index += 1;
  }

  chrome.tabs.create({ url, index });
});

// === OMNIBOX ===

/**
 * @param {string} text
 * @returns {Promise<string[]>}
 */
function autocomplete(text) {
  const completeURL = new URL("https://api.scryfall.com/cards/autocomplete");
  completeURL.searchParams.set("q", text);

  return fetch(completeURL)
    .then((resp) => resp.json())
    .then((data) => data.data);
}

/**
 * @param {string} name
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }>}
 */
function named(name) {
  const namedURL = new URL("https://api.scryfall.com/cards/named");
  namedURL.searchParams.set("exact", name);

  return fetch(namedURL).then((resp) => resp.json());
}

/**
 * @param {string} text
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }[]>}
 */
function search(text) {
  const searchURL = new URL("https://api.scryfall.com/cards/search");
  searchURL.searchParams.set("q", text);

  return fetch(searchURL)
    .then((resp) => resp.json())
    .then((data) => data.data);
}

/**
 * @param {string} text
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }[]>}
 */
async function getResults(text) {
  const searchURL = new URL("https://api.scryfall.com/cards/search");
  searchURL.searchParams.set("q", text);

  const autocompleteData = await autocomplete(text);

  const fetches = [
    ...autocompleteData.map(named),
    search(text),
  ];

  return Promise.allSettled(fetches).then((results) =>
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter(Boolean)
      .flat(1)
      .map((card) => ({
        name: card?.name,
        mana_cost: card?.mana_cost,
        type_line: card?.type_line,
        scryfall_uri: card?.scryfall_uri,
      }))
  );
}

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  if (!text) return;

  getResults(text).then((data) =>
    suggest(
      data
        .map((card) => {
          if (!card.name || !card.scryfall_uri) {
            console.warn("Card with missing name and/or scryfall_uri.", card);
            return null;
          }

          const scryfallURI = new URL(card.scryfall_uri);
          scryfallURI.searchParams.set("utm_source", UTM_SOURCE);

          const content = scryfallURI.toString();

          let description = `<match>${escapeXML(card.name)}</match>`;
          if (card.mana_cost) {
            const manaCost = card.mana_cost.replaceAll(/\{(.+?)\}/g, "$1");
            description += ` <dim>${escapeXML(manaCost)}</dim>`;
          }
          if (card.type_line) {
            description += ` <dim>${escapeXML(card.type_line)}</dim>`;
          }
          description += ` <url>${escapeXML(content)}</url>`;

          return { content, description };
        })
        .filter((card) => card !== null)
    )
  );
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  let rawURL;
  if (text.startsWith("https://")) {
    rawURL = new URL(text);
  } else {
    rawURL = new URL("https://scryfall.com/search");
    rawURL.searchParams.set("q", text);
    rawURL.searchParams.set("utm_source", UTM_SOURCE);
  }

  const url = rawURL.toString();

  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({ url });
      break;
    case "newForegroundTab":
      chrome.tabs.create({ url });
      break;
    case "newBackgroundTab":
      chrome.tabs.create({ url, active: false });
      break;
  }
});
