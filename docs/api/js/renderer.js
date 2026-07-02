(function () {
  'use strict';

  var container = document.getElementById('endpoints-container');
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

  var filtered = ENDPOINTS.filter(function (ep) {
    return ep.page === pageId;
  });

  var html = '';

  filtered.forEach(function (ep) {
    html += '<section id="' + ep.id + '" class="endpoint-card">';

    html += '<div class="card-header">';
    html += '<span class="method-badge method-' + ep.method.toLowerCase() + '">' + ep.method + '</span>';
    html += '<code class="endpoint-url">' + ep.url + '</code>';

    if (ep.auth === 'required') {
      html += '<span class="auth-badge auth-required">auth</span>';
    } else {
      html += '<span class="auth-badge auth-none">no auth</span>';
    }

    if (ep.access) {
      html += '<span class="access-badge">' + ep.access + '</span>';
    }

    html += '</div>';

    if (ep.special && ep.special.length > 0) {
      html += '<div class="special-badges">';
      ep.special.forEach(function (s) {
        html += '<span class="special-badge">' + s + '</span>';
      });
      html += '</div>';
    }

    html += '<div class="card-body">';
    html += '<p class="description">' + ep.description + '</p>';

    if (ep.params && ep.params.length > 0) {
      html += '<table class="params-table"><thead><tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr></thead><tbody>';
      ep.params.forEach(function (p) {
        html += '<tr><td>' + p.name + '</td><td>' + p.type + '</td><td>' + p.description + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    if (ep.requestBody) {
      html += '<div class="request-body"><h3>Тело запроса</h3><pre class="json-schema">' + escapeHtml(ep.requestBody) + '</pre></div>';
    }

    if (ep.responseSchema){
      html += '<div class="response-block"><h3>Ответ</h3><pre class="json-schema">' + (ep.responseSchema ? escapeHtml(ep.responseSchema) : 'null') + '</pre>';
    }
    
    html += '<div class="status-codes">';
    ep.responseStatuses.forEach(function (s) {
      var cls = getStatusClass(s);
      html += '<span class="status ' + cls + '">' + s + '</span>';
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</section>';
  });

  container.innerHTML = html;

  // Re-init IntersectionObserver for active endpoint highlighting in sidebar
  // (sidebar.js runs before cards exist, so observer must be set up here)
  var currentPage = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src && src.indexOf('sidebar.js') !== -1) {
        var parts = src.split('/');
        parts.pop();
        parts.pop();
        var root = parts.length > 0 ? parts.join('/') + '/' : '';
        if (root) {
          var depth = root.split('/').filter(function(p) { return p === '..'; }).length;
          var pathname = window.location.pathname.split('/').filter(Boolean);
          var relevant = pathname.slice(-(depth + 1));
          return relevant.join('/');
        }
        break;
      }
    }
    return window.location.pathname.split('/').pop() || 'index.html';
  })();

  var CATEGORIES_COPY = [
    { key: 'system', page: 'system.html' },
    { key: 'auth', page: 'auth.html' },
    { key: 'users', page: 'users.html' },
    { key: 'groups', page: 'groups/general.html' },
    { key: 'group-items', page: 'groups/items.html' },
    { key: 'group-notes', page: 'groups/notes.html' },
    { key: 'group-skills', page: 'groups/skills.html' },
    { key: 'group-schemas', page: 'groups/schemas.html' },
    { key: 'group-export-import', page: 'groups/export-import.html' },
    { key: 'characters', page: 'groups/characters/main.html' },
    { key: 'character-templates', page: 'groups/characters/templates.html' },
    { key: 'character-items', page: 'groups/characters/items.html' },
    { key: 'character-notes', page: 'groups/characters/notes.html' },
    { key: 'character-skills', page: 'groups/characters/skills.html' }
  ];

  var matchingPage = false;
  for (var ci = 0; ci < CATEGORIES_COPY.length; ci++) {
    if (CATEGORIES_COPY[ci].page === pageId) {
      matchingPage = true;
      break;
    }
  }

  if (matchingPage) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          if (id) {
            document.querySelectorAll('.sidebar-endpoint.active').forEach(function (el) {
              el.classList.remove('active');
            });
            var link = document.querySelector('.sidebar-endpoint[data-endpoint-id="' + id + '"]');
            if (link) {
              link.classList.add('active');
            }
          }
        }
      });
    }, { rootMargin: '-100px 0px -100px 0px' });

    document.querySelectorAll('.endpoint-card').forEach(function (section) {
      observer.observe(section);
    });
  }
})();
