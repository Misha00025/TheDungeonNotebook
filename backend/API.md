# API

Запросы к API выполняются по шаблону url: ``api/<версия>/<метод>``. Для API версии "v0" версия в адресной строке не указывается

Оглавление:
- [API](#api)
- [Уровни доступа](#уровни-доступа)
- [Версия "v0"](#версия-v0)
  - [get\_api](#get_api)
  - [auth](#auth)
  - [check\_access](#check_access)
  - [groups](#groups)
- [Версия "v1"](#версия-v1)
  - [notes](#notes)
    - [notes/\<note\_id\>](#notesnote_id)
      - [GET: notes/\<note\_id\>](#get-notesnote_id)
      - [PUT: notes/\<note\_id\>](#put-notesnote_id)
      - [DELETE: notes/\<note\_id\>](#delete-notesnote_id)
    - [notes/add](#notesadd)
  - [groups](#groups-1)
    - [groups/\<group\_id\>](#groupsgroup_id)
  - [users](#users)
    - [users/\<user\_id\>](#usersuser_id)
    - [users/add](#usersadd)
  - [items](#items)
    - [items/\<item\_id\>](#itemsitem_id)
      - [GET: items/\<item\_id\>](#get-itemsitem_id)
      - [PUT: items/\<item\_id\>](#put-itemsitem_id)
      - [DELETE: items/\<item\_id\>](#delete-itemsitem_id)
      - [POST: items/\<item\_id\>](#post-itemsitem_id)
    - [items/create](#itemscreate)

# Уровни доступа

Для каждого запроса существует свой уровень доступа. Согласно уровням доступа для разных запросов могут требоваться разные данные в заголовках (headers) запроса. <br/>
Далее показан список уровней доступа и их описание:
- всем (all) - уровень доступа не требующий каких-то особых условий для использования (доступен всем без авторизации);
- группам (groups) - уровень доступа, при котором требуется передать валидный сервисный ключ (`Service-token`) в заголовке запроса;
- пользователям (users) - уровень доступа, при котором необходимо передать валидный ключ пользователя (`token`) в заголовке запроса;
- пользователям и группам (users_and_groups) - уровень доступа, объединяющий предыдущие два. Допускает выполнения одного из указанных условий.

# Версия "v0"

Исходняя версия API переживающая постоянные удаления старых методов. <br/>
В ближайшее время будет содержать исключительно общедоступные методы, как get_api, auth и check_access

## get_api

Доступ: **всем**<br/>
Метод: **GET**

Запрос возвращает json схему, содержащую список версий api и доступные методы. <br/> 
Формат ответа выглядит следующим образом:
```json
{
  "api_methods": {
    "v0": [
      {
        "access_to": "all",
        "methods": [
          "GET"
        ],
        "url": "/api/get_api"
      },
      ...
    ]
    "v1": [
        ...
    ]
  }
}
```
`access_to` - показывает уровень доступа к запросу


## auth

Доступ: **всем**<br/>
Метод: POST<br/>

Запрос выполняющий авторизацию пользователя в api. <br/>
В теле ответа передаёт:
- `access_token` - ключ доступа пользователя к функциям API.

В теле запроса необходимо передать ответ, получаемый от серверов vk.ru при авторизации с помощью VK ID. 

## check_access

Доступ: **пользователям** и **группам**<br/>
Метод: GET

Запрос возвращает код 401, если авторизация провалилась и 200, если авторизация прошла. В случае успешной авторизации в теле запроса передаётся тип доступа: `access.type = user | group`.

## groups

Доступ: **пользователям**<br/>
Метод: GET

Запрос возвращает список групп в теле ответа в формате json. Список передаётся в поле `groups`.

Каждая группа содержит в себе следующие поля:
- `id` - индекс группы;
- `name` - название группы;
- `privileges` - привелегии группы (не реализовано).

# Версия "v1"

API версии "v1" на данный момент находится в разработке, всвязи с чем некоторые методы могут перестать работать/существовать/поддерживаться, как и свзязанные с этим проектом версии бота, использующие эти методы. На данный момент существуют методы, которые планируются к полному замещению другими:
- `get_user_info/<user_id>`;
- `user_is_mine`;
- `update_user_info`;
- `add_user_to_me`.

Всвязи с предстоящим удалением этих методов, их описание будет отсутствовать в данной документации. <br/>
Другие методы так же могут подвергнуться изменению, всвязи с чем рекомендуется следить за изменениями.

## notes

Доступ: **пользователям** и **группам**<br/>
Метод: GET

В ответе на запрос возвращает список заметок в формате json. Список содержится в поле `notes`. О содержании каждой заметки см. [GET: notes/<note_id>](#get-notesnote_id)


### notes/<note_id>

Доступ: **пользователям** и **группам**<br/>
Методы: GET | PUT | DELETE

Обрабатывает запросы для заметки с определённым индексом, переданным вместо `<note_id>`.

#### GET: notes/<note_id>

В ответ на запрос возвращает заметку в формате json. Заметка содержит поля:
- `group_id` - индекс группы, которой принадлежит заметка;
- `owner_id` - индекс владельца заметки;
- `id` - индекс заметки;
- `header` - заголовок заметки;
- `body` - тело заметки ***(может быть удалено)***;
- `last_modify` - дата последнего изменения заметки ***(может быть удалено)***;
- `author` - информация об авторе заметки в формате json ***(может быть удалено)***.

Поля внутри `author`:
- `vk_id` - индекс пользователя ***(будет изменено)***;
- `first_name` - имя пользователя;
- `last_name` - фамилия пользователя;
- `photo` - ссылка на фотографию профиля пользователя.

#### PUT: notes/<note_id>

Запро изменяет состояние существующей заметки на сервере. В теле запроса должен быть приложен json с полями: `header` и `body`.

#### DELETE: notes/<note_id>

Удалаляет заметку с заданным индексом.

### notes/add

Доступ: **пользователям** и **группам**<br/>
Метод: POST

Запрос добавляет заметку пользователю в определённой группе. В теле запроса обязательно наличие следующих полей:
- `header` - заголовок заметки;
- `body` - тело заметки.

Так же в теле запроса или в качестве параметров запроса должно быть передано одно из двух:
- (для пользователя) `group_id` - индекс группы, для которой создаётся заметка;
- (для группы) `user_id` - индекс пользователя, для которого создаётся заметка.

В теле ответа возвращает индекс созданной заметки в поле `last_id`

## groups

Доступ: **пользователям** и **группам**<br/>
Метод: GET

При запросе от имени **ПОЛЬЗОВАТЕЛЯ** возвращает список групп в формате json. Сам список помещён в поле `groups`. Каждый элемент в списке содержит следуюзие даные:
- `id` - идентификатор группы;
- `is_admin` - флаг, указывающий на то, является ли пользователь администратором группы или нет;
- `name` - название группы.

При запросе от имени **ГРУППЫ** возвращается результат аналогичный запросу [groups/<group_id>](#groupsgroup_id), где id группы определяется по сервисному ключу.

### groups/<group_id>

Доступ: **пользователям** и **группам**<br/>
Метод: GET

Возвращает данные о группе в формате json, содержащих поля:
- `id` - идентификатор группы;
- `name` - название группы;
- `admins` - список администраторов группы;
- `is_admin` - флаг, указывающий на то, является ли пользователь администратором;
- `users` - список участников группы (отображается только для **АДМИНИСТРАТОРОВ** и **ГРУПП**).

## users

Доступ: **пользователям** и **группам**<br/>
Метод: GET

При запросе от имени **ГРУППЫ** возвращает json содержащий два списка:
- `admins` - список администраторов группы;
- `users` - список пользователей группы.

При запросе от имени **ПОЛЬЗОВАТЕЛЯ** возвращает результат аналогичный GET-запросу [users/<user_id>](#usersuser_id) с идентификатором пользователя вместо `user_id`

### users/<user_id>

Доступ: **группам**<br/>
Методы: GET и DELETE

GET-запрос возвращает json, содержащий поля:
- `id` - индекс пользователя;
- `first_name` - имя пользователя;
- `last_name` - фамилия пользователя;
- `photo_link` - ссылка на фотографию профиля пользователя.

DELETE-запрос удаляет пользователя с указанным `user_id` из группы, вызвавшей метод.

### users/add

Доступ: **группам**<br/>
Методы: POST

Добавляет пользователя в группу. В теле запроса должно быть передано:
- `user_id` - идентификатор пользователя;
- `is_admin` - статус администратора группы.

## items

Доступ: **пользователям** и **группам**<br/>
Метод: GET

При запросе от **группы (*или от лица администратора группы*)** возвращается json с полем `items`, в котором содержится список предметов, содержащихся в группе. 

При запросе от любого **пользователя**, необходимо передать в качестве параметра `group_id` - индекс группы, к которой у пользователя есть доступ. 

Если пользователь не является администратором группы, то возвращается json с полем `items`, содержащий список предметов в инвентаре пользователя.

Для получения списа предметов из инвентаря пользователя при выполнении запроса от лица **группы (*или администратора*)** необходимо передать дополнительный параметр `owner_id`, содержащий индекс пользователя, чей инвентарь запрашивается.

### items/<item_id>

Доступ: **пользователям** и **группам**<br/>
Методы: GET, PUT, DELETE, POST

Все запросы этой категории выполняют обращение к единственному элементу базы данных. Все запросы этой кадегории (**кроме POST**) сохраняют правила из запроса [items](#items), только для одного предмета.

В качестве `item_id` может выступать как индекс предмета, так и название предмета.

#### GET: items/<item_id>

Возвращает json, содержащий следующие поля:
- `id` - индекс предмета;
- `name` - название предмета;
- `description` - описание предмета;
- `amount` (только для предмета в инвентаре) - количество предметов в инвентаре;
- `icon` - ссылка на изображение предмета.

#### PUT: items/<item_id>

При использовании от лица **группы или администратора**, необходимо в теле запроса передать одно или несколько полей:
- `name` - новое имя предмета;
- `description` - новое описание предмета;
- `icon` (не реализовано) - не реализовано.

При использовании от лица **пользователя**, необходимо передать поле `amount`, содержащее новое количество выбранного предмета.

В результате возвращает json содержащий информацию о изменённом предмете.

#### DELETE: items/<item_id>

При использовании от лица **группы или администратора** удалает предмет во всей группе (он удалится и в инвентарях всех пользователей группы).

При использовании от лица **пользователя** удаляет предмет из инвентаря выбранного пользователя.

#### POST: items/<item_id>

Добавляет предмет в инвентарь выбранного пользователя.

Может использоваться только от лица **пользователя** (т.е. при запросе от имени **группы или администратора** обязательно нужно указать `owner_id`).

В теле запроса можно передать поле `amount`, которое устанавливает начальное количество предмета в инвентаре.

### items/create

Доступ: **пользователям** и **группам**<br/>
Метод: GET

Добавляет предмет в группу. Доступно только от имени **группы или администратора**. 

В теле запроса необходимо передать:
- `name` - название нового предмета;
- `description` - описание предмета.

В результате возвращает json с полем `created_item`, содержащим информациб о созданном предмете.