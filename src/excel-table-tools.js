function normalizeCellText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function parseNumberLike(text) {
  var cleaned = normalizeCellText(text).replace(/[^0-9.\-]/g, '');
  var number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function getComparableValue(text) {
  var number = parseNumberLike(text);
  if (number !== null && /[0-9]/.test(String(text))) return number;
  return normalizeCellText(text).toLowerCase();
}

function sortRows(table, columnIndex, direction) {
  var tbody = table.querySelector('tbody');
  if (!tbody) return;

  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  rows.sort(function (a, b) {
    var av = getComparableValue(a.children[columnIndex] ? a.children[columnIndex].textContent : '');
    var bv = getComparableValue(b.children[columnIndex] ? b.children[columnIndex].textContent : '');

    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'asc' ? av - bv : bv - av;
    }

    return direction === 'asc'
      ? String(av).localeCompare(String(bv), 'ko')
      : String(bv).localeCompare(String(av), 'ko');
  });

  rows.forEach(function (row) { tbody.appendChild(row); });
}

function applyTableFilters(table) {
  var filters = JSON.parse(table.dataset.filters || '{}');
  var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));

  rows.forEach(function (row) {
    var visible = Object.keys(filters).every(function (key) {
      var value = filters[key];
      if (!value) return true;
      var cell = row.children[Number(key)];
      return normalizeCellText(cell ? cell.textContent : '') === value;
    });
    row.style.display = visible ? '' : 'none';
  });
}

function buildFilterValue(cellText) {
  var text = normalizeCellText(cellText);
  if (!text || text === '-') return text || '-';
  return text;
}

function shouldFilterColumn(label) {
  return ['날짜', '매도일', '종목명', '코드', '구분', '메모'].indexOf(label) >= 0;
}

function isExcelToolTarget(table) {
  var headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) {
    return normalizeCellText(th.textContent);
  });
  return headers.length >= 7 && (
    headers.indexOf('종목명') >= 0 ||
    headers.indexOf('날짜') >= 0 ||
    headers.indexOf('매도일') >= 0
  );
}

function enhanceTable(table) {
  if (table.dataset.excelEnhanced === 'true') return;
  if (!isExcelToolTarget(table)) return;

  table.dataset.excelEnhanced = 'true';
  table.dataset.filters = '{}';

  var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  var tbody = table.querySelector('tbody');
  if (!tbody) return;

  headers.forEach(function (th, columnIndex) {
    var originalLabel = normalizeCellText(th.textContent);
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var uniqueValues = Array.from(new Set(rows.map(function (row) {
      return buildFilterValue(row.children[columnIndex] ? row.children[columnIndex].textContent : '');
    }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'ko'); });

    th.innerHTML = '';
    th.classList.add('filterableTh');

    var labelButton = document.createElement('button');
    labelButton.type = 'button';
    labelButton.className = 'thSortButton';
    labelButton.textContent = originalLabel + ' ↕';
    labelButton.title = '클릭하면 정렬됩니다';
    labelButton.addEventListener('click', function () {
      var currentColumn = Number(table.dataset.sortColumn || -1);
      var currentDirection = table.dataset.sortDirection || 'desc';
      var nextDirection = currentColumn === columnIndex && currentDirection === 'asc' ? 'desc' : 'asc';
      table.dataset.sortColumn = String(columnIndex);
      table.dataset.sortDirection = nextDirection;
      labelButton.textContent = originalLabel + (nextDirection === 'asc' ? ' ↑' : ' ↓');
      sortRows(table, columnIndex, nextDirection);
      applyTableFilters(table);
    });
    th.appendChild(labelButton);

    if (shouldFilterColumn(originalLabel) && uniqueValues.length > 0 && uniqueValues.length <= 80) {
      var select = document.createElement('select');
      select.className = 'thFilterSelect';
      select.title = originalLabel + ' 필터';

      var allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = '전체';
      select.appendChild(allOption);

      uniqueValues.forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      select.addEventListener('click', function (event) { event.stopPropagation(); });
      select.addEventListener('change', function () {
        var filters = JSON.parse(table.dataset.filters || '{}');
        if (select.value) filters[columnIndex] = select.value;
        else delete filters[columnIndex];
        table.dataset.filters = JSON.stringify(filters);
        applyTableFilters(table);
      });

      th.appendChild(select);
    }
  });

  var resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'tableResetButton';
  resetButton.textContent = '필터 초기화';
  resetButton.addEventListener('click', function () {
    table.dataset.filters = '{}';
    table.querySelectorAll('.thFilterSelect').forEach(function (select) { select.value = ''; });
    table.querySelectorAll('tbody tr').forEach(function (row) { row.style.display = ''; });
  });

  var tableWrap = table.closest('.tableWrap');
  if (tableWrap && !tableWrap.previousElementSibling?.classList?.contains('tableToolBar')) {
    var toolbar = document.createElement('div');
    toolbar.className = 'tableToolBar';
    toolbar.innerHTML = '<span>열 제목 클릭: 정렬 / 드롭다운: 필터</span>';
    toolbar.appendChild(resetButton);
    tableWrap.parentNode.insertBefore(toolbar, tableWrap);
  }
}

function simplifyKospiCard() {
  var card = document.querySelector('.marketCard');
  if (!card || card.dataset.simplified === 'true') return;

  var valueEl = card.querySelector('.marketValue');
  var changeEl = card.querySelector('.marketChange');
  var chart = card.querySelector('.marketChart');
  if (!valueEl || !changeEl) return;

  var latest = parseNumberLike(valueEl.textContent) || 0;
  var changeMatch = normalizeCellText(changeEl.textContent).match(/([+\-]?[0-9,.]+)\s*\(([^)]+)\)/);
  var change = changeMatch ? parseNumberLike(changeMatch[1]) || 0 : 0;
  var previous = latest - change;

  if (chart) chart.style.display = 'none';

  var details = document.createElement('div');
  details.className = 'marketDetails';
  details.innerHTML =
    '<div><span>전일 종가</span><strong>' + previous.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></div>' +
    '<div><span>전일 대비</span><strong>' + (change > 0 ? '+' : '') + change.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'p</strong></div>' +
    '<div><span>등락률</span><strong>' + normalizeCellText(changeEl.textContent).replace(/^.*\(([^)]+)\).*$/, '$1') + '</strong></div>';

  card.appendChild(details);
  card.dataset.simplified = 'true';
}

function runExcelTableTools() {
  document.querySelectorAll('table').forEach(enhanceTable);
  simplifyKospiCard();
}

window.addEventListener('load', function () {
  runExcelTableTools();
  var count = 0;
  var timer = window.setInterval(function () {
    runExcelTableTools();
    count += 1;
    if (count >= 30) window.clearInterval(timer);
  }, 500);
});
