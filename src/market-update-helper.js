const MARKET_UPDATE_KEY = 'portfolioLastMarketUpdateAt';

function formatUpdateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function setMarketUpdateNow() {
  const now = new Date().toISOString();
  localStorage.setItem(MARKET_UPDATE_KEY, now);
  renderMarketUpdateTime();
}

function renderMarketUpdateTime() {
  const topbarActions = document.querySelector('.topbar .row.gap8');
  if (!topbarActions) return;

  let badge = topbarActions.querySelector('.marketUpdateTime');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'marketUpdateTime';
    topbarActions.insertBefore(badge, topbarActions.firstChild);
  }

  const formatted = formatUpdateTime(localStorage.getItem(MARKET_UPDATE_KEY));
  badge.textContent = formatted ? `마지막 갱신 ${formatted}` : '시세 미갱신';
  badge.title = '이 앱이 무료 시세 데이터를 마지막으로 가져온 시각입니다. 실제 거래소 시세는 지연될 수 있습니다.';
}

function removeLegacyKospiPeriodText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (String(node.nodeValue || '').includes('최근 1개월 흐름')) targets.push(node);
  }
  targets.forEach((node) => {
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.textContent.trim() === '최근 1개월 흐름') parent.remove();
    else node.nodeValue = node.nodeValue.replace('최근 1개월 흐름', '');
  });
}

const originalFetch = window.fetch.bind(window);
window.fetch = async function patchedFetch(input, init) {
  const response = await originalFetch(input, init);
  try {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (response.ok && (url.includes('/api/prices') || url.includes('/api/history'))) {
      setMarketUpdateNow();
    }
  } catch (_) {
    // no-op
  }
  return response;
};

function runMarketUiHelpers() {
  renderMarketUpdateTime();
  removeLegacyKospiPeriodText();
}

window.addEventListener('load', () => {
  runMarketUiHelpers();
  const observer = new MutationObserver(runMarketUiHelpers);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
});
