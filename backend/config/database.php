<?php
require_once __DIR__ . '/config.php';

function getDB() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id         INT          NOT NULL AUTO_INCREMENT,
            username   VARCHAR(100) NOT NULL,
            email      VARCHAR(255) NOT NULL,
            password   VARCHAR(255) NOT NULL,
            created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_username (username),
            UNIQUE KEY uq_email    (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS missions (
            id          INT          NOT NULL AUTO_INCREMENT,
            title       VARCHAR(255) NOT NULL,
            description TEXT,
            data        LONGTEXT     NOT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by  INT,
            PRIMARY KEY (id),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS tokens (
            id         INT         NOT NULL AUTO_INCREMENT,
            user_id    INT         NOT NULL,
            token      VARCHAR(64) NOT NULL,
            created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_token (token),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    return $pdo;
}
