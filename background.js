// @ts-check

const UTM_SOURCE = "Scryfall Context Menu";

/**
 * @param {string} url
 * @param {Record<string, string> | null} query
 * @returns {URL}
 */
function makeURL(url, query = null) {
  const out = new URL(url);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      out.searchParams.set(key, value);
    }
  }
  out.searchParams.set("utm_source", UTM_SOURCE);
  return out;
}

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
  const urlObj = makeURL("https://scryfall.com/search", {
    q: info.selectionText ?? "",
  });

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
  const completeURL = makeURL("https://api.scryfall.com/cards/autocomplete", {
    q: text,
  });

  return fetch(completeURL)
    .then((resp) => resp.json())
    .then((data) => data.data);
}

/**
 * @param {string} name
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }>}
 */
function named(name) {
  const namedURL = makeURL("https://api.scryfall.com/cards/named", {
    exact: name,
  });

  return fetch(namedURL).then((resp) => resp.json());
}

/**
 * @param {string} text
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }[]>}
 */
function search(text) {
  const searchURL = makeURL("https://api.scryfall.com/cards/search", {
    q: text,
  });

  return fetch(searchURL)
    .then((resp) => resp.json())
    .then((data) => data.data);
}

/**
 * @param {string} text
 * @returns {Promise<{ name?: string; mana_cost?: string; type_line?: string; scryfall_uri?: string; }[]>}
 */
async function getResults(text) {
  const autocompleteData = await autocomplete(text);

  const fetches = [...autocompleteData.map(named), search(text)];

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

          const scryfallURI = makeURL(card.scryfall_uri);
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
    rawURL = makeURL(text);
  } else {
    rawURL = makeURL("https://scryfall.com/search", {
      q: text,
    });
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
