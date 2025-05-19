const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');

// Создание таблиц
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    coins INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collection (
    user_id TEXT,
    character TEXT,
    rarity TEXT,
    preview TEXT,
    PRIMARY KEY(user_id, character),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

function getUser(userId, callback) {
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.error('Ошибка получения данных пользователя:', err);
      return callback(err);
    }

    if (!row) {
      // Если пользователь не найден — создаём
      db.run('INSERT INTO users (id, coins) VALUES (?, ?)', [userId, 0], (insertErr) => {
        if (insertErr) {
          console.error('Ошибка при создании пользователя:', insertErr);
          return callback(insertErr);
        }
        console.log(`Создан новый пользователь ${userId}`);
        callback(null, { id: userId, coins: 0 });
      });
    } else {
      callback(null, row);
    }
  });
}

function updateCoins(userId, amount, callback) {
  getUser(userId, (err, user) => {
    if (err) return callback(err); // Ошибка при получении или создании пользователя

    db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [amount, userId], function (err) {
      if (err) {
        console.error('Ошибка при обновлении монет:', err);
        return callback(err);
      }
      console.log(`Монеты обновлены для пользователя ${userId}. Изменение: ${amount}`);
      callback(null);
    });
  });
}

function addCharacter(userId, character, rarity, preview, callback) {
  db.run(`INSERT INTO collection (user_id, character, rarity, preview) VALUES (?, ?, ?, ?)`, [userId, character, rarity, preview], callback);
}


function getCollection(id, callback) {
  db.all(`SELECT character, rarity FROM collection WHERE user_id = ?`, [id], callback);
}

module.exports = { getUser, updateCoins, addCharacter, getCollection };
