function formatRefreshTime(date) {
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  var hours = String(date.getHours()).padStart(2, '0');
  var minutes = String(date.getMinutes()).padStart(2, '0');
  return month + '.' + day + ' ' + hours + ':' + minutes;
}

function saveRefreshTimeNow() {
  var nowText = formatRefreshTime(new Date());
  window.localStorage.setItem('portfolioLastRefreshTime', nowText);
  renderRefreshTime();
}

function renderRefreshTime() {
  var topbar = document.querySelector('.topbar');
  if (!topbar) return;

  var saved = window.localStorage.getItem('portfolioLastRefreshTime');
  var text = saved ? '마지막 갱신: ' + saved : '마지막 갱신: -';

  var el = document.getElementById('lastRefreshTime');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lastRefreshTime';
    el.className = 'lastRefreshTime';
    topbar.appendChild(el);
  }
  el.textContent = text;
}

function bindRefreshButton() {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
  buttons.forEach(function (button) {
    if ((button.textContent || '').trim() !== '현재가 갱신') return;
    if (button.dataset.refreshTimeBound === 'true') return;

    button.dataset.refreshTimeBound = 'true';
    button.addEventListener('click', function () {
      window.setTimeout(saveRefreshTimeNow, 1200);
    });
  });
}

function updateRefreshTimeWhenMarketDataAppears() {
  var hasMarketValue = !!document.querySelector('.marketValue');
  var hasPortfolioValue = Array.prototype.slice.call(document.querySelectorAll('.metricValue')).some(function (el) {
    return (el.textContent || '').indexOf('원') >= 0;
  });

  if (!hasMarketValue && !hasPortfolioValue) return false;

  var todayKey = new Date().toISOString().slice(0, 10);
  var savedDate = window.localStorage.getItem('portfolioLastRefreshDate');
  if (savedDate !== todayKey) {
    window.localStorage.setItem('portfolioLastRefreshDate', todayKey);
    saveRefreshTimeNow();
  }
  return true;
}

window.addEventListener('load', function () {
  renderRefreshTime();
  bindRefreshButton();

  var count = 0;
  var timer = window.setInterval(function () {
    renderRefreshTime();
    bindRefreshButton();
    updateRefreshTimeWhenMarketDataAppears();
    count += 1;
    if (count >= 20) window.clearInterval(timer);
  }, 500);
});
