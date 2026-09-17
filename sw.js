// Dot-separated platform slugs ensure GamerPower correctly isolates Epic and Steam
const API_URL = 'https://www.gamerpower.com/api/filter?platform=epic-games-store.steam&type=game';

function isSteamOrEpic(platformStr) {
  const plat = (platformStr || '').toLowerCase();
  return plat.includes('epic') || plat.includes('steam');
}

// Listen for periodic background sync from Android
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-games-sync') {
    event.waitUntil(checkGamesAndNotify());
  }
});

async function checkGamesAndNotify() {
  try {
    const res = await fetch(API_URL);
    const rawGames = await res.json();
    if (!Array.isArray(rawGames) || rawGames.length === 0) return;

    // Strict safety check: only process Steam or Epic Games Store
    const steamAndEpicGames = rawGames.filter(g => isSteamOrEpic(g.platforms));
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

    // Only notify if new Steam/Epic drops are detected
    if (knownIds.length > 0 && newDrops.length > 0) {
      const drop = newDrops[0];
      const isEpic = drop.platforms.toLowerCase().includes('epic');
      const platformName = isEpic ? 'Epic Games' : 'Steam';

      await self.registration.showNotification(`Free on ${platformName}: ${drop.title}`, {
        body: 'Claim it before the promotion expires!',
        icon: 'icon-192-v2.png',
        badge: 'icon-192-v2.png',
        data: { url: drop.open_giveaway_url }
      });
    }

    // Save strictly Steam & Epic game IDs to cache
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
