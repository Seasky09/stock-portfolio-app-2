const APP_VERSION_URL = '/app-version.json';

async function getRemoteAppVersion() {
  try {
    const response = await fetch(APP_VERSION_URL + '?t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.version ? String(data.version) : null;
  } catch (_err) {
    return null;
  }
}

async function checkAppVersion() {
  const remoteVersion = await getRemoteAppVersion();
  if (!remoteVersion) return;

  const savedVersion = window.localStorage.getItem('portfolioAppVersion');
  if (!savedVersion) {
    window.localStorage.setItem('portfolioAppVersion', remoteVersion);
    return;
  }

  if (savedVersion !== remoteVersion) {
    window.localStorage.setItem('portfolioAppVersion', remoteVersion);
    window.location.reload();
  }
}

window.addEventListener('load', checkAppVersion);
window.addEventListener('focus', checkAppVersion);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) checkAppVersion();
});
window.addEventListener('pageshow', function (event) {
  if (event.persisted) checkAppVersion();
});
