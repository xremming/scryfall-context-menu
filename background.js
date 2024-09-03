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
  url.searchParams.set("utm_source", "Scryfall Context Menu");

  chrome.tabs.create({ url: url.toString(), index: tab.index + 1 });
});
