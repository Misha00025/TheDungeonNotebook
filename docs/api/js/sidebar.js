(function () {
  'use strict';

  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  function getApiRoot() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src && src.indexOf('sidebar.js') !== -1) {
        var parts = src.split('/');
        parts.pop(); // 'sidebar.js'
        parts.pop(); // 'js'
        return parts.length > 0 ? parts.join('/') + '/' : '';
      }
    }
    return '';
  }

  function getCurrentPage() {
    var root = getApiRoot();
    if (root) {
      var depth = root.split('/').filter(function(p) { return p === '..'; }).length;
      var pathname = window.location.pathname.split('/').filter(Boolean);
      var relevant = pathname.slice(-(depth + 1));
      return relevant.join('/');
    }
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function getPathPrefix() {
    return getApiRoot();
  }

  var currentPage = getCurrentPage();

  var CATEGORIES = [
    { key: 'system', title: 'Системные', page: 'system.html', icon: '⚙️', children: null },
    { key: 'auth', title: 'Аутентификация', page: 'auth.html', icon: '🔐', children: null },
    { key: 'users', title: 'Пользователи', page: 'users.html', icon: '👤', children: null },
    {
      key: 'groups', title: 'Группы', icon: '📁', children: [
        { key: 'groups-main', title: 'Группы', page: 'groups/general.html', icon: '📁' },
        { key: 'group-items', title: 'Предметы', page: 'groups/items.html', icon: '⚔️' },
        { key: 'group-notes', title: 'Заметки', page: 'groups/notes.html', icon: '📝' },
        { key: 'group-skills', title: 'Навыки', page: 'groups/skills.html', icon: '🎯' },
        { key: 'group-schemas', title: 'Схемы', page: 'groups/schemas.html', icon: '📐' },
        { key: 'group-export-import', title: 'Экспорт/Импорт', page: 'groups/export-import.html', icon: '📦' },
        {
          key: 'characters', title: 'Персонажи', icon: '🧙', children: [
            { key: 'characters-main', title: 'Персонажи', page: 'groups/characters/main.html', icon: '🧙' },
            { key: 'character-templates', title: 'Шаблоны', page: 'groups/characters/templates.html', icon: '📋' },
            { key: 'character-items', title: 'Предметы', page: 'groups/characters/items.html', icon: '🎒' },
            { key: 'character-notes', title: 'Заметки', page: 'groups/characters/notes.html', icon: '📓' },
            { key: 'character-skills', title: 'Навыки', page: 'groups/characters/skills.html', icon: '💪' },
          ]
        },
      ]
    },
  ];

  function findCategoryByPage(cats, page) {
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      if (cat.page && cat.page === page) return cat;
      if (cat.children) {
        var found = findCategoryByPage(cat.children, page);
        if (found) return found;
      }
    }
    return null;
  }

  function countEndpoints(cat) {
    var count = 0;
    if (cat.page) {
      count = ENDPOINTS.filter(function (ep) { return ep.category === cat.key; }).length;
    }
    if (cat.children) {
      cat.children.forEach(function (child) {
        count += countEndpoints(child);
      });
    }
    return count;
  }

  function renderCategory(cat, depth, pathPrefix) {
    var html = '';
    var isActive = cat.page && currentPage === cat.page;
    var hasChildren = cat.children && cat.children.length > 0;
    var epCount = countEndpoints(cat);

    if (cat.page || hasChildren) {
      html += '<div class="sidebar-category' + (isActive ? ' active' : '') + '" data-category="' + cat.key + '">';

      if (hasChildren) {
        html += '<div class="sidebar-category-header" data-target="' + cat.key + '">';
        html += '<span class="arrow">&#9660;</span>';
        html += '<span>' + cat.icon + ' ' + cat.title + '</span>';
        if (epCount > 0) {
          html += '<span class="ep-count">' + epCount + '</span>';
        }
        html += '</div>';

        html += '<ul class="sidebar-endpoints sidebar-nested" id="cat-' + cat.key + '">';
        cat.children.forEach(function (child) {
          html += '<li>' + renderCategory(child, depth + 1, pathPrefix) + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<div class="sidebar-category-header sidebar-page" data-target="' + cat.key + '">';
        html += '<a href="' + pathPrefix + cat.page + '" class="sidebar-page-link' + (isActive ? ' active' : '') + '">';
        html += '<span>' + cat.icon + ' ' + cat.title + '</span>';
        html += '</a>';
        if (epCount > 0) {
          html += '<span class="ep-count">' + epCount + '</span>';
        }
        html += '</div>';

        var endpoints = ENDPOINTS.filter(function (ep) {
          return ep.category === cat.key;
        });
        if (endpoints.length > 0) {
          html += '<ul class="sidebar-endpoints" id="cat-' + cat.key + '">';
          endpoints.forEach(function (ep) {
            html += '<li>';
            html += '<a href="' + pathPrefix + cat.page + '#' + ep.id + '" class="sidebar-endpoint" data-endpoint-id="' + ep.id + '">';
            html += '<span class="ep-method ep-' + ep.method.toLowerCase() + '">' + ep.method + '</span>';
            html += '<span class="ep-url">' + ep.url + '</span>';
            html += '</a>';
            html += '</li>';
          });
          html += '</ul>';
        }
      }

      html += '</div>';
    }

    return html;
  }

  function renderSidebar() {
    var html = '';
    var pathPrefix = getPathPrefix();
    html += '<div class="sidebar-header">📖 The Dungeon Notebook API</div>';
    html += '<input type="text" class="sidebar-search" id="sidebar-search" placeholder="🔍 Поиск endpoint\'ов...">';

    html += '<nav id="nav-categories">';
    CATEGORIES.forEach(function (cat) {
      html += renderCategory(cat, 0, pathPrefix);
    });
    html += '</nav>';

    sidebar.innerHTML = html;
  }

  function initSearch() {
    var searchInput = document.getElementById('sidebar-search');
    if (!searchInput) return;

    var debounceTimer;

    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var query = searchInput.value.trim().toLowerCase();
        var endpointLinks = document.querySelectorAll('.sidebar-endpoint');
        var categories = document.querySelectorAll('.sidebar-category');

        endpointLinks.forEach(function (link) {
          var method = (link.querySelector('.ep-method') || {}).textContent || '';
          var url = (link.querySelector('.ep-url') || {}).textContent || '';
          var text = (method + ' ' + url).toLowerCase();

          if (!query || text.indexOf(query) !== -1) {
            link.classList.remove('hidden');
          } else {
            link.classList.add('hidden');
          }
        });

        categories.forEach(function (cat) {
          var lists = cat.querySelectorAll('.sidebar-endpoints');
          var hasVisible = false;
          lists.forEach(function (list) {
            var visible = list.querySelectorAll('.sidebar-endpoint:not(.hidden)');
            if (visible.length > 0) hasVisible = true;
          });
          if (!hasVisible) {
            cat.classList.add('hidden');
          } else {
            cat.classList.remove('hidden');
          }
        });
      }, 200);
    });
  }

  function initCollapse() {
    sidebar.addEventListener('click', function (e) {
      var header = e.target.closest('.sidebar-category-header');
      if (!header) return;

      if (header.classList.contains('sidebar-page')) return;

      var category = header.closest('.sidebar-category');
      if (!category) return;

      var list = category.querySelector('.sidebar-endpoints');
      var arrow = header.querySelector('.arrow');
      if (!list || !arrow) return;

      list.classList.toggle('collapsed');
      arrow.classList.toggle('collapsed');
    });
  }

  function initDefaultCollapse() {
    var allLists = document.querySelectorAll('.sidebar-endpoints');
    var allArrows = document.querySelectorAll('.sidebar-category-header .arrow');

    allLists.forEach(function (list) { list.classList.add('collapsed'); });
    allArrows.forEach(function (arrow) { arrow.classList.add('collapsed'); });

    var activeCat = document.querySelector('.sidebar-category.active');
    if (activeCat) {
      var list = activeCat.querySelector('.sidebar-endpoints');
      if (list) list.classList.remove('collapsed');
      var arrow = activeCat.querySelector('.arrow');
      if (arrow) arrow.classList.remove('collapsed');

      var parent = activeCat.closest('.sidebar-nested');
      while (parent) {
        var parentCat = parent.closest('.sidebar-category');
        if (parentCat) {
          var plist = parentCat.querySelector('.sidebar-endpoints');
          if (plist) plist.classList.remove('collapsed');
          var parrow = parentCat.querySelector('.arrow');
          if (parrow) parrow.classList.remove('collapsed');
        }
        parent = parent.parentElement.closest('.sidebar-nested');
      }
    }
  }

  function initActiveEndpoint() {
    function updateActiveFromHash() {
      var hash = window.location.hash;
      if (!hash) return;

      var id = hash.substring(1);
      document.querySelectorAll('.sidebar-endpoint.active').forEach(function (el) {
        el.classList.remove('active');
      });

      var target = document.querySelector('.sidebar-endpoint[data-endpoint-id="' + id + '"]');
      if (target) {
        target.classList.add('active');
      }
    }

    updateActiveFromHash();

    window.addEventListener('hashchange', updateActiveFromHash);

    var matchingCategory = findCategoryByPage(CATEGORIES, currentPage);

    if (matchingCategory) {
      var endpointLinks = document.querySelectorAll('.sidebar-endpoint');
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
  }

  function initMobileMenu() {
    var toggle = document.getElementById('sidebar-toggle');
    var overlay = document.getElementById('sidebar-overlay');

    if (toggle) {
      toggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
        document.body.classList.toggle('sidebar-open');
        if (overlay) overlay.classList.toggle('visible');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', function () {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        overlay.classList.remove('visible');
      });
    }

    sidebar.addEventListener('click', function (e) {
      var link = e.target.closest('.sidebar-endpoint');
      if (link && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        if (overlay) overlay.classList.remove('visible');
      }
    });
  }

  renderSidebar();
  initSearch();
  initCollapse();
  initDefaultCollapse();
  initActiveEndpoint();
  initMobileMenu();
})();
