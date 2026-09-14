# Telegram-бот для auto-add (Шаг 2.5)

## 1. Создать бота (2 мин, нужен Telegram)

1. Открыть [@BotFather](https://t.me/BotFather) → `/newbot`
2. Имя: `MDigital Onboarding`, username: например `mdigital_onboarding_bot`
3. Скопировать **token** вида `123456:ABC-DEF...`
4. Задать в env backend:
   ```
   TELEGRAM_BOT_TOKEN=<token>
   ```

## 2. Webhook (автоподхват групп)

Webhook нужен, чтобы бот получал событие `my_chat_member` («бота добавили в группу») — без него `chat_id` не подхватывается автоматически.

### Настройка env (Render → Environment):

```bash
# Секрет для валидации входящих webhook-запросов
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Публичный URL бэкенда (без слеша на конце)
PUBLIC_BASE_URL=https://preload-md.onrender.com
```

### Регистрация webhook:

- **Автоматически** при старте бэкенда (если `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` + `PUBLIC_BASE_URL` заданы).
- **Вручную** через админку: `/admin` → «Коды и ссылки» → кнопка **«Зарегистрировать webhook»**.
- **Диагностика**: кнопка **«Статус webhook」** показывает `url`, количество ожидающих апдейтов, ошибки.

### Важно:

- Группы, добавленные **до** регистрации webhook, **не подхватятся** — Telegram шлёт `my_chat_member` только в момент добавления. Решение: удалить бота из группы → добавить заново.
- Webhook URL: `https://<PUBLIC_BASE_URL>/api/integrations/telegram-webhook`
- Если `last_error_message` показывает ошибку — проверьте, что `PUBLIC_BASE_URL` доступен из интернета (не localhost).

## 3. Выдать боту админку в каждой группе

1. Добавить бота в группу как участника
2. Группа → Управление → Администраторы → добавить бота
3. Включить право **«Приглашение пользователей»** (`can_invite_users`), остальное можно выключить
4. Проверка: `/admin` → «Коды и ссылки» → **«Проверить права бота」** — везде `✓`

## 4. Группы по ролям (frontend → свои, backend → свои)

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

## 5. Узнать chat_id групп

- Web Telegram: открыть группу → URL `https://web.telegram.org/...#/im?p=c1234567890_...` → chat_id = `-1001234567890`
- Или добавить [@getmyid_bot](https://t.me/getmyid_bot) в группу → он напишет chat_id
- Вставить в `/admin` → поле групп: `[{"title":"Dev","chat_id":"-100123"}]`

## 6. Как это работает для сотрудника (вариант A «Сначала Start»)

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

## 7. Пошаговый чеклист

1. [ ] Создать бота в BotFather → `TELEGRAM_BOT_TOKEN`
2. [ ] Задать `TELEGRAM_WEBHOOK_SECRET` (openssl rand -hex 32) и `PUBLIC_BASE_URL`
3. [ ] Добавить бота админом в группы → нажать «Зарегистрировать webhook» в админке
4. [ ] Проверить «Статус webhook» — `url` совпадает, ошибок нет
5. [ ] Проверить «Проверить права бота」 — везде `✓`
6. [ ] Проставить `roles` для каждой группы в JSON
7. [ ] Протестировать: добавить бота в тестовую группу → запись появляется в JSON
