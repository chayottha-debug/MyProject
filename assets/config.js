window.APP_CONFIG = {};

(async () => {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    window.APP_CONFIG = cfg;

    // dispatch event บอก app.js ว่า config โหลดเสร็จแล้ว
    window.dispatchEvent(new Event('appConfigReady'));
  } catch (e) {
    window.dispatchEvent(new Event('appConfigReady'));
  }
})();
