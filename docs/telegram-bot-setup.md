# Telegram-бот для auto-add (Шаг 2.5)

## 1. Создать бота (2 мин, нужен Telegram)

1. Открыть [@BotFather](https://t.me/BotFather) → `/newbot`
2. Имя: `MDigital Onboarding`, username: например `mdigital_onboarding_bot`
3. Скопировать **token** вида `123456:ABC-DEF...`
4. Задать в env backend: `TELEGRAM_BOT_TOKEN=<token>` (+ restart)

## 2. Выдать боту админку в каждой группе

1. Добавить бота в группу как участника
2. Группа → Управление → Администраторы → добавить бота
3. Включить право **«Приглашение пользователей»** (`can_invite_users`), остальное можно выключить
4. Проверка: `/admin` → «Коды и ссылки» → **«Проверить права бота»** — везде `✓`

## 3. Группы по ролям (frontend → свои, backend → свои)

В `/admin` → «Коды и ссылки» → поле групп — JSON с полем `roles`:

```json
[
  {"title": "Frontend Team", "chat_id": "-5444132439", "roles": ["frontend"]},
  {"title": "Backend Team", "chat_id": "-5114175931", "roles": ["backend"]}
]
```

- Пустой `roles` (или без поля) = группа для всех ролей.
- Сотрудник видит и добавляется **только в группы своей роли** (`frontend|backend|design`).
- Дизайн: пока без групп — сотрудник увидит «Групп для вашей роли пока нет», добавьте запись с `roles: ["design"]` когда появятся.

## 4. Узнать chat_id групп

- Web Telegram: открыть группу → URL `https://web.telegram.org/...#/im?p=c1234567890_...` → chat_id = `-1001234567890`
- Или добавить [@getmyid_bot](https://t.me/getmyid_bot) в группу → он напишет chat_id
- Вставить в `/admin` → поле групп: `[{"title":"Dev","chat_id":"-100123"}]`

## 4. Тестовые группы

Пока настоящих нет — создайте 2 пустые тестовые группы, добавьте бота админом,
вставьте их chat_id. Позже замените на настоящие без редеплоя (всё в `/admin`).

## 5. Как это работает для сотрудника (вариант A «Сначала Start»)

1. Сотрудник жмёт «Открыть бота →» и отправляет боту `/start` (шаг обязательный —
   иначе Telegram не отдаёт `getChat(@username)`). Webhook сохраняет контакт
   `telegram_contacts {tg_user_id ↔ username}`.
2. Возвращается в портал, вводит `@username`, жмёт «Добавить меня в группы».
3. Бэкенд резолвит `tg_id`: `telegram_contacts` → `getChat(@username)` → `getUpdates`;
   затем `unbanChatMember` (+ фолбэк `addChatMember`) по каждой группе его роли
   с проверкой `getChatMember`.
4. Полный успех → авто-зачёт `1-telegram` (`verification_log.method=telegram_add`,
   этап выполнен). Частичный → per-group статусы + invite-ссылки фолбэк.
5. Копирует шаблон приветствия и представляется команде.

Бота достаточно добавить админом (`can_invite_users`) в каждую группу один раз —
`chat_id` подхватится сам через webhook `my_chat_member` (HR потом проставляет `roles`).
