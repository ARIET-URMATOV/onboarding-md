# API Reference

Базовый URL: `/api`

## Auth

| Метод | Путь                | Описание                        | Auth |
| ----- | ------------------- | ------------------------------- | ---- |
| POST  | `/register`         | Регистрация                     | —    |
| POST  | `/login`            | Вход                            | —    |
| POST  | `/logout`           | Выход (удаление cookie)         | —    |
| GET   | `/me`               | Текущий пользователь + прогресс | ✓    |
| POST  | `/role`             | Выбор роли                      | ✓    |
| PATCH | `/profile`          | Обновление имени/аватара        | ✓    |
| POST  | `/profile/password` | Смена пароля                    | ✓    |
| POST  | `/demo/login`       | Вход в демо-аккаунт             | —    |
| POST  | `/demo/reset`       | Сброс демо-аккаунта             | —    |

## Progress

| Метод | Путь               | Описание                     | Auth |
| ----- | ------------------ | ---------------------------- | ---- |
| POST  | `/progress/task`   | Переключить задачу           | ✓    |
| POST  | `/progress/stage`  | Завершить/сбросить этап      | ✓    |
| POST  | `/intro-seen`      | Отметить просмотр интро      | ✓    |
| POST  | `/voice`           | Вкл/выкл озвучку             | ✓    |

## Health

| Метод | Путь          | Описание |
| ----- | ------------- | -------- |
| GET   | `/api/health` | `{"ok": true}` |

## Схемы

### RegisterIn
```json
{ "email": "string", "password": "string", "name": "string?" }
```

### MeOut
```json
{
  "user": { "email": "...", "name": "...", "role": "...", "avatar": "...", "intro_seen": false, "voice_enabled": true },
  "progress": { "done_tasks": { "1": ["1-docs"], ... }, "xp": 420 }
}
```

### ProgressOut
```json
{ "done_tasks": { "1": ["1-docs", "1-lead", ...], ... }, "xp": 340 }
```

### Ошибки
```json
{ "detail": "Сессия истекла" }  // 401
{ "detail": "Неизвестная задача" }  // 400
```
