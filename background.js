const UTM_SOURCE = "Scryfall Context Menu";

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
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "search",
    title: 'Search Scryfall for "%s"',
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = new URL("https://scryfall.com/search");
  url.searchParams.set("q", info.selectionText);
  url.searchParams.set("utm_source", UTM_SOURCE);

  chrome.tabs.create({ url: url, index: tab.index + 1 });
});

async function getResults(text) {
  const completeURL = new URL("https://api.scryfall.com/cards/autocomplete");
  completeURL.searchParams.set("q", text);

  const autocompleteData = await fetch(completeURL)
    .then((resp) => resp.json())
    .then((data) => data.data);

  const searchURL = new URL("https://api.scryfall.com/cards/search");
  searchURL.searchParams.set("q", text);

  const fetches = [
    ...autocompleteData.map((name) => {
      const namedURL = new URL("https://api.scryfall.com/cards/named");
      namedURL.searchParams.set("exact", name);

      return fetch(namedURL).then((resp) => resp.json());
    }),
    fetch(searchURL)
      .then((resp) => resp.json())
      .then((data) => data.data),
  ];

  return Promise.allSettled(fetches).then((results) =>
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter(Boolean)
      .flat(1)
      .map((card) => ({
        name: card?.name ?? null,
        mana_cost: card?.mana_cost ?? null,
        type_line: card?.type_line ?? null,
        scryfall_uri: card?.scryfall_uri ?? null,
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
