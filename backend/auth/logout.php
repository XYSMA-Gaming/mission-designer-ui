<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    $pdo = getDB();
    $user = requireAuth($pdo);

    $stmt = $pdo->prepare('DELETE FROM tokens WHERE token = ?');
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    preg_match('/^Bearer (.+)$/', $authHeader, $matches);
    $stmt->execute([$matches[1]]);

    echo json_encode(['message' => 'Logged out']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
