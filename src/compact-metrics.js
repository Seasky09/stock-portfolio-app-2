function compactWonText(text) {
  if (!text || text.indexOf('만 원') >= 0) return text;
  var sign = '';
  var trimmed = text.trim();
  if (trimmed.charAt(0) === '+' || trimmed.charAt(0) === '-') sign = trimmed.charAt(0);
  var numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
  if (!isFinite(numeric)) return text;
  var abs = Math.abs(numeric);
  if (abs < 10000) return text;
  var man = Math.round(abs / 10000).toLocaleString('ko-KR');
  return sign + man + '만 원';
}

function compactSummaryMetrics() {
  var metrics = document.querySelectorAll('.metric');
  for (var i = 0; i < metrics.length; i += 1) {
    var titleEl = metrics[i].querySelector('.metricTitle');
    var valueEl = metrics[i].querySelector('.metricValue');
    if (!titleEl || !valueEl) continue;
    var title = titleEl.textContent.trim();
    if (title !== '평가손익' && title !== '실현손익') continue;
    var original = valueEl.textContent.trim();
    var compact = compactWonText(original);
    if (compact !== original) {
      valueEl.setAttribute('title', original);
      valueEl.textContent = compact;
    }
  }
}

window.addEventListener('load', function () {
  compactSummaryMetrics();
  window.setTimeout(compactSummaryMetrics, 300);
  window.setTimeout(compactSummaryMetrics, 1000);
  window.setTimeout(compactSummaryMetrics, 2500);
});
