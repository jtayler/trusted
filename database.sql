
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT,
  location TEXT,
  photo TEXT
);

INSERT INTO users (username, password, full_name, location, photo)
VALUES ('john', 'secret', 'John Smith', 'New York', 'https://bootdey.com/img/Content/avatar/avatar7.png');


ALTER TABLE users ADD COLUMN switch_state BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN authorRank TEXT;
ALTER TABLE users ADD COLUMN authorPhoto TEXT;
