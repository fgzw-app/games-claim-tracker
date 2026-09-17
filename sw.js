function isSteamOrEpic(platformStr) {
  const plat = (platformStr || '').toLowerCase();
  return plat.includes('epic') || plat.includes('steam');
}

// Strict filter to discard DLCs, expansions, and item packs
function isBaseGame(game) {
  const type = (game.type || '').toLowerCase().trim();
  if (type && type !== 'game') return false;

  const text = `${game.title || ''} ${game.description || ''}`.toLowerCase();
  const rejectWords = [
    ' dlc', '(dlc', '[dlc', 'dlc ',
    'expansion', 'add-on', 'addon', 'season pass',
    'soundtrack', 'artbook', 'starter pack', 'bonus pack',
    'skin pack', 'cosmetic', 'in-game content', 'loot pack',
    'beta access', 'playtest', 'item pack'
  ];

  for (const word of rejectWords) {
    if (text.includes(word)) return false;
  }
  return true;
}

// Listen for periodic background sync from Android
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-games-sync') {
    event.waitUntil(checkGamesAndNotify());
  }
});

async function checkGamesAndNotify() {
  try {
    const timestamp = Date.now();
    // Query GamerPower with type=game
    const [steamRes, epicRes] = await Promise.allSettled([
      fetch(`https://www.gamerpower.com/api/giveaways?platform=steam&type=game&t=${timestamp}`),
      fetch(`https://www.gamerpower.com/api/giveaways?platform=epic-games-store&type=game&t=${timestamp}`)
    ]);

    let steamData = [];
    let epicData = [];

    if (steamRes.status === 'fulfilled' && steamRes.value.ok) {
      const json = await steamRes.value.json();
      if (Array.isArray(json)) steamData = json;
    }

    if (epicRes.status === 'fulfilled' && epicRes.value.ok) {
      const json = await epicRes.value.json();
      if (Array.isArray(json)) epicData = json;
    }

    const combined = [...steamData, ...epicData];
    const uniqueMap = new Map();
    combined.forEach(game => {
      if (isSteamOrEpic(game.platforms) && isBaseGame(game)) {
        uniqueMap.set(game.id, game);
      }
    });

    const steamAndEpicGames = Array.from(uniqueMap.values());
    if (steamAndEpicGames.length === 0) return;

    // Retrieve cached list of seen game IDs
    const cache = await caches.open('game-tracker-data');
    const storedRes = await cache.match('/last-seen-ids.json');
    let knownIds = [];
    if (storedRes) {
      knownIds = await storedRes.json();
    }

    const currentIds = steamAndEpicGames.map(g => String(g.id));
    const newDrops = steamAndEpicGames.filter(g => !knownIds.includes(String(g.id)));

    // Only notify if brand new base games drop
    if (knownIds.length > 0 && newDrops.length > 0) {
      const drop = newDrops[0];
      const isEpic = drop.platforms.toLowerCase().includes('epic');
      const platformName = isEpic ? 'Epic Games' : 'Steam';

      await self.registration.showNotification(`Free on ${platformName}: ${drop.title}`, {
        body: '100% OFF base game. Claim before it expires!',
        icon: 'icon-192-v2.png',
        badge: 'icon-192-v2.png',
        data: { url: drop.open_giveaway_url }
      });
    }

    // Save only verified game IDs to cache
    await cache.put('/last-seen-ids.json', new Response(JSON.stringify(currentIds)));
  } catch (err) {
    console.error('Background check failed:', err);
  }
}

// Open giveaway link when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
