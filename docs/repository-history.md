# История объединения репозиториев

Web был локально объединён с The Dungeon Notebook через Git subtree без squash. Исходные commit hashes не переписывались; старые Web-коммиты до импорта сохраняют прежние корневые пути.

Ветки-архивы исходных ссылок сохранены под `archive/web/local/*` и `archive/web/origin/*`; tip импорта — `archive/web/import-main`. Теги Web находятся под `web/*`. Существующий тег TDN `0.1.0` оставлен без изменений. Исходный каталог `frontend-new` сохранён. Push не выполнялся.

Из-за смены префикса обычный `git log --all -- web/` не показывает всю раннюю историю Web: для неё используйте `git log archive/web/import-main` или поиск по прежнему пути, например `git log --all -- <oldpath>`.
