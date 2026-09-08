const API_URL = 'https://www.gamerpower.com/api/filter?platform=epic-games-store+steam&type=game';

// Listen for periodic background wakeups from Android
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-games-sync') {
    event.waitUntil(checkGamesAndNotify());
  }
});

async function checkGamesAndNotify() {
  try {
    const res = await fetch(API_URL);
    const games = await res.json();
    if (!Array.isArray(games) || games.length === 0) return;

    // Read stored game IDs from Cache Storage
    const cache = await caches.open('game-tracker-data');
    const storedRes = await cache.match('/last-seen-ids.json');
    let knownIds = [];
    if (storedRes) {
      knownIds = await storedRes.json();
    }

    const currentIds = games.map(g => String(g.id));
    const newDrops = games.filter(g => !knownIds.includes(String(g.id)));

    // If new games found, trigger lockscreen notification
    if (knownIds.length > 0 && newDrops.length > 0) {
      const drop = newDrops[0];
      const platform = drop.platforms.toLowerCase().includes('epic') ? 'Epic Games' : 'Steam';
      await self.registration.showNotification(`Free on ${platform}: ${drop.title}`, {
        body: 'Claim it before the promotion expires!',
        icon: 'icon-192-v2.png',
        badge: 'icon-192-v2.png',
        data: { url: drop.open_giveaway_url }
      });
    }

    // Save updated IDs into Cache
    await cache.put('/last-seen-ids.json', new Response(JSON.stringify(currentIds)));
  } catch (err) {
    console.error('Background check failed:', err);
  }
}

// Open giveaway link when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
