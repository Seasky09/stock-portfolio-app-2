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
  return ['관리', '현재가 입력'].indexOf(label) < 0;
}

function isExcelToolTarget(table) {
  var headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) {
    return normalizeCellText(th.textContent).replace(/\s*[↕↑↓].*$/, '').trim();
  });
  return headers.length >= 7 && (
    headers.indexOf('종목명') >= 0 ||
    headers.indexOf('날짜') >= 0 ||
    headers.indexOf('매도일') >= 0
  );
}

function resetTable(table) {
  table.dataset.filters = '{}';
  table.querySelectorAll('.thFilterSelect').forEach(function (select) { select.value = ''; });
  table.querySelectorAll('tbody tr').forEach(function (row) { row.style.display = ''; });
}

function placeResetButton(table) {
  var tableWrap = table.closest('.tableWrap');
  var card = table.closest('.card');
  if (!tableWrap || !card) return;
  if (card.querySelector('.tableResetButton')) return;

  var resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'tableResetButton';
  resetButton.textContent = '필터 초기화';
  resetButton.addEventListener('click', function () { resetTable(table); });

  var rowHeader = Array.prototype.slice.call(card.children).find(function (node) {
    return node.classList && node.classList.contains('row') && node.classList.contains('between') && node.querySelector('h2');
  });

  if (rowHeader) {
    var actionGroup = rowHeader.querySelector('.cardHeaderActions');
    if (!actionGroup) {
      actionGroup = document.createElement('div');
      actionGroup.className = 'cardHeaderActions';
      Array.prototype.slice.call(rowHeader.children).forEach(function (child) {
        if (child.tagName === 'BUTTON') actionGroup.appendChild(child);
      });
      rowHeader.appendChild(actionGroup);
    }
    actionGroup.insertBefore(resetButton, actionGroup.firstChild);
    return;
  }

  var h2 = Array.prototype.slice.call(card.children).find(function (node) { return node.tagName === 'H2'; });
  if (h2) {
    var titleRow = document.createElement('div');
    titleRow.className = 'cardTitleRow';
    card.insertBefore(titleRow, h2);
    titleRow.appendChild(h2);
    titleRow.appendChild(resetButton);
  }
}

function enhanceTable(table) {
  if (!isExcelToolTarget(table)) return;

  var originalHeaders = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) {
    return normalizeCellText(th.textContent).replace(/\s*[↕↑↓].*$/, '').trim();
  });
  var rowCount = table.querySelectorAll('tbody tr').length;
  var signature = originalHeaders.join('|') + ':' + rowCount;

  if (table.dataset.excelEnhanced === 'true' && table.dataset.excelSignature === signature) {
    placeResetButton(table);
    return;
  }

  table.dataset.excelEnhanced = 'true';
  table.dataset.excelSignature = signature;
  table.dataset.filters = '{}';

  var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  var tbody = table.querySelector('tbody');
  if (!tbody) return;

  headers.forEach(function (th, columnIndex) {
    var originalLabel = originalHeaders[columnIndex];
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

      table.querySelectorAll('.thSortButton').forEach(function (button) {
        var base = button.dataset.label || normalizeCellText(button.textContent).replace(/\s*[↕↑↓].*$/, '').trim();
        button.textContent = base + ' ↕';
      });
      labelButton.textContent = originalLabel + (nextDirection === 'asc' ? ' ↑' : ' ↓');

      sortRows(table, columnIndex, nextDirection);
      applyTableFilters(table);
    });
    labelButton.dataset.label = originalLabel;
    th.appendChild(labelButton);

    if (shouldFilterColumn(originalLabel) && uniqueValues.length > 1 && uniqueValues.length <= 80) {
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

  placeResetButton(table);
}

function removeLegacyStatusFilters() {
  document.querySelectorAll('.card > div').forEach(function (node) {
    if (node.classList.contains('tableToolBar')) return;
    if (!node.querySelector('select')) return;
    var text = normalizeCellText(node.textContent);
    if (text === '상태 전체' || text.startsWith('상태 전체')) {
      node.remove();
    }
  });
}

function removeLegacyToolbars() {
  document.querySelectorAll('.tableToolBar').forEach(function (node) { node.remove(); });
}

function simplifyKospiCard() {
  var card = document.querySelector('.marketCard');
  if (!card) return;

  var valueEl = card.querySelector('.marketValue');
  var changeEl = card.querySelector('.marketChange');
  var chart = card.querySelector('.marketChart');
  if (!valueEl || !changeEl) return;

  if (chart) chart.style.display = 'none';
  card.querySelectorAll('.marketPeriodLabel').forEach(function (node) { node.remove(); });

  var latest = parseNumberLike(valueEl.textContent) || 0;
  var changeMatch = normalizeCellText(changeEl.textContent).match(/([+\-]?[0-9,.]+)\s*\(([^)]+)\)/);
  var change = changeMatch ? parseNumberLike(changeMatch[1]) || 0 : 0;
  var previous = latest - change;
  var changePct = changeMatch ? changeMatch[2] : '';

  var details = card.querySelector('.marketDetails');
  if (!details) {
    details = document.createElement('div');
    details.className = 'marketDetails';
    card.appendChild(details);
  }

  details.innerHTML =
    '<div><span>전일 종가</span><strong>' + previous.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></div>' +
    '<div><span>전일 대비</span><strong>' + (change > 0 ? '+' : '') + change.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'p</strong></div>' +
    '<div><span>등락률</span><strong>' + changePct + '</strong></div>';
}

function runExcelTableTools() {
  removeLegacyStatusFilters();
  removeLegacyToolbars();
  document.querySelectorAll('table').forEach(enhanceTable);
  simplifyKospiCard();
}

var excelToolsTimer = null;
function scheduleExcelTableTools() {
  window.clearTimeout(excelToolsTimer);
  excelToolsTimer = window.setTimeout(runExcelTableTools, 80);
}

window.addEventListener('load', function () {
  runExcelTableTools();
  var observer = new MutationObserver(scheduleExcelTableTools);
  observer.observe(document.body, { childList: true, subtree: true });

  var count = 0;
  var timer = window.setInterval(function () {
    runExcelTableTools();
    count += 1;
    if (count >= 30) window.clearInterval(timer);
  }, 500);
});
