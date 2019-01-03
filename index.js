var contextMenu = chrome.contextMenus.create({
  title: "Search with Scryfall",
  contexts: ["selection"]
});

contextMenu.onClicked.addListener(function(info, tab) {
  var t = info.selectionText;
  if (t === null || t === undefined || t.length == 0) return;

  chrome.tabs.create({
    url: `https://scryfall.com/search?q=${encodeURIComponent(t)}`,
    active: true
  });
});
