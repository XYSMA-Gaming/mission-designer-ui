<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$body = json_decode(file_get_contents('php://input'), true);
$username = trim(isset($body['username']) ? $body['username'] : '');
$email    = trim(isset($body['email'])    ? $body['email']    : '');
$password = isset($body['password']) ? $body['password'] : '';

if (!$username || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Username, email and password are required']);
    exit();
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters']);
    exit();
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit();
}

try {
    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Username or email already exists']);
        exit();
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    $stmt->execute([$username, $email, $hashedPassword]);
    $userId = $pdo->lastInsertId();

    $token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token) VALUES (?, ?)');
    $stmt->execute([$userId, $token]);

    echo json_encode([
        'token' => $token,
        'user'  => ['id' => (int)$userId, 'username' => $username, 'email' => $email],
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
