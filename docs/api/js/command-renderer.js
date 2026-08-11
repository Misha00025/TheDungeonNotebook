(function () {
  'use strict';

  var container = document.getElementById('commands-container');
  if (!container) return;

  var pageId = container.getAttribute('data-page');
  if (!pageId) return;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getStatusClass(status) {
    var code = parseInt(status, 10);
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    if (code >= 500 && code < 600) return 'status-5xx';
    return '';
  }

  var commands = COMMANDS.filter(function(c){ return c.page === pageId; });

  var html = '';

  commands.forEach(function(c) {
    html += '<section id="' + c.id + '" class="command-card">';
    html += '<div class="card-header">';
    html += '<span class="command-type-badge">' + c.type + '</span>';
    html += '<code class="command-url">command: ' + c.type + '</code>';
    html += '</div>';
    html += '<div class="card-body">';
    html += '<p class="description">' + c.description + '</p>';

    if (c.payload) {
      html += '<div class="request-body"><h3>Тело payload</h3><pre class="json-schema">' + escapeHtml(prettySchema(c.payload)) + '</pre></div>';
    }

    if (c.payloadRequired && c.payloadRequired.length > 0) {
      var requiredStr = c.payloadRequired.join(', ');
      html += '<p class="payload-required">Обязательные поля: ' + requiredStr + '</p>';
    }

    if (c.responseSchema) {
      html += '<div class="response-block"><h3>Ответ</h3><pre class="json-schema">' + escapeHtml(prettySchema(c.responseSchema)) + '</pre></div>';
    }

    html += '<div class="status-codes">';
    c.responseStatuses.forEach(function(s) {
      var cls = getStatusClass(s);
      html += '<span class="status ' + cls + '">' + s + '</span>';
    });
    html += '</div>';

    html += '</div>';
    html += '</section>';
  });

  container.innerHTML = html;

})();
