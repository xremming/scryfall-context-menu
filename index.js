function search(info, tab) {
  chrome.tabs.create({
    url: "https://scryfall.com/search?q=" + encodeURIComponent(info.selectionText),
    active: true
  });
}

chrome.contextMenus.create({
  title: 'Search Scryfall for "%s"',
  contexts: ["selection"],
  onclick: search
});
