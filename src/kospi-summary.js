function parseNumber(text) {
  return Number(String(text || '').replace(/[^0-9.-]/g, '')) || 0;
}

function formatIndex(value) {
  return Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedPoint(value) {
  var sign = Number(value || 0) > 0 ? '+' : '';
  return sign + Number(value || 0).toFixed(2) + 'p';
}

function formatSignedPercent(value) {
  var sign = Number(value || 0) > 0 ? '+' : '';
  return sign + Number(value || 0).toFixed(2) + '%';
}

function enhanceKospiSummary() {
  var card = document.querySelector('.marketCard');
  if (!card) return;

  var valueEl = card.querySelector('.marketValue');
  var changeEl = card.querySelector('.marketChange');
  if (!valueEl || !changeEl) return;

  var latest = parseNumber(valueEl.textContent);
  var changeText = changeEl.textContent || '';
  var matchPoint = changeText.match(/[+-]?\d+(?:\.\d+)?/);
  var matchPercent = changeText.match(/\(([+-]?\d+(?:\.\d+)?)%\)/);
  var change = matchPoint ? Number(matchPoint[0]) : 0;
  var changePct = matchPercent ? Number(matchPercent[1]) : 0;
  var previous = latest - change;

  var chart = card.querySelector('.marketChart');
  if (chart) chart.setAttribute('aria-hidden', 'true');

  var stats = card.querySelector('.marketStats');
  if (!stats) {
    stats = document.createElement('div');
    stats.className = 'marketStats';
    card.appendChild(stats);
  }

  stats.innerHTML = [
    '<div class="marketStat"><span>전일 종가</span><strong>' + formatIndex(previous) + '</strong></div>',
    '<div class="marketStat"><span>전일 대비</span><strong>' + formatSignedPoint(change) + '</strong></div>',
    '<div class="marketStat"><span>등락률</span><strong>' + formatSignedPercent(changePct) + '</strong></div>'
  ].join('');
}

window.addEventListener('load', function () {
  enhanceKospiSummary();
  var count = 0;
  var timer = window.setInterval(function () {
    enhanceKospiSummary();
    count += 1;
    if (count >= 12) window.clearInterval(timer);
  }, 500);
});

window.addEventListener('focus', enhanceKospiSummary);
